import { z } from "zod";
import {
  appearanceSchema,
  createTile,
  desktopSchema,
  overlaps,
  presets,
  readableInk,
  tileSchema,
  tileSizeAllowed,
  tileSizeLimits,
  tileTypes,
  type Desktop,
  type Snapshot,
  type Tile,
} from "../../../packages/shared/model";
import type { Store } from "./store";
import type { VaultService } from "./vault";

export class TileError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const externalKeySchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9._:-]{0,119}$/i,
    "La chiave stabile usa lettere, numeri e . _ : - (massimo 120 caratteri).",
  );
const tileFields = {
  type: z.enum(tileTypes),
  title: z.string().max(120),
  subtitle: z.string().max(250),
  url: tileSchema.shape.url,
  config: tileSchema.shape.config.partial(),
  appearance: appearanceSchema.partial(),
  w: tileSchema.shape.w,
  h: tileSchema.shape.h,
  expiresAt: z.string().datetime().nullable(),
};
export const createInput = z
  .object({
    ...tileFields,
    externalKey: externalKeySchema.nullable(),
  })
  .partial()
  .required({ type: true })
  .strict();
export const patchInput = z
  .object({ ...tileFields, externalKey: externalKeySchema.nullable() })
  .omit({ type: true })
  .partial()
  .strict();
export const upsertInput = z.object(tileFields).partial().strict();
export type CreateInput = z.infer<typeof createInput>;
export type PatchInput = z.infer<typeof patchInput>;
export type UpsertInput = z.infer<typeof upsertInput>;
export const layoutInput = z
  .object({
    tiles: z
      .array(
        z.object({
          id: z.string().uuid(),
          x: z.number().int(),
          y: z.number().int(),
        }),
      )
      .max(100),
  })
  .strict();

