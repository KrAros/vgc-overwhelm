// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/imprudenza.test.js
 *
 * Imprudenza (`unaware`): ignora le variazioni di statistica dell'altro.
 *
 * ─── DUE VERSI, UNA SOLA ABILITÀ ───────────────────────────────────────────
 *
 * Nel riferimento è la stessa abilità letta da due funzioni diverse, e
 * dimenticarne una avrebbe dato mezza abilità con l'aria di essere intera:
 *
 *   calcAttack punto b   (damage_MASTER.js:1870)
 *       il DIFENSORE con Imprudenza ignora i boost d'attacco di chi lo colpisce
 *   calcDefense punto c  (damage_MASTER.js:2039)
 *       l'ATTACCANTE con Imprudenza ignora i boost di difesa del bersaglio
 *
 * In tutt'e due NCP usa `rawStats`, la statistica senza stadi. Da noi si azzera
 * lo stadio, che è la stessa cosa: `applyBoost(stat, 0)` restituisce il valore
 * grezzo.
 *
 * ─── NON È IL CRITICO ──────────────────────────────────────────────────────
 *
 * Il colpo critico ignora SOLO i boost che gli darebbero fastidio: i cali
 * d'attacco propri e i boost di difesa altrui. Imprudenza no — azzera lo
 * stadio in tutt'e due i versi, quindi contro un attaccante a −2 il difensore
 * con Imprudenza prende PIÙ danno di quanto ne prenderebbe senza.
 *
 * È il verso che si dimentica scrivendo «ignora i boost», e ha un caso suo.
 *
 * ─── PERCHÉ ADESSO ─────────────────────────────────────────────────────────
 *
 * Clefable «Redirector Support», uno dei 64 set del meta.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const attaccante = (atkAbility, atkBoost = 0) => ({
  atkPokemon: 'incineroar', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
  atkAbility, atkItem: null, level: 50, atkBoost,
})
const difensore = (defAbility, defBoost = 0) => ({
  defPokemon: 'clefable', defSPs: [32, 0, 16, 0, 16, 0], defNature: 'calm',
  defAbility, defItem: null, defBoost, spDefBoost: 0, defAbilityFlags: {},
})
const nostro = (atkAbility, defAbility, atkBoost = 0, defBoost = 0, field = {}) =>
  calculateDamage({
    attacker: attaccante(atkAbility, atkBoost), defender: difensore(defAbility, defBoost),
    move: 'knock off', field, debug: false,
  })

describe('il difensore con Imprudenza ignora i boost di chi lo colpisce', () => {
  it('un attaccante a +2 non fa più danno di uno a 0', () => {
    expect(nostro(null, 'unaware', 2).rolls).toEqual(nostro(null, 'unaware', 0).rolls)
  })

  it('e senza l\'abilità il +2 si sente eccome', () => {
    // Controllo positivo: senza, il test sopra passerebbe anche se i boost non
    // funzionassero affatto.
    expect(nostro(null, null, 2).maxDmg).toBeGreaterThan(nostro(null, null, 0).maxDmg)
  })

  it('ignora anche i CALI, quindi contro un attaccante a −2 prende di più', () => {
    // Il verso che si dimentica. Non è come il critico, che ignora solo i
    // boost scomodi: Imprudenza azzera lo stadio e basta.
    expect(nostro(null, 'unaware', -2).maxDmg)
      .toBeGreaterThan(nostro(null, null, -2).maxDmg)
  })
})

describe('l\'attaccante con Imprudenza ignora la difesa alzata del bersaglio', () => {
  it('un bersaglio a +2 Difesa non si difende meglio', () => {
    expect(nostro('unaware', null, 0, 2).rolls).toEqual(nostro('unaware', null, 0, 0).rolls)
  })

  it('e senza l\'abilità il +2 in Difesa si sente', () => {
    expect(nostro(null, null, 0, 2).maxDmg).toBeLessThan(nostro(null, null, 0, 0).maxDmg)
  })

  it('ignora anche i cali di Difesa, quindi contro un bersaglio a −2 fa di meno', () => {
    expect(nostro('unaware', null, 0, -2).maxDmg)
      .toBeLessThan(nostro(null, null, 0, -2).maxDmg)
  })
})

describe('Imprudenza, contro il riferimento', () => {
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
    ['difensore Imprudenza, attaccante a +2', null, 'unaware',  2,  0, {}],
    ['difensore Imprudenza, attaccante a −2', null, 'unaware', -2,  0, {}],
    ['difensore Imprudenza, attaccante a  0', null, 'unaware',  0,  0, {}],
    ['attaccante Imprudenza, bersaglio a +2', 'unaware', null,  0,  2, {}],
    ['attaccante Imprudenza, bersaglio a −2', 'unaware', null,  0, -2, {}],
    ['nessuna delle due, attaccante a +2',    null, null,       2,  0, {}],
    // Imprudenza e critico insieme: nel riferimento il punto b di `calcAttack`
    // viene PRIMA del punto c ed è un `else if`, quindi quando Imprudenza si
    // accende il ramo del critico non viene nemmeno valutato.
    ['difensore Imprudenza + critico, attaccante a −2', null, 'unaware', -2, 0, { crit: true }],
    ['attaccante Imprudenza + critico, bersaglio a +2', 'unaware', null, 0, 2, { crit: true }],
  ]

  for (const [nome, atkAbility, defAbility, atkBoost, defBoost, field] of casi) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({
        attacker: attaccante(atkAbility, atkBoost),
        defender: difensore(defAbility, defBoost),
        move: 'knock off', field,
      })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(atkAbility, defAbility, atkBoost, defBoost, field).rolls,
        `${nome}: divergiamo dal riferimento`).toEqual(rif.rolls)
    })
  }
})
