import { z } from "zod";
import type { Store } from "./store";
import { TileError } from "./tiles";

export type AgentEnv = {
  url?: string;
  apiKey?: string;
  model?: string;
};
export const agentSettingsInput = z.object({
  url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\/[^\s"'<>\\]+$/.test(v), "URL non valido.")
    .transform((v) => v.replace(/\/+$/, "")),
  apiKey: z.string().trim().max(500).optional(),
  model: z.string().trim().max(120).default("hermes-agent"),
});
export const agentAskInput = z.object({
  prompt: z.string().trim().min(1).max(2000),
});
const systemPrompt =
  "Aiuti l’utente a organizzare il suo desktop EDON. Usa gli strumenti MCP di EDON (list_tiles, get_layout, list_tile_types, create_tile, update_tile, upsert_tile, delete_tile, list_vault_notes, read_vault_note) per creare o aggiornare le tile richieste o per cercare e fissare sul desktop le note dal vault di Obsidian (passando config.vaultPath). Rispondi in italiano, in una o due frasi sobrie.";

export class AgentClient {
  constructor(
    private store: Store,
    private env: AgentEnv = {},
    private fetchFn: typeof fetch = fetch,
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
    const parsed = agentSettingsInput.parse(input);
    const current = this.store.getSetting("agent");
    const old: AgentEnv = current ? JSON.parse(current) : {};
    this.store.setSetting(
      "agent",
      JSON.stringify({
        url: parsed.url,
        model: parsed.model || "hermes-agent",
        apiKey: parsed.apiKey !== undefined ? parsed.apiKey : old.apiKey || "",
      }),
    );
    return this.status();
  }
  async test() {
    const c = this.resolved();
    if (!c.url)
      throw new TileError(409, "Imposta prima l’indirizzo di Hermes.");
    const res = await this.call(`${c.url}/health`, {
      headers: this.headers(c.apiKey),
    });
    if (!res.ok)
      throw new TileError(502, `Hermes ha risposto con stato ${res.status}.`);
    return { ok: true };
  }
  async ask(prompt: string) {
    const c = this.resolved();
    if (!c.url)
      throw new TileError(
        409,
        "Configura Hermes in Impostazioni → Agente AI prima di creare una tile.",
      );
    const res = await this.call(`${c.url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.headers(c.apiKey),
      },
      body: JSON.stringify({
        model: c.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok)
      throw new TileError(
        502,
        `Hermes ha risposto con stato ${res.status}. Controlla indirizzo, chiave e server MCP.`,
      );
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = body.choices?.[0]?.message?.content?.trim();
    return { reply: reply || "Fatto." };
  }
  private headers(apiKey: string): Record<string, string> {
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }
  private async call(url: string, init: RequestInit) {
    try {
      return await this.fetchFn(url, {
        ...init,
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new TileError(
        502,
        "Impossibile raggiungere Hermes. Verifica che il server sia attivo sulla rete locale.",
      );
    }
  }
}
