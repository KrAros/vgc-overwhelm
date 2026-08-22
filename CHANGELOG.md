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
- 1945 test, caratterizzazione della formula su 586 casi, della matrice su 180
- Pubblicazione automatica solo se lint, suite e `snapshot:diff` passano

## Prima della 1.0

- [ ] Le icone: decisione su marchi e diritti
- [ ] PWA
- [ ] Set del meta con la fonte dichiarata
