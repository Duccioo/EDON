import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { buildApp } from "./app";
const webDir = resolve("dist/web");
const app = await buildApp({
  dataDir: resolve(process.env.DATA_DIR ?? "data"),
  webDir: existsSync(webDir) ? webDir : undefined,
  secureCookie: process.env.COOKIE_SECURE === "true",
  agentToken: process.env.EDON_AGENT_TOKEN || undefined,
  agent: {
    url: process.env.HERMES_URL || undefined,
    apiKey: process.env.HERMES_API_KEY || undefined,
    model: process.env.HERMES_MODEL || undefined,
  },
  logger: true,
});
await app.listen({
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3001),
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
