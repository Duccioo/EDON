import { safeLink, type Tile } from "./model";

export type NoteCapture = {
  kind: "text" | "data";
  title: string;
  body: string;
  items: Tile["config"]["items"];
};
export type LinkCapture = {
  kind: "link";
  title: string;
  url: string;
  icon: string;
};
export type Capture = NoteCapture | LinkCapture;

/** A capture that is nothing but one web link becomes a shortcut tile. */
export function captureLink(source: string): LinkCapture | null {
  const url = source.trim();
  if (url.length > 2048 || !/^(?:https?|obsidian):\/\/\S+$/i.test(url))
    return null;
  if (!safeLink(url)) return null;
  const parsed = new URL(url);
  const title =
    parsed.protocol === "obsidian:"
      ? "Obsidian"
      : parsed.hostname.replace(/^www\./i, "") || "Collegamento";
  return { kind: "link", title, url, icon: title[0].toUpperCase() };
}

/** Extracts real Markdown checkboxes, leaving context, media and fenced code intact. */
export function parseCapture(
  source: string,
  kind: NoteCapture["kind"],
  title = "",
): NoteCapture {
  if (!source.trim()) throw new Error("Scrivi qualcosa da appuntare.");
  if (source.length > 10000)
    throw new Error("Usa al massimo 10.000 caratteri.");
  const lines = source.trim().split(/\r?\n/);
  const heading = /^#{1,6}\s+(.+)$/.exec(lines[0]);
  const inferred =
    heading?.[1] ??
    lines
      .find((line) => line.trim() && !/^\s*!\[/.test(line))
      ?.replace(/^\s*[-*+]\s+\[[ xX]\]\s*/, "") ??
    "Un appunto";
  const items: NoteCapture["items"] = [];
  const body: string[] = [];
  let fence: { marker: string; length: number } | undefined;
  for (const [i, line] of lines.entries()) {
    const mark = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (mark) {
      if (!fence) fence = { marker: mark[0], length: mark.length };
      else if (mark[0] === fence.marker && mark.length >= fence.length)
        fence = undefined;
      body.push(line);
      continue;
    }
    const task =
      !fence && kind === "data"
        ? /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line)
        : null;
    if (task) {
      if (!task[2].trim())
        throw new Error(
          "Scrivi il testo dopo - [ ] per aggiungere un’attività.",
        );
      if (task[2].length > 300)
        throw new Error(
          "Ogni attività può contenere al massimo 300 caratteri.",
        );
      items.push({
        id: crypto.randomUUID(),
        text: task[2].trim(),
        done: task[1].toLowerCase() === "x",
      });
    } else if (!(i === 0 && heading && !title.trim())) body.push(line);
  }
  if (kind === "data" && !items.length)
    throw new Error(
      "Aggiungi almeno un’attività con - [ ] prima di salvare il TODO.",
    );
  if (items.length > 30)
    throw new Error("Puoi inserire al massimo 30 attività.");
  return {
    kind,
    title: (title.trim() || inferred).slice(0, 120),
    body: body.join("\n").trim(),
    items,
  };
}

export function captureSource(tile: Tile) {
  return [
    tile.config.body,
    ...tile.config.items.map(
      (item) => `- [${item.done ? "x" : " "}] ${item.text}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}
