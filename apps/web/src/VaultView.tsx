import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Folder,
  FolderOpen,
  List,
  ListTodo,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { Desktop, Tile } from "../../../packages/shared/model";
import { request } from "./api";
import { MarkdownContent } from "./MarkdownContent";

export type VaultStatus = {
  configured: boolean;
  path: string;
  vaultName: string;
  folder: string;
  archiveFolder: string;
  noteCount: number;
  folders: string[];
  managedByEnvironment: {
    path: boolean;
    folder: boolean;
    archiveFolder: boolean;
  };
};

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

export function VaultSettings({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [path, setPath] = useState("");
  const [folder, setFolder] = useState("");
  const [archiveFolder, setArchiveFolder] = useState(".trash");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const show = (text: string, error = false) => {
    setMessage(text);
    setFailed(error);
  };

  useEffect(() => {
    request<VaultStatus>("/api/vault")
      .then((s) => {
        setStatus(s);
        setPath(s.path);
        setFolder(s.folder);
        setArchiveFolder(s.archiveFolder || ".trash");
      })
      .catch((e) => show((e as Error).message, true));
  }, []);

  if (!status) return null;
  const env = status.managedByEnvironment;

  return (
    <fieldset className="agent-settings">
      <legend>Obsidian Vault</legend>
      <p className="hint">
        Collega una cartella locale del tuo vault di Obsidian: le nuove note e i
        TODO creati in EDON vengono salvati come file <code>.md</code> puliti, e
        puoi esplorare, cercare o fissare sul desktop qualsiasi nota esistente.
        Con <code>OBSIDIAN_VAULT_PATH</code> nello stack Docker questo percorso
        è gestito dall’ambiente.
      </p>
      {status.configured && (
        <div className="vault-status-banner">
          <BookOpen size={16} />
          <span>
            Vault attivo: <strong>{status.vaultName}</strong> (
            {status.noteCount}{" "}
            {status.noteCount === 1 ? "nota .md" : "note .md"})
          </span>
        </div>
      )}
      <form
        className="agent-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const next = await request<VaultStatus>("/api/vault", {
              method: "PUT",
              body: JSON.stringify({ path, folder, archiveFolder }),
            });
            setStatus(next);
            show(
              next.configured
                ? `Vault “${next.vaultName}” collegato (${next.noteCount} note).`
                : "Collegamento al vault disattivato.",
            );
            onChanged?.();
          } catch (err) {
            show((err as Error).message, true);
          }
        }}
      >
        <label>
          Percorso del Vault sul disco
          <input
            value={path}
            disabled={env.path}
            placeholder="/Users/nome/Documents/ObsidianVault"
            onChange={(e) => setPath(e.target.value)}
          />
        </label>
        <label>
          Cartella predefinita per le nuove note di EDON
          <input
            value={folder}
            disabled={env.folder}
            placeholder="Vuoto = radice del vault (oppure es. EDON)"
            onChange={(e) => setFolder(e.target.value)}
          />
        </label>
        <label>
          Cartella Cestino / Archivio del Vault
          <input
            value={archiveFolder}
            disabled={env.archiveFolder}
            placeholder=".trash (oppure Archivio)"
            onChange={(e) => setArchiveFolder(e.target.value)}
          />
        </label>
        <div className="dialog-actions">
          {status.configured && !env.path && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const next = await request<VaultStatus>("/api/vault", {
                    method: "PUT",
                    body: JSON.stringify({
                      path: "",
                      folder,
                      archiveFolder,
                    }),
                  });
                  setStatus(next);
                  setPath("");
                  show("Vault scollegato.");
                  onChanged?.();
                } catch (err) {
                  show((err as Error).message, true);
                }
              }}
            >
              Scollega vault
            </button>
          )}
          <button className="primary" type="submit">
            Salva
          </button>
        </div>
      </form>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "error-text" : "hint"}
        >
          {message}
        </p>
      )}
    </fieldset>
  );
}

