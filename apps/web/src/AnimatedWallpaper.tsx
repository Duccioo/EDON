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
const calm = 0.65;

/** Slow Perlin clouds, quantised to four tones with ordered dithering. */
function noisePainter(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  background: string,
  speed: number,
  _center?: Center,
): Painter {
  const cell = 6;
  const w = Math.ceil(width / cell);
  const h = Math.ceil(height / cell);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(w, h);
  const base = hex(background);
  const ink = isDark(base) ? [255, 255, 255] : [0, 0, 0];
  const strength = 0.21;
  const tones = [0, 1, 2, 3].map((i) =>
    base.map((c, k) => Math.round(lerp(c, ink[k], (i / 3) * strength))),
  );
  return (time) => {
    // Noise morphs in depth and drifts sideways: clearly alive, never busy.
    const z = time * 0.00075 * speed;
    const drift = time * 0.0011 * speed;
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
  const origin = center();
  const reach =
    Math.ceil(
      Math.hypot(
        Math.max(origin.x, width - origin.x),
        Math.max(origin.y, height - origin.y),
      ),
    ) + 80;
  // Cache the entire disc once; each frame only composites one rotated bitmap.
  const disc = document.createElement("canvas");
  const scale = Math.min(1, 2048 / (reach * 2));
  disc.width = disc.height = Math.ceil(reach * 2 * scale);
  const ctx = disc.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.translate(reach, reach);
  const ink = isDark(hex(background)) ? "244,245,239" : "20,24,18";
  const tau = Math.PI * 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let r = 98; r < reach; r += 168) {
    const size = Math.min(28, 14 + r * 0.011);
    ctx.font = `600 ${size}px "Space Grotesk Variable", sans-serif`;
    const copies = Math.max(
      1,
      Math.floor((tau * r) / (size * phrase.length * 1.4)),
    );
    const letters = [...phrase.repeat(copies)];
    ctx.fillStyle = `rgba(${ink},${0.58 - (0.28 * r) / reach})`;
    letters.forEach((ch, i) => {
      if (ch === " ") return;
      const a = (i / letters.length) * tau;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(r, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.strokeStyle = `rgba(${ink},0.12)`;
    for (const radius of [r - 24, r + 24]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, tau);
      ctx.stroke();
    }
  }
  ctx.font = '12px "SFMono-Regular", Consolas, monospace';
  ctx.fillStyle = `rgba(${ink},0.18)`;
  for (let y = -reach; y < reach; y += 24)
    for (let x = -reach; x < reach; x += 24) {
      const r = Math.hypot(x, y);
      if (r > reach || (r > 70 && (r - 70) % 168 < 60)) continue;
      const density =
        (1 - r / reach) * (0.5 + 0.5 * Math.sin(Math.atan2(y, x) * 4));
      const level = Math.floor(
        density * (ramp.length - 1) + threshold(x / 24, y / 24),
      );
      if (level > 0) ctx.fillText(ramp[level], x, y);
    }
  canvas.width = width;
  canvas.height = height;
  const output = canvas.getContext("2d")!;
  return (time) => {
    const { x, y } = center();
    output.setTransform(1, 0, 0, 1, 0, 0);
    output.clearRect(0, 0, width, height);
    output.translate(x, y);
    output.rotate(time * 0.001 * speed * 0.032 * tau);
    output.drawImage(disc, -reach, -reach, reach * 2, reach * 2);
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
    let lastWidth = 0;
    let lastHeight = 0;
    const interval = kind === "noise" ? 1000 / 12 : 1000 / 24;
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (document.hidden || time - last < interval) return;
      last = time;
      paint?.(time);
    };
    const setup = (force = true) => {
      const rect = contained
        ? parent.getBoundingClientRect()
        : { width: innerWidth, height: innerHeight };
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (!force && width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      cancelAnimationFrame(frame);
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
    setup(true);
    const observer = new ResizeObserver(() => setup(false));
    observer.observe(contained ? parent : document.documentElement);
    const onMotion = () => setup(true);
    motion.addEventListener("change", onMotion);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
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
