// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/pirocriniera.test.js
 *
 * Pirocriniera (`fire-mane`): ×1,5 sulla statistica d'attacco per le mosse di
 * Fuoco.
 *
 * ─── PERCHÉ UN FILE ADESSO, SE IL RAMO C'ERA GIÀ ───────────────────────────
 *
 * Perché fino a oggi nessuno poteva accendere quel ramo. `fire-mane` non stava
 * in `abilities.json`, e `anomalieListino.test.js` la classificava
 * «da-aggiudicare» con questa nota:
 *
 *     «Il roster in rosterChampions.json elenca specie, non abilità, quindi
 *      qui dentro non c'è niente che dica se esista.»
 *
 * Falsa: `pokemon.json` la assegna a `pyroar-mega`. L'assenza era stata
 * cercata da un lato solo — lo stesso errore che quel file racconta per le
 * quindici Megapietre, ripetuto nel file che lo racconta.
 *
 * Messa nel listino, il ramo diventa raggiungibile. Un ramo raggiungibile va
 * verificato contro il riferimento, e non lo era mai stato: era stato
 * trascritto dalla sessione D e mai confrontato roll per roll, perché nessun
 * caso poteva costruirlo.
 *
 * NCP la implementa in `calcAtMods` — `damage_MASTER.js:1954`, `0x1800` cioè
 * ×1,5 sulla STATISTICA D'ATTACCO e non sulla potenza. È la catena in cui
 * sta anche da noi (`calcEngine.js`, «punto D»).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import abilities from '../data/abilities.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const pyroar = (atkAbility) => ({
  atkPokemon: 'pyroar-mega', atkSPs: [0, 0, 0, 32, 0, 20], atkNature: 'modest',
  atkAbility, atkItem: null, level: 50,
})
const INCINEROAR = {
  defPokemon: 'incineroar', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}
const nostro = (atkAbility, move) => calculateDamage({
  attacker: pyroar(atkAbility), defender: INCINEROAR, move, field: {}, debug: false,
})

describe('Pirocriniera si può scegliere', () => {
  it('è l\'abilità di Pyroar Mega, ed è nel listino', () => {
    expect(pokemonData['pyroar-mega'].abilities).toEqual(['fire-mane'])
    expect(abilities['fire mane']).toEqual({ name: 'Fire Mane' })
  })
})

describe('Pirocriniera, contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  for (const [nome, atkAbility, move] of [
    ['una mossa Fuoco col bonus',    'fire-mane', 'flamethrower'],
    ['un\'altra mossa Fuoco',        'fire-mane', 'fire blast'],
    ['una mossa NON Fuoco',          'fire-mane', 'hyper voice'],
    ['la stessa mossa senza abilità', null,       'flamethrower'],
  ]) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({
        attacker: pyroar(atkAbility), defender: INCINEROAR, move, field: {},
      })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(atkAbility, move).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})

describe('Pirocriniera muove il numero, e solo dove deve', () => {
  it('le mosse Fuoco crescono', () => {
    expect(nostro('fire-mane', 'flamethrower').maxDmg)
      .toBeGreaterThan(nostro(null, 'flamethrower').maxDmg)
  })

  it('le altre no', () => {
    expect(nostro('fire-mane', 'hyper voice').rolls)
      .toEqual(nostro(null, 'hyper voice').rolls)
  })
})
