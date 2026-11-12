import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import { statfsSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import { resolve } from "node:path";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { desktopSchema } from "../../../packages/shared/model";
import { Store } from "./store";
import {
  TileError,
  TileService,
  createInput,
  layoutInput,
  patchInput,
  upsertInput,
} from "./tiles";
import { registerMcp } from "./mcp";
import { WeatherError, WeatherService } from "./weather";
import { AgentClient, agentSettingsInput, type AgentEnv } from "./agent";
import { VaultService, vaultSettingsInput, type VaultEnv } from "./vault";

function sampleCpuTimes() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle;
    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.irq +
      cpu.times.idle;
  }
  return { idle, total };
}

let lastCpuSample = sampleCpuTimes();

function readPerformance(dataDir: string) {
  const current = sampleCpuTimes();
  const idleDelta = current.idle - lastCpuSample.idle;
  const totalDelta = current.total - lastCpuSample.total;
  lastCpuSample = current;
  const cores = Math.max(1, os.cpus().length);
  const loadAvg = os.loadavg();
  const cpuPercent =
    totalDelta > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)),
        )
      : Math.max(0, Math.min(100, Math.round((loadAvg[0] / cores) * 100)));
  const memTotalBytes = os.totalmem();
  const memFreeBytes = os.freemem();
  const memUsedBytes = Math.max(0, memTotalBytes - memFreeBytes);
  const memPercent =
    memTotalBytes > 0 ? Math.round((memUsedBytes / memTotalBytes) * 100) : 0;

  let diskTotalBytes = 0;
  let diskUsedBytes = 0;
  let diskPercent = 0;
  try {
    const stat = statfsSync(dataDir);
    diskTotalBytes = stat.blocks * stat.bsize;
    const availBytes = stat.bavail * stat.bsize;
    diskUsedBytes = Math.max(0, diskTotalBytes - availBytes);
    diskPercent =
      diskTotalBytes > 0
        ? Math.round((diskUsedBytes / diskTotalBytes) * 100)
        : 0;
  } catch {
    /* ignore statfs errors on unsupported filesystems */
  }

  return {
    cpuPercent,
    cores,
    memUsedBytes,
    memTotalBytes,
    memPercent,
    diskUsedBytes,
    diskTotalBytes,
    diskPercent,
    loadAvg: loadAvg.map((v) => Number(v.toFixed(2))) as [
      number,
      number,
      number,
    ],
    uptimeSeconds: Math.floor(os.uptime()),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
  };
}

const agentPath = (pathname: string, method: string) => {
  if (pathname === "/mcp") return method === "POST";
  if (/^\/api\/(tiles|tile-types|layout)(\/|$)/.test(pathname)) return true;
  return method === "GET" && /^\/api\/vault\/(notes|note)(\?|$)/.test(pathname);
};
const bearer = (header: string | undefined) =>
  /^Bearer (\S+)$/i.exec(header ?? "")?.[1];