export function VaultView({
  desktop,
  initialFolder = "",
  initialPath = "",
  onPinNote,
  onUnpinNote,
  onPinFolder,
  onRefreshDesktop,
  onOpenSettings,
  onNotice,
}: {
  desktop: Desktop;
  initialFolder?: string;
  initialPath?: string;
  onPinNote: (note: VaultNoteDetail) => void;
  onUnpinNote: (tileId: string) => void;
  onPinFolder: (folderPath: string, title: string) => void;
  onRefreshDesktop: () => void;
  onOpenSettings: () => void;
  onNotice: (message: string) => void;
}) {
  const [vaultName, setVaultName] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [notes, setNotes] = useState<VaultNoteSummary[]>([]);
  const [activeFolder, setActiveFolder] = useState(
    initialFolder === "*" ? "" : initialFolder,
  );
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [detail, setDetail] = useState<VaultNoteDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showList, setShowList] = useState(true);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setActiveFolder(initialFolder === "*" ? "" : initialFolder);
  }, [initialFolder]);

  useEffect(() => {
    if (initialPath) setSelectedPath(initialPath);
  }, [initialPath]);

  const loadList = useCallback(
    async (keepSelection = true) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (activeFolder) params.set("folder", activeFolder);
        const res = await request<{
          vaultName: string;
          folders: string[];
          notes: VaultNoteSummary[];
        }>(`/api/vault/notes?${params.toString()}`);
        setVaultName(res.vaultName);
        setFolders(res.folders);
        setNotes(res.notes);
        setError("");
        if (!keepSelection || !selectedPath) {
          const first = res.notes[0]?.path ?? "";
          setSelectedPath(first);
        } else if (
          selectedPath &&
          !res.notes.some((n) => n.path === selectedPath)
        ) {
          setSelectedPath(res.notes[0]?.path ?? "");
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [activeFolder, query, selectedPath],
  );

  useEffect(() => {
    void loadList(true);
  }, [loadList]);

  useEffect(() => {
    if (!selectedPath || creating) {
      if (!creating) setDetail(null);
      return;
    }
    request<VaultNoteDetail>(
      `/api/vault/note?path=${encodeURIComponent(selectedPath)}`,
    )
      .then((d) => {
        setDetail(d);
        setEditing(false);
      })
      .catch((e) => setError((e as Error).message));
  }, [selectedPath, creating]);

  const pinnedTile = detail
    ? desktop.tiles.find((t) => t.config.vaultPath === detail.path)
    : undefined;

  const folderPinned = desktop.tiles.some(
    (t) =>
      t.type === "folder" &&
      t.config.vaultPath === (activeFolder ? activeFolder : "*"),
  );

  const startEdit = (note: VaultNoteDetail) => {
    const taskLines = note.items
      .map((i) => `- [${i.done ? "x" : " "}] ${i.text}`)
      .join("\n");
    const combined = [note.body, taskLines].filter(Boolean).join("\n\n");
    setDraftTitle(note.title);
    setDraftBody(combined);
    setEditing(true);
    setCreating(false);
  };

  const startCreate = () => {
    setDraftTitle("");
    setDraftBody("");
    setCreating(true);
    setEditing(true);
    setDetail(null);
  };

  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim()) return;
    try {
      const saved = await request<VaultNoteDetail>("/api/vault/note", {
        method: "PUT",
        body: JSON.stringify({
          path: creating ? undefined : detail?.path,
          folder: creating ? activeFolder : undefined,
          title: draftTitle.trim(),
          body: draftBody,
        }),
      });
      setCreating(false);
      setEditing(false);
      setSelectedPath(saved.path);
      setDetail(saved);
      await loadList(true);
      onRefreshDesktop();
      onNotice(creating ? "Nota creata nel vault." : "Nota salvata nel vault.");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleNoteItem = async (itemId: string) => {
    if (!detail) return;
    const updatedItems = detail.items.map((i) =>
      i.id === itemId ? { ...i, done: !i.done } : i,
    );
    try {
      const saved = await request<VaultNoteDetail>("/api/vault/note", {
        method: "PUT",
        body: JSON.stringify({
          path: detail.path,
          title: detail.title,
          body: detail.body,
          items: updatedItems,
        }),
      });
      setDetail(saved);
      await loadList(true);
      onRefreshDesktop();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteNote = async () => {
    if (!detail) return;
    try {
      await request(`/api/vault/note?path=${encodeURIComponent(detail.path)}`, {
        method: "DELETE",
      });
      setDetail(null);
      setSelectedPath("");
      await loadList(false);
      onRefreshDesktop();
      onNotice(`“${detail.title}” spostata nel cestino del vault.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (error && !vaultName && !loading) {
    return (
      <div className="archive-view">
        <div className="archive-empty">
          <BookOpen size={28} />
          <p>{error}</p>
          <button className="primary" onClick={onOpenSettings}>
            Configura Obsidian Vault
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`vault-explorer ${showList ? "" : "vault-reader-only"}`}>
      {showList && (
        <aside className="vault-sidebar" aria-label="Cartelle e note del vault">
          <div className="vault-search-row">
            <label className="vault-search">
              <Search size={15} />
              <input
                type="search"
                value={query}
                placeholder="Cerca nel vault…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              className="icon-button"
              title="Nuova nota nel vault"
              aria-label="Nuova nota nel vault"
              onClick={startCreate}
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="vault-folders" role="tablist" aria-label="Cartelle">
            <button
              role="tab"
              aria-selected={activeFolder === ""}
              className={activeFolder === "" ? "active" : ""}
              onClick={() => setActiveFolder("")}
            >
              {activeFolder === "" ? (
                <FolderOpen size={14} />
              ) : (
                <Folder size={14} />
              )}
              <span>Tutte ({vaultName || "Vault"})</span>
            </button>
            {folders.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={activeFolder === f}
                className={activeFolder === f ? "active" : ""}
                onClick={() => setActiveFolder(f)}
              >
                {activeFolder === f ? (
                  <FolderOpen size={14} />
                ) : (
                  <Folder size={14} />
                )}
                <span>{f}</span>
              </button>
            ))}
          </div>

          <div className="vault-folder-bar">
            <span>
              {notes.length} {notes.length === 1 ? "nota" : "note"}
            </span>
            {!folderPinned && (
              <button
                type="button"
                className="vault-pin-folder"
                onClick={() =>
                  onPinFolder(
                    activeFolder || "*",
                    activeFolder
                      ? activeFolder.split("/").pop()!
                      : vaultName || "Vault Obsidian",
                  )
                }
              >
                <Pin size={12} />
                Fissa {activeFolder ? "cartella" : "vault"}
              </button>
            )}
          </div>

          {notes.length === 0 ? (
            <div className="vault-empty-list">
              <p>Nessuna nota trovata.</p>
            </div>
          ) : (
            <ul className="vault-note-list">
              {notes.map((n) => {
                const isPinned = desktop.tiles.some(
                  (t) => t.config.vaultPath === n.path,
                );
                return (
                  <li key={n.path}>
                    <button
                      className={
                        selectedPath === n.path && !creating ? "active" : ""
                      }
                      onClick={() => {
                        setCreating(false);
                        setEditing(false);
                        setSelectedPath(n.path);
                      }}
                    >
                      <div className="vault-note-row-top">
                        {n.kind === "data" ? (
                          <ListTodo size={14} />
                        ) : (
                          <StickyNote size={14} />
                        )}
                        <strong>{n.title}</strong>
                        {isPinned && (
                          <span
                            className="vault-pinned-badge"
                            title="Presente sul desktop"
                          >
                            Sul desktop
                          </span>
                        )}
                      </div>
                      {n.excerpt && <p>{n.excerpt}</p>}
                      <small>
                        {n.folder ? `${n.folder} · ` : ""}
                        {n.taskCount > 0
                          ? `${n.doneCount}/${n.taskCount} · `
                          : ""}
                        {new Intl.DateTimeFormat("it-IT", {
                          day: "numeric",
                          month: "short",
                        }).format(new Date(n.updatedAt))}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      )}

      <section className="vault-reader" aria-label="Contenuto nota">
        {editing ? (
          <form className="vault-editor" onSubmit={saveNote}>
            <label>
              Titolo della nota
              <input
                value={draftTitle}
                maxLength={120}
                placeholder="Titolo…"
                required
                autoFocus
                onChange={(e) => setDraftTitle(e.target.value)}
              />
            </label>
            {draftBody.includes("\n") &&
              draftBody.slice(0, draftBody.lastIndexOf("\n")).trimEnd() && (
                <div
                  className="composer-live-markdown"
                  aria-label="Rendering Markdown in tempo reale"
                >
                  <span className="composer-live-badge">
                    Markdown renderizzato
                  </span>
                  <MarkdownContent
                    text={draftBody
                      .slice(0, draftBody.lastIndexOf("\n"))
                      .trimEnd()}
                  />
                </div>
              )}
            <label className="vault-editor-body">
              Contenuto Markdown (usa <code>- [ ]</code> per le voci spuntabili)
              <textarea
                rows={12}
                value={draftBody}
                placeholder="Scrivi in Markdown… (vai a capo per renderizzare)"
                onChange={(e) => setDraftBody(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setCreating(false);
                }}
              >
                Annulla
              </button>
              <button type="submit" className="primary">
                Salva nel vault
              </button>
            </div>
          </form>
        ) : detail ? (
          <>
            <header className="vault-reader-head">
              <div>
                <div className="vault-reader-meta">
                  <button
                    type="button"
                    className="vault-toggle-list"
                    onClick={() => setShowList((v) => !v)}
                    title={
                      showList ? "Nascondi elenco note" : "Mostra elenco note"
                    }
                  >
                    <List size={14} />
                    {showList ? "Solo documento" : "Elenco note"}
                  </button>
                  <span className="vault-note-path">{detail.path}</span>
                </div>
                <h3>{detail.title}</h3>
              </div>
              <div className="vault-reader-actions">
                {pinnedTile ? (
                  <button
                    type="button"
                    onClick={() => onUnpinNote(pinnedTile.id)}
                    title="Togli dal desktop (resta nel vault)"
                  >
                    <PinOff size={15} />
                    Togli dal desktop
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => onPinNote(detail)}
                  >
                    <Pin size={15} />
                    Fissa sul desktop
                  </button>
                )}
                <button type="button" onClick={() => startEdit(detail)}>
                  <Pencil size={15} />
                  Modifica
                </button>
                <a
                  className="button-link"
                  href={detail.obsidianUrl}
                  title="Apri nell’app Obsidian"
                >
                  Obsidian <ArrowUpRight size={14} />
                </a>
                <button
                  type="button"
                  className="danger"
                  title="Sposta nel cestino del vault"
                  aria-label={`Cestina ${detail.title}`}
                  onClick={deleteNote}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </header>
            <div
              className="vault-reader-body"
              title="Doppio clic per modificare la nota"
              onDoubleClick={() => startEdit(detail)}
            >
              {detail.body && <MarkdownContent text={detail.body} />}
              {detail.items.length > 0 && (
                <ul className="checklist">
                  {detail.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`check-item ${item.done ? "checked" : ""}`}
                        onClick={() => void toggleNoteItem(item.id)}
                      >
                        <span
                          className={`checkbox ${item.done ? "is-done" : ""}`}
                        >
                          {item.done && <Check size={12} />}
                        </span>
                        <span>{item.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!detail.body && detail.items.length === 0 && (
                <p className="hint">
                  Questa nota è vuota. Doppio clic per scrivere.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="archive-empty">
            <BookOpen size={28} />
            <p>Seleziona una nota dal vault o creane una nuova.</p>
            <button type="button" className="primary" onClick={startCreate}>
              <Plus size={16} />
              Nuova nota nel vault
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
