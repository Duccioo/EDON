import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../apps/server/src/app";

async function setup(agentToken?: string) {
  const app = await buildApp({
    dataDir: await mkdtemp(join(tmpdir(), "edon-agent-")),
    agentToken,
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/setup",
    payload: { password: "una-password-lunga" },
  });
  const cookie = `session=${login.cookies[0].value}`;
  const created = await app.inject({
    method: "POST",
    url: "/api/tokens",
    headers: { cookie },
    payload: { name: "hermes", expiresInDays: 7 },
  });
  const { token } = created.json();
  const agent = (method: string, url: string, payload?: object) =>
    app.inject({
      method: method as "GET",
      url,
      payload,
      headers: { authorization: `Bearer ${token}` },
    });
  return { app, cookie, token, agent };
}

test("agent tokens: required, scoped to the agent API, revocable", async () => {
  const { app, cookie, token, agent } = await setup();
  try {
    assert.equal((await app.inject({ url: "/api/tiles" })).statusCode, 401);
    assert.equal(
      (
        await app.inject({
          url: "/api/tiles",
          headers: { authorization: "Bearer edon_nope" },
        })
      ).statusCode,
      401,
    );
    assert.equal((await agent("GET", "/api/tiles")).statusCode, 200);
    for (const url of ["/api/desktop", "/api/tokens"])
      assert.equal((await agent("GET", url)).statusCode, 401);
    const list = (
      await app.inject({ url: "/api/tokens", headers: { cookie } })
    ).json().tokens;
    assert.equal(list.length, 1);
    assert.ok(!JSON.stringify(list).includes(token));
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/tokens/${list[0].id}`,
          headers: { cookie },
        })
      ).statusCode,
      200,
    );
    assert.equal((await agent("GET", "/api/tiles")).statusCode, 401);
  } finally {
    await app.close();
  }
});

test("static agent token from the environment", async () => {
  const { app } = await setup("segreto-di-docker");
  try {
    const ok = await app.inject({
      url: "/api/tile-types",
      headers: { authorization: "Bearer segreto-di-docker" },
    });
    assert.equal(ok.statusCode, 200);
    assert.ok(ok.json().types.length >= 5);
  } finally {
    await app.close();
  }
});

test("agents create, upsert by key, place and delete tiles without touching the user's", async () => {
  const { app, cookie, agent } = await setup();
  try {
    const before = (await agent("GET", "/api/tiles")).json().tiles;
    const created = await agent("POST", "/api/tiles", {
      type: "data",
      title: "Meteo",
      config: { body: "21°, sereno" },
      appearance: { preset: "industrial", color: "#ffcc00" },
      w: 2,
    });
    assert.equal(created.statusCode, 201);
    const tile = created.json().tile;
    assert.equal(tile.origin, "agent");
    assert.equal(tile.appearance.background, "#191b1b");
    assert.equal(tile.appearance.color, "#ffcc00");
    assert.equal(tile.w, 2);

    const first = await agent("PUT", "/api/tiles/by-key/daily-news", {
      type: "data",
      title: "Notizie",
      config: { body: "uno" },
    });
    const second = await agent("PUT", "/api/tiles/by-key/daily-news", {
      config: { body: "due" },
    });
    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 200);
    assert.equal(first.json().tile.id, second.json().tile.id);
    assert.equal(second.json().tile.config.body, "due");
    assert.equal(second.json().tile.title, "Notizie");
    assert.equal(
      (await agent("PUT", "/api/tiles/by-key/daily-news", { type: "link" }))
        .statusCode,
      409,
    );

    const all = (await agent("GET", "/api/tiles")).json().tiles;
    assert.equal(all.length, before.length + 2);
    for (const old of before)
      assert.deepEqual(
        all.find((t: { id: string }) => t.id === old.id),
        old,
      );

    // Validation and error shape
    const bad = await agent("POST", "/api/tiles", {
      type: "link",
      url: "javascript:alert(1)",
    });
    assert.equal(bad.statusCode, 400);
    assert.ok(bad.json().error);
    assert.equal(
      (await agent("POST", "/api/tiles", { type: "nope" })).statusCode,
      400,
    );
    assert.equal(
      (await agent("POST", "/api/tiles", { type: "text", x: 3 })).statusCode,
      400,
    );

    // Patch, layout, delete
    const patched = await agent("PATCH", `/api/tiles/${tile.id}`, {
      title: "Meteo Firenze",
    });
    assert.equal(patched.json().tile.title, "Meteo Firenze");
    const layout = (await agent("GET", "/api/layout")).json();
    assert.equal(layout.columns, 6);
    assert.equal(
      (
        await agent("PUT", "/api/layout", {
          tiles: [{ id: before[0].id, x: 0, y: 40 }],
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await agent("PUT", "/api/layout", {
          tiles: [{ id: tile.id, x: before[0].x, y: before[0].y }],
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await agent("DELETE", `/api/tiles/${before[0].id}`)).statusCode,
      403,
    );
    assert.equal(
      (await agent("DELETE", `/api/tiles/${tile.id}`)).statusCode,
      200,
    );
    assert.equal((await agent("GET", `/api/tiles/${tile.id}`)).statusCode, 404);

    // The browser sees agent changes with a newer revision
    const desktop = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json();
    assert.ok(desktop.revision > 0);
  } finally {
    await app.close();
  }
});

test("expired agent tiles disappear", async () => {
  const { app, agent } = await setup();
  try {
    await agent("PUT", "/api/tiles/by-key/riunione", {
      type: "data",
      title: "Riunione",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const keys = (await agent("GET", "/api/tiles"))
      .json()
      .tiles.map((t: { externalKey: string }) => t.externalKey);
    assert.ok(!keys.includes("riunione"));
    const future = await agent("PUT", "/api/tiles/by-key/riunione", {
      type: "data",
      title: "Riunione",
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    assert.equal(future.statusCode, 201);
  } finally {
    await app.close();
  }
});

test("the configured tile limit applies to agent creation, upserts and full desktop writes", async () => {
  const { app, cookie, agent } = await setup();
  try {
    const desktop = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json();
    desktop.settings.maxTiles = desktop.tiles.length;
    const saved = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: desktop,
    });
    assert.equal(saved.statusCode, 200);
    const full = saved.json();
    assert.equal(
      (
        await agent("POST", "/api/tiles", {
          type: "text",
          title: "Over capacity",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await agent("PUT", "/api/tiles/by-key/over-capacity", {
          type: "text",
          title: "Over capacity",
        })
      ).statusCode,
      409,
    );
    const after = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json();
    assert.deepEqual(after, full);
    const tooLow = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: {
        ...after,
        settings: { ...after.settings, maxTiles: after.tiles.length - 1 },
      },
    });
    assert.equal(tooLow.statusCode, 400);
    const increase = await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: {
        ...after,
        settings: { ...after.settings, maxTiles: after.tiles.length + 1 },
      },
    });
    assert.equal(increase.statusCode, 200);
    assert.equal(
      (await agent("POST", "/api/tiles", { type: "text", title: "Room again" }))
        .statusCode,
      201,
    );
  } finally {
    await app.close();
  }
});

test("agents respect configurable columns and rows for creation, movement and resizing", async () => {
  const { app, cookie, agent } = await setup();
  try {
    const current = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json();
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/desktop",
          headers: { cookie },
          payload: {
            ...current,
            settings: { ...current.settings, columns: 8, rows: 4 },
          },
        })
      ).statusCode,
      200,
    );
    const created = await agent("POST", "/api/tiles", {
      type: "link",
      title: "Extra column",
    });
    assert.equal(created.statusCode, 201);
    const tile = created.json().tile;
    assert.equal(tile.x, 6);
    const layout = (await agent("GET", "/api/layout")).json();
    assert.equal(layout.columns, 8);
    assert.equal(layout.rows, 4);
    assert.equal(
      (
        await agent("PUT", "/api/layout", {
          tiles: [{ id: tile.id, x: 7, y: 3 }],
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await agent("PUT", "/api/layout", {
          tiles: [{ id: tile.id, x: 8, y: 3 }],
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await agent("PUT", "/api/layout", {
          tiles: [{ id: tile.id, x: 7, y: 4 }],
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await agent("PATCH", `/api/tiles/${tile.id}`, { w: 2 })).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("agents can create 3x3 notes but cannot exceed another type's size limit", async () => {
  const { app, cookie, agent } = await setup();
  try {
    const current = (
      await app.inject({ url: "/api/desktop", headers: { cookie } })
    ).json();
    await app.inject({
      method: "PUT",
      url: "/api/desktop",
      headers: { cookie },
      payload: { ...current, settings: { ...current.settings, rows: 10 } },
    });
    const note = await agent("POST", "/api/tiles", {
      type: "text",
      title: "Large note",
      w: 3,
      h: 3,
    });
    assert.equal(note.statusCode, 201);
    assert.equal(note.json().tile.w, 3);
    assert.equal(note.json().tile.h, 3);
    assert.equal(
      (await agent("POST", "/api/tiles", { type: "image", w: 3, h: 3 }))
        .statusCode,
      400,
    );
    const link = await agent("POST", "/api/tiles", { type: "link" });
    assert.equal(
      (await agent("PATCH", `/api/tiles/${link.json().tile.id}`, { w: 3 }))
        .statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});
