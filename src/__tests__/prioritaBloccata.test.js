// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/prioritaBloccata.test.js
 *
 * Armor Tail, Queenly Majesty e Dazzling: le mosse con priorità non hanno
 * effetto.
 *
 * ─── TRE ABILITÀ, UN RAMO SOLO ─────────────────────────────────────────────
 *
 * Nel riferimento sono una riga sola (`damage_MASTER.js:1155`), dentro
 * `immunityChecks`, con un solo `return damage: [0]`:
 *
 *     if (["Queenly Majesty", "Dazzling", "Armor Tail"].indexOf(defAbility) !== -1
 *         && move.isPriority) {
 *
 * Quindi anche da noi un flag solo: niente le distingue, e tre flag identici
 * sarebbero tre posti dove sbagliarne uno.
 *
 * ─── IL FLAG CHE HO DOVUTO TRASCRIVERE, E PERCHÉ ───────────────────────────
 *
 * `moves.json` aveva già un campo `priority`, ed era la scorciatoia ovvia.
 * Misurato prima di prenderla: il nostro `priority` è un NUMERO e ce l'hanno
 * 38 mosse, l'`isPriority` del vendor è un FLAG e ce l'hanno 21. Le 17 di
 * differenza sono Protect, Detect, Follow Me, Helping Hand, Wide Guard e
 * compagnia — e hanno tutte potenza ZERO, quindi al calcolo non arrivano.
 *
 * Cioè: `priority > 0` avrebbe dato oggi la stessa risposta. Ma per
 * coincidenza, non per costruzione — basta che il gioco dia priorità a una
 * mossa che fa danno senza che NCP la marchi, e i due insiemi si separano in
 * silenzio. Il flag è trascritto come gli altri sei.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const ATTACCANTE = {
  atkPokemon: 'incineroar', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
  atkAbility: null, atkItem: null, level: 50,
}
const difensore = (defAbility) => ({
  defPokemon: 'farigiraf', defSPs: [32, 0, 16, 0, 16, 0], defNature: 'careful',
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const nostro = (defAbility, move) => calculateDamage({
  attacker: ATTACCANTE, defender: difensore(defAbility), move, field: {}, debug: false,
})

const LE_TRE = ['armor-tail', 'queenly-majesty', 'dazzling']

describe('il flag `prioritaria` viene dal vendor', () => {
  it('sono ventuno, e diciassette fanno danno', () => {
    const p = Object.entries(movesData).filter(([, v]) => v.prioritaria)
    expect(p.length).toBe(21)
    expect(p.filter(([, v]) => v.power > 0).length).toBe(17)
  })

  it('non è il campo `priority`, che è un\'altra cosa', () => {
    // La misura che ha fatto scartare la scorciatoia, scritta come fatto.
    const conNumero = Object.entries(movesData).filter(([, v]) => v.priority > 0)
    const conFlag   = Object.entries(movesData).filter(([, v]) => v.prioritaria)
    expect(conNumero.length).toBeGreaterThan(conFlag.length)
    // E le mosse in più hanno tutte potenza zero: è la ragione per cui oggi i
    // due criteri darebbero lo stesso risultato, e per cui domani potrebbero
    // non darlo.
    const inPiu = conNumero.filter(([k]) => !movesData[k].prioritaria)
    expect(inPiu.length).toBe(17)
    expect(inPiu.filter(([, v]) => v.power > 0)).toEqual([])
  })

  it('la lista non è nel motore', () => {
    const motore = fs.readFileSync(path.join(RADICE, 'src', 'calcEngine.js'), 'utf8')
    expect(['fake out', 'sucker punch', 'extreme speed'].filter(n => motore.includes(`'${n}'`)))
      .toEqual([])
  })
})

describe('le mosse con priorità vengono azzerate', () => {
  for (const abilita of LE_TRE) {
    it(`${abilita} azzera Fake Out`, () => {
      const r = nostro(abilita, 'fake out')
      expect(r.immune).toBe(true)
      expect(r.reason).toBe('ability')
      expect(r.rolls).toEqual([])
    })

    it(`${abilita} non tocca una mossa senza priorità`, () => {
      // Il ramo si accende sul FLAG, non sull'abilità.
      expect(nostro(abilita, 'crunch').rolls).toEqual(nostro(null, 'crunch').rolls)
    })
  }

  it('e senza le tre, Fake Out fa il suo danno', () => {
    expect(nostro(null, 'fake out').rolls.length).toBe(16)
  })
})

describe('contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const casi = []
  for (const a of [...LE_TRE, null]) for (const m of ['fake out', 'sucker punch', 'crunch']) {
    casi.push([`${a} contro ${m}`, a, m, LE_TRE.includes(a) && m !== 'crunch'])
  }

  for (const [nome, defAbility, move, nullo] of casi) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({
        attacker: ATTACCANTE, defender: difensore(defAbility), move, field: {},
      })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(rif.nullo, `${nome}: il riferimento non è d'accordo sul colpo nullo`).toBe(nullo)
      expect(nostro(defAbility, move).rolls).toEqual(rif.rolls)
    })
  }
})