const passwordSchema = z.object({
  password: z.string().min(10, "Usa almeno 10 caratteri.").max(200),
});
function imageType(data: Buffer): "png" | "jpg" | "gif" | "webp" | undefined {
  if (
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return "jpg";
  if (["GIF87a", "GIF89a"].includes(data.toString("ascii", 0, 6))) return "gif";
  if (
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
}
const pdfMagic = (data: Buffer) => data.toString("latin1", 0, 5) === "%PDF-";
/** Any upload keeps a short lowercase extension; image and PDF names are decided by content, never by the client. */
function fileExtension(name: string, data: Buffer) {
  const sniffed = imageType(data) ?? (pdfMagic(data) ? "pdf" : undefined);
  if (sniffed) return sniffed;
  const ext = /\.([a-z0-9]{1,8})$/i.exec(name)?.[1].toLowerCase() ?? "bin";
  return ["png", "jpg", "jpeg", "gif", "webp", "pdf"].includes(ext)
    ? "bin"
    : ext;
}
const mimeTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};
export async function buildApp(options: {
  dataDir: string;
  webDir?: string;
  secureCookie?: boolean;
  logger?: boolean;
  /** Optional static agent token (e.g. from the Docker environment). */
  agentToken?: string;
  /** Hermes connection from the environment; overrides the saved settings. */
  agent?: AgentEnv;
  /** Obsidian vault settings from the environment; overrides the saved settings. */
  vault?: VaultEnv;
  fetch?: typeof fetch;
}) {
  await mkdir(resolve(options.dataDir, "uploads"), { recursive: true });
  const store = new Store(resolve(options.dataDir, "desktop.sqlite"));
  const vault = new VaultService(store, options.vault ?? {});
  const tiles = new TileService(store, vault);
  const weather = new WeatherService(options.fetch ?? fetch);
  const agent = new AgentClient(
    store,
    options.agent ?? {},
    options.fetch ?? fetch,
  );
  const staticToken = options.agentToken
    ? createHash("sha256").update(options.agentToken).digest()
    : undefined;
  const agentAuthorized = (header: string | undefined) => {
    const token = bearer(header);
    if (!token) return false;
    if (
      staticToken &&
      timingSafeEqual(createHash("sha256").update(token).digest(), staticToken)
    )
      return true;
    return store.tokenValid(token);
  };
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 20 * 1024 * 1024,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
  });
  app.addHook("onClose", async () => store.close());
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("X-Frame-Options", "DENY");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' https: data:; media-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    // Only our own pages may frame an uploaded PDF (the expanded file view).
    if (/^\/uploads\/[\w-]+\.pdf(\?|$)/.test(req.url))
      reply
        .header("X-Frame-Options", "SAMEORIGIN")
        .header(
          "Content-Security-Policy",
          "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
        );
    if (req.url.startsWith("/api") || req.url.startsWith("/uploads"))
      reply.header("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      if (
        (origin && new URL(origin).host !== req.headers.host) ||
        req.headers["sec-fetch-site"] === "cross-site"
      )
        return reply
          .code(403)
          .send({ error: "Richiesta da un’origine non consentita." });
    }
    const pathname = req.routeOptions.url ?? req.url.split("?")[0];
    const publicPaths = ["/api/auth", "/api/login", "/api/setup"];
    if (
      ((pathname.startsWith("/api/") && !publicPaths.includes(pathname)) ||
        pathname.startsWith("/uploads/") ||
        pathname === "/mcp") &&
      !store.authenticated(req.cookies.session) &&
      !(
        agentPath(pathname, req.method) &&
        agentAuthorized(req.headers.authorization)
      )
    )
      return reply.code(401).send({ error: "Accedi per continuare." });
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof TileError || error instanceof WeatherError)
      return reply.code(error.status).send({ error: error.message });
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({ error: error.issues.map((x) => x.message).join(" ") });
    if (error instanceof Error && error.message === "CONFLICT")
      return reply.code(409).send({
        error:
          "Il desktop è cambiato in un’altra finestra. Ricarica la pagina prima di modificarlo.",
      });
    const status =
      typeof error === "object" &&
      error &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    if (status >= 500) req.log.error(error);
    return reply.code(status).send({
      error:
        status === 413
          ? typeof error === "object" &&
            error &&
            "code" in error &&
            error.code === "FST_REQ_FILE_TOO_LARGE"
            ? "File troppo grande. Il limite è 10 MB."
            : "Richiesta JSON troppo grande. Il limite è 20 MB."
          : status >= 500
            ? "Salvataggio non riuscito. Riprova."
            : error instanceof Error
              ? error.message
              : "Richiesta non valida.",
    });
  });
  app.get("/api/auth", async (req) => ({
    configured: store.configured(),
    authenticated: store.authenticated(req.cookies.session),
  }));
  for (const path of ["/api/setup", "/api/login"])
    app.post(
      path,
      { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
      async (req, reply) => {
        const { password } = passwordSchema.parse(req.body);
        if (path === "/api/setup") {
          if (store.configured())
            return reply
              .code(409)
              .send({ error: "Password già configurata. Accedi." });
          store.setup(password);
        } else if (!store.login(password))
          return reply.code(401).send({ error: "Password non corretta." });
        reply.setCookie("session", store.session(), {
          path: "/",
          httpOnly: true,
          sameSite: "strict",
          secure: options.secureCookie ?? false,
          maxAge: 7 * 86400,
        });
        return { ok: true };
      },
    );
  app.post("/api/logout", async (req, reply) => {
    if (req.cookies.session) store.logout(req.cookies.session);
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
  app.post(
    "/api/password",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { current, password } = z
        .object({
          current: z.string().max(200),
          password: passwordSchema.shape.password,
        })
        .parse(req.body);
      if (!store.login(current))
        return reply
          .code(401)
          .send({ error: "La password attuale non è corretta." });
      store.changePassword(password, req.cookies.session);
      return { ok: true };
    },
  );
  app.get("/api/desktop", async () => tiles.snapshot());
  app.put("/api/desktop", async (req) => {
    const revision = z
      .object({ revision: z.number().int().min(0) })
      .parse(req.body).revision;
    return tiles.saveDesktop(desktopSchema.parse(req.body), revision);
  });
  app.get("/api/tokens", async () => ({ tokens: store.listTokens() }));
  app.post("/api/tokens", async (req) => {
    const { name, expiresInDays } = z
      .object({
        name: z.string().trim().min(1, "Dai un nome al token.").max(60),
        expiresInDays: z.number().int().min(1).max(3650).optional(),
      })
      .parse(req.body);
    return store.createToken(name, expiresInDays);
  });
  app.delete<{ Params: { id: string } }>(
    "/api/tokens/:id",
    async (req, reply) => {
      if (!store.revokeToken(req.params.id))
        return reply.code(404).send({ error: "Token non trovato." });
      return { ok: true };
    },
  );
  // Agent API: also reachable with `Authorization: Bearer <token>`.
  app.get("/api/tiles", async () => ({ tiles: tiles.list() }));
  app.post("/api/tiles", async (req, reply) =>
    reply.code(201).send({ tile: tiles.create(createInput.parse(req.body)) }),
  );
  app.get<{ Params: { id: string } }>("/api/tiles/:id", async (req) => ({
    tile: tiles.get(req.params.id),
  }));
  app.patch<{ Params: { id: string } }>("/api/tiles/:id", async (req) => ({
    tile: tiles.update(req.params.id, patchInput.parse(req.body)),
  }));
  app.delete<{ Params: { id: string } }>("/api/tiles/:id", async (req) => {
    tiles.remove(req.params.id);
    return { ok: true };
  });
  app.put<{ Params: { key: string } }>(
    "/api/tiles/by-key/:key",
    async (req, reply) => {
      const { tile, created } = tiles.upsert(
        req.params.key,
        upsertInput.parse(req.body),
      );
      return reply.code(created ? 201 : 200).send({ tile, created });
    },
  );
  app.get("/api/tile-types", async () => ({ types: tiles.types() }));
  app.get("/api/layout", async () => tiles.layout());
  app.put("/api/layout", async (req) =>
    tiles.setLayout(layoutInput.parse(req.body)),
  );
  app.get("/api/performance", async () => readPerformance(options.dataDir));
  app.get("/api/ai-limits", async () => {
    const status = agent.status();
    const list = tiles.list();
    return {
      agentConfigured: status.configured,
      model: status.model || "Hermes",
      agentTilesCount: list.filter((t) => t.origin === "agent").length,
      activeTokensCount: store.listTokens().length,
    };
  });
  app.get("/api/agent", async () => agent.status());
  app.put("/api/agent", async (req) =>
    agent.save(agentSettingsInput.parse(req.body)),
  );
  app.post("/api/agent/test", async () => agent.test());
  app.post(
    "/api/agent/ask",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req) =>
      agent.ask(
        z
          .object({
            prompt: z
              .string()
              .trim()
              .min(1, "Scrivi cosa vuoi chiedere.")
              .max(2000),
          })
          .parse(req.body).prompt,
      ),
  );
  app.get("/api/vault", async () => vault.status());
  app.put("/api/vault", async (req) =>
    vault.save(vaultSettingsInput.parse(req.body)),
  );
  app.get("/api/vault/notes", async (req) => {
    const query = z
      .object({
        q: z.string().max(120).optional(),
        folder: z.string().max(240).optional(),
      })
      .parse(req.query ?? {});
    return vault.listNotes({ query: query.q, folder: query.folder });
  });
  app.get("/api/vault/note", async (req) => {
    const { path } = z
      .object({ path: z.string().min(1).max(240) })
      .parse(req.query ?? {});
    return vault.readNote(path);
  });
  app.put("/api/vault/note", async (req) => {
    const body = z
      .object({
        path: z.string().max(240).optional(),
        version: z
          .string()
          .regex(/^[\da-f]{64}$/)
          .optional(),
        folder: z.string().max(120).optional(),
        title: z.string().trim().min(1).max(120),
        body: z.string().max(10000).default(""),
        items: z
          .array(
            z.object({
              id: z.string().max(100),
              text: z.string().max(300),
              done: z.boolean(),
            }),
          )
          .max(30)
          .optional(),
      })
      .parse(req.body);
    const note = vault.writeNote(body);
    // Sync any linked desktop tile with the updated file on disk
    tiles.snapshot();
    return note;
  });
  app.delete("/api/vault/note", async (req) => {
    const { path, version } = z
      .object({
        path: z.string().min(1).max(240),
        version: z.string().regex(/^[\da-f]{64}$/),
      })
      .parse(req.query ?? {});
    const detail = vault.readNote(path);
    const res = vault.trashNote(detail.path, version);
    store.mutate((d) => {
      d.tiles = d.tiles.filter((t) => t.config.vaultPath !== detail.path);
      for (const t of d.tiles) {
        if (t.type === "folder" && t.config.children) {
          t.config.children = t.config.children.filter(
            (c) => c.config.vaultPath !== detail.path,
          );
        }
      }
      d.archive = d.archive.filter((t) => t.config.vaultPath !== detail.path);
    });
    return { ok: true, ...res };
  });
  registerMcp(app, tiles, vault);
  app.post("/api/uploads", async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Scegli un’immagine." });
    const data = await file.toBuffer();
    const extension = imageType(data);
    if (!extension)
      return reply
        .code(400)
        .send({ error: "Sono supportati PNG, JPEG, GIF e WebP." });
    const name = `${randomUUID()}.${extension}`;
    await writeFile(resolve(options.dataDir, "uploads", name), data, {
      flag: "wx",
    });
    return { url: `/uploads/${name}` };
  });
  // Any file the user drops on the desktop: images and PDFs get a preview, the rest a download tile.
  app.post("/api/files", async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Scegli un file." });
    const data = await file.toBuffer();
    if (!data.length)
      return reply.code(400).send({ error: "Il file è vuoto." });
    const extension = fileExtension(file.filename, data);
    const name = `${randomUUID()}.${extension}`;
    await writeFile(resolve(options.dataDir, "uploads", name), data, {
      flag: "wx",
    });
    return {
      url: `/uploads/${name}`,
      name: file.filename.replace(/[\\/\u0000-\u001f]/g, "").slice(0, 120),
      kind: imageType(data) ? "image" : extension === "pdf" ? "pdf" : "file",
    };
  });
  app.get<{ Params: { name: string } }>(
    "/uploads/:name",
    async (req, reply) => {
      const name = req.params.name;
      if (!/^[a-f0-9-]{36}\.[a-z0-9]{1,8}$/.test(name))
        return reply.code(404).send({ error: "File non trovato." });
      try {
        const data = await readFile(resolve(options.dataDir, "uploads", name));
        const ext = name.split(".").pop()!;
        const mime = mimeTypes[ext];
        // Unknown content is never rendered by the browser, only downloaded.
        if (!mime)
          reply
            .header("Content-Disposition", "attachment")
            .header("Content-Security-Policy", "sandbox");
        return reply.type(mime ?? "application/octet-stream").send(data);
      } catch {
        return reply.code(404).send({ error: "File non trovato." });
      }
    },
  );
  app.get("/api/weather", async (req) =>
    weather.get(
      z.object({ q: z.string().trim().min(1).max(100) }).parse(req.query).q,
    ),
  );
  if (options.webDir) {
    await app.register(staticFiles, { root: options.webDir });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/") || req.url.startsWith("/uploads/")
        ? reply.code(404).send({ error: "Risorsa non trovata." })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
