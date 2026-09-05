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

### Le ventidue mosse che restano
`calcEngine.js` esce con `null` per una mossa a `power: 0` che non sia una
delle quattro a peso, una delle quattro KO o una delle quattro a danno fisso.
Un `null` nella matrice si disegna `~`, cioè come una mossa di stato.

Delle 303 mosse a potenza zero nei nostri dati, **34** il riferimento le tratta
come offensive — `category` diversa da `Status` nel suo `move_data.js`, non il
nome. Dodici sono fatte, ne restano **22**, e da questa sessione **portano il
badge**: `gapNoti.json` ha una terza lista e la riga della mossa mostra il
segnalino ambra. Il `~` resta, ma non è più muto.

> Beat Up, Comeuppance, Counter, Crush Grip, Electro Ball, Endeavor,
> Final Gambit, Flail, Fling, Frustration, Gyro Ball, Hard Press, Metal Burst,
> Mirror Coat, Natural Gift, Punishment, Return, Reversal, Ruination,
> Super Fang, Trump Card, Wring Out

Non sono lo stesso problema. Quelle legate ai punti salute — Flail, Reversal,
Endeavor, Super Fang, Crush Grip, Wring Out, Hard Press, Ruination, Final
Gambit — chiedono prima di decidere **se i punti salute entrano nel modello**,
che oggi non ci sono: è la voce di sezione B qui sotto. Le reattive — Counter,
Mirror Coat, Metal Burst, Comeuppance — nel riferimento ci sono, ma calcolano
il colpo che il difensore ha appena tirato (`damage_MASTER.js:1175`,
`defender.moves[move.usedOppMoveIndex]`): non è una trascrizione, è un pezzo di
turno che il nostro modello non ha. Restano quelle che si trascrivono e basta:
la Velocità (Gyro Ball, Electro Ball), l'affetto (Return, Frustration), il peso
degli alleati (Beat Up), lo strumento (Fling, Natural Gift), gli stadi del
bersaglio (Punishment), i PP (Trump Card).

**E cinque mosse che sembrano di questa famiglia e non lo sono.** Bide,
Magnitude, Present, Spit Up e Psywave nel riferimento sono **commentate** dentro
`move_data.js`, e il punto g di `setDamage` — «Psywave» — è un commento senza
codice sotto. L'harness risponde «mossa non presente in NCP». Per loro non c'è
un oracolo: scriverle sarebbe un'aggiudicazione, non una trascrizione, e vanno
in sezione B il giorno che qualcuno le vuole.

### I 39 strumenti col badge
Il numero non è mai sceso mentre le abilità andavano da 46 a 1. Nessuno ci ha
ancora guardato.

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

### I punti salute nel modello
Oggi non esistono: l'app assume la vita piena ovunque. È l'assunzione dietro
Eruption e Water Spout (che il riferimento scala sui PS e noi no), dietro il
`defender.curHP` delle mosse KO, e dietro tutte le mosse della famiglia
Flail/Reversal/Endeavor.

Non è un difetto visibile — a vita piena i numeri coincidono e l'oracolo è
verde — ma è la decisione che sblocca la fetta più grossa del lavoro aperto.

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
