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
[`it.json`](src/locales/it.json), 1972 chiavi foglia ciascuno — oggi allineati.
Se aggiungi una chiave a uno, aggiungila a entrambi.

**Cosa resta aperto, tutto in un posto.**
[`docs/lavoro-aperto.md`](docs/lavoro-aperto.md) elenca il lavoro che resta —
diviso fra ciò che ha un oracolo, ciò che aspetta una decisione e ciò che
aspetta un dato — e dice per ognuno **perché** non è stato fatto. È presidiato
da `lavoroAperto.test.js`: una voce che viene fatta rende rosso quel file, così
il registro non diventa una lapide. Le due sezioni qui sotto sono i due punti
di ingresso più battuti.

**Le abilità col badge.** 1 abilità — `rivalry`, che aspetta un dato sul sesso
che oggi manca a 986 specie su 1225 — e 39 strumenti che il riferimento calcola
e noi no; l'elenco generato è in
[`src/data/gapNoti.json`](src/data/gapNoti.json). Ognuna è una PR piccola e
isolata: implementi l'effetto, e il caso golden corrispondente diventa verde.
È il contributo più prezioso, ed è quello con le regole più severe qui sotto.

**Le mosse SENZA il badge — un lavoro aperto, cominciato.**
`gapNoti.json` ha due liste, `abilita` e `strumenti`. Non ha le mosse, e le
mosse un divario ce l'hanno.

`calcEngine.js` esce con `null` per qualunque mossa con `power: 0` che non sia
una delle quattro a peso, una delle quattro KO o una delle quattro a danno
fisso. Nella matrice un `null` si disegna come `~`, cioè esattamente come una
mossa di stato: prima della sessione delle mosse a danno fisso **Seismic Toss
sembrava Protect**.

Delle 303 mosse a potenza zero nei nostri dati, **34** il riferimento le tratta
come offensive. La misura si fa sui SUOI dati e non sul nome — `category`
diversa da `Status` in `vendor/ncp/move_data.js` — ed è rifatta a ogni giro da
`lavoroAperto.test.js` invece di essere copiata: l'elenco scritto a mano che
stava qui prima era sbagliato in due direzioni insieme, ci teneva cinque mosse
che il riferimento non ha e ne perdeva una che ha.

Dodici sono fatte:

- le quattro a **peso** — Low Kick, Grass Knot, Heavy Slam, Heat Crash;
- le quattro **KO** — Fissure, Guillotine, Horn Drill, Sheer Cold, col flag
  `koSecco` e il punto f del riferimento;
- le quattro a **danno fisso** — Sonic Boom, Dragon Rage, Seismic Toss,
  Night Shade, i punti d ed e (`damage_MASTER.js:1256-1275`).

E ne restano **22**:

> Beat Up, Comeuppance, Counter, Crush Grip, Electro Ball, Endeavor,
> Final Gambit, Flail, Fling, Frustration, Gyro Ball, Hard Press, Metal Burst,
> Mirror Coat, Natural Gift, Punishment, Return, Reversal, Ruination,
> Super Fang, Trump Card, Wring Out

Non sono tutte lo stesso problema: ci sono quelle legate ai punti salute
(Flail, Reversal, Endeavor, Super Fang, Crush Grip, Wring Out, Hard Press,
Ruination, Final Gambit), quelle legate alla Velocità (Gyro Ball, Electro
Ball), quelle legate all'affetto (Return, Frustration), quelle legate allo
strumento (Fling, Natural Gift) e le reattive (Counter, Mirror Coat, Metal
Burst, Comeuppance) — che nel riferimento ci sono ma calcolano il colpo appena
subito dal difensore, cioè un pezzo di turno che non modelliamo.

**Cinque mosse che sembrano di questa lista non ci sono, e non è una svista.**
Bide, Magnitude, Present, Spit Up e Psywave nel riferimento sono **commentate**
dentro `move_data.js`; il punto g di `setDamage` si chiama «Psywave» ed è un
commento senza codice sotto. L'harness risponde «mossa non presente in NCP».
Per loro non c'è un oracolo, quindi non sono lavoro di trascrizione.

C'è poi un caso diverso e più insidioso, perché oggi non si vede: **Eruption e
Water Spout**. Nei nostri dati hanno `power: 150` e il motore la usa cosi'
com'e', mentre il riferimento la scala sui punti salute
(`damage_MASTER.js:1354`). A punti salute pieni i due numeri coincidono, quindi
il confronto con l'oracolo e' verde e resta verde: non e' un errore visibile,
e' un'assunzione — «il Pokemon e' integro» — che nessun caso puo' oggi
contraddire, perche' i punti salute non stanno nel nostro modello.

Chi apre questo lavoro cominci da li': prima decidere se i punti salute entrano
nel modello, poi il registro delle mosse nel divario (`gapNoti.json` con una
terza lista e un badge, come per abilita' e strumenti), poi le implementazioni.

---

## Prima di aprire una PR

```bash
npm run test:run        # deve essere verde
npm run lint            # deve essere pulito
npm run snapshot:diff   # deve dire ZERO divergenze
npm run build           # deve completare
npm run bundle:check    # deve stare sotto i 210 kB gzip
```

`bundle:check` va **dopo** `build`: è l'unico controllo che pesa `dist/`
invece di leggere `src/`, e prima del build non c'è niente da pesare. Se
sfora, la soglia non si alza per far tornare verde — alzarla è una decisione,
e va scritta come tale.

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
