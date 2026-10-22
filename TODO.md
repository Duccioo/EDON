# TODO

## Verifica delle rifiniture — 23 ottobre 2026

- [x] Note sul desktop in sola lettura, incluso il titolo; un clic apre il documento laterale. Aggiunta rapida soltanto nelle TODO.
- [x] Modifica dei blocchi già scritti, rendering con Invio, modalità sorgente, salvataggio durante la digitazione e annulla/ripristina nell’editor delle note.
- [x] Anteprime dimensionate sullo spazio effettivo, senza salti al passaggio del mouse; contenuti dei widget stretti scorrevoli e titoli delle cartelle contenuti.
- [ ] Validare la fluidità di sfondi e animazioni con misurazioni su hardware meno potente: la precedente spunta non costituisce una verifica prestazionale.
- [ ] Rifinire ulteriormente l’esperienza di scrittura: selezione tra blocchi e continuazione automatica delle liste. L’editor conserva Markdown e offre la modalità sorgente, ma non replica tutte le interazioni di Obsidian/Notion.

Dettagli e verifiche: [rifiniture del 23 ottobre](docs/refinements-2026-10-23.md).

## Attività precedentemente segnate come completate


- [x] Ancora vedo poche animazioni, tipo quando apro un tile o quando lo chiudo, oppure quando apro le impostazioni, oppure quando apro il menù di aggiunta tile.
  - [x] Cerca una libreria per animazioni e micro-interazioni sul web e reddit
- [x] Il modo con cui faccio l'editing di una nota è sbagliato. Non voglio che si apra un editor, voglio che sia sempre una sorta di editor tipo come avviene con Notion che posso tranquillamente scrivere nella nota senza cliccarci, il rendering in markdown avviene in tempo reale mentre scrivo (si renderizza solo dopo che vado a capo, non ad ogni lettera digitata)
  - [x] Non posso scrivere direttamente sul tile nel desktop, devo aprire il tile per scrivere.
  - [x] Magari aggiungere un pulsante per farlo tornare o in modalità testo normale o in modalità markdown compilato on the fly per chi non lo vuole.
  - [x] Aggiungere la possibilità di cambiare il colore dello sfondo direttamente nella pagina del tile, senza dover aprire le impostazioni (basta metterci qualche colore in alto)
- [x] Il modo con cui vedo i tile di testo non mi piace:
  - [x] se sono tipo 1x1 o 2x1 sono talmente piccoli che vedo solo il titolo gigantesco, c'è tanto spazio inutilizzato tipo in alto e in basso
  - [x] magari servirebbe un modo per riorganizzare le informazioni a seconda di quanto è grande il tile, se è troppo piccolo va bene vedere solo il titolo eh
- [x] Gli sfondi animati sono troppo pesanti fanno laggare tutto!
- [x] L'effetto 3d Parallasse sui tile è troppo evidente, ridurlo!



---
- [ ] Tile calendario
- [ ] Cliccando sul tile meteo si apre un popup con le previsioni del meteo per i prossimi giorni e con più informazioni.
- [ ] Scrivere una documentazione approfondita.
- [ ] Aggiungere un'integrazione profonda con Paperless-ngx.
- [ ] Aggiungere l'integrazione con Google Calendar.
- [ ] Consentire la configurazione di tutte le integrazioni sia tramite lo stack Docker sia dall'interfaccia, nelle impostazioni.
- [ ] Aggiungere un'estetica Wii-style: Nintendo anni 2000–2010, iisu, Cocoon, [Neo-Vectorheart](https://cari.institute/aesthetics/neo-vectorheart), [Neo-Y2K](https://cari.institute/aesthetics/neo-y2k) e glasstype.
- [x] Animazioni e micro-interazioni di prodotto (entrance tile, dialog, toast, hover) nel rispetto di `prefers-reduced-motion`.
  - [x] NO, le animazioni vanno fatte per bene e devono essere molto presenti.
- [ ] Aggiungere la possibilità di fare più viste (Tipo vista lavoro, vista personale, ecc.) e poterle cambiare velocemente.

---
- [x] Per aggiungere note o altro è sufficinete iniziare a scrivere con la tastiera, e poi il desktop capisce che voglio aggiungere una nota o un todo o altro, e mi fa scegliere cosa voglio aggiungere.
  - [x] Aggiunstare il bug che quando scrivo parecchio il desktop si rimpicciolisce in alto
- [x] il lato esterno della pagina lo voglio che sia a filo della finestra mentre il lato interno voglio che sia resizable.
- [x] Passando su un tile di testo molto lungo se scorro col mouse il contenuto del tile scorre, invece di dover aprire il tile per vedere tutto il contenuto.
- [x] Tile prestazioni
- [x] Tile Subscription AI limits
- [x] Mancano le animaizoni
- [x] Keybinding rapidi
- [x] Tile radio DJ osso
- [x] barra di "appunta qualcosa" e il bottone centroale si sovrappongono quando apro l'editor delle note
- [x] Editor delle note: doppio click per modificare la nota, il rendering markdown avviene ogni volta che vado a capo.
- [x] Aggiungere un'integrazione profonda con Obsidian.
  - Opzionale ma profonda (configurabile da `.env`/Docker e da `Impostazioni → Integrazioni`), con sincronizzazione bidirezionale su file `.md` puliti, esplora Vault, tile cartella/vault, strumenti MCP per agenti AI e vista documento laterale (sinistra/destra) con desktop scorrevole.
