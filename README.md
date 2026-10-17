# EDON

Un desktop personale composto da tile, ispirato ai riferimenti in `docs/visual-references`. Questa prima milestone implementa il desktop interattivo e persistente. Obsidian e la cattura nel vault sono rimandati alla fase successiva; token per agenti, API REST, server MCP e collegamento con Hermes sono descritti in [agenti](docs/agents.md).

## Avvio locale

Richiede Node.js **24 o successivo** e npm.

```sh
npm ci
npm run dev
```

Apri http://127.0.0.1:5173. Al primo accesso scegli una password di almeno 10 caratteri. Il server ascolta solo su localhost. I font, le illustrazioni e lo sfondo predefiniti sono locali; nessun servizio cloud è necessario per il desktop.

Per eseguire la versione compilata:

```sh
npm run build
npm start
```

Apri http://127.0.0.1:3001. `HOST`, `PORT`, `DATA_DIR` e `COOKIE_SECURE` sono variabili d'ambiente; `.env.example` ne mostra i valori. Per caricare un file `.env`, usa `node --env-file=.env --import tsx apps/server/src/index.ts` dopo la build.

## Il desktop

- **Desktop completo**: su finestre desktop da 900×600 px, la griglia occupa tutto lo spazio tra intestazione e comandi: larghezza delle colonne e altezza delle righe si adattano separatamente. Tutte le tile restano visibili senza scorrere e le posizioni sono conservate. Su finestre più piccole resta disponibile la vista scorrevole.
- **Griglia configurabile**: scegli separatamente colonne (orizzontali) e righe (verticali) in Impostazioni → Aspetto. La miniatura mostra anche le celle vuote. Una tile 2×2 occupa quattro celle. Se serve, il desktop tenta di ridisporre le tile; se non entrano, la modifica viene rifiutata senza rimuovere contenuti.
- **Limite tile**: 24 per i nuovi desktop, modificabile in Impostazioni → Aspetto. Vale per aggiunte, duplicazioni e agenti; non conta il contenuto delle cartelle. Non si può impostare un limite inferiore alle tile già presenti.
- **Cattura rapida**: una barra unica cresce mentre scrivi. Supporta Markdown; il pulsante **Todo** trasforma le righe `- [ ]` e `- [x]` in attività, conservando il resto della nota. ⌘/Ctrl + Invio salva e libera subito la barra. La graffetta, incolla e trascinamento aggiungono immagini/GIF. **+** apre Aggiungi tile, Modifica, Archivio e Impostazioni; in modifica compaiono **Compatta** e **Fine**.
- **Aggiungi tile**: collegamenti (inclusi URI `obsidian://`), immagini/GIF, note Markdown, elenchi, orologi e **cartelle** (fino a 24 mini-tile organizzate in una vista dedicata, senza annidamento).
- **Modifica** oppure **E**: seleziona una tile, trascinala e usa l'angolo inferiore destro per ridimensionarla. Le tile vicine restano ferme: in uno spazio occupato puoi scambiare due tile delle stesse dimensioni; gli altri spostamenti incompatibili vengono annullati.
- L’ispettore offre tutte le combinazioni fino a **3 colonne e tutte le righe disponibili per note e TODO**, **2×2 per gli altri tipi**, con gli stessi limiti nel trascinamento e nelle API; include spostamento, duplicazione ed eliminazione con conferma.
- Ogni tile ha colori, tipografia e immagini personalizzabili. Angoli, bordo, padding, opacità e vetro sono uniformi per il desktop e si regolano nelle **Impostazioni globali**. Preset: Minimal, Dot / Industrial, Soft Glass.
- L'orologio è una tile ordinaria. Puoi aggiungerne più di uno e configurare fusi IANA come `Europe/Rome` o `Asia/Tokyo`.
- Note e TODO hanno **Archivia** direttamente sulla tile e nella vista completa. **+ → Archivio** permette di leggerle e ripristinarle quando c’è spazio; l’archivio è incluso nel backup JSON.
- Le cartelle si aprono con un clic: dentro si aggiungono link, note, liste, immagini e orologi; ogni elemento si modifica o rimuove, le spunte funzionano.
- Le celle libere rimangono sempre visibili in modo leggero; in modifica la griglia è più evidente. Le tile non hanno crocette decorative.
- Note e liste mostrano un’anteprima; cliccando sulla tile o su **Leggi nota / Apri lista** si apre la vista completa al centro, con desktop sfocato. Il contenuto lungo è scorrevole; le spunte delle TODO funzionano anche lì. **Esc** chiude la vista. Apertura e chiusura collegano la vista alla tile selezionata; la preferenza di movimento ridotto disattiva le animazioni. Il pulsante matita nella tile apre direttamente l’editor.
- Le tile elenco mostrano prima le attività da fare. La vista completa offre filtri Tutte / Da fare / Completate e aggiunta diretta. Nell’editor condiviso si modificano testo Markdown e righe `- [ ]` / `- [x]`; il pulsante Todo permette di cambiare tipo. ⌘/Ctrl + Invio salva note e liste.
- **Impostazioni** (pagina a tutto schermo): Aspetto (anteprima live affiancata, miniatura del desktop e dettaglio di una tile, distanza 0–40 px con preset, limite tile, forma e bordi, otto colori pronti, pieghe astratte, tinta unita, gradiente o immagine caricata, nome del desktop), Agente AI, Agenti e token, Sicurezza (cambio password), Dati e backup (export/import JSON, ripristino), Integrazioni, Info.
- Attendi **Tutto salvato** prima di chiudere. Gli errori rimangono visibili con possibilità di riprovare. Una seconda finestra con dati superati riceve un conflitto: ricarica prima di modificarla.
- Su mobile la composizione si adatta a due colonne; si usano ispettore e pulsanti per modificare dimensioni e posizione. Il trascinamento è disponibile dai 690 px.

