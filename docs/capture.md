# Cattura, contenuti e archivio

Revisione del 17 ottobre 2026. Il flusso principale è scrivere e salvare senza passare dal catalogo.

- Barra unica Markdown, espansione graduale e salvataggio con ⌘/Ctrl + Invio. Il salvataggio riuscito libera e rifocalizza il campo; un errore conserva la bozza.
- Conversione in TODO dalle righe `- [ ]` / `- [x]`, conservando contesto, immagini e blocchi di codice. Un primo titolo Markdown può diventare il titolo della tile.
- Immagini e GIF tramite allegato, incolla o trascinamento. Rendering Markdown senza HTML incorporato; URL di immagini e collegamenti filtrati.
- Archiviazione rapida su note/TODO e nella vista completa. Lettura e ripristino da **+ → Archivio**; contenuto incluso nei salvataggi e nei backup. Ripristino rifiutato, senza perdita di dati, se manca spazio o si supera il limite.
- Note e TODO fino a 3×3, gli altri tipi fino a 2×2, con validazione anche nel modello condiviso e nelle API.
- Celle libere sempre visibili in modo leggero. Il desktop riserva lo spazio reale occupato dalla barra mentre cresce.
- Creazione AI in **Aggiungi tile → Crea con agenti AI**. Se manca la configurazione, viene offerto il collegamento alle impostazioni.

Verifica: 28 test automatici superati, build TypeScript/Vite e Prettier superati. Nel browser integrato a 1440×900: cattura TODO con testo Markdown, archiviazione/ripristino, upload e lettura GIF, nota 3×3 persistente dopo reload, percorso AI senza configurazione, composizione senza overflow con barra espansa. Suite Playwright aggiornata ma non eseguita integralmente.

Schermata locale: `test-results/capture-review/desktop-capture.png`. Vite segnala un bundle JavaScript superiore a 500 kB (circa 160 kB gzip).
