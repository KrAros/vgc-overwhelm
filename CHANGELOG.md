<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 KrAros

Questo file racconta COSA è cambiato per chi usa l'app. Il perché di ogni
scelta sta nei messaggi di commit, che sono la fonte: qui non si ripete il
ragionamento, si dice l'effetto. Una seconda copia del ragionamento sarebbe
una seconda copia da tenere allineata.
-->

# Diario delle versioni

Il progetto segue il [versionamento semantico](https://semver.org/lang/it/).
Fino alla **1.0.0** l'app è in beta: i numeri che produce sono verificati
contro il riferimento, ma l'interfaccia può ancora cambiare forma.

## Non ancora rilasciato

### La matrice distingue «lo uccide» da «forse lo uccide»
- Prima una mossa che fa 40–105% e una che ne fa 100–120% avevano **lo stesso
  colore**: la prima uccide in un caso su sedici, la seconda sempre
- Adesso la cella dice **KO** quando anche il tiro peggiore basta e **KO?**
  quando solo alcuni bastano, con la probabilità esatta passando col mouse
- Il verdetto guarda i punti salute **rimasti**, non il massimo: un bersaglio
  a metà vita va KO con una mossa che ne fa il 60%. La percentuale invece
  resta sul massimo, così due celle si possono ancora confrontare fra loro
- I due stati si leggono anche in bianco e nero, e il lettore di schermo li
  annuncia

### Eruption dava sempre il danno massimo, anche a un punto di vita
- **Eruption**, **Water Spout** e **Dragon Energy** valgono meno man mano che
  chi le usa si indebolisce: a metà vita fanno metà. L'app dava sempre il
  numero pieno, e senza avvisi — hanno una potenza nei dati, quindi mostravano
  un numero che sembrava giusto
- **Flail** e **Reversal** fanno l'opposto: più sei ferito, più fanno male
- **Crush Grip**, **Wring Out** e **Hard Press** guardano invece la vita del
  bersaglio
- Le mosse col badge scendono da 12 a **7**, e quelle che restano non aspettano
  più i punti salute

### Cinque mosse che leggono i punti salute mostrano il loro danno
- **Super Fang**, **Nature's Madness** e **Ruination** tolgono metà dei punti
  salute che il bersaglio ha ancora. **Final Gambit** toglie tutti quelli di
  chi la usa. **Endeavor** pareggia i due
- Prima disegnavano `~`. Le mosse col badge scendono da 17 a **12**
- Endeavor fa danno anche fra due Pokémon interi, se il bersaglio è più
  robusto: un Garchomp intero ne toglie 147 a una Blissey intera

### Tera Shell proteggeva anche un Pokémon ferito
- **Tera Shell** dimezza i colpi solo quando chi la porta è a vita piena. L'app
  la applicava sempre, e nell'editor non c'era nemmeno l'interruttore per dire
  «è danneggiato» — c'è per Multiscale e Shadow Shield, non per lei
- Oggi il numero era giusto lo stesso, perché l'app dà per scontato che tutti
  siano a vita piena. Sarebbe diventato sbagliato nel momento in cui si potrà
  dire il contrario
- Adesso l'interruttore c'è, e il calcolo lo guarda: 54 di danno contro i 109
  veri

### Return, Frustration e Trump Card mostrano un danno
- Erano fra le mosse che disegnavano `~`. Adesso hanno un numero, e le mosse
  col badge scendono da 20 a **17**
- Il numero vale **sotto un'ipotesi dichiarata**, la stessa del riferimento:
  Return e Frustration al massimo dell'affetto, Trump Card con quattro o più
  PP. Nel gioco quelle potenze variano, e né l'affetto né i PP sono nel
  modello
- **Beat Up** sembra della stessa famiglia e resta col badge: il riferimento la
  calcola con un colpo solo mentre i nostri dati ne prevedono fino a sei, e
  scegliere quale sia il numero giusto sarebbe una decisione, non una copia

### Foul Play usava la statistica del Pokémon sbagliato
- **Foul Play** colpisce con l'Attacco del BERSAGLIO, non col proprio: è tutto
  il senso della mossa. L'app usava quello di chi attacca — un Blissey faceva
  12 di danno invece di 56, e contro un bersaglio potenziato **12 invece di
  220**
- **Acrobatics** vale il doppio quando chi la usa non ha nessuno strumento,
  cioè nel modo normale di usarla. L'app dava sempre metà danno
- Nessuna delle due aveva un avviso: hanno una potenza nei dati, quindi
  mostravano un numero e sembrava giusto

### Stored Power e Power Trip erano sbagliate di dodici volte
- Le due mosse che crescono con i propri potenziamenti usavano sempre la
  potenza minima. Con chi attacca a +6 in due statistiche il danno usciva
  **dodici volte più basso** del dovuto — e senza nessun avviso, perché il
  badge «non calcolata» segnala le mosse che non mostrano un numero, e queste
  un numero lo mostravano
- **Punishment** ora è calcolata: cresce coi potenziamenti del bersaglio
- **Power Trip** si chiamava «Power rip» nei nostri dati. Il nome sbagliato la
  rendeva invisibile al confronto col riferimento, e l'esportazione verso
  Showdown scriveva una mossa che non esiste. Stessa cosa per **Nature's
  Madness**, scritta «Natures's Madness»

### Gyro Ball ed Electro Ball mostrano il loro danno
- Le due mosse la cui potenza dipende dalla Velocità dei due Pokémon ora sono
  calcolate. Prima disegnavano `~` come le altre
- **Gyro Ball** premia chi è lento e cresce con continuità: ogni punto di
  Velocità sposta il numero, fino a un tetto. **Electro Ball** premia chi è
  veloce ma a gradini: fra una volta e due volte la Velocità del bersaglio la
  potenza non si muove
- Contano anche Ferrolimo, Ferroblocco, paralisi e le abilità meteo: la
  Velocità è quella vera, non quella sulla carta
- Le mosse col badge «non calcolata» scendono da 22 a 20

### Analytic leggeva la Velocità sbagliata
- **Analytic** (×1,3 quando attacchi per secondo) decideva l'ordine di turno
  guardando una Velocità senza Ferrolimo, senza Ferroblocco, senza paralisi e
  senza le abilità meteo. Un Watchog con Ferrolimo è più veloce di un
  Charizard, ma l'app gli dava lo stesso il ×1,3: **27% di danno in più del
  dovuto**, e nessun avviso
- Adesso guarda la Velocità effettiva, che è quella che guarda anche il
  riferimento

### Il badge «non calcolata» adesso c'è anche sulle mosse
- Le **22 mosse** che il riferimento calcola e noi no mostrano il segnalino
  ambra accanto alla potenza — Counter, Super Fang, Gyro Ball, Return e le
  altre. Prima erano l'unico divario del progetto del tutto silenzioso: la
  tabella scriveva `~`, cioè quello che scrive per Protect, e niente diceva
  che di quel `~` non ci si deve fidare
- Il badge non compare sulle mosse che il riferimento non calcola affatto
  (Bide, Magnitude, Present, Spit Up, Psywave): lì non c'è un numero giusto da
  nessuna delle due parti, e dichiararlo un divario sarebbe falso

### Mosse che prima sembravano di stato
- **Sonic Boom, Dragon Rage, Seismic Toss e Night Shade** mostrano il loro
  danno. Prima uscivano `~` nella matrice, cioè il disegno di una mossa che
  non fa danno: a livello 50 Seismic Toss ne fa 50, e l'app diceva «niente»
- Il numero è fisso e non ha variazione: un valore solo invece di sedici tiri.
  Non lo cambiano né l'efficacia, né lo STAB, né gli stadi, né gli strumenti —
  solo l'immunità di tipo lo azzera
- Restano 22 mosse a potenza zero che il riferimento calcola e noi no, e
  continuano a disegnarsi `~` senza nessun avviso: l'elenco sta in
  [`docs/lavoro-aperto.md`](docs/lavoro-aperto.md)

### Più leggera da aprire
- Il JavaScript scaricato alla prima apertura passa da **212,56 a 205,21 kB**
  gzip: dal bundle escono i campi dei dati di gioco che l'applicazione non
  legge mai — il peso dei Pokémon, il genere, il numero delle mosse
- Nessun numero calcolato cambia: la potatura tocca il bundle, non il motore

### Sotto il cofano
- Il confronto col riferimento verifica **519 configurazioni** della formula e
  **35** dello stato di partenza, contro 509 e 27. Otto di quelle nuove coprono
  una direzione mai verificata prima: l'abilità che prepara il campo addosso a
  **chi attacca**, non a chi subisce
- `npm run ncp:gen` è tornato rigenerabile. Produceva 11 casi marcati come
  difetti nostri che difetti non erano — confrontati col punto d'ingresso
  sbagliato — e il manuale diceva di non rigenerarlo. Adesso quel controllo lo
  fa da sé, e nessuno degli 11 era un errore di calcolo
- `npm run bundle:check` pesa ciò che il browser scarica davvero e fallisce
  sopra i 210 kB. Era l'unico criterio del progetto senza una rete sotto, ed
  era stato sforato senza che nessuno se ne accorgesse
- I registri dicevano 1945 test, 114 abilità e 41 strumenti col badge, 1879
  chiavi di traduzione: erano 1961, 109, 40 e 1891

## 0.9.0 — 22 agosto 2026

Prima versione numerata. Il calcolatore è completo e verificato; quello che
manca alla 1.0 è il lancio, non il motore.

### Il motore
- Formula completa a quattro catene di modificatori, **zero divergenze** dal
  riferimento vendorizzato su 509 casi golden
- Probabilità di KO cumulativa, danni di fine turno, ordine di attacco
- Stato di partenza: Prepotenza, paradossi, spada e scudo, Download
- Sistema **SP** di Champions, livello 50 fisso, formato doppi

### Cosa dice l'app di non sapere
- Badge «non calcolata» su **109 abilità e 40 strumenti**, generato dal
  riferimento e da cosa il motore ramifica davvero — non da una lista scritta
  a mano

### Interfaccia
- Matrice 6×6 con danno in entrambe le direzioni, e i nomi per esteso: prima
  dieci Pokémon diversi si chiamavano tutti «Iron»
- Import ed export Showdown, uno solo per tutta l'app
- Riconosce le forme come le scrive una persona: `Mega Scolipede`,
  `Rotom (Wash)`, `Alolan Raichu`
- Riconosce gli SP scritti sotto l'etichetta `EVs:`
- Accessibilità **100** su mobile e desktop, layout senza difetti misurati da
  320 a 1600 px
- Italiano e inglese

### Sotto il cofano
- 1961 test, caratterizzazione della formula su 586 casi, della matrice su 180
- Pubblicazione automatica solo se lint, suite e `snapshot:diff` passano

## Prima della 1.0

- [ ] Le icone: decisione su marchi e diritti
- [ ] PWA
- [ ] Set del meta con la fonte dichiarata
