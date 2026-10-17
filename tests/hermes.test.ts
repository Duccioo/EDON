import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../apps/server/src/app";

test("asking the agent calls Hermes server-side and never exposes the key", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/health")) return Response.json({ status: "ok" });
    if (
      init.headers &&
      (init.headers as Record<string, string>).Authorization !==
        "Bearer chiave-hermes"
    )
      return new Response("no", { status: 401 });
    return Response.json({
      choices: [{ message: { content: " Ho aggiunto il meteo. " } }],
    });
  }) as unknown as typeof fetch;
  const app = await buildApp({
    dataDir: await mkdtemp(join(tmpdir(), "edon-hermes-")),
    fetch: fakeFetch,
  });
  try {
    const login = await app.inject({
      method: "POST",
      url: "/api/setup",
      payload: { password: "una-password-lunga" },
    });
    const headers = { cookie: `session=${login.cookies[0].value}` };
    const post = (url: string, payload?: object) =>
      app.inject({ method: "POST", url, payload, headers });

    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/agent/ask",
          payload: { prompt: "x" },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (await post("/api/agent/ask", { prompt: "ciao" })).statusCode,
      409,
    );

    const saved = await app.inject({
      method: "PUT",
      url: "/api/agent",
      headers,
      payload: {
        url: "http://hermes.lan:8642/",
        model: "hermes-agent",
        apiKey: "chiave-hermes",
      },
    });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.json().hasKey, true);
    assert.equal(saved.json().url, "http://hermes.lan:8642");
    assert.ok(!saved.body.includes("chiave-hermes"));
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/agent",
          headers,
          payload: { url: "file:///etc/passwd", model: "" },
        })
      ).statusCode,
      400,
    );
    // Saving without apiKey keeps the existing one.
    await app.inject({
      method: "PUT",
      url: "/api/agent",
      headers,
      payload: { url: "http://hermes.lan:8642", model: "hermes-agent" },
    });

    assert.equal((await post("/api/agent/test")).statusCode, 200);
    const asked = await post("/api/agent/ask", {
      prompt: "metti il meteo di Firenze",
    });
    assert.equal(asked.statusCode, 200);
    assert.equal(asked.json().reply, "Ho aggiunto il meteo.");
    const last = calls.at(-1)!;
    assert.equal(last.url, "http://hermes.lan:8642/v1/chat/completions");
    const body = JSON.parse(String(last.init.body));
    assert.equal(body.model, "hermes-agent");
    assert.equal(body.messages[1].content, "metti il meteo di Firenze");
    assert.match(body.messages[0].content, /upsert_tile/);
    assert.equal(
      (await app.inject({ url: "/api/agent", headers })).json().hasKey,
      true,
    );
  } finally {
    await app.close();
  }
});

test("environment settings override the saved ones and unreachable agents give a clear error", async () => {
  const app = await buildApp({
    dataDir: await mkdtemp(join(tmpdir(), "edon-hermes-")),
    agent: { url: "http://giu.invalid:1", apiKey: "k" },
    fetch: (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch,
  });
  try {
    const login = await app.inject({
      method: "POST",
      url: "/api/setup",
      payload: { password: "una-password-lunga" },
    });
    const headers = { cookie: `session=${login.cookies[0].value}` };
    const status = (await app.inject({ url: "/api/agent", headers })).json();
    assert.equal(status.configured, true);
    assert.equal(status.managedByEnvironment.url, true);
    const r = await app.inject({
      method: "POST",
      url: "/api/agent/ask",
      headers,
      payload: { prompt: "ciao" },
    });
    assert.equal(r.statusCode, 502);
    assert.match(r.json().error, /raggiungere/);
  } finally {
    await app.close();
  }
});
