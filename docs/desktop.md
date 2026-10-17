# Guida al desktop

Tutto quello che EDON sa fare dal browser: tile, cartelle, impostazioni,
scorciatoie, backup e limiti. Per l'interfaccia HTTP e gli agenti vedi
[api.md](api.md) e [agents.md](agents.md).

## Vista e modifica

Il desktop ha due modi:

- **Vista**: le tile sono interattive (link, spunte, orologi, cartelle).
  I controlli di modifica sono nascosti.
- **Modifica** (pulsante nel menu **+**, oppure tasto **E**): trascina le tile,
  ridimensionale dall'angolo in basso a destra, selezionale per aprire
  l'ispettore. La griglia delle celle libere diventa più evidente.

Regole di disposizione:

- Griglia con colonne e righe configurabili separatamente in Aspetto; note e TODO fino a 3 colonne e tutte le righe disponibili; collegamenti, immagini, orologi e cartelle fino a 2×2. Tutte le combinazioni intermedie sono disponibili. Le celle non usate restano visibili in modo leggero.
- Su desktop da 900×600 px usa tutta la larghezza e l’altezza disponibili tra intestazione e dock. Le celle possono essere rettangolari: tutte le tile restano visibili senza scorrere.
- Limite iniziale di 24 tile, modificabile in Impostazioni → Aspetto. Vale anche per duplicazioni e agenti; non si possono rimuovere tile implicitamente abbassandolo.
- Le tile vicine **restano ferme**: trascinando sopra una tile occupata, due
  tile **delle stesse dimensioni** si scambiano di posto; gli altri spostamenti
  vengono annullati con un avviso.
- **Compatta** (visibile in modifica) sposta le tile verso l'alto a sinistra
  rimuovendo gli spazi vuoti.
- Su schermi sotto i 690 px la composizione diventa una colonna a due
  voci; trascinamento e ridimensionamento sono disponibili dai 650 px in su,
  altrimenti si usano ispettore e pulsanti.

## La barra in basso

- **Appunta qualcosa**: scrivi subito nella barra; larghezza e altezza crescono gradualmente. ⌘/Ctrl + Invio o la freccia salvano senza aprire altre viste.
- **Todo**: trasforma le righe Markdown `- [ ]` e `- [x]` in attività. Testo introduttivo, immagini e codice rimangono nel contenuto; disattivalo per salvare una nota normale.
- **Graffetta**: aggiunge immagini/GIF alla nota. Sono supportati anche incolla e trascinamento, con gli stessi limiti degli upload (10 MB per file).
- **Anteprima**: mostra il Markdown prima del salvataggio. Un errore, compreso il desktop pieno, conserva la bozza.
- **+**: Aggiungi tile, Modifica, Archivio e Impostazioni. **Aggiungi tile → Crea con agenti AI** apre la richiesta all’agente; non c’è più un campo ricerca/AI nel dock.
- In modifica compaiono **Compatta** e **Fine**.

## Le tile

