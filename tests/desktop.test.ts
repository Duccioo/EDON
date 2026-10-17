import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  arrangeTile,
  compactTiles,
  createTile,
  desktopSchema,
  safeLink,
} from "../packages/shared/model";
import { seedDesktop } from "../packages/shared/seed";
import { buildApp } from "../apps/server/src/app";

test("layouts remain valid when adding, resizing, moving and duplicating a clock", () => {
  let desktop = seedDesktop();
  desktop.settings.rows = 12;
  assert.equal(desktopSchema.safeParse(desktop).success, true);
  const clock = createTile("clock", desktop.tiles, { w: 2, h: 2 });
  desktop.tiles.push(clock);
  assert.equal(arrangeTile(desktop.tiles, { ...clock, x: 0, y: 0 }), null);
  const moved = arrangeTile(desktop.tiles, { ...clock, x: 4, y: 6 });
  assert.ok(moved);
  desktop.tiles = moved;
  assert.equal(desktopSchema.safeParse(desktop).success, true);
  const copy = { ...clock, ...createTile("clock", desktop.tiles, clock) };
  desktop.tiles.push(copy);
  assert.equal(desktopSchema.safeParse(desktop).success, true);
  assert.equal(
    desktopSchema.safeParse({
      ...desktop,
      tiles: [...desktop.tiles, desktop.tiles[0]],
    }).success,
    false,
  );
  assert.equal(safeLink("javascript:alert(1)"), false);
  assert.equal(safeLink("obsidian://open?vault=Personal"), true);
});

test("movement swaps equal tiles and never pushes neighbours down", () => {
  const desktop = seedDesktop();
  const a = desktop.tiles.find((t) => t.title === "Obsidian")!;
  const b = desktop.tiles.find((t) => t.title === "GitHub")!;
  const changed = arrangeTile(desktop.tiles, { ...a, x: b.x, y: b.y });
  assert.ok(changed);
  assert.deepEqual(changed.find((t) => t.id === b.id)?.x, a.x);
  assert.deepEqual(
    changed.filter((t) => ![a.id, b.id].includes(t.id)),
    desktop.tiles.filter((t) => ![a.id, b.id].includes(t.id)),
  );
  assert.ok(desktopSchema.safeParse({ ...desktop, tiles: changed }).success);
  assert.equal(arrangeTile(desktop.tiles, { ...a, x: 2, y: 0 }), null);
  const legacy = { ...desktop.settings };
  delete (legacy as Partial<typeof legacy>).radius;
  assert.equal(
    desktopSchema.parse({ ...desktop, settings: legacy }).settings.radius,
    14,
  );
});

test("authenticated storage, conflicts, safe uploads and persistence after restarting", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "edon-api-"));
  let app = await buildApp({ dataDir });
  try {
    assert.equal(
      (await app.inject({ method: "PUT", url: "/api/desktop", payload: {} }))
        .statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/setup",
          payload: { password: "short" },
        })
      ).statusCode,
      400,
    );
    const setup = await app.inject({
      method: "POST",
      url: "/api/setup",
      payload: { password: "edon-test-password" },
    });
    assert.equal(setup.statusCode, 200);
    const session = setup.cookies[0].value;
    const cookies = { session };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/setup",
          payload: { password: "another-password" },
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/login",
          payload: { password: "incorrect-password" },
        })
      ).statusCode,
      401,
    );
    const initial = (
      await app.inject({ method: "GET", url: "/api/desktop", cookies })
    ).json();
    initial.settings.name = "Il desktop salvato";
    initial.settings.radius = 30;
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/desktop",
          cookies,
          payload: initial,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/desktop",
          cookies,
          payload: initial,
        })
      ).statusCode,
      409,
    );
    const malicious = {
      ...initial,
      revision: 1,
      tiles: initial.tiles.map((t: Record<string, unknown>, i: number) =>
        i === 0 ? { ...t, url: "javascript:alert(1)" } : t,
      ),
    };
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/desktop",
          cookies,
          payload: malicious,
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/logout",
          cookies,
          headers: { origin: "https://other.example" },
        })
      ).statusCode,
      403,
    );
    const multipart = (body: Buffer) =>
      Buffer.concat([
        Buffer.from(
          '--edon\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n',
        ),
        body,
        Buffer.from("\r\n--edon--\r\n"),
      ]);
    const headers = { "content-type": "multipart/form-data; boundary=edon" };
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      "base64",
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/uploads",
          headers,
          cookies,
          payload: multipart(Buffer.from('<svg onload="alert(1)"/>')),
        })
      ).statusCode,
      400,
    );
    const image = await app.inject({
      method: "POST",
      url: "/api/uploads",
      headers,
      cookies,
      payload: multipart(png),
    });
    assert.equal(image.statusCode, 200);
    const imageUrl = image.json().url;
    assert.equal((await app.inject({ url: imageUrl })).statusCode, 401);
    await app.close();
    app = await buildApp({ dataDir });
    const saved = (await app.inject({ url: "/api/desktop", cookies })).json();
    assert.equal(saved.settings.name, "Il desktop salvato");
    assert.equal(saved.settings.radius, 30);
    assert.deepEqual(
      (await app.inject({ url: imageUrl, cookies })).rawPayload,
      png,
    );
    assert.equal(
      (await app.inject({ url: "/uploads/..%2fdesktop.sqlite", cookies }))
        .statusCode,
      404,
    );
    await app.inject({ method: "POST", url: "/api/logout", cookies });
    assert.equal(
      (await app.inject({ url: "/api/desktop", cookies })).statusCode,
      401,
    );
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("compacting removes gaps without overlaps or leaving the grid", () => {
  const desktop = seedDesktop();
  desktop.settings.rows = 40;
  const spread = desktop.tiles.map((t, i) => ({
    ...t,
    x: (i * 2) % 5,
    y: i * 3,
    w: 1 + (i % 2),
    h: 1,
  }));
  assert.ok(desktopSchema.safeParse({ ...desktop, tiles: spread }).success);
  const packed = compactTiles(spread);
  assert.ok(desktopSchema.safeParse({ ...desktop, tiles: packed }).success);
  const height = (list: typeof spread) =>
    Math.max(...list.map((t) => t.y + t.h));
  assert.ok(height(packed) < height(spread));
  assert.deepEqual(
    packed.map((t) => [t.w, t.h]),
    spread.map((t) => [t.w, t.h]),
  );
  assert.deepEqual(
    compactTiles(packed).map((t) => [t.x, t.y]),
    packed.map((t) => [t.x, t.y]),
  );
});
