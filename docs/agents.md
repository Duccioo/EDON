# Agenti: REST, MCP e Hermes

EDON non contiene un LLM. Agenti esterni come Hermes, Codex o script usano REST ([api.md](api.md)) oppure MCP; entrambi passano dallo stesso servizio tile e dalla stessa validazione.

## Token e ambiti

Crea un token in **Impostazioni → Agenti e token** oppure imposta `EDON_AGENT_TOKEN`. Il valore viene mostrato una sola volta; i token creati dalla UI possono avere scadenza ed essere revocati. Invialo come:

```http
Authorization: Bearer edon_…
```

Il Bearer abilita soltanto API tile/layout, tipi, lettura vault e `/mcp`; non apre desktop completo, metriche, gestione token, configurazione, upload o download file. Il vault è **read-only** per gli agenti: gli endpoint diretti di scrittura/eliminazione e le impostazioni vault richiedono il cookie di sessione. MCP offre soltanto `list_vault_notes` e `read_vault_note`, non strumenti di scrittura vault.

Per accesso remoto usa HTTPS o VPN; non esporre EDON in chiaro su Internet.

## MCP

Endpoint: `POST /mcp`, Streamable HTTP senza sessione persistente. Strumenti:

- tile: `list_tiles`, `create_tile`, `update_tile`, `upsert_tile`, `delete_tile`, `get_layout`, `list_tile_types`;
- vault read-only: `list_vault_notes`, `read_vault_note`.

Gli errori di validazione vengono restituiti come risultato `isError`. `get_layout` restituisce le colonne e righe **configurate**, non un numero fisso.

```json
{
  "mcpServers": {
    "edon": {
      "url": "https://edon.example.com/mcp",
      "headers": { "Authorization": "Bearer edon_…" }
    }
  }
}
```

### Hermes

Nella configurazione di Hermes (vedi la [documentazione MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)):

```yaml
mcp_servers:
  edon:
    url: "https://edon.example.com/mcp"
    headers:
      Authorization: "Bearer ${EDON_TOKEN}"
```

Per abilitare anche il suo server OpenAI-compatible, configura `API_SERVER_ENABLED=true` e una `API_SERVER_KEY` lunga in `~/.hermes/.env`, quindi avvia `hermes gateway` (porta predefinita 8642).

In **Impostazioni → Agente AI** inserisci URL, chiave e modello; **Verifica connessione** controlla `/health`. `HERMES_URL`, `HERMES_API_KEY` e `HERMES_MODEL` hanno precedenza sulle impostazioni salvate. La chiave salvata dalla UI è in chiaro in `data/desktop.sqlite`.

**Aggiungi tile → Crea con agenti AI** invia il prompt dal server a `POST {HERMES_URL}/v1/chat/completions`; la chiave Hermes non arriva al browser. La richiesta HTTP ha un timeout di **60 secondi**. Hermes deve avere EDON configurato come MCP e un token valido per applicare le modifiche.

## Regole sulle tile

- Le creazioni hanno `origin: "agent"` e usano il primo spazio libero; non spostano tile esistenti.
- Gli agenti possono aggiornare contenuto/aspetto delle tile, ma ridimensionare, spostare ed eliminare soltanto quelle `origin: "agent"`.
- Usa `upsert_tile` o `PUT /api/tiles/by-key/:key` con una chiave stabile per contenuti ricorrenti. `expiresAt` rimuove la tile alla scadenza.
- Le cartelle contengono fino a 24 mini-tile in `config.children`, senza annidamento; `config.vaultPath` può puntare a una directory vault o `*`.
- Note e TODO possono collegare `config.vaultPath`. Le API tile restano soggette alle regole di sincronizzazione del vault: tratta token e contenuti come sensibili e prova le automazioni su una copia.
- Meteo: `config.location`; timer/scadenza: `config.startsAt` e `config.endsAt`; file: `config.file` deve essere un `/uploads/…` già caricato. Gli agenti non possono caricare file.
- Tipi disponibili: `text`, `data`, `link`, `image`, `clock`, `folder`, `weather`, `progress`, `file`, `performance`, `ai_limits`, `radio`. `list_tile_types` è la fonte aggiornata per campi e limiti.
- Le tile sono dichiarative: nessun JavaScript inviato da un agente viene eseguito.

Esempio idempotente:

```sh
curl -X PUT http://127.0.0.1:3001/api/tiles/by-key/daily-news \
  -H "Authorization: Bearer $EDON_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"type":"data","title":"Notizie tech","config":{"body":"…"},"expiresAt":null}'
```
