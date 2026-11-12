import { useEffect, useRef, useState } from "react";
import {
  Blocks,
  Database,
  Download,
  Info,
  KeyRound,
  Palette,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Desktop, Snapshot } from "../../../packages/shared/model";
import { desktopSchema } from "../../../packages/shared/model";
import { seedDesktop } from "../../../packages/shared/seed";
import { request } from "./api";
import { GlobalSettings } from "./GlobalSettings";
import { AgentSettings } from "./AgentSettings";
import { AgentTokens } from "./AgentTokens";
import { VaultSettings } from "./VaultView";

export type SettingsSection =
  | "aspetto"
  | "agente"
  | "token"
  | "sicurezza"
  | "dati"
  | "integrazioni"
  | "info";
type Section = SettingsSection;

const sections: { id: Section; label: string; icon: typeof Palette }[] = [
  { id: "aspetto", label: "Aspetto", icon: Palette },
  { id: "agente", label: "Agente AI", icon: Sparkles },
  { id: "token", label: "Agenti e token", icon: KeyRound },
  { id: "sicurezza", label: "Sicurezza", icon: ShieldCheck },
  { id: "dati", label: "Dati e backup", icon: Database },
  { id: "integrazioni", label: "Integrazioni", icon: Blocks },
  { id: "info", label: "Info", icon: Info },
];

