import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const dataDir = resolve(process.env.DATA_DIR ?? "./data");
const webDir = resolve(import.meta.dirname, "../../../dist/web");

const app = await buildApp({
  dataDir,
  webDir: existsSync(webDir) ? webDir : undefined,
  secureCookie: process.env.COOKIE_SECURE === "true",
  logger: true,
  agentToken: process.env.EDON_AGENT_TOKEN?.trim() || undefined,
  agent: {
    url: process.env.HERMES_URL?.trim() || undefined,
    apiKey: process.env.HERMES_API_KEY?.trim() || undefined,
    model: process.env.HERMES_MODEL?.trim() || undefined,
  },
  vault: {
    path: process.env.OBSIDIAN_VAULT_PATH?.trim() || undefined,
    folder: process.env.OBSIDIAN_FOLDER?.trim() || undefined,
    archiveFolder: process.env.OBSIDIAN_ARCHIVE_FOLDER?.trim() || undefined,
  },
});
await app.listen({ port, host });
