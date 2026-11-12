# Desktop completo e impostazioni visive — storico

> Verifica storica del 17 ottobre 2026; gli esiti non certificano la release corrente. Per il layout attuale vedi [desktop.md](desktop.md).

Revisione del 17 ottobre 2026.

## Comportamento

- A partire da una finestra di 900×600 px, il desktop occupa l’intera area utile. Colonne e righe sono configurabili indipendentemente in Aspetto; larghezza delle colonne e altezza delle righe si adattano indipendentemente. Le tile possono essere rettangolari: la griglia non viene rimpicciolita al centro lasciando grandi margini laterali.
- Intestazione e dock hanno spazio riservato, aggiornato mentre la cattura cresce; nessuna tile finisce sotto i comandi. Posizioni e dimensioni logiche salvate non vengono riscritte per adattare la vista.
- Padding e distanza si adattano alla densità della composizione. Le anteprime delle tile basse sono sintetiche; lettura e modifica complete rimangono nelle viste dedicate.
- Le finestre più piccole mantengono il comportamento scorrevole già presente. Canvas con pan/zoom, navigazione bidimensionale e nuova UX mobile sono rimandati.

## Impostazioni

Aspetto ha controlli e anteprima affiancati. L’anteprima rimane visibile durante lo scorrimento dei controlli e mostra una composizione sintetica più un dettaglio ingrandito per forma, bordi, padding, vetro e opacità.

Colonne e righe hanno due controlli separati (2–12); le griglie precedenti con più righe rimangono valide. La miniatura mostra anche le celle vuote. Il desktop tenta una ridisposizione senza cambiare dimensioni e contenuti; una griglia che non accoglie tutte le tile viene rifiutata. I confini valgono anche per spostamenti, ridimensionamenti e API agenti.

La distanza ha un cursore 0–40 e tre preset. Otto colori pronti sono disponibili sia per lo sfondo sia per le singole tile; per le tile viene impostato anche un colore del testo abbinato. I selettori personalizzati sono sotto una sezione espandibile. Le impostazioni sono un dialog nativo che trattiene il focus da tastiera e lo restituisce all’uscita.

## Capacità

24 tile per i nuovi desktop; configurazione fino al limite strutturale di 100. Aggiunta, cattura rapida, duplicazione e creazione tramite agenti rispettano lo stesso limite. La validazione del documento impedisce importazioni o salvataggi con più tile del limite dichiarato. Il numero di elementi dentro una cartella non consuma altri posti del desktop.

I desktop precedenti senza `maxTiles` ricevono almeno 24 posti, o il numero di tile già presenti se maggiore. Nessun contenuto viene eliminato. Le opzioni inferiori al numero attuale di tile sono disabilitate.

## Verifica

- 28 test automatici (inclusi Markdown, cattura, archivio e limiti per tipo): adattamento della griglia, occupazione dell’area disponibile, limite condiviso, migrazione dei dati precedenti, rifiuto delle scritture oltre limite e test già presenti.
- Build TypeScript/Vite e formattazione Prettier.
- Nel browser integrato: composizione a 1440×900 e 1280×720, anteprima live di distanza/angoli/colori, salvataggio del limite, raggiungimento della capacità e blocco della duplicazione, preset di colore nell’ispettore, focus nel dialog delle impostazioni.
- Suite Playwright aggiornata per il nuovo layout; non eseguita integralmente.

Gli screenshot correnti del desktop e delle impostazioni sono in [`docs/screenshots`](screenshots/).
