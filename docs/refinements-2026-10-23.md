# Note e ridimensionamento — 23 ottobre 2026

## Problemi riprodotti

- L’anteprima di una nota conteneva una textarea e l’azione «Aggiungi testo», benché la scrittura dovesse avvenire nel documento aperto.
- Il titolo e il corpo intercettavano il clic, impedendo l’apertura naturale della nota.
- L’editor gestiva soprattutto l’aggiunta in fondo; il testo precedente non era modificabile nel punto desiderato. La riga attiva veniva salvata soltanto con Invio o alla perdita del focus.
- I metadati comparivano al passaggio del mouse. Nel caso riprodotto sottraevano circa 22 px al contenuto della nota.
- La dimensione in celle non descriveva lo spazio effettivo: regole per 1×1 e 2×1 entravano in conflitto con larghezza della finestra, densità e pannello laterale. Il widget quote AI superava la propria larghezza; le cartelle lasciavano tagliare il titolo.

## Correzioni

L’editor è ora separato dall’anteprima. Conserva Markdown come formato di salvataggio e usa le posizioni dei blocchi prodotte dal renderer per modificare il testo selezionato senza riscrivere il resto del documento. Il blocco attivo mostra il sorgente; gli altri restano renderizzati. Titolo e corpo si aggiornano subito, senza aspettare Invio. La modalità sorgente consente di lavorare sull’intero documento. Sono presenti annulla/ripristina e il limite di 10.000 caratteri già previsto dal modello dati.

Le dimensioni dei caratteri e la visibilità dei dettagli seguono lo spazio reale dei tile. Nelle celle molto strette si riducono i margini e si privilegia il titolo. I widget prestazioni e quote AI mantengono i dettagli scorrevoli; le cartelle riducono l’anteprima prima di sacrificare titolo e apertura. Il passaggio del mouse non cambia più la disposizione delle note.

## Verifiche

Test browser dedicati coprono sola lettura sul desktop, apertura dal titolo, correzione di un paragrafo precedente, persistenza senza Invio, conservazione di liste e codice, annulla, limite del contenuto, note lunghe e aggiunta rapida nelle TODO. Una matrice verifica note, TODO, orologio, prestazioni, quote AI, radio, timer e cartelle a 1440, 1000 e 390 px. Le schermate sono generate in `test-results/` e non sono versionate.

I test utilizzano un database temporaneo; il desktop personale non viene modificato. Nessuna nuova dipendenza di runtime.

## Limiti ancora aperti

Questa è una correzione dei flussi principali, non un’equivalenza completa con Obsidian o Notion. Non include selezione continua tra più blocchi, trascinamento dei blocchi o continuazione automatica delle liste. Per strutture Markdown multilinea si modifica il blocco o l’intero sorgente.

Sfondi animati e animazioni non sono stati sottoposti a un nuovo benchmark su hardware poco potente. Le modifiche locali già presenti in quelle aree sono state conservate. La revisione non certifica tutti i punti storicamente spuntati in TODO.md.

Il controllo di formattazione dei file modificati passa. Il controllo globale segnala ancora cinque file preesistenti fuori da questo intervento: `CaptureComposer.tsx`, `ExtraTiles.tsx`, `Inspector.tsx`, `Modal.tsx` e `packages/shared/model.ts`.

Esito finale: build TypeScript/Vite riuscita e 39 test di logica/integrazione superati. L’ultima esecuzione completa del browser ha superato 28 scenari su 29; il controllo residuo misurava il layout prima del caricamento dei font e dell’assestamento della griglia. Dopo aver aggiunto quell’attesa, è stato rieseguito con i due scenari precedenti: tutti e tre superati. Il confronto sull’altezza del testo prima/dopo hover resta esatto, senza allargare la tolleranza.
