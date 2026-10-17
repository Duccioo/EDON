# Verifica — 17 ottobre 2026

Cartelle, impostazioni a tutto schermo, cambio password, animazioni e guida
approfondita. Eseguita su Node 26.10.0 e Google Chrome locale tramite Playwright.

- `npm run build`: TypeScript e compilazione Vite completati.
- `npm test`: 16 test passati (12 preesistenti + 4 nuovi su cartelle, retrocompatibilità dei desktop salvati e cambio password).
- `npm run test:e2e`: 13 test passati (11 preesistenti + cartelle con persistenza dopo refresh + navigazione delle sezioni impostazioni).
- `npm run format:check`: completato.
- La verifica ha individuato un `animation-fill-mode: both` su `.tile-shell` che forzava `transform: none` e rompeva il posizionamento di react-grid-layout: l'entrance ora anima la tile interna senza fill.

# Verifica — 16 ottobre 2026

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
