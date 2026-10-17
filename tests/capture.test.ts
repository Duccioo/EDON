import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseCapture, captureSource } from "../packages/shared/capture";
import {
  archiveTile,
  restoreTile,
  createTile,
  desktopSchema,
  tileSizeAllowed,
} from "../packages/shared/model";
import { seedDesktop } from "../packages/shared/seed";
import { MarkdownContent } from "../apps/web/src/MarkdownContent";

test("capture extracts Markdown tasks without dropping context, media or code", () => {
  const source =
    "# Viaggio\n\nPortare **poco**.\n\n![Mappa](/uploads/map.gif)\n\n- [ ] Prenotare il treno\n- [x] Controllare il passaporto\n\n````md\n- [ ] Questo è codice\n```\n````";
  const note = parseCapture(source, "text");
  assert.equal(note.title, "Viaggio");
  assert.equal(note.items.length, 0);
  assert.ok(note.body.includes("- [ ] Prenotare"));
  const todo = parseCapture(source, "data");
  assert.deepEqual(
    todo.items.map(({ text, done }) => ({ text, done })),
    [
      { text: "Prenotare il treno", done: false },
      { text: "Controllare il passaporto", done: true },
    ],
  );
  assert.ok(todo.body.includes("![Mappa](/uploads/map.gif)"));
  assert.ok(todo.body.includes("Questo è codice"));
  assert.ok(todo.body.includes("**poco**"));
  assert.ok(!todo.body.includes("Prenotare"));
  assert.throws(() => parseCapture("solo testo", "data"), /attività/);
  assert.throws(
    () =>
      parseCapture(
        Array.from({ length: 31 }, () => "- [ ] Una cosa").join("\n"),
        "data",
      ),
    /30 attività/,
  );
  assert.throws(
    () => parseCapture("- [ ] " + "a".repeat(301), "data"),
    /300 caratteri/,
  );
  const tile = createTile("data", []);
  tile.config = { ...tile.config, body: todo.body, items: todo.items };
  const roundtrip = parseCapture(captureSource(tile), "data", "Viaggio");
  assert.equal(roundtrip.body, todo.body);
  assert.deepEqual(
    roundtrip.items.map(({ text, done }) => ({ text, done })),
    todo.items.map(({ text, done }) => ({ text, done })),
  );
});

test("archiving frees the cell and restoring preserves content, size and backups", () => {
  let desktop = seedDesktop();
  const tile = desktop.tiles.find((t) => t.type === "text")!;
  const archived = archiveTile(desktop, tile.id);
  assert.equal(archived.tiles.length, desktop.tiles.length - 1);
  assert.deepEqual(archived.archive[0], tile);
  const saved = desktopSchema.parse(JSON.parse(JSON.stringify(archived)));
  const restored = restoreTile(saved, tile.id);
  assert.equal(restored.archive.length, 0);
  assert.deepEqual(
    restored.tiles.find((t) => t.id === tile.id)?.config,
    tile.config,
  );
  assert.equal(desktop.archive.length, 0);
  const blocked = {
    ...saved,
    settings: { ...saved.settings, maxTiles: saved.tiles.length },
  };
  assert.throws(() => restoreTile(blocked, tile.id), /Limite/);
  assert.equal(blocked.archive.length, 1);
  assert.throws(
    () =>
      archiveTile(desktop, desktop.tiles.find((t) => t.type === "clock")!.id),
    /solo note/,
  );
  const { archive, ...legacy } = desktop;
  assert.deepEqual(desktopSchema.parse(legacy).archive, []);
});

test("notes and TODOs allow 3x3 while every other tile stays within its maximum", () => {
  for (const type of ["text", "data"] as const) {
    const tile = createTile(type, [], { w: 3, h: 3 });
    assert.ok(tileSizeAllowed(tile));
    assert.ok(
      desktopSchema.safeParse({ ...seedDesktop(), tiles: [tile] }).success,
    );
  }
  for (const type of ["link", "image", "clock", "folder"] as const) {
    assert.throws(() => createTile(type, [], { w: 3, h: 3 }), /massima/);
    const tile = { ...createTile(type, []), w: 3, h: 3 };
    assert.equal(
      desktopSchema.safeParse({ ...seedDesktop(), tiles: [tile] }).success,
      false,
    );
  }
});

test("Markdown renders formatting, checklists and GIFs without raw HTML or unsafe URLs", () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownContent, {
      text: "**Appunto**\n\n- [ ] Una cosa\n\n![GIF](/uploads/test.gif)\n\n<script>alert(1)</script>\n\n[no](javascript:alert%281%29)\n\n![no](data:image/svg+xml,bad)",
    }),
  );
  assert.ok(html.includes("<strong>Appunto</strong>"));
  assert.ok(html.includes('type="checkbox"'));
  assert.ok(html.includes("/uploads/test.gif"));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('src="data:'));
});

test("archived notes survive the API roundtrip and cannot share an active tile identifier", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { buildApp } = await import("../apps/server/src/app");
  const dataDir = await mkdtemp(join(tmpdir(), "edon-archive-"));
  const app = await buildApp({ dataDir });
  try {
    const setup = await app.inject({
      method: "POST",
      url: "/api/setup",
      payload: { password: "archive-test-password" },
    });
    const cookie = `session=${setup.cookies[0].value}`;
    const initial = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json();
    const tile = initial.tiles.find((t: { type: string }) => t.type === "text");
    const changed = archiveTile(initial, tile.id);
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/desktop",
          headers: { cookie },
          payload: changed,
        })
      ).statusCode,
      200,
    );
    const saved = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json();
    assert.equal(saved.archive[0].id, tile.id);
    assert.equal(saved.tiles.length, initial.tiles.length - 1);
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/desktop",
          headers: { cookie },
          payload: { ...saved, tiles: [...saved.tiles, tile] },
        })
      ).statusCode,
      400,
    );
    const restored = restoreTile(saved, tile.id);
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/desktop",
          headers: { cookie },
          payload: restored,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ url: "/api/desktop", headers: { cookie } })).json()
        .archive.length,
      0,
    );
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
