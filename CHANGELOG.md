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
