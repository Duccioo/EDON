import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Trash2,
  X,
} from "lucide-react";
import {
  presets,
  readableInk,
  tileSchema,
  tileSizeLimits,
  type Appearance,
  type Tile,
} from "../../../packages/shared/model";
import { upload, uploadFile } from "./api";
import { ColorPalette } from "./ColorPalette";
/** An ISO instant as the value of a datetime-local input (device time zone). */
const toLocalInput = (iso: string) => {
  const t = Date.parse(iso);
  if (!t) return "";
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};
const timers = [
  [5, "5 min"],
  [15, "15 min"],
  [25, "25 min"],
  [60, "1 ora"],
] as const;

export function Inspector({
  tile,
  canDuplicate,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
  onClose,
  onOpenFolder,
}: {
  tile: Tile;
  canDuplicate: boolean;
  onChange: (value: Tile) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dx: number, dy: number) => void;
  onClose: () => void;
  onOpenFolder?: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const patch = (value: Partial<Tile>) => {
    const next = { ...tile, ...value, updatedAt: new Date().toISOString() };
    const parsed = tileSchema.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError("");
    onChange(parsed.data);
  };
  // The text colour follows the background on its own: white on dark, black on light.
  const appearance = (value: Partial<Appearance>) =>
    patch({
      appearance: {
        ...tile.appearance,
        ...value,
        ...(value.background ? { color: readableInk(value.background) } : {}),
      },
    });
  async function replaceFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const stored = await uploadFile(file);
      patch({
        config: { ...tile.config, file: stored.url },
        title: tile.title === "Nuovo file" ? stored.name : tile.title,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const setConfig = (value: Partial<Tile["config"]>) =>
    patch({ config: { ...tile.config, ...value } });
  async function fileChange(file?: File, background = false) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await upload(file);
      if (background) appearance({ image: url });
      else patch({ config: { ...tile.config, image: url } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside
      className="inspector"
      aria-label="Proprietà della tile"
      key={tile.id}
    >
      <div className="panel-heading">
        <div>
          <span className="small-label">Personalizza</span>
          <h2>{tile.title || "Tile"}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Chiudi proprietà"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <div className="inspector-content">
        <label>
          Titolo
          <input
            value={tile.title}
            maxLength={120}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <label>
          Sottotitolo
          <input
            value={tile.subtitle}
            maxLength={250}
            onChange={(e) => patch({ subtitle: e.target.value })}
          />
        </label>
        <fieldset>
          <legend>Dimensioni e posizione</legend>
          <div className="sizes">
            {Array.from(
              {
                length:
                  tileSizeLimits[tile.type].w *
                  Math.min(3, tileSizeLimits[tile.type].h),
              },
              (_, i) => [
                (i % tileSizeLimits[tile.type].w) + 1,
                Math.floor(i / tileSizeLimits[tile.type].w) + 1,
              ],
            ).map(([w, h]) => (
              <button
                key={`${w}${h}`}
                className={tile.w === w && tile.h === h ? "active" : ""}
                onClick={() => patch({ w, h })}
              >
                {w} × {h}
              </button>
            ))}
          </div>
          {(tile.type === "text" || tile.type === "data") && (
            <label>
              Altezza in righe
              <input
                type="number"
                min={1}
                max={128}
                value={tile.h}
                onChange={(e) => {
                  if (e.target.value) patch({ h: +e.target.value });
                }}
              />
            </label>
          )}
          <p className="hint">
            Massimo {tileSizeLimits[tile.type].w} ×{" "}
            {tileSizeLimits[tile.type].h} per questo tipo di tile.
          </p>
          <div className="move-buttons">
            {[
              [ArrowLeft, -1, 0, "Sposta a sinistra"],
              [ArrowUp, 0, -1, "Sposta in alto"],
              [ArrowDown, 0, 1, "Sposta in basso"],
              [ArrowRight, 1, 0, "Sposta a destra"],
            ].map(([Icon, dx, dy, label]) => {
              const I = Icon as typeof ArrowLeft;
              return (
                <button
                  key={String(label)}
                  aria-label={String(label)}
                  onClick={() => onMove(Number(dx), Number(dy))}
                >
                  <I size={16} />
                </button>
              );
            })}
          </div>
        </fieldset>
        {tile.type === "folder" && (
          <fieldset>
            <legend>Contenuto</legend>
            <label>
              Cartella Vault Obsidian (opzionale)
              <input
                defaultValue={tile.config.vaultPath}
                key={`${tile.id}-vault`}
                placeholder="Vuoto = cartella normale, * = tutto il vault, o percorso"
                onBlur={(e) => setConfig({ vaultPath: e.target.value.trim() })}
              />
              <small>
                Usa <code>*</code> per aprire l’intero vault oppure il nome di
                una sottocartella (es. <code>Progetti</code>).
              </small>
            </label>
            <p className="hint">
              {tile.config.vaultPath
                ? "Questa cartella apre direttamente Esplora Vault."
                : (tile.config.children ?? []).length === 0
                  ? "La cartella è vuota."
                  : `${(tile.config.children ?? []).length} element${(tile.config.children ?? []).length === 1 ? "o" : "i"} organizzati qui dentro.`}
            </p>
            {onOpenFolder && (
              <button onClick={onOpenFolder}>
                {tile.config.vaultPath
                  ? "Esplora nel Vault"
                  : "Apri la cartella"}
              </button>
            )}
          </fieldset>
        )}
        {(tile.type === "text" || tile.type === "data") && (
          <label>
            File nel Vault Obsidian
            <input
              defaultValue={tile.config.vaultPath}
              key={`${tile.id}-vault-note`}
              placeholder="es. Note/Idea.md (automatico se il vault è attivo)"
              onBlur={(e) => setConfig({ vaultPath: e.target.value.trim() })}
            />
          </label>
        )}
        {tile.type === "link" && (
          <label>
            Icona o simbolo
            <input
              value={tile.config.icon}
              maxLength={12}
              onChange={(e) =>
                patch({ config: { ...tile.config, icon: e.target.value } })
              }
            />
          </label>
        )}
        {(tile.type === "link" ||
          tile.type === "image" ||
          tile.type === "file" ||
          tile.type === "data" ||
          tile.type === "radio") && (
          <label>
            Destinazione
            <input
              defaultValue={tile.url}
              key={`${tile.id}-url`}
              placeholder="https://… oppure obsidian://…"
              onBlur={(e) => patch({ url: e.target.value })}
            />
          </label>
        )}
        {tile.type === "radio" && (
          <label>
            URL stream audio
            <input
              defaultValue={tile.config.body}
              key={`${tile.id}-stream`}
              placeholder="https://stream.rcs.revma.com/x3ab37sgn7uvv"
              onBlur={(e) => setConfig({ body: e.target.value.trim() })}
            />
            <small>
              Lascia predefinito per lo streaming ufficiale di DJ Osso Radio.
            </small>
          </label>
        )}
        {tile.type === "ai_limits" && (
          <fieldset>
            <legend>Subscription AI</legend>
            <label>
              Quote AI (Nome | % | Reset)
              <textarea
                rows={4}
                defaultValue={tile.config.items
                  .map((i) => i.text)
                  .join("\n")}
                key={`${tile.id}-${tile.config.items.map((i) => i.text).join("|")}`}
                placeholder="Claude Max | 65% | Reset 5h"
                onBlur={(e) =>
                  setConfig({
                    items: e.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .slice(0, 30)
                      .map((text, i) => ({
                        id: `ai-${i}`,
                        done: false,
                        text,
                      })),
                  })
                }
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setConfig({
                  items: tile.config.items.map((item) => ({
                    ...item,
                    done: false,
                    text: item.text.replace(/\|\s*\d{1,3}\s*%/, "| 0%"),
                  })),
                })
              }
            >
              Azzera tutte le quote
            </button>
          </fieldset>
        )}
        {(tile.type === "text" ||
          tile.type === "data" ||
          tile.type === "image") && (
          <label>
            {tile.type === "image" ? "Didascalia" : "Testo"}
            <textarea
              rows={4}
              value={tile.config.body}
              onChange={(e) =>
                patch({ config: { ...tile.config, body: e.target.value } })
              }
            />
          </label>
        )}
        {tile.type === "clock" && (
          <label>
            Fuso orario
            <input
              defaultValue={tile.config.timezone}
              key={`${tile.id}-zone`}
              placeholder="Asia/Tokyo, Europe/Rome…"
              onBlur={(e) =>
                patch({ config: { ...tile.config, timezone: e.target.value } })
              }
            />
            <small>Vuoto per usare l’ora del dispositivo.</small>
          </label>
        )}
        {tile.type === "weather" && (
          <label>
            Città
            <input
              defaultValue={tile.config.location}
              key={`${tile.id}-city`}
              placeholder="Firenze, New York…"
              maxLength={100}
              onBlur={(e) => setConfig({ location: e.target.value.trim() })}
            />
            <small>Dati Open-Meteo, aggiornati ogni 10 minuti.</small>
          </label>
        )}
        {tile.type === "progress" && (
          <fieldset>
            <legend>Tempo</legend>
            <div className="sizes" role="group" aria-label="Avvia un timer">
              {timers.map(([minutes, label]) => (
                <button
                  key={minutes}
                  onClick={() => {
                    const now = Date.now();
                    setConfig({
                      startsAt: new Date(now).toISOString(),
                      endsAt: new Date(now + minutes * 60_000).toISOString(),
                    });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label>
              Inizio
              <input
                type="datetime-local"
                defaultValue={toLocalInput(tile.config.startsAt)}
                key={`${tile.id}-${tile.config.startsAt}-start`}
                onBlur={(e) =>
                  setConfig({
                    startsAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  })
                }
              />
            </label>
            <label>
              Scadenza
              <input
                type="datetime-local"
                defaultValue={toLocalInput(tile.config.endsAt)}
                key={`${tile.id}-${tile.config.endsAt}-end`}
                onBlur={(e) =>
                  setConfig({
                    endsAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  })
                }
              />
            </label>
            <p className="hint">
              La barra si riempie dall’inizio alla scadenza. Senza inizio parte
              dalla creazione della tile.
            </p>
          </fieldset>
        )}
        {tile.type === "file" && (
          <label className="file-button">
            {busy
              ? "Caricamento…"
              : tile.config.file
                ? "Sostituisci il file"
                : "Carica un file"}
            <input
              type="file"
              disabled={busy}
              onChange={(e) => void replaceFile(e.target.files?.[0])}
            />
          </label>
        )}
        {tile.type === "image" && (
          <>
            <label>
              Immagine
              <input
                defaultValue={tile.config.image}
                key={`${tile.id}-image`}
                placeholder="URL HTTPS"
                onBlur={(e) =>
                  patch({ config: { ...tile.config, image: e.target.value } })
                }
              />
            </label>
            <label className="file-button">
              {busy ? "Caricamento…" : "Carica immagine o GIF"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                disabled={busy}
                onChange={(e) => void fileChange(e.target.files?.[0])}
              />
            </label>
          </>
        )}
        {tile.type === "data" && (
          <label>
            Elenco (una voce per riga)
            <textarea
              rows={4}
              defaultValue={tile.config.items
                .map((i) => `${i.done ? "[x] " : ""}${i.text}`)
                .join("\n")}
              key={`${tile.id}-items`}
              onBlur={(e) =>
                patch({
                  config: {
                    ...tile.config,
                    items: e.target.value
                      .split("\n")
                      .filter(Boolean)
                      .map((text, i) => ({
                        id: String(i),
                        done: text.startsWith("[x] "),
                        text: text.replace(/^\[x\] /, ""),
                      })),
                  },
                })
              }
            />
          </label>
        )}
        <fieldset>
          <legend>Aspetto</legend>
          <div className="presets">
            {Object.entries(presets).map(([name, value]) => (
              <button
                key={name}
                style={{ background: value.background, color: value.color }}
                className={tile.appearance.preset === name ? "active" : ""}
                onClick={() => patch({ appearance: { ...value } })}
              >
                {
                  {
                    minimal: "Minimal",
                    industrial: "Dot / Industrial",
                    glass: "Soft Glass",
                  }[name as Appearance["preset"]]
                }
              </button>
            ))}
          </div>
          <ColorPalette
            value={tile.appearance.background}
            label="Colori della tile"
            onSelect={({ background, color }) =>
              appearance({ background, color })
            }
          />
          <details className="custom-colors">
            <summary>Colore personalizzato</summary>
            <div className="field-row">
              <label>
                Sfondo
                <input
                  type="color"
                  value={tile.appearance.background}
                  onChange={(e) => appearance({ background: e.target.value })}
                />
              </label>
            </div>
          </details>
          <label>
            Tipografia
            <select
              value={tile.appearance.font}
              onChange={(e) =>
                appearance({ font: e.target.value as Appearance["font"] })
              }
            >
              <option value="sans">Essenziale</option>
              <option value="mono">Monospace</option>
              <option value="editorial">Editoriale</option>
              <option value="dot">Dot matrix</option>
            </select>
          </label>
          <p className="hint">
            Forma, bordi e spazi interni si regolano nelle impostazioni globali.
          </p>
          <label>
            Immagine di sfondo
            <input
              defaultValue={tile.appearance.image}
              key={`${tile.id}-background`}
              placeholder="URL HTTPS"
              onBlur={(e) => appearance({ image: e.target.value })}
            />
          </label>
          <label className="file-button">
            Carica sfondo
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              disabled={busy}
              onChange={(e) => void fileChange(e.target.files?.[0], true)}
            />
          </label>
          <div className="field-row">
            <label>
              Adatta
              <select
                value={tile.appearance.fit}
                onChange={(e) =>
                  appearance({ fit: e.target.value as Appearance["fit"] })
                }
              >
                <option value="cover">Riempi</option>
                <option value="contain">Contieni</option>
              </select>
            </label>
            <label>
              Posizione
              <select
                value={tile.appearance.imagePosition}
                onChange={(e) =>
                  appearance({
                    imagePosition: e.target
                      .value as Appearance["imagePosition"],
                  })
                }
              >
                <option value="center">Centro</option>
                <option value="top">Alto</option>
                <option value="bottom">Basso</option>
              </select>
            </label>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="inspector-actions">
          <button
            onClick={onDuplicate}
            disabled={!canDuplicate}
            title={
              !canDuplicate
                ? "Nessun posto disponibile: modifica griglia o limite in Aspetto"
                : undefined
            }
          >
            <Copy size={15} />
            Duplica
          </button>
          <button className="danger" onClick={onDelete}>
            <Trash2 size={15} />
            Elimina
          </button>
        </div>
      </div>
    </aside>
  );
}
