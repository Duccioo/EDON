import { useState } from "react";
import type { Desktop } from "../../../packages/shared/model";
import { upload } from "./api";
import { AppearancePreview } from "./AppearancePreview";
import { ColorPalette } from "./ColorPalette";

export function GlobalSettings({
  settings,
  tiles,
  onChange,
}: {
  settings: Desktop["settings"];
  tiles: Desktop["tiles"];
  onChange: (s: Desktop["settings"]) => boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const patch = (value: Partial<Desktop["settings"]>) => {
    const accepted = onChange({ ...settings, ...value });
    setError(
      accepted
        ? ""
        : "Le tile non entrano in questa griglia. Aumenta righe o colonne, oppure riduci le dimensioni delle tile.",
    );
  };
  const limits = [
    ...new Set([6, 12, 18, 24, 36, 48, 72, 100, settings.maxTiles]),
  ].sort((a, b) => a - b);
  return (
    <div className="appearance-layout">
      <div className="wallpaper-form appearance-controls">
        <fieldset>
          <legend>Composizione</legend>
          <p className="hint">
            Il desktop completo si adatta alla finestra, lasciando libero lo
            spazio per i comandi.
          </p>
          <div className="grid-dimensions">
            <label>
              Colonne (orizzontali)
              <select
                value={settings.columns}
                onChange={(e) => patch({ columns: +e.target.value })}
              >
                {Array.from({ length: 11 }, (_, i) => i + 2).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Righe (verticali)
              <select
                value={settings.rows}
                onChange={(e) => patch({ rows: +e.target.value })}
              >
                {[
                  ...new Set([
                    ...Array.from({ length: 11 }, (_, i) => i + 2),
                    settings.rows,
                  ]),
                ]
                  .sort((a, b) => a - b)
                  .map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className="hint">
            {settings.columns} × {settings.rows} ={" "}
            {settings.columns * settings.rows} celle. Una tile 2 × 2 occupa
            quattro celle. Se serve, le tile vengono ridisposte senza cambiare
            dimensioni o contenuto.
          </p>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <label>
            Spazio tra le tile <span>{settings.gap}px</span>
            <input
              type="range"
              min={0}
              max={40}
              value={settings.gap}
              onChange={(e) => patch({ gap: +e.target.value })}
            />
          </label>
          <div
            className="spacing-presets"
            role="group"
            aria-label="Distanze pronte"
          >
            {[
              [8, "Compatta"],
              [16, "Equilibrata"],
              [28, "Aria"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={settings.gap === value}
                onClick={() => patch({ gap: Number(value) })}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="hint">
            Più righe o colonne imposti, più piccole saranno le celle.
          </p>
          <label>
            Limite tile
            <select
              value={settings.maxTiles}
              onChange={(e) => patch({ maxTiles: +e.target.value })}
            >
              {limits.map((value) => (
                <option
                  key={value}
                  value={value}
                  disabled={value < tiles.length}
                >
                  {value} tile{value < tiles.length ? " — già superato" : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">
            {tiles.length} tile presenti. Il limite riguarda il desktop, incluse
            le tile degli agenti. Il contenuto delle cartelle non occupa altri
            posti. Nessuna tile viene rimossa abbassando il limite.
          </p>
        </fieldset>
        <fieldset>
          <legend>Forma delle tile</legend>
          <label>
            Angoli <span>{settings.radius}px</span>
            <input
              type="range"
              min={0}
              max={40}
              value={settings.radius}
              onChange={(e) => patch({ radius: +e.target.value })}
            />
          </label>
          <label>
            Bordo
            <select
              aria-label="Bordo"
              value={settings.border}
              onChange={(e) =>
                patch({
                  border: e.target.value as Desktop["settings"]["border"],
                })
              }
            >
              <option value="none">Nessuno</option>
              <option value="subtle">Sottile</option>
              <option value="strong">Marcato</option>
            </select>
          </label>
          <label>
            Spazio interno <span>{settings.padding}px</span>
            <input
              type="range"
              min={8}
              max={40}
              value={settings.padding}
              onChange={(e) => patch({ padding: +e.target.value })}
            />
          </label>
          <label>
            Opacità <span>{Math.round(settings.opacity * 100)}%</span>
            <input
              type="range"
              min={25}
              max={100}
              value={settings.opacity * 100}
              onChange={(e) => patch({ opacity: +e.target.value / 100 })}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.blur}
              onChange={(e) => patch({ blur: e.target.checked })}
            />
            Effetto vetro
          </label>
          <p className="hint">
            Forma, bordo e spazio interno sono uguali per tutte le tile.
          </p>
        </fieldset>
        <fieldset>
          <legend>Sfondo del desktop</legend>
          <ColorPalette
            value={settings.background}
            label="Colori di sfondo"
            onSelect={({ background }) =>
              patch({
                background,
                wallpaper:
                  settings.wallpaper === "gradient" ? "gradient" : "solid",
              })
            }
          />
          <div className="wallpaper-choices">
            {(["fold", "solid", "gradient", "image"] as const).map(
              (value, i) => (
                <button
                  aria-pressed={settings.wallpaper === value}
                  className={settings.wallpaper === value ? "active" : ""}
                  key={value}
                  onClick={() => patch({ wallpaper: value })}
                >
                  <span
                    className={`wallpaper-preview preview-${value}`}
                    style={{ backgroundColor: settings.background }}
                  />
                  {["Pieghe", "Tinta unita", "Gradiente", "Immagine"][i]}
                </button>
              ),
            )}
          </div>
          <details className="custom-colors">
            <summary>Colore personalizzato</summary>
            <label>
              Colore di base
              <input
                type="color"
                value={settings.background}
                onChange={(e) =>
                  patch({
                    background: e.target.value,
                    wallpaper:
                      settings.wallpaper === "gradient" ? "gradient" : "solid",
                  })
                }
              />
            </label>
          </details>
          <label className="file-button">
            {busy ? "Caricamento…" : "Carica uno sfondo"}
            <input
              type="file"
              disabled={busy}
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  const url = await upload(file);
                  patch({ wallpaperImage: url, wallpaper: "image" });
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <p className="hint">PNG, JPEG, WebP o GIF. Fino a 10 MB.</p>
        </fieldset>
        <fieldset>
          <legend>Il tuo spazio</legend>
          <label>
            Nome del desktop
            <input
              value={settings.name}
              maxLength={60}
              onChange={(e) => {
                if (e.target.value) patch({ name: e.target.value });
              }}
            />
          </label>
        </fieldset>
      </div>
      <AppearancePreview settings={settings} tiles={tiles} />
    </div>
  );
}
