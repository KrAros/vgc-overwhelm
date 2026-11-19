# Roadmap — la coda di The Sixth Ember

Questo file è **l'unica coda**: dice *cosa si fa dopo*. Non racconta e non spiega.
Il racconto sessione per sessione e il dettaglio di ogni voce aperta stanno in
`docs/piano-risanamento.md` (archivio e sezione «Aperto — tutto post-lancio»):
qui ogni voce è **un titolo e un rimando**, mai una copia del testo. Due copie
della stessa lista invecchiano in modo diverso, e nessun test le rilegge.

Una sessione = un compito = un branch. Si apre con `/apri-sessione`, si chiude
con `/chiudi-sessione`. Il fulcro (`/fulcro`) è la chat opzionale che sceglie il
prossimo lotto senza lavorare.

Ultimo aggiornamento: 19/11/2026, alla chiusura di KK (file creato lo stesso giorno, struttura nuova,
contenuto ricavato da `CLAUDE.md` «Dove siamo» e dal piano; **ultima sessione chiusa: KK, 19/11/2026**).

## Prossima sessione

**I quattro flussi rimasti di L** (piano, sezione L e «KK»): lampo di inglese
all'avvio, font Inter, telefono, passo «cancella il set». Sigla nuova (LL?):
KK è già stata usata, e `.claude/mockup-KK/` esiste. Prima va contato quanti hanno già un test (provvisorio: uno
parziale, tre nessuno) e sommata a mano la lista (17 voci contro 18).

**Prima, se Simone li ha pronti:** strumenti e moveset di M-C (Megapietre, semi
dei campi, Elmo Roccioso, Palloncino, mosse di Archaludon e Politoed). Le cinque
Mega di KK non hanno ancora una Megapietra che le attivi.

## Decisioni aperte di Simone
Non sono lavoro per Claude: sono scelte che sbloccano lavoro. Una decisione si
scrive come domanda (cosa cambia se scegli in un modo o nell'altro).
- **Icone Nintendo**: unico elemento che può fermare il lancio; da risolvere prima di registrare `sixthember.gg` (`SCORCIO = false` in `gen-og-image.mjs` produce l'anteprima senza). Dettaglio: CLAUDE.md «Dove siamo».
- **Metrica gzip** da fissare per il criterio di E (Vite o `gzip -c`: differiscono di ~5 kB).
- **GitHub**: descrizione, homepage e topics del repository.

## Candidate (dal piano, sezione «Aperto — tutto post-lancio»)
Un rimando per voce; il dettaglio sta nel piano.
- `forme:gen` non idempotente (KK): `slowbro-mega` f01→f02, otto fonti cambiate, due note cancellate; la deriva non è indagata
- Aura Guard senza badge (KK): il riferimento non la conosce; decidere se mostrare un avviso
- Statistiche delle cinque Mega di M-C da ricontrollare contro il gioco (KK): fonte unica, pokemondb
- Flussi utente a mano (nella tabella «Prima del lancio pubblico» era «la prima cosa in lista»)
- Chat 7: PWA (dalla stessa tabella)
- Tre test sensibili al carico della macchina (S): misurare quanto oscillano prima di scegliere una soglia
- `ncp:gen` non idempotente (K): 11 casi `B12-*`; la strada va contata prima
- Intestazione SPDX di `scripts/ncp/prelude.js` (K)
- Stadi della preparazione che non arrivano alla Velocità mostrata (F-3): oggi zero casi di caratterizzazione sul percorso
- Long Reach per nome nel motore (doppia fonte): zero casi di copertura
- `utility umbrella` e venti `ITEM_EFFECTS` non selezionabili (Punching Glove è da meta)
- `getFinalSpeed`: paralisi, Quick Feet, Slow Start; Unburden NON va trascritto da NCP
- Chunk `dati` da 390 kB (`pokemon.json` a caricamento differito); `latin-ext`; navigazione da tastiera nelle tendine
- Campo `target` in `moves.json` (§1.11), pesi (40 divergenze), 19 specie non mappabili su NCP
- Clone vecchio `~/vgc-overwhelm` fermo su `main` (da sistemare)

## Idee (backlog)
Una riga con data per ogni idea che Simone propone durante una sessione. Si
scrive qui e si riprende il compito in corso, **senza implementarla**; se
Simone dice di farla subito, prima il piano.
- 2026-11-19 — sessione di analisi dell'aspetto grafico del sito (solo analisi: l'esito è un elenco di difetti e una direzione, più eventuali mockup per vedere cosa migliorare; nessun codice dell'app). Sigla prevista KK, dopo i flussi utente (JJ).

## Fatte
La cronaca vera è `docs/piano-risanamento.md` (archivio, una sezione `### <sigla>`
per sessione). Qui non si duplica: serve solo l'ultima, per orientarsi.
- Ultima chiusa: **KK**, 19/11/2026 — il registro arriva a M-C e cinque Mega entrano in anagrafica.
