import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MarkdownContent } from "./MarkdownContent";

/** Keep Markdown as the source of truth; only the active block shows its source. */
export function NoteEditor({
  body,
  onChange,
}: {
  body: string;
  onChange: (body: string) => void;
}) {
  const [plain, setPlain] = useState(false);
  const [range, setRange] = useState({ start: body.length, end: body.length });
  const history = useRef<{ body: string; range: typeof range }[]>([]);
  const future = useRef<{ body: string; range: typeof range }[]>([]);
  const lastTyping = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const start = Math.min(range.start, body.length);
  const end = Math.min(range.end, body.length);
  const active = body.slice(start, end);

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(36, el.scrollHeight)}px`;
    if (pendingCaret.current !== null) {
      el.focus();
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [body, range, plain]);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      el.style.height = "0px";
      el.style.height = `${Math.max(36, el.scrollHeight)}px`;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [plain]);

  function selectBlock(offset: number, blockStart: number, blockEnd: number) {
    lastTyping.current = 0;
    pendingCaret.current = 0;
    setRange({ start: offset + blockStart, end: offset + blockEnd });
  }

  function commit(next: string, nextRange: typeof range, typing = false) {
    if (next === body) return;
    const now = Date.now();
    if (!typing || now - lastTyping.current > 750) {
      history.current.push({ body, range });
      if (history.current.length > 100) history.current.shift();
    }
    lastTyping.current = typing ? now : 0;
    future.current = [];
    setRange(nextRange);
    onChange(next);
  }

  function replace(value: string) {
    // A new block needs a separator, but opening a note must never change its text.
    const prefix =
      start === end && start === body.length && body && !body.endsWith("\n\n")
        ? body.endsWith("\n")
          ? "\n"
          : "\n\n"
        : "";
    const next = body.slice(0, start) + prefix + value + body.slice(end);
    if (next.length > 10000) return;
    commit(
      next,
      {
        start: start + prefix.length,
        end: start + prefix.length + value.length,
      },
      true,
    );
  }

  return (
    <div
      className="text-body note-document"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
        const key = e.key.toLowerCase();
        if (key !== "z" && key !== "y") return;
        e.preventDefault();
        const redo = key === "y" || e.shiftKey;
        const from = redo ? future.current : history.current;
        const to = redo ? history.current : future.current;
        const previous = from.pop();
        if (!previous) return;
        to.push({ body, range });
        lastTyping.current = 0;
        pendingCaret.current = plain
          ? previous.body.length
          : previous.range.end - previous.range.start;
        setRange(previous.range);
        onChange(previous.body);
      }}
    >
      <div className="note-editor-toolbar">
        <span>
          {plain
            ? "Markdown sorgente"
            : "Invio: nuovo blocco · Maiusc+Invio: a capo"}
        </span>
        <button
          className="note-mode-toggle"
          aria-pressed={plain}
          aria-label={
            plain ? "Modalità Markdown compilato" : "Modalità testo normale"
          }
          onClick={() => {
            lastTyping.current = 0;
            setPlain(!plain);
            setRange({ start: body.length, end: body.length });
          }}
        >
          {plain ? "Markdown live" : "Testo normale"}
        </button>
      </div>
      {plain ? (
        <textarea
          ref={input}
          className="inline-note-plain"
          aria-label="Contenuto nota in testo normale"
          value={body}
          maxLength={10000}
          onChange={(e) =>
            commit(
              e.target.value,
              { start: e.target.value.length, end: e.target.value.length },
              true,
            )
          }
        />
      ) : (
        <div className="inline-note-surface">
          <MarkdownContent
            className="inline-note-markdown"
            text={body.slice(0, start)}
            onEditBlock={(a, b) => selectBlock(0, a, b)}
          />
          <textarea
            ref={input}
            className="inline-note-line"
            rows={1}
            aria-label="Scrivi una riga Markdown"
            placeholder="Scrivi qui…"
            value={active}
            maxLength={Math.max(0, 10000 - (body.length - active.length))}
            onChange={(e) => replace(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.key !== "Enter" || e.shiftKey)
                return;
              // Keep multiline Markdown structures intact while editing their source.
              if (/^\s*(```|~~~|[-+*] |\d+[.)] |> |\|)/.test(active)) return;
              e.preventDefault();
              const el = e.currentTarget;
              const a = start + el.selectionStart;
              const b = start + el.selectionEnd;
              const next = body.slice(0, a) + "\n\n" + body.slice(b);
              if (next.length > 10000) return;
              pendingCaret.current = 0;
              commit(next, { start: a + 2, end: end + 2 - (b - a) });
            }}
          />
          <MarkdownContent
            className="inline-note-markdown"
            text={body.slice(end)}
            onEditBlock={(a, b) => selectBlock(end, a, b)}
          />
        </div>
      )}
    </div>
  );
}
