// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/lib/psSlot.js
 *
 * I punti salute di uno slot: il massimo, quelli correnti, e il colore.
 *
 * ─── PERCHÉ UN FILE, E NON TRE RIGHE NEL COMPONENTE ────────────────────────
 *
 * Perché a leggerli sono in tre: la barra nell'editor, il riquadro
 * dell'abilità (Multiscale e le cinque a vita bassa non hanno più una levetta
 * propria: leggono questo numero) e l'intestazione della matrice, che segna i
 * Pokémon non al massimo. Scritta tre volte, l'espressione diverge — è
 * esattamente il difetto che `battleState.js` è venuto a togliere per
 * l'input del motore.
 *
 * ─── SUL RAMO `psDaLevetta` ────────────────────────────────────────────────
 *
 * Prima che questo campo esistesse, «a vita piena» e «sotto un terzo» si
 * dicevano con due levette. Le squadre salvate allora — in localStorage o in
 * un link condiviso — portano ancora quelle, e non un numero. Qui si
 * traducono, con la STESSA espressione che usa il motore
 * (`calcEngine.js`, blocco «I PUNTI SALUTE»): così un link vecchio si apre
 * mostrando nella barra lo stato che descriveva, invece di mostrare vita
 * piena e calcolare altro.
 */

import { calcStat } from './stats.js'
import { STAT_HP, LEVEL, psDaLevetta, ABILITA_A_VITA_BASSA } from './rules.js'
import { normalizeAbilityKey } from '../data/abilityEffects.js'
import pokemonData from '../data/pokemon.json'

/**
 * Il massimo di punti salute dello slot, o 0 se non c'è un Pokémon.
 *
 * @param {object|null} slot
 * @param {number} [level=LEVEL]
 * @returns {number}
 */
export function psMassimi(slot, level = LEVEL) {
  const base = pokemonData[slot?.key]?.stats?.[STAT_HP]
  if (!base) return 0
  return calcStat(base, slot?.sps?.[STAT_HP] || 0, level, null, STAT_HP)
}

/**
 * I punti salute correnti dello slot: il numero se c'è, altrimenti quello che
 * le vecchie levette descrivevano, altrimenti il massimo.
 *
 * @param {object|null} slot
 * @param {number} psMax — da `psMassimi`, che chi chiama ha già
 * @returns {number}
 */
export function psCorrenti(slot, psMax) {
  if (!psMax) return 0
  if (slot?.ps != null) return Math.min(psMax, Math.max(1, Math.trunc(slot.ps)))

  const flags = slot?.abilityFlags || {}
  return psDaLevetta(psMax, {
    pieniSpenti: flags.multiscaleActive === false,
    vitaBassa: flags.interruttore === true
      && ABILITA_A_VITA_BASSA.has(normalizeAbilityKey(slot?.ability)),
  }) ?? psMax
}

// ─── Il semaforo ─────────────────────────────────────────────────────────────
//
// Le tre soglie sono di Simone e non del riferimento: il gioco colora così la
// barra, e questa barra serve a riconoscere a colpo d'occhio quanto è messo
// male un Pokémon, non a decidere un calcolo. Il motore non le legge.
//
// Nota che NON coincidono con le soglie del riferimento (metà per Defeatist,
// un terzo per Blaze e sorelle): il 20% non è la soglia di nessuna abilità. È
// voluto — il colore dice «sta per morire», la levetta dell'abilità la dice il
// suo riquadro.
export const VERDE  = '#70C8A0'
export const GIALLO = '#FFFF00'
export const ROSSO  = '#FF0000'

/**
 * @param {number} ps
 * @param {number} psMax
 * @returns {string} colore esadecimale
 */
export function colorePS(ps, psMax) {
  if (!psMax) return VERDE
  const frazione = ps / psMax
  if (frazione > 0.5) return VERDE
  if (frazione > 0.2) return GIALLO
  return ROSSO
}
