// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/potenzaDaiPuntiSalute.test.js
 *
 * Le otto mosse la cui POTENZA viene dai punti salute — punto c di
 * `basePowerFunc` (`damage_MASTER.js:1350-1373`).
 *
 *   Eruption, Water Spout, Dragon Energy   150 scalato sulla vita di CHI TIRA
 *   Flail, Reversal                        sei gradini su 48 volte la vita
 *   Crush Grip, Wring Out, Hard Press      la vita di CHI SUBISCE
 *
 * Tre famiglie, tre formule, e due leggono chi tira mentre la terza legge chi
 * subisce: è la ragione per cui sono tre strutture e non una.
 *
 * ─── TRE DI QUESTE NON ERANO NEL DIVARIO ───────────────────────────────────
 *
 * Eruption, Water Spout e Dragon Energy hanno `power: 150` nei dati: il motore
 * quel 150 lo usava sempre e mostrava un numero senza avvisi. È l'assunzione
 * che `CONTRIBUTING.md` dichiara da sessioni — «il Pokémon è integro» — e
 * finché i punti salute non c'erano era vera per costruzione: nessun caso
 * poteva contraddirla.
 *
 * Adesso può. Un Torkoal a metà vita tira un Eruption da 75.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }
import {
  potenzaDaPsAttaccante, potenzaFlail, potenzaDaPsBersaglio,
  haPotenzaDaiPuntiSalute, MOSSE_POTENZA_PS_BERSAGLIO,
} from '../lib/rules.js'
import { mossaNonCalcolata } from '../lib/gap.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = (specie, extra = {}) => ({
  atkPokemon: specie, atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
  atkAbility: null, atkItem: null, level: 50, atkAbilityFlags: {}, ...extra,
})
const dif = (specie = 'blissey', extra = {}) => ({
  defPokemon: specie, defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const bp = (a, d, move) => calculateDamage({ attacker: a, defender: d, move, field: {} }).effectiveBP

// ═══════════════════════════════════════════════════════════════════════════
// 1. Le tre formule
// ═══════════════════════════════════════════════════════════════════════════

describe('Eruption e famiglia: 150 scalato, col pavimento a 1', () => {
  it('a vita piena vale 150, a metà 75', () => {
    expect(potenzaDaPsAttaccante(100, 100)).toBe(150)
    expect(potenzaDaPsAttaccante(50, 100)).toBe(75)
  })

  it('e non scende sotto 1', () => {
    // `Math.max(1, ...)`: senza, con un punto salute su 200 la potenza
    // sarebbe zero e la mossa non farebbe niente.
    expect(potenzaDaPsAttaccante(1, 200)).toBe(1)
    expect(Math.floor(150 * 1 / 200)).toBe(0)
  })
})

describe('Flail e Reversal: sei gradini su un quarantottesimo', () => {
  it('più sei ferito, più fa male — al contrario di tutte le altre', () => {
    expect(potenzaFlail(100, 100)).toBe(20)
    expect(potenzaFlail(1, 100)).toBe(200)
  })

  it('i sei gradini sono quelli del riferimento', () => {
    // `p = floor(48 * vita)`, e le soglie sono 1, 4, 9, 16, 32.
    const p = (n) => potenzaFlail(n, 48)   // così `p` è esattamente `n`
    expect(p(1)).toBe(200)
    expect(p(4)).toBe(150)
    expect(p(9)).toBe(100)
    expect(p(16)).toBe(80)
    expect(p(32)).toBe(40)
    expect(p(48)).toBe(20)
  })

  it('la scala è su 48, non su 100', () => {
    // Il caso che distingue le due. A metà vita `p` è 24, che cade nel gradino
    // dei 40. Una scala in percentuale metterebbe la stessa vita altrove.
    expect(potenzaFlail(50, 100)).toBe(40)
    expect(Math.floor(48 * 50 / 100)).toBe(24)
  })
})

describe('Crush Grip e famiglia: la vita di CHI SUBISCE, in virgola fissa', () => {
  it('a vita piena valgono la loro base', () => {
    expect(potenzaDaPsBersaglio(100, 100, 120)).toBe(120)
    expect(potenzaDaPsBersaglio(100, 100, 100)).toBe(100)
  })

  it('e Hard Press ha una base diversa dalle altre due', () => {
    expect(MOSSE_POTENZA_PS_BERSAGLIO).toEqual({
      'crush grip': 120, 'wring out': 120, 'hard press': 100,
    })
  })

  it('la virgola fissa non è un arrotondamento qualunque', () => {
    // Il riferimento passa per `floor(vita * 4096 / max)` e poi per il
    // `pokeRound` del gioco. Riscritta come `Math.round(120 * vita / max)`
    // darebbe quasi sempre lo stesso numero e ogni tanto no — il modo peggiore
    // di sbagliare. Questo caso è uno di quelli in cui i due divergono.
    const psMax = 175, ps = 58
    expect(potenzaDaPsBersaglio(ps, psMax, 120)).not.toBe(Math.round(120 * ps / psMax))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Nel motore, e il lato giusto
// ═══════════════════════════════════════════════════════════════════════════

describe('il motore le calcola, e guarda il lato giusto', () => {
  it('le cinque col badge adesso entrano, e il badge se n\'è andato', () => {
    for (const m of ['flail', 'reversal', 'crush grip', 'wring out', 'hard press']) {
      expect(movesData[m].power, `${m} ha una potenza nei dati`).toBe(0)
      expect(calculateDamage({ attacker: att('garchomp'), defender: dif(), move: m, field: {} }),
        `${m} esce null`).not.toBeNull()
      expect(mossaNonCalcolata(m), `${m} porta ancora il badge`).toBe(false)
    }
  })

  it('Eruption scala sui punti salute di CHI TIRA', () => {
    expect(bp(att('torkoal'), dif(), 'eruption')).toBe(150)
    const psMax = calculateDamage({ attacker: att('blissey'), defender: dif('torkoal'), move: 'seismic toss', field: {} }).defHP
    expect(bp(att('torkoal', { atkPS: Math.floor(psMax / 2) }), dif(), 'eruption'))
      .toBeLessThan(150)
  })

  it('e NON su quelli di chi subisce', () => {
    // Il controllo che si muove: senza, un motore che legge il lato sbagliato
    // passerebbe il caso a vita piena.
    expect(bp(att('torkoal'), dif('blissey', { defPS: 1 }), 'eruption')).toBe(150)
  })

  it('Crush Grip fa l\'opposto: legge chi subisce', () => {
    expect(bp(att('garchomp'), dif('blissey', { defPS: 1 }), 'crush grip')).toBeLessThan(120)
    expect(bp(att('garchomp', { atkPS: 1 }), dif('blissey'), 'crush grip')).toBe(120)
  })

  it('Flail cresce quando chi tira sta male', () => {
    expect(bp(att('garchomp'), dif(), 'flail')).toBe(20)
    expect(bp(att('garchomp', { atkPS: 1 }), dif(), 'flail')).toBe(200)
  })

  it('e a vita piena Eruption vale ancora 150 — l\'assunzione di prima', () => {
    // Il motivo per cui lo snapshot non si muove: finché nessuno manda i punti
    // salute, la formula nuova dà il numero vecchio.
    expect(bp(att('torkoal'), dif(), 'eruption')).toBe(movesData['eruption'].power)
  })

  it('una mossa qualunque non ci finisce dentro', () => {
    expect(haPotenzaDaiPuntiSalute('earthquake')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Contro l'oracolo
// ═══════════════════════════════════════════════════════════════════════════

describe('contro il riferimento eseguito', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    harness = (await import('../../scripts/ncp/harness.mjs')).creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const CASI = [
    ['Eruption a vita piena',      'eruption',      att('torkoal'), dif('blissey'), {}],
    ['Eruption a un punto',        'eruption',      att('torkoal', { atkPS: 1 }), dif('blissey'), {}],
    ['Eruption a metà',            'eruption',      att('torkoal', { atkPS: 80 }), dif('blissey'), {}],
    ['Water Spout ferito',         'water spout',   att('torkoal', { atkPS: 40 }), dif('blissey'), {}],
    ['Dragon Energy ferito',       'dragon energy', att('garchomp', { atkPS: 40 }), dif('blissey'), {}],
    ['Flail a vita piena',         'flail',         att('garchomp'), dif('blissey'), {}],
    ['Flail a un punto',           'flail',         att('garchomp', { atkPS: 1 }), dif('blissey'), {}],
    ['Flail sul gradino di mezzo', 'flail',         att('garchomp', { atkPS: 60 }), dif('blissey'), {}],
    ['Reversal ferito',            'reversal',      att('garchomp', { atkPS: 20 }), dif('blissey'), {}],
    ['Crush Grip a vita piena',    'crush grip',    att('garchomp'), dif('blissey'), {}],
    ['Crush Grip sul bersaglio ferito', 'crush grip', att('garchomp'), dif('blissey', { defPS: 58 }), {}],
    ['Wring Out sul bersaglio ferito', 'wring out', att('garchomp'), dif('blissey', { defPS: 58 }), {}],
    ['Hard Press sul bersaglio ferito', 'hard press', att('garchomp'), dif('blissey', { defPS: 58 }), {}],
    ['Hard Press a vita piena',    'hard press',    att('garchomp'), dif('blissey'), {}],
    ['Eruption su uno Skarmory — resiste', 'eruption', att('torkoal', { atkPS: 1 }), dif('skarmory'), {}],
    ['Terremoto — il controllo negativo', 'earthquake', att('garchomp', { atkPS: 1 }), dif('blissey'), {}],
  ]

  for (const [nome, move, a, d, field] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker: a, defender: d, move, field })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      const r = calculateDamage({ attacker: a, defender: d, move, field })
      if (rif.nullo) {
        expect(r.immune ? 0 : r.maxDmg, `${nome}: il riferimento dice zero`).toBe(0)
        return
      }
      expect(r.immune ? [] : r.rolls).toEqual(rif.rolls)
    })
  }

  it.runIf(vendorPresente)('e l\'oracolo scala davvero sui punti salute', () => {
    // Il controllo che rende vere le righe qui sopra.
    const max = (ps) => harness.calcola({
      attacker: att('torkoal', ps === null ? {} : { atkPS: ps }),
      defender: dif('blissey'), move: 'eruption', field: {},
    }).rolls.at(-1)
    expect(max(1)).not.toBe(max(null))
  })
})
