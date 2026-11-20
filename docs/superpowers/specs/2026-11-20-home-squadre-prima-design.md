<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 KrAros
-->

# Home: squadre prima, danni dopo

Stato: **da approvare**. Mockup: https://claude.ai/artifact/Cv34BYyY7CEtV5BUcxiCqi (proposta A).

## Intento
Chi apre il sito deve vedere subito i campi dove inserire i Pokémon. Oggi il
primo schermo è una matrice 6×6 di trattini (nessun dato, nessun invito
all'azione) e i campi stanno in fondo alla pagina. La tabella dei danni
compare dopo, quando le squadre hanno dei Pokémon.

## Obiettivi
- Primo schermo: opzioni compatte, poi le due squadre con slot e ricerca in vista.
- La matrice appare solo quando ciascuna squadra ha almeno un Pokémon; prima c'è una guida di una riga.
- Stessa struttura su desktop e telefono (una colonna sotto 1024 px).
- Un solo accento (teal, già quello del logo); rosso solo per azioni distruttive e KO.
- `prefers-reduced-motion` rispettato.

## Non obiettivi
- Nessun cambio al motore di calcolo, ai dati o alle traduzioni oltre alla nuova stringa di guida.
- Nessun set di esempio precaricato (non si inventano set).
- Nessun ridisegno interno dell'editor di un singolo Pokémon (resta com'è).

## Anti-obiettivi
- Matrice nascosta quando c'è un Pokémon per squadra, ma l'utente non la trova.
- Un test di calcolo o di snapshot che si muove: questo lavoro non deve cambiare nessun numero.

## Vincoli (dal codice)
- Ordine attuale in `App.jsx`: ReportPanel, TopBar, DamageTable, ControlBar, due TeamEditor.
  Nuovo ordine: TopBar, due TeamEditor, ControlBar, DamageTable, ReportPanel (il report sta sotto la matrice che lo apre).
- `handleCellSelect` fa scroll verso `reportRef` e verso `#damage-table`: va riletto con il nuovo ordine.
- Una squadra condivisa (`?share=`) o importata riempie le squadre: la matrice deve comparire da sola.
- Il progetto lavora per sessioni piccole, un compito per branch; test e snapshot restano verdi.

## Approcci considerati
- **A. Squadre in alto, risultati sotto** (scelta): un flusso solo, uguale su telefono, divisibile in sessioni.
- B. Procedura a passi: guida di più, ma ogni ritocco costringe a tornare indietro.
- C. Pannello diviso: comodo su schermo largo, ma su telefono ricade in A (due layout da mantenere).

## Le mie scelte (da correggere)
- Teal come unico accento, perché è già il colore di logo e skip link.
- Soglia della matrice: almeno 1 Pokémon per squadra.
- Barra opzioni (Trick Room, campo, meteo, numero avversari) su una riga, a tendine sotto 640 px.

## Lasciato a chi costruisce
Selettore dello store per "squadra non vuota", struttura esatta di `ControlBar`, nome delle nuove chiavi di traduzione.

## Divisione in sessioni (una per branch)
1. Struttura della pagina: nuovo ordine in `App.jsx` e barra opzioni (`TopBar`).
2. Editor squadre: slot e ricerca in evidenza (`editor/`).
3. Matrice e stato vuoto (`DamageTable`, test).
4. Colore, tipografia, motion, mobile e accessibilità.

La 1 va prima; 2–4 possono andare in parallelo solo su file diversi.
