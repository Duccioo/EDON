import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  TileError,
  createInput,
  externalKeySchema,
  patchInput,
  upsertInput,
  type TileService,
} from "./tiles";
import type { VaultService } from "./vault";

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});
const failure = (e: unknown) => ({
  isError: true,
  content: [
    {
      type: "text" as const,
      text:
        e instanceof ZodError
          ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
          : e instanceof TileError
            ? e.message
            : "Operazione non riuscita.",
    },
  ],
});
const run =
  <A>(fn: (args: A) => unknown) =>
  async (args: A) => {
    try {
      return json(fn(args));
    } catch (e) {
      if (!(e instanceof TileError || e instanceof ZodError)) throw e;
      return failure(e);
    }
  };

/** A thin MCP adapter over TileService, one server per request (stateless). */
export function mcpServer(tiles: TileService, vault?: VaultService) {
  const server = new McpServer({ name: "edon", version: "0.1.0" });
  server.registerTool(
    "list_tiles",
    {
      description: "Elenca tutte le tile del desktop con contenuto e aspetto.",
    },
    run(() => ({ tiles: tiles.list() })),
  );
  server.registerTool(
    "create_tile",
    {
      description:
        "Crea una tile (origin=agent) nel primo spazio libero, senza spostare le altre. Usa list_tile_types per campi e valori; per collegare una nota del vault di Obsidian passa config.vaultPath.",
      inputSchema: createInput.shape,
    },
    run((args: z.infer<typeof createInput>) => ({ tile: tiles.create(args) })),
  );
  server.registerTool(
    "update_tile",
    {
      description:
        "Aggiorna contenuto, aspetto o scadenza di una tile esistente. I campi omessi restano invariati; config e appearance si fondono con i valori attuali.",
      inputSchema: { id: z.string().uuid(), ...patchInput.shape },
    },
    run(({ id, ...patch }: { id: string } & z.infer<typeof patchInput>) => ({
      tile: tiles.update(id, patch),
    })),
  );
  server.registerTool(
    "upsert_tile",
    {
      description:
        "Crea o aggiorna la tile identificata da una chiave stabile (idempotente): ideale per contenuti periodici come 'daily-news'. type è obbligatorio solo alla creazione.",
      inputSchema: { key: externalKeySchema, ...upsertInput.shape },
    },
    run(({ key, ...input }: { key: string } & z.infer<typeof upsertInput>) =>
      tiles.upsert(key, input),
    ),
  );
  server.registerTool(
    "delete_tile",
    {
      description:
        "Elimina una tile creata da un agente. Le tile dell'utente non si eliminano.",
      inputSchema: { id: z.string().uuid() },
    },
    run(({ id }: { id: string }) => {
      tiles.remove(id);
      return { ok: true };
    }),
  );
  server.registerTool(
    "get_layout",
    {
      description:
        "Griglia a 6 colonne con posizione e dimensione di ogni tile; serve a capire lo spazio occupato.",
    },
    run(() => tiles.layout()),
  );
  server.registerTool(
    "list_tile_types",
    {
      description:
        "Tipi di tile disponibili, campi supportati e opzioni di aspetto.",
    },
    run(() => ({ types: tiles.types() })),
  );
  server.registerTool(
    "list_vault_notes",
    {
      description:
        "Elenca o cerca le note .md e le cartelle presenti nel vault di Obsidian collegato a EDON.",
      inputSchema: {
        query: z.string().max(120).optional(),
        folder: z.string().max(240).optional(),
      },
    },
    run((args: { query?: string; folder?: string }) => {
      if (!vault) throw new TileError(409, "Vault non configurato.");
      return vault.listNotes(args);
    }),
  );
  server.registerTool(
    "read_vault_note",
    {
      description:
        "Legge il contenuto Markdown e le voci TODO di una nota .md nel vault di Obsidian.",
      inputSchema: {
        path: z.string().min(1).max(240),
      },
    },
    run(({ path }: { path: string }) => {
      if (!vault) throw new TileError(409, "Vault non configurato.");
      return vault.readNote(path);
    }),
  );
  return server;
}

export function registerMcp(
  app: FastifyInstance,
  tiles: TileService,
  vault?: VaultService,
) {
  app.post("/mcp", async (req, reply) => {
    const server = mcpServer(tiles, vault);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    reply.hijack();
    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req.raw, reply.raw, req.body);
  });
  for (const method of ["get", "delete"] as const)
    app[method]("/mcp", async (_req, reply) =>
      reply
        .code(405)
        .header("Allow", "POST")
        .send({ error: "Usa POST (MCP Streamable HTTP, senza sessione)." }),
    );
}
