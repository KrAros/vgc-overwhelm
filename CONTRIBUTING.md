# Contribuire a The Sixth Ember

Grazie. Questo file dice come, e soprattutto **come si verifica** ciò che si
propone — che qui è la parte che conta.

La lingua del progetto è l'italiano: commenti, messaggi di commit e discussioni.
Le PR in inglese si accettano lo stesso, nessuno viene rimandato indietro per
questo.

Contribuendo accetti che il tuo lavoro sia distribuito sotto
**AGPL-3.0-or-later**, come il resto del progetto.

---

## Da dove iniziare

Tre lavori utili che non richiedono di toccare il motore:

**Preset del meta.** Stanno in [`src/data/metaPresets.js`](src/data/metaPresets.js)
— oggi sono 20. Un preset è un oggetto con `slug`, `label`, `nature`, `item`,
`ability`, `sps` (sei numeri, non EV) e `moves`. Se ne aggiungi uno, **scrivi
nella PR da dove viene il set**: il file dichiara la propria fonte in testa, e
quella riga deve restare vera.

**Traduzioni.** [`src/locales/en.json`](src/locales/en.json) e
[`it.json`](src/locales/it.json), 1879 chiavi foglia ciascuno — oggi allineati.
Se aggiungi una chiave a uno, aggiungila a entrambi.

**Le abilità col badge.** 114 abilità e 41 strumenti che il riferimento calcola
e noi no; l'elenco generato è in
[`src/data/gapNoti.json`](src/data/gapNoti.json). Ognuna è una PR piccola e
isolata: implementi l'effetto, e il caso golden corrispondente diventa verde.
È il contributo più prezioso, ed è quello con le regole più severe qui sotto.

---

## Prima di aprire una PR

```bash
npm run test:run        # deve essere verde
npm run lint            # deve essere pulito
npm run snapshot:diff   # deve dire ZERO divergenze
npm run build           # deve completare
```

`snapshot:diff` a zero **non è una formalità**. Se si muove, il tuo cambiamento
ha spostato numeri del motore: può essere giusto, ma allora ogni caso mosso va
spiegato nella PR, uno per uno. Un caso mosso che non si sa attribuire è un
errore, non un progresso.

---

## Le regole di verifica

Nascono da dodici sessioni di risanamento e da una lista di errori realmente
commessi. Quasi ogni regola qui sotto è il fossile di una svista costata una
sessione: non sono principi astratti, sono cicatrici.

**Criteri misurati, mai dedotti.** Se scrivi un numero in una PR — «questo copre
64 abilità», «il bundle cala di 30 kB» — dev'essere stato **letto** da
un'esecuzione, non calcolato a mente. È l'errore più frequente nella storia di
questo repo.

**Criteri falsificabili.** Prima di dire «questo lo verifica il test X»,
controlla che esista almeno un caso capace di farlo **fallire**. È già successo
di aggiungere un criterio che nessuno dei 549 casi esistenti poteva violare.

**Un cambiamento per volta.** Applica, gira i test, guarda il diff, attribuisci.
Due correzioni di segno opposto applicate insieme non si sanno attribuire.

**Attenzione alla cecità osservativa.** Un caso può attivare la condizione
giusta e restare muto. Fur Coat ×2 con Eviolite ×1,5 fa esattamente ×3; un punto
di Difesa può morire in una divisione. Se il controllo negativo del tuo caso
produce gli stessi numeri, il caso non prova niente.

**Min e max che coincidono non sono una prova.** Gli estremi possono combaciare
mentre i roll intermedi divergono — e sono i roll intermedi ad alimentare la
probabilità di KO.

**Il riferimento si trascrive, non si deduce.** `vendor/ncp/` è una specifica
leggibile, non solo un oracolo: metà delle correzioni della formula è nata
leggendo `calcBPMods` / `calcAtMods` / `calcDefMods` / `calcFinalMods` riga per
riga. Unica eccezione nota: Unburden, che il riferimento implementa nel modo
ingenuo (`pokemon.item === ""`) — lì l'oracolo **non** va copiato.

---

## Le fixture non si rigenerano per far tornare verde

```bash
npm run snapshot:gen    # riscrive la caratterizzazione della formula
npm run matrice:gen     # riscrive la caratterizzazione della matrice
npm run ncp:gen         # riscrive i golden dal riferimento
npm run gap:gen         # riscrive l'elenco dei badge
```

Questi comandi **sovrascrivono la rete di sicurezza**. Si lanciano di proposito,
guardando il diff caso per caso, mai per zittire un test rosso. Le versioni
`*:report` (`ncp:report`, `matrice:report`, `gap:report`) non scrivono niente e
sono quelle da usare per guardare.

> **Nota su `ncp:gen`, agosto 2026.** Oggi non è idempotente: rigenerato sullo
> snapshot attuale produce 11 casi marcati `divergente` che non sono bug del
> motore, ma casi di preparazione (Intimidate, Booster Energy, Download)
> confrontati all'ingresso basso, che per costruzione non applica lo stato di
> partenza. La fixture committata — 509 concordi, zero divergenti — è quella
> giusta. Non rigenerarla senza aver capito questo punto.

**I due oracoli entrano da punti diversi**, e la differenza è sostanziale:

| fixture | ingresso NCP | applica lo stato di partenza |
|---|---|---|
| `ncp-golden.json` (509) | `GET_DAMAGE_SV` | no |
| `ncp-preparazione.json` (27) | `CALCULATE_ALL_MOVES_SV` | sì |

Un caso con Intimidate confrontato col primo diverge **per costruzione**. Non è
un bug: è l'ingresso sbagliato.

---

## Cosa NON correggere

Sembrano difetti e sono decisioni. Le più segnalate:

- `buildSmogonString` mostra gli **SP**, non gli EV calcolati
- i nomi delle mosse in export sono **sempre in inglese**
- il livello è **50** fisso — è il formato
- gli schermi valgono **2732/4096**: è il valore dei doppi, non un errore
- `zorua-hisui` **non** è allineato al riferimento, che ha un errore di
  trascrizione documentato in tre punti
- `vendor/ncp/` è copiato byte per byte e **non va modificato**, nemmeno per
  aggiungere un'intestazione di licenza

---

## Commit e branch

Un branch per tema, dal ramo di sviluppo. I comandi vanno dati **separati, mai
concatenati con `&&`**: se il secondo fallisce, con `&&` si resta in silenzio
sul branch sbagliato.

```
git checkout modern
git pull origin modern
git checkout -b fix/nome-del-tema
```

Messaggi di commit in italiano, all'infinito o al presente, che dicano **cosa
cambia nel comportamento** e non quali file sono stati toccati.

---

## Segnalare un bug di calcolo

La segnalazione utile contiene la configurazione completa — attaccante con
natura, SP, oggetto e abilità; difensore; mossa; campo, meteo, schermi — più il
numero che ti aspettavi e da dove viene. Se il numero atteso arriva da un altro
calcolatore, dillo: sapere **quale** cambia la diagnosi.
