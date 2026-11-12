# Interfaccia HTTP

Il browser usa il cookie `session` (`HttpOnly`, `SameSite=Strict`, durata sette giorni). Gli agenti usano `Authorization: Bearer <token>` soltanto sui percorsi indicati. Errori JSON: `{ "error": "messaggio" }`; origini cross-site non consentite sulle scritture ricevono `403`.

## Sessione e desktop

| Metodo     | Percorso                            | Comportamento                                                        |
| ---------- | ----------------------------------- | -------------------------------------------------------------------- |
| GET        | `/api/auth`                         | Stato `configured` e `authenticated`; pubblico                       |
| POST       | `/api/setup`                        | Prima password, minimo 10 caratteri; pubblico finché non configurato |
| POST       | `/api/login`                        | Login e cookie; massimo 8 tentativi/minuto                           |
| POST       | `/api/logout`                       | Invalida la sessione                                                 |
| POST       | `/api/password`                     | `{current,password}`; autenticato, massimo 8 tentativi/minuto        |
| GET / PUT  | `/api/desktop`                      | Documento completo e salvataggio con controllo revisione             |
| GET / POST | `/api/tokens`                       | Elenco e creazione token; solo sessione                              |
| DELETE     | `/api/tokens/:id`                   | Revoca token; solo sessione                                          |
| GET / PUT  | `/api/agent`                        | Configurazione Hermes; solo sessione                                 |
| POST       | `/api/agent/test`, `/api/agent/ask` | Test connessione e richiesta Hermes; solo sessione                   |
| GET        | `/api/weather?q=…`                  | Meteo Open-Meteo; solo sessione                                      |

`PUT /api/desktop` richiede `settings`, `tiles`, `archive` e l’ultima `revision`. Una scrittura valida incrementa la revisione; `409` richiede una nuova lettura e non va sovrascritto automaticamente. Il modello e i limiti completi sono in `packages/shared/model.ts`.

Colonne e righe restituite sono dinamiche (rispettivamente 2–12 e 2–128). Note/TODO arrivano a 3 colonne e tutte le righe configurate, file a 3×3, altri tipi a 2×2. L’archivio locale contiene massimo 1.000 note/TODO; con vault attivo l’archiviazione conserva invece il file e rimuove il pin. URL ammessi: HTTP, HTTPS e Obsidian; immagini remote: HTTPS.

## Upload e file

Entrambi gli endpoint richiedono sessione, multipart con un solo file e massimo 10 MB.

| Metodo | Percorso         | Comportamento                                                                             |
| ------ | ---------------- | ----------------------------------------------------------------------------------------- |
| POST   | `/api/uploads`   | Solo PNG, JPEG, WebP o GIF riconosciuti dal contenuto; risponde `{url}`                   |
| POST   | `/api/files`     | Qualsiasi file non vuoto; risponde `{url,name,kind}` con `kind` = `image`, `pdf` o `file` |
| GET    | `/uploads/:name` | Download autenticato; formati non noti solo come attachment                               |

Immagini e PDF vengono classificati dal contenuto, non dal MIME dichiarato. Gli altri formati mantengono un’estensione sicura e non vengono renderizzati. I token Bearer non hanno accesso a questi endpoint.

## Obsidian

| Metodo    | Percorso                         | Sessione               | Bearer        |
| --------- | -------------------------------- | ---------------------- | ------------- |
| GET / PUT | `/api/vault`                     | Stato/configurazione   | No            |
| GET       | `/api/vault/notes?q=&folder=`    | Sì                     | Sì, read-only |
| GET       | `/api/vault/note?path=`          | Sì                     | Sì, read-only |
| PUT       | `/api/vault/note`                | Crea/aggiorna Markdown | No            |
| DELETE    | `/api/vault/note?path=&version=` | Sposta nel cestino     | No            |

Le note usano percorsi relativi `.md` sicuri. Gli aggiornamenti di note esistenti richiedono il campo `version` restituito dall’ultima lettura; anche l’eliminazione richiede lo stesso valore nel parametro `version`. Un cambiamento esterno produce `409` senza modificare il file. Le operazioni possono sovrascrivere, rinominare o spostare file: leggi [obsidian.md](obsidian.md) prima dell’uso.

## API agenti e metriche

I percorsi tile/layout seguenti accettano sessione oppure Bearer. Le metriche richiedono la sessione.

| Metodo               | Percorso                 | Comportamento                                             |
| -------------------- | ------------------------ | --------------------------------------------------------- |
| GET / POST           | `/api/tiles`             | Elenco / creazione (`201`)                                |
| GET / PATCH / DELETE | `/api/tiles/:id`         | Lettura / aggiornamento / eliminazione                    |
| PUT                  | `/api/tiles/by-key/:key` | Upsert idempotente (`201` creazione, `200` aggiornamento) |
| GET                  | `/api/tile-types`        | Tipi, campi e limiti                                      |
| GET / PUT            | `/api/layout`            | Griglia dinamica / spostamento tile agenti                |
| GET                  | `/api/performance`       | Metriche del server                                       |
| GET                  | `/api/ai-limits`         | Riepilogo configurazione agente e token                   |

Creazione/aggiornamento accettano `type`, `title`, `subtitle`, `url`, `w`, `h`, `expiresAt`, `externalKey`, `config` e `appearance`; campi sconosciuti danno `400`. `config` e `appearance` sono patch parziali. Le tile create da agenti hanno `origin: "agent"`; solo queste possono essere ridimensionate, spostate o eliminate dagli agenti.

Le chiavi stabili usano lettere, numeri e `. _ : -` (massimo 120 caratteri). Cambiare tipo su una chiave esistente dà `409`. `expiresAt` è ISO 8601 o `null`; una scadenza passata elimina la tile alla lettura successiva.

```sh
curl -c /tmp/edon-cookie -H 'Content-Type: application/json' \
  -d '{"password":"la-tua-password"}' http://127.0.0.1:3001/api/login
curl -b /tmp/edon-cookie http://127.0.0.1:3001/api/desktop

curl -H "Authorization: Bearer $EDON_TOKEN" \
  http://127.0.0.1:3001/api/layout
```

Per MCP e Hermes vedi [agents.md](agents.md).
