import { useEffect, useRef } from "react";

export type AnimatedKind = "ascii" | "noise";

// 4×4 ordered-dither thresholds in (0, 1).
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v + 0.5) / 16,
);
const threshold = (x: number, y: number) => bayer[(y & 3) * 4 + (x & 3)];

const hex = (value: string): [number, number, number] => {
  const n = parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const isDark = ([r, g, b]: number[]) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b < 128;

// Classic Perlin noise: gradient lattice with quintic fade.
const perm = (() => {
  const p = Array.from({ length: 256 }, (_, i) => i);
  let seed = 7;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return Uint8Array.from([...p, ...p]);
})();
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const grad = (hash: number, x: number, y: number, z: number) => {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
};
export function perlin(x: number, y: number, z: number) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = perm[X] + Y;
  const AA = perm[A] + Z;
  const AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y;
  const BA = perm[B] + Z;
  const BB = perm[B + 1] + Z;
  return lerp(
    lerp(
      lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
      lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u),
      v,
    ),
    lerp(
      lerp(
        grad(perm[AA + 1], x, y, z - 1),
        grad(perm[BA + 1], x - 1, y, z - 1),
        u,
      ),
      lerp(
        grad(perm[AB + 1], x, y - 1, z - 1),
        grad(perm[BB + 1], x - 1, y - 1, z - 1),
        u,
      ),
      v,
    ),
    w,
  );
}

type Painter = (t: number) => void;
/** Reduced-motion users still get the wallpaper they chose, just calmer. */
const calm = 0.4;

