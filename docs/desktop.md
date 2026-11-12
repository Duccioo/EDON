# Guida al desktop

Per Obsidian vedi [obsidian.md](obsidian.md); per HTTP, token e agenti vedi [api.md](api.md) e [agents.md](agents.md).

## Layout e modifica

- **Vista** usa link, spunte, player e cartelle. **Modifica** (**E** o menu **+**) abilita trascinamento, maniglia di ridimensionamento e ispettore.
- Colonne e righe sono dinamiche e si configurano separatamente in **Aspetto** (2–12 colonne, 2–128 righe). Una riduzione viene rifiutata se non può contenere tutte le tile; nessun contenuto viene eliminato implicitamente.
- Da **900×600 px** la griglia riempie l’area tra intestazione e comandi, con celle eventualmente rettangolari. Sotto queste dimensioni la vista scorre; tra 600 e 899 px usa quattro colonne e fino a **599 px una colonna**. Le coordinate logiche salvate non cambiano.
- Il limite iniziale è 24 tile, configurabile fino a 100. Note e TODO arrivano a 3 colonne e tutte le righe disponibili, file a 3×3, gli altri tipi a 2×2.
- Le tile vicine restano ferme: è possibile occupare spazio libero o scambiare due tile delle stesse dimensioni. **Compatta** le sposta verso l’alto a sinistra solo su richiesta.

## Cattura e documenti

La barra **Appunta qualcosa** accetta Markdown e riconosce i link. **Todo** converte le righe `- [ ]` / `- [x]` conservando il resto del testo. Graffetta, incolla e trascinamento aggiungono immagini/GIF; ⌘/Ctrl+Invio salva e libera il campo, mentre un errore conserva la bozza.

Note e TODO si aprono nel documento laterale. Le note si modificano per blocchi o come sorgente Markdown, con salvataggio automatico e annulla/ripristina. Le anteprime sul desktop non entrano in editing; i TODO consentono spunte e aggiunta rapida. **Esc** chiude il pannello.

Il menu **+** contiene Aggiungi tile, Modifica, Esplora Vault, eventuale Archivio locale, scorciatoie e Impostazioni. **Aggiungi tile → Crea con agenti AI** apre il flusso Hermes.

## Tipi di tile

| Tipo                        | Contenuto e comportamento                                      |
| --------------------------- | -------------------------------------------------------------- |
| Collegamento (`link`)       | URL HTTP/HTTPS o `obsidian://`, icona e immagine               |
| Immagine (`image`)          | PNG, JPEG, WebP o GIF caricato oppure HTTPS; riempi/contieni   |
| Nota (`text`)               | Markdown, documento laterale, eventuale file vault collegato   |
| TODO (`data`)               | Testo e massimo 30 checklist, filtri e avanzamento             |
| Orologio (`clock`)          | Fuso IANA, per esempio `Europe/Rome`; vuoto = dispositivo      |
| Cartella (`folder`)         | Fino a 24 mini-tile oppure directory del vault                 |
| Meteo (`weather`)           | Condizioni attuali Open-Meteo, cache di 10 minuti              |
| Timer/scadenza (`progress`) | Avanzamento tra `startsAt` e `endsAt`, con pausa               |
| File (`file`)               | PDF con anteprima della prima pagina; altri file come download |
| Prestazioni (`performance`) | CPU, RAM, disco, carico e uptime del server                    |
| Quote AI (`ai_limits`)      | Voci manuali su limiti e reset delle sottoscrizioni            |
| Radio (`radio`)             | Player dello stream HTTPS configurato                          |

Ogni tile ha colori, tipografia e immagine propri. Forma, bordo, padding, opacità ed effetto vetro sono globali. Il testo usa automaticamente bianco o nero in base al colore di sfondo quando questo viene cambiato senza scegliere un colore testo esplicito.

## Cartelle

Le cartelle non si annidano e non consumano una posizione per ogni elemento. Accettano collegamenti, immagini, note, TODO e orologi.

1. Crea **Cartella** da **Aggiungi tile**.
2. Aprila e usa **Aggiungi tile** per scegliere tile già presenti sul desktop, oppure trascina una tile compatibile sopra la cartella in modifica e attendi l’attivazione.
3. Modifica o rimuovi gli elementi; **Sposta sul desktop** li estrae nel primo spazio libero.

Gli agenti possono gestire `config.children`. Per una cartella vault, `config.vaultPath` è la directory relativa o `*`.

## Wallpaper e impostazioni

**Impostazioni → Aspetto** offre anteprima live, nome del desktop, griglia, limite tile, distanza, forma, bordi, opacità, vetro e palette. Gli sfondi disponibili sono **Pieghe**, **Tinta unita**, **Gradiente**, **Immagine**, **ASCII** e **Rumore**. Gli ultimi due sono animati e rispettano `prefers-reduced-motion`; l’immagine accetta PNG, JPEG, WebP o GIF fino a 10 MB.

Le altre sezioni gestiscono Hermes, token, password, dati/backup, Obsidian e informazioni. Le chiavi Hermes salvate via UI sono in chiaro nel database; quelle fornite via ambiente restano nell’ambiente del processo.

## Archivio ed eliminazione

Senza vault, **Archivia** sposta note/TODO nell’archivio locale (massimo 1.000), incluso nell’export JSON. Il ripristino richiede spazio e rispetta il limite tile. Con il vault attivo l’archiviazione rimuove solo il pin e conserva il Markdown; il menu Archivio locale viene nascosto.

Eliminare una nota collegata al vault sposta il file nella cartella cestino configurata, non lo cancella definitivamente. Le altre eliminazioni e il ripristino iniziale richiedono attenzione; vedi [archivio, eliminazione e backup](obsidian.md#archivio-eliminazione-e-backup).

## Upload, backup e limiti

- `/api/uploads` serve immagini per note e wallpaper. Il drag & drop sul desktop usa `/api/files` e accetta qualsiasi file non vuoto fino a 10 MB. Formati sconosciuti vengono forzati al download; SVG caricati non vengono renderizzati come immagini.
- `data/desktop.sqlite` contiene documento, impostazioni e credenziali derivate; `data/uploads/` contiene tutti i file.
- **Dati e backup → Esporta JSON** esporta desktop e archivio locale, non upload né vault. L’import sostituisce il desktop validato.
- Per un backup completo arresta il server e copia `data/` con `-wal`/`-shm`, più il vault separatamente. Non esiste garbage collection degli upload non più referenziati.
- Note fino a 10.000 caratteri, attività fino a 300 caratteri, 30 voci per TODO e 24 elementi per cartella. Nessun JavaScript personalizzato viene eseguito; HTML Markdown incorporato e URL non sicuri vengono bloccati.
