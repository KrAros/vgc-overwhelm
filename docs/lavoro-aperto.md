<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 KrAros
-->

# Il lavoro aperto

Cosa resta da fare, e **perché non è stato fatto**. Non è una lista di
desideri: ogni voce dice se il riferimento ha una risposta o se serve una
decisione umana, cosa la blocca, e dove andrebbe scritta.

Le sessioni hanno chiuso il divario delle abilità da 46 a 1, e le prime due
voci di questo registro — le quattro mosse a danno fisso e il registro delle
mosse nel divario — le ha chiuse chi l'ha letto. Questo file esiste perché ciò che resta non si perda nella memoria di
una conversazione — ed è **presidiato**: `src/__tests__/lavoroAperto.test.js` controlla che ogni
voce sia ancora vera. Il giorno che una viene fatta, quel test diventa rosso e
la riga qui va tolta nello stesso commit. Un registro che nessuno verifica
diventa una lapide.

## Le tre famiglie, e non sono la stessa cosa

**A. C'è un oracolo.** Il riferimento calcola, noi no. Si trascrive, non si
decide, e il confronto roll per roll dice se è giusto.

**B. Serve un'aggiudicazione.** Il riferimento non calcola affatto: qualunque
cosa scriviamo è un'affermazione nostra sulle regole del gioco. Va decisa da
Simone e registrata in `divergenzeAggiudicate.test.js`, come Rock Head, il
fine turno e Heatproof.

**C. Manca un dato.** Il motore saprebbe farlo; è il dato che non c'è.

---

## A — Dove l'oracolo risponde

### Le venti mosse che restano
`calcEngine.js` esce con `null` per una mossa a `power: 0` che non sia una
delle quattro a peso, delle due a Velocità, delle quattro KO o delle quattro a
danno fisso. Un `null` nella matrice si disegna `~`, cioè come una mossa di
stato.

Delle 303 mosse a potenza zero nei nostri dati, **34** il riferimento le tratta
come offensive — `category` diversa da `Status` nel suo `move_data.js`, non il
nome. Ventotto sono fatte, ne restano **7**, e **portano il badge**:
`gapNoti.json` ha una terza lista e la riga della mossa mostra il segnalino
ambra. Il `~` resta, ma non è più muto.

> Beat Up, Comeuppance, Counter, Fling, Metal Burst, Mirror Coat, Natural Gift

Non sono lo stesso problema, e quelle legate ai punti salute non ci sono più:
sono state fatte tutte.

Le reattive — Counter, Mirror Coat, Metal Burst, Comeuppance — nel riferimento
ci sono, ma calcolano
il colpo che il difensore ha appena tirato (`damage_MASTER.js:1175`,
`defender.moves[move.usedOppMoveIndex]`): non è una trascrizione, è un pezzo di
turno che il nostro modello non ha.

**Le altre tre si trascrivono, e sono di difficoltà molto diversa.**

**Beat Up è la più facile delle tre, non la più difficile.** Questo documento
diceva «il peso degli alleati»: è falso, e l'ho scritto senza aprire il
riferimento. `move_data.js:2796` dice

    'Beat Up': { bp: 14 }, //average fully evolved atk. stat is ~90. 90/10 + 5 = 14.

