import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  safeVaultPath,
  type Desktop,
  type FolderChild,
  type Tile,
} from "../../../packages/shared/model";
import type { Store } from "./store";
import { TileError } from "./tiles";

export type VaultEnv = {
  path?: string;
  folder?: string;
  archiveFolder?: string;
};

const cleanSubfolder = (value: string) =>
  value.trim().replace(/^\/+|\/+$/g, "");

export const vaultSettingsInput = z.object({
  path: z.string().trim().max(500),
  folder: z
    .string()
    .trim()
    .max(120)
    .default("")
    .transform(cleanSubfolder)
    .refine(
      (v) => !v || (safeVaultPath(v) && v !== "*"),
      "Cartella predefinita non valida.",
    ),
  archiveFolder: z
    .string()
    .trim()
    .max(120)
    .default(".trash")
    .transform((v) => cleanSubfolder(v) || ".trash")
    .refine(
      (v) =>
        v === ".trash" ||
        (!v.includes("\\") &&
          !v.includes("\0") &&
          !v.split("/").some((p) => !p || p === "." || p === "..")),
      "Cartella cestino/archivio non valida.",
    ),
});

export type VaultNoteSummary = {
  path: string;
  title: string;
  folder: string;
  excerpt: string;
  updatedAt: string;
  kind: "text" | "data";
  taskCount: number;
  doneCount: number;
};

export type VaultNoteDetail = VaultNoteSummary & {
  body: string;
  items: Tile["config"]["items"];
  obsidianUrl: string;
};

function splitFrontmatter(raw: string): {
  frontmatter: string;
  content: string;
} {
  const match = /^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/.exec(raw);
  if (!match) return { frontmatter: "", content: raw };
  return {
    frontmatter: match[1],
    content: raw.slice(match[1].length),
  };
}

export function parseVaultMarkdown(
  raw: string,
  relPath: string,
  existingItems: Tile["config"]["items"] = [],
): {
  title: string;
  hasHeading: boolean;
  body: string;
  items: Tile["config"]["items"];
  frontmatter: string;
} {
  const { frontmatter, content } = splitFrontmatter(raw);
  const stem = basename(relPath, extname(relPath));
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let start = 0;
  while (start < lines.length && !lines[start].trim()) start++;
  const headingMatch =
    start < lines.length ? /^#\s+(.+)$/.exec(lines[start].trim()) : null;
  const title = (headingMatch ? headingMatch[1].trim() : stem).slice(0, 120);
  const bodyLines: string[] = [];
  const items: Tile["config"]["items"] = [];
  const usedIds = new Set<string>();
  let fence: { marker: string; length: number } | undefined;

  for (let i = headingMatch ? start + 1 : start; i < lines.length; i++) {
    const line = lines[i];
    const mark = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (mark) {
      if (!fence) fence = { marker: mark[0], length: mark.length };
      else if (mark[0] === fence.marker && mark.length >= fence.length)
        fence = undefined;
      bodyLines.push(line);
      continue;
    }
    const task = !fence ? /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line) : null;
    if (task && task[2].trim() && items.length < 30) {
      const text = task[2].trim().slice(0, 300);
      const done = task[1].toLowerCase() === "x";
      const prev = existingItems.find(
        (item) => !usedIds.has(item.id) && item.text === text,
      );
      const id = prev?.id ?? randomUUID();
      usedIds.add(id);
      items.push({ id, text, done });
    } else {
      bodyLines.push(line);
    }
  }

  return {
    title: title || stem || "Senza titolo",
    hasHeading: !!headingMatch,
    body: bodyLines.join("\n").trim().slice(0, 10000),
    items,
    frontmatter,
  };
}

export function formatVaultMarkdown(input: {
  title: string;
  body: string;
  items: Tile["config"]["items"];
  frontmatter?: string;
  includeHeading?: boolean;
}): string {
  const parts: string[] = [];
  if ((input.includeHeading ?? true) && input.title.trim()) {
    parts.push(`# ${input.title.trim()}`);
  }
  if (input.body.trim()) {
    parts.push(input.body.trim());
  }
  if (input.items.length > 0) {
    parts.push(
      input.items
        .map((item) => `- [${item.done ? "x" : " "}] ${item.text}`)
        .join("\n"),
    );
  }
  const body = parts.join("\n\n");
  const fm = input.frontmatter
    ? input.frontmatter.endsWith("\n")
      ? input.frontmatter
      : `${input.frontmatter}\n`
    : "";
  return `${fm}${body ? `${body}\n` : ""}`;
}

function sanitizeFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80);
  return cleaned || "Appunto";
}

export function obsidianUri(vaultName: string, relPath: string): string {
  const clean = relPath.replace(/\.md$/i, "");
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(clean)}`;
}

export class VaultService {
  constructor(
    private store: Store,
    private env: VaultEnv = {},
  ) {}

  private resolved() {
    const saved = this.store.getSetting("vault");
    const ui: VaultEnv = saved ? JSON.parse(saved) : {};
    const rawPath = (this.env.path || ui.path || "").trim();
    const path = rawPath ? resolve(rawPath) : "";
    const folder = cleanSubfolder(this.env.folder ?? ui.folder ?? "");
    const archiveFolder =
      cleanSubfolder(this.env.archiveFolder ?? ui.archiveFolder ?? ".trash") ||
      ".trash";
    return { path, folder, archiveFolder };
  }

  isConfigured(): boolean {
    const { path } = this.resolved();
    if (!path) return false;
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  }

  vaultName(): string {
    const { path } = this.resolved();
    return path ? basename(path) : "";
  }

  status() {
    const c = this.resolved();
    const active = this.isConfigured();
    const listing = active
      ? this.scanVault(c.path, c.archiveFolder)
      : { notes: [], folders: [] };
    return {
      configured: active,
      path: c.path,
      vaultName: c.path ? basename(c.path) : "",
      folder: c.folder,
      archiveFolder: c.archiveFolder,
      noteCount: listing.notes.length,
      folders: listing.folders,
      managedByEnvironment: {
        path: !!this.env.path,
        folder: this.env.folder !== undefined,
        archiveFolder: this.env.archiveFolder !== undefined,
      },
    };
  }

  save(input: z.infer<typeof vaultSettingsInput>) {
    const parsed = vaultSettingsInput.parse(input);
    if (parsed.path) {
      const target = resolve(parsed.path);
      let isDir = false;
      try {
        isDir = statSync(target).isDirectory();
      } catch {
        isDir = false;
      }
      if (!isDir)
        throw new TileError(
          400,
          "La cartella del vault non esiste o non è accessibile sul server.",
        );
    }
    this.store.setSetting("vault", JSON.stringify(parsed));
    return this.status();
  }

  private resolveSafe(relPath: string): string {
    const { path: root } = this.resolved();
    if (!root || !this.isConfigured())
      throw new TileError(
        409,
        "Configura prima il vault di Obsidian in Impostazioni → Integrazioni.",
      );
    const normalized = relPath.trim().replace(/^\/+/, "");
    if (!safeVaultPath(normalized) || normalized === "*")
      throw new TileError(400, "Percorso nel vault non valido.");
    const withExt = /\.md$/i.test(normalized) ? normalized : `${normalized}.md`;
    const full = resolve(root, withExt);
    const rel = relative(root, full);
    if (rel.startsWith("..") || rel.includes("\\"))
      throw new TileError(400, "Percorso fuori dal vault non consentito.");
    return full;
  }

  private scanVault(
    root: string,
    archiveFolder: string,
  ): { notes: VaultNoteSummary[]; folders: string[] } {
    const notes: VaultNoteSummary[] = [];
    const folders = new Set<string>();
    const archiveNorm = archiveFolder.replace(/\\/g, "/");

    const walk = (dir: string) => {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        const rel = relative(root, full).replace(/\\/g, "/");
        if (rel === archiveNorm || rel.startsWith(`${archiveNorm}/`)) continue;
        if (entry.isDirectory()) {
          folders.add(rel);
          walk(full);
        } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
          try {
            const raw = readFileSync(full, "utf8");
            const stat = statSync(full);
            const parsed = parseVaultMarkdown(raw, rel);
            const folder = dirname(rel) === "." ? "" : dirname(rel);
            const plain = parsed.body
              .replace(/[#>*_`~-]/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            notes.push({
              path: rel,
              title: parsed.title,
              folder,
              excerpt:
                plain.slice(0, 180) ||
                (parsed.items.length
                  ? parsed.items
                      .slice(0, 3)
                      .map((i) => i.text)
                      .join(" · ")
                  : ""),
              updatedAt: stat.mtime.toISOString(),
              kind: parsed.items.length > 0 ? "data" : "text",
              taskCount: parsed.items.length,
              doneCount: parsed.items.filter((i) => i.done).length,
            });
          } catch {
            // Ignore unreadable files
          }
        }
      }
    };

    walk(root);
    notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      notes,
      folders: [...folders].sort((a, b) => a.localeCompare(b)),
    };
  }

  listNotes(filter?: { query?: string; folder?: string }): {
    vaultName: string;
    defaultFolder: string;
    folders: string[];
    notes: VaultNoteSummary[];
  } {
    const c = this.resolved();
    if (!this.isConfigured())
      throw new TileError(
        409,
        "Configura prima il vault di Obsidian in Impostazioni → Integrazioni.",
      );
    const { notes, folders } = this.scanVault(c.path, c.archiveFolder);
    const folderFilter = filter?.folder?.trim().replace(/^\/+|\/+$/g, "");
    const q = filter?.query?.trim().toLowerCase();
    const filtered = notes.filter((n) => {
      if (folderFilter && folderFilter !== "*") {
        if (
          n.folder !== folderFilter &&
          !n.folder.startsWith(`${folderFilter}/`)
        )
          return false;
      }
      if (q) {
        return (
          n.title.toLowerCase().includes(q) ||
          n.path.toLowerCase().includes(q) ||
          n.excerpt.toLowerCase().includes(q)
        );
      }
      return true;
    });
    return {
      vaultName: basename(c.path),
      defaultFolder: c.folder,
      folders,
      notes: filtered,
    };
  }

  readNote(relPath: string): VaultNoteDetail {
    const full = this.resolveSafe(relPath);
    const { path: root } = this.resolved();
    const canonicalRel = relative(root, full).replace(/\\/g, "/");
    let raw: string;
    let stat;
    try {
      raw = readFileSync(full, "utf8");
      stat = statSync(full);
    } catch {
      throw new TileError(404, "Nota non trovata nel vault.");
    }
    const parsed = parseVaultMarkdown(raw, canonicalRel);
    const folder = dirname(canonicalRel) === "." ? "" : dirname(canonicalRel);
    return {
      path: canonicalRel,
      title: parsed.title,
      folder,
      excerpt: parsed.body.slice(0, 180),
      updatedAt: stat.mtime.toISOString(),
      kind: parsed.items.length > 0 ? "data" : "text",
      taskCount: parsed.items.length,
      doneCount: parsed.items.filter((i) => i.done).length,
      body: parsed.body,
      items: parsed.items,
      obsidianUrl: obsidianUri(basename(root), canonicalRel),
    };
  }

  writeNote(input: {
    path?: string;
    folder?: string;
    title: string;
    body: string;
    items?: Tile["config"]["items"];
  }): VaultNoteDetail {
    const c = this.resolved();
    if (!this.isConfigured())
      throw new TileError(
        409,
        "Configura prima il vault di Obsidian in Impostazioni → Integrazioni.",
      );
    const items = input.items ?? [];
    let relPath = input.path?.trim() ?? "";
    let frontmatter = "";
    let includeHeading = true;

    if (relPath) {
      const full = this.resolveSafe(relPath);
      relPath = relative(c.path, full).replace(/\\/g, "/");
      if (existsSync(full)) {
        const existing = parseVaultMarkdown(
          readFileSync(full, "utf8"),
          relPath,
          items,
        );
        frontmatter = existing.frontmatter;
        includeHeading = existing.hasHeading;
      }
    } else {
      const targetFolder = cleanSubfolder(input.folder ?? c.folder);
      relPath = this.allocatePath(input.title, targetFolder);
    }

    const full = this.resolveSafe(relPath);
    mkdirSync(dirname(full), { recursive: true });
    const stem = basename(relPath, ".md");
    const shouldIncludeHeading =
      includeHeading ||
      (input.title.trim() !== "" &&
        sanitizeFileName(input.title) !== stem &&
        input.title.trim() !== stem);

    writeFileSync(
      full,
      formatVaultMarkdown({
        title: input.title,
        body: input.body,
        items,
        frontmatter,
        includeHeading: shouldIncludeHeading,
      }),
      "utf8",
    );
    return this.readNote(relPath);
  }

  trashNote(relPath: string): { archivedTo: string } {
    const full = this.resolveSafe(relPath);
    const c = this.resolved();
    if (!existsSync(full)) return { archivedTo: "" };
    const canonicalRel = relative(c.path, full).replace(/\\/g, "/");
    const trashDir = resolve(c.path, c.archiveFolder);
    const relToRoot = relative(c.path, trashDir);
    if (relToRoot.startsWith(".."))
      throw new TileError(400, "Cartella cestino fuori dal vault.");
    const relSubdir =
      dirname(canonicalRel) === "." ? "" : dirname(canonicalRel);
    const targetDir = relSubdir ? join(trashDir, relSubdir) : trashDir;
    mkdirSync(targetDir, { recursive: true });
    const base = basename(full, ".md");
    let dest = join(targetDir, `${base}.md`);
    let counter = 2;
    while (existsSync(dest)) {
      dest = join(targetDir, `${base} ${counter++}.md`);
    }
    renameSync(full, dest);
    return { archivedTo: relative(c.path, dest).replace(/\\/g, "/") };
  }

  private allocatePath(title: string, subfolder?: string): string {
    const c = this.resolved();
    const folder = subfolder !== undefined ? subfolder : c.folder;
    const base = sanitizeFileName(title);
    const prefix = folder ? `${folder}/` : "";
    let candidate = `${prefix}${base}.md`;
    let counter = 2;
    while (existsSync(resolve(c.path, candidate))) {
      candidate = `${prefix}${base} ${counter++}.md`;
    }
    return candidate;
  }

  /** Reads linked .md files from disk into the desktop tiles/children. Returns true if any tile changed. */
  syncFromDisk(desktop: Desktop): boolean {
    if (!this.isConfigured()) return false;
    let changed = false;

    const syncOne = (tile: Tile | FolderChild) => {
      if (tile.type !== "text" && tile.type !== "data") return;
      const relPath = tile.config.vaultPath;
      if (!relPath || relPath === "*") return;
      let full: string;
      try {
        full = this.resolveSafe(relPath);
      } catch {
        return;
      }
      if (!existsSync(full)) return;
      try {
        const raw = readFileSync(full, "utf8");
        const parsed = parseVaultMarkdown(raw, relPath, tile.config.items);
        if (tile.type === "text" && parsed.items.length > 0) {
          // For a plain text note that has checkboxes in Obsidian, keep them in body if it's a text tile
          const { content } = splitFrontmatter(raw);
          const lines = content.replace(/\r\n/g, "\n").split("\n");
          let start = 0;
          while (start < lines.length && !lines[start].trim()) start++;
          const headingMatch =
            start < lines.length
              ? /^#\s+(.+)$/.exec(lines[start].trim())
              : null;
          const fullBody = lines
            .slice(headingMatch ? start + 1 : start)
            .join("\n")
            .trim()
            .slice(0, 10000);
          if (tile.title !== parsed.title || tile.config.body !== fullBody) {
            tile.title = parsed.title;
            tile.config.body = fullBody;
            changed = true;
          }
          return;
        }
        const sameItems =
          tile.config.items.length === parsed.items.length &&
          tile.config.items.every(
            (item, idx) =>
              item.text === parsed.items[idx].text &&
              item.done === parsed.items[idx].done,
          );
        if (
          tile.title !== parsed.title ||
          tile.config.body !== parsed.body ||
          !sameItems
        ) {
          tile.title = parsed.title;
          tile.config.body = parsed.body;
          tile.config.items = parsed.items;
          changed = true;
        }
      } catch {
        // Ignore transient read errors
      }
    };

    for (const tile of desktop.tiles) {
      syncOne(tile);
      if (tile.type === "folder") {
        for (const child of tile.config.children ?? []) syncOne(child);
      }
    }
    for (const tile of desktop.archive) syncOne(tile);
    return changed;
  }

  /** Syncs desktop mutations (new notes, edited notes, deleted notes) to the Obsidian vault on disk. */
  syncToDisk(previous: Desktop, next: Desktop): void {
    if (!this.isConfigured()) return;
    const c = this.resolved();

    const collect = (d: Desktop) => {
      const map = new Map<string, Tile | FolderChild>();
      for (const t of d.tiles) {
        if (t.type === "text" || t.type === "data") map.set(t.id, t);
        if (t.type === "folder") {
          for (const child of t.config.children ?? []) {
            if (child.type === "text" || child.type === "data")
              map.set(child.id, child);
          }
        }
      }
      return map;
    };

    const prevMap = collect(previous);
    const nextMap = collect(next);
    const archivedIds = new Set(next.archive.map((t) => t.id));
    const archivedVaultPaths = new Set(
      next.archive.map((t) => t.config.vaultPath).filter(Boolean),
    );

    // 1. Sync active tiles and folder children
    for (const [id, tile] of nextMap.entries()) {
      const prev = prevMap.get(id);
      let relPath = tile.config.vaultPath;

      if (!relPath || relPath === "*") {
        relPath = this.allocatePath(tile.title);
        tile.config.vaultPath = relPath;
        this.writeTileFile(tile, relPath);
        continue;
      }

      const full = this.resolveSafe(relPath);
      const switchedPath = !prev || prev.config.vaultPath !== relPath;

      if (switchedPath && existsSync(full)) {
        // Tile was just linked to an existing Vault file: load its content if the tile has default/empty content
        const hasCustomContent =
          tile.config.body.trim().length > 0 || tile.config.items.length > 0;
        if (!hasCustomContent) {
          const detail = this.readNote(relPath);
          tile.title = detail.title;
          tile.config.body = detail.body;
          tile.config.items = detail.items;
          tile.config.vaultPath = detail.path;
          continue;
        }
      }

      // Check if title changed and we should rename the file on disk
      if (
        prev &&
        prev.config.vaultPath === relPath &&
        prev.title !== tile.title &&
        existsSync(full)
      ) {
        const oldStem = basename(relPath, ".md");
        if (
          oldStem === sanitizeFileName(prev.title) ||
          oldStem === prev.title
        ) {
          const dir = dirname(relPath) === "." ? "" : dirname(relPath);
          const newRel = this.allocatePath(tile.title, dir);
          const newFull = this.resolveSafe(newRel);
          try {
            mkdirSync(dirname(newFull), { recursive: true });
            renameSync(full, newFull);
            relPath = newRel;
            tile.config.vaultPath = newRel;
          } catch {
            // Keep existing filename if rename fails
          }
        }
      }

      const contentChanged =
        !prev ||
        prev.title !== tile.title ||
        prev.config.body !== tile.config.body ||
        JSON.stringify(prev.config.items) !==
          JSON.stringify(tile.config.items) ||
        !existsSync(this.resolveSafe(relPath));

      if (contentChanged) {
        this.writeTileFile(tile, relPath);
      }
    }

    // 2. When Vault is active, archiving a tile simply unpins it from the desktop while keeping its .md file in the Vault
    next.archive = next.archive.filter((t) => {
      if (!t.config.vaultPath) {
        const relPath = this.allocatePath(t.title);
        t.config.vaultPath = relPath;
        this.writeTileFile(t, relPath);
      }
      return false;
    });

    // 3. Tiles that were deleted (not moved to archive and not referenced by another active tile) get moved to the Vault trash/archiveFolder
    const remainingPaths = new Set(
      [...nextMap.values()].map((t) => t.config.vaultPath).filter(Boolean),
    );
    for (const [id, prevTile] of prevMap.entries()) {
      const path = prevTile.config.vaultPath;
      if (
        path &&
        path !== "*" &&
        !nextMap.has(id) &&
        !archivedIds.has(id) &&
        !archivedVaultPaths.has(path) &&
        !remainingPaths.has(path)
      ) {
        try {
          this.trashNote(path);
        } catch {
          // Ignore if already deleted
        }
      }
    }
    void c;
  }

  private writeTileFile(tile: Tile | FolderChild, relPath: string) {
    const full = this.resolveSafe(relPath);
    let frontmatter = "";
    let includeHeading = true;
    if (existsSync(full)) {
      try {
        const existing = parseVaultMarkdown(
          readFileSync(full, "utf8"),
          relPath,
          tile.config.items,
        );
        frontmatter = existing.frontmatter;
        includeHeading = existing.hasHeading;
      } catch {
        // Ignore read error
      }
    }
    const stem = basename(relPath, ".md");
    const shouldIncludeHeading =
      includeHeading ||
      (tile.title.trim() !== "" &&
        sanitizeFileName(tile.title) !== stem &&
        tile.title.trim() !== stem);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(
      full,
      formatVaultMarkdown({
        title: tile.title,
        body: tile.config.body,
        items: tile.type === "data" ? tile.config.items : [],
        frontmatter,
        includeHeading: shouldIncludeHeading,
      }),
      "utf8",
    );
  }
}
