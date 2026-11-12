# Verifica corrente

Data: **12 novembre 2026**. Ambito: sicurezza, integrità dei dati, frontend, documentazione e release readiness GitHub.

Ambiente osservato: macOS, Node **26.12.1**, npm **11.20.0**, Google Chrome locale tramite `CHROME_PATH`.

| Controllo                  | Esito osservato                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm test`                 | **Superato**: 46/46 test                                                                          |
| `npm run build`            | **Superato**: TypeScript e build Vite; resta un avviso non bloccante sul chunk principale >500 kB |
| `npm run format:check`     | **Superato**                                                                                      |
| `npm audit`                | **Superato**: zero vulnerabilità note                                                             |
| `npm run test:e2e`         | **Superato**: 36/36 test, incluse regressioni di concorrenza, mobile, upload e conflitti          |
| Docker/Compose             | **Non verificato localmente**: daemon e sottocomando Compose non disponibili                      |
| Node 24 e Chromium gestito | **Delegati alla CI** su Ubuntu; questa esecuzione locale usa Node 26 e Chrome                     |
| README inglese e link      | **Superato**: nessun link locale o immagine mancante nel repository                               |
| Workflow GitHub            | **Sintassi YAML valida**; prima esecuzione reale delegata a GitHub Actions                        |
| Tag e versione             | `v0.1.0` corrisponde a `package.json`                                                             |
| GitHub Release             | **Pubblicata**: <https://github.com/Duccioo/EDON/releases/tag/v0.1.0>                             |
| Immagine GHCR              | **Pubblicata** per `linux/amd64` e `linux/arm64`; manifest anonimo accessibile                    |

## Pubblicazione v0.1.0

- Workflow Release completato con successo su GitHub Actions dopo la correzione del test sull’altezza del dock.
- Immagine: `ghcr.io/duccioo/edon:0.1.0`, `:0.1` e `:latest`.
- Digest dell’indice multi-architettura: `sha256:a38e66b011fac1b8029e93b7b3eb76da74cf7a8fe6ce2d24d5687a777a017d67`.
- CI del commit di release completata con successo su Node 24.
- Il container pubblicato non è stato avviato manualmente su questa macchina locale; build, test e pubblicazione multi-architettura sono stati eseguiti dalla CI.

Le regressioni aggiunte coprono token vault in sola lettura, note non modificabili senza perdite, versioni Markdown, scritture atomiche, symlink, conflitti senza effetti parziali, collegamento di note non vuote, richieste fuori ordine, upload tardivi e workspace mobili. Non si deduce un esito positivo dai verbali storici.

## Modello per successive release

- Data, revisione sorgente, Node/npm e sistema operativo:
- Comandi eseguiti ed esito (includere conteggi soltanto se riportati dal runner):
- Browser usato e modalità di installazione (`CHROME_PATH` o Chromium gestito):
- Docker build e, se eseguita, prova del container con volume temporaneo:
- Test manuale Obsidian su copia del vault, permessi e ripristino:
- Problemi aperti, test non eseguiti e limiti della verifica:

---

# Archivio storico

I verbali seguenti sono conservati come cronologia. Non dimostrano che le stesse verifiche passino oggi e non coprono le funzionalità aggiunte successivamente, fra cui Obsidian.

## Verifica — 17 ottobre 2026

Cartelle, impostazioni a tutto schermo, cambio password, animazioni e guida
approfondita. Eseguita su Node 26.10.0 e Google Chrome locale tramite Playwright.

- `npm run build`: TypeScript e compilazione Vite completati.
- `npm test`: 16 test passati (12 preesistenti + 4 nuovi su cartelle, retrocompatibilità dei desktop salvati e cambio password).
- `npm run test:e2e`: 13 test passati (11 preesistenti + cartelle con persistenza dopo refresh + navigazione delle sezioni impostazioni).
- `npm run format:check`: completato.
- La verifica ha individuato un `animation-fill-mode: both` su `.tile-shell` che forzava `transform: none` e rompeva il posizionamento di react-grid-layout: l'entrance ora anima la tile interna senza fill.

## Verifica — 16 ottobre 2026

Prima milestone del desktop EDON, eseguita su Node 26.10.0 e Google Chrome locale tramite Playwright.

- `npm run build`: TypeScript e compilazione Vite completati.
- `npm test`: 3 test passati. Posizionamento senza sovrapposizioni, creazione/ridimensionamento/duplicazione di orologi, URL, autenticazione, conflitti di revisione, upload e persistenza dopo chiusura/riapertura del backend.
- `npm run test:e2e`: 8 test passati. Composizione desktop e mobile, creazione e stile di un orologio, fuso orario, persistenza dopo refresh, link, upload, trascinamento con mouse, ridimensionamento tramite maniglia, scorciatoia E, wallpaper ed eliminazione con conferma.
- `npm run format:check`: completato.
- `npm install --package-lock-only --ignore-scripts --offline`: lockfile aggiornato; audit npm completato con zero vulnerabilità note nel database disponibile durante l'installazione.
- Schermate controllate visivamente: [desktop](screenshots/desktop.png) e [mobile](screenshots/mobile.png).

La verifica visiva ha individuato e fatto correggere un selettore CSS condiviso per errore tra contenitore tile e immagine, che nascondeva una tile su mobile. Il test browser ora verifica anche che il contenitore immagine mantenga il corretto posizionamento CSS.

Dockerfile e Compose sono presenti, ma l'avvio container **non è verificato**: nell'ambiente il daemon Docker non è attivo e il sottocomando Compose non è disponibile. L'applicazione è stata eseguita e verificata direttamente con Node.

Non verificati perché fuori da questa milestone: accesso al vault Obsidian, Quick Capture, API per agenti e MCP. Il comportamento di apertura `obsidian://` dipende dall'app associata sul dispositivo.

## Correzioni richieste dopo la prima prova

Verificati con i test browser: creazione rapida di note e TODO, apertura al centro con backdrop sfocato, note da 60 paragrafi con scorrimento, liste da 25 attività con spunte persistenti, anteprima con sole righe complete e ricerca nel testo. Verificati anche forma/bordi globali dopo il refresh e rimozione dei controlli strutturali dall'ispettore individuale.

I test del modello verificano che uno scambio valido lasci ferme le tile non coinvolte; il browser verifica il ripristino di un trascinamento incompatibile. Le impostazioni di forma ricevono default durante la lettura dei desktop salvati con il modello precedente.

Schermate aggiornate: [nota espansa](screenshots/expanded-note.png), [TODO espansa](screenshots/expanded-todo.png).
