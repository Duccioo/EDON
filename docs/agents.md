# Agenti: REST e MCP

EDON non contiene un LLM. Un agente esterno (Hermes, Codex, Claude, script) legge e scrive tile con **REST** (`docs/api.md`) o con **MCP**; entrambi usano lo stesso servizio (`apps/server/src/tiles.ts`), quindi regole e validazione sono identiche.

## Collegamento

1. In **Impostazioni globali → Agenti** crea un token (o imposta `EDON_AGENT_TOKEN` nello stack Docker). Il token autorizza solo l'API per le tile e `/mcp`.
2. L'agente usa `Authorization: Bearer <token>`. L'agente può stare su un'altra macchina: raggiungi EDON con HTTPS (reverse proxy) o VPN, e imposta `HOST=0.0.0.0` / `COOKIE_SECURE=true` solo se necessario. Non esporre EDON in chiaro su Internet.

## Server MCP

Endpoint: `POST /mcp` (Streamable HTTP, senza sessione). Strumenti: `list_tiles`, `create_tile`, `update_tile`, `upsert_tile`, `delete_tile`, `get_layout`, `list_tile_types`. Gli errori di validazione tornano come risultato `isError` con il motivo, così l'agente può correggersi.

Configurazione generica (client che accettano `url` e `headers`):

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

In `~/.hermes/config.yaml` della macchina dove gira Hermes (sintassi dalla [documentazione MCP di Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp); `${VAR}` viene letto da `~/.hermes/.env`):

```yaml
mcp_servers:
  edon:
    url: "https://edon.example.com/mcp"
    headers:
      Authorization: "Bearer ${EDON_TOKEN}"
```

Poi puoi chiedere: «metti un tile con il meteo di Firenze» oppure «ogni mattina aggiorna il tile `daily-news` con le notizie di tecnologia» (con un task pianificato di Hermes che chiama `upsert_tile`). Se Hermes non supporta MCP HTTP, usa lo stesso token con `curl`/REST.

## Dal desktop a Hermes: il pulsante ✨

La barra in basso accetta richieste in linguaggio naturale («aggiungi un tile con l'ora di New York»). EDON le invia **dal server** (la chiave non arriva mai al browser) a Hermes con `POST {HERMES_URL}/v1/chat/completions` e `Authorization: Bearer <API_SERVER_KEY>`; Hermes agisce sul desktop con gli strumenti MCP e il browser mostra le nuove tile entro pochi secondi. La lente accanto al campo passa alla ricerca nel desktop.

Su Hermes (macchina remota inclusa), in `~/.hermes/.env`:

```sh
API_SERVER_ENABLED=true
API_SERVER_KEY=una-chiave-lunga
# per raggiungerlo da un'altra macchina, vedi l'host del gateway nella documentazione di Hermes
```

poi `hermes gateway` (porta predefinita 8642). In EDON, **Impostazioni globali → Agente AI**: indirizzo (`http://host:8642`), chiave API e modello (`hermes-agent`); _Verifica connessione_ controlla `/health`. Nello stack Docker usa `HERMES_URL`, `HERMES_API_KEY` e `HERMES_MODEL`: se presenti prevalgono sulle impostazioni salvate. La chiave salvata dall'interfaccia sta in chiaro nel database `data/desktop.sqlite`, come il resto della configurazione.

Perché Hermes possa creare le tile, deve avere EDON come server MCP (sezione sopra) con un token proprio. Le richieste lunghe (ricerca di notizie, più passaggi) possono impiegare fino a tre minuti prima del timeout.

## Regole per gli agenti

- Le tile create hanno `origin: "agent"`, sono piazzate nel primo spazio libero e non spostano mai quelle dell'utente.
- Si può aggiornare il contenuto di ogni tile, ma eliminare e spostare solo le tile create da agenti.
- Usa una **chiave stabile** (`upsert_tile`, `PUT /api/tiles/by-key/:key`) per contenuti ricorrenti: aggiorna la tile invece di duplicarla.
- `expiresAt` rimuove la tile alla scadenza (es. riepilogo di una riunione per sette giorni).
- Le **cartelle** (`type: "folder"`, max 24 elementi in `config.children`, senza annidamento) raggruppano mini-tile create con `createFolderChild`: utili per progetti («metti insieme note e link del progetto X»).
- **Meteo** (`weather`): `config.location` è la città; il server interroga Open-Meteo (senza chiave) e mette in cache 10 minuti.
- **Timer e scadenze** (`progress`): la barra si riempie da `config.startsAt` a `config.endsAt` (ISO 8601). Un timer ha `startsAt` = adesso.
- **File** (`file`): `config.file` è un percorso `/uploads/…` già caricato dall’utente (trascinando un file sul desktop o dal catalogo); i PDF mostrano la prima pagina. Gli agenti non caricano file.
- Nessun codice viene eseguito: le tile sono dati dichiarativi (`text`, `data`, `link`, `image`, `clock`, `folder`, `weather`, `progress`, `file`) con aspetto configurabile.

## Esempi

**Meteo** (`upsert_tile`): `key: "weather-firenze"`, `type: "data"`, `title: "Firenze · 21°"`, `config: { body: "Sereno. Domani 23°, nuvoloso.", image: "https://…/sole.png" }`, `appearance: { preset: "glass" }`.

**Riunione**: `key: "meeting-2026-10-16"`, `type: "data"`, `config.items` con le azioni (`{id,text,done:false}`), `url: "obsidian://open?vault=…&file=…"`, `expiresAt` tra sette giorni.

**Notizie**: `key: "daily-news"`, aggiornata ogni mattina; `config.body` con il riassunto.

## Verso widget personalizzati (futuro)

Il rendering delle tile è separato dai dati. Un sistema di widget scritti da agenti dovrebbe usare iframe in sandbox con permessi espliciti e un canale di messaggi ristretto; non è implementato e l'API non esegue mai JavaScript inviato dagli agenti.
