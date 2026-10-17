import { z } from "zod";
import type { Store } from "./store";
import { TileError } from "./tiles";

export type AgentEnv = { url?: string; apiKey?: string; model?: string };

const SYSTEM_PROMPT = `You are connected to the user's EDON tile desktop through the MCP server "edon". Fulfil the request by creating or updating tiles with its tools. Use list_tile_types to learn the available fields. For content that changes over time use upsert_tile with a stable key (for example "weather-florence" or "daily-tech-news") so the same tile is updated instead of duplicated. Never delete or move tiles the user created. If the request is recurring, schedule it with your own scheduler when you have one. Reply with one short sentence, in the user's language, saying what you did.`;

export const agentSettingsInput = z.object({
  url: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => !v || /^https?:\/\/[^\s]+$/.test(v),
      "Usa un URL http o https.",
    ),
  model: z.string().trim().max(100),
  apiKey: z.string().max(500).optional(),
});

/** Connection to an external agent (Hermes) that speaks the OpenAI chat API. */
export class AgentClient {
  constructor(
    private store: Store,
    private env: AgentEnv,
    private fetchImpl: typeof fetch,
  ) {}

  private resolved() {
    const saved = this.store.getSetting("agent");
    const ui: AgentEnv = saved ? JSON.parse(saved) : {};
    return {
      url: (this.env.url || ui.url || "").replace(/\/+$/, ""),
      apiKey: this.env.apiKey || ui.apiKey || "",
      model: this.env.model || ui.model || "hermes-agent",
    };
  }
  /** Public view: never includes the key. */
  status() {
    const c = this.resolved();
    return {
      configured: !!c.url,
      url: c.url,
      model: c.model,
      hasKey: !!c.apiKey,
      managedByEnvironment: {
        url: !!this.env.url,
        apiKey: !!this.env.apiKey,
        model: !!this.env.model,
      },
    };
  }
  save(input: z.infer<typeof agentSettingsInput>) {
    const old = this.store.getSetting("agent");
    const previous: AgentEnv = old ? JSON.parse(old) : {};
    this.store.setSetting(
      "agent",
      JSON.stringify({
        url: input.url,
        model: input.model,
        apiKey: input.apiKey === undefined ? previous.apiKey : input.apiKey,
      }),
    );
    return this.status();
  }
  private async call(path: string, init: RequestInit, timeoutMs: number) {
    const c = this.resolved();
    if (!c.url)
      throw new TileError(
        409,
        "Collega prima l’agente in Impostazioni → Agente.",
      );
    let response: Response;
    try {
      response = await this.fetchImpl(`${c.url}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new TileError(
        502,
        (e as Error).name === "TimeoutError"
          ? "L’agente non ha risposto in tempo."
          : "Impossibile raggiungere l’agente. Controlla indirizzo e rete.",
      );
    }
    return response;
  }
  async test() {
    const response = await this.call("/health", { method: "GET" }, 8000);
    if (!response.ok)
      throw new TileError(
        502,
        `L’agente ha risposto con errore ${response.status}.`,
      );
    return { ok: true };
  }
  async ask(prompt: string) {
    const c = this.resolved();
    const response = await this.call(
      "/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify({
          model: c.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      },
      180000,
    );
    if (response.status === 401 || response.status === 403)
      throw new TileError(502, "L’agente ha rifiutato la chiave API.");
    if (!response.ok)
      throw new TileError(
        502,
        `L’agente ha risposto con errore ${response.status}.`,
      );
    const data = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    return { reply: data?.choices?.[0]?.message?.content?.trim() || "Fatto." };
  }
}
