// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/antisuono.test.js
 *
 * Antisuono (`soundproof`): le mosse sonore non hanno effetto.
 *
 * ─── È UN'IMMUNITÀ, NON UNA RIDUZIONE ──────────────────────────────────────
 *
 * Nel riferimento sta in `immunityChecks` (`damage_MASTER.js:1114`), accanto a
 * Sap Sipper e Bulletproof: la funzione esce con `damage: [0]`. Non è un
 * modificatore che porta il numero in basso, è un numero che non c'è.
 *
 * Da noi finisce quindi nel blocco delle immunità insieme a Levitate, prima
 * che la formula cominci — e non fra i modificatori, dove sarebbe stata la
 * scelta comoda e sbagliata.
 *
 * ─── PERCHÉ ADESSO ─────────────────────────────────────────────────────────
 *
 * Kommo-o «Clangorous Soul Sweeper», uno dei 64 set del meta. Contro una mossa
 * sonora l'app mostrava un danno pieno dove il vero è zero — l'errore nella
 * direzione peggiore, perché l'utente pianifica un KO che non succede.
 *
 * ─── LE MOSSE SONORE VENGONO DAL VENDOR ────────────────────────────────────
 *
 * Flag `sound` in moves.json, trascritto da `isSound` da `gen-flag-dati.mjs`
 * insieme a punch, bite, slicing, bullet e pulse. Nessuna lista nel motore.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const ATTACCANTE = {
  atkPokemon: 'kommo-o', atkSPs: [0, 0, 0, 32, 0, 20], atkNature: 'modest',
  atkAbility: null, atkItem: null, level: 50,
}
const difensore = (defAbility) => ({
  defPokemon: 'incineroar', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const nostro = (defAbility, move) => calculateDamage({
  attacker: ATTACCANTE, defender: difensore(defAbility), move, field: {}, debug: false,
})

describe('le mosse sonore vengono dal riferimento', () => {
  it('sono diciotto, e il flag sta nei dati', () => {
    const sonore = Object.entries(movesData).filter(([, v]) => v.sound).map(([k]) => k)
    expect(sonore.length).toBe(18)
    expect(sonore).toContain('clanging scales')
    expect(sonore).toContain('hyper voice')
    const motore = fs.readFileSync(path.join(RADICE, 'src', 'calcEngine.js'), 'utf8')
    expect(['clanging scales', 'hyper voice', 'boomburst'].filter(n => motore.includes(`'${n}'`)))
      .toEqual([])
  })
})

describe('Antisuono azzera il colpo', () => {
  it('una mossa sonora non passa', () => {
    const r = nostro('soundproof', 'clanging scales')
    expect(r.immune).toBe(true)
    expect(r.reason).toBe('ability')
    expect(r.rolls).toEqual([])
    expect(r.abilityName).toBe('Soundproof')
  })

  it('una mossa che sonora non è passa intera', () => {
    // Il ramo si accende sul FLAG, non sull'abilità: senza questo, un `return`
    // messo troppo in alto passerebbe il test qui sopra.
    const r = nostro('soundproof', 'dragon claw')
    expect(r.immune ?? false).toBe(false)
    expect(r.rolls).toEqual(nostro(null, 'dragon claw').rolls)
  })

  it('e senza l\'abilità la mossa sonora fa il suo danno', () => {
    expect(nostro(null, 'clanging scales').rolls.length).toBe(16)
  })
})

describe('Antisuono, contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  for (const [nome, defAbility, move, nullo] of [
    ['Squame Rumorose contro Antisuono', 'soundproof', 'clanging scales', true],
    ['Iper Voce contro Antisuono',       'soundproof', 'hyper voice',     true],
    ['Dragartigli contro Antisuono',     'soundproof', 'dragon claw',     false],
    ['Squame Rumorose senza abilità',    null,         'clanging scales', false],
  ]) {
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