function SecurityPanel({ onNotice }: { onNotice: (m: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("Le due password non coincidono.");
      return;
    }
    setBusy(true);
    try {
      await request("/api/password", {
        method: "POST",
        body: JSON.stringify({ current, password: next }),
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      setError("");
      onNotice("Password aggiornata.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-panel">
      <h3>Password di accesso</h3>
      <p className="hint">
        La password protegge il desktop nel browser. Minimo 10 caratteri. Le
        sessioni esistenti restano valide dopo il cambio.
      </p>
      <form className="agent-form" onSubmit={submit}>
        <label>
          Password attuale
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          Nuova password
          <input
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label>
          Ripeti la nuova password
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="primary"
            type="submit"
            disabled={busy || !current || !next}
          >
            {busy ? "Salvataggio…" : "Aggiorna password"}
          </button>
        </div>
      </form>
      <h3>Sessione</h3>
      <p className="hint">
        L’accesso dura sette giorni su questo dispositivo. Su reti non fidate
        usa HTTPS o una VPN (vedi README).
      </p>
      <button
        onClick={() =>
          void request("/api/logout", { method: "POST" })
            .then(() => location.reload())
            .catch((e) => setError(e.message))
        }
      >
        Esci da questo dispositivo
      </button>
    </div>
  );
}

function DataPanel({
  desktop,
  onImport,
  onNotice,
}: {
  desktop: Snapshot;
  onImport: (d: Desktop) => void;
  onNotice: (m: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const tiles = desktop.tiles.length;
  const folders = desktop.tiles.filter((t) => t.type === "folder").length;
  const agentTiles = desktop.tiles.filter((t) => t.origin === "agent").length;
  function exportJson() {
    const blob = new Blob([JSON.stringify(desktop, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "edon-desktop-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
    onNotice("Backup esportato.");
  }
  async function importJson(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    try {
      const parsed = desktopSchema.safeParse(JSON.parse(await f.text()));
      if (!parsed.success) {
        onNotice(`Backup non valido: ${parsed.error.issues[0].message}`);
        return;
      }
      const confirmed = window.confirm(
        "Importare questo backup sostituirà tutte le tile e le cartelle attuali, inclusi i loro elementi figli. I file collegati nel Vault Obsidian non sono contenuti nel backup: i collegamenti attuali andranno persi e i file .md collegati possono essere spostati nel cestino del Vault. Continuare?",
      );
      if (!confirmed) return;
      onImport(parsed.data);
    } catch (e) {
      onNotice(`Backup non valido: ${(e as Error).message}`);
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  return (
    <div className="settings-panel">
      <h3>Panoramica</h3>
      <ul className="settings-stats">
        <li>
          <strong>{tiles}</strong>
          <span>tile (max 100)</span>
        </li>
        <li>
          <strong>{folders}</strong>
          <span>cartelle</span>
        </li>
        <li>
          <strong>{agentTiles}</strong>
          <span>tile degli agenti</span>
        </li>
        <li>
          <strong>#{desktop.revision}</strong>
          <span>revisione</span>
        </li>
      </ul>
      <h3>Backup</h3>
      <p className="hint">
        Esporta il desktop (impostazioni e tile) in JSON. Per un backup
        completo, a server spento, copia anche la directory <code>data/</code>{" "}
        con le immagini caricate.
      </p>
      <div className="settings-row">
        <button onClick={exportJson}>
          <Download size={16} />
          Esporta JSON
        </button>
        <label className="file-button inline-file">
          <Upload size={16} />
          Importa JSON
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void importJson(e.target.files)}
          />
        </label>
      </div>
      <h3 className="danger-zone-title">Zona pericolosa</h3>
      {!confirmReset ? (
        <button className="danger" onClick={() => setConfirmReset(true)}>
          <Trash2 size={16} />
          Ripristina il desktop iniziale
        </button>
      ) : (
        <div className="settings-row">
          <p className="hint">
            Sostituire tutte le tile con quelle di esempio? Verranno eliminati
            anche tutti gli elementi figli delle cartelle e i collegamenti ai
            file del Vault Obsidian. I file .md collegati possono essere
            spostati nel cestino del Vault.
          </p>
          <button onClick={() => setConfirmReset(false)}>Annulla</button>
          <button
            className="danger primary"
            onClick={() => {
              onImport(seedDesktop());
              setConfirmReset(false);
            }}
          >
            Ripristina
          </button>
        </div>
      )}
    </div>
  );
}

function IntegrationsPanel({ onVaultChange }: { onVaultChange?: () => void }) {
  return (
    <div className="settings-panel">
      <h3>Collegate</h3>
      <VaultSettings onChanged={onVaultChange} />
      <div className="integration-card">
        <strong>MCP e API per agenti</strong>
        <p className="hint">
          Hermes, Codex e script usano REST (<code>/api/tiles</code>) o MCP (
          <code>/mcp</code>) con un token dalla sezione “Agenti e token”. Vedi{" "}
          <code>docs/agents.md</code>.
        </p>
      </div>
      <h3>In arrivo</h3>
      <div className="integration-card upcoming">
        <strong>Paperless-ngx</strong>
        <span className="pill">Prossimamente</span>
        <p className="hint">
          Ricerca e anteprima dei documenti direttamente dalle tile.
        </p>
      </div>
      <div className="integration-card upcoming">
        <strong>Google Calendar</strong>
        <span className="pill">Prossimamente</span>
        <p className="hint">
          Tile agenda con i prossimi eventi, aggiornata dagli agenti.
        </p>
      </div>
    </div>
  );
}

function InfoPanel({ desktop }: { desktop: Snapshot }) {
  return (
    <div className="settings-panel">
      <h3>EDON</h3>
      <p className="hint">
        Desktop personale a tile, versione 0.1.0. Revisione dati #
        {desktop.revision}, {desktop.tiles.length} tile.
      </p>
      <h3>Scorciatoie</h3>
      <ul className="settings-list">
        <li>
          <kbd>E</kbd> attiva o esce dalla modifica
        </li>
        <li>
          <kbd>Esc</kbd> chiude viste, cartelle e impostazioni
        </li>
      </ul>
      <h3>Documentazione</h3>
      <ul className="settings-list">
        <li>
          <code>docs/api.md</code> — interfaccia HTTP e API agenti
        </li>
        <li>
          <code>docs/agents.md</code> — Hermes, MCP e chiavi stabili
        </li>
        <li>
          <code>docs/implementation.md</code> — decisioni e limiti
        </li>
        <li>
          <code>docs/verification.md</code> — esiti delle verifiche
        </li>
      </ul>
    </div>
  );
}

export function SettingsPage({
  settings,
  desktop,
  onChange,
  onImport,
  onClose,
  onNotice,
  onVaultChange,
  initial = "aspetto",
}: {
  settings: Desktop["settings"];
  desktop: Snapshot;
  onChange: (s: Desktop["settings"]) => boolean;
  onImport: (d: Desktop) => void;
  onClose: () => void;
  onNotice: (m: string) => void;
  onVaultChange?: () => void;
  initial?: Section;
}) {
  const [section, setSection] = useState<Section>(initial);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const current = dialog.current!;
    const opener = document.activeElement;
    current.showModal();
    current.querySelector<HTMLButtonElement>(".settings-nav button")?.focus();
    return () => {
      current.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="settings-page"
      role="dialog"
      aria-modal="true"
      aria-label="Impostazioni globali"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className={`settings-shell ${section === "aspetto" ? "settings-appearance" : ""}`}
      >
        <aside className="settings-nav" aria-label="Sezioni impostazioni">
          <div className="settings-nav-head">Impostazioni</div>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
          <button className="settings-close-nav" onClick={onClose}>
            <X size={17} />
            Torna al desktop
          </button>
        </aside>
        <div className="settings-main">
          <div className="panel-heading settings-heading">
            <div>
              <span className="small-label">EDON · Impostazioni</span>
              <h2>
                {sections.find((s) => s.id === section)?.label ??
                  "Impostazioni"}
              </h2>
            </div>
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Chiudi"
            >
              <X size={20} />
            </button>
          </div>
          <div className="settings-content">
            {section === "aspetto" && (
              <GlobalSettings
                settings={settings}
                tiles={desktop.tiles}
                onChange={onChange}
              />
            )}
            {section === "agente" && <AgentSettings />}
            {section === "token" && <AgentTokens />}
            {section === "sicurezza" && <SecurityPanel onNotice={onNotice} />}
            {section === "dati" && (
              <DataPanel
                desktop={desktop}
                onImport={onImport}
                onNotice={onNotice}
              />
            )}
            {section === "integrazioni" && (
              <IntegrationsPanel onVaultChange={onVaultChange} />
            )}
            {section === "info" && <InfoPanel desktop={desktop} />}
          </div>
        </div>
      </div>
    </dialog>
  );
}