export const tileTypeDocs = [
  {
    type: "text",
    description:
      "Nota di testo. Il contenuto è in config.body (max 10000). Se il vault di Obsidian è attivo, config.vaultPath collega la tile a un file .md del vault.",
    fields: ["title", "subtitle", "config.body", "config.vaultPath", "url"],
    sizes: "larghezza 1–3, altezza 1–128 (entro le righe del desktop)",
  },
  {
    type: "data",
    description:
      "Tile di dati: testo in config.body ed elenco di voci spuntabili in config.items (max 30, ognuna {id,text,done}). Sincronizzata con config.vaultPath nel vault di Obsidian se attivo.",
    fields: [
      "title",
      "subtitle",
      "config.body",
      "config.items",
      "config.vaultPath",
      "config.icon",
      "config.image",
      "url",
    ],
    sizes: "larghezza 1–3, altezza 1–128 (entro le righe del desktop)",
  },
  {
    type: "link",
    description:
      "Collegamento. Richiede url (http, https o obsidian://). config.icon è un breve simbolo, config.image un'immagine HTTPS.",
    fields: ["title", "subtitle", "url", "config.icon", "config.image"],
    sizes: "1×1 … 2×2",
  },
  {
    type: "image",
    description: "Immagine o GIF. config.image deve essere un URL HTTPS.",
    fields: ["title", "subtitle", "config.image", "url"],
    sizes: "1×1 … 2×2",
  },
  {
    type: "clock",
    description:
      "Orologio. config.timezone è un fuso IANA (es. Europe/Rome); vuoto = ora locale del browser.",
    fields: ["title", "subtitle", "config.timezone"],
    sizes: "1×1 … 2×2",
  },
  {
    type: "folder",
    description:
      "Cartella: contiene fino a 24 mini-tile in config.children oppure punta a una cartella del vault di Obsidian (config.vaultPath: '*' per l'intero vault o percorso relativo della cartella).",
    fields: ["title", "subtitle", "config.children", "config.vaultPath"],
    sizes: "1×1 … 2×2",
  },
  {
    type: "weather",
    description:
      "Meteo attuale di una città (dati Open-Meteo, aggiornati ogni 10 minuti). config.location è il nome della città, es. “Firenze”.",
    fields: ["title", "subtitle", "config.location"],
    sizes: "1×1 … 2×2",
  },
  {
    type: "progress",
    description:
      "Barra di avanzamento nel tempo: timer o scadenza. Si riempie da config.startsAt a config.endsAt (date ISO 8601). Per un timer imposta startsAt=adesso e endsAt=adesso+durata; per una scadenza startsAt=inizio del lavoro. title è l'etichetta.",
    fields: ["title", "subtitle", "config.startsAt", "config.endsAt"],
    sizes: "1×1 … 2×2",
  },
  {
    type: "file",
    description:
      "File caricato dall'utente (PDF con anteprima, altri formati come download). Gli agenti non possono caricare file: config.file è un percorso /uploads/… già esistente.",
    fields: ["title", "subtitle", "config.file"],
    sizes: "1×1 … 3×3",
  },
  {
    type: "performance",
    description:
      "Monitoraggio prestazioni di sistema in tempo reale (CPU, RAM, disco, carico e uptime del server).",
    fields: ["title", "subtitle"],
    sizes: "1×1 … 2×2",
  },
  {
    type: "ai_limits",
    description:
      "Tracciatore di limiti e quote Subscription AI (Claude, ChatGPT, Cursor, OpenRouter/Hermes). Ogni voce in config.items ha il formato 'Nome | NN% | Reset/Nota'.",
    fields: ["title", "subtitle", "config.items", "config.body"],
    sizes: "1×1 … 2×2",
  },
  {
    type: "radio",
    description:
      "Player radio streaming in diretta (preconfigurato per DJ Osso Radio). L'URL dello stream audio è in config.body e il sito della radio in url.",
    fields: ["title", "subtitle", "config.body", "url"],
    sizes: "1×1 … 2×2",
  },
].map((t) => ({
  ...t,
  appearance: {
    presets: Object.keys(presets),
    fields: {
      preset:
        "minimal | industrial | glass (applica i valori del preset, poi gli altri campi li sovrascrivono)",
      background: "#rrggbb",
      color: "#rrggbb (a video il testo è bianco o nero in base allo sfondo)",
      image: "URL HTTPS dell'immagine di sfondo, oppure vuoto",
      radius: "0–40",
      padding: "8–40",
      opacity: "0.25–1",
      border: "none | subtle | strong",
      font: "sans | mono | editorial | dot",
      fit: "cover | contain",
      imagePosition: "center | top | bottom",
      blur: "boolean",
    },
  },
}));

function applyFields(
  tile: Tile,
  input: PatchInput | UpsertInput,
  others: Tile[],
  grid: Desktop["settings"],
): Tile {
  const next: Tile = { ...tile };
  if (input.title !== undefined) next.title = input.title;
  if (input.subtitle !== undefined) next.subtitle = input.subtitle;
  if (input.url !== undefined) next.url = input.url;
  if (input.expiresAt !== undefined) next.expiresAt = input.expiresAt;
  if ("externalKey" in input && input.externalKey !== undefined)
    next.externalKey = input.externalKey;
  if (input.config) next.config = { ...tile.config, ...input.config };
  if (input.appearance) {
    const { preset, ...rest } = input.appearance;
    next.appearance = {
      ...tile.appearance,
      ...(preset ? presets[preset] : {}),
      ...rest,
    };
    // Text colour is derived from the background unless the caller sets both.
    if (rest.background && !rest.color)
      next.appearance.color = readableInk(next.appearance.background);
  }
  if (input.w !== undefined || input.h !== undefined) {
    if (tile.origin !== "agent")
      throw new TileError(
        403,
        "Le dimensioni delle tile create dall'utente non si modificano.",
      );
    next.w = input.w ?? tile.w;
    next.h = input.h ?? tile.h;
  }
  next.updatedAt = new Date().toISOString();
  if (!tileSizeAllowed(next))
    throw new TileError(
      400,
      `Dimensione massima per ${next.type}: ${tileSizeLimits[next.type].w} × ${tileSizeLimits[next.type].h}.`,
    );
  if (
    (input.w !== undefined || input.h !== undefined) &&
    (next.x + next.w > grid.columns ||
      next.y + next.h > grid.rows ||
      others.some((o) => overlaps(o, next)))
  )
    throw new TileError(409, "Non c'è spazio per le nuove dimensioni.");
  const parsed = tileSchema.safeParse(next);
  if (!parsed.success)
    throw new TileError(
      400,
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(" "),
    );
  return parsed.data;
}

