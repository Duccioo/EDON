import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  CornerUpLeft,
  Image as ImageIcon,
  Link2,
  ListTodo,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import {
  tileSchema,
  type FolderChild,
  type FolderChildType,
  type Tile,
} from "../../../packages/shared/model";
import { TileView } from "./TileView";

const typeGlyph: Record<FolderChildType, typeof Link2> = {
  link: Link2,
  text: StickyNote,
  data: ListTodo,
  image: ImageIcon,
  clock: Clock3,
};
const typeLabel: Record<FolderChildType, string> = {
  link: "Link",
  text: "Nota",
  data: "Lista",
  image: "Immagine",
  clock: "Orologio",
};

function asTile(child: FolderChild): Tile {
  return {
    ...child,
    config: { ...child.config, children: [] },
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    origin: "user",
    expiresAt: null,
    externalKey: null,
  };
}

function ChildEditor({
  child,
  onSave,
  onCancel,
}: {
  child: FolderChild;
  onSave: (next: FolderChild) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(child.title);
  const [subtitle, setSubtitle] = useState(child.subtitle);
  const [url, setUrl] = useState(child.url);
  const [body, setBody] = useState(child.config.body);
  const [timezone, setTimezone] = useState(child.config.timezone);
  const [items, setItems] = useState(
    child.config.items
      .map((i) => `${i.done ? "[x] " : ""}${i.text}`)
      .join("\n"),
  );
  const [error, setError] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = tileSchema.shape.config.omit({ children: true }).safeParse({
      body,
      icon: child.config.icon,
      image: child.config.image,
      timezone,
      items: items
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 30)
        .map((line) => ({
          id: crypto.randomUUID(),
          done: /^\[x\] /i.test(line),
          text: line.replace(/^\[x\] /i, "").slice(0, 300),
        })),
    });
    if (title.trim().length > 120) {
      setError("Il titolo è troppo lungo (max 120).");
      return;
    }
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (
      url &&
      !/^(https:|http:|obsidian:)/.test(url) &&
      child.type === "link"
    ) {
      setError("Usa un URL http, https o obsidian.");
      return;
    }
    onSave({
      ...child,
      title: title.trim() || child.title,
      subtitle: subtitle.trim().slice(0, 250),
      url: url.trim().slice(0, 2048),
      config: parsed.data,
      updatedAt: new Date().toISOString(),
    });
  }
  return (
    <form className="child-editor" onSubmit={submit}>
      <label>
        Titolo
        <input
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Sottotitolo
        <input
          value={subtitle}
          maxLength={250}
          placeholder="Facoltativo"
          onChange={(e) => setSubtitle(e.target.value)}
        />
      </label>
      {(child.type === "link" || child.type === "data") && (
        <label>
          Destinazione
          <input
            value={url}
            placeholder="https://… oppure obsidian://…"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      )}
      {child.type === "clock" && (
        <label>
          Fuso orario
          <input
            value={timezone}
            placeholder="Europe/Rome… (vuoto = locale)"
            onChange={(e) => setTimezone(e.target.value)}
          />
        </label>
      )}
      {(child.type === "text" || child.type === "data") && (
        <label>
          {child.type === "text" ? "Testo" : "Voci (una per riga)"}
          <textarea
            rows={4}
            value={child.type === "text" ? body : items}
            onChange={(e) =>
              child.type === "text"
                ? setBody(e.target.value)
                : setItems(e.target.value)
            }
          />
        </label>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="child-editor-actions">
        <button type="button" onClick={onCancel}>
          Annulla
        </button>
        <button type="submit" className="primary">
          Salva
        </button>
      </div>
    </form>
  );
}

export function FolderView({
  folder,
  available,
  onChange,
  onMoveIn,
  onMoveOut,
  onNotice,
}: {
  folder: Tile;
  /** Tiles on the desktop that can be moved into this folder. */
  available: Tile[];
  onChange: (next: Tile) => void;
  onMoveIn: (tileId: string) => void;
  onMoveOut: (childId: string) => void;
  onNotice: (message: string) => void;
}) {
  const [editingChild, setEditingChild] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const kids = folder.config.children ?? [];
  const patch = (children: FolderChild[]) =>
    onChange({
      ...folder,
      updatedAt: new Date().toISOString(),
      config: { ...folder.config, children },
    });
  const toggleItem = (childId: string, itemId: string) =>
    patch(
      kids.map((c) =>
        c.id !== childId
          ? c
          : {
              ...c,
              updatedAt: new Date().toISOString(),
              config: {
                ...c.config,
                items: c.config.items.map((i) =>
                  i.id === itemId ? { ...i, done: !i.done } : i,
                ),
              },
            },
      ),
    );
  return (
    <div className="folder-view">
      <div className="folder-toolbar">
        <p className="modal-intro">
          {kids.length === 0
            ? "Questa cartella è vuota."
            : `${kids.length} element${kids.length === 1 ? "o" : "i"} in questa cartella.`}
        </p>
        <button
          aria-expanded={picking}
          aria-controls="folder-picker"
          className={picking ? "tool-active" : ""}
          onClick={() => setPicking(!picking)}
        >
          {picking ? <X size={16} /> : <Plus size={16} />}
          Aggiungi tile
        </button>
      </div>
      <div className={`folder-body ${picking ? "with-picker" : ""}`}>
        <div className="folder-main">
          {kids.length === 0 ? (
            <div className="folder-empty-state">
              <p>
                Nessun elemento. Con “Aggiungi tile” scegli quali tile del
                desktop spostare qui dentro.
              </p>
            </div>
          ) : (
            <ul className="folder-grid">
              {kids.map((child) => (
                <li
                  key={child.id}
                  className="folder-card"
                  style={{
                    backgroundColor: child.appearance.background,
                    color: child.appearance.color,
                  }}
                >
                  <div className="folder-card-body">
                    <TileView
                      tile={asTile(child)}
                      editing={false}
                      toggleItem={(itemId) => toggleItem(child.id, itemId)}
                    />
                    {child.url && (
                      <a
                        className="folder-card-link"
                        href={child.url}
                        target={
                          child.url.startsWith("obsidian:")
                            ? undefined
                            : "_blank"
                        }
                        rel="noopener noreferrer"
                      >
                        Apri <ArrowUpRight size={13} />
                      </a>
                    )}
                  </div>
                  {editingChild === child.id ? (
                    <ChildEditor
                      child={child}
                      onCancel={() => setEditingChild(null)}
                      onSave={(next) => {
                        patch(kids.map((c) => (c.id === child.id ? next : c)));
                        setEditingChild(null);
                      }}
                    />
                  ) : (
                    <div className="folder-card-actions">
                      <button
                        onClick={() => setEditingChild(child.id)}
                        aria-label={`Modifica ${child.title}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onMoveOut(child.id)}
                        aria-label={`Sposta ${child.title} sul desktop`}
                        title="Sposta sul desktop"
                      >
                        <CornerUpLeft size={14} />
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          patch(kids.filter((c) => c.id !== child.id));
                          onNotice("Elemento rimosso dalla cartella.");
                        }}
                        aria-label={`Rimuovi ${child.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {picking && (
          <aside
            id="folder-picker"
            className="folder-picker"
            aria-label="Tile da aggiungere"
          >
            <h3>Sposta nella cartella</h3>
            {available.length === 0 ? (
              <p className="hint">Non ci sono altre tile sul desktop.</p>
            ) : (
              <ul>
                {available.map((t) => {
                  const Icon = typeGlyph[t.type as FolderChildType];
                  return (
                    <li key={t.id}>
                      <button
                        disabled={kids.length >= 24}
                        onClick={() => onMoveIn(t.id)}
                        aria-label={`Aggiungi ${t.title} alla cartella`}
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span>
                          <strong>
                            {t.title || typeLabel[t.type as FolderChildType]}
                          </strong>
                          <small>{typeLabel[t.type as FolderChildType]}</small>
                        </span>
                        <Plus size={15} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        )}
      </div>
      <p className="hint">
        Le spunte delle liste funzionano anche qui. Le modifiche vengono salvate
        automaticamente nel desktop.
      </p>
      {kids.length > 0 && (
        <span className="folder-done-hint" aria-hidden="true">
          <Check size={12} />{" "}
          {kids.filter((c) => c.type === "data").length > 0
            ? `${kids.flatMap((c) => c.config.items).filter((i) => i.done).length} voci completate`
            : "Tutto organizzato"}
        </span>
      )}
    </div>
  );
}
