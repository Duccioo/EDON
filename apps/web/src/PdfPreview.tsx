import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";

type PdfDocument = import("pdfjs-dist").PDFDocumentProxy;
const documents = new Map<string, Promise<PdfDocument>>();
/** pdf.js is large: it loads only when the first PDF tile appears. */
function openPdf(url: string) {
  let doc = documents.get(url);
  if (!doc) {
    doc = (async () => {
      const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs.getDocument({ url }).promise;
    })();
    doc.catch(() => documents.delete(url));
    documents.set(url, doc);
  }
  return doc;
}

/** First page of an uploaded PDF, drawn to fill the width of its container. */
export function PdfPreview({ url, title }: { url: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!width || !canvas.current) return;
    let cancelled = false;
    let task: { cancel: () => void } | undefined;
    openPdf(url)
      .then(async (pdf) => {
        const page = await pdf.getPage(1);
        if (cancelled || !canvas.current) return;
        const base = page.getViewport({ scale: 1 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({
          scale: (width / base.width) * ratio,
        });
        canvas.current.width = Math.floor(viewport.width);
        canvas.current.height = Math.floor(viewport.height);
        const render = page.render({ canvas: canvas.current, viewport });
        task = render;
        await render.promise;
        setFailed(false);
      })
      .catch((e) => {
        if (!cancelled && e?.name !== "RenderingCancelledException")
          setFailed(true);
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [url, width]);
  return (
    <div ref={box} className="pdf-preview" role="img" aria-label={title}>
      {failed ? (
        <div className="pdf-fallback">
          <FileText size={34} />
          <span>Anteprima non disponibile</span>
        </div>
      ) : (
        <canvas ref={canvas} />
      )}
    </div>
  );
}