const purge = (desktop: Desktop, now = Date.now()) => {
  const kept = desktop.tiles.filter(
    (t) => !t.expiresAt || Date.parse(t.expiresAt) > now,
  );
  const removed = kept.length !== desktop.tiles.length;
  desktop.tiles = kept;
  return removed;
};

/** Operations shared by the REST API and the MCP server. */
export class TileService {
  constructor(
    private store: Store,
    private vault?: VaultService,
  ) {}

  /** The desktop, after dropping tiles whose expiry has passed and syncing linked Vault files. */
  snapshot(): Snapshot {
    const current = this.store.get();
    const hasExpired = current.tiles.some(
      (t) => t.expiresAt && Date.parse(t.expiresAt) <= Date.now(),
    );
    const synced = this.vault?.syncFromDisk(current) ?? false;
    if (!hasExpired && !synced) return current;
    return this.store.mutate((d) => {
      purge(d);
      this.vault?.syncFromDisk(d);
    }).snapshot;
  }
  saveDesktop(next: Desktop, expectedRevision?: number): Snapshot {
    const previous = this.store.get();
    this.vault?.syncToDisk(previous, next);
    return this.store.save(next, expectedRevision ?? previous.revision);
  }
  list(): Tile[] {
    return this.snapshot().tiles;
  }
  get(id: string): Tile {
    const tile = this.list().find((t) => t.id === id);
    if (!tile) throw new TileError(404, "Tile non trovata.");
    return tile;
  }
  create(input: CreateInput): Tile {
    return this.store.mutate((desktop) => {
      const previous = structuredClone(desktop);
      purge(desktop);
      const created = this.insert(desktop, createInput.parse(input));
      this.vault?.syncToDisk(previous, desktop);
      return desktop.tiles.find((t) => t.id === created.id) ?? created;
    }).result;
  }
  update(id: string, input: PatchInput): Tile {
    patchInput.parse(input);
    return this.store.mutate((desktop) => {
      const previous = structuredClone(desktop);
      purge(desktop);
      const updated = this.change(desktop, id, input);
      this.vault?.syncToDisk(previous, desktop);
      return desktop.tiles.find((t) => t.id === updated.id) ?? updated;
    }).result;
  }
  /** Idempotent: updates the tile carrying this key, or creates it. */
  upsert(key: string, input: UpsertInput): { tile: Tile; created: boolean } {
    externalKeySchema.parse(key);
    upsertInput.parse(input);
    return this.store.mutate((desktop) => {
      const previous = structuredClone(desktop);
      purge(desktop);
      const existing = desktop.tiles.find((t) => t.externalKey === key);
      if (existing) {
        if (input.type && input.type !== existing.type)
          throw new TileError(
            409,
            `La tile con chiave “${key}” è di tipo ${existing.type}; eliminala per cambiarne il tipo.`,
          );
        const { type: _type, ...rest } = input;
        const updated = this.change(desktop, existing.id, rest);
        this.vault?.syncToDisk(previous, desktop);
        return {
          tile: desktop.tiles.find((t) => t.id === updated.id) ?? updated,
          created: false,
        };
      }
      if (!input.type)
        throw new TileError(400, "Per creare la tile serve il campo type.");
      const created = this.insert(desktop, {
        ...input,
        type: input.type,
        externalKey: key,
      });
      this.vault?.syncToDisk(previous, desktop);
      return {
        tile: desktop.tiles.find((t) => t.id === created.id) ?? created,
        created: true,
      };
    }).result;
  }
  remove(id: string): void {
    this.store.mutate((desktop) => {
      const previous = structuredClone(desktop);
      purge(desktop);
      const tile = desktop.tiles.find((t) => t.id === id);
      if (!tile) throw new TileError(404, "Tile non trovata.");
      if (tile.origin !== "agent")
        throw new TileError(
          403,
          "Gli agenti possono eliminare solo le tile create da un agente.",
        );
      desktop.tiles = desktop.tiles.filter((t) => t.id !== id);
      this.vault?.syncToDisk(previous, desktop);
    });
  }
  layout() {
    const { revision, tiles, settings } = this.snapshot();
    return {
      columns: settings.columns,
      rows: settings.rows,
      revision,
      tiles: tiles.map(
        ({ id, type, title, origin, externalKey, x, y, w, h }) => ({
          id,
          type,
          title,
          origin,
          externalKey,
          x,
          y,
          w,
          h,
        }),
      ),
    };
  }
  /** Moves agent-created tiles only; user tiles never move. */
  setLayout(input: z.infer<typeof layoutInput>) {
    layoutInput.parse(input);
    this.store.mutate((desktop) => {
      purge(desktop);
      for (const move of input.tiles) {
        const tile = desktop.tiles.find((t) => t.id === move.id);
        if (!tile) throw new TileError(404, `Tile ${move.id} non trovata.`);
        if (tile.origin !== "agent")
          throw new TileError(
            403,
            "Gli agenti non possono spostare le tile create dall'utente.",
          );
        tile.x = move.x;
        tile.y = move.y;
        tile.updatedAt = new Date().toISOString();
      }
      if (!desktopSchema.safeParse(desktop).success)
        throw new TileError(
          409,
          "Il layout proposto ha tile sovrapposte o fuori griglia.",
        );
    });
    return this.layout();
  }
  types() {
    return tileTypeDocs;
  }

