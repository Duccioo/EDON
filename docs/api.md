# HTTP del desktop — milestone 1

Questa interfaccia serve il browser. Autenticazione con cookie `session`, HttpOnly e SameSite=Strict, durata sette giorni. Nessun token per agenti in questa fase. Risposte di errore JSON: `{ "error": "messaggio" }`.

| Metodo | Percorso         | Comportamento                                                                   |
| ------ | ---------------- | ------------------------------------------------------------------------------- |
| GET    | `/api/auth`      | Restituisce `configured` e `authenticated`                                      |
| POST   | `/api/setup`     | Imposta la prima password, solo se non configurata                              |
| POST   | `/api/login`     | Verifica password e crea una sessione                                           |
| POST   | `/api/logout`    | Invalida la sessione                                                            |
| POST   | `/api/password`  | Cambia la password (`{current, password}`), autenticato, max 8 tentativi/minuto |
| GET    | `/api/desktop`   | Desktop completo con `revision`                                                 |
| PUT    | `/api/desktop`   | Valida e salva desktop e revisione                                              |
| POST   | `/api/uploads`   | Un file multipart, massimo 10 MB                                                |
| GET    | `/uploads/:name` | Restituisce il file a un utente autenticato                                     |

Login e setup accettano `{ "password": "…" }` e hanno un limite di tentativi. Le altre operazioni richiedono la sessione. Per esempio, dopo aver configurato la password nel browser:

```sh
curl -c /tmp/edon-cookie -H 'Content-Type: application/json' \
  -d '{"password":"la-tua-password"}' http://127.0.0.1:3001/api/login
curl -b /tmp/edon-cookie http://127.0.0.1:3001/api/desktop
```

`PUT /api/desktop` richiede `{ settings, tiles, revision }`. La revisione deve essere quella restituita dall'ultima lettura; un salvataggio valido la incrementa. `409` segnala un conflitto e richiede una nuova lettura; non sovrascrivere automaticamente le modifiche dell'altra finestra. La struttura completa è definita in `packages/shared/model.ts`.

I campi sono validati sul server, inclusi dimensioni, limiti, duplicati e sovrapposizioni. Note (`text`) e TODO (`data`) arrivano a 3 colonne e 128 righe, entro le dimensioni del desktop; i file (`file`) arrivano a 3×3; gli altri tipi a 2×2. Il documento desktop include `archive` (massimo 1.000 note/TODO), preservato da salvataggi e backup; gli ID devono essere unici anche tra desktop e archivio. URL di destinazione ammessi: HTTP, HTTPS e Obsidian. Immagini remote: HTTPS; quelle caricate vengono servite dal server. Errori di validazione: `400`, accesso mancante: `401`, origine non consentita: `403`, file oltre il limite: `413`.

## API per agenti

Gli agenti esterni (Hermes, Codex, script) usano `Authorization: Bearer <token>`. I token si creano in **Impostazioni globali → Agenti** (mostrati una sola volta, con scadenza e revoca) oppure si imposta `EDON_AGENT_TOKEN` nell'ambiente. Il token apre **solo** i percorsi qui sotto; non dà accesso a `/api/desktop`, `/api/tokens` né agli upload. Se Hermes gira su un'altra macchina, esponi EDON con HTTPS o VPN.

| Metodo               | Percorso                 | Comportamento                                              |
| -------------------- | ------------------------ | ---------------------------------------------------------- |
| GET                  | `/api/tiles`             | `{ tiles }`                                                |
| POST                 | `/api/tiles`             | Crea (201). `type` obbligatorio                            |
| GET / PATCH / DELETE | `/api/tiles/:id`         | Legge, aggiorna, elimina                                   |
| PUT                  | `/api/tiles/by-key/:key` | Upsert idempotente: 201 se crea, 200 se aggiorna           |
| GET                  | `/api/tile-types`        | Tipi di tile, campi e aspetto                              |
| GET                  | `/api/layout`            | Colonne (6), revisione, posizioni                          |
| PUT                  | `/api/layout`            | `{ tiles: [{id,x,y}] }`: sposta solo tile create da agenti |

Regole:

- Le tile create da agenti hanno `origin: "agent"` e vengono messe nel primo spazio libero; le tile dell'utente non vengono mai spostate né ridimensionate. `409` se la griglia è piena.
- Gli agenti possono aggiornare il contenuto e l'aspetto di qualsiasi tile, ma eliminare e spostare solo quelle `origin: "agent"` (`403` altrimenti).
- Corpo di creazione/aggiornamento: `type`, `title`, `subtitle`, `url`, `w`, `h`, `expiresAt` (ISO 8601 o `null`), `externalKey`, `config` (anche parziale: `body`, `items`, `icon`, `image`, `timezone`, `children`) e `appearance` (anche parziale; `preset` applica prima il preset). Campi sconosciuti → `400`.
- `GET /api/weather?q=<città>` (solo sessione): meteo attuale da Open-Meteo, in cache per 10 minuti. `POST /api/files` (solo sessione, max 10 MB) carica qualsiasi file e risponde `{url, name, kind}` con `kind` = `image`, `pdf` o `file`; tipo e estensione di immagini e PDF sono decisi dal contenuto, gli altri formati vengono serviti solo come download.
- Cartelle (`type: "folder"`): `config.children` è la lista completa (max 24, senza annidamento) di mini-tile `{id, type, title, subtitle, url, config, appearance}`; `GET /api/tile-types` ne documenta la forma.
- `expiresAt` nel passato: la tile viene rimossa alla lettura successiva. Chiave stabile: lettere, numeri e `. _ : -`, max 120 caratteri; cambiare `type` di una chiave esistente dà `409`.
- Errori: `{ "error": "messaggio" }` con 400, 401, 403, 404 o 409.
- Il browser rileva le modifiche degli agenti entro 5 secondi, se non ha salvataggi in sospeso.

```sh
curl -X PUT http://127.0.0.1:3001/api/tiles/by-key/daily-news \
  -H "Authorization: Bearer $EDON_TOKEN" -H 'Content-Type: application/json' \
  -d '{"type":"data","title":"Notizie tech","config":{"body":"…"},"expiresAt":null}'
```

Per MCP (`POST /mcp`, stesso token) e per la configurazione di Hermes vedi [agenti](agents.md).
