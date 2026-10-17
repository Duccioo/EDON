import { useEffect, useRef, useState, type CSSProperties } from "react";
import { StickyNote } from "lucide-react";
import type { Desktop } from "../../../packages/shared/model";
import { fitBoard } from "../../../packages/shared/board";
import { TileView, tileStyle } from "./TileView";
import { AnimatedWallpaper } from "./AnimatedWallpaper";

export function AppearancePreview({
  settings,
  tiles,
}: Pick<Desktop, "settings" | "tiles">) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const board = fitBoard(tiles, 1120, 600, settings.gap, settings);
  const scale = Math.min((width - 32) / board.width, 240 / board.height);
  const background: CSSProperties = {
    backgroundColor: settings.background,
    backgroundImage:
      settings.wallpaper === "fold"
        ? "url(/art/wallpaper.svg)"
        : settings.wallpaper === "image" && settings.wallpaperImage
          ? `url("${settings.wallpaperImage}")`
          : settings.wallpaper === "gradient"
            ? `radial-gradient(ellipse at 15% 20%, #f7f7f2, transparent 65%),linear-gradient(135deg, ${settings.background}, #6d7470)`
            : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  return (
    <aside className="appearance-preview" aria-label="Anteprima aspetto">
      <div className="appearance-preview-heading">
        <span className="preview-live-dot" />
        <h3>Anteprima dal vivo</h3>
      </div>
      <p>Il tuo desktop, in piccolo. Ogni modifica è già visibile qui.</p>
      <div ref={ref} className="appearance-mini-desktop" style={background}>
        {(settings.wallpaper === "ascii" || settings.wallpaper === "noise") && (
          <AnimatedWallpaper
            kind={settings.wallpaper}
            background={settings.background}
            contained
          />
        )}
        <div
          aria-hidden="true"
          className="mini-board-frame"
          style={{
            width: board.width * scale,
            height: board.height * scale,
          }}
        >
          <div
            style={{
              position: "relative",
              width: board.width,
              height: board.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {Array.from(
              { length: settings.columns * settings.rows },
              (_, i) => (
                <span
                  key={`cell-${i}`}
                  className="preview-grid-cell"
                  style={{
                    position: "absolute",
                    left:
                      (i % settings.columns) * (board.cellWidth + board.gap),
                    top:
                      Math.floor(i / settings.columns) *
                      (board.cellHeight + board.gap),
                    width: board.cellWidth,
                    height: board.cellHeight,
                    borderRadius: settings.radius,
                  }}
                />
              ),
            )}
            {tiles.map((tile) => (
              <article
                key={tile.id}
                className={`tile tile-${tile.type} size-${tile.w}-${tile.h} font-${tile.appearance.font}`}
                style={{
                  ...tileStyle(tile, settings),
                  padding: settings.padding * board.density,
                  position: "absolute",
                  left: tile.x * (board.cellWidth + board.gap),
                  top: tile.y * (board.cellHeight + board.gap),
                  width: tile.w * board.cellWidth + (tile.w - 1) * board.gap,
                  height: tile.h * board.cellHeight + (tile.h - 1) * board.gap,
                }}
              >
                <div className="tile-preview">
                  <TileView tile={tile} editing toggleItem={() => {}} />
                </div>
              </article>
            ))}
          </div>
        </div>
        {!tiles.length && (
          <span className="preview-empty">
            Il tuo spazio è pronto per la prima tile.
          </span>
        )}
      </div>
      <div className="preview-metrics">
        <span>
          <strong>
            {settings.columns} × {settings.rows}
          </strong>{" "}
          griglia
        </span>
        <span>
          <strong>{settings.gap}px</strong> tra le tile
        </span>
        <span>
          <strong>
            {tiles.length} / {settings.maxTiles}
          </strong>{" "}
          tile
        </span>
      </div>
      <h4>Un dettaglio, da vicino</h4>
      <div className="appearance-detail-stage" style={background}>
        <div
          className="appearance-detail"
          style={{
            background: "#f3f3ed",
            color: "#1c201e",
            borderRadius: settings.radius,
            padding: settings.padding,
            opacity: settings.opacity,
            border:
              settings.border === "none"
                ? "1px solid transparent"
                : `${settings.border === "strong" ? 2 : 1}px solid #70776c`,
            backdropFilter: settings.blur ? "blur(24px)" : undefined,
            backgroundColor: settings.blur
              ? "color-mix(in srgb, #f3f3ed 78%, transparent)"
              : "#f3f3ed",
          }}
        >
          <StickyNote size={16} />
          <strong>Spazio alle tue idee</strong>
          <p>Angoli, bordo, vetro e spazio interno.</p>
        </div>
      </div>
      <p className="preview-save-hint">
        Le modifiche si salvano automaticamente. Nessun contenuto viene
        eliminato.
      </p>
    </aside>
  );
}
