import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  readdir,
  rename,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../apps/server/src/app";
import { createTile, type Snapshot, type Tile } from "../packages/shared/model";

async function setupVault(archiveFolder = ".trash") {
  const vaultDir = await mkdtemp(join(tmpdir(), "edon-vault-regression-"));
  const app = await buildApp({
    dataDir: await mkdtemp(join(tmpdir(), "edon-vault-regression-data-")),
    agentToken: "vault-regression-token",
    vault: { path: vaultDir, archiveFolder },
  });
  const setup = await app.inject({
    method: "POST",
    url: "/api/setup",
    payload: { password: "una-password-molto-sicura" },
  });
  return {
    app,
    vaultDir,
    cookie: `session=${setup.cookies[0].value}`,
    authorization: "Bearer vault-regression-token",
  };
}

const noteUrl = (path: string) =>
  `/api/vault/note?path=${encodeURIComponent(path)}`;

test("Bearer tokens have read-only vault access, no session telemetry, and full-content search stays compact", async () => {
  const { app, vaultDir, cookie, authorization } = await setupVault();
  try {
    const needle = "parola-nascosta-oltre-estratto";
    await writeFile(
      join(vaultDir, "Search.md"),
      `# Search\n\n${"a".repeat(500)} ${needle}\n`,
    );
    const agent = (method: string, url: string, payload?: object) =>
      app.inject({
        method: method as "GET",
        url,
        payload,
        headers: { authorization },
      });
    assert.equal((await agent("GET", "/api/vault/notes")).statusCode, 200);
    assert.equal((await agent("GET", noteUrl("Search.md"))).statusCode, 200);
    assert.equal(
      (
        await agent("PUT", "/api/vault/note", {
          path: "Search.md",
          title: "No",
        })
      ).statusCode,
      401,
    );
    assert.equal((await agent("DELETE", noteUrl("Search.md"))).statusCode, 401);
    for (const path of ["/api/performance", "/api/ai-limits"])
      assert.equal((await agent("GET", path)).statusCode, 401);
    assert.equal(
      (await app.inject({ url: "/api/performance", headers: { cookie } }))
        .statusCode,
      200,
    );

    const result = (await agent("GET", `/api/vault/notes?q=${needle}`)).json();
    assert.equal(result.notes.length, 1);
    assert.ok(result.notes[0].excerpt.length <= 180);
    assert.equal("body" in result.notes[0], false);
    assert.equal("searchText" in result.notes[0], false);
  } finally {
    await app.close();
  }
});

test("agent tokens cannot write, relink or trash existing vault notes through tile APIs", async () => {
  const { app, vaultDir, cookie, authorization } = await setupVault();
  try {
    const secret = "# Segreto\n\nNon toccare.\n";
    await writeFile(join(vaultDir, "Segreto.md"), secret);
    const detail = (
      await app.inject({ url: noteUrl("Segreto.md"), headers: { cookie } })
    ).json();

    const directLink = await app.inject({
      method: "POST",
      url: "/api/tiles",
      headers: { authorization },
      payload: {
        type: "text",
        title: "Tentativo",
        config: {
          vaultPath: "Segreto.md",
          vaultVersion: detail.version,
          body: "sovrascritto",
        },
      },
    });
    assert.equal(directLink.statusCode, 403);
    assert.equal(await readFile(join(vaultDir, "Segreto.md"), "utf8"), secret);

    const newNote = await app.inject({
      method: "POST",
      url: "/api/tiles",
      headers: { authorization },
      payload: { type: "text", title: "Agente", config: { body: "no" } },
    });
    assert.equal(newNote.statusCode, 403);
    assert.deepEqual(await readdir(vaultDir), ["Segreto.md"]);

    const linkTile = await app.inject({
      method: "POST",
      url: "/api/tiles",
      headers: { authorization },
      payload: {
        type: "link",
        title: "Solo desktop",
        url: "https://example.com",
      },
    });
    assert.equal(linkTile.statusCode, 201);
    // Creating an unrelated agent tile must not export the user's existing
    // desktop notes into the vault as a side effect.
    assert.deepEqual(await readdir(vaultDir), ["Segreto.md"]);

    const linked = await app.inject({
      method: "POST",
      url: "/api/tiles",
      headers: { cookie },
      payload: {
        type: "text",
        title: detail.title,
        config: {
          vaultPath: detail.path,
          vaultVersion: detail.version,
          body: detail.body,
        },
      },
    });
    assert.equal(linked.statusCode, 201, linked.body);
    const id = linked.json().tile.id as string;

    const agentEdit = await app.inject({
      method: "PATCH",
      url: `/api/tiles/${id}`,
      headers: { authorization },
      payload: { config: { body: "modificato" } },
    });
    assert.equal(agentEdit.statusCode, 403);
    const agentDelete = await app.inject({
      method: "DELETE",
      url: `/api/tiles/${id}`,
      headers: { authorization },
    });
    assert.equal(agentDelete.statusCode, 403);
    assert.equal(await readFile(join(vaultDir, "Segreto.md"), "utf8"), secret);
  } finally {
    await app.close();
  }
});

