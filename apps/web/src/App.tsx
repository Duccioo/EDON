import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import {
  Archive,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ChevronRight,
  Clock3,
  CloudSun,
  FileUp,
  Folder,
  Image,
  LayoutGrid,
  Link2,
  ListTodo,
  LockKeyhole,
  LogOut,
  Pencil,
  Settings2,
  StickyNote,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import type { Desktop } from "../../../packages/shared/model";
import {
  archiveTile,
  defaultTileSize,
  folderChildTypes,
  folderChildToTile,
  restoreTile,
  tileToFolderChild,
  tileSizeLimits,
  arrangeTile,
  compactTiles,
  createTile,
  resizeGrid,
  findTileSpace,
  type Tile,
  type TileType,
} from "../../../packages/shared/model";
import { request, uploadFile, useDesktop, type UploadedFile } from "./api";
import { AnimatedWallpaper } from "./AnimatedWallpaper";
import { useDesktopInk } from "./ink";
import { fitBoard } from "../../../packages/shared/board";
import { TileView, tileStyle, QuickAppend } from "./TileView";
import { FolderView } from "./FolderView";
import { Inspector } from "./Inspector";
import { Modal } from "./Modal";
import { SettingsPage, type SettingsSection } from "./SettingsPage";
import { DesktopTools } from "./DesktopTools";
import { CaptureComposer } from "./CaptureComposer";
import { AgentCreator } from "./AgentCreator";
import { ArchiveView } from "./ArchiveView";
import { captureSource, type Capture } from "../../../packages/shared/capture";

type Auth = { configured: boolean; authenticated: boolean };
export default function App() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    request<Auth>("/api/auth")
      .then(setAuth)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  if (error)
    return (
      <main className="center-screen">
        <p role="alert">{error}</p>
        <button
          onClick={() => {
            setError("");
            load();
          }}
        >
          Riprova
        </button>
      </main>
    );
  if (!auth) return <main className="center-screen">Apro il tuo spazio…</main>;
  return auth.authenticated ? (
    <DesktopApp onLogout={load} />
  ) : (
    <Login configured={auth.configured} onLogin={load} />
  );
}
function Login({
  configured,
  onLogin,
}: {
  configured: boolean;
  onLogin: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await request(configured ? "/api/login" : "/api/setup", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-screen">
      <div className="login-brand">edon</div>
      <form className="login-card" onSubmit={submit}>
        <LockKeyhole size={23} />
        <p className="small-label">Il tuo desktop personale</p>
        <h1>{configured ? "Bentornato." : "Fai spazio\nalle tue idee."}</h1>
        <p>
          {configured
            ? "Un posto per ritrovare il filo."
            : "Crea una password per custodire il tuo spazio. Layout e immagini restano su questo server."}
        </p>
        <label>
          Password
          <input
            type="password"
            autoFocus
            autoComplete={configured ? "current-password" : "new-password"}
            minLength={10}
            maxLength={200}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <small>Almeno 10 caratteri.</small>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? "Un momento…"
            : configured
              ? "Apri il desktop"
              : "Crea il tuo spazio"}
          <ArrowUpRight size={18} />
        </button>
      </form>
      <span className="login-foot">Ogni cosa, al suo posto.</span>
    </main>
  );
}
function DesktopApp({ onLogout }: { onLogout: () => void }) {
  const { desktop, update, status, error, retry, refresh } = useDesktop();
  const ink = useDesktopInk(desktop?.settings);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    "add" | "settings" | "text" | "data" | "agent" | "archive" | null
  >(null);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("aspetto");
  const openSettings = (section: SettingsSection = "aspetto") => {
    setSettingsSection(section);
    setDialog("settings");
  };
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const closeExpanded = useCallback(() => {
    setExpandedId(null);
    setEditingNote(false);
  }, []);
  const folderHover = useRef<{
    id: string;
    ready: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [folderTarget, setFolderTarget] = useState<string | null>(null);
  const clearFolderHover = () => {
    if (folderHover.current) clearTimeout(folderHover.current.timer);
    folderHover.current = null;
    setFolderTarget(null);
  };
  useEffect(
    () => () => {
      if (folderHover.current) clearTimeout(folderHover.current.timer);
    },
    [],
  );
  const [gridEpoch, setGridEpoch] = useState(0);
  const [deleting, setDeleting] = useState<Tile | null>(null);
  const [notice, setNotice] = useState("");
  const onTimerFinish = useCallback(
    (title: string) => setNotice(`“${title}” è finito.`),
    [],
  );
  const [dockHeight, setDockHeight] = useState(64);
  const viewport = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const addFilesRef = useRef<(files: File[]) => void>(() => {});
  // Holding a tile for half a second switches to edit mode and hands the pointer to the grid.
  const press = useRef<{
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
  } | null>(null);
  const pendingGrab = useRef<{ el: HTMLElement; x: number; y: number } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const [pressing, setPressing] = useState<string | null>(null);
  const cancelPress = useCallback(() => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
    setPressing(null);
  }, []);
  const [space, setSpace] = useState({
    width: 1050,
    height: 650,
    fitted: false,
  });
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);
  useEffect(() => {
    const measure = () => {
      if (!viewport.current) return;
      setSpace({
        width: Math.floor(viewport.current.clientWidth),
        height: Math.floor(viewport.current.clientHeight),
        fitted: matchMedia("(min-width: 900px) and (min-height: 600px)")
          .matches,
      });
    };
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [!!desktop]);
  const toggleEdit = useCallback(() => {
    setEditing((old) => !old);
    setSelected(null);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable],dialog"))
        return;
      if (
        e.key.toLowerCase() === "e" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        toggleEdit();
      }
      if (e.key === "Escape") {
        setSelected(null);
        setEditing(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [toggleEdit]);
  useEffect(() => {
    if (editing && pendingGrab.current) {
      const { el, x, y } = pendingGrab.current;
      pendingGrab.current = null;
      el.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          button: 0,
          view: window,
        }),
      );
    }
  }, [editing]);
  useEffect(() => {
    const release = () => {
      cancelPress();
      setTimeout(() => (suppressClick.current = false), 150);
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [cancelPress]);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer?.types.includes("Files") &&
      !(e.target as HTMLElement | null)?.closest?.(".capture-composer");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDropping(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDropping(false);
    };
    const drop = (e: DragEvent) => {
      depth = 0;
      setDropping(false);
      if (!hasFiles(e)) return;
      e.preventDefault();
      addFilesRef.current([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  if (!desktop)
    return (
      <main className="center-screen">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => location.reload()}>Ricarica</button>
          </>
        ) : (
          "Compongo il tuo desktop…"
        )}
      </main>
    );
  const tile = desktop.tiles.find((t) => t.id === selected);
  const expanded = [...desktop.tiles, ...desktop.archive].find(
    (t) => t.id === expandedId,
  );
  const isArchived = desktop.archive.some((t) => t.id === expandedId);
  const openFolder = desktop.tiles.find((t) => t.id === openFolderId);
  const toggleFolderItem = (
    folderId: string,
    childId: string,
    itemId: string,
  ) =>
    update((old) => ({
      ...old,
      tiles: old.tiles.map((item) =>
        item.id === folderId
          ? {
              ...item,
              updatedAt: new Date().toISOString(),
              config: {
                ...item.config,
                children: (item.config.children ?? []).map((c) =>
                  c.id === childId
                    ? {
                        ...c,
                        updatedAt: new Date().toISOString(),
                        config: {
                          ...c.config,
                          items: c.config.items.map((i) =>
                            i.id === itemId ? { ...i, done: !i.done } : i,
                          ),
                        },
                      }
                    : c,
                ),
              },
            }
          : item,
      ),
    }));
  const moveIntoFolder = (folderId: string, tileId: string) => {
    const folder = desktop.tiles.find((t) => t.id === folderId);
    const moved = desktop.tiles.find((t) => t.id === tileId);
    const child = moved && tileToFolderChild(moved);
    if (!folder || !child) return;
    if ((folder.config.children ?? []).length >= 24)
      return setNotice("La cartella contiene già 24 elementi.");
    update((old) => ({
      ...old,
      tiles: old.tiles
        .filter((t) => t.id !== tileId)
        .map((t) =>
          t.id === folderId
            ? {
                ...t,
                updatedAt: new Date().toISOString(),
                config: {
                  ...t.config,
                  children: [...(t.config.children ?? []), child],
                },
              }
            : t,
        ),
    }));
    setNotice(`“${moved.title}” è ora nella cartella.`);
  };
  const moveOutOfFolder = (folderId: string, childId: string) => {
    const folder = desktop.tiles.find((t) => t.id === folderId);
    const child = folder?.config.children?.find((c) => c.id === childId);
    if (!folder || !child) return;
    if (desktop.tiles.length >= desktop.settings.maxTiles)
      return setNotice("Limite tile raggiunto. Aumentalo in Aspetto.");
    const restored = folderChildToTile(child, desktop.tiles, desktop.settings);
    if (!restored)
      return setNotice(
        "Non c’è spazio sul desktop. Libera una zona o aumenta righe e colonne.",
      );
    update((old) => ({
      ...old,
      tiles: [
        ...old.tiles.map((t) =>
          t.id === folderId
            ? {
                ...t,
                updatedAt: new Date().toISOString(),
                config: {
                  ...t.config,
                  children: (t.config.children ?? []).filter(
                    (c) => c.id !== childId,
                  ),
                },
              }
            : t,
        ),
        restored,
      ],
    }));
    setNotice(`“${child.title}” è tornato sul desktop.`);
  };
  const importDesktop = (next: Desktop) => {
    try {
      update(() => next);
      setDialog(null);
      setNotice("Desktop aggiornato.");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const setTile = (changed: Tile) => {
    const tiles = arrangeTile(desktop.tiles, changed, desktop.settings);
    if (!tiles) {
      setNotice(
        "Spazio occupato: usa una zona libera oppure scambia tile delle stesse dimensioni.",
      );
      setGridEpoch((n) => n + 1);
      return;
    }
    update((old) => ({ ...old, tiles }));
  };
  const patchConfig = (id: string, patch: Partial<Tile["config"]>) =>
    update((old) => ({
      ...old,
      tiles: old.tiles.map((t) =>
        t.id === id
          ? {
              ...t,
              updatedAt: new Date().toISOString(),
              config: { ...t.config, ...patch },
            }
          : t,
      ),
    }));
  const toggleItem = (tileId: string, id: string) =>
    update((old) => {
      const toggle = (tile: Tile) =>
        tile.id === tileId
          ? {
              ...tile,
              updatedAt: new Date().toISOString(),
              config: {
                ...tile.config,
                items: tile.config.items.map((item) =>
                  item.id === id ? { ...item, done: !item.done } : item,
                ),
              },
            }
          : tile;
      return {
        ...old,
        tiles: old.tiles.map(toggle),
        archive: old.archive.map(toggle),
      };
    });
  const archiveNote = (id: string) => {
    try {
      const next = archiveTile(desktop, id);
      update(() => next);
      if (expandedId === id) closeExpanded();
      if (selected === id) setSelected(null);
      setNotice("Appunto archiviato. Lo ritrovi in Archivio.");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const restoreNote = (id: string) => {
    const next = restoreTile(desktop, id);
    update(() => next);
    setNotice("Appunto ripristinato nel desktop.");
  };
  const saveCapture = (draft: Capture) => {
    const sizes =
      draft.kind === "data"
        ? [
            { w: 2, h: 2 },
            { w: 2, h: 1 },
            { w: 1, h: 1 },
          ]
        : [
            { w: 2, h: 1 },
            { w: 1, h: 1 },
          ];
    const size = sizes.find((size) =>
      findTileSpace(desktop.tiles, size, desktop.settings),
    );
    if (!size)
      throw new Error(
        "La griglia è piena. Archivia un appunto o aumenta righe e colonne in Aspetto: il testo rimane qui.",
      );
    const next = createTile(
      draft.kind,
      desktop.tiles,
      size,
      desktop.settings.maxTiles,
      desktop.settings,
    );
    next.title = draft.title;
    if (draft.kind === "link") {
      next.url = draft.url;
      next.config.icon = draft.icon;
    } else {
      next.config.body = draft.body;
      next.config.items = draft.items;
    }
    update((old) => ({ ...old, tiles: [...old.tiles, next] }));
    setDialog(null);
    setEditing(false);
    setSelected(null);
    setNotice(
      draft.kind === "link"
        ? "Collegamento aggiunto al desktop."
        : draft.kind === "data"
          ? "TODO aggiunto al desktop."
          : "Nota aggiunta al desktop.",
    );
  };
  const compact = () => {
    const tiles = compactTiles(desktop.tiles, desktop.settings.columns);
    const moved = tiles.some(
      (t, i) => t.x !== desktop.tiles[i].x || t.y !== desktop.tiles[i].y,
    );
    if (!moved) return setNotice("Il desktop è già compatto.");
    update((old) => ({ ...old, tiles }));
    setGridEpoch((n) => n + 1);
    setNotice("Spazi vuoti rimossi.");
  };
  const add = (type: TileType) => {
    if (type === "text" || type === "data") {
      setDialog(type);
      return;
    }
    if (type === "file") {
      setDialog(null);
      fileInput.current?.click();
      return;
    }
    try {
      const next = createTile(
        type,
        desktop.tiles,
        undefined,
        desktop.settings.maxTiles,
        desktop.settings,
      );
      if (type === "progress") {
        const now = Date.now();
        next.title = "Timer";
        next.config.startsAt = new Date(now).toISOString();
        next.config.endsAt = new Date(now + 25 * 60_000).toISOString();
      }
      update((old) => ({ ...old, tiles: [...old.tiles, next] }));
      setSelected(next.id);
      setEditing(true);
      setDialog(null);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setNotice(files.length > 1 ? "Carico i file…" : "Carico il file…");
    try {
      const stored: UploadedFile[] = [];
      for (const file of files.slice(0, 10))
        stored.push(await uploadFile(file));
      let added = 0;
      const skipped: string[] = [];
      update((old) => {
        let tiles = old.tiles;
        for (const item of stored) {
          const type = item.kind === "image" ? "image" : "file";
          const sizes =
            type === "image"
              ? [
                  { w: 2, h: 2 },
                  { w: 1, h: 1 },
                ]
              : [
                  { w: 2, h: 2 },
                  { w: 1, h: 2 },
                  { w: 1, h: 1 },
                ];
          const size = sizes.find((candidate) =>
            findTileSpace(tiles, candidate, old.settings),
          );
          try {
            if (!size) throw new Error("La griglia è piena.");
            const tile = createTile(
              type,
              tiles,
              size,
              old.settings.maxTiles,
              old.settings,
            );
            tile.title = item.name.replace(/\.[^.]+$/, "") || item.name;
            if (type === "image") tile.config.image = item.url;
            else tile.config.file = item.url;
            tiles = [...tiles, tile];
            added++;
          } catch (e) {
            skipped.push((e as Error).message);
          }
        }
        return { ...old, tiles };
      });
      setNotice(
        skipped.length
          ? `${added ? `${added} aggiunti. ` : ""}${skipped[0]}`
          : added === 1
            ? "Tile aggiunta al desktop."
            : `${added} tile aggiunte al desktop.`,
      );
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  addFilesRef.current = (files) => void addFiles(files);
  const saveLayout = (_layout: Layout[], _oldItem: Layout, item: Layout) => {
    const current = desktop.tiles.find((t) => t.id === item.i);
    if (current)
      setTile({
        ...current,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        updatedAt: new Date().toISOString(),
      });
  };
  // Hover parallax: the tile leans towards the pointer, with a soft highlight following it.
  const tiltTile = (
    e: React.PointerEvent<HTMLDivElement>,
    t: Tile,
    reset: boolean,
  ) => {
    const article = e.currentTarget.firstElementChild as HTMLElement | null;
    if (!article) return;
    if (
      reset ||
      e.pointerType !== "mouse" ||
      press.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      for (const name of ["--rx", "--ry", "--mx", "--my", "--tilt"])
        article.style.removeProperty(name);
      return;
    }
    const box = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - box.left) / box.width - 0.5;
    const py = (e.clientY - box.top) / box.height - 0.5;
    const max = 9 / Math.sqrt(Math.max(t.w, t.h));
    article.style.setProperty("--ry", `${(px * 2 * max).toFixed(2)}deg`);
    article.style.setProperty("--rx", `${(-py * 2 * max).toFixed(2)}deg`);
    article.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
    article.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
    article.style.setProperty("--tilt", "1");
  };
  const renderTile = (t: Tile) => (
    <div
      key={t.id}
      id={`tile-${t.id}`}
      data-testid={`tile-${t.type}`}
      style={
        { "--mobile-w": Math.min(4, t.w), "--mobile-h": t.h } as CSSProperties
      }
      className={`tile-shell ${folderTarget === t.id ? "folder-drop-ready" : ""} size-${t.w}-${t.h} ${selected === t.id ? (editing ? "selected" : "search-selected") : ""} ${pressing === t.id ? "pressing" : ""}`}
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (!suppressClick.current) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        if (
          editing ||
          e.button !== 0 ||
          !space.fitted ||
          (e.target as HTMLElement).closest("button,a,input,textarea,select")
        )
          return;
        cancelPress();
        const el = e.currentTarget;
        const { clientX: x, clientY: y } = e;
        const mouse = e.pointerType === "mouse";
        setPressing(t.id);
        press.current = {
          x,
          y,
          timer: setTimeout(() => {
            press.current = null;
            setPressing(null);
            suppressClick.current = true;
            if (mouse) pendingGrab.current = { el, x, y };
            setEditing(true);
            setSelected(null);
          }, 500),
        };
      }}
      onPointerEnter={(e) => tiltTile(e, t, editing)}
      onPointerMove={(e) => {
        if (
          press.current &&
          Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) >
            8
        )
          cancelPress();
        tiltTile(e, t, editing);
      }}
      onPointerLeave={(e) => tiltTile(e, t, true)}
    >
      <article
        className={`tile tile-${t.type} font-${t.appearance.font}`}
        style={{
          ...tileStyle(t, desktop.settings),
          padding: desktop.settings.padding * density,
        }}
        onClick={(e) => {
          if (
            !editing &&
            (t.type === "text" ||
              t.type === "data" ||
              t.type === "folder" ||
              t.type === "file") &&
            !(e.target as HTMLElement).closest("button,a,input,textarea")
          )
            t.type === "folder" ? setOpenFolderId(t.id) : setExpandedId(t.id);
        }}
      >
        <div
          className={
            t.type === "text" || t.type === "data"
              ? "tile-preview"
              : "tile-render"
          }
        >
          <TileView
            tile={t}
            editing={editing}
            toggleItem={(id) => toggleItem(t.id, id)}
            updateConfig={(patch) => patchConfig(t.id, patch)}
            onTimerFinish={onTimerFinish}
          />
        </div>
        {!editing && (t.type === "text" || t.type === "data") && (
          <QuickAppend
            tile={t}
            onConfig={(patch) => patchConfig(t.id, patch)}
          />
        )}
        {!editing && (t.type === "text" || t.type === "data") && (
          <div className="tile-content-actions">
            <button
              className="tile-expand"
              onClick={() => setExpandedId(t.id)}
              aria-label={`Apri ${t.title}`}
            >
              {t.type === "text"
                ? "Leggi nota"
                : `Apri lista (${t.config.items.length})`}
              <ArrowUpRight size={14} />
            </button>
            <button
              className="tile-quick-edit"
              aria-label={`Modifica contenuto ${t.title}`}
              title="Modifica contenuto"
              onClick={() => {
                setExpandedId(t.id);
                setEditingNote(true);
              }}
            >
              <Pencil size={14} />
            </button>
            <button
              className="tile-quick-edit"
              aria-label={`Archivia ${t.title}`}
              title="Archivia"
              onClick={() => archiveNote(t.id)}
            >
              <Archive size={14} />
            </button>
          </div>
        )}
        {!editing && t.type === "file" && t.config.file && (
          <button
            className="tile-expand"
            onClick={() => setExpandedId(t.id)}
            aria-label={`Apri ${t.title}`}
          >
            Apri
          </button>
        )}
        {!editing && t.type === "folder" && (
          <button
            className="tile-expand"
            onClick={() => setOpenFolderId(t.id)}
            aria-label={`Apri cartella ${t.title}`}
          >
            Apri cartella ({(t.config.children ?? []).length})
            <ArrowUpRight size={14} />
          </button>
        )}
        {!editing && t.url && t.type !== "data" && t.type !== "folder" && (
          <a
            className="tile-link"
            href={t.url}
            target={t.url.startsWith("obsidian:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            aria-label={`Apri ${t.title}`}
          />
        )}
        {editing && (
          <button
            className="tile-select"
            onClick={() => setSelected(t.id)}
            aria-label={`Modifica ${t.title}`}
          >
            <span>
              <Pencil size={13} />
              Modifica
            </span>
          </button>
        )}
      </article>
      {editing && (
        <button
          className="tile-delete"
          aria-label={`Elimina ${t.title}`}
          title="Elimina"
          onClick={() => setDeleting(t)}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
  const s = desktop.settings;
  const board = fitBoard(desktop.tiles, space.width, space.height, s.gap, s);
  const width = space.fitted ? board.width : space.width;
  const gap = space.fitted ? board.gap : s.gap;
  const rowHeight = space.fitted
    ? board.cellHeight
    : (width - gap * (s.columns - 1)) / s.columns;
  const density = space.fitted ? board.density : 1;
  const atCapacity =
    desktop.tiles.length >= s.maxTiles ||
    !findTileSpace(desktop.tiles, { w: 1, h: 1 }, s);
  const wallpaper: CSSProperties = {
    backgroundColor: s.background,
    backgroundImage:
      s.wallpaper === "fold"
        ? "url(/art/wallpaper.svg)"
        : s.wallpaper === "gradient"
          ? `radial-gradient(ellipse at 15% 20%, #f7f7f2, transparent 65%),linear-gradient(135deg, ${s.background}, #6d7470)`
          : s.wallpaper === "image" && s.wallpaperImage
            ? `url("${s.wallpaperImage}")`
            : undefined,
  };
  return (
    <div
      className={`desktop ${space.fitted && rowHeight < 120 ? "desktop-dense" : ""} ${editing ? "editing" : ""} ${tile && editing ? "with-inspector" : ""}`}
      style={
        {
          ...wallpaper,
          "--desktop-ink": ink,
          "--tile-radius": `${s.radius}px`,
          "--tile-density": density,
          "--dock-height": `${dockHeight}px`,
          "--cell-height": `${rowHeight}px`,
          "--tile-padding": `${s.padding}px`,
        } as CSSProperties
      }
    >
      {(s.wallpaper === "ascii" || s.wallpaper === "noise") && (
        <AnimatedWallpaper kind={s.wallpaper} background={s.background} />
      )}
      <header className="desktop-header">
        <div className="wordmark">edon</div>
        <span className="desktop-name">{s.name}</span>
        <button
          className="desktop-capacity"
          onClick={() => openSettings("aspetto")}
          title="Gestisci il limite delle tile"
        >
          {desktop.tiles.length}
          <span> / {s.maxTiles} tile</span>
        </button>
        <div className="header-end">
          <span className="visually-hidden" role="status">
            {status}
          </span>
          <button
            className="icon-button"
            aria-label="Impostazioni"
            title="Impostazioni"
            onClick={() => openSettings("aspetto")}
          >
            <Settings2 size={16} />
          </button>
          <button
            className="icon-button logout"
            disabled={status !== "Tutto salvato"}
            aria-label="Esci"
            onClick={() =>
              void request("/api/logout", { method: "POST" })
                .then(onLogout)
                .catch((e) => setNotice(e.message))
            }
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <main
        ref={viewport}
        className={`desktop-main ${space.fitted ? "desktop-viewport" : ""}`}
      >
        <div
          className="board-frame"
          style={
            space.fitted
              ? { width: board.width, height: board.height }
              : undefined
          }
        >
          <div
            className="canvas"
            style={
              space.fitted
                ? {
                    width: board.width,
                    height: board.height,
                  }
                : undefined
            }
          >
            {space.fitted && (
              <div
                className="grid-guides"
                aria-hidden
                style={{
                  gap,
                  gridTemplateColumns: `repeat(${s.columns}, minmax(0, 1fr))`,
                  gridAutoRows: `${rowHeight}px`,
                }}
              >
                {Array.from(
                  {
                    length: s.columns * s.rows,
                  },
                  (_, i) => (
                    <span
                      key={i}
                      style={{
                        visibility: desktop.tiles.some(
                          (tile) =>
                            i % s.columns >= tile.x &&
                            i % s.columns < tile.x + tile.w &&
                            Math.floor(i / s.columns) >= tile.y &&
                            Math.floor(i / s.columns) < tile.y + tile.h,
                        )
                          ? "hidden"
                          : "visible",
                      }}
                    />
                  ),
                )}
              </div>
            )}
            {!desktop.tiles.length ? (
              <div className="empty-state">
                <LayoutGrid size={34} />
                <h1>Spazio a qualcosa di tuo.</h1>
                <p>Inizia con un collegamento, un’immagine o un pensiero.</p>
                <button className="primary" onClick={() => setDialog("add")}>
                  Aggiungi una tile
                </button>
              </div>
            ) : !space.fitted ? (
              <div className="mobile-tile-grid" style={{ gap: s.gap }}>
                {desktop.tiles.map(renderTile)}
              </div>
            ) : (
              <GridLayout
                key={gridEpoch}
                className="tile-grid"
                width={width}
                cols={s.columns}
                maxRows={s.rows}
                rowHeight={rowHeight}
                margin={[gap, gap]}
                containerPadding={[0, 0]}
                layout={desktop.tiles.map((t) => ({
                  i: t.id,
                  x: t.x,
                  y: t.y,
                  w: t.w,
                  h: t.h,
                  minW: 1,
                  maxW: Math.min(s.columns, tileSizeLimits[t.type].w),
                  minH: 1,
                  maxH: Math.min(s.rows, tileSizeLimits[t.type].h),
                }))}
                isDraggable={editing && space.fitted}
                isResizable={editing && space.fitted}
                compactType={null}
                allowOverlap={true}
                preventCollision={false}
                isBounded={false}
                draggableCancel="button,a,input,textarea"
                resizeHandles={["se"]}
                onDrag={(_layout, _old, item, _placeholder, event) => {
                  const moved = desktop.tiles.find((t) => t.id === item.i);
                  if (!moved || !tileToFolderChild(moved))
                    return clearFolderHover();
                  const pointer =
                    "touches" in event
                      ? (event as unknown as TouchEvent).touches[0]
                      : event;
                  if (!pointer) return clearFolderHover();
                  const target = desktop.tiles.find((t) => {
                    if (
                      t.type !== "folder" ||
                      (t.config.children ?? []).length >= 24
                    )
                      return false;
                    const rect = document
                      .getElementById(`tile-${t.id}`)
                      ?.getBoundingClientRect();
                    return (
                      rect &&
                      pointer.clientX >= rect.left &&
                      pointer.clientX <= rect.right &&
                      pointer.clientY >= rect.top &&
                      pointer.clientY <= rect.bottom
                    );
                  });
                  if (target?.id === folderHover.current?.id) return;
                  clearFolderHover();
                  if (target)
                    folderHover.current = {
                      id: target.id,
                      ready: false,
                      timer: setTimeout(() => {
                        if (folderHover.current?.id !== target.id) return;
                        folderHover.current.ready = true;
                        setFolderTarget(target.id);
                      }, 650),
                    };
                }}
                onDragStop={(layout, old, item) => {
                  const target = folderHover.current;
                  clearFolderHover();
                  if (target?.ready) {
                    moveIntoFolder(target.id, item.i);
                    setSelected(null);
                  } else saveLayout(layout, old, item);
                }}
                onResizeStop={saveLayout}
              >
                {desktop.tiles.map(renderTile)}
              </GridLayout>
            )}
          </div>
        </div>
      </main>
      <DesktopTools
        editing={editing}
        onEdit={toggleEdit}
        onAdd={() => setDialog("add")}
        onSettings={() => openSettings("aspetto")}
        onCompact={compact}
        onArchive={() => setDialog("archive")}
        archiveCount={desktop.archive.length}
        onSaveCapture={saveCapture}
        onHeightChange={setDockHeight}
      />
      {editing && tile && (
        <Inspector
          tile={tile}
          canDuplicate={!atCapacity && !!findTileSpace(desktop.tiles, tile, s)}
          onChange={setTile}
          onOpenFolder={
            tile.type === "folder" ? () => setOpenFolderId(tile.id) : undefined
          }
          onMove={(dx, dy) =>
            setTile({
              ...tile,
              x: Math.max(0, Math.min(s.columns - tile.w, tile.x + dx)),
              y: Math.max(0, Math.min(s.rows - tile.h, tile.y + dy)),
            })
          }
          onClose={() => setSelected(null)}
          onDelete={() => setDeleting(tile)}
          onDuplicate={() => {
            try {
              const space = createTile(
                tile.type,
                desktop.tiles,
                tile,
                desktop.settings.maxTiles,
                desktop.settings,
              );
              const next = {
                ...tile,
                id: space.id,
                x: space.x,
                y: space.y,
                createdAt: space.createdAt,
                updatedAt: space.updatedAt,
                title: `${tile.title} (copia)`,
              };
              update((old) => ({ ...old, tiles: [...old.tiles, next] }));
              setSelected(next.id);
            } catch (e) {
              setNotice((e as Error).message);
            }
          }}
        />
      )}
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        aria-label="Scegli file da aggiungere"
        onChange={(e) => {
          void addFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      {dropping && (
        <div className="drop-overlay" aria-hidden="true">
          <FileUp size={34} />
          Rilascia per aggiungere al desktop
          <small>Immagini e PDF diventano tile con anteprima</small>
        </div>
      )}
      {dialog === "add" && (
        <Modal title="A cosa vuoi dare spazio?" onClose={closeDialog}>
          <p className="modal-intro">
            {atCapacity
              ? "Hai esaurito i posti disponibili. Aumenta righe, colonne o limite tile in Aspetto, oppure libera spazio."
              : `${desktop.tiles.length} di ${s.maxTiles} tile. Scegli cosa aggiungere al tuo spazio.`}
          </p>
          <div className="tile-catalog">
            <button
              className="agent-catalog-item"
              onClick={() => setDialog("agent")}
            >
              <Sparkles size={24} />
              <span>
                <strong>Crea con agenti AI</strong>
                <small>Descrivi cosa vuoi appuntare o creare</small>
              </span>
              <ChevronRight size={18} />
            </button>
            {(
              [
                [Link2, "link", "Collegamento", "App, siti e scorciatoie"],
                [Image, "image", "Immagine", "Fotografie, illustrazioni e GIF"],
                [StickyNote, "text", "Testo", "Un pensiero da tenere in vista"],
                [
                  ListTodo,
                  "data",
                  "Elenco e informazioni",
                  "Piccoli passi, progetti e promemoria",
                ],
                [Clock3, "clock", "Orologio", "Il tuo tempo, ovunque"],
                [
                  Folder,
                  "folder",
                  "Cartella",
                  "Un contenitore per organizzare le tile",
                ],
                [CloudSun, "weather", "Meteo", "Il tempo nella tua città"],
                [
                  Timer,
                  "progress",
                  "Timer o scadenza",
                  "Una barra che si riempie col tempo",
                ],
                [
                  FileUp,
                  "file",
                  "File o PDF",
                  "Con anteprima. Puoi anche trascinarli qui",
                ],
              ] as const
            ).map(([Icon, type, title, description]) => (
              <button
                key={type}
                disabled={
                  atCapacity ||
                  !findTileSpace(
                    desktop.tiles,
                    type === "file" ? { w: 1, h: 1 } : defaultTileSize(type),
                    s,
                  )
                }
                onClick={() => add(type)}
              >
                <Icon size={24} />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {dialog === "settings" && (
        <SettingsPage
          key={settingsSection}
          initial={settingsSection}
          settings={s}
          desktop={desktop}
          onChange={(settings) => {
            const tiles = resizeGrid(desktop.tiles, settings);
            if (!tiles) return false;
            update((old) => ({ ...old, settings, tiles }));
            return true;
          }}
          onImport={importDesktop}
          onClose={closeDialog}
          onNotice={setNotice}
        />
      )}
      {openFolder && (
        <Modal
          title={openFolder.title || "Cartella"}
          className="tile-focus-modal folder-modal"
          sourceId={`tile-${openFolder.id}`}
          onClose={() => setOpenFolderId(null)}
        >
          <FolderView
            folder={openFolder}
            available={desktop.tiles.filter((t) =>
              (folderChildTypes as readonly string[]).includes(t.type),
            )}
            onChange={setTile}
            onMoveIn={(id) => moveIntoFolder(openFolder.id, id)}
            onMoveOut={(id) => moveOutOfFolder(openFolder.id, id)}
            onNotice={setNotice}
          />
          <div className="dialog-actions expanded-actions">
            <button
              className="danger"
              onClick={() => {
                setOpenFolderId(null);
                setDeleting(openFolder);
              }}
            >
              <Trash2 size={15} />
              Elimina
            </button>
          </div>
        </Modal>
      )}
      {(dialog === "text" || dialog === "data") && (
        <Modal
          title="Nuovo appunto"
          className="capture-modal"
          onClose={closeDialog}
        >
          <CaptureComposer initialKind={dialog} onSave={saveCapture} />
        </Modal>
      )}
      {dialog === "agent" && (
        <Modal title="Crea con agenti AI" onClose={closeDialog}>
          <AgentCreator
            onConfigure={() => openSettings("agente")}
            onDone={(reply) => {
              setDialog(null);
              setNotice(reply);
              void refresh();
            }}
          />
        </Modal>
      )}
      {dialog === "archive" && (
        <Modal title="Archivio" className="archive-modal" onClose={closeDialog}>
          <ArchiveView
            tiles={desktop.archive}
            onOpen={(id) => {
              setDialog(null);
              setExpandedId(id);
            }}
            onRestore={restoreNote}
          />
        </Modal>
      )}
      {expanded && (
        <Modal
          title={editingNote ? "Modifica" : "Vista completa"}
          className={`tile-focus-modal content-${expanded.type}`}
          sourceId={`tile-${expanded.id}`}
          onClose={closeExpanded}
        >
          {editingNote &&
          (expanded.type === "text" || expanded.type === "data") ? (
            <CaptureComposer
              initialKind={expanded.type}
              initial={{ title: expanded.title, body: captureSource(expanded) }}
              onSave={(draft) => {
                if (draft.kind === "link") return;
                update((old) => ({
                  ...old,
                  tiles: old.tiles.map((tile) =>
                    tile.id === expanded.id
                      ? {
                          ...tile,
                          type: draft.kind,
                          title: draft.title,
                          updatedAt: new Date().toISOString(),
                          config: {
                            ...tile.config,
                            body: draft.body,
                            items: draft.items.map((item, i) => ({
                              ...item,
                              id: tile.config.items[i]?.id ?? item.id,
                            })),
                          },
                        }
                      : tile,
                  ),
                }));
                setEditingNote(false);
              }}
            />
          ) : (
            <article
              className={`tile expanded-tile tile-${expanded.type} font-${expanded.appearance.font}`}
              style={tileStyle(expanded, s)}
            >
              <TileView
                tile={expanded}
                editing={false}
                expanded
                onAddItem={
                  expanded.type === "data" && !isArchived
                    ? (text) =>
                        update((old) => ({
                          ...old,
                          tiles: old.tiles.map((t) =>
                            t.id === expanded.id
                              ? {
                                  ...t,
                                  updatedAt: new Date().toISOString(),
                                  config: {
                                    ...t.config,
                                    items: [
                                      ...t.config.items,
                                      {
                                        id: crypto.randomUUID(),
                                        text,
                                        done: false,
                                      },
                                    ],
                                  },
                                }
                              : t,
                          ),
                        }))
                    : undefined
                }
                toggleItem={(id) => toggleItem(expanded.id, id)}
              />
              {expanded.url && (
                <a
                  className="expanded-link"
                  href={expanded.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apri collegamento <ArrowUpRight size={16} />
                </a>
              )}
            </article>
          )}
          {!editingNote && (
            <div className="dialog-actions expanded-actions">
              {isArchived ? (
                <button
                  className="primary"
                  onClick={() => {
                    try {
                      restoreNote(expanded.id);
                      closeExpanded();
                    } catch (e) {
                      setNotice((e as Error).message);
                    }
                  }}
                >
                  <RotateCcw size={16} />
                  Ripristina nel desktop
                </button>
              ) : (
                <>
                  <button
                    className="danger"
                    onClick={() => {
                      closeExpanded();
                      setDeleting(expanded);
                    }}
                  >
                    <Trash2 size={15} />
                    Elimina
                  </button>
                  <button onClick={() => archiveNote(expanded.id)}>
                    <Archive size={16} />
                    Archivia
                  </button>
                </>
              )}
              {!isArchived &&
                (expanded.type === "text" || expanded.type === "data") && (
                  <button
                    className="primary"
                    onClick={() => setEditingNote(true)}
                  >
                    <Pencil size={15} />
                    Modifica
                  </button>
                )}
            </div>
          )}
        </Modal>
      )}
      {deleting && (
        <Modal title="Eliminare questa tile?" onClose={closeDelete}>
          <p>“{deleting.title}” verrà rimossa dal desktop.</p>
          <div className="dialog-actions">
            <button onClick={closeDelete}>Annulla</button>
            <button
              className="danger primary"
              onClick={() => {
                update((old) => ({
                  ...old,
                  tiles: old.tiles.filter((t) => t.id !== deleting.id),
                }));
                setSelected(null);
                setDeleting(null);
              }}
            >
              Elimina tile
            </button>
          </div>
        </Modal>
      )}
      {error && (
        <div className="save-error" role="alert">
          <p>{error}</p>
          <button onClick={retry}>Riprova salvataggio</button>
          <button onClick={() => location.reload()}>Ricarica desktop</button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            className="icon-button"
            onClick={() => setNotice("")}
            aria-label="Chiudi messaggio"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
