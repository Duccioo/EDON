import { z } from "zod";

export const tileTypes = [
  "link",
  "image",
  "text",
  "data",
  "clock",
  "folder",
  "weather",
  "progress",
  "file",
  "performance",
  "ai_limits",
  "radio",
] as const;
export type TileType = (typeof tileTypes)[number];
export const tileSizeLimits: Record<TileType, { w: number; h: number }> = {
  text: { w: 3, h: 128 },
  data: { w: 3, h: 128 },
  link: { w: 2, h: 2 },
  image: { w: 2, h: 2 },
  clock: { w: 2, h: 2 },
  folder: { w: 2, h: 2 },
  weather: { w: 2, h: 2 },
  progress: { w: 2, h: 2 },
  file: { w: 3, h: 3 },
  performance: { w: 2, h: 2 },
  ai_limits: { w: 2, h: 2 },
  radio: { w: 2, h: 2 },
};
/** The size a new tile of this type starts with. */
export const defaultTileSize = (type: TileType) =>
  ({
    clock: { w: 2, h: 1 },
    folder: { w: 2, h: 2 },
    weather: { w: 2, h: 1 },
    progress: { w: 2, h: 1 },
    file: { w: 2, h: 2 },
    performance: { w: 2, h: 1 },
    ai_limits: { w: 2, h: 1 },
    radio: { w: 2, h: 1 },
  })[type as string] ?? { w: 1, h: 1 };
export const tileSizeAllowed = (tile: {
  type: TileType;
  w: number;
  h: number;
}) =>
  tile.w <= tileSizeLimits[tile.type].w &&
  tile.h <= tileSizeLimits[tile.type].h;
