// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/lib/matrice.js
 *
 * Le 72 interazioni della griglia, calcolate una volta sola.
 *
 * ─── COSA C'ERA PRIMA ──────────────────────────────────────────────────────
 * `DamageCell` faceva quattro passate dove ne bastano due:
 *
 *   const allMovesT1 = calcAllMoves(attacker, defender, ...)   // 1
 *   const allMovesT2 = calcAllMoves(defender, attacker, ...)   // 2
 *   const d1 = getBestMove(attacker, defender, ...)            // 3 ← ricalcola la 1
 *   const d2 = getBestMove(defender, attacker, ...)            // 4 ← ricalcola la 2
 *
 * `getBestMove` chiamava internamente `calcAllMoves`, quindi ogni cella
 * pagava sedici `calculateDamage` invece di otto. Su una griglia piena sono
 * **576 chiamate per render** — contate con un render vero, non dedotte da
 * 36 × 16.
 *
 * La mossa migliore si sceglie dall'array che si ha già in mano. Questa è la
 * metà facile del guadagno.
 *
 * ─── LA METÀ CHE CONTA DI PIÙ ──────────────────────────────────────────────
 * L'altra metà non è nel numero di chiamate ma in QUANDO si fanno. Cliccare
 * una cella cambia `reportSelection` in `App.jsx`, quindi `DamageTable`
 * rirende, quindi si ricalcolava l'intera matrice — 576 chiamate al motore
 * per aprire un pannello che quei numeri se li porta già dietro.
 *
 * Perché quel ricalcolo si possa evitare, il calcolo deve stare fuori dal
 * componente e dipendere solo da dati: è questo file. `DamageTable` lo avvolge
 * in un `useMemo` le cui dipendenze sono i due team, il livello e lo stato di
 * campo. Selezione, hover e apertura del pannello non ne fanno parte, quindi
 * non costano più niente.
 *
 * ─── PERCHÉ RESTA PURO ─────────────────────────────────────────────────────
 * Niente React, niente store: solo dati che entrano e dati che escono. È ciò
 * che permette a `matrice.test.js` di confrontarlo con la fotografia presa
 * prima della sessione E senza montare un componente. Lo stesso motivo per
 * cui `battleState.js` e `preparazione.js` stanno qui.
 *
 * ─── SULL'IMPORT DA utils/ ─────────────────────────────────────────────────
 * `whoGoesFirst` sta in `utils/speedOrder.js` ed è anch'essa una funzione
 * pura. L'indicatore ⚡ dipende dalla mossa migliore, che si decide qui:
 * separarli vorrebbe dire far fare due volte lo stesso lavoro a chi chiama.
 */

import { calculateDamage } from '../calcEngine.js'
import { buildAttackerInput, buildDefenderInput, buildField } from './battleState.js'
import { whoGoesFirst } from '../utils/speedOrder.js'
import { LEVEL } from './rules.js'

/**
 * Tutte le mosse di uno slot contro un altro.
 *
 * @param {object} atkSlot — slot dello store
 * @param {object} defSlot
 * @param {number} level
 * @param {object} field — già orientato dal lato dell'attaccante
 * @returns {Array<{move: string, result: object|null}>}
 */
function calcolaMosse(atkSlot, defSlot, level, field) {
  const attacker = buildAttackerInput(atkSlot, level)
  const defender = buildDefenderInput(defSlot)
  return (atkSlot.moves || []).filter(Boolean).map(move => ({
    move,
    result: calculateDamage({ attacker, defender, move, field }),
  }))
}

/**
 * La mossa che fa più danno massimo.
 *
 * ─── SUI PAREGGI ───────────────────────────────────────────────────────────
 * Il confronto è strettamente maggiore, quindi a parità vince la prima in
 * ordine di slot. Non è un dettaglio libero: è il comportamento del `reduce`
 * che c'era prima, e cambiarlo sposterebbe il nome mostrato in tutte le celle
 * dove due mosse pareggiano — la fixture di caratterizzazione se ne
 * accorgerebbe, ed è proprio quello il suo lavoro.
 *
 * @param {Array<{move: string, result: object|null}>} mosse
 * @returns {{move: string, result: object}|null}
 */
function migliore(mosse) {
  let scelta = null
  for (const voce of mosse) {
    const r = voce.result
    if (!r || r.immune || !(r.maxPct > 0)) continue
    if (!scelta || r.maxPct > scelta.result.maxPct) scelta = voce
  }
  return scelta
}

/** La prima mossa immune dell'elenco, o null. Serve solo se non c'è una migliore. */
function primaImmune(mosse) {
  return mosse.find(({ result }) => result?.immune) || null
}

/**
 * Una cella: le due direzioni, la mossa migliore di ciascuna, l'eventuale
 * immunità da mostrare e chi va per primo.
 *
 * @param {object|null} atkSlot — riga (squadra 1)
 * @param {object|null} defSlot — colonna (squadra 2)
 * @param {number} level
 * @param {object} field — orientato su t1
 * @param {object} fieldReversed — orientato su t2
 * @returns {object|null} null se uno dei due slot è vuoto
 */
export function calcolaCella(atkSlot, defSlot, level, field, fieldReversed) {
  if (!atkSlot?.key || !defSlot?.key) return null

  const mosseT1 = calcolaMosse(atkSlot, defSlot, level, field)
  const mosseT2 = calcolaMosse(defSlot, atkSlot, level, fieldReversed)

  const migliore1 = migliore(mosseT1)
  const migliore2 = migliore(mosseT2)

  // L'etichetta «Immune» si mostra solo quando NESSUNA mossa fa danno: se
  // almeno una passa, la cella mostra quella e l'immunità resta implicita.
  const immune1 = migliore1 ? null : primaImmune(mosseT1)
  const immune2 = migliore2 ? null : primaImmune(mosseT2)

  // Il Vento in Coda è di squadra, non di ruolo: quello che conta per
  // l'attaccante è il lato da cui attacca, che `buildField` ha già scritto in
  // `atkTeamSide`.
  const ventoAtk = field.atkTeamSide === 't2' ? field.tailwindT2 : field.tailwindT1
  const ventoDef = field.atkTeamSide === 't2' ? field.tailwindT1 : field.tailwindT2

  const primo = whoGoesFirst(
    atkSlot, defSlot, migliore1, migliore2,
    field.weather, field.trickRoom, ventoAtk, ventoDef, field.terrain,
  ) ?? null

  return { mosseT1, mosseT2, migliore1, migliore2, immune1, immune2, primo }
}

/**
 * L'intera griglia: `matrice[ri][ci]`, con `ri` indice in squadra 1 e `ci` in
 * squadra 2. Le celle con uno slot vuoto sono `null`.
 *
 * Costruisce i due orientamenti del campo una volta sola invece che per
 * cella: erano 72 `buildField` per render, ora sono due.
 *
 * @param {Array} team1
 * @param {Array} team2
 * @param {object} campo — valori di campo dallo store (vedi useFieldState)
 * @param {number} [level=LEVEL]
 * @returns {Array<Array<object|null>>}
 */
export function costruisciMatrice(team1 = [], team2 = [], campo = {}, level = LEVEL) {
  const field         = buildField(campo, 't1')
  const fieldReversed = buildField(campo, 't2')

  return team1.map(riga =>
    team2.map(colonna => calcolaCella(riga, colonna, level, field, fieldReversed)),
  )
}
