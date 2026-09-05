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
nome. Ventitré sono fatte, ne restano **12**, e **portano il badge**:
`gapNoti.json` ha una terza lista e la riga della mossa mostra il segnalino
ambra. Il `~` resta, ma non è più muto.

> Beat Up, Comeuppance, Counter, Crush Grip, Flail, Fling, Hard Press,
> Metal Burst, Mirror Coat, Natural Gift, Reversal, Wring Out

Non sono lo stesso problema. Quelle legate ai punti salute — Flail, Reversal,
Crush Grip, Wring Out, Hard Press — adesso il motore i punti salute ce li ha, e
sono **la prossima cosa da fare**: leggono la POTENZA dai punti salute (punto c
di `basePowerFunc`), mentre le cinque appena fatte ne leggevano il danno.

Le reattive — Counter, Mirror Coat, Metal Burst, Comeuppance — nel riferimento
ci sono, ma calcolano
il colpo che il difensore ha appena tirato (`damage_MASTER.js:1175`,
`defender.moves[move.usedOppMoveIndex]`): non è una trascrizione, è un pezzo di
turno che il nostro modello non ha. Restano quelle che si trascrivono e basta: lo
strumento (Fling, Natural Gift) e il peso degli alleati (Beat Up).

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

### I punti salute nel modello — il motore ce li ha, l'interfaccia no
Il motore adesso accetta `atkPS` e `defPS`, e le otto abilità che leggono i
punti salute passano da lì: le due vecchie levette ci si traducono dentro con
la stessa funzione che usa l'harness. Lo stato contraddittorio — «a vita piena»
e «sotto un terzo» insieme — non è più scrivibile.

**Quello che manca è tutto il resto**, ed è nell'ordine deciso con Simone:
le undici mosse che li leggono, il verdetto di KO dal residuo, e il controllo
nell'interfaccia. Finché l'interfaccia non li manda, arrivano `null` e nessun
numero cambia — lo snapshot lo dimostra su 601 casi.

### I punti salute nell'interfaccia
Il motore li ha, l'app non li manda: assume la vita piena ovunque. È
l'assunzione dietro Eruption e Water Spout, dietro il `defender.curHP` delle
mosse KO, e dietro tutte le mosse della famiglia Flail/Reversal/Endeavor.

Le decisioni sono prese, e sono di Simone:

- la **percentuale del danno resta sul massimo**, e il verdetto di KO guarda il
  residuo. È la convenzione di Showdown, e la ragione è la matrice: il danno è
  una proprietà del colpo, il KO della situazione — fonderli in un numero solo
  toglierebbe la possibilità di confrontare le celle fra loro, che è la cosa
  per cui l'app esiste;
- il controllo **mostra tutt'e due le letture** — punti e percentuale — e
  accetta l'una o l'altra in ingresso. L'asimmetria «i miei in punti, i suoi in
  percentuale» non è esprimibile: la matrice è simmetrica, ogni cella calcola
  tutte e due le direzioni, e non esiste un lato «mio»;
- il verdetto diventa **tre stati invece di due** — KO certo, KO possibile,
  niente. Oggi `maxPct >= 100` li confonde già a vita piena: una mossa che fa
  40–105% e una che ne fa 100–120% hanno lo stesso colore. E il terzo stato non
  può essere solo un colore, perché la matrice è densa e c'è chi il rosso dal
  verde non lo distingue;
- **le due levette restano** per adesso, ma derivate: la precedenza è decisa e
  scritta, il numero vince. Ritirarle dall'interfaccia si valuta dopo.

E una cosa che nessuna di queste decisioni copre: **un Pokémon messo al 50% e
poi dimenticato cambia il significato di tutta la sua riga e la sua colonna**,
in silenzio. Il controllo per impostarli non basta: serve un segno sempre
visibile in matrice per chi non è al massimo, o si costruisce una fabbrica di
numeri sbagliati con l'aria di essere giusti.

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