test("a renamed or deleted vault note is never recreated at its old path", async () => {
  const { app, vaultDir, cookie } = await setupVault();
  try {
    const created = await app.inject({
      method: "POST",
      url: "/api/tiles",
      headers: { cookie },
      payload: { type: "text", title: "Spesa", config: { body: "Latte" } },
    });
    assert.equal(created.statusCode, 201);
    const tile = created.json().tile as Tile;
    const relPath = tile.config.vaultPath;
    const oldFull = join(vaultDir, relPath);
    assert.equal((await stat(oldFull)).isFile(), true);

    await rename(oldFull, join(vaultDir, "Lista spesa.md"));
    const snapshot = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json() as Snapshot;

    const unrelated = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: {
        ...snapshot,
        settings: { ...snapshot.settings, name: "Spesa riorganizzata" },
      },
    });
    assert.equal(unrelated.statusCode, 200, unrelated.body);
    await assert.rejects(stat(oldFull));

    const edited = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: {
        ...snapshot,
        settings: { ...snapshot.settings, name: "Spesa riorganizzata" },
        tiles: snapshot.tiles.map((item) =>
          item.id === tile.id
            ? {
                ...item,
                config: { ...item.config, body: "Latte e pane" },
              }
            : item,
        ),
      },
    });
    assert.equal(edited.statusCode, 409);
    await assert.rejects(stat(oldFull));
    assert.equal(
      await readFile(join(vaultDir, "Lista spesa.md"), "utf8"),
      "# Spesa\n\nLatte\n",
    );
  } finally {
    await app.close();
  }
});

test("a stale client snapshot reuses the server-assigned vault path instead of copying the note", async () => {
  const { app, vaultDir, cookie } = await setupVault();
  try {
    const snapshot = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json() as Snapshot;
    const note = createTile(
      "text",
      [],
      undefined,
      snapshot.settings.maxTiles,
      snapshot.settings,
    );
    note.title = "Idea";
    note.config.body = "Una sola copia.";

    const first = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: { ...snapshot, tiles: [note] },
    });
    assert.equal(first.statusCode, 200, first.body);
    const saved = first.json() as Snapshot;
    const assigned = saved.tiles[0].config.vaultPath;
    assert.equal(assigned, "Idea.md");
    assert.equal((await stat(join(vaultDir, "Idea.md"))).isFile(), true);

    const clock = createTile(
      "clock",
      [note],
      { w: 1, h: 1 },
      snapshot.settings.maxTiles,
      snapshot.settings,
    );
    const second = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: { ...snapshot, revision: saved.revision, tiles: [note, clock] },
    });
    assert.equal(second.statusCode, 200, second.body);
    const after = second.json() as Snapshot;
    assert.equal(
      after.tiles.find((tile) => tile.id === note.id)?.config.vaultPath,
      assigned,
    );
    assert.deepEqual(
      (await readdir(vaultDir)).filter((name) => name.endsWith(".md")),
      ["Idea.md"],
    );
    assert.equal(
      await readFile(join(vaultDir, "Idea.md"), "utf8"),
      "# Idea\n\nUna sola copia.\n",
    );
  } finally {
    await app.close();
  }
});

test("two tiles cannot share one vault file and a conflict leaves the file unchanged", async () => {
  const { app, vaultDir, cookie } = await setupVault();
  try {
    const raw = "# Condivisa\n\nOriginale\n";
    await writeFile(join(vaultDir, "Condivisa.md"), raw);
    const detail = (
      await app.inject({ url: noteUrl("Condivisa.md"), headers: { cookie } })
    ).json();
    const snapshot = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json() as Snapshot;
    const first = createTile(
      "text",
      [],
      undefined,
      snapshot.settings.maxTiles,
      snapshot.settings,
    );
    const second = createTile(
      "text",
      [first],
      undefined,
      snapshot.settings.maxTiles,
      snapshot.settings,
    );
    for (const [tile, body] of [
      [first, "Prima"],
      [second, "Seconda"],
    ] as const) {
      tile.title = "Condivisa";
      tile.config.vaultPath = detail.path;
      tile.config.vaultVersion = detail.version;
      tile.config.body = body;
    }
    const response = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: { ...snapshot, tiles: [first, second] },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(await readFile(join(vaultDir, "Condivisa.md"), "utf8"), raw);
  } finally {
    await app.close();
  }
});

