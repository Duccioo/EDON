import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Download,
  File as FileIcon,
  FileText,
  MapPin,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Wind,
} from "lucide-react";
import { isPdf, type Tile } from "../../../packages/shared/model";
import { request } from "./api";
import {
  isTimer,
  pauseTimer,
  restartTimer,
  resumeTimer,
  timerSpan,
} from "../../../packages/shared/timer";
import { PdfPreview } from "./PdfPreview";

type Weather = {
  location: string;
  temperature: number;
  code: number;
  isDay: boolean;
  wind: number;
  min: number;
  max: number;
};

/** WMO weather interpretation codes → icon and label. */
function condition(code: number, isDay: boolean) {
  if (code === 0) return { Icon: isDay ? Sun : Moon, label: "Sereno" };
  if (code <= 2)
    return { Icon: isDay ? CloudSun : CloudMoon, label: "Poco nuvoloso" };
  if (code === 3) return { Icon: Cloud, label: "Nuvoloso" };
  if (code <= 48) return { Icon: CloudFog, label: "Nebbia" };
  if (code <= 57) return { Icon: CloudDrizzle, label: "Pioggerella" };
  if (code <= 67) return { Icon: CloudRain, label: "Pioggia" };
  if (code <= 77) return { Icon: CloudSnow, label: "Neve" };
  if (code <= 82) return { Icon: CloudRain, label: "Rovesci" };
  if (code <= 86) return { Icon: CloudSnow, label: "Nevischio" };
  return { Icon: CloudLightning, label: "Temporale" };
}

export function WeatherTile({ tile }: { tile: Tile }) {
  const city = tile.config.location.trim();
  const [data, setData] = useState<Weather | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setData(null);
    setError("");
    if (!city) return;
    let cancelled = false;
    const load = () =>
      request<Weather>(`/api/weather?q=${encodeURIComponent(city)}`)
        .then((value) => {
          if (cancelled) return;
          setData(value);
          setError("");
        })
        .catch((e: Error) => !cancelled && setError(e.message));
    void load();
    const id = setInterval(load, 15 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [city]);
  const now = data ? condition(data.code, data.isDay) : null;
  return (
    <>
      <div className="tile-top">
        <span className="weather-place">
          <MapPin size={12} aria-hidden="true" />
          {data?.location ?? (tile.title || "Meteo")}
        </span>
        {now && <now.Icon size={18} aria-hidden="true" />}
      </div>
      {data && now ? (
        <>
          <div
            className="weather-temp"
            aria-label={`${data.temperature} gradi`}
          >
            {data.temperature}°
          </div>
          <div className="weather-bottom">
            <span>{tile.subtitle || now.label}</span>
            <span>
              {data.min}° / {data.max}°
            </span>
            <span className="weather-wind">
              <Wind size={11} aria-hidden="true" />
              {data.wind} km/h
            </span>
          </div>
        </>
      ) : (
        <p className="weather-note" role={error ? "alert" : undefined}>
          {!city
            ? "Scegli una città nelle proprietà della tile."
            : error || "Cerco il meteo…"}
        </p>
      )}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
export function remainingText(ms: number) {
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d >= 1) return { main: `${d} g ${h} h`, unit: "" };
  if (h >= 1) return { main: `${pad(h)}:${pad(m)}:${pad(s % 60)}`, unit: "" };
  return { main: `${pad(m)}:${pad(s % 60)}`, unit: "" };
}

export function ProgressTile({
  tile,
  editing = false,
  onConfig,
  onFinish,
}: {
  tile: Tile;
  editing?: boolean;
  /** Present on the desktop only: lets the tile pause and restart itself. */
  onConfig?: (patch: Partial<Tile["config"]>) => void;
  onFinish?: (title: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const paused = Date.parse(tile.config.pausedAt) || 0;
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);
  const { start, end } = timerSpan(tile.config, tile.createdAt);
  const at = paused || now;
  const done = !!end && at >= end;
  const finished = useRef(done);
  useEffect(() => {
    // Only a run that ends while the tile is on screen announces itself.
    if (done && !finished.current) onFinish?.(tile.title);
    finished.current = done;
  }, [done, onFinish, tile.title]);
  if (!end)
    return (
      <>
        <div className="tile-top">
          <span>{tile.title}</span>
        </div>
        <p className="weather-note">Imposta una scadenza nelle proprietà.</p>
      </>
    );
  const ratio = Math.min(
    1,
    Math.max(0, (at - start) / Math.max(1, end - start)),
  );
  const controls = !editing && onConfig && isTimer(tile.config, tile.createdAt);
  const stamp = Date.now();
  return (
    <>
      <div className="tile-top">
        <span>{tile.title}</span>
        <span className="progress-percent">{Math.floor(ratio * 100)}%</span>
      </div>
      <div
        className={`progress-main ${done ? "is-done" : ""} ${paused ? "is-paused" : ""}`}
      >
        {done ? "Fatto" : remainingText(end - at).main}
      </div>
      <div className="progress-foot">
        <span>
          {tile.subtitle ||
            (done
              ? "Tempo scaduto"
              : paused
                ? "In pausa"
                : `fino alle ${new Intl.DateTimeFormat("it-IT", {
                    ...(end - at > 24 * 3600_000
                      ? { day: "numeric", month: "short" }
                      : {}),
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(end)}`)}
        </span>
        {controls && (
          <span className="progress-controls">
            {!done && (
              <button
                aria-label={paused ? "Riprendi" : "Pausa"}
                title={paused ? "Riprendi" : "Pausa"}
                onClick={() =>
                  onConfig(
                    paused
                      ? resumeTimer(tile.config, tile.createdAt, stamp)
                      : pauseTimer(stamp),
                  )
                }
              >
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            )}
            <button
              aria-label="Riavvia"
              title="Riavvia"
              onClick={() =>
                onConfig(restartTimer(tile.config, tile.createdAt, stamp))
              }
            >
              <RotateCcw size={14} />
            </button>
          </span>
        )}
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={tile.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(ratio * 100)}
      >
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
    </>
  );
}

export const fileExtension = (url: string) =>
  (/\.([a-z0-9]{1,8})$/i.exec(url)?.[1] ?? "file").toUpperCase();

export function FileTile({
  tile,
  expanded,
}: {
  tile: Tile;
  expanded: boolean;
}) {
  const url = tile.config.file;
  if (!url)
    return (
      <>
        <div className="tile-top">
          <span>{tile.title}</span>
        </div>
        <p className="weather-note">Carica un file nelle proprietà.</p>
      </>
    );
  if (expanded)
    return isPdf(url) ? (
      <iframe
        className="pdf-frame"
        src={url}
        title={tile.title}
        referrerPolicy="no-referrer"
      />
    ) : (
      <div className="file-generic file-large">
        <FileIcon size={64} aria-hidden="true" />
        <strong>{tile.title}</strong>
        <a className="expanded-link" href={url} download={tile.title}>
          Scarica <Download size={16} />
        </a>
      </div>
    );
  return (
    <>
      {isPdf(url) ? (
        <PdfPreview url={url} title={tile.title} />
      ) : (
        <div className="file-generic">
          <FileIcon size={38} aria-hidden="true" />
        </div>
      )}
      <div className="file-caption">
        <FileText size={13} aria-hidden="true" />
        <span>{tile.title}</span>
        <small>{fileExtension(url)}</small>
        <ArrowUpRight size={15} aria-hidden="true" />
      </div>
    </>
  );
}
