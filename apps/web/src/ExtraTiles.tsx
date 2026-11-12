import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cpu,
  Download,
  File as FileIcon,
  FileText,
  HardDrive,
  MapPin,
  Moon,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
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

export type SystemPerformance = {
  cpuPercent: number;
  cores: number;
  memUsedBytes: number;
  memTotalBytes: number;
  memPercent: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
  diskPercent: number;
  loadAvg: [number, number, number];
  uptimeSeconds: number;
  hostname: string;
  platform: string;
  arch: string;
};

const formatGiB = (bytes: number) =>
  bytes > 0 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : "—";

const formatUptime = (seconds: number) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}g ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export function PerformanceTile({ tile }: { tile: Tile }) {
  const [perf, setPerf] = useState<SystemPerformance | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      request<SystemPerformance>("/api/performance")
        .then((res) => {
          if (!cancelled) setPerf(res);
        })
        .catch(() => {});
    void load();
    const id = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const metrics = [
    {
      key: "cpu",
      label: "CPU",
      percent: perf?.cpuPercent ?? 0,
      detail: perf ? `${perf.cores} core` : "…",
      Icon: Cpu,
    },
    {
      key: "ram",
      label: "RAM",
      percent: perf?.memPercent ?? 0,
      detail: perf
        ? `${formatGiB(perf.memUsedBytes)} / ${formatGiB(perf.memTotalBytes)}`
        : "…",
      Icon: Activity,
    },
    {
      key: "disk",
      label: "Disco",
      percent: perf?.diskPercent ?? 0,
      detail: perf ? formatGiB(perf.diskUsedBytes) : "…",
      Icon: HardDrive,
    },
  ];

  return (
    <div className="perf-tile">
      <div className="tile-top">
        <span className="perf-heading">
          <Activity size={13} aria-hidden="true" />
          {tile.title || "Prestazioni"}
        </span>
        <span className="perf-live">
          <span className="live-dot" />
          {perf ? `${perf.cpuPercent}%` : "LIVE"}
        </span>
      </div>

      <div className="perf-grid" role="group" aria-label="Metriche di sistema">
        {metrics.map(({ key, label, percent, detail, Icon }) => (
          <div key={key} className="perf-row">
            <div className="perf-row-head">
              <span className="perf-label">
                <Icon size={12} aria-hidden="true" />
                {label}
              </span>
              <small className="perf-detail">{detail}</small>
              <strong className="perf-val">{percent}%</strong>
            </div>
            <div
              className={`perf-bar ${percent >= 85 ? "is-high" : percent >= 65 ? "is-mid" : ""}`}
              role="progressbar"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span style={{ width: `${Math.max(4, percent)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="perf-foot">
        <span>
          {tile.subtitle ||
            (perf
              ? `Load ${perf.loadAvg[0].toFixed(2)} · ${perf.arch}`
              : "Monitor di sistema")}
        </span>
        {perf && <span>Up {formatUptime(perf.uptimeSeconds)}</span>}
      </div>
    </div>
  );
}

export type ParsedAiLimit = {
  id: string;
  name: string;
  percent: number;
  note: string;
  done: boolean;
};

const DEFAULT_AI_ITEMS = [
  { id: "claude", text: "Claude Max | 65% | Reset 5h", done: false },
  { id: "chatgpt", text: "ChatGPT Plus | 40% | Reset 3h", done: false },
  { id: "cursor", text: "Cursor Pro | 72% | 18 gg", done: false },
  { id: "hermes", text: "Hermes / OpenRouter | 15% | API", done: false },
];

export function parseAiItem(item: {
  id: string;
  text: string;
  done: boolean;
}): ParsedAiLimit {
  const parts = item.text.split("|").map((s) => s.trim());
  if (parts.length >= 2) {
    const num = parseInt(parts[1].replace(/[^\d]/g, ""), 10);
    return {
      id: item.id,
      name: parts[0] || "AI",
      percent: Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0,
      note: parts[2] ?? "",
      done: item.done,
    };
  }
  const match = /(\d{1,3})\s*%/.exec(item.text);
  const percent = match ? Math.max(0, Math.min(100, Number(match[1]))) : 50;
  const name = item.text.replace(/(\d{1,3})\s*%/, "").trim() || "AI";
  return { id: item.id, name, percent, note: "", done: item.done };
}

export function formatAiItem(entry: ParsedAiLimit): string {
  return entry.note
    ? `${entry.name} | ${entry.percent}% | ${entry.note}`
    : `${entry.name} | ${entry.percent}%`;
}

export function AiLimitsTile({
  tile,
  editing = false,
  onConfig,
}: {
  tile: Tile;
  editing?: boolean;
  onConfig?: (patch: Partial<Tile["config"]>) => void;
}) {
  const [agentInfo, setAgentInfo] = useState<{
    agentConfigured: boolean;
    model: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    request<{ agentConfigured: boolean; model: string }>("/api/ai-limits")
      .then((res) => {
        if (!cancelled) setAgentInfo(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const rawItems = tile.config.items.length
    ? tile.config.items
    : DEFAULT_AI_ITEMS;
  const parsed = rawItems.map(parseAiItem);
  const avg = parsed.length
    ? Math.round(parsed.reduce((acc, x) => acc + x.percent, 0) / parsed.length)
    : 0;

  const stepQuota = (index: number, delta: number) => {
    if (editing || !onConfig) return;
    const next = parsed.map((entry, idx) => {
      if (idx !== index) return rawItems[idx];
      const updatedPercent = (entry.percent + delta + 110) % 110;
      const clamped = updatedPercent > 100 ? 0 : updatedPercent;
      return {
        id: entry.id,
        done: clamped >= 100,
        text: formatAiItem({ ...entry, percent: clamped }),
      };
    });
    onConfig({ items: next });
  };

  return (
    <div className="ai-limits-tile">
      <div className="tile-top">
        <span className="perf-heading">
          <Sparkles size={13} aria-hidden="true" />
          {tile.title || "Subscription AI"}
        </span>
        <span className="ai-avg-badge" title="Utilizzo medio quote AI">
          {avg}% medio
        </span>
      </div>

      <div className="ai-limits-list" role="group" aria-label="Quote AI">
        {parsed.map((item, idx) => (
          <div key={item.id || idx} className="ai-limit-row">
            <div className="ai-limit-head">
              <span className="ai-limit-name">{item.name}</span>
              {item.note && (
                <small className="ai-limit-note">{item.note}</small>
              )}
              <button
                type="button"
                className="ai-limit-step"
                disabled={editing || !onConfig}
                title="Clicca per aggiornare la quota (+10%)"
                aria-label={`Aggiorna quota ${item.name} (${item.percent}%)`}
                onClick={(e) => {
                  e.stopPropagation();
                  stepQuota(idx, 10);
                }}
              >
                {item.percent}%
              </button>
            </div>
            <div
              className={`perf-bar ai-bar ${item.percent >= 85 ? "is-high" : item.percent >= 60 ? "is-mid" : ""}`}
              role="progressbar"
              aria-label={item.name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={item.percent}
              onClick={(e) => {
                if (editing || !onConfig) return;
                e.stopPropagation();
                stepQuota(idx, 10);
              }}
            >
              <span style={{ width: `${Math.max(4, item.percent)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="perf-foot">
        <span>
          {tile.subtitle ||
            (agentInfo?.agentConfigured
              ? `Agente attivo · ${agentInfo.model}`
              : "Tocca una barra per aggiornare la quota")}
        </span>
      </div>
    </div>
  );
}

const DJ_OSSO_STREAMS = [
  "https://stream.rcs.revma.com/x3ab37sgn7uvv",
  "https://stream.rcs.revma.com/c6f8uygkd5uvv",
  "https://stream.rcs.revma.com/rqh8st7he5uvv",
];

export function RadioTile({
  tile,
  editing = false,
}: {
  tile: Tile;
  editing?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [streamIndex, setStreamIndex] = useState(0);
  const [streamError, setStreamError] = useState("");

  const customStream = tile.config.body.trim();
  const streams = customStream
    ? [customStream, ...DJ_OSSO_STREAMS.filter((url) => url !== customStream)]
    : DJ_OSSO_STREAMS;
  const activeStream = streams[streamIndex % streams.length];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
      }
    };
  }, []);

  const togglePlay = async () => {
    if (editing) return;
    const audio = audioRef.current;
    if (!audio) return;
    setStreamError("");
    if (playing) {
      audio.pause();
      setPlaying(false);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      if (audio.src !== activeStream) {
        audio.src = activeStream;
      }
      await audio.play();
      setPlaying(true);
      setLoading(false);
    } catch {
      if (streamIndex + 1 < streams.length) {
        const nextIdx = streamIndex + 1;
        setStreamIndex(nextIdx);
        try {
          audio.src = streams[nextIdx];
          await audio.play();
          setPlaying(true);
          setLoading(false);
          return;
        } catch {
          /* fallthrough */
        }
      }
      setPlaying(false);
      setLoading(false);
      setStreamError("Stream non raggiungibile");
    }
  };

  return (
    <div className={`radio-tile ${playing ? "is-playing" : ""}`}>
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => {
          setPlaying(true);
          setLoading(false);
          setStreamError("");
        }}
        onPause={() => setPlaying(false)}
        onError={() => {
          if (playing && streamIndex + 1 < streams.length) {
            const nextIdx = streamIndex + 1;
            setStreamIndex(nextIdx);
            if (audioRef.current) {
              audioRef.current.src = streams[nextIdx];
              void audioRef.current.play().catch(() => {
                setPlaying(false);
                setLoading(false);
              });
            }
          } else {
            setPlaying(false);
            setLoading(false);
          }
        }}
      />

      <div className="tile-top">
        <span className="perf-heading">
          <Radio size={13} aria-hidden="true" />
          {tile.title || "DJ Osso Radio"}
        </span>
        <span className={`radio-badge ${playing ? "is-on-air" : ""}`}>
          <span className="live-dot" />
          {loading ? "BUFFER…" : playing ? "ON AIR" : "DIRETTA"}
        </span>
      </div>

      <div className="radio-main">
        <button
          type="button"
          className={`radio-play-btn ${playing ? "is-active" : ""}`}
          disabled={editing}
          aria-label={playing ? "Ferma DJ Osso Radio" : "Ascolta DJ Osso Radio"}
          onClick={(e) => {
            e.stopPropagation();
            void togglePlay();
          }}
        >
          {playing ? <Pause size={22} /> : <Play size={22} />}
        </button>

        <div className="radio-station-info">
          <strong className="radio-station-title">
            {tile.title || "DJ Osso Radio"}
          </strong>
          <span className="radio-station-sub">
            {streamError || tile.subtitle || "Happy Music · Diretta streaming"}
          </span>
        </div>

        <div className="radio-eq" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="radio-foot">
        <div
          className="radio-volume"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="radio-mute-btn"
            aria-label={muted ? "Riattiva audio" : "Silenzia"}
            onClick={() => setMuted((m) => !m)}
          >
            {muted || volume === 0 ? (
              <VolumeX size={14} />
            ) : (
              <Volume2 size={14} />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            aria-label="Volume radio"
            value={muted ? 0 : volume}
            onChange={(e) => {
              setMuted(false);
              setVolume(Number(e.target.value));
            }}
          />
        </div>
        {tile.url && (
          <a
            className="radio-site-link"
            href={tile.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Apri sito DJ Osso Radio"
            onClick={(e) => e.stopPropagation()}
          >
            Sito <ArrowUpRight size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
