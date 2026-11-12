# Obsidian: configurazione, sincronizzazione e sicurezza

L’integrazione è implementata e opzionale. EDON lavora direttamente sui file Markdown del vault configurato sul **server**, non sul disco del browser.

## Configurazione

In **Impostazioni → Integrazioni → Obsidian Vault** imposta:

- **Percorso del Vault**: directory esistente e accessibile; vuoto disattiva l’integrazione.
- **Cartella predefinita**: sottocartella per le nuove note EDON; vuoto usa la radice.
- **Cestino / Archivio**: default `.trash`; le note eliminate vi vengono spostate conservando la struttura relativa ed evitando collisioni di nomi.

Le variabili `OBSIDIAN_VAULT_PATH`, `OBSIDIAN_FOLDER` e `OBSIDIAN_ARCHIVE_FOLDER` hanno precedenza sui rispettivi valori salvati dall’interfaccia. Il percorso è quello visto dal processo EDON: in Docker usa `/vault`, non il percorso del computer host.

## Uso quotidiano

**+ → Esplora Vault** cerca note `.md`, filtra cartelle, crea/modifica note e fissa contenuti sul desktop. Le note collegate conservano `config.vaultPath`. Una tile cartella può puntare a una directory o a `*` per l’intero vault.

Note e TODO creati o modificati in EDON vengono scritti come Markdown; frontmatter esistente e titolo vengono conservati quando possibile. Le righe checklist diventano attività nei TODO. La lettura aggiorna le tile collegate dai file presenti su disco. Directory nascoste e contenuto della cartella cestino sono esclusi dall’esplorazione.

Non è un sistema generale di risoluzione conflitti o una replica completa di Obsidian: valgono i limiti del modello EDON (10.000 caratteri per nota e 30 attività per TODO). Evita modifiche simultanee allo stesso file da più programmi.

## Archivio, eliminazione e backup

Il comportamento cambia quando il vault è attivo:

| Azione                            | Senza vault                                          | Con vault attivo                                         |
| --------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| **Archivia** nota/TODO            | Conserva la tile in **+ → Archivio**, ripristinabile | Rimuove il pin dal desktop e conserva il `.md` nel vault |
| **Elimina** nota collegata        | Rimuove la tile                                      | Sposta il `.md` nel cestino configurato                  |
| **Elimina** dal browser del vault | Non applicabile                                      | Sposta il file nel cestino e rimuove i relativi pin      |

Il menu Archivio locale è nascosto con il vault attivo. Il ripristino del desktop iniziale, l’importazione e l’eliminazione di più tile possono modificare molti file: controlla la conferma e usa un backup.

Il backup di `data/` **non include il vault**. Arresta EDON e copia separatamente sia `data/` sia il vault; conserva anche una copia esterna precedente alla prima sincronizzazione.

## Docker e permessi

Il Compose base non monta alcun vault. Per usare l’override opzionale:

```sh
cp .env.example .env
# In .env imposta OBSIDIAN_VAULT_HOST_PATH=/percorso/assoluto/del/vault

docker compose -f docker-compose.yml -f docs/docker-compose.obsidian.yml up --build -d
```

L’override richiede esplicitamente una variabile non vuota: non crea mount accidentalmente dalla radice o da una directory non valida. Monta il vault in lettura/scrittura su `/vault` e imposta automaticamente `OBSIDIAN_VAULT_PATH=/vault`.

EDON nel container usa l’utente non privilegiato `node` (normalmente UID/GID 1000). Concedi a quell’utente soltanto i permessi necessari sul vault: lettura e attraversamento delle directory, scrittura dei Markdown e creazione/ridenominazione/spostamento di file e directory. Un mount di sola lettura permette al massimo esplorazione/lettura, ma non sincronizzazione, nuove note o cestino. Non cambiare i permessi dell’intera home e non montare una directory più ampia del vault.

## Token e agenti

Una sessione autenticata può configurare il vault e scrivere/eliminare note. I token Bearer possono leggere il vault tramite `GET /api/vault/notes`, `GET /api/vault/note`, `list_vault_notes` e `read_vault_note`; non possono cambiare le impostazioni né usare gli endpoint diretti di scrittura/eliminazione. MCP non espone strumenti di scrittura del vault.

Usa HTTPS o VPN per agenti remoti e considera sensibili sia i contenuti del vault sia i token. Per i permessi sulle tile vedi [agents.md](agents.md).
