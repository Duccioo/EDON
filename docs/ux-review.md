# Revisione UX — 17 ottobre 2026

Revisione del desktop, lettura e modifica Note, creazione e gestione Todo, barra strumenti e adattamento mobile. Riferimento indicato: [CocoonFE](https://github.com/inssekt/CocoonFE). Il movimento proposto collega apertura e chiusura alla tile; non è una replica misurata dei tempi di Cocoon.

## Direzione

Manteniamo colori delle tile, Space Grotesk, Doto e caratteri editoriali scelti dall’utente. Palette esistente: inchiostro `#1c201e`, superficie `#f7f8f0`, grigio `#d7d8d5`, verde `#657156`, accento lime delle note. La griglia rimane il centro; il dock diventa una serie di controlli indipendenti. Il movimento risponde alle azioni, senza far rimbalzare tutte le tile all’ingresso o al passaggio del mouse.

## Flussi controllati

| Passo | Esito | Problema osservato e intervento |
| --- | --- | --- |
| 1. Desktop e barra | Verificato | Decorazioni “+” senza funzione e barra compatta con etichette. Rimosse le crocette; Note, Todo e + hanno superfici indipendenti e nomi accessibili. Anteprime basse alleggerite per conservare spazio al contenuto. |
| 2. Lettura e modifica Note | Verificato | Il pannello generico separava troppo apertura e contenuto. Vista con gerarchia tipografica, data, margini più ampi ed editor dedicato. Matita nella tile per la modifica diretta. Salvata una nota multilinea e verificata la scorciatoia ⌘ Invio. |
| 3. Creazione e gestione Todo | Verificato | Il solo campo multilinea rendeva poco diretta la gestione. Introdotti inserimento con Invio, modifica delle singole righe, completamento e rimozione prima del salvataggio. Incolla un elenco mantiene l’inserimento in blocco. Nella vista aperta: filtri, aggiunta diretta e avanzamento. Verificati salvataggio della bozza pendente, completamento, filtri e persistenza dopo ricarica. Anteprima con attività da fare prima di quelle completate. |
| 4. Menu + | Verificato | Il menu compariva al semplice passaggio del puntatore. Ora apre e chiude al clic; mantiene Aggiungi, Modifica e Impostazioni e si chiude con Esc. |
| 5. Mobile | Verificato a 390 px | I tre pulsanti restano indipendenti; campo ricerca/agente sopra al dock per non comprimere l’input. Nessun overflow orizzontale rilevato. |

## Evidenze locali

Le schermate sono in `test-results/ux-review/` (directory delle verifiche esclusa da Git). Le immagini iniziali provengono dal desktop esistente; i flussi che scrivono dati sono stati provati su un server separato con database temporaneo. I confronti iniziale/finale usano viewport differenti e documentano il comportamento, non un confronto pixel per pixel.

1. [Desktop iniziale](../test-results/ux-review/01-desktop-before.png)
2. [Lettura nota iniziale](../test-results/ux-review/02-note-before.png)
3. [Desktop aggiornato](../test-results/ux-review/03-desktop-after.png)
4. [Vista Todo](../test-results/ux-review/04-todo-after.png)
5. [Editor Note](../test-results/ux-review/05-note-editor-after.png)
6. [Lettura Note](../test-results/ux-review/06-note-after.png)
7. [Mobile](../test-results/ux-review/07-mobile-after.png)
8. [Menu azioni](../test-results/ux-review/08-actions-after.png)

## Verifiche e limiti

- Build TypeScript e Vite riuscita; controllo Prettier riuscito.
- 16 test automatici superati, inclusi storage, conflitti, autenticazione, proxy, cartelle, agenti e MCP.
- Flussi UI verificati nel browser integrato con dati temporanei. Nessun errore console rilevato nella sessione verificata.
- Aggiornata la suite browser per il menu a clic, l’assenza di crocette e il nuovo editor; aggiunto un caso per inserimento, filtri e persistenza. La suite Playwright completa non è stata eseguita.
- Nomi accessibili conservati sui controlli senza testo, focus visibile e dialog nativo. Il codice rispetta `prefers-reduced-motion` sia per CSS sia per le animazioni dei dialog. Non è una certificazione di accessibilità: non eseguiti test con screen reader, dispositivi touch fisici o tutti i colori personalizzati.
- Le animazioni richiedono un giudizio dal vivo: una schermata statica non ne dimostra fluidità o somiglianza al riferimento. Nessuna nuova dipendenza.