export const folderChildTypes = [
  "link",
  "image",
  "text",
  "data",
  "clock",
] as const;
export type FolderChildType = (typeof folderChildTypes)[number];
export const safeLink = (value: string) => {
  try {
    return ["https:", "http:", "obsidian:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
/** Black or white text, whichever reads better on this colour (WCAG relative luminance). */
export function readableInk(background: string) {
  const channel = (offset: number) => {
    const c = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.179 ? "#111111" : "#ffffff";
}
export const safeFile = (value: string) =>
  /^\/uploads\/[a-f0-9-]{36}\.[a-z0-9]{1,8}$/.test(value);
export const isPdf = (value: string) => /\.pdf$/i.test(value);
export const safeVaultPath = (value: string) =>
  value === "*" ||
  (!value.startsWith("/") &&
    !value.endsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    !value.split("/").some((part) => !part || part.startsWith(".")));
const fileUrl = z
  .string()
  .max(200)
  .refine((v) => !v || safeFile(v), "Usa un file caricato.");
const vaultPathSchema = z
  .string()
  .max(240)
  .refine((v) => !v || safeVaultPath(v), "Percorso nel vault non valido.");
const instant = z
  .string()
  .max(40)
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Data non valida.");
export const safeImage = (value: string) =>
  /^\/(?:art\/[\w.-]+\.svg|uploads\/[\w-]+\.(?:png|jpg|gif|webp))$/.test(
    value,
  ) || /^https:\/\/[^\s"'<>\\]+$/.test(value);
const imageUrl = z
  .string()
  .max(2048)
  .refine(
    (v) => !v || safeImage(v),
    "Usa un’immagine HTTPS o un file caricato.",
  );
export const appearanceSchema = z.object({
  preset: z.enum(["minimal", "industrial", "glass"]),
  background: z.string().regex(/^#[\da-fA-F]{6}$/),
  color: z.string().regex(/^#[\da-fA-F]{6}$/),
  image: imageUrl,
  radius: z.number().min(0).max(40),
  padding: z.number().min(8).max(40),
  opacity: z.number().min(0.25).max(1),
  border: z.enum(["none", "subtle", "strong"]),
  font: z.enum(["sans", "mono", "editorial", "dot"]),
  fit: z.enum(["cover", "contain"]),
  imagePosition: z.enum(["center", "top", "bottom"]),
  blur: z.boolean(),
});
export type Appearance = z.infer<typeof appearanceSchema>;
export const presets: Record<Appearance["preset"], Appearance> = {
  minimal: {
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
  industrial: {
    preset: "industrial",
    background: "#191b1b",
    color: "#f3f3ed",
    image: "",
    radius: 14,
    padding: 24,
    opacity: 1,
    border: "subtle",
    font: "mono",
    fit: "cover",
    imagePosition: "center",
    blur: false,
  },
  glass: {
    preset: "glass",
    background: "#e4e6e2",
    color: "#171917",
    image: "",
    radius: 14,
    padding: 24,
    opacity: 0.78,
    border: "subtle",
    font: "sans",
    fit: "cover",
    imagePosition: "center",
    blur: true,
  },
};
const baseConfigSchema = z.object({
  body: z.string().max(10000),
  icon: z.string().max(12),
  image: imageUrl,
  /** City of a weather tile. */
  location: z.string().max(100).default(""),
  /** Uploaded file shown by a file tile. */
  file: fileUrl.default(""),
  /** Relative path in the Obsidian vault (.md file for notes/todos, folder or '*' for folder tiles). */
  vaultPath: vaultPathSchema.default(""),
  /** SHA-256 of the vault content last read or written by EDON. */
  vaultVersion: z
    .string()
    .regex(/^[\da-f]{64}$/)
    .or(z.literal(""))
    .default(""),
  /** A progress tile fills between these two instants (timer or deadline). */
  startsAt: instant.default(""),
  endsAt: instant.default(""),
  /** Set while a timer is paused; resuming shifts startsAt and endsAt by the pause. */
  pausedAt: instant.default(""),
  timezone: z
    .string()
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("it", { timeZone: v || undefined });
        return true;
      } catch {
        return false;
      }
    }, "Fuso orario non valido."),
  items: z
    .array(
      z.object({
        id: z.string().max(100),
        text: z.string().max(300),
        done: z.boolean(),
      }),
    )
    .max(30),
});
export const folderChildSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(folderChildTypes),
  title: z.string().max(120),
  subtitle: z.string().max(250),
  url: z
    .string()
    .max(2048)
    .refine((v) => !v || safeLink(v), "Usa un URL http, https o obsidian."),
  appearance: appearanceSchema,
  config: baseConfigSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FolderChild = z.infer<typeof folderChildSchema>;
export const tileConfigSchema = baseConfigSchema.extend({
  children: z.array(folderChildSchema).max(24).default([]),
});
export const tileSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(tileTypes),
  title: z.string().max(120),
  subtitle: z.string().max(250),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(127),
  w: z.number().int().min(1).max(3),
  h: z.number().int().min(1).max(128),
  appearance: appearanceSchema,
  config: tileConfigSchema,
  url: z
    .string()
    .max(2048)
    .refine((v) => !v || safeLink(v), "Usa un URL http, https o obsidian."),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  origin: z.enum(["user", "agent"]),
  expiresAt: z.string().datetime().nullable(),
  externalKey: z.string().max(120).nullable(),
});
export type Tile = z.infer<typeof tileSchema>;
export const settingsSchema = z.object({
  name: z.string().min(1).max(60),
  gap: z.number().int().min(0).max(40),
  maxTiles: z.number().int().min(1).max(100).optional(),
  columns: z.number().int().min(2).max(12).optional(),
  rows: z.number().int().min(2).max(128).optional(),
  wallpaper: z.enum(["fold", "solid", "gradient", "image", "ascii", "noise"]),
  background: z.string().regex(/^#[\da-fA-F]{6}$/),
  wallpaperImage: imageUrl,
  radius: z.number().min(0).max(40).default(14),
  padding: z.number().min(8).max(40).default(24),
  border: z.enum(["none", "subtle", "strong"]).default("subtle"),
  opacity: z.number().min(0.25).max(1).default(1),
  blur: z.boolean().default(false),
});
export const overlaps = (
  a: Pick<Tile, "x" | "y" | "w" | "h">,
  b: Pick<Tile, "x" | "y" | "w" | "h">,
) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const desktopSchema = z
  .object({
    settings: settingsSchema,
    tiles: z.array(tileSchema).max(100),
    archive: z.array(tileSchema).max(1000).default([]),
  })
  .superRefine(({ settings, tiles, archive }, ctx) => {
    if (tiles.length > (settings.maxTiles ?? 100))
      ctx.addIssue({
        code: "custom",
        path: ["settings", "maxTiles"],
        message: `Il limite deve essere almeno ${tiles.length}: nessuna tile verrà rimossa.`,
      });
    const ids = new Set<string>();
    const externalKeys = new Set<string>();
    const checkIdentity = (tile: (typeof tiles)[number]) => {
      if (ids.has(tile.id))
        ctx.addIssue({
          code: "custom",
          message: "Ogni tile e contenuto di cartella deve avere un ID unico.",
        });
      ids.add(tile.id);
      if (tile.externalKey) {
        if (externalKeys.has(tile.externalKey))
          ctx.addIssue({
            code: "custom",
            message: "Ogni chiave stabile deve essere unica.",
          });
        externalKeys.add(tile.externalKey);
      }
      if (tile.type === "folder") {
        for (const child of tile.config.children ?? []) {
          if (ids.has(child.id))
            ctx.addIssue({
              code: "custom",
              message:
                "Ogni tile e contenuto di cartella deve avere un ID unico.",
            });
          ids.add(child.id);
        }
      }
    };
    for (const tile of [...tiles, ...archive]) {
      if (!tileSizeAllowed(tile))
        ctx.addIssue({
          code: "custom",
          message: `Dimensione massima per ${tile.type}: ${tileSizeLimits[tile.type].w} × ${tileSizeLimits[tile.type].h}.`,
        });
    }
    for (const tile of archive) {
      if (!["text", "data"].includes(tile.type))
        ctx.addIssue({
          code: "custom",
          message:
            "Archivio non valido: sono ammesse note e TODO con identificativi unici.",
        });
      checkIdentity(tile);
    }
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (
        tile.x + tile.w > (settings.columns ?? 6) ||
        tile.y + tile.h > (settings.rows ?? 128) ||
        tiles.slice(0, i).some((other) => overlaps(tile, other))
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Il layout contiene tile duplicate, sovrapposte o fuori griglia.",
        });
      checkIdentity(tile);
    }
  })
  .transform(({ settings, tiles, archive }) => ({
    settings: {
      ...settings,
      maxTiles: settings.maxTiles ?? Math.max(24, tiles.length),
      columns: settings.columns ?? 6,
      rows:
        settings.rows ?? Math.max(4, ...tiles.map((tile) => tile.y + tile.h)),
    },
    tiles,
    archive,
  }));
export type Desktop = z.infer<typeof desktopSchema>;
export type Snapshot = Desktop & { revision: number };
export function createTile(
  type: TileType,
  tiles: Tile[],
  size?: Pick<Tile, "w" | "h">,
  maxTiles = 100,
  grid = { columns: 6, rows: 102 },
): Tile {
  if (tiles.length >= maxTiles)
    throw new Error(
      `Hai raggiunto il limite di ${maxTiles} tile. Aumentalo nelle impostazioni o libera spazio.`,
    );
  const now = new Date().toISOString();
  const tile: Tile = {
    id: crypto.randomUUID(),
    type,
    title: {
      link: "Nuovo collegamento",
      image: "Nuova immagine",
      text: "Un pensiero",
      data: "Da ricordare",
      clock: "Ora locale",
      folder: "Nuova cartella",
      weather: "Meteo",
      progress: "Scadenza",
      file: "Nuovo file",
      performance: "Prestazioni",
      ai_limits: "Subscription AI",
      radio: "DJ Osso Radio",
    }[type],
    subtitle:
      type === "radio"
        ? "Happy Music · Diretta"
        : type === "performance"
          ? "Sistema in tempo reale"
          : type === "ai_limits"
            ? "Limiti e quote mensili"
            : "",
    x: 0,
    y: 0,
    w: size?.w ?? defaultTileSize(type).w,
    h: size?.h ?? defaultTileSize(type).h,
    appearance: { ...presets.minimal },
    config: {
      body:
        type === "radio" ? "https://stream.rcs.revma.com/x3ab37sgn7uvv" : "",
      icon: "↗",
      image: "",
      location: "",
      file: "",
      vaultPath: "",
      vaultVersion: "",
      startsAt: "",
      endsAt: "",
      pausedAt: "",
      timezone: "",
      items:
        type === "ai_limits"
          ? [
              {
                id: "claude",
                text: "Claude Max | 65% | Reset 5h",
                done: false,
              },
              {
                id: "chatgpt",
                text: "ChatGPT Plus | 40% | Reset 3h",
                done: false,
              },
              { id: "cursor", text: "Cursor Pro | 72% | 18 gg", done: false },
              {
                id: "hermes",
                text: "Hermes / OpenRouter | 15% | API",
                done: false,
              },
            ]
          : [],
      children: [],
    },
    url: type === "radio" ? "https://www.djossoradio.it" : "",
    createdAt: now,
    updatedAt: now,
    origin: "user",
    expiresAt: null,
    externalKey: null,
  };
  if (!tileSizeAllowed(tile))
    throw new Error(
      `Dimensione massima per questa tile: ${tileSizeLimits[type].w} × ${tileSizeLimits[type].h}.`,
    );
  const position = findTileSpace(tiles, tile, grid);
  if (position) return { ...tile, ...position };
  throw new Error(
    "Non c’è spazio nella griglia. Aumenta righe o colonne in Aspetto, oppure libera spazio.",
  );
}

export function createFolderChild(
  type: FolderChildType,
  overrides: Partial<FolderChild> = {},
): FolderChild {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type,
    title:
      overrides.title ??
      {
        link: "Nuovo collegamento",
        image: "Nuova immagine",
        text: "Un pensiero",
        data: "Da ricordare",
        clock: "Ora locale",
      }[type],
    subtitle: overrides.subtitle ?? "",
    url: overrides.url ?? "",
    appearance: overrides.appearance ?? { ...presets.minimal },
    config: overrides.config ?? {
      body: "",
      icon: "↗",
      image: "",
      location: "",
      file: "",
      vaultPath: "",
      vaultVersion: "",
      startsAt: "",
      endsAt: "",
      pausedAt: "",
      timezone: "",
      items: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** Moves a desktop tile into a folder; position and agent bookkeeping stay behind. */
export function tileToFolderChild(tile: Tile): FolderChild | null {
  const type = tile.type;
  if (!(folderChildTypes as readonly string[]).includes(type)) return null;
  const { children: _children, ...config } = tile.config;
  return {
    id: tile.id,
    type: type as FolderChildType,
    title: tile.title,
    subtitle: tile.subtitle,
    url: tile.url,
    appearance: tile.appearance,
    config,
    createdAt: tile.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

/** Takes a child out of its folder and puts it back on the first free spot of the desktop. */
export function folderChildToTile(
  child: FolderChild,
  tiles: Tile[],
  grid: { columns: number; rows: number },
): Tile | null {
  const size = defaultTileSize(child.type);
  const position = findTileSpace(tiles, size, grid);
  if (!position) return null;
  return {
    ...child,
    config: { ...child.config, children: [] },
    ...size,
    ...position,
    updatedAt: new Date().toISOString(),
    origin: "user",
    expiresAt: null,
    externalKey: null,
  };
}

export function arrangeTile(
  tiles: Tile[],
  changed: Tile,
  grid = { columns: 6, rows: 102 },
): Tile[] | null {
  const original = tiles.find((t) => t.id === changed.id);
  if (
    !original ||
    !tileSizeAllowed(changed) ||
    changed.x < 0 ||
    changed.x + changed.w > grid.columns ||
    changed.y < 0 ||
    changed.y + changed.h > grid.rows
  )
    return null;
  const others = tiles.filter((t) => t.id !== changed.id);
  const collisions = others.filter((t) => overlaps(t, changed));
  if (!collisions.length)
    return tiles.map((t) => (t.id === changed.id ? changed : t));
  const target = collisions[0];
  if (
    collisions.length !== 1 ||
    original.w !== changed.w ||
    original.h !== changed.h ||
    target.w !== changed.w ||
    target.h !== changed.h
  )
    return null;
  const swapped = {
    ...target,
    x: original.x,
    y: original.y,
    updatedAt: changed.updatedAt,
  };
  if (
    overlaps(swapped, changed) ||
    others.some((t) => t.id !== target.id && overlaps(t, swapped))
  )
    return null;
  return tiles.map((t) =>
    t.id === changed.id ? changed : t.id === target.id ? swapped : t,
  );
}

/** Packs tiles towards the top-left: each tile takes the earliest free spot in reading order. */
export function compactTiles(tiles: Tile[], columns = 6): Tile[] {
  const result = tiles.map((t) => ({ ...t }));
  const order = [...result].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const tile of order) {
    const others = result.filter((t) => t !== tile);
    search: for (let y = 0; y <= tile.y; y++)
      for (let x = 0; x <= columns - tile.w; x++) {
        if (y === tile.y && x >= tile.x) break search;
        if (others.some((o) => overlaps(o, { x, y, w: tile.w, h: tile.h })))
          continue;
        tile.x = x;
        tile.y = y;
        tile.updatedAt = new Date().toISOString();
        break search;
      }
  }
  return result;
}

export function findTileSpace(
  tiles: Pick<Tile, "x" | "y" | "w" | "h">[],
  size: Pick<Tile, "w" | "h">,
  grid: { columns: number; rows: number },
): { x: number; y: number } | undefined {
  for (let y = 0; y <= grid.rows - size.h; y++)
    for (let x = 0; x <= grid.columns - size.w; x++)
      if (!tiles.some((tile) => overlaps(tile, { ...size, x, y })))
        return { x, y };
}

/** Reflows only when the new grid would put existing tiles outside its bounds. */
export function resizeGrid(
  tiles: Tile[],
  grid: { columns: number; rows: number },
): Tile[] | null {
  if (tiles.every((t) => t.x + t.w <= grid.columns && t.y + t.h <= grid.rows))
    return tiles;
  // shortcut: first-fit can reject some packable grids; add a packing solver only if this becomes common.
  const placed: Tile[] = [];
  for (const tile of [...tiles].sort(
    (a, b) => b.w * b.h - a.w * a.h || a.y - b.y || a.x - b.x,
  )) {
    const position = findTileSpace(placed, tile, grid);
    if (!position) return null;
    placed.push({ ...tile, ...position });
  }
  return tiles.map((tile) => placed.find((t) => t.id === tile.id)!);
}

export function archiveTile(desktop: Desktop, id: string): Desktop {
  const tile = desktop.tiles.find((t) => t.id === id);
  if (!tile || !["text", "data"].includes(tile.type))
    throw new Error("Puoi archiviare solo note e TODO.");
  if (desktop.archive.length >= 1000)
    throw new Error(
      "L’archivio è pieno. Esporta un backup prima di liberare spazio.",
    );
  return {
    ...desktop,
    tiles: desktop.tiles.filter((t) => t.id !== id),
    archive: [tile, ...desktop.archive],
  };
}
export function restoreTile(desktop: Desktop, id: string): Desktop {
  const tile = desktop.archive.find((t) => t.id === id);
  if (!tile) throw new Error("Nota non trovata nell’archivio.");
  if (desktop.tiles.length >= desktop.settings.maxTiles)
    throw new Error("Limite tile raggiunto. Aumentalo in Aspetto.");
  const position = findTileSpace(desktop.tiles, tile, desktop.settings);
  if (!position)
    throw new Error(
      "Non c’è spazio per ripristinare questa tile. Aumenta righe o colonne.",
    );
  return {
    ...desktop,
    tiles: [...desktop.tiles, { ...tile, ...position }],
    archive: desktop.archive.filter((t) => t.id !== id),
  };
}