cioè un numero ASSUNTO, con l'ipotesi scritta accanto — esattamente la famiglia
di Return, Frustration e Trump Card, che sono già fatte. Non conta nessun
alleato. È una riga in `MOSSE_POTENZA_ASSUNTA` e un caso contro l'oracolo.
(Da noi ha anche `colpi: [1,6]`, quindi si incrocia col selettore dei
multi-colpo: quello è l'unico punto da guardare due volte.)

**Natural Gift è una tabella, e la copertura è quasi piena.** 66 bacche in
`item_data.js:655`, ognuna con tipo e potenza. Delle 49 bacche selezionabili da
noi, **48 sono nella tabella**; l'unica fuori è `berry juice`, che nel
riferimento non è una bacca da Natural Gift. Da trascrivere: la tabella, e le
due condizioni al contorno — senza bacca la mossa non fa niente
(`damage_MASTER.js:1152`), e il TIPO della mossa cambia con la bacca (`:749`),
che è la parte che tocca l'efficacia e non solo la potenza.

**Fling è una tabella con tre regole per famiglia dentro.** `item_data.js:631`:
53 strumenti nominati (29 selezionabili da noi), più tre regole che valgono per
famiglia — qualunque `Plate` fa 90, qualunque `Memory` fa 50, e `Eviolite`
compare due volte con due valori diversi (80 e 40: la prima condizione vince, e
va trascritta com'è, non «corretta»). Tutto il resto cade sul default 10.
C'è anche una guardia: certi strumenti non si possono lanciare
(`cantFlingItem`, `:1148`).

L'ordine consigliato è quello: Beat Up, poi Natural Gift, poi Fling.

**Return, Frustration e Trump Card sono uscite senza essere calcolate.** Nel
gioco la loro potenza è variabile — affetto le prime due, PP la terza — e il
riferimento non la calcola: i punti d e i.vii sono commenti senza codice, e
cade sul numero scritto nei suoi dati. Abbiamo preso quel numero e l'ipotesi
che lo regge, scritti insieme in `MOSSE_POTENZA_ASSUNTA`. Sono due ipotesi
opposte: 102 è il massimo di Return, 40 è il minimo di Trump Card.

**Beat Up è nella stessa forma e non è uscita**: il riferimento la calcola con
un colpo solo, i nostri dati ne prevedono da uno a sei, e scegliere quale sia
il numero giusto è un'aggiudicazione, non una trascrizione.

**Punishment è uscita da questo elenco e Nature's Madness ci è entrata**, e il
totale resta venti per caso: Punishment è stata fatta, Nature's Madness invece
c'era sempre stata e non si vedeva — il suo nome nei nostri dati era scritto
«Natures's Madness», quindi l'harness non la trovava e nessun conteggio la
includeva. Due caratteri.

**Gyro Ball ed Electro Ball erano in questo elenco fino a ieri**, e sono uscite
solo dopo la correzione sulla Velocità di Analytic: leggono la stessa
`stats[SP]`, e scritte prima sarebbero nate sbagliate — con l'oracolo che le
confermava, perché rispondeva 96 BP a sette configurazioni diverse.

**E cinque mosse che sembrano di questa famiglia e non lo sono.** Bide,
Magnitude, Present, Spit Up e Psywave nel riferimento sono **commentate** dentro
`move_data.js`, e il punto g di `setDamage` — «Psywave» — è un commento senza
codice sotto. L'harness risponde «mossa non presente in NCP». Per loro non c'è
un oracolo: scriverle sarebbe un'aggiudicazione, non una trascrizione, e vanno
in sezione B il giorno che qualcuno le vuole.

### Il Ventoincoda non arriva al motore del danno
`calculateDamage` riceve un `field` che non distingue i due lati, quindi
l'ordine di turno di Analytic — e domani la potenza di Gyro Ball ed Electro
Ball — lo calcola con `tailwind: false`. L'harness fa la stessa cosa da tutte
e due le parti, quindi **non è una divergenza nascosta**: è una casella che
nessuno dei due accende, e finché è così nessun caso può contraddirla.

È la stessa forma dell'assunzione dietro Eruption: verde per costruzione. Il
giorno che il Ventoincoda entra nel campo del danno, `calcEffectiveSpe` lo
sa già fare.

### I 34 strumenti col badge — la misura è stata fatta

Erano trentanove e nessuno ci aveva guardato. Adesso la misura c'è, e il numero
non era quello che sembrava.

**Ventotto dei trentanove sono legati a specie che Champions non ha.** Le
diciassette memorie vogliono Silvally, i quattro drive vogliono Genesect, e gli
altri sette sono di Marowak, Latios/Latias, Clamperl, Dialga, Palkia e Giratina.
Nessuna di quelle specie è in M-B: **ventotto segnalini su strumenti che
nessuno può tenere.**

Non sono rumore da togliere. **Scelta di Simone: restano.** Champions potrebbe
aggiungere quelle specie, e il giorno che succede il segnalino è già al posto
giusto — meglio un avviso che nessuno incontra di un silenzio che qualcuno
incontra.

**I quattro gruppi, misurati:**

1. **badge sbagliato** — 3: `flying gem`, `iron ball`, `macho brace`. Il motore
   li nomina già, per un'altra cosa. Sono classificati `meccanica-diversa` in
   `classificazione-badge.mjs` con scritto il perché. `inventario:gen` conferma
   che sono gli unici tre: non ce ne sono altri nascosti.
2. **moltiplicatore semplice** — 5: i cinque incensi. **Fatti.** Erano la stessa
   identica meccanica delle diciotto righe `typBoost` già in `ITEM_EFFECTS`:
   `getItemBoostType` li mette nello stesso `switch` di Carbonella, e il ramo
   che li usa è `//k. 1.2x Items`, `0x1333`, cioè `MOD.X1_2`. Mancavano e basta.
3. **meccanica che non modelliamo** — 22: le memorie e i drive cambiano il tipo
   del Pokémon o della mossa; gli orbi sono un doppio `typBoost`; `air balloon`
   tocca il contatto col terreno. Famiglia B o C a seconda del caso.
4. **raddoppio di statistica su una specie sola** — 4: `light ball` (Pikachu),
   `thick club` (Marowak), `deepseatooth`/`deepseascale` (Clamperl),
   `soul dew` (Latios/Latias), `metal powder` (Ditto). Meccanica semplice,
   `calcAtMods` e `calcDefMods`; **`light ball` e `metal powder` sono gli unici
   due vivi**, perché Pikachu e Ditto sono in M-B.

**Quindi cosa resta di davvero giocabile oggi:** `light ball`, `metal powder`,
`air balloon`, più i tre già classificati. Sei voci, non trentaquattro.

**Come rifare la misura**, se il roster cambia:

    npm run gap:gen          rigenera il registro
    npm run gap:funzioni     lo raggruppa per la funzione di NCP che lo gestisce
    npm run inventario:gen   dice quali il MOTORE già nomina — gruppo 1

Per ognuno la domanda è una sola e si legge nel riferimento, non si deduce dal
nome: **dove tocca il danno `item_data.js`, e in quale punto della catena?**
`calcBPMods`, `calcAttack`, `calcDefense` e i modificatori finali sono posti
diversi, e sbagliare punto dà numeri che divergono di un arrotondamento.

### Diciassette chiavi di traduzione che non rende nessuno
Su 216 chiavi d'interfaccia in `it.json` — esclusi i cataloghi di dati, che sono
un'altra cosa — **17 non compaiono in nessun sorgente**:

    ui       cumulative_hint, custom_set_saved, custom_set_delete,
             custom_set_badge, custom_set_load
    report   damage_breakdown, scroll_rolls, quick_info_desc,
             scroll_to_rolls, attacks_short, attacked_by_short
    editor   save_custom_set
    eot      ko_arrow, sitrus_activates, eot_delta, sitrus_recovery_cap,
             pkmn_takes

Trovate rinominando «Set personalizzati» in «Set personali»: tre delle cinque
stringhe di quella famiglia non le legge nessuno, e cercando le altre sono
saltate fuori tutte.

`traduzioni.test.js` presidia già la PARITÀ fra le due lingue e che l'italiano
non resti in inglese. Che una chiave sia ancora USATA non lo guarda nessuno, ed
è la ragione per cui queste sono rimaste.

**La domanda non è come tradurle meglio, è se servono.** Alcune sembrano avanzi
di funzioni tolte (`scroll_to_rolls`, `quick_info_desc`); altre potrebbero
essere pezzi mai finiti. Sono da leggere una per una — e il lavoro vero è il
presidio che impedisce alle prossime di accumularsi.

---

## B — Dove serve una decisione

### Merciless
«Infligge sempre colpi critici ai bersagli avvelenati o gravemente
avvelenati». L'avvelenamento del difensore **adesso esiste nel modello**, e
l'abilità potrebbe accendere da sola la levetta del critico.

Il riferimento non la nomina affatto — zero occorrenze in `damage_MASTER.js` e
in `damage_SV.js`, misurato — quindi è un'aggiudicazione, non una
trascrizione. Oggi ha il verdetto `interruttore-critico` in
`descrizioniSilenziose.test.js`, con la nota che dice questo.

### Le immunità di stato nel menù
Immunity, Limber, Purifying Salt, Water Bubble, Insomnia, Leaf Guard, Vital
Spirit, Sweet Veil, Flower Veil. Oggi il menù dello stato lascia scegliere
«avvelenato» su un Gliscor con Immunity.

È **coerente con la scelta già presa** — lo stato è un'asserzione di chi usa
l'app, la stessa ragione per cui si può scrivere «bruciato» su un Pokémon di
tipo Fuoco — ma è una scelta, e se domani il menù deve restringersi è una
decisione di Simone, non una correzione.

### Parental Bond sulle mosse a danno fisso
Il riferimento raddoppia il numero — Seismic Toss diventa `[100]`, Sonic Boom
`[40]` — e lo fa senza nessuno dei controlli su colpi multipli e mosse ad area
che applica altrove: in `setDamage` la condizione è il solo
`attacker.ability === "Parental Bond"` (`damage_MASTER.js:1172`).

La wiki dice che nel gioco su queste mosse l'abilità non fa niente, ed è la
stessa fonte — già corretta da Simone su tre punti — da cui viene
`MOSSE_SENZA_PARENTAL_BOND`. Quella nota dice che le mosse a danno fisso non
compaiono nella lista «perché da noi hanno potenza 0: al calcolo del danno non
arrivano». Adesso ci arrivano, quindi la frase non regge più e la scelta è
davanti.

Oggi si segue l'oracolo, che è la regola del progetto quando l'oracolo c'è. La
levetta è già in piedi: quattro nomi in `MOSSE_SENZA_PARENTAL_BOND` e il motore
smette di raddoppiare, senza toccare una riga di `calcEngine.js`.

### La seconda metà di Sturdy
Nel gioco fa anche sopravvivere con un punto salute a un colpo che ucciderebbe
da vita piena. Nel riferimento non c'è, perché non è la catena del danno di un
colpo: è cosa succede **dopo** che il danno è stato calcolato. Da noi nemmeno.

---

## C — Dove manca un dato

### Rivalry
L'ultima abilità nel divario, e **non è lavoro di motore**: ×1,25 fra Pokémon
dello stesso sesso, ×0,75 fra sessi opposti. Il campo `gender` in
`pokemon.json` è nullo per **986 specie su 1225**.

Finché quel dato manca, l'abilità non ha su cosa accendersi. Serve prima un
audit della fonte, non una riga nel motore.

---

## E una cosa che non è una voce, ma una forma

**Le mezze abilità.** Una descrizione che promette due cose e ne vede
applicata una sola non la vede nessun registro automatico: il divario elenca
ciò che il riferimento calcola, e `descrizioniSilenziose` scarta un'abilità
appena ha **un** campo meccanico.

Ne sono state trovate due, e tutt'e due rileggendo a mano la descrizione
accanto a quello che il motore fa: **Magic Guard** (la sabbia sì, il
contraccolpo no) e **Heatproof** (le mosse Fuoco sì, la bruciatura no).

`campiMorti.test.js` chiude **un** modo in cui possono nascondersi — un campo
dichiarato che nessuno legge — non tutti. L'altro modo resta la lettura umana,
e vale la pena rifarla ogni volta che il modello si allarga: aggiungere il
menù dello stato ha reso osservabili sette abilità che prima non potevano
sbagliare.
