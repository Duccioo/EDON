# Prima milestone — documento storico

> **Storico (ottobre 2026).** Questo documento conserva le decisioni iniziali e non descrive lo stato attuale: Markdown, API agenti, MCP, tipi aggiuntivi e integrazione Obsidian sono ora implementati. Per il comportamento corrente usa [desktop.md](desktop.md), [obsidian.md](obsidian.md), [api.md](api.md) e [agents.md](agents.md).

## Obiettivo

Una homepage personale interattiva e persistente, prima di Obsidian, cattura nel vault e MCP. Tutti i contenuti, incluso l'orologio, usano lo stesso modello tile.

## Direzione visiva

Palette: inchiostro `#191b1b`, carta `#f1f1ed`, nebbia `#d7d8d5`, grigio vetro `#e4e6e2`, lime `#d6ef53`. Space Grotesk per l'interazione; Doto per l'orologio; serif editoriale e monospace selezionabili per singola tile.

Canvas centrato a sei colonne e celle quadrate. Il punto focale è la composizione dei contenuti; controlli raccolti in una piccola barra inferiore. Ispettore temporaneo durante la modifica. La varietà delle tile e lo sfondo astratto derivano dai riferimenti locali; non c'è una sidebar permanente.

La revisione del piano contro il brief conferma che griglia, accento lime e tipografia industriale sono richiesti dai riferimenti. Gli SVG locali sostituiscono le fotografie senza dipendere da immagini remote. Gli stessi comportamenti di selezione e modifica mantengono coerenti gli stili eterogenei.

## Scelte

- React 18, Vite, CSS esplicito: abbastanza per questo sistema visivo, senza aggiungere un secondo livello di token Tailwind.
- react-grid-layout 1.5.4: trascinamento e ridimensionamento collaudati. La versione è fissata per mantenere l'interfaccia legacy; verificare una futura migrazione separatamente.
- Node 24+, Fastify e SQLite integrato in Node. Nessuna compilazione di addon SQLite nativi. Su Node 24 l'interfaccia SQLite è ancora segnalata sperimentale dal runtime.
- Un documento desktop in SQLite con confronto atomico della revisione. Per un singolo desktop personale limita schema e transazioni; CRUD delle singole tile potrà leggere/modificare lo stesso modello attraverso Store.
- Salvataggi browser serializzati e ritardati di 350 ms. Nessuna sovrascrittura silenziosa in caso di revisione vecchia. Non c'è ancora sincronizzazione in tempo reale tra finestre.
- File persistenti separati dal database; sessioni persistenti ma token salvati come hash.
- Nessuna esecuzione dinamica, renderer modulari per i cinque tipi attivi. Una futura estensione eseguibile richiederà isolamento iframe e un'interfaccia di capacità esplicita.

## Limiti intenzionali

- Obsidian è solo un collegamento URI generico; nessuna lettura/scrittura del vault, cattura o MCP.
- Nessuna API pubblica per agenti, token con permessi o aggiornamento in tempo reale.
- Testo semplice; niente Markdown in questa fase.
- Mobile usa una composizione semplificata e i controlli dell'ispettore, senza layout mobile separato.
- Immagini caricate controllate tramite firma del formato e limite dimensionale; non sono ricodificate. Nessun garbage collector per gli upload.
- Nessuna procedura di recupero password nella UI: proteggere il backup del database.
- I campi `expiresAt`, `origin` e `externalKey` preparano il modello; scadenza e idempotenza arriveranno con il lavoro sugli agenti.

## Revisione delle interazioni

La barra raccoglie Nota, TODO, aggiunta tile, modifica, impostazioni globali e ricerca locale. La cattura rapida crea normali tile persistenti, senza usare un vault esterno.

Note e liste si aprono in un dialog nativo con backdrop sfocato, focus contenuto e chiusura con Esc. Le anteprime TODO calcolano il numero di righe complete in base all'altezza disponibile; la vista completa mantiene tutte le voci interattive.

Il trascinamento consente sovrapposizioni solo durante il gesto. Al rilascio il modello accetta uno spazio libero o uno scambio con una sola tile delle stesse dimensioni; altrimenti ripristina la posizione senza spostare le altre. La stessa regola si applica ai pulsanti dell'ispettore e al ridimensionamento.

Forma, bordo, padding, opacità e vetro sono proprietà globali con default compatibili con i desktop salvati. I vecchi campi in `appearance` rimangono leggibili per compatibilità dei dati ma non governano più queste proprietà; l'ispettore non li espone.