test("existing lossy Markdown is rejected unchanged while EDON notes support versioned atomic edits", async () => {
  const { app, vaultDir, cookie } = await setupVault();
  try {
    const lossy = new Map<string, string>([
      ["Long body.md", `# Long body\n\n${"b".repeat(10001)}\n`],
      ["Long title.md", `# ${"t".repeat(121)}\n\nBody\n`],
      ["Long task.md", `# Long task\n\n- [ ] ${"x".repeat(301)}\n`],
      [
        "Many tasks.md",
        `# Many tasks\n\n${Array.from({ length: 31 }, (_, i) => `- [ ] Task ${i}`).join("\n")}\n`,
      ],
      [
        "Complex.md",
        "# Complex\n\nIntro\n\n- [ ] First\n\nBetween tasks\n\n- [x] Second\n\nOutro\n",
      ],
    ]);
    for (const [path, raw] of lossy) {
      await writeFile(join(vaultDir, path), raw);
      const detail = (
        await app.inject({ url: noteUrl(path), headers: { cookie } })
      ).json();
      const response = await app.inject({
        method: "PUT",
        url: "/api/vault/note",
        headers: { cookie },
        payload: {
          path,
          version: detail.version,
          title: detail.title,
          body: detail.body,
          items: detail.items,
        },
      });
      assert.equal(response.statusCode, 409, path);
      assert.equal(await readFile(join(vaultDir, path), "utf8"), raw, path);
    }

    const created = await app.inject({
      method: "PUT",
      url: "/api/vault/note",
      headers: { cookie },
      payload: { title: "EDON safe", body: "one" },
    });
    assert.equal(created.statusCode, 200);
    const first = created.json();
    assert.match(first.version, /^[\da-f]{64}$/);
    const missingVersion = await app.inject({
      method: "PUT",
      url: "/api/vault/note",
      headers: { cookie },
      payload: { path: first.path, title: first.title, body: "two" },
    });
    assert.equal(missingVersion.statusCode, 409);
    const edited = await app.inject({
      method: "PUT",
      url: "/api/vault/note",
      headers: { cookie },
      payload: {
        path: first.path,
        version: first.version,
        title: first.title,
        body: "two",
      },
    });
    assert.equal(edited.statusCode, 200);
    assert.equal(
      await readFile(join(vaultDir, first.path), "utf8"),
      "# EDON safe\n\ntwo\n",
    );
    assert.ok(
      (await readdir(vaultDir)).every((name) => !name.includes(".tmp")),
    );

    await writeFile(join(vaultDir, first.path), "# EDON safe\n\noutside\n");
    const stale = await app.inject({
      method: "PUT",
      url: "/api/vault/note",
      headers: { cookie },
      payload: {
        path: first.path,
        version: edited.json().version,
        title: first.title,
        body: "inside",
      },
    });
    assert.equal(stale.statusCode, 409);
    const staleDelete = await app.inject({
      method: "DELETE",
      url: `${noteUrl(first.path)}&version=${edited.json().version}`,
      headers: { cookie },
    });
    assert.equal(staleDelete.statusCode, 409);
    assert.equal(
      await readFile(join(vaultDir, first.path), "utf8"),
      "# EDON safe\n\noutside\n",
    );
  } finally {
    await app.close();
  }
});

test("desktop revision is checked before vault effects and tile writes and trash reject stale disk versions", async () => {
  const { app, vaultDir, cookie } = await setupVault();
  try {
    const created = await app.inject({
      method: "POST",
      url: "/api/tiles",
      headers: { cookie },
      payload: { type: "text", title: "Concurrent", config: { body: "EDON" } },
    });
    assert.equal(created.statusCode, 201);
    const relPath = created.json().tile.config.vaultPath as string;
    const full = join(vaultDir, relPath);
    const snapshot = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json() as Snapshot;
    const tile = snapshot.tiles.find((t) => t.config.vaultPath === relPath)!;
    assert.match(tile.config.vaultVersion, /^[\da-f]{64}$/);

    const staleRevision = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: {
        ...snapshot,
        revision: snapshot.revision - 1,
        tiles: snapshot.tiles.filter((t) => t.id !== tile.id),
      },
    });
    assert.equal(staleRevision.statusCode, 409);
    assert.equal((await stat(full)).isFile(), true);

    await writeFile(full, "# Concurrent\n\nOutside\n");
    const changed = snapshot.tiles.map((t) =>
      t.id === tile.id ? { ...t, config: { ...t.config, body: "Inside" } } : t,
    );
    const staleWrite = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: { ...snapshot, tiles: changed },
    });
    assert.equal(staleWrite.statusCode, 409);
    assert.equal(await readFile(full, "utf8"), "# Concurrent\n\nOutside\n");

    const refreshed = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json() as Snapshot;
    await writeFile(full, "# Concurrent\n\nOutside again\n");
    const staleTrash = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: {
        ...refreshed,
        tiles: refreshed.tiles.filter((t) => t.id !== tile.id),
      },
    });
    assert.equal(staleTrash.statusCode, 409);
    assert.equal(
      await readFile(full, "utf8"),
      "# Concurrent\n\nOutside again\n",
    );
  } finally {
    await app.close();
  }
});

