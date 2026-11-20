// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * La matrice dei danni compare solo quando ciascuna squadra ha almeno un
 * Pokémon. La soglia sta in una funzione pura perché è la decisione che
 * regge tutta la home: sbagliarla nasconde la matrice a chi ha già i set.
 */
import { describe, it, expect } from 'vitest'
import { squadraHaPokemon, matriceVisibile } from '../lib/squadre.js'

const vuoto = Array.from({ length: 6 }, () => ({ key: null }))
const pieno = [{ key: 'garchomp' }, ...vuoto.slice(1)]

describe('squadraHaPokemon', () => {
  it('una squadra senza slot è vuota', () => {
    expect(squadraHaPokemon([])).toBe(false)
  })
  it('sei slot con key null sono vuoti', () => {
    expect(squadraHaPokemon(vuoto)).toBe(false)
  })
  it('basta uno slot con key per dire che la squadra ha un Pokémon', () => {
    expect(squadraHaPokemon(pieno)).toBe(true)
  })
})

describe('matriceVisibile', () => {
  it('una sola squadra piena non basta (entrambi i versi)', () => {
    expect(matriceVisibile(pieno, vuoto)).toBe(false)
    expect(matriceVisibile(vuoto, pieno)).toBe(false)
  })
  it('due squadre vuote: nascosta', () => {
    expect(matriceVisibile(vuoto, vuoto)).toBe(false)
  })
  it('due squadre piene: visibile', () => {
    expect(matriceVisibile(pieno, pieno)).toBe(true)
  })
})
