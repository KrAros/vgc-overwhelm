// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/etichetteMatrice.test.js
 *
 * Due Pokémon diversi non possono avere la stessa etichetta nella matrice.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * `formatPokeName` tornava `key.split('-')[0]` per tutto ciò che non è una
 * Mega. Contato sull'anagrafica prima di correggere: **82 etichette valevano
 * per più di una specie, e 212 specie perdevano identità**.
 *
 *   «Iron»     10 specie — Iron Hands, Iron Bundle, Iron Moth, Iron Jugulis…
 *   «Silvally» 18
 *   «Rotom»    6
 *
 * E i Tesori della Rovina diventavano parole italiane per caso: `chi-yu` →
 * «Chi». Nella matrice si leggeva una colonna intitolata «Chi».
 *
 * Non era un caso di nicchia: è il meta di ogni formato recente.
 */

import { describe, it, expect } from 'vitest'
import { formatPokeName } from '../utils/nomiPokemon.js'
import pokemonData from '../data/pokemon.json'

const CHIAVI = Object.keys(pokemonData)

describe('le etichette della matrice', () => {
  it('nessuna etichetta vale per due specie diverse', () => {
    const per = new Map()
    for (const k of CHIAVI) {
      const e = formatPokeName(k)
      if (!per.has(e)) per.set(e, [])
      per.get(e).push(k)
    }
    const collisioni = [...per].filter(([, v]) => v.length > 1)
      .map(([e, v]) => `«${e}» → ${v.join(', ')}`)
    expect(collisioni).toEqual([])
  })

  it('i casi che hanno aperto la sessione', () => {
    expect(formatPokeName('chi-yu')).toBe('Chi-Yu')
    expect(formatPokeName('iron-hands')).toBe('Iron Hands')
    expect(formatPokeName('iron-bundle')).toBe('Iron Bundle')
    expect(formatPokeName('flutter-mane')).toBe('Flutter Mane')
    expect(formatPokeName('rotom-wash')).toBe('Rotom-Wash')
  })

  it('le Mega restano compatte, come già approvato guardandole', () => {
    // L'unica abbreviazione che resta, e non è nuova: era già così.
    expect(formatPokeName('charizard-mega-y')).toBe('Charizard M·Y')
    expect(formatPokeName('charizard-mega-x')).toBe('Charizard M·X')
    expect(formatPokeName('scolipede-mega')).toBe('Scolipede Mega')
  })

  it('il controllo: le etichette dicono davvero qualcosa', () => {
    // La sonda cieca della sessione L: se la funzione tornasse la chiave grezza
    // sarebbe iniettiva e passerebbe il primo caso senza risolvere niente.
    expect(formatPokeName('iron-hands')).not.toBe('iron-hands')
    expect(formatPokeName('')).toBe('')
    expect(CHIAVI.filter(k => !formatPokeName(k)).length).toBe(0)
  })
})
