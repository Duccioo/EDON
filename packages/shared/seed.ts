import {
  createTile,
  presets,
  type Desktop,
  type Tile,
  type TileType,
} from "./model";
export function seedDesktop(): Desktop {
  const tile = (
    type: TileType,
    title: string,
    x: number,
    y: number,
    w: number,
    h: number,
    extra: Partial<Tile> = {},
  ): Tile => ({ ...createTile(type, []), title, x, y, w, h, ...extra });
  const config = (body = "", icon = "↗", image = "", timezone = "") => ({
    body,
    icon,
    image,
    location: "",
    file: "",
    vaultPath: "",
    startsAt: "",
    endsAt: "",
    pausedAt: "",
    timezone,
    items: [],
    children: [],
  });
  return {
    archive: [],
    settings: {
      name: "Il mio spazio",
      gap: 14,
      maxTiles: 24,
      columns: 8,
      rows: 6,
      wallpaper: "fold",
      background: "#d7d8d5",
      wallpaperImage: "",
      radius: 14,
      padding: 24,
      border: "subtle",
      opacity: 1,
      blur: false,
    },
    tiles: [
      tile("clock", "Qui, adesso", 0, 0, 2, 1, {
        appearance: { ...presets.industrial, font: "dot" },
        config: config("", "", "", "Asia/Tokyo"),
        subtitle: "Tokyo",
      }),
      tile("image", "Meno rumore.\nPiù spazio.", 2, 0, 2, 2, {
        appearance: { ...presets.industrial, padding: 26 },
        config: config(
          "Uno spazio per le cose che contano.",
          "",
          "/art/architecture.svg",
        ),
      }),
      tile("data", "A mente libera", 4, 0, 2, 1, {
        appearance: { ...presets.glass },
        subtitle: "Piccole cose, un passo alla volta.",
        config: {
          ...config(),
          items: [
            { id: "one", text: "Dare forma a un’idea", done: true },
            { id: "two", text: "Leggere qualche pagina", done: false },
            { id: "three", text: "Fare spazio alla prossima", done: false },
          ],
        },
      }),
      tile("link", "Obsidian", 0, 1, 1, 1, {
        subtitle: "Pensieri connessi",
        url: "obsidian://open",
        config: config("", "◇"),
      }),
      tile("link", "GitHub", 1, 1, 1, 1, {
        subtitle: "Work in progress",
        url: "https://github.com",
        config: config("", "⌘"),
        appearance: { ...presets.glass },
      }),
      tile("text", "Good ideas\nlive here.", 4, 1, 2, 1, {
        appearance: {
          ...presets.minimal,
          background: "#d6ef53",
          font: "editorial",
        },
        config: config("Annota qualcosa. Lascia sedimentare.\nPoi costruisci."),
      }),
      tile("text", "Personal\nspace.", 0, 2, 2, 2, {
        appearance: { ...presets.industrial, font: "editorial" },
        subtitle: "Un piccolo manifesto",
        config: config(
          "Meno finestre aperte.\nPiù intenzione.\n\nUn posto per ritrovare il filo,\ne ripartire da quello che conta.",
        ),
      }),
      tile("image", "Orbita", 2, 2, 2, 1, {
        config: config("", "", "/art/orbit.svg"),
      }),
      tile("data", "Il prossimo passo", 4, 2, 2, 2, {
        subtitle: "EDON / Personal desktop",
        config: {
          ...config(
            "Un ambiente personale, modulare e leggero. Ogni cosa trova il suo spazio.",
          ),
          items: [
            { id: "design", text: "Direzione visiva", done: true },
            { id: "desktop", text: "Desktop interattivo", done: false },
            {
              id: "integrations",
              text: "Integrazioni, con calma",
              done: false,
            },
          ],
        },
        appearance: { ...presets.minimal },
      }),
      tile("link", "Paperclip", 2, 3, 1, 1, {
        subtitle: "Il tuo lavoro",
        url: "https://paperclip.ing",
        config: config("", "⌁"),
      }),
      tile("link", "Are.na", 3, 3, 1, 1, {
        subtitle: "Connessioni creative",
        url: "https://www.are.na",
        config: config("", "✳"),
        appearance: { ...presets.industrial },
      }),
    ],
  };
}
