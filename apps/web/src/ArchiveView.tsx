import { useState } from "react";
import { Archive, RotateCcw } from "lucide-react";
import type { Tile } from "../../../packages/shared/model";

export function ArchiveView({
  tiles,
  onOpen,
  onRestore,
}: {
  tiles: Tile[];
  onOpen: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const [error, setError] = useState("");
  return (
    <div className="archive-view">
      {!tiles.length ? (
        <div className="archive-empty">
          <Archive size={28} />
          <p>Un posto per gli appunti da tenere.</p>
          <span>
            Archivia una nota o un TODO dalla tile per liberare spazio nel
            desktop.
          </span>
        </div>
      ) : (
        <ul>
          {tiles.map((tile) => (
            <li key={tile.id}>
              <button className="archive-open" onClick={() => onOpen(tile.id)}>
                <strong>{tile.title || "Senza titolo"}</strong>
                <small>
                  {tile.type === "text" ? "Nota" : "TODO"} ·{" "}
                  {new Intl.DateTimeFormat("it-IT", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(tile.updatedAt))}
                </small>
              </button>
              <button
                className="icon-button"
                aria-label={`Ripristina ${tile.title}`}
                title="Ripristina nel desktop"
                onClick={() => {
                  try {
                    onRestore(tile.id);
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <RotateCcw size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}
