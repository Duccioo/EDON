import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, loadConfigFromFile } from "vite";
import { buildApp } from "../apps/server/src/app";

test("development proxy preserves the browser origin for setup, login and writes", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "edon-dev-proxy-"));
  const app = await buildApp({ dataDir });
  const backend = await app.listen({ host: "127.0.0.1", port: 0 });
  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "development" },
    "apps/web/vite.config.ts",
  );
  assert.ok(loaded);
  const proxy = loaded.config.server!.proxy!["/api"];
  const vite = await createServer({
    ...loaded.config,
    configFile: false,
    server: {
      ...loaded.config.server,
      port: 0,
      proxy: {
        "/api":
          typeof proxy === "string" ? backend : { ...proxy, target: backend },
      },
      watch: null,
    },
  });
  try {
    await vite.listen();
    const address = vite.httpServer!.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const payload = JSON.stringify({ password: "edon-test-password" });
    for (const path of ["/api/setup", "/api/login"]) {
      const response = await fetch(`${origin}${path}`, {
        method: "POST",
        headers: {
          origin,
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
        },
        body: payload,
      });
      assert.equal(response.status, 200, `${path}: ${await response.text()}`);
      const cookie = response.headers.get("set-cookie")!.split(";")[0];
      const logout = await fetch(`${origin}/api/logout`, {
        method: "POST",
        headers: { origin, cookie, "sec-fetch-site": "same-origin" },
      });
      assert.equal(logout.status, 200);
    }
    const rejected = await fetch(`${origin}/api/login`, {
      method: "POST",
      headers: {
        origin: "https://other.example",
        "content-type": "application/json",
      },
      body: payload,
    });
    assert.equal(rejected.status, 403);
  } finally {
    await vite.close();
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
