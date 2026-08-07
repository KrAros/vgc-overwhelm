// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/matrice-formato.mjs
 *
 * Come una cella della matrice diventa testo nella fixture.
 *
 * ─── PERCHÉ È CONDIVISO E LA LOGICA NO ─────────────────────────────────────
 * `gen-matrice.mjs` tiene una trascrizione della logica di `DamageTable.jsx`
 * proprio per NON dipendere da `src/lib/matrice.js`: se dipendesse, la
 * fixture si adatterebbe da sola a ogni modifica.
 *
 * Questo file è l'eccezione, e l'eccezione regge perché qui non c'è nessuna
 * decisione: non si sceglie quale mossa sia la migliore, non si calcola
 * niente. Si scrive un numero già deciso in una stringa. Condividerlo evita
 * che generatore e test possano formattare in modo diverso e far sembrare
 * uguale ciò che è diverso, o viceversa.
 *
 * Il formato è scelto per essere leggibile in un diff di git:
 *
 *   "earthquake 93.9-112.6"     percentuale minima e massima
 *   "thunderbolt IMM:type:type" immune, con ragione e dettaglio
 *   "protect ~"                 nessun risultato (mossa senza potenza)
 */

/** @param {{move: string, result: object|null}} voce */
export function serializzaMossa({ move, result }) {
  if (!result) return `${move} ~`
  if (result.immune) {
    const dettaglio = result.abilityName || result.weatherName || result.reason || 'type'
    return `${move} IMM:${result.reason}:${dettaglio}`
  }
  return `${move} ${result.minPct}-${result.maxPct}`
}

/**
 * @param {object|null} cella — forma comune: mosseT1, mosseT2, migliore1,
 *   migliore2, immune1, immune2, primo
 */
export function serializzaCella(cella) {
  if (!cella) return null
  return {
    t1: cella.mosseT1.map(serializzaMossa),
    t2: cella.mosseT2.map(serializzaMossa),
    migliore1: cella.migliore1 ? cella.migliore1.move : null,
    migliore2: cella.migliore2 ? cella.migliore2.move : null,
    immune1: cella.immune1 ? cella.immune1.move : null,
    immune2: cella.immune2 ? cella.immune2.move : null,
    primo: cella.primo ?? null,
  }
}
