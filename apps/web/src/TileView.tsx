import { useEffect, useState, useRef, type CSSProperties } from "react";
import {
  ArrowUpRight,
  Check,
  Image as ImageIcon,
  ListTodo,
  Plus,
  StickyNote,
} from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";
import { FileTile, ProgressTile, WeatherTile } from "./ExtraTiles";
import {
  readableInk,
  type Desktop,
  type Tile,
} from "../../../packages/shared/model";
export function tileStyle(
  tile: Tile,
  settings: Desktop["settings"],
): CSSProperties {
  const a = tile.appearance;
  return {
    "--check-ink": a.background,
    backgroundColor: `color-mix(in srgb, ${a.background} ${settings.opacity * (settings.blur ? 78 : 100)}%, transparent)`,
    color: readableInk(a.background),
    borderRadius: settings.radius,
    padding: settings.padding,
    border:
      settings.border === "none"
        ? "1px solid transparent"
        : `${settings.border === "strong" ? 2 : 1}px solid currentColor`,
    backdropFilter: settings.blur ? "blur(24px)" : undefined,
    backgroundImage: a.image ? `url("${a.image}")` : undefined,
    backgroundPosition: a.imagePosition,
    backgroundSize: a.fit,
  } as CSSProperties;
}
function Clock({ tile }: { tile: Tile }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const zone = tile.config.timezone || undefined;
  return (
    <>
      <div className="tile-top">
        <span>{tile.title}</span>
        <span className="live-dot" />
      </div>
      <time className="clock-time" dateTime={now.toISOString()}>
        {new Intl.DateTimeFormat("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: zone,
        }).format(now)}
      </time>
      <div className="clock-bottom">
        <span>
          {new Intl.DateTimeFormat("it-IT", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            timeZone: zone,
          }).format(now)}
        </span>
        <span>
          {tile.subtitle ||
            (zone ?? "Locale").split("/").pop()?.replaceAll("_", " ")}
        </span>
      </div>
    </>
  );
}
export function TileView({
  tile,
  editing,
  toggleItem,
  expanded = false,
  onAddItem,
  updateConfig,
  onTimerFinish,
}: {
  tile: Tile;
  editing: boolean;
  toggleItem: (id: string) => void;
  expanded?: boolean;
  onAddItem?: (text: string) => void;
  updateConfig?: (patch: Partial<Tile["config"]>) => void;
  onTimerFinish?: (title: string) => void;
}) {
  if (tile.type === "clock") return <Clock tile={tile} />;
  if (tile.type === "folder") return <FolderPreview tile={tile} />;
  if (tile.type === "weather") return <WeatherTile tile={tile} />;
  if (tile.type === "progress")
    return (
      <ProgressTile
        tile={tile}
        editing={editing}
        onConfig={updateConfig}
        onFinish={onTimerFinish}
      />
    );
  if (tile.type === "file") return <FileTile tile={tile} expanded={expanded} />;
  if (tile.type === "link")
    return (
      <>
        <span className="shortcut-icon" aria-hidden="true">
          {tile.config.icon || "↗"}
        </span>
        <div className="shortcut-bottom">
          <div>
            <h2>{tile.title}</h2>
            <p>{tile.subtitle}</p>
          </div>
          <ArrowUpRight size={19} />
        </div>
      </>
    );
  if (tile.type === "image")
    return (
      <>
        {tile.config.image ? (
          <img
            className="tile-media"
            src={tile.config.image}
            alt={tile.title}
            style={{
              objectFit: tile.appearance.fit,
              objectPosition: tile.appearance.imagePosition,
            }}
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="image-empty">
            <ImageIcon size={35} />
            <span>Aggiungi un’immagine</span>
          </div>
        )}
        {tile.config.image && (
          <div className="image-caption">
            <h2>{tile.title}</h2>
            {tile.config.body && <p>{tile.config.body}</p>}
          </div>
        )}
      </>
    );
  if (tile.type === "text")
    return (
      <>
        <div className="note-meta">
          <StickyNote size={14} aria-hidden="true" />
          <span>{tile.subtitle || "Nota personale"}</span>
          {expanded && (
            <span className="note-date">
              {new Intl.DateTimeFormat("it-IT", {
                day: "numeric",
                month: "short",
              }).format(new Date(tile.updatedAt))}
            </span>
          )}
        </div>
        <h2 className="text-headline">{tile.title}</h2>
        <MarkdownContent className="text-body" text={tile.config.body} />
      </>
    );
  return (
    <>
      <div className="todo-meta">
        <ListTodo size={14} aria-hidden="true" />
        <span>
          {tile.config.items.length
            ? `${tile.config.items.filter((i) => !i.done).length} da fare`
            : "La tua lista"}
        </span>
        <span
          className="todo-count"
          aria-label={`${tile.config.items.filter((i) => i.done).length} di ${tile.config.items.length} completati`}
        >
          {tile.config.items.filter((i) => i.done).length}/
          {tile.config.items.length}
        </span>
      </div>
      <div className="tile-top">
        <h2>{tile.title}</h2>
      </div>
      {tile.subtitle && <p className="data-subtitle">{tile.subtitle}</p>}
      {tile.config.body && (
        <MarkdownContent className="data-body" text={tile.config.body} />
      )}
      <TodoList
        tile={tile}
        editing={editing}
        expanded={expanded}
        toggleItem={toggleItem}
        onAddItem={onAddItem}
      />
      {!expanded && tile.config.items.length > 0 && (
        <div
          className="todo-progress"
          role="progressbar"
          aria-label="Attività completate"
          aria-valuemin={0}
          aria-valuemax={tile.config.items.length}
          aria-valuenow={tile.config.items.filter((x) => x.done).length}
        >
          <span
            style={{
              width: `${(100 * tile.config.items.filter((x) => x.done).length) / tile.config.items.length}%`,
            }}
          />
        </div>
      )}
      {expanded && tile.config.items.length > 0 && (
        <div className="data-footer">
          <span>
            {tile.config.items.filter((x) => x.done).length} /{" "}
            {tile.config.items.length} completati
          </span>
          <div className="progress">
            <span
              style={{
                width: `${tile.config.items.length ? (100 * tile.config.items.filter((x) => x.done).length) / tile.config.items.length : 0}%`,
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

const folderGlyph: Record<string, string> = {
  link: "↗",
  image: "◍",
  text: "✎",
  data: "☑",
  clock: "◷",
};

function FolderPreview({ tile }: { tile: Tile }) {
  const kids = tile.config.children ?? [];
  return (
    <>
      <div className="tile-top">
        <span>{tile.subtitle || "Cartella"}</span>
        <span aria-hidden="true">▦</span>
      </div>
      <h2 className="folder-title">{tile.title}</h2>
      <div className="folder-preview" aria-hidden="true">
        {kids.length === 0 ? (
          <span className="folder-empty">Vuota</span>
        ) : (
          kids.slice(0, 4).map((c) => (
            <span
              key={c.id}
              className="folder-mini"
              style={{
                backgroundColor: c.appearance.background,
                color: readableInk(c.appearance.background),
              }}
              title={c.title}
            >
              {c.type === "link"
                ? c.config.icon || "↗"
                : (folderGlyph[c.type] ?? "·")}
            </span>
          ))
        )}
      </div>
      <div className="folder-bottom">
        <span>
          {kids.length === 0
            ? "Tocca per aggiungere"
            : `${kids.length} element${kids.length === 1 ? "o" : "i"}`}
        </span>
        <ArrowUpRight size={16} />
      </div>
    </>
  );
}

function TodoList({
  tile,
  editing,
  expanded,
  toggleItem,
  onAddItem,
}: {
  tile: Tile;
  editing: boolean;
  expanded: boolean;
  toggleItem: (id: string) => void;
  onAddItem?: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(3);
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const items = tile.config.items.filter(
    (item) => filter === "all" || (filter === "done" ? item.done : !item.done),
  );
  useEffect(() => {
    if (expanded || !ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const rowHeight =
        parseFloat(
          getComputedStyle(ref.current!).getPropertyValue("--todo-row-height"),
        ) || 36;
      setCount(Math.max(0, Math.floor(entry.contentRect.height / rowHeight)));
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [expanded]);
  return (
    <>
      {expanded && (
        <div className="todo-filters" role="group" aria-label="Mostra attività">
          {[
            ["all", "Tutte"],
            ["active", "Da fare"],
            ["done", "Completate"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        ref={ref}
        className={`checklist ${expanded ? "full-todos" : "preview-todos"}`}
      >
        {(expanded
          ? items
          : [...tile.config.items]
              .sort((a, b) => Number(a.done) - Number(b.done))
              .slice(0, count)
        ).map((item) => (
          <button
            key={item.id}
            className={`check-item ${item.done ? "checked" : ""}`}
            disabled={editing}
            onClick={() => toggleItem(item.id)}
            aria-pressed={item.done}
          >
            <span className="checkbox">{item.done && <Check size={12} />}</span>
            <span>
              <MarkdownContent text={item.text} inline />
            </span>
          </button>
        ))}
      </div>
      {expanded && !items.length && (
        <p className="todo-empty">
          {filter === "done"
            ? "Qui ritrovi le attività completate."
            : filter === "active"
              ? "Tutto fatto. Spazio al resto."
              : "La prima cosa da fare? Aggiungila qui sotto."}
        </p>
      )}
      {expanded && onAddItem && (
        <form
          className="inline-task-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim() || tile.config.items.length >= 30) return;
            onAddItem(draft.trim());
            setDraft("");
            setFilter("all");
          }}
        >
          <Plus size={17} aria-hidden="true" />
          <input
            aria-label="Nuova attività"
            placeholder={
              tile.config.items.length >= 30
                ? "Limite di 30 attività raggiunto"
                : "Aggiungi un’attività…"
            }
            disabled={tile.config.items.length >= 30}
            maxLength={300}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            aria-label="Aggiungi attività"
            disabled={!draft.trim() || tile.config.items.length >= 30}
          >
            <ArrowUpRight size={18} />
          </button>
        </form>
      )}
    </>
  );
}

export function QuickAppend({
  tile,
  onConfig,
}: {
  tile: Tile;
  onConfig: (patch: Partial<Tile["config"]>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    const article = ref.current?.closest("article");
    if (!article) return;
    const observer = new ResizeObserver(([entry]) =>
      setRoom(
        entry.contentRect.height >= 210 && entry.contentRect.width >= 150,
      ),
    );
    observer.observe(article);
    return () => observer.disconnect();
  }, []);
  const todo = tile.type === "data";
  const full = todo
    ? tile.config.items.length >= 30
    : tile.config.body.length >= 10000;
  return (
    <div ref={ref} className="quick-append" hidden={!room}>
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text || full) return;
            if (todo)
              onConfig({
                items: [
                  ...tile.config.items,
                  { id: crypto.randomUUID(), text, done: false },
                ],
              });
            else {
              const body = [tile.config.body, text]
                .filter(Boolean)
                .join("\n\n");
              if (body.length > 10000) return;
              onConfig({ body });
            }
            setDraft("");
            setOpen(false);
          }}
        >
          <textarea
            autoFocus
            aria-label={todo ? "Nuova attività" : "Testo da aggiungere"}
            maxLength={
              todo
                ? 300
                : Math.max(
                    0,
                    10000 -
                      tile.config.body.length -
                      (tile.config.body ? 2 : 0),
                  )
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
              }
            }}
          />
          <div>
            <button type="button" onClick={() => setOpen(false)}>
              Annulla
            </button>
            <button disabled={!draft.trim() || full}>Aggiungi</button>
          </div>
        </form>
      ) : (
        <button disabled={full} onClick={() => setOpen(true)}>
          <Plus size={14} /> {todo ? "Aggiungi attività" : "Aggiungi testo"}
        </button>
      )}
    </div>
  );
}
