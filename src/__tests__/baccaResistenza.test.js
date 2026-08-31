// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/baccaResistenza.test.js
 *
 * Unnerve, As One e Ripen: le tre abilità che governano la bacca di
 * resistenza.
 *
 * ─── STAVANO GIÀ TUTTE E TRE IN UNA RIGA CHE AVEVAMO ───────────────────────
 *
 * `calcFinalMods` punto q, `damage_MASTER.js:2405`:
 *
 *     if (getBerryResistType(defender.item) === move.type
 *         && (typeEffectiveness > 1 || move.type === "Normal")
 *         && attacker.ability !== "Unnerve" && attacker.ability !== "As One") {
 *         if (defAbility === "Ripen") finalMods.push(0x400);
 *         else                        finalMods.push(0x800);
 *
 * Il motore aveva già la condizione — bacca del tipo giusto, mossa
 * superefficace o Normale, `MOD.X0_5` — e non aveva le tre abilità che la
 * spengono o la raddoppiano. Tre voci del divario chiuse aggiungendo due
 * condizioni a una riga che c'era.
 *
 * ─── RIPEN NON È «×0.5 DUE VOLTE» ──────────────────────────────────────────
 *
 * È una COSTANTE diversa che il riferimento spinge al posto dell'altra:
 * `0x400` invece di `0x800`. Sul risultato i due modi coincidono, ma
 * incatenare due modificatori dove il riferimento ne mette uno solo è il
 * genere di scorciatoia che si paga quando la catena si allunga — lo abbiamo
 * appena visto con Technician, che legge la potenza a metà catena.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { MOD } from '../lib/modifiers.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

// Farigiraf è Normale/Psico: una mossa Buio gli è superefficace, quindi la
// Baccacolbur si attiva. Crunch e non Knock Off, che porterebbe anche il
// proprio ×1.5 sullo strumento e confonderebbe la lettura.
const attaccante = (atkAbility) => ({
  atkPokemon: 'incineroar', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
  atkAbility, atkItem: null, level: 50,
})
const difensore = (defAbility, defItem) => ({
  defPokemon: 'farigiraf', defSPs: [32, 0, 16, 0, 16, 0], defNature: 'careful',
  defAbility, defItem, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const nostro = (atkAbility, defAbility, defItem, move = 'crunch') => calculateDamage({
  attacker: attaccante(atkAbility), defender: difensore(defAbility, defItem),
  move, field: {}, debug: false,
})

describe('la costante di Ripen è quella del riferimento', () => {
  it('è 0x400, e non due volte 0x800', () => {
    expect(MOD.X0_25).toBe(0x400)
    expect(MOD.X0_25).toBe(MOD.X0_5 / 2)
  })
})

describe('la bacca, e chi la spegne', () => {
  it('senza abilità la bacca dimezza', () => {
    expect(nostro(null, null, 'colbur berry').maxDmg)
      .toBeLessThan(nostro(null, null, null).maxDmg)
  })

  for (const abilita of ['unnerve', 'as-one']) {
    it(`${abilita} su chi attacca: la bacca non si attiva`, () => {
      // Il danno torna quello di un difensore senza bacca.
      expect(nostro(abilita, null, 'colbur berry').rolls)
        .toEqual(nostro(abilita, null, null).rolls)
    })

    it(`${abilita} non tocca niente se la bacca non c'è`, () => {
      // Controllo negativo: l'abilità spegne la bacca, non fa danno da sola.
      expect(nostro(abilita, null, null).rolls).toEqual(nostro(null, null, null).rolls)
    })
  }

  it('Ripen sul difensore: la bacca vale il doppio', () => {
    const conRipen = nostro(null, 'ripen', 'colbur berry')
    const senza    = nostro(null, null,    'colbur berry')
    expect(conRipen.maxDmg).toBeLessThan(senza.maxDmg)
  })

  it('Ripen senza bacca non fa niente', () => {
    expect(nostro(null, 'ripen', null).rolls).toEqual(nostro(null, null, null).rolls)
  })

  it('e la bacca resta legata al TIPO della mossa', () => {
    // La Baccacolbur para il Buio. Su una mossa Psico non c'entra niente, e
    // nemmeno Ripen deve farla comparire.
    expect(nostro(null, 'ripen', 'colbur berry', 'zen headbutt').rolls)
      .toEqual(nostro(null, null, null, 'zen headbutt').rolls)
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

  const casi = [
    ['bacca sola',                      null,      null,    'colbur berry', 'crunch'],
    ['niente bacca',                    null,      null,    null,           'crunch'],
    ['Unnerve spegne la bacca',         'unnerve', null,    'colbur berry', 'crunch'],
    ['As One spegne la bacca',          'as-one',  null,    'colbur berry', 'crunch'],
    ['Ripen la raddoppia',              null,      'ripen', 'colbur berry', 'crunch'],
    ['Ripen su una mossa di altro tipo', null,     'ripen', 'colbur berry', 'zen headbutt'],
    ['Unnerve senza bacca',             'unnerve', null,    null,           'crunch'],
  ]

  for (const [nome, atkAbility, defAbility, defItem, move] of casi) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({
        attacker: attaccante(atkAbility), defender: difensore(defAbility, defItem),
        move, field: {},
      })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(atkAbility, defAbility, defItem, move).rolls,
        `${nome}: divergiamo dal riferimento`).toEqual(rif.rolls)
    })
  }
})
