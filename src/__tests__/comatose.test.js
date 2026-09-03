// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/comatose.test.js
 *
 * Komala, unica portatrice. Non è un moltiplicatore: è una condizione che
 * altre tre righe leggono al posto dello stato vero.
 *
 *   `damage_MASTER.js:1163`  Dream Eater arriva, invece di fallire
 *   `:1417`                  Wake-Up Slap raddoppia
 *   `:1407`                  Hex e Infernal Parade raddoppiano
 *
 * ─── DUE CONDIZIONI DIVERSE, NON UNA ───────────────────────────────────────
 *
 * Le prime due la trattano come «addormentata», la terza come «ha uno stato
 * qualunque». Sembra la stessa cosa e non lo è: Hex raddoppia su QUALUNQUE
 * stato, non solo sul sonno. Dedurre l'una dall'altra sbaglierebbe uno dei
 * tre casi, e infatti nel motore restano due predicati separati.
 *
 * ─── IL QUARTO PUNTO, CHE NON CI RIGUARDA ──────────────────────────────────
 *
 * `:2481`, dentro `canBeBurned`, la elenca fra le abilità che non si possono
 * bruciare. Serve al danno aggiuntivo di Spicy Spray, che non modelliamo.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { buildField } from '../lib/battleState.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]
const att = (atkPokemon, atkAbility = null) => ({
  atkPokemon, atkSPs: SP, atkNature: null, atkAbility, atkItem: null, level: 50,
  atkAbilityFlags: {}, atkStatus: null,
})
const dif = (defPokemon, defAbility = null, defStatus = null) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {}, defStatus,
})
const campo = () => buildField({ doubleTarget: true }, 't1')
const calcola = (attacker, defender, move) =>
  calculateDamage({ attacker, defender, move, field: campo(), debug: false })

describe('i presupposti', () => {
  it('Komala ce l\'ha, ed è l\'unica', () => {
    expect(pokemonData['komala'].abilities).toContain('comatose')
    const tutte = Object.keys(pokemonData)
      .filter(k => (pokemonData[k].abilities ?? []).includes('comatose'))
    expect(tutte).toEqual(['komala'])
  })

  it('la voce dichiara l\'effetto', () => {
    expect(ABILITY_EFFECTS['comatose'].comatose).toBe(true)
  })
})

describe('vale come «addormentata»', () => {
  it('Dream Eater arriva, invece di fallire', () => {
    const con   = calcola(att('gengar'), dif('komala', 'comatose'), 'dream eater')
    const senza = calcola(att('gengar'), dif('komala', null),       'dream eater')

    expect(senza.immune, 'senza Comatose Dream Eater deve fallire').toBe(true)
    expect(senza.reason).toBe('move')
    expect(con.immune ?? false, 'con Comatose deve arrivare').toBe(false)
    expect(con.maxDmg).toBeGreaterThan(0)
  })

  it('Wake-Up Slap raddoppia', () => {
    const con   = calcola(att('machamp'), dif('komala', 'comatose'), 'wake-up slap')
    const senza = calcola(att('machamp'), dif('komala', null),       'wake-up slap')
    expect(con.maxDmg / senza.maxDmg).toBeGreaterThan(1.9)
  })
})

describe('e come «ha uno stato», che non è la stessa condizione', () => {
  /**
   * ─── PERCHÉ L'ATTACCANTE È DELCATTY, E NON UN GHOST ──────────────────────
   *
   * Hex e Infernal Parade sono le due sole mosse che raddoppiano su uno stato
   * qualunque, e sono tutt'e due di tipo Ghost. Komala è Normale, e l'unica
   * specie con Comatose. Ghost contro Normale è zero: il caso ovvio esce
   * immune in tutt'e due i versi e non prova niente.
   *
   * Con Normalize la mossa diventa Normale e arriva — e resta Hex per NOME,
   * che è ciò che il riferimento guarda. Non è un trucco: è una combinazione
   * che si può giocare, e l'unica che rende visibile questa metà di Comatose.
   */
  it('Hex raddoppia, e serve Normalize per poterlo vedere', () => {
    const con   = calcola(att('delcatty', 'normalize'), dif('komala', 'comatose'), 'hex')
    const senza = calcola(att('delcatty', 'normalize'), dif('komala', null),       'hex')

    expect(senza.maxDmg, 'senza Normalize il caso sarebbe immune, non muto')
      .toBeGreaterThan(0)
    expect(con.maxDmg / senza.maxDmg).toBeGreaterThan(1.9)
  })

  it('ma NON accende ciò che vuole un veleno o una paralisi', () => {
    // Venoshock chiede l'avvelenamento e Smelling Salts la paralisi: Comatose
    // non li sostituisce. È il controllo che distingue «dorme» da «ha uno
    // stato qualunque» da «ha QUESTO stato».
    for (const mossa of ['venoshock', 'smelling salts']) {
      expect(calcola(att('gengar'), dif('komala', 'comatose'), mossa).rolls, mossa)
        .toEqual(calcola(att('gengar'), dif('komala', null), mossa).rolls)
    }
  })
})

describe('Mold Breaker la spegne, e non serve scriverlo', () => {
  it('con Mold Breaker Wake-Up Slap torna a potenza singola', () => {
    // Tutt'e tre le righe del riferimento leggono `defAbility`, cioè il valore
    // già sostituito con `[ignored]`, e Comatose non sta fra le non
    // ignorabili. Da noi `defAbilEffect` diventa null da sé.
    // Wake-Up Slap e non Hex: è di tipo Lotta e arriva su Komala senza
    // bisogno di Normalize.
    const conMold = calcola(att('excadrill', 'mold-breaker'), dif('komala', 'comatose'), 'wake-up slap')
    const senza   = calcola(att('excadrill', 'sand-rush'),    dif('komala', 'comatose'), 'wake-up slap')
    expect(conMold.maxDmg, 'Mold Breaker non sta spegnendo Comatose')
      .toBeLessThan(senza.maxDmg)
  })
})

describe('roll per roll contro NCP', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const CASI = [
    ['Dream Eater contro Comatose',  att('gengar'),  dif('komala', 'comatose'), 'dream eater'],
    ['Wake-Up Slap contro Comatose', att('machamp'), dif('komala', 'comatose'), 'wake-up slap'],
    ['Wake-Up Slap senza',           att('machamp'), dif('komala', null),       'wake-up slap'],
    ['Hex normalizzata contro Comatose', att('delcatty', 'normalize'), dif('komala', 'comatose'), 'hex'],
    ['Hex normalizzata senza',       att('delcatty', 'normalize'), dif('komala', null), 'hex'],
    ['Hex di tipo Ghost: immune comunque', att('gengar'), dif('komala', 'comatose'), 'hex'],
    ['Venoshock contro Comatose',    att('gengar'),  dif('komala', 'comatose'), 'venoshock'],
    ['Smelling Salts contro Comatose', att('gengar'), dif('komala', 'comatose'), 'smelling salts'],
    ['una mossa qualunque',          att('gengar'),  dif('komala', 'comatose'), 'shadow ball'],
    ['Wake-Up Slap con Mold Breaker', att('excadrill', 'mold-breaker'), dif('komala', 'comatose'), 'wake-up slap'],
  ]

  for (const [nome, attacker, defender, mossa] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const f = campo()
      const rif = harness.calcolaConPreparazione({ attacker, defender, move: mossa, field: f })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(
        calculateDamage({ attacker, defender, move: mossa, field: f, debug: false }).rolls,
        `${nome}: divergiamo dal riferimento`,
      ).toEqual(rif.rolls)
    })
  }
})