test("linking a non-empty note uses its version and a later conflict prevents all disk writes", async () => {
  const { app, vaultDir, cookie } = await setupVault();
  try {
    const original = "# Existing\r\n\r\nPinned body\r\n\r\n- [ ] Task\r\n";
    const canonical = "# Existing\n\nPinned body\n\n- [ ] Task\n";
    await writeFile(join(vaultDir, "Existing.md"), original);
    const detail = (
      await app.inject({ url: noteUrl("Existing.md"), headers: { cookie } })
    ).json();
    const linked = await app.inject({
      method: "POST",
      url: "/api/tiles",
      headers: { cookie },
      payload: {
        type: detail.kind,
        title: detail.title,
        config: {
          body: detail.body,
          items: detail.items,
          vaultPath: detail.path,
          vaultVersion: detail.version,
        },
      },
    });
    assert.equal(linked.statusCode, 201, linked.body);
    assert.equal(
      await readFile(join(vaultDir, "Existing.md"), "utf8"),
      original,
    );
    await writeFile(join(vaultDir, "Existing.md"), canonical);

    const second = await app.inject({
      method: "POST",
      url: "/api/tiles",
      headers: { cookie },
      payload: { type: "text", title: "Second", config: { body: "Original" } },
    });
    const snapshot = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json() as Snapshot;
    const changed = snapshot.tiles.map((tile) => ({
      ...tile,
      config: { ...tile.config, body: `${tile.config.body} edited` },
    }));
    const secondPath = second.json().tile.config.vaultPath;
    const secondRaw = "# Second\n\nExternal change\n";
    await writeFile(join(vaultDir, secondPath), secondRaw);
    const response = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: { ...snapshot, tiles: changed },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(
      await readFile(join(vaultDir, "Existing.md"), "utf8"),
      canonical,
    );
    assert.equal(await readFile(join(vaultDir, secondPath), "utf8"), secondRaw);
  } finally {
    await app.close();
  }
});

test("vault reads, writes, renames and trash cannot traverse symlinks outside the vault", async () => {
  const { app, vaultDir, cookie } = await setupVault("trash");
  const outside = await mkdtemp(join(tmpdir(), "edon-outside-vault-"));
  try {
    await writeFile(join(outside, "Secret.md"), "# Secret\n\noutside\n");
    await symlink(join(outside, "Secret.md"), join(vaultDir, "Link.md"));
    await symlink(outside, join(vaultDir, "linked"), "dir");
    await symlink(outside, join(vaultDir, "trash"), "dir");
    await writeFile(join(vaultDir, "Normal.md"), "# Normal\n\nsafe\n");

    assert.equal(
      (await app.inject({ url: noteUrl("Link.md"), headers: { cookie } }))
        .statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          url: noteUrl("linked/Secret.md"),
          headers: { cookie },
        })
      ).statusCode,
      400,
    );
    for (const path of ["Link.md", "linked/New.md"])
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: "/api/vault/note",
            headers: { cookie },
            payload: {
              path,
              title: "Denied",
              body: "no",
              version: "0".repeat(64),
            },
          })
        ).statusCode,
        400,
      );
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: `${noteUrl("Link.md")}&version=${"0".repeat(64)}`,
          headers: { cookie },
        })
      ).statusCode,
      400,
    );
    const normal = await app.inject({
      url: noteUrl("Normal.md"),
      headers: { cookie },
    });
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: `${noteUrl("Normal.md")}&version=${normal.json().version}`,
          headers: { cookie },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      await readFile(join(vaultDir, "Normal.md"), "utf8"),
      "# Normal\n\nsafe\n",
    );
    assert.equal(
      await readFile(join(outside, "Secret.md"), "utf8"),
      "# Secret\n\noutside\n",
    );
  } finally {
    await app.close();
  }
});
