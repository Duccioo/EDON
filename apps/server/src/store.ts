import { DatabaseSync } from "node:sqlite";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  desktopSchema,
  type Desktop,
  type Snapshot,
} from "../../../packages/shared/model";
import { seedDesktop } from "../../../packages/shared/seed";

const iso = (ms: number | null) =>
  ms === null ? null : new Date(ms).toISOString();

export class Store {
  private db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS desktop (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS account (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agent_tokens (id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, created INTEGER NOT NULL, expires INTEGER, last_used INTEGER);`);
    this.db
      .prepare("INSERT OR IGNORE INTO desktop VALUES (1,0,?)")
      .run(JSON.stringify(seedDesktop()));
  }
  get(): Snapshot {
    const row = this.db
      .prepare("SELECT revision,json FROM desktop WHERE id=1")
      .get()!;
    return {
      ...desktopSchema.parse(JSON.parse(String(row.json))),
      revision: Number(row.revision),
    };
  }
  save(input: Desktop, revision: number): Snapshot {
    const desktop = desktopSchema.parse(input);
    const result = this.db
      .prepare(
        "UPDATE desktop SET json=?,revision=revision+1 WHERE id=1 AND revision=?",
      )
      .run(JSON.stringify(desktop), revision);
    if (!result.changes) throw new Error("CONFLICT");
    return { ...desktop, revision: revision + 1 };
  }
  /** Read, change and save in one synchronous step, so no other write can interleave. */
  mutate<T>(fn: (desktop: Desktop) => T): { result: T; snapshot: Snapshot } {
    const { revision, ...desktop } = this.get();
    const result = fn(desktop);
    return { result, snapshot: this.save(desktop, revision) };
  }
  getSetting(key: string): string | undefined {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get(key);
    return row ? String(row.value) : undefined;
  }
  setSetting(key: string, value: string) {
    this.db
      .prepare(
        "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, value);
  }
  createToken(name: string, expiresInDays?: number) {
    const token = `edon_${randomBytes(32).toString("hex")}`;
    const id = randomUUID();
    const now = Date.now();
    const expires = expiresInDays ? now + expiresInDays * 86400000 : null;
    this.db
      .prepare(
        "INSERT INTO agent_tokens (id,name,hash,created,expires) VALUES(?,?,?,?,?)",
      )
      .run(id, name, this.digest(token), now, expires);
    return {
      token,
      info: { id, name, createdAt: iso(now), expiresAt: iso(expires) },
    };
  }
  listTokens() {
    return this.db
      .prepare(
        "SELECT id,name,created,expires,last_used FROM agent_tokens ORDER BY created",
      )
      .all()
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        createdAt: iso(Number(row.created)),
        expiresAt: iso(row.expires === null ? null : Number(row.expires)),
        lastUsedAt: iso(row.last_used === null ? null : Number(row.last_used)),
      }));
  }
  revokeToken(id: string) {
    return !!this.db.prepare("DELETE FROM agent_tokens WHERE id=?").run(id)
      .changes;
  }
  tokenValid(token: string | undefined) {
    if (!token) return false;
    const hash = this.digest(token);
    const row = this.db
      .prepare(
        "SELECT id FROM agent_tokens WHERE hash=? AND (expires IS NULL OR expires>?)",
      )
      .get(hash, Date.now());
    if (!row) return false;
    this.db
      .prepare("UPDATE agent_tokens SET last_used=? WHERE id=?")
      .run(Date.now(), String(row.id));
    return true;
  }
  configured() {
    return !!this.db.prepare("SELECT id FROM account WHERE id=1").get();
  }
  setup(password: string) {
    const salt = randomBytes(16).toString("hex");
    this.db
      .prepare("INSERT INTO account VALUES(1,?,?)")
      .run(salt, scryptSync(password, salt, 64).toString("hex"));
  }
  login(password: string) {
    const row = this.db
      .prepare("SELECT salt,hash FROM account WHERE id=1")
      .get();
    return (
      !!row &&
      timingSafeEqual(
        scryptSync(password, String(row.salt), 64),
        Buffer.from(String(row.hash), "hex"),
      )
    );
  }
  changePassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const result = this.db
      .prepare("UPDATE account SET salt=?,hash=? WHERE id=1")
      .run(salt, scryptSync(password, salt, 64).toString("hex"));
    if (!result.changes) throw new Error("Nessun account configurato.");
  }
  session() {
    const token = randomBytes(32).toString("hex");
    this.db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?)")
      .run(this.digest(token), Date.now() + 7 * 86400000);
    return token;
  }
  authenticated(token: string | undefined) {
    return (
      !!token &&
      !!this.db
        .prepare("SELECT hash FROM sessions WHERE hash=? AND expires>?")
        .get(this.digest(token), Date.now())
    );
  }
  logout(token: string) {
    this.db
      .prepare("DELETE FROM sessions WHERE hash=?")
      .run(this.digest(token));
  }
  private digest(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
  close() {
    this.db.close();
  }
}
