import { useEffect, useState } from "react";
import {
  Archive,
  BookOpen,
  Check,
  Keyboard,
  LayoutGrid,
  Minimize2,
  Pencil,
  Plus,
  Settings2,
} from "lucide-react";
import type { Capture } from "../../../packages/shared/capture";
import { CaptureComposer } from "./CaptureComposer";

export function DesktopTools({
  editing,
  onEdit,
  onAdd,
  onSettings,
  onCompact,
  onArchive,
  archiveCount,
  onVault,
  vaultConfigured,
  vaultCount,
  onShortcuts,
  onSaveCapture,
  onHeightChange,
}: {
  editing: boolean;
  onEdit: () => void;
  onAdd: () => void;
  onSettings: () => void;
  onCompact: () => void;
  onArchive: () => void;
  archiveCount: number;
  onVault: () => void;
  vaultConfigured: boolean;
  vaultCount: number;
  onShortcuts: () => void;
  onSaveCapture: (capture: Capture) => void;
  onHeightChange: (height: number) => void;
}) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    // Reserve the compact dock height up front. Growing content overlays the bottom
    // instead of shrinking the desktop grid by a few pixels when controls appear.
    onHeightChange(64);
  }, [onHeightChange]);
  return (
    <nav className="desktop-tools capture-tools" aria-label="Strumenti desktop">
      <div className="tool-actions">
        {editing && (
          <>
            <button
              onClick={onCompact}
              aria-label="Compatta tile"
              title="Compatta tile"
            >
              <Minimize2 size={18} />
            </button>
            <button
              onClick={onEdit}
              className="tool-active"
              aria-label="Fine"
              title="Fine (E / Esc)"
            >
              <Check size={20} />
            </button>
          </>
        )}
        <div
          className="more-actions"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setMore(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setMore(false);
            }
          }}
        >
          {more && (
            <div className="more-menu" role="group" aria-label="Azioni">
              <button
                onClick={() => {
                  setMore(false);
                  onAdd();
                }}
                aria-label="Aggiungi tile"
              >
                <LayoutGrid size={18} />
                <span>Aggiungi tile</span>
              </button>
              {!editing && (
                <button
                  onClick={() => {
                    setMore(false);
                    onEdit();
                  }}
                  aria-label="Modifica"
                >
                  <Pencil size={18} />
                  <span>Modifica tile</span>
                </button>
              )}
              <button
                onClick={() => {
                  setMore(false);
                  onVault();
                }}
                aria-label="Esplora Vault"
              >
                <BookOpen size={18} />
                <span>
                  Esplora Vault{vaultConfigured ? ` (${vaultCount})` : ""}
                </span>
              </button>
              {!vaultConfigured && (
                <button
                  onClick={() => {
                    setMore(false);
                    onArchive();
                  }}
                  aria-label="Archivio"
                >
                  <Archive size={18} />
                  <span>
                    Archivio{archiveCount ? ` (${archiveCount})` : ""}
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  setMore(false);
                  onShortcuts();
                }}
                aria-label="Scorciatoie da tastiera"
              >
                <Keyboard size={18} />
                <span>Scorciatoie (?)</span>
              </button>
              <button
                onClick={() => {
                  setMore(false);
                  onSettings();
                }}
                aria-label="Impostazioni globali"
              >
                <Settings2 size={18} />
                <span>Impostazioni</span>
              </button>
            </div>
          )}
          <button
            aria-label="Altre azioni"
            aria-expanded={more}
            className={more ? "tool-active" : ""}
            onClick={() => setMore(!more)}
            title="Altre azioni"
          >
            <Plus size={22} className={more ? "plus-open" : ""} />
          </button>
        </div>
      </div>
      <CaptureComposer compact detectLinks onSave={onSaveCapture} />
    </nav>
  );
}
