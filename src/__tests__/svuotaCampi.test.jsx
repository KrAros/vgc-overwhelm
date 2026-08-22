// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/svuotaCampi.test.jsx
 *
 * La X che svuota un campo di ricerca: c'è quando serve, non c'è quando non
 * serve, e dice il proprio nome.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * Fino alla sessione X la X c'era sul nome del Pokémon e sullo strumento, ma
 * non sulla mossa: tre campi con la stessa forma e due affordance su tre.
 *
 * E le due esistenti non avevano nome accessibile: il contenuto era il solo
 * glifo «✕», che passa il controllo «il bottone ha un nome» — perché un nome
 * ce l'ha — ma a chi usa uno screen reader legge «✕» tre volte di fila senza
 * dire di quale campo si tratti. È la stessa famiglia del difetto di P, dove
 * un controllo esisteva senza dire cosa fosse.
 *
 * ─── IL CONFINE, DICHIARATO ────────────────────────────────────────────────
 *
 * Questa suite non ha jsdom né testing-library: si rende in SSR e si guarda il
 * markup. Quindi qui si verifica CHE IL CONTROLLO CI SIA e come si presenta —
 * **il click non è coperto**. Che `onChange(null)` svuoti davvero, e che
 * svuotare non cambi il numero di nemici in campo, restano verificati a mano.
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PokemonSearch, MoveSearch, ItemSearch } from '../components/editor/SearchSelects.jsx'
import '../i18n.js'

const rendi = (C, props) =>
  renderToStaticMarkup(<C value={null} onChange={() => {}} placeholder="—" {...props} />)

/** Le aria-label dei bottoni presenti nel markup. */
const etichette = (html) =>
  [...html.matchAll(/<button[^>]*aria-label="([^"]*)"/g)].map((m) => m[1])

const CAMPI = [
  ['Pokémon',   PokemonSearch, 'garchomp'],
  ['mossa',     MoveSearch,    'earthquake'],
  ['strumento', ItemSearch,    'leftovers'],
]

describe('la X che svuota un campo', () => {
  it.each(CAMPI)('%s: compare quando il campo è pieno', (_nome, C, valore) => {
    expect(etichette(rendi(C, { value: valore })).length).toBeGreaterThan(0)
  })

  /**
   * IL CONTROLLO CHE SI MUOVE. Senza questo caso il blocco passerebbe anche se
   * la X fosse sempre presente: «c'è quando serve» non vuol dire niente se non
   * si prova che manca quando non serve.
   */
  it.each(CAMPI)('%s: non compare quando il campo è vuoto', (_nome, C) => {
    expect(etichette(rendi(C, { value: null }))).toEqual([])
  })

  it.each(CAMPI)('%s: la X dice di quale campo è', (_nome, C, valore) => {
    const nomi = etichette(rendi(C, { value: valore }))
    for (const n of nomi) {
      expect(n.trim()).not.toBe('')
      expect(n).not.toBe('✕')          // il glifo non è un nome
      expect(n.length).toBeGreaterThan(3)
    }
  })

  it('i tre campi non dicono la stessa cosa', () => {
    // Tre «Svuota» identici sarebbero un nome presente e inutile: chi naviga
    // per controlli sentirebbe la stessa frase e non saprebbe dove si trova.
    const nomi = CAMPI.map(([, C, v]) => etichette(rendi(C, { value: v }))[0])
    expect(new Set(nomi).size).toBe(3)
  })

  it('il markup renderizza davvero qualcosa', () => {
    // La sonda cieca della sessione L: tre stringhe vuote confrontate con tre
    // stringhe vuote passerebbero tutti i casi qui sopra.
    for (const [, C, v] of CAMPI) expect(rendi(C, { value: v }).length).toBeGreaterThan(50)
  })
})