I collegamenti aprono una nuova scheda. Gli URI di applicazioni richiedono che il sistema abbia un'app associata. Il collegamento Obsidian predefinito è solo una scorciatoia: non legge il vault.

## Dati e backup

`data/desktop.sqlite` contiene desktop, impostazioni, password con scrypt e sessioni con token memorizzati come hash. `data/uploads/` contiene immagini caricate, con nomi generati dal server. PNG, JPEG, WebP e GIF fino a 10 MB; SVG caricati non sono accettati. Gli asset SVG predefiniti sono codice locale del progetto.

Per un backup semplice, arresta il server e copia l'intera directory `data/` (con eventuali file SQLite `-wal` e `-shm`). Ripristina la directory prima di riavviare. Dalle Impostazioni → Dati e backup puoi anche esportare/importare il desktop in JSON (le immagini caricate restano su disco e vanno copiate a parte). I file caricati rimangono sul disco anche se la tile viene eliminata: non è ancora presente una raccolta automatica dei file inutilizzati. La password si cambia da Impostazioni → Sicurezza.

## Docker

```sh
docker compose up --build -d
```

Apri http://127.0.0.1:3001 e configura la password. Il volume `edon-data` mantiene database e immagini tra riavvii. Non usare `docker compose down -v` se vuoi conservare i dati.

Il binding predefinito è localhost. Per accesso remoto usa un reverse proxy HTTPS o una VPN; configura la prima password prima di rendere il servizio raggiungibile. Dietro HTTPS imposta `COOKIE_SECURE=true` e inoltra correttamente Host e Origin. Non esporre la directory dei dati tramite il reverse proxy.

## Verifiche

```sh
npm run build
npm test
npm run test:e2e
```

I test del backend usano directory temporanee e verificano autenticazione, validazione, upload, conflitti e riavvio. I test browser usano un server isolato sulla porta 4173 e Google Chrome installato in `/Applications/Google Chrome.app`; configura `CHROME_PATH` su altre macchine. Per Chromium di Playwright, passa il percorso dell'eseguibile in `CHROME_PATH`. Le schermate sono in `test-results/`.

```sh
npm run format:check
```

## Struttura e prossime fasi

- `packages/shared`: modelli TypeScript/Zod, preset, composizione iniziale e posizionamento senza sovrapposizioni.
- `apps/server`: persistenza SQLite, autenticazione, upload e interfaccia HTTP.
- `apps/web`: canvas, renderer dei contenuti, ispettore e salvataggio serializzato.

[Guida al desktop](docs/desktop.md) · [Esiti della verifica](docs/verification.md) · [Interfaccia HTTP](docs/api.md) · [Decisioni e limiti](docs/implementation.md) · [Skill installate](docs/skills.md)

Per gli agenti esterni esistono token Bearer, un CRUD per tile con chiavi stabili e scadenze, e un server MCP (`/mcp`), tutti sullo stesso servizio. **Aggiungi tile → Crea con agenti AI** chiede a Hermes di agire. Configurazione: `EDON_AGENT_TOKEN`, `HERMES_URL`, `HERMES_API_KEY`, `HERMES_MODEL` (vedi `.env.example`) oppure Impostazioni globali.

Nessun JavaScript personalizzato viene eseguito. Note e TODO supportano Markdown, inclusi immagini/GIF, collegamenti, codice, tabelle e checklist. L’HTML incorporato viene ignorato e gli URL non sicuri vengono bloccati.

## Asset e licenze

Space Grotesk e Doto sono distribuiti localmente dai pacchetti Fontsource con licenza SIL OFL (vedi `node_modules/@fontsource-variable/*/LICENSE`). Le illustrazioni SVG in `apps/web/public/art` sono originali del progetto. Le immagini di riferimento in `docs/visual-references` sono usate come ispirazione e non sono distribuite nel frontend.
