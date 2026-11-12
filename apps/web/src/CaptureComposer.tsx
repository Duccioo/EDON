import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Eye,
  Link2,
  ListTodo,
  Paperclip,
  Pencil,
  StickyNote,
} from "lucide-react";
import {
  captureLink,
  parseCapture,
  type Capture,
  type NoteCapture,
} from "../../../packages/shared/capture";
import { upload } from "./api";
import { MarkdownContent } from "./MarkdownContent";

export function CaptureComposer({
  onSave,
  compact = false,
  detectLinks = false,
  initialKind = "text",
  initial,
}: {
  onSave: (capture: Capture) => void;
  compact?: boolean;
  /** A lone link becomes a shortcut tile instead of a note. */
  detectLinks?: boolean;
  initialKind?: NoteCapture["kind"];
  initial?: { title: string; body: string };
}) {
  const [body, setBody] = useState(
    initial?.body ?? (initialKind === "data" ? "- [ ] " : ""),
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState(initialKind);
  const [forceNote, setForceNote] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [height, setHeight] = useState(24);
  const input = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const currentBody = useRef(body);
  currentBody.current = body;
  const detectedLink = detectLinks ? captureLink(body) : null;
  const link =
    detectedLink && kind === "text" && !forceNote ? detectedLink : null;
  const looksLikeTodo =
    /^\s*[-*+]\s+\[[ xX]\]/m.test(body) || /^\s*(?:todo|lista)\s*:/i.test(body);
  const lastNewline = !compact ? body.lastIndexOf("\n") : -1;
  const completedMarkdown =
    lastNewline >= 0 ? body.slice(0, lastNewline).trimEnd() : "";
  const committedLinesCount =
    lastNewline >= 0 ? body.slice(0, lastNewline).split("\n").length : 0;

  useLayoutEffect(() => {
    if (!mirror.current) return;
    const measure = () =>
      setHeight(
        Math.max(
          compact ? 24 : 160,
          Math.min(compact ? 180 : 340, mirror.current!.scrollHeight),
        ),
      );
    const observer = new ResizeObserver(measure);
    observer.observe(mirror.current);
    measure();
    return () => observer.disconnect();
  }, [compact, body]);
  useEffect(() => {
    if (!body.trim()) return;
    const protect = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [body]);
  async function attach(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setError("");
    try {
      for (const file of files) {
        if (
          !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
            file.type,
          )
        )
          throw new Error("Scegli un’immagine PNG, JPEG, WebP o GIF.");
        const url = await upload(file);
        const alt = file.name.replace(/[\]\\/\r\n]/g, "").slice(0, 100);
        const next = `${currentBody.current}${currentBody.current ? "\n\n" : ""}![${alt}](${url})`;
        if (next.length > 10000)
          throw new Error(
            "Non c’è spazio per l’immagine: la nota ha raggiunto 10.000 caratteri.",
          );
        currentBody.current = next;
        setBody(next);
      }
      setPreview(false);
      input.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function convertBodyToTodo(source: string) {
    if (/^\s*[-*+]\s+\[[ xX]\]/m.test(source)) return source;
    const trimmed = source.replace(/^\s*(?:todo|lista)\s*:\s*/i, "").trim();
    if (!trimmed) return "- [ ] ";
    const lines = trimmed.split(/\r?\n/);
    return lines
      .map((line, i) => {
        if (!line.trim()) return line;
        if (i === 0 && /^#{1,6}\s+/.test(line)) return line;
        return `- [ ] ${line.replace(/^\s*[-*+]\s+/, "")}`;
      })
      .join("\n");
  }
  function save() {
    if (busy) return;
    try {
      const effectiveSource = kind === "data" ? convertBodyToTodo(body) : body;
      onSave(link ?? parseCapture(effectiveSource, kind, title));
      if (compact) {
        setBody("");
        setTitle("");
        setKind("text");
        setForceNote(false);
        setPreview(false);
        input.current?.focus();
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <form
      className={`capture-composer ${compact ? "capture-bar" : "capture-editor"} ${body ? "has-content" : ""}`}
      aria-label={compact ? "Cattura rapida" : "Editor appunto"}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          save();
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        void attach([...e.dataTransfer.files]);
      }}
    >
      {!compact && (
        <label>
          Titolo
          <input
            value={title}
            maxLength={120}
            placeholder="Facoltativo: puoi iniziare con # Titolo"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      )}
      {!compact && !preview && completedMarkdown && (
        <div
          key={committedLinesCount}
          className="composer-live-markdown"
          aria-label="Rendering Markdown in tempo reale"
          title="Doppio clic per posizionarti nel testo"
          onDoubleClick={() => input.current?.focus()}
        >
          <span className="composer-live-badge">
            Markdown renderizzato ({committedLinesCount}{" "}
            {committedLinesCount === 1 ? "riga" : "righe"})
          </span>
          <MarkdownContent text={completedMarkdown} />
        </div>
      )}
      <div className="composer-writing">
        {preview ? (
          <div
            className="composer-preview"
            onDoubleClick={() => {
              setPreview(false);
              setTimeout(() => input.current?.focus(), 0);
            }}
          >
            <MarkdownContent text={body} />
          </div>
        ) : (
          <div className="composer-input-wrap">
            <textarea
              autoFocus={!compact}
              ref={input}
              aria-label={compact ? "Appunta qualcosa" : "Contenuto Markdown"}
              placeholder={
                compact
                  ? "Appunta qualcosa…"
                  : "Scrivi in Markdown… (vai a capo con Invio per renderizzare)"
              }
              maxLength={10000}
              rows={1}
              style={{ height }}
              value={body}
              onChange={(e) => {
                const next = e.target.value;
                setBody(next);
                if (!next.trim()) {
                  setKind("text");
                  setForceNote(false);
                }
                setError("");
              }}
              onPaste={(e) => {
                const files = [...e.clipboardData.files];
                if (files.length) {
                  e.preventDefault();
                  void attach(files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && compact) {
                  e.stopPropagation();
                  e.currentTarget.blur();
                }
              }}
            />
            <div ref={mirror} className="composer-mirror" aria-hidden="true">
              {body + "\n"}
            </div>
          </div>
        )}
        <label
          className={`composer-attachment ${busy ? "uploading" : ""}`}
          title="Aggiungi immagini o GIF"
        >
          <Paperclip size={18} />
          <input
            type="file"
            aria-label="Aggiungi immagini o GIF"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            disabled={busy}
            onChange={(e) => {
              void attach([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {(body || !compact) && (
        <div
          className="composer-toolbar"
          role="group"
          aria-label="Scegli cosa aggiungere"
        >
          {compact && (
            <span className="composer-kind-label">
              {link
                ? "Rilevato link:"
                : looksLikeTodo || kind === "data"
                  ? "Aggiungi:"
                  : "Cosa aggiungere:"}
            </span>
          )}
          <button
            type="button"
            className="composer-mode"
            aria-label="Aggiungi come nota"
            aria-pressed={kind === "text" && !link}
            title="Salva come Nota sul desktop"
            onClick={() => {
              setKind("text");
              setForceNote(true);
              setError("");
              setPreview(false);
              input.current?.focus();
            }}
          >
            <StickyNote size={16} />
            <span>Nota</span>
          </button>
          <button
            type="button"
            className={`composer-mode ${looksLikeTodo && kind !== "data" ? "is-suggested" : ""}`}
            aria-label="Trasforma in TODO"
            aria-pressed={kind === "data"}
            title="Salva come lista Todo"
            onClick={() => {
              setKind("data");
              setForceNote(false);
              setError("");
              if (!/^\s*[-*+]\s+\[[ xX]\]/m.test(body)) {
                setBody((old) => convertBodyToTodo(old));
              }
              setPreview(false);
              input.current?.focus();
            }}
          >
            <ListTodo size={17} />
            <span>Todo</span>
          </button>
          {detectedLink && (
            <button
              type="button"
              className="composer-mode"
              aria-label="Aggiungi come collegamento"
              aria-pressed={Boolean(link)}
              title="Salva come Collegamento rapido"
              onClick={() => {
                setKind("text");
                setForceNote(false);
                setError("");
                input.current?.focus();
              }}
            >
              <Link2 size={16} />
              <span>Collegamento</span>
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label={preview ? "Continua a scrivere" : "Anteprima Markdown"}
            aria-pressed={preview}
            onClick={() => setPreview(!preview)}
          >
            {preview ? <Pencil size={17} /> : <Eye size={17} />}
          </button>
          <span className="composer-hint">
            {busy
              ? "Carico l’immagine…"
              : link
                ? "Diventerà un collegamento · ⌘ / Ctrl + Invio"
                : looksLikeTodo && kind === "text"
                  ? "Rilevata lista · clicca Todo o premi ⌘ / Ctrl + Invio"
                  : "⌘ / Ctrl + Invio salva"}
          </span>
          <button
            className="composer-save"
            aria-label={
              link
                ? "Crea collegamento"
                : kind === "data"
                  ? "Salva TODO"
                  : "Salva nota"
            }
            title={link ? "Trasforma in collegamento" : "Salva nel desktop"}
            disabled={!body.trim() || busy}
          >
            <ArrowUp size={18} />
            {!compact && <span>Salva {kind === "data" ? "TODO" : "nota"}</span>}
          </button>
        </div>
      )}
      {error && (
        <p className="composer-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
