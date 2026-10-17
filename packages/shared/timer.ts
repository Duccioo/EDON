import type { Tile } from "./model";

type Window = Pick<Tile["config"], "startsAt" | "endsAt" | "pausedAt">;
const iso = (ms: number) => new Date(ms).toISOString();

/** A tile that was never given a start counts from its creation. */
export function timerSpan(config: Window, createdAt: string) {
  return {
    start: Date.parse(config.startsAt) || Date.parse(createdAt),
    end: Date.parse(config.endsAt),
  };
}
/** Up to a day is a timer you start, pause and restart; longer is a deadline you only watch. */
export function isTimer(config: Window, createdAt: string) {
  const { start, end } = timerSpan(config, createdAt);
  return end > start && end - start <= 24 * 3600_000;
}
export const pauseTimer = (now: number): Pick<Window, "pausedAt"> => ({
  pausedAt: iso(now),
});
export function resumeTimer(config: Window, createdAt: string, now: number) {
  const { start, end } = timerSpan(config, createdAt);
  const paused = Date.parse(config.pausedAt) || now;
  const shift = Math.max(0, now - paused);
  return {
    startsAt: iso(start + shift),
    endsAt: iso(end + shift),
    pausedAt: "",
  };
}
export function restartTimer(config: Window, createdAt: string, now: number) {
  const { start, end } = timerSpan(config, createdAt);
  return { startsAt: iso(now), endsAt: iso(now + (end - start)), pausedAt: "" };
}
