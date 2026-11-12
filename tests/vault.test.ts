import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../apps/server/src/app";
import type { Desktop, Tile } from "../packages/shared/model";

test("Obsidian Vault integration syncs tiles, notes, TODOs, archive and trash two-way", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "edon-vault-data-"));
  const vaultDir = await mkdtemp(join(tmpdir(), "edon-obsidian-vault-"));

  // Pre-populate an existing note with frontmatter and tasks in the Vault
  await mkdir(join(vaultDir, "Progetti"), { recursive: true });
  await writeFile(
    join(vaultDir, "Progetti", "Roadmap.md"),
    [
      "---",
      "tags: [edon, roadmap]",
      "---",
      "# Roadmap Q4",
      "",
      "Obiettivi principali del trimestre.",
      "",
      "- [ ] Sincronizzare vault",
      "- [x] Vista laterale documento",
      "",
    ].join("\n"),
    "utf8",
  );

  const app = await buildApp({
    dataDir,
    agentToken: "vault-token",
  });

  try {
    const setup = await app.inject({
      method: "POST",
      url: "/api/setup",
      payload: { password: "una-password-molto-sicura" },
    });
    assert.equal(setup.statusCode, 200);
    const cookie = setup.headers["set-cookie"] as string;

    // Configure Vault from Settings API
    const cfg = await app.inject({
      method: "PUT",
      url: "/api/vault",
      headers: { cookie },
      payload: {
        path: vaultDir,
        folder: "EDON",
        archiveFolder: ".trash",
      },
    });
    assert.equal(cfg.statusCode, 200);
    const status = cfg.json();
    assert.equal(status.configured, true);
    assert.equal(status.noteCount, 1);
    assert.deepEqual(status.folders, ["Progetti"]);

    // List and read existing Vault notes
    const listRes = await app.inject({
      method: "GET",
      url: "/api/vault/notes",
      headers: { cookie },
    });
    assert.equal(listRes.statusCode, 200);
    const list = listRes.json();
    assert.equal(list.notes.length, 1);
    assert.equal(list.notes[0].path, "Progetti/Roadmap.md");
    assert.equal(list.notes[0].title, "Roadmap Q4");
    assert.equal(list.notes[0].kind, "data");
    assert.equal(list.notes[0].taskCount, 2);
    assert.equal(list.notes[0].doneCount, 1);

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/vault/note?path=${encodeURIComponent("Progetti/Roadmap.md")}`,
      headers: { cookie },
    });
    assert.equal(detailRes.statusCode, 200);
    const detail = detailRes.json();
    assert.equal(detail.title, "Roadmap Q4");
    assert.equal(detail.body, "Obiettivi principali del trimestre.");
    assert.equal(detail.items.length, 2);
    assert.ok(detail.obsidianUrl.startsWith("obsidian://open?vault="));

    // Create a new text tile via Agent/API -> automatically writes a .md file in EDON/
    const createdTileRes = await app.inject({
      method: "POST",
      url: "/api/tiles",
      headers: { authorization: "Bearer vault-token" },
      payload: {
        type: "text",
        title: "Idea veloce",
        config: { body: "Scrivere su file markdown puro." },
      },
    });
    assert.equal(createdTileRes.statusCode, 201);
    const createdTile = createdTileRes.json().tile as Tile;
    assert.equal(createdTile.config.vaultPath, "EDON/Idea veloce.md");

    const diskContent = await readFile(
      join(vaultDir, "EDON", "Idea veloce.md"),
      "utf8",
    );
    assert.match(diskContent, /# Idea veloce/);
    assert.match(diskContent, /Scrivere su file markdown puro\./);

    // Edit the .md file directly on disk (simulating Obsidian edit) -> GET /api/desktop reflects it
    await writeFile(
      join(vaultDir, "EDON", "Idea veloce.md"),
      "# Idea aggiornata da Obsidian\n\nTesto modificato fuori da EDON.\n",
      "utf8",
    );

    const desktopRes = await app.inject({
      method: "GET",
      url: "/api/desktop",
      headers: { cookie },
    });
    assert.equal(desktopRes.statusCode, 200);
    const desktop = desktopRes.json() as Desktop;
    const syncedTile = desktop.tiles.find((t) => t.id === createdTile.id)!;
    assert.equal(syncedTile.title, "Idea aggiornata da Obsidian");
    assert.equal(syncedTile.config.body, "Testo modificato fuori da EDON.");

    // Pin the existing Progetti/Roadmap.md note onto the desktop and toggle a task from EDON
    const pinnedRes = await app.inject({
      method: "POST",
      url: "/api/tiles",
      headers: { authorization: "Bearer vault-token" },
      payload: {
        type: "data",
        title: "Roadmap Q4",
        config: {
          vaultPath: "Progetti/Roadmap.md",
          vaultVersion: detail.version,
          body: detail.body,
          items: [
            { id: "1", text: "Sincronizzare vault", done: true },
            { id: "2", text: "Vista laterale documento", done: true },
          ],
        },
      },
    });
    assert.equal(pinnedRes.statusCode, 201, pinnedRes.body);

    const updatedRoadmap = await readFile(
      join(vaultDir, "Progetti", "Roadmap.md"),
      "utf8",
    );
    // Frontmatter is preserved and tasks are updated
    assert.match(updatedRoadmap, /tags: \[edon, roadmap\]/);
    assert.match(updatedRoadmap, /- \[x\] Sincronizzare vault/);

    // Unpinning (archiving) a tile removes it from desktop.tiles AND keeps the .md file intact in the Vault
    const snap1 = (
      await app.inject({
        method: "GET",
        url: "/api/desktop",
        headers: { cookie },
      })
    ).json() as Desktop & { revision: number };
    const roadmapTile = snap1.tiles.find(
      (t) => t.config.vaultPath === "Progetti/Roadmap.md",
    )!;
    const afterArchive = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: {
        ...snap1,
        tiles: snap1.tiles.filter((t) => t.id !== roadmapTile.id),
        archive: [roadmapTile, ...snap1.archive],
      },
    });
    assert.equal(afterArchive.statusCode, 200);
    const snap2 = afterArchive.json() as Desktop & { revision: number };
    // Vault acts as the single archive when active, so archive array stays empty and file stays in Progetti/Roadmap.md
    assert.equal(snap2.archive.length, 0);
    const stillOnDisk = await stat(join(vaultDir, "Progetti", "Roadmap.md"));
    assert.equal(stillOnDisk.isFile(), true);

    // Deleting a tile from the desktop moves its .md file into .trash/
    const afterDelete = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: {
        ...snap2,
        tiles: snap2.tiles.filter((t) => t.id !== createdTile.id),
      },
    });
    assert.equal(afterDelete.statusCode, 200);
    await assert.rejects(stat(join(vaultDir, "EDON", "Idea veloce.md")));
    const trashed = await stat(
      join(vaultDir, ".trash", "EDON", "Idea veloce.md"),
    );
    assert.equal(trashed.isFile(), true);
  } finally {
    await app.close();
  }
});
