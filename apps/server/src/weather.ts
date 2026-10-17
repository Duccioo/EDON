import { z } from "zod";

export type Weather = {
  location: string;
  temperature: number;
  code: number;
  isDay: boolean;
  wind: number;
  min: number;
  max: number;
  updatedAt: string;
};

export class WeatherError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const geocoding = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
      }),
    )
    .optional(),
});
const forecast = z.object({
  current: z.object({
    temperature_2m: z.number(),
    weather_code: z.number(),
    is_day: z.number(),
    wind_speed_10m: z.number(),
  }),
  daily: z.object({
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
  }),
});

/** Current conditions from Open-Meteo (no key needed), cached so tiles can poll freely. */
export class WeatherService {
  private cache = new Map<string, { at: number; value: Weather }>();
  constructor(
    private fetcher: typeof fetch = fetch,
    private ttl = 10 * 60_000,
  ) {}

  async get(query: string): Promise<Weather> {
    const key = query.trim().toLowerCase();
    if (!key) throw new WeatherError(400, "Scegli una città per il meteo.");
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttl) return hit.value;
    try {
      const place = geocoding.parse(
        await this.json(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(key)}&count=1&language=it&format=json`,
        ),
      ).results?.[0];
      if (!place)
        throw new WeatherError(
          404,
          `Non trovo “${query.trim()}”. Prova un’altra città.`,
        );
      const data = forecast.parse(
        await this.json(
          `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`,
        ),
      );
      const value: Weather = {
        location: place.name,
        temperature: Math.round(data.current.temperature_2m),
        code: data.current.weather_code,
        isDay: data.current.is_day === 1,
        wind: Math.round(data.current.wind_speed_10m),
        min: Math.round(data.daily.temperature_2m_min[0]),
        max: Math.round(data.daily.temperature_2m_max[0]),
        updatedAt: new Date().toISOString(),
      };
      this.cache.set(key, { at: Date.now(), value });
      if (this.cache.size > 100)
        this.cache.delete(this.cache.keys().next().value!);
      return value;
    } catch (e) {
      if (e instanceof WeatherError) throw e;
      if (hit) return hit.value;
      throw new WeatherError(
        502,
        "Il meteo non è raggiungibile in questo momento. Riprova tra poco.",
      );
    }
  }

  private async json(url: string): Promise<unknown> {
    const response = await this.fetcher(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
}
