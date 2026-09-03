<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 KrAros
-->

# Il lavoro aperto

Cosa resta da fare, e **perché non è stato fatto**. Non è una lista di
desideri: ogni voce dice se il riferimento ha una risposta o se serve una
decisione umana, cosa la blocca, e dove andrebbe scritta.

Le sessioni hanno chiuso il divario delle abilità da 46 a 1. Questo file
esiste perché ciò che resta non si perda nella memoria di una conversazione —
ed è **presidiato**: `src/__tests__/lavoroAperto.test.js` controlla che ogni
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

### Le quattro mosse a danno fisso
`seismic toss`, `night shade`, `dragon rage`, `sonic boom` — e `psywave`, che
è la stessa famiglia con una variazione.

Stanno nello **stesso blocco** del riferimento
(`damage_MASTER.js:1240-1283`) delle quattro mosse KO già fatte: Seismic Toss
e Night Shade tornano il livello, Dragon Rage 40, Sonic Boom 20. Oggi hanno
`power: 0` e il motore esce con `null`, cioè `~` nella matrice — **Seismic
Toss sembra Protect**.

È il punto da cui ripartire, per una ragione precisa: fino alla sessione del
fine turno l'harness confondeva un danno fisso con un colpo nullo, e a
chiedergli «Seismic Toss» rispondeva «zero». Adesso distingue `[0]` da `[50]`,
quindi l'oracolo è interrogabile. Il pezzo difficile è già fatto.

### Le altre 26 mosse senza badge
L'elenco sta in `CONTRIBUTING.md`. Non sono tutte lo stesso problema: quelle
legate ai punti salute (Flail, Reversal, Endeavor, Super Fang…) chiedono prima
di decidere **se i punti salute entrano nel modello**, che oggi non ci sono.

### Il registro delle mosse nel divario
`gapNoti.json` ha due liste, `abilita` e `strumenti`. Non ha le mosse, e le
mosse un divario ce l'hanno. Finché non c'è, nessun badge avvisa l'utente che
di quel `~` non deve fidarsi.

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