/** Slow Perlin clouds, quantised to four tones with ordered dithering. */
function noisePainter(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  background: string,
  speed: number,
  _center?: Center,
): Painter {
  const cell = 4;
  const w = Math.ceil(width / cell);
  const h = Math.ceil(height / cell);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(w, h);
  const base = hex(background);
  const ink = isDark(base) ? [255, 255, 255] : [0, 0, 0];
  const strength = 0.17;
  const tones = [0, 1, 2, 3].map((i) =>
    base.map((c, k) => Math.round(lerp(c, ink[k], (i / 3) * strength))),
  );
  return (time) => {
    // Noise morphs in depth and drifts sideways: clearly alive, never busy.
    const z = time * 0.0004 * speed;
    const drift = time * 0.0006 * speed;
    const scale = 0.035 * (cell / 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n =
          perlin(x * scale + drift, y * scale, z) +
          0.5 *
            perlin(x * scale * 2.1 + drift * 1.4, y * scale * 2.1, z * 1.6 + 9);
        const value = Math.min(1, Math.max(0, 0.5 + n * 0.55));
        const level = Math.min(3, Math.floor(value * 3 + threshold(x, y)));
        const tone = tones[level];
        const i = (y * w + x) * 4;
        image.data[i] = tone[0];
        image.data[i + 1] = tone[1];
        image.data[i + 2] = tone[2];
        image.data[i + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
  };
}

const phrase = "EDON · NODE · ";
const ramp = " .:-=+*#%@";
type Center = () => { x: number; y: number };
/**
 * A disc centred on the wordmark that turns as one piece: rings of real EDON · NODE
 * lettering set along the circumference, with dithered ASCII shading in the bands between.
 */
function asciiPainter(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  background: string,
  speed: number,
  center: Center,
): Painter {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext("2d")!;
  const ink = isDark(hex(background)) ? "244,245,239" : "20,24,18";
  const cell = 13;
  const inner = 70; // radius of the dithered sun at the centre
  const pitch = 56; // one text ring plus one shading band
  const first = center();
  const reach =
    Math.hypot(
      Math.max(first.x, width - first.x),
      Math.max(first.y, height - first.y),
    ) + pitch;
  const bands = Math.ceil((reach - inner) / pitch);
  const family = '"Space Grotesk Variable", "Helvetica Neue", sans-serif';
  // Letter slots are laid out once per ring, then stretched to close the loop exactly.
  const rings: { r: number; size: number; slots: [string, number][] }[] = [];
  for (let b = 0; b < bands; b += 2) {
    const r = inner + b * pitch + pitch / 2;
    const size = Math.round(Math.min(30, 14 + r * 0.011));
    ctx.font = `600 ${size}px ${family}`;
    const unit = [...phrase].map(
      (ch) => ctx.measureText(ch).width + size * 0.12,
    );
    const phraseWidth = unit.reduce((a, b) => a + b, 0);
    const copies = Math.max(1, Math.round((Math.PI * 2 * r) / phraseWidth));
    const total = copies * phraseWidth;
    const slots: [string, number][] = [];
    let at = 0;
    for (let c = 0; c < copies; c++)
      [...phrase].forEach((ch, i) => {
        slots.push([ch, ((at + unit[i] / 2) / total) * Math.PI * 2]);
        at += unit[i];
      });
    rings.push({ r, size, slots });
  }
  const shades = Array.from(
    { length: 9 },
    (_, i) => `rgba(${ink},${(0.05 + i * 0.03).toFixed(2)})`,
  );
  const tau = Math.PI * 2;
  return (time) => {
    const { x: cx, y: cy } = center();
    const spin = ((time * 0.001 * speed * 0.012) % 1) * tau; // the whole disc: one angle
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    // thin tracks on both sides of every text ring
    ctx.strokeStyle = `rgba(${ink},0.09)`;
    ctx.lineWidth = 1;
    for (let b = 0; b < bands; b += 2)
      for (const r of [inner + b * pitch + 4, inner + (b + 1) * pitch - 4]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, tau);
        ctx.stroke();
      }
    // dithered shading between the rings
    ctx.font = `600 ${cell}px "SFMono-Regular", Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const t = time * 0.001 * speed;
    const lines = Math.ceil(height / cell);
    const columns = Math.ceil(width / cell);
    for (let j = 0; j < lines; j++)
      for (let i = 0; i < columns; i++) {
        const x = i * cell + cell / 2;
        const y = j * cell + cell / 2;
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        if (r > reach) continue;
        const fade = 1 - 0.65 * Math.min(1, r / reach);
        let density: number;
        if (r < inner) {
          density = 0.95 - (r / inner) * 0.55;
        } else {
          const band = Math.floor((r - inner) / pitch);
          if (band % 2 === 0) continue; // a text ring lives here
          const local = (r - inner) / pitch - band;
          const turn = (Math.atan2(dy, dx) - spin) / tau;
          const wave =
            0.5 + 0.5 * Math.sin(turn * tau * 4 + band * 1.7 - t * 1.4);
          density = wave * (1 - Math.abs(local - 0.5) * 0.9) * fade;
        }
        const level = Math.floor(
          Math.max(0, Math.min(0.999, density)) * (ramp.length - 1) +
            threshold(i, j),
        );
        if (level < 1) continue;
        ctx.fillStyle = shades[Math.min(8, Math.round(density * 8))];
        ctx.fillText(ramp[Math.min(ramp.length - 1, level)], x, y);
      }
    // the lettering, rotating with the disc
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const { r, size, slots } of rings) {
      ctx.font = `600 ${size}px ${family}`;
      ctx.fillStyle = `rgba(${ink},${(0.62 - 0.4 * Math.min(1, r / reach)).toFixed(2)})`;
      for (const [ch, angle] of slots) {
        if (ch === " ") continue;
        const a = angle + spin;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (x < -40 || x > width + 40 || y < -40 || y > height + 40) continue;
        const f = a + Math.PI / 2; // letters stand on the circle, tops pointing outward
        const cos = Math.cos(f) * dpr;
        const sin = Math.sin(f) * dpr;
        ctx.setTransform(cos, sin, -sin, cos, x * dpr, y * dpr);
        ctx.fillText(ch, 0, 0);
      }
    }
  };
}

/** Full-screen animated wallpaper; the browser pauses it when the tab is hidden. */
export function AnimatedWallpaper({
  kind,
  background,
  contained = false,
  still = false,
}: {
  kind: AnimatedKind;
  background: string;
  contained?: boolean;
  still?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let paint: Painter | undefined;
    let last = 0;
    const interval = kind === "noise" ? 1000 / 15 : 1000 / 24;
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (time - last < interval) return;
      last = time;
      paint?.(time);
    };
    const setup = () => {
      cancelAnimationFrame(frame);
      const rect = contained
        ? parent.getBoundingClientRect()
        : { width: innerWidth, height: innerHeight };
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      // The disc is centred on the "edon" wordmark wherever the header puts it.
      const center: Center = () => {
        const mark = contained ? null : document.querySelector(".wordmark");
        const box = mark?.getBoundingClientRect();
        return box
          ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
          : { x: width * 0.12, y: height * 0.14 };
      };
      paint = (kind === "noise" ? noisePainter : asciiPainter)(
        canvas,
        width,
        height,
        background,
        motion.matches ? calm : 1,
        center,
      );
      paint(0);
      if (!still) frame = requestAnimationFrame(loop);
    };
    setup();
    const observer = new ResizeObserver(setup);
    observer.observe(contained ? parent : document.documentElement);
    motion.addEventListener("change", setup);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", setup);
    };
  }, [kind, background, contained, still]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`animated-wallpaper wallpaper-${kind} ${contained ? "contained" : ""}`}
    />
  );
}