- [x] Lo sfondo animato circolare è troppo oneroso, magari ridorre il numero di scritte e renderlo più efficiente.
- [x] L'effetto 3D non funziona.
- [x] La grandezza dei tile orizzontali facciamola a multipli di 4
  - così per avere la vista desktop full e poi la vista mobile a 4 tipe orizzontali e poi a mò di lista
- [x] Modificare la trasparenza dello sfondo
- [x] Migliorare la gestione delle cartelle!
  - [x] Quando trascino un tile a lungo sopra una cartella, la cartella si un po' (fa un animazione) e posso rilasciare il tile dentro.
- [x] Per i tile di testo (note, todo, ecc.) posso farli alti quanto mi pare e se c'è spazio è possibile sia aggiungere una todo direttamente al volo con un pulstante oppure aggiungere del testo alla nota direttamente al volo con un pulsante sul tile invece di dover aprire il tile e poi modificare il contenuto.
- [x] Quando sono in modalità modifica, compare un pulsante nei tile per eliminare velocemente.
- [x] Lo sfondo ruotante non è centrato sulla scritta in alto a sinistra "edon".
  - andrebbe fatto anche che gli archi della circonferenza arrivano molto più distanti, cioè c'è più roba
  - il testo EDON e NODE lo vorrei normale e non in ASCII e lo vorrei che girasse attorno alla circonferenza, tipo come se fosse scritto su un cerchio, e che ruotasse insieme al cerchio.
- [x] Quando passo sopra un tile con il mouse vorrei un effetto parallasse 3D, cioè il tile si muove leggermente in base alla posizione del mouse sopra di esso.
- [x] Con sfondo scuro mettere testo bianco e con sfondo chiaro mettere testo nero, in modo automatico.
- [x] Lo sfondo animato non funziona
- [x] tile timer
- [x] Tile del meteo
- [x] Tenere premuto un tile per riposizionarlo
- [x] 1 o 2 sfondi animati:
  - [x] Cerchio in alto a sinistra che ruota, il cerchio è fatto di caratteri ASCII + la scritta EDON e NODE che si ripete all'infinito, il tutto con dithering.
  - [x] perlin noise classico, dithering
- [x] Aggiungere tile con barre di avanzamento (esempio timer o promemoria di scadenza).
- [x] Poter mostrare anche pdf tile.
- [x] Poter fare drag e drop di file per metterli nel desktop a tile, e se il file è un PDF o un'immagine creare un tile che mostra l'anteprima del file.
- [x] Va tolto il simbolo del marchio registrato nel logo.
- [x] Bottone delle impostazioni in alto a destra accanto al tasto di logout.
- [x] Togliere il testo e il puntino "tutto salvato" in basso a destra.
- [x] Migliorare le cartelle, non aggiungendo roba direttamente dalla cartella ma spostando i tile già esistenti dentro la cartella. Oppure cliccando l'aggiunta dentro una cartella si apre di lato un menù per scegliere tra i tile già esistenti quale inserirci.
- [x] Quando nella barra del testo ci metto un link trasformarlo in un tile collegamento.
- [x] nelle todo mettere in basso una piccolissima barra di avanzamento che indica quante todo sono state completate
- [x] correggere problema visualzizazione tile ora (spesso va fuori dallo schermo)
- [x] Mostrare, durante la modifica del desktop a tile, i quadratoni stondati che indicano la griglia di tile disponibile.
- [x] Aggiungere un pulsante durante la modifica per compattare i tile e rimuovere il più possibile gli spazi vuoti.
- [x] Aggiungere un'integrazione profonda con Hermes e agenti AI.
- [x] Rifare la pagina delle impostazioni a tutto schermo (Aspetto, Agente AI, token, Sicurezza, Dati e backup, Integrazioni, Info).
- [x] Consentire la creazione di cartelle.
- [x] Rendere la creazione di nuovi tile gestibile da agenti LLM.
- [x] Rifinire tutta la UX tipo: come aggiungo una nuova nota o i todo, i bottoni della barra in basso vanno separati, magari aggiungere solo i pulstanti nota e todo, poi un pulsante "+" che quando ci passo sopra fa comparire pulsanti per aggiungere tile, modificare tile, le impostazioni, ecc.
- [x] Togliere i sottotitoli ai lati della dashboard
- [x] Una volta create le note o le todo devo poterle modificare, quindi aggiungere un pulsante per modificare le note e le todo.
- [x] Aggiungere un pulsante per eliminare le note e le todo.
- [x] Il pulsante per cercare nel desktop deve diventare un pulsante per chiedere all'agente ai tipo:
  - "aggiungi un tile che mostra la nota del progetto X"
  - "metti il tile dell'ora di New York"
  - "Aggiungi un tile che mostra il meteo a Firenze"
  - "Mostra un tile che si aggiorna giornalmente con le notizie di tecnologia"
  - quindi i tile sono oggetti che possono essere modificati nel tempo in base a vari comandi
