// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/ferromascella.test.js
 *
 * Ferromascella (`strong-jaw`): ×1,5 sulle mosse di morso.
 *
 * ─── LA SECONDA DELLE SEI, NELLO STESSO `if` DELLA PRIMA ───────────────────
 *
 * `damage_MASTER.js:1668` raccoglie sei abilità in un solo ramo, le «1.5x
 * Abilities»: Technician, Flare Boost, Toxic Boost, Mega Launcher, Strong Jaw,
 * Steely Spirit. Megalancio è stata la prima a entrare, questa è la seconda, e
 * il moltiplicatore è letteralmente lo stesso `0x1800` nella stessa catena —
 * cambia solo la condizione.
 *
 * Delle quattro che restano, due non sono raggiungibili da noi: Flare Boost
 * vuole lo stato «bruciato» e Toxic Boost lo stato «avvelenato», e gli stati
 * non sono modellati (§1.12). Technician e Ingegno Acciaio sì.
 *
 * ─── LE MOSSE DI MORSO VENGONO DAL VENDOR ──────────────────────────────────
 *
 * Come per le mosse-impulso: il flag `bite` in moves.json lo scrive
 * `gen-flag-dati.mjs` copiando `isBite` dal vendor. Nessuna lista a mano nel
 * motore — se NCP smettesse di classificarle così, il flag sparirebbe con lei.
 *
 * ─── LO SNAPSHOT NON COPRE IL CASO ─────────────────────────────────────────
 *
 * Verificato: zero divergenze dopo la modifica. Nessuno degli undici Pokémon
 * con Ferromascella è nei 586 casi. Lo snapshot prova che non ho rotto il
 * resto.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const sharpedo = (atkAbility) => ({
  atkPokemon: 'sharpedo-mega', atkSPs: [0, 32, 0, 0, 0, 20], atkNature: 'adamant',
  atkAbility, atkItem: 'sharpedonite', level: 50,
})
const INCINEROAR = {
  defPokemon: 'incineroar', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}
const nostro = (atkAbility, move) => calculateDamage({
  attacker: sharpedo(atkAbility), defender: INCINEROAR, move, field: {}, debug: false,
})

describe('le mosse di morso vengono dal riferimento', () => {
  it('sono nove, e sono quelle', () => {
    const morsi = Object.entries(movesData).filter(([, v]) => v.bite).map(([k]) => k).sort()
    expect(morsi).toEqual([
      'bite', 'crunch', 'fire fang', 'hyper fang', 'ice fang', 'jaw lock',
      'poison fang', 'psychic fangs', 'thunder fang',
    ])
  })

  it('il flag sta nei dati, non nel motore', () => {
    const motore = fs.readFileSync(path.join(RADICE, 'src', 'calcEngine.js'), 'utf8')
    const nomi = ['crunch', 'psychic fangs', 'thunder fang', 'jaw lock']
    expect(nomi.filter(n => motore.includes(`'${n}'`)), 'elenco di mosse di morso nel motore')
      .toEqual([])
  })
})

describe('Ferromascella, contro il riferimento', () => {
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
    ['Crunch col bonus',            'strong-jaw', 'crunch'],
    ['Psychic Fangs col bonus',     'strong-jaw', 'psychic fangs'],
    ['Ice Fang col bonus',          'strong-jaw', 'ice fang'],
    // Controllo negativo contro l'oracolo: se il ramo si accendesse su tutto,
    // questo caso divergerebbe. Aqua Jet è fisica e a contatto come Crunch, ma
    // non è un morso.
    ['Aqua Jet, che morso non è',   'strong-jaw', 'aqua jet'],
    ['Crunch senza l\'abilità',     null,         'crunch'],
  ]) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({
        attacker: sharpedo(atkAbility), defender: INCINEROAR, move, field: {},
      })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(atkAbility, move).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})

describe('Ferromascella muove il numero, e solo sui morsi', () => {
  it('Crunch cresce di metà', () => {
    expect(nostro('strong-jaw', 'crunch').maxDmg)
      .toBeGreaterThan(nostro(null, 'crunch').maxDmg)
  })

  it('Aqua Jet no', () => {
    expect(nostro('strong-jaw', 'aqua jet').rolls).toEqual(nostro(null, 'aqua jet').rolls)
  })
})
