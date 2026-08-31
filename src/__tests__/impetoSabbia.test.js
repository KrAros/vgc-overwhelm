// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/impetoSabbia.test.js
 *
 * Impeto Sabbia (`sand-force`): ×1,3 sulle mosse Roccia, Terra e Acciaio,
 * durante la tempesta di sabbia.
 *
 * ─── PERCHÉ QUESTA, DELLE 105 ──────────────────────────────────────────────
 *
 * Perché è quella che costa di più oggi, e l'ordine è stato misurato invece
 * che scelto: dei 64 set del meta, otto portano un'abilità del divario, e
 * Impeto Sabbia ne tocca DUE — tutt'e due su Garchomp Mega, e uno si chiama
 * «Sand Force Attacker».
 *
 * Il costo, misurato contro il riferimento: Terremoto in sabbia passa da
 * 170-204 a 222-264. Un terzo in meno, su un set il cui nome dice l'abilità.
 *
 * ─── IL BUCO ERA GIÀ DICHIARATO, E IN MODO PRECISO ─────────────────────────
 *
 * `classificazione-badge.mjs` la teneva come `meccanica-diversa`, con questa
 * nota: «damage.js la rende immune al danno da sabbia. NCP la calcola per il
 * +30% di potenza in calcBPMods:1633, che noi non facciamo».
 *
 * Cioè: il registro sapeva esattamente cosa mancava, e da quanto. Il segnalino
 * «non calcolata» era corretto — noi la nominavamo, ma per un'altra cosa.
 * Adesso il motore fa tutt'e due, l'abilità esce dal divario da sé, e quella
 * riga è stata tolta perché la sua nota era diventata falsa.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { isSandImmune } from '../lib/damage.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

// Il set del meta, com'è scritto in `metaPresets.js`.
const garchomp = (atkAbility) => ({
  atkPokemon: 'garchomp-mega', atkSPs: [0, 32, 0, 0, 0, 20], atkNature: 'jolly',
  atkAbility, atkItem: 'garchompite', level: 50,
})
const INCINEROAR = {
  defPokemon: 'incineroar', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}
const nostro = (atkAbility, move, weather) => calculateDamage({
  attacker: garchomp(atkAbility), defender: INCINEROAR, move,
  field: { weather }, debug: false,
})

describe('Impeto Sabbia, contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const casi = [
    ['Terremoto in sabbia — il caso del set', 'sand-force', 'earthquake',  'sand'],
    ['Rocciotomba in sabbia',                 'sand-force', 'rock tomb',   'sand'],
    ['Metaltestata in sabbia',               'sand-force', 'iron head',   'sand'],
    // Il tipo sbagliato: l'abilità c'è, la sabbia c'è, la mossa non è delle tre.
    ['Dragartigli in sabbia',                 'sand-force', 'dragon claw', 'sand'],
    // Il meteo sbagliato: la mossa è giusta, la sabbia non c'è.
    ['Terremoto senza sabbia',                'sand-force', 'earthquake',  null],
    ['Terremoto sotto il sole',               'sand-force', 'earthquake',  'sun'],
    ['Terremoto in sabbia senza l\'abilità',  null,         'earthquake',  'sand'],
  ]

  for (const [nome, atkAbility, move, weather] of casi) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({
        attacker: garchomp(atkAbility), defender: INCINEROAR, move, field: { weather },
      })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(atkAbility, move, weather).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})

describe('Impeto Sabbia vuole tutt\'e due le condizioni', () => {
  it('in sabbia, sulle mosse giuste, il numero sale', () => {
    for (const move of ['earthquake', 'rock tomb', 'iron head']) {
      expect(nostro('sand-force', move, 'sand').maxDmg, move)
        .toBeGreaterThan(nostro(null, move, 'sand').maxDmg)
    }
  })

  it('senza sabbia non fa niente', () => {
    // Il meteo è la metà che si dimentica: senza questo caso, un ramo che
    // guardasse solo il tipo passerebbe i test qui sopra.
    for (const weather of [null, 'sun', 'rain', 'snow']) {
      expect(nostro('sand-force', 'earthquake', weather).rolls, `meteo ${weather}`)
        .toEqual(nostro(null, 'earthquake', weather).rolls)
    }
  })

  it('e in sabbia non tocca gli altri tipi', () => {
    expect(nostro('sand-force', 'dragon claw', 'sand').rolls)
      .toEqual(nostro(null, 'dragon claw', 'sand').rolls)
  })
})

describe('l\'altra meccanica, quella che avevamo già, è ancora lì', () => {
  it('resta immune al danno da sabbia di fine turno', () => {
    // È la ragione per cui il motore la nominava già, ed è il motivo per cui
    // il registro la teneva come `meccanica-diversa`. Implementare il +30% non
    // doveva togliere questa: sono due cose, e adesso ci sono tutt'e due.
    expect(isSandImmune([], 'sand-force', '')).toBe(true)
    expect(isSandImmune([], 'sand force', ''), 'anche con lo spazio').toBe(true)
    expect(isSandImmune([], 'intimidate', ''), 'controllo negativo').toBe(false)
  })
})
