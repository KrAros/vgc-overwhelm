<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 KrAros
-->

# Home «squadre prima, danni dopo» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All'apertura si vedono subito le due squadre con slot e ricerca; la matrice dei danni compare solo quando ciascuna squadra ha almeno un Pokémon.

**Architecture:** `App.jsx` decide con una funzione pura (`matriceVisibile`) se montare `DamageTable` o una guida di una riga. L'ordine della pagina cambia; calcolo, store e dati non si toccano. Gli altri tre task rifiniscono editor, barra opzioni e aspetto, ognuno su file propri.

**Tech Stack:** React, Zustand (`useCalcStore`), Tailwind, vitest con `renderToStaticMarkup`, i18n it/en.

**Spec:** `docs/superpowers/specs/2026-11-20-home-squadre-prima-design.md`

## Global Constraints

- Nessun numero di calcolo cambia: `npm run test:run` e `npm run snapshot:diff` restano identici.
- Un solo accento (teal); rosso solo per azioni distruttive e KO.
- Una colonna sotto 1024 px (`lg:`), due colonne sopra, come oggi per gli editor.
- Ogni testo nuovo ha chiave in `src/locales/it.json` **e** `en.json` (`traduzioni.test.js` presidia la parità).
- Intestazione SPDX in ogni file nuovo; commenti in italiano, con il perché.
- Un compito = un branch; test nuovi vanno perturbati (rompere a mano il codice sorvegliato e vedere rosso).

## Review Focus

1. Link `?share=` o import con Pokémon: la matrice è visibile al primo render, senza interazione.
2. Solo una squadra ha Pokémon: nessuna matrice, e la guida nomina la squadra che manca.
3. L'utente svuota l'ultima squadra mentre il `ReportPanel` è aperto: il report si chiude senza errore (`reportSelection` non resta orfano).
4. `#damage-table` non esiste quando la matrice è nascosta: nessun `scrollIntoView` su `null`, nessun errore in console.
5. `localStorage` corrotto o vuoto (due squadre vuote): appare la guida, nessun crash.

---

### Task 1: Struttura della pagina, soglia e guida (sessione 1)

**Files:**
- Create: `src/lib/squadre.js`, `src/components/GuidaMatrice.jsx`
- Modify: `src/App.jsx` (blocco `<main>`, `handleCellSelect`), `src/locales/it.json`, `src/locales/en.json`
- Test: `src/__tests__/matriceVisibile.test.js`, `src/__tests__/homeOrdine.test.jsx`

**Interfaces:**
- Produces: `squadraHaPokemon(team: Array<{key: string|null}>): boolean` (vero se almeno uno slot ha `key` non nullo); `matriceVisibile(team1, team2): boolean` (vero se entrambe); `<GuidaMatrice team1 team2 />` che rende `<p role="status">` con la chiave `ui.matrix_guide_both`, `ui.matrix_guide_team1` o `ui.matrix_guide_team2` (la squadra che manca).
- Consumes: `useCalcStore(s => s.team1 / s.team2)`.

- [ ] **Step 1: Test puro** in `matriceVisibile.test.js`: `squadraHaPokemon([])` è falso; sei slot `key: null` falso; un solo slot con `key: 'garchomp'` vero; `matriceVisibile(pieno, vuoto)` falso; `matriceVisibile(pieno, pieno)` vero.
- [ ] **Step 2: Eseguirlo**: `npx vitest run src/__tests__/matriceVisibile.test.js`. Atteso: FAIL (modulo mancante).
- [ ] **Step 3: Implementare** `src/lib/squadre.js` con le due funzioni, senza dipendenze dallo store.
- [ ] **Step 4: Test d'ordine** in `homeOrdine.test.jsx`, stesso schema di `attribuzioneTeam.test.jsx` (mock di `localStorage`, `renderToStaticMarkup(App)`):
  - con squadre vuote: l'HTML contiene `id="main-content"`, due `Team`/`Squadra`, il testo `ui.matrix_guide_both` e **non** contiene `id="damage-table"`;
  - con una sola squadra piena: contiene la guida della squadra che manca e non contiene `id="damage-table"`;
  - con entrambe piene: contiene `id="damage-table"` e l'indice di `id="damage-table"` è **maggiore** di quello del secondo `TeamEditor` (matrice sotto le squadre).