| Tipo | Contenuto | Dettagli |
| --- | --- | --- |
| Collegamento | Titolo, icona, URL | `https://`, `http://`, `obsidian://`. Apre una nuova scheda (gli URI `obsidian://` usano l'app associata). |
| Immagine | PNG, JPEG, WebP, GIF | File caricati (max 10 MB) o URL HTTPS. Riempi/contieni, didascalia opzionale. |
| Testo | Nota Markdown | Anteprima nel desktop, vista completa con un clic, scorrevole per i testi lunghi. |
| Elenco | Testo + voci spuntabili | Righe `- [ ]` / `- [x]` nell’editor Markdown. Le spunte funzionano anche in anteprima. |
| Orologio | Ora e data | Fuso IANA (`Europe/Rome`, `Asia/Tokyo`); vuoto = ora del dispositivo. |
| Cartella | Fino a 24 mini-tile | Si apre in una vista dedicata; vedi sotto. |

Ogni tile ha titolo, sottotitolo, colori, tipografia e immagine di sfondo
propri (ispettore → Aspetto, preset Minimal / Dot / Industrial / Soft Glass).
Forma, bordi, padding, opacità ed effetto vetro sono invece **globali**
(Impostazioni → Aspetto) e si applicano a tutte le tile.

Vista completa (testo, elenchi): clic sulla tile o **Leggi nota / Apri
lista**; il desktop sfoca dietro, **Esc** chiude. Da lì **Modifica** ed
**Archivia** oppure **Elimina** (con conferma). L’archiviazione è disponibile anche con un pulsante sulla tile. **+ → Archivio** raccoglie note e TODO archiviati, leggibili e ripristinabili senza perdere contenuti. Il ripristino richiede spazio e rispetta il limite del desktop.

## Cartelle

La tile **Cartella** organizza fino a 24 elementi (collegamenti, note,
liste, immagini, orologi) senza occupare griglia extra.

1. **+** → Aggiungi tile → **Cartella** (occupa 2×2, ridimensionabile).
2. Clic sulla cartella (o **Apri cartella**) per entrare: pulsanti
   Link / Nota / Lista / Immagine / Orologio aggiungono un elemento.
3. Ogni elemento si **modifica** (matita) o **rimuove** (cestino); le spunte
   delle liste funzionano dentro la cartella; i link si aprono normalmente.
4. L'anteprima mostra i primi 4 elementi e il conteggio.

Limiti (versione attuale):

- Un solo livello: le cartelle **non si annidano**.
- Gli elementi vivono dentro la cartella: non si spostano con drag & drop
  tra desktop e cartella (ricreali dove servono).
- Gli agenti possono creare cartelle e gestirne gli elementi via
  `config.children` (vedi `GET /api/tile-types`).

## Impostazioni

Il pulsante **Impostazioni** apre una pagina a tutto schermo con sezioni:

- **Aspetto**: angoli, bordo, spazio interno, opacità, vetro, spazio tra
  tile; sfondo (pieghe, tinta unita, gradiente, immagine caricata); nome
  del desktop.
- **Agente AI**: indirizzo, chiave e modello di Hermes + verifica
  connessione. Gestibile anche via `HERMES_URL`, `HERMES_API_KEY`,
  `HERMES_MODEL` (l'ambiente prevale).
- **Agenti e token**: crea/revoca token Bearer per Hermes, MCP e script
  (solo creazione/aggiornamento tile, mai lettura del resto).
- **Sicurezza**: cambio password (minimo 10 caratteri) ed uscita dal
  dispositivo. Le sessioni durano 7 giorni.
- **Dati e backup**: conteggi (tile, cartelle, tile degli agenti,
  revisione), **esportazione JSON**, **importazione** (sostituisce il
  desktop dopo validazione), ripristino del desktop iniziale.
- **Integrazioni**: Obsidian (`obsidian://`, nessuna configurazione),
  MCP/API; Paperless-ngx e Google Calendar sono annunciati come prossimi.
- **Info**: versione, revisione dati, scorciatoie, indice della
  documentazione.

Tutte le modifiche alle impostazioni si salvano automaticamente (attendi
**Tutto salvato**). L'importazione dal **+** della barra non esiste:
l'import è solo in Impostazioni → Dati e backup.

## Scorciatoie

- **E**: entra/esce dalla modifica.
- **Esc**: chiude viste, cartelle, menu e impostazioni; in modifica deseleziona.
- **⌘/Ctrl + Invio**: salva la cattura o la modifica di una nota/TODO.

## Backup e ripristino

- `data/desktop.sqlite`: desktop, impostazioni, password (scrypt), sessioni
  (hash), token (hash). `data/uploads/`: immagini caricate.
- Backup semplice: arresta il server e copia l'intera directory `data/`.
- Export/import JSON, archivio incluso, dalla pagina Dati e backup (le immagini caricate
  restano su disco e vanno copiate a parte).
- I file caricati non vengono eliminati quando rimuovi una tile: nessuna
  raccolta automatica per ora.

## Limiti noti

- Massimo 100 tile nel desktop, 1.000 note/TODO in archivio, 30 voci per elenco, 24 elementi per cartella. Note fino a 10.000 caratteri; ogni attività fino a 300 caratteri.
- Le tile degli agenti non si spostano/eliminano dal browser se create
  dall'utente e viceversa (vedi [agents.md](agents.md)).
- Nessun JavaScript personalizzato nelle tile. Il Markdown di note e TODO ignora HTML incorporato e collegamenti non sicuri.
- Le chiavi Hermes salvate dall'interfaccia stanno in chiaro nel database,
  come il resto della configurazione.

- Le nuove griglie partono da 8 colonne; in Aspetto si scelgono 4, 8 o 12 colonne. I layout precedenti mantengono il numero di colonne salvato. La vista intermedia dispone i tile su quattro colonne; sotto 600 px diventa una lista, senza cambiare le coordinate salvate.
- L’opacità regola il solo colore di sfondo dei tile: testo e pulsanti restano leggibili.
- In modifica, sostare per 650 ms con un tile sopra una cartella la ingrandisce: rilasciando il tile viene inserito nella cartella. Cartelle piene e tipi non supportati non vengono attivati.
- Note e TODO mostrano “Aggiungi testo” o “Aggiungi attività” quando il tile offre spazio sufficiente. Il contenuto viene aggiunto in coda senza aprire la vista completa.
- Lo sfondo circolare conserva il disegno in un canvas di massimo 2048 × 2048 pixel e lo ruota senza ridisegnare i caratteri a ogni frame. L’animazione resta ferma con movimento ridotto e sospende il disegno nelle schede nascoste.
