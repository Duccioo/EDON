import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { buildApp } from "../apps/server/src/app";

test("MCP tools use the same tile service as the REST API", async () => {
  const vaultDir = await mkdtemp(join(tmpdir(), "edon-mcp-vault-"));
  await writeFile(join(vaultDir, "MCP.md"), "# MCP\n\nVault read\n");
  const app = await buildApp({
    dataDir: await mkdtemp(join(tmpdir(), "edon-mcp-")),
    agentToken: "token-mcp",
    vault: { path: vaultDir },
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  const url = new URL(
    `http://127.0.0.1:${(app.server.address() as { port: number }).port}/mcp`,
  );
  const connect = async (token: string) => {
    const client = new Client({ name: "test", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    return client;
  };
  const text = (r: unknown) =>
    JSON.parse(
      ((r as { content: { text: string }[] }).content[0] as { text: string })
        .text,
    );
  try {
    await assert.rejects(connect("sbagliato"));
    const client = await connect("token-mcp");
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "create_tile",
      "delete_tile",
      "get_layout",
      "list_tile_types",
      "list_tiles",
      "list_vault_notes",
      "read_vault_note",
      "update_tile",
      "upsert_tile",
    ]);
    const a = text(
      await client.callTool({
        name: "upsert_tile",
        arguments: {
          key: "daily-news",
          type: "link",
          title: "Notizie",
          url: "https://example.com/news",
        },
      }),
    );
    const b = text(
      await client.callTool({
        name: "upsert_tile",
        arguments: {
          key: "daily-news",
          subtitle: "Aggiornate oggi",
        },
      }),
    );
    assert.equal(a.created, true);
    assert.equal(b.created, false);
    assert.equal(b.tile.id, a.tile.id);
    assert.equal(b.tile.subtitle, "Aggiornate oggi");
    const bad = await client.callTool({
      name: "create_tile",
      arguments: { type: "link", url: "javascript:x" },
    });
    assert.equal(bad.isError, true);
    const vaultWrite = await client.callTool({
      name: "create_tile",
      arguments: { type: "text", title: "MCP write", config: { body: "no" } },
    });
    assert.equal(vaultWrite.isError, true);
    const layout = text(
      await client.callTool({ name: "get_layout", arguments: {} }),
    );
    assert.ok(layout.tiles.some((t: { id: string }) => t.id === a.tile.id));
    const vaultList = text(
      await client.callTool({ name: "list_vault_notes", arguments: {} }),
    );
    assert.ok(
      vaultList.notes.some((note: { path: string }) => note.path === "MCP.md"),
    );
    const vaultNote = text(
      await client.callTool({
        name: "read_vault_note",
        arguments: { path: "MCP.md" },
      }),
    );
    assert.equal(vaultNote.body, "Vault read");
    assert.match(vaultNote.version, /^[\da-f]{64}$/);
    const del = await client.callTool({
      name: "delete_tile",
      arguments: { id: a.tile.id },
    });
    assert.notEqual(del.isError, true);
    await client.close();
  } finally {
    await app.close();
  }
});