- [ ] **Step 5: Eseguirlo**: atteso FAIL.
- [ ] **Step 6: Implementare** `GuidaMatrice.jsx` e modificare `App.jsx`: nuovo ordine `TopBar`, due `TeamEditor`, `ControlBar`, poi (se `matriceVisibile`) `DamageTable` e `ReportPanel`, altrimenti `GuidaMatrice`. `ReportPanel` si monta solo con matrice visibile; in `handleCellSelect` usare `?.` su `getElementById('damage-table')` (già così) e azzerare `reportSelection` quando `matriceVisibile` diventa falso (effetto che dipende da `team1`/`team2`). Aggiungere le tre chiavi in it.json ed en.json.
- [ ] **Step 7: Verificare**: `npm run test:run` verde (se un test esistente assume la matrice con squadre vuote, **non** cambiarne l'asserzione: capire perché e dirlo); `npm run lint`; `npm run build`; `npm run snapshot:diff` vuoto.
- [ ] **Step 8: Perturbare**: far restituire sempre `true` a `matriceVisibile` e vedere rosso `matriceVisibile.test.js` e `homeOrdine.test.jsx`; ripristinare.
- [ ] **Step 9: Commit** (messaggio in italiano, una riga sul perché).

### Task 2: Editor squadre, ricerca in evidenza (sessione 2, dopo il merge di T1)

**Files:**
- Modify: `src/components/editor/index.jsx`, `src/components/editor/SearchSelects.jsx`, `src/components/editor/SlotEditor.jsx` (solo l'ordine dei blocchi)
- Test: `src/__tests__/ricercaInEvidenza.test.jsx`

**Interfaces:** Consumes il nuovo ordine di pagina di T1. Produce nessuna API nuova.

- [ ] **Step 1: Test** `ricercaInEvidenza.test.jsx`: con uno slot vuoto, nell'HTML del pannello l'`<input>` con `aria-label` `ui.search_pokemon` compare **prima** del primo pulsante Duplica/Esporta/Importa/Elimina di quello slot; il campo non ha `disabled` né `readonly`.
- [ ] **Step 2: Eseguirlo**: atteso FAIL (oggi i pulsanti precedono la ricerca).
- [ ] **Step 3: Spostare** il campo di ricerca sopra la riga dei pulsanti per lo slot vuoto; dargli bordo e sfondo del campo attivo (`border-teal-500`, `bg-gray-900`) invece del grigio opaco. Con lo slot pieno l'ordine resta com'è.
- [ ] **Step 4: Verificare** `accessibilitaEditor.test.jsx` e `npm run test:run` verdi, `npm run lint`, build.
- [ ] **Step 5: Commit.**

### Task 3: Barra opzioni compatta (sessione 3, dopo il merge di T1)

**Files:**
- Modify: `src/components/TopBar.jsx`
- Test: `src/__tests__/barraOpzioni.test.jsx`

**Interfaces:** Consumes i selettori già in `TopBar` (`trickRoom`, `doubleTarget`, `weather`, `terrain`). Non cambia nessuna azione dello store.

- [ ] **Step 1: Test**: nell'HTML di `TopBar` ci sono Trick Room, campo e meteo, e nessun elemento ha più di una riga di contenuto a 1024 px (asserire sulla struttura: un solo contenitore flex senza `flex-wrap` multiplo; niente misura in pixel, non si può in SSR).
- [ ] **Step 2: Eseguirlo**: atteso FAIL o, se già vero, restringere l'asserzione alla nuova struttura.
- [ ] **Step 3: Riscrivere** la barra su una riga: tre gruppi con etichetta, tendine (`<select>`) sotto 640 px come già fa il ramo `sm:hidden`. Mantenere le sfumature di scorrimento (`useBordiScorrimento`) finché la striscia può scorrere.
- [ ] **Step 4: Verificare** test, lint, build. **Commit.**

### Task 4: Colore, tipografia, motion, mobile, accessibilità (sessione 4, dopo T2 e T3)

**Files:**
- Modify: `src/index.css`, `src/App.css`, classi Tailwind in `ControlBar.jsx`, `Footer.jsx`, `Header.jsx`
- Test: `src/__tests__/motionRidotto.test.js`

**Interfaces:** nessuna.

- [ ] **Step 1: Test** `motionRidotto.test.js`: leggere `src/index.css` e asserire che contiene `@media (prefers-reduced-motion: reduce)` e che le `transition-property` globali non includono `filter`.
- [ ] **Step 2: Eseguirlo**: atteso FAIL.
- [ ] **Step 3: Applicare**: una sola tinta d'accento (rimuovere ambra e viola dai controlli non semantici: «Team Library», legenda), rosso solo per Cancella ed Elimina; titolo e logo con peso maggiore dei chip; testo legale del footer con contrasto ≥ 4,5:1; blocco `prefers-reduced-motion` che azzera durata e `scroll-behavior`.
- [ ] **Step 4: Screenshot a 375 e 1280** (Playwright), confronto con il mockup A; nessun overflow di pagina a 375.
- [ ] **Step 5: Verificare** test, lint, build, `snapshot:diff` vuoto. **Commit.**

---

## Sessioni

T1 va per prima e si fonde in `modern`. T2 e T3 partono dopo, in parallelo (file diversi; solo i file di traduzione possono confliggere: si risolve con rebase). T4 chiude. Ogni sessione parte dal suo task, con spec e questo piano come unico contesto; ognuna chiude con `/chiudi-sessione`.