  private insert(desktop: Desktop, input: CreateInput): Tile {
    const limit = tileSizeLimits[input.type];
    if ((input.w ?? 1) > limit.w || (input.h ?? 1) > limit.h)
      throw new TileError(
        400,
        `Dimensione massima per ${input.type}: ${limit.w} × ${limit.h}.`,
      );
    let tile: Tile;
    try {
      tile = createTile(
        input.type,
        desktop.tiles,
        input.w || input.h ? { w: input.w ?? 1, h: input.h ?? 1 } : undefined,
        desktop.settings.maxTiles,
        desktop.settings,
      );
    } catch (e) {
      throw new TileError(409, (e as Error).message);
    }
    tile.origin = "agent";
    tile.externalKey = input.externalKey ?? null;
    if (
      tile.externalKey &&
      desktop.tiles.some((t) => t.externalKey === tile.externalKey)
    )
      throw new TileError(409, "Esiste già una tile con questa chiave.");
    const { w: _w, h: _h, externalKey: _k, type: _t, ...rest } = input;
    const created = applyFields(tile, rest, [], desktop.settings);
    desktop.tiles.push(created);
    return created;
  }
  private change(desktop: Desktop, id: string, input: PatchInput): Tile {
    const index = desktop.tiles.findIndex((t) => t.id === id);
    if (index < 0) throw new TileError(404, "Tile non trovata.");
    const tile = desktop.tiles[index];
    if (
      input.externalKey &&
      desktop.tiles.some(
        (t) => t.id !== id && t.externalKey === input.externalKey,
      )
    )
      throw new TileError(409, "Esiste già una tile con questa chiave.");
    const updated = applyFields(
      tile,
      input,
      desktop.tiles.filter((t) => t.id !== id),
      desktop.settings,
    );
    desktop.tiles[index] = updated;
    return updated;
  }
}
