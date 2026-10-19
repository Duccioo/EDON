import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Eye, ListTodo, Paperclip, Pencil } from "lucide-react";
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
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [height, setHeight] = useState(24);
  const input = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const currentBody = useRef(body);
  currentBody.current = body;
  const link = detectLinks && kind === "text" ? captureLink(body) : null;
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
          Math.min(compact ? 224 : 340, mirror.current!.scrollHeight),
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
  function save() {
    if (busy) return;
    try {
      onSave(link ?? parseCapture(body, kind, title));
      if (compact) {
        setBody("");
        setTitle("");
        setKind("text");
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
                setBody(e.target.value);
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
        <div className="composer-toolbar">
          <button
            type="button"
            className="composer-mode"
            aria-label="Trasforma in TODO"
            aria-pressed={kind === "data"}
            title="TODO dalle righe - [ ]"
            onClick={() => {
              setKind(kind === "text" ? "data" : "text");
              setError("");
              if (kind === "text" && !/^\s*[-*+]\s+\[[ xX]\]/m.test(body))
                setBody(
                  (old) => `${old.trimEnd()}${old.trim() ? "\n\n" : ""}- [ ] `,
                );
              setPreview(false);
              input.current?.focus();
            }}
          >
            <ListTodo size={17} />
            <span>Todo</span>
          </button>
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
                : "Invio renderizza la riga · ⌘ / Ctrl + Invio salva"}
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
