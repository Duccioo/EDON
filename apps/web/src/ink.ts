import { useEffect, useState } from "react";
import { readableInk, type Desktop } from "../../../packages/shared/model";

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** Text colour for the header and empty state: it follows the wallpaper, photos included. */
export function useDesktopInk(settings?: Desktop["settings"]) {
  const background = settings?.background ?? "#d7d8d5";
  const image =
    settings?.wallpaper === "image" ? (settings.wallpaperImage ?? "") : "";
  const [ink, setInk] = useState(readableInk(background));
  useEffect(() => {
    setInk(readableInk(background));
    if (!image) return;
    let cancelled = false;
    const photo = new Image();
    photo.onload = () => {
      try {
        const size = 16;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(photo, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        const n = data.length / 4;
        if (!cancelled) setInk(readableInk(toHex(r / n, g / n, b / n)));
      } catch {
        /* a remote image we cannot read: the background colour decides */
      }
    };
    photo.src = image;
    return () => {
      cancelled = true;
    };
  }, [background, image]);
  return ink;
}
