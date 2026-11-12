import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createFolderChild,
  createTile,
  desktopSchema,
} from "../packages/shared/model";
import { seedDesktop } from "../packages/shared/seed";
import { buildApp } from "../apps/server/src/app";

test("folder tiles default to 2x2 with an empty children list", () => {
  const desktop = seedDesktop();
  const folder = createTile("folder", desktop.tiles);
  assert.equal(folder.w, 2);
  assert.equal(folder.h, 2);
  assert.deepEqual(folder.config.children, []);
  assert.equal(
    desktopSchema.safeParse({ ...desktop, tiles: [...desktop.tiles, folder] })
      .success,
    true,
  );
});

test("legacy desktops without children still parse", () => {
  const desktop = seedDesktop();
  const legacy = {
    ...desktop,
    tiles: desktop.tiles.map((t) => {
      const { children: _dropped, ...config } = t.config;
      return { ...t, config };
    }),
  };
  const parsed = desktopSchema.safeParse(legacy);
  assert.equal(parsed.success, true);
  if (parsed.success)
    assert.ok(parsed.data.tiles.every((t) => Array.isArray(t.config.children)));
});

test("folder children validate types, limits and safe links", () => {
  const child = createFolderChild("text", { title: "Appunto" });
  assert.equal(child.type, "text");
  assert.ok(child.id);
  const desktop = seedDesktop();
  const folder = createTile("folder", desktop.tiles);
  folder.config.children = Array.from({ length: 24 }, () =>
    createFolderChild("link"),
  );
  assert.equal(
    desktopSchema.safeParse({ ...desktop, tiles: [...desktop.tiles, folder] })
      .success,
    true,
  );
  folder.config.children.push(createFolderChild("link"));
  assert.equal(
    desktopSchema.safeParse({ ...desktop, tiles: [...desktop.tiles, folder] })
      .success,
    false,
  );
  folder.config.children = [
    createFolderChild("link", { url: "javascript:alert(1)" }),
  ];
  assert.equal(
    desktopSchema.safeParse({ ...desktop, tiles: [...desktop.tiles, folder] })
      .success,
    false,
  );
});

test("desktop IDs and external keys are globally unique across folders and archive", () => {
  const desktop = seedDesktop();
  const folder = createTile("folder", []);
  const child = createFolderChild("text");
  folder.config.children = [child];
  const active = desktop.tiles[0];
  const archived = { ...desktop.tiles.find((t) => t.type === "text")! };

  folder.config.children = [{ ...child, id: active.id }];
  assert.equal(
    desktopSchema.safeParse({ ...desktop, tiles: [...desktop.tiles, folder] })
      .success,
    false,
  );
  folder.config.children = [{ ...child, id: archived.id }];
  assert.equal(
    desktopSchema.safeParse({
      ...desktop,
      tiles: [...desktop.tiles.filter((t) => t.id !== archived.id), folder],
      archive: [archived],
    }).success,
    false,
  );

  active.externalKey = "shared-key";
  archived.externalKey = "shared-key";
  assert.equal(
    desktopSchema.safeParse({
      ...desktop,
      tiles: desktop.tiles.filter((t) => t.id !== archived.id),
      archive: [archived],
    }).success,
    false,
  );
});

test("agents manage folders and passwords change securely", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "edon-folder-"));
  const app = await buildApp({ dataDir });
  try {
    const setup = await app.inject({
      method: "POST",
      url: "/api/setup",
      payload: { password: "una-password-lunga" },
    });
    const cookie = `session=${setup.cookies[0].value}`;
    const created = await app.inject({
      method: "POST",
      url: "/api/tokens",
      headers: { cookie },
      payload: { name: "hermes" },
    });
    const agent = (method: string, url: string, payload?: object) =>
      app.inject({
        method: method as "GET",
        url,
        payload,
        headers: { authorization: `Bearer ${created.json().token}` },
      });
    const folder = await agent("POST", "/api/tiles", {
      type: "folder",
      title: "Progetto",
      config: {
        children: [
          {
            id: crypto.randomUUID(),
            type: "text",
            title: "Appunto",
            subtitle: "",
            url: "",
            appearance: {
              preset: "minimal",
              background: "#f1f1ed",
              color: "#171917",
              image: "",
              radius: 14,
              padding: 24,
              opacity: 1,
              border: "none",
              font: "sans",
              fit: "cover",
              imagePosition: "center",
              blur: false,
            },
            config: {
              body: "Da ricordare",
              icon: "↗",
              image: "",
              timezone: "",
              items: [],
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    });
    assert.equal(folder.statusCode, 201);
    assert.equal(folder.json().tile.config.children.length, 1);
    const patched = await agent(
      "PATCH",
      `/api/tiles/${folder.json().tile.id}`,
      {
        title: "Progetto alfa",
      },
    );
    assert.equal(patched.json().tile.title, "Progetto alfa");

    const wrong = await app.inject({
      method: "POST",
      url: "/api/password",
      headers: { cookie },
      payload: {
        current: "sbagliata-sbagliata",
        password: "nuova-password-lunga",
      },
    });
    assert.equal(wrong.statusCode, 401);
    const otherLogin = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { password: "una-password-lunga" },
    });
    const otherCookie = `session=${otherLogin.cookies[0].value}`;
    const changed = await app.inject({
      method: "POST",
      url: "/api/password",
      headers: { cookie },
      payload: {
        current: "una-password-lunga",
        password: "nuova-password-lunga",
      },
    });
    assert.equal(changed.statusCode, 200);
    assert.equal(
      (await app.inject({ url: "/api/desktop", headers: { cookie } }))
        .statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/desktop",
          headers: { cookie: otherCookie },
        })
      ).statusCode,
      401,
    );
    const login = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { password: "nuova-password-lunga" },
    });
    assert.equal(login.statusCode, 200);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/password",
          payload: { current: "x", password: "y" },
        })
      ).statusCode,
      401,
    );
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("a lone link in the capture bar becomes a shortcut, text stays a note", async () => {
  const { captureLink } = await import("../packages/shared/capture");
  assert.deepEqual(captureLink("  https://www.example.com/a?b=1 \n"), {
    kind: "link",
    title: "example.com",
    url: "https://www.example.com/a?b=1",
    icon: "E",
  });
  assert.equal(captureLink("obsidian://open?vault=x")?.title, "Obsidian");
  assert.equal(captureLink("leggi https://example.com"), null);
  assert.equal(captureLink("https://example.com\nsecondo"), null);
  assert.equal(captureLink("javascript:alert(1)"), null);
});

test("tiles move into a folder and back to the desktop", async () => {
  const { tileToFolderChild, folderChildToTile } =
    await import("../packages/shared/model");
  const desktop = seedDesktop();
  const note = desktop.tiles.find((t) => t.type === "text")!;
  const child = tileToFolderChild(note)!;
  assert.equal(child.id, note.id);
  assert.equal(child.title, note.title);
  assert.equal(tileToFolderChild(createTile("folder", desktop.tiles)), null);
  const others = desktop.tiles.filter((t) => t.id !== note.id);
  const back = folderChildToTile(child, others, desktop.settings)!;
  assert.equal(back.type, "text");
  assert.deepEqual(back.config.children, []);
  assert.equal(
    desktopSchema.safeParse({ ...desktop, tiles: [...others, back] }).success,
    true,
  );
  assert.equal(
    folderChildToTile(child, desktop.tiles, { columns: 1, rows: 1 }),
    null,
  );
});
