import { useEffect, useRef, useId, type ReactNode } from "react";
import { PanelLeft, PanelRight, X } from "lucide-react";
export function Modal({
  title,
  onClose,
  children,
  className = "",
  sourceId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  sourceId?: string;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const animation = useRef<Animation>();
  const closing = useRef(false);
  const collapsedTransform = useRef("translateY(10px) scale(.96)");
  closeRef.current = onClose;
  function close() {
    if (closing.current) return;
    closing.current = true;
    const dialog = ref.current!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      closeRef.current();
      return;
    }
    animation.current?.cancel();
    dialog.dataset.closing = "true";
    animation.current = dialog.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: collapsedTransform.current },
      ],
      {
        duration: sourceId ? 260 : 180,
        easing: "cubic-bezier(.4,0,1,1)",
        fill: "forwards",
      },
    );
    animation.current.onfinish = () => closeRef.current();
  }
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement;
    dialog.showModal();
    dialog
      .querySelector<HTMLElement>(
        ".capture-editor textarea, .agent-creator textarea",
      )
      ?.focus();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const source = sourceId
        ? document.getElementById(sourceId)?.getBoundingClientRect()
        : null;
      const target = dialog.getBoundingClientRect();
      const visible = source && source.bottom > 0 && source.top < innerHeight;
      const from = visible
        ? `translate(${source.x + source.width / 2 - target.x - target.width / 2}px, ${source.y + source.height / 2 - target.y - target.height / 2}px) scale(${Math.min(1, source.width / target.width)}, ${Math.min(1, source.height / target.height)})`
        : "translateY(16px) scale(.96)";
      collapsedTransform.current = from;
      animation.current = dialog.animate(
        [
          { opacity: 0, transform: from },
          { opacity: 1, transform: "none" },
        ],
        { duration: visible ? 420 : 300, easing: "cubic-bezier(.16,1,.3,1)" },
      );
    }
    return () => {
      animation.current?.cancel();
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, [sourceId]);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="panel-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="Chiudi">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function SideWorkspace({
  title,
  side,
  onSideChange,
  onClose,
  wide = false,
  className = "",
  children,
}: {
  title: string;
  side: "left" | "right";
  onSideChange: (side: "left" | "right") => void;
  onClose: () => void;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>(".capture-editor textarea")
      ?.focus();
  }, [title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={`side-workspace side-${side} ${wide ? "side-wide" : ""} ${className}`}
    >
      <div className="panel-heading side-workspace-heading">
        <h2 id={titleId}>{title}</h2>
        <div className="side-workspace-controls">
          <button
            type="button"
            className="icon-button"
            aria-label={
              side === "right" ? "Mostra a sinistra" : "Mostra a destra"
            }
            title={
              side === "right"
                ? "Mostra il documento a sinistra"
                : "Mostra il documento a destra"
            }
            onClick={() => onSideChange(side === "right" ? "left" : "right")}
          >
            {side === "right" ? (
              <PanelLeft size={18} />
            ) : (
              <PanelRight size={18} />
            )}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Chiudi"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      {children}
    </aside>
  );
}
