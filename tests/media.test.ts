import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createTile,
  desktopSchema,
  isPdf,
  safeFile,
  tileSchema,
} from "../packages/shared/model";
import { seedDesktop } from "../packages/shared/seed";
import { buildApp } from "../apps/server/src/app";

const multipart = (name: string, body: Buffer) => ({
  headers: { "content-type": "multipart/form-data; boundary=edon" },
  payload: Buffer.concat([
    Buffer.from(
      `--edon\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ),
    body,
    Buffer.from("\r\n--edon--\r\n"),
  ]),
});

async function login(app: Awaited<ReturnType<typeof buildApp>>) {
  const setup = await app.inject({
    method: "POST",
    url: "/api/setup",
    payload: { password: "una-password-lunga" },
  });
  return { session: setup.cookies[0].value };
}

test("weather, timer and file tiles are valid, sized and legacy-safe", () => {
  const desktop = seedDesktop();
  for (const type of ["weather", "progress", "file"] as const) {
    const tile = createTile(type, desktop.tiles);
    assert.equal(tileSchema.safeParse(tile).success, true, type);
    assert.deepEqual([tile.w, tile.h], type === "file" ? [2, 2] : [2, 1]);
  }
  assert.throws(() => createTile("weather", [], { w: 3, h: 1 }), /Dimensione/);
  const legacy = JSON.parse(JSON.stringify(desktop.tiles[0]));
  for (const key of ["location", "file", "startsAt", "endsAt"])
    delete legacy.config[key];
  const parsed = tileSchema.parse(legacy);
  assert.equal(parsed.config.location, "");
  assert.equal(
    tileSchema.safeParse({
      ...parsed,
      config: { ...parsed.config, endsAt: "domani" },
    }).success,
    false,
  );
  assert.equal(
    tileSchema.safeParse({
      ...parsed,
      config: { ...parsed.config, file: "https://example.com/a.pdf" },
    }).success,
    false,
  );
  assert.equal(
    safeFile("/uploads/6edce8c4-57bc-495c-9f5b-b87c364d53e2.pdf"),
    true,
  );
  assert.equal(isPdf("/uploads/x.PDF"), true);
  for (const wallpaper of ["ascii", "noise"])
    assert.equal(
      desktopSchema.safeParse({
        ...desktop,
        settings: { ...desktop.settings, wallpaper },
      }).success,
      true,
    );
});

test("any file can be uploaded; PDFs and images are detected by content and the rest is download-only", async () => {
  const app = await buildApp({
    dataDir: await mkdtemp(join(tmpdir(), "edon-files-")),
  });
  try {
    const cookies = await login(app);
    const send = (name: string, body: Buffer) =>
      app.inject({
        method: "POST",
        url: "/api/files",
        cookies,
        ...multipart(name, body),
      });
    const pdf = await send("Relazione.pdf", Buffer.from("%PDF-1.4\n%%EOF"));
    assert.equal(pdf.statusCode, 200);
    assert.equal(pdf.json().kind, "pdf");
    assert.equal(pdf.json().name, "Relazione.pdf");
    assert.match(pdf.json().url, /\.pdf$/);
    const served = await app.inject({ url: pdf.json().url, cookies });
    assert.equal(served.headers["content-type"], "application/pdf");
    assert.equal(served.headers["x-frame-options"], "SAMEORIGIN");
    assert.equal((await app.inject({ url: pdf.json().url })).statusCode, 401);
    // A text file pretending to be a PDF or image is never served as one.
    const fake = await send(
      "evil.pdf",
      Buffer.from("<script>alert(1)</script>"),
    );
    assert.equal(fake.json().kind, "file");
    assert.match(fake.json().url, /\.bin$/);
    const html = await send(
      "page.html",
      Buffer.from("<script>alert(1)</script>"),
    );
    assert.equal(html.json().kind, "file");
    const download = await app.inject({ url: html.json().url, cookies });
    assert.equal(download.headers["content-type"], "application/octet-stream");
    assert.match(String(download.headers["content-disposition"]), /attachment/);
    assert.equal(download.headers["content-security-policy"], "sandbox");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      "base64",
    );
    assert.equal((await send("foto.png", png)).json().kind, "image");
    assert.equal((await send("vuoto.txt", Buffer.alloc(0))).statusCode, 400);
    assert.equal(
      (await app.inject({ url: "/uploads/..%2fdesktop.sqlite", cookies }))
        .statusCode,
      404,
    );
  } finally {
    await app.close();
  }
});

test("weather comes from Open-Meteo through the server and is cached", async () => {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(String(url));
    const body = String(url).includes("geocoding")
      ? String(url).includes("nowhere")
        ? {}
        : { results: [{ name: "Firenze", latitude: 43.77, longitude: 11.25 }] }
      : {
          current: {
            temperature_2m: 21.6,
            weather_code: 2,
            is_day: 1,
            wind_speed_10m: 7.2,
          },
          daily: { temperature_2m_max: [24.4], temperature_2m_min: [12.1] },
        };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  const app = await buildApp({
    dataDir: await mkdtemp(join(tmpdir(), "edon-weather-")),
    fetch: fetcher,
  });
  try {
    const cookies = await login(app);
    assert.equal(
      (await app.inject({ url: "/api/weather?q=Firenze" })).statusCode,
      401,
    );
    const first = await app.inject({ url: "/api/weather?q=Firenze", cookies });
    assert.equal(first.statusCode, 200);
    const { updatedAt, ...weather } = first.json();
    assert.ok(Date.parse(updatedAt));
    assert.deepEqual(weather, {
      location: "Firenze",
      temperature: 22,
      code: 2,
      isDay: true,
      wind: 7,
      min: 12,
      max: 24,
    });
    await app.inject({ url: "/api/weather?q=firenze", cookies });
    assert.equal(calls.length, 2, "second request is served from the cache");
    const missing = await app.inject({
      url: "/api/weather?q=Nowhere",
      cookies,
    });
    assert.equal(missing.statusCode, 404);
    assert.match(missing.json().error, /Nowhere/);
    assert.equal(
      (await app.inject({ url: "/api/weather?q=", cookies })).statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});

test("an unreachable weather service gives a clear error", async () => {
  const app = await buildApp({
    dataDir: await mkdtemp(join(tmpdir(), "edon-weather-")),
    fetch: (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch,
  });
  try {
    const cookies = await login(app);
    const response = await app.inject({ url: "/api/weather?q=Roma", cookies });
    assert.equal(response.statusCode, 502);
    assert.match(response.json().error, /meteo/i);
  } finally {
    await app.close();
  }
});

test("timers pause, resume and restart without losing their length", async () => {
  const { isTimer, pauseTimer, resumeTimer, restartTimer, timerSpan } =
    await import("../packages/shared/timer");
  const t0 = Date.parse("2026-01-01T10:00:00Z");
  const config = {
    startsAt: new Date(t0).toISOString(),
    endsAt: new Date(t0 + 25 * 60_000).toISOString(),
    pausedAt: "",
  };
  const created = new Date(t0).toISOString();
  assert.equal(isTimer(config, created), true);
  assert.equal(
    isTimer(
      { ...config, endsAt: new Date(t0 + 3 * 86400_000).toISOString() },
      created,
    ),
    false,
  );
  const paused = { ...config, ...pauseTimer(t0 + 10 * 60_000) };
  const resumed = resumeTimer(paused, created, t0 + 40 * 60_000);
  assert.equal(resumed.pausedAt, "");
  const span = timerSpan(resumed, created);
  assert.equal(span.end - span.start, 25 * 60_000);
  assert.equal(
    span.start,
    t0 + 30 * 60_000,
    "the 30 minute pause is not counted",
  );
  const again = restartTimer(resumed, created, t0 + 99 * 60_000);
  assert.equal(
    Date.parse(again.endsAt) - Date.parse(again.startsAt),
    25 * 60_000,
  );
  assert.equal(Date.parse(again.startsAt), t0 + 99 * 60_000);
  // a tile without an explicit start counts from its creation
  const unset = timerSpan({ ...config, startsAt: "" }, created);
  assert.equal(unset.start, t0);
});

test("text colour follows the background: white on dark, black on light", async () => {
  const { readableInk } = await import("../packages/shared/model");
  assert.equal(readableInk("#ffffff"), "#111111");
  assert.equal(readableInk("#d7d8d5"), "#111111");
  assert.equal(readableInk("#d6ef53"), "#111111");
  assert.equal(readableInk("#202622"), "#ffffff");
  assert.equal(readableInk("#000000"), "#ffffff");
  assert.equal(readableInk("#1c3d8f"), "#ffffff");
});

test("agents changing a tile background get a readable text colour", async () => {
  const app = await buildApp({
    dataDir: await mkdtemp(join(tmpdir(), "edon-ink-")),
  });
  try {
    const cookies = await login(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/tiles",
      cookies,
      payload: {
        type: "text",
        title: "Notte",
        appearance: { background: "#101418" },
      },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().tile.appearance.color, "#ffffff");
    const light = await app.inject({
      method: "PATCH",
      url: `/api/tiles/${created.json().tile.id}`,
      cookies,
      payload: { appearance: { background: "#f3f3ed" } },
    });
    assert.equal(light.json().tile.appearance.color, "#111111");
  } finally {
    await app.close();
  }
});
