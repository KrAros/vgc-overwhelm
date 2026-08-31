// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/caselleAlleato.test.js
 *
 * Le cinque abilità che non appartengono a chi attacca né a chi subisce, ma al
 * compagno accanto.
 *
 * Nel riferimento infatti non hanno un nome: sono campi del terreno.
 *
 *   Battery         `field.isBattery`        ×1.3 sullo speciale   :1611
 *   Power Spot      `field.isPowerSpot`      ×1.3 su tutto         :1616
 *   Steely Spirit   `field.isSteelySpirit`   ×1.5 sull'Acciaio     :1621
 *   Friend Guard    `field.isFriendGuard`    ×0.75 al danno subito :2380
 *   Flower Gift     `field.isFlowerGiftAtk`  ×1.5 Attacco col sole :1935
 *                   `field.isFlowerGiftSpD`  ×1.5 Dif.Sp. col sole :2097
 *
 * ─── FLOWER GIFT: DUE CAMPI LÀ, UN INTERRUTTORE QUI ────────────────────────
 *
 * Il riferimento ne ha due perché la sua interfaccia ha due caselle. Ma dicono
 * la stessa cosa da due versi: l'alleato ce l'ha, quindi ti alza l'Attacco
 * quando attacchi e la Difesa Speciale quando difendi. Da noi la casella è una
 * e il verso lo decide `buildField`, che è il posto dove il progetto tiene già
 * questa distinzione per gli schermi e per l'Aiutone.
 *
 * ─── QUATTRO SU CINQUE NON HANNO UN ALLEATO LEGALE, E CI SONO LO STESSO ────
 *
 * In M-B solo Friend Guard può appartenere a un compagno vero: Vivillon e
 * Maushold. Le altre quattro le portano Charjabug, Stonjourner, Cherrim e
 * Perrserker, che nel dex di Champions non ci sono.
 *
 * Ci sono lo stesso, per decisione di Simone dopo che la misura è stata messa
 * sul tavolo: il motore le calcola tutte e cinque — sono righe adiacenti del
 * riferimento, e sceglierne una sarebbe stato decidere a mano quale metà vale
 * — e il giorno che il roster cresce funzionano senza toccare niente.
 *
 * L'ultimo blocco REGISTRA quali sono irraggiungibili oggi: se una di loro
 * diventa legale, diventa rosso e qualcuno viene a leggere qui invece di
 * scoprirlo da un numero.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { buildField } from '../lib/battleState.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }
import regSpecie from '../data/regChampionsSpecie.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]

const att = (atkPokemon, atkAbility = null, extra = {}) => ({
  atkPokemon, atkSPs: SP, atkNature: null,
  atkAbility, atkItem: null, level: 50, ...extra,
})
const dif = (defPokemon, defAbility = null, extra = {}) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {}, ...extra,
})
const calcola = (attacker, defender, move, field = {}) =>
  calculateDamage({ attacker, defender, move, field, debug: false })

/** Il campo come lo produce `buildField`, così i test non inventano una forma. */
const campo = (acceso = {}, atkSide = 't1') =>
  buildField({ doubleTarget: true, ...acceso }, atkSide)

// ═══════════════════════════════════════════════════════════════════════════
// 1. Ogni casella fa quello che deve, e solo quello
// ═══════════════════════════════════════════════════════════════════════════

describe('le tre che potenziano chi attacca', () => {
  it('Battery: ×1.3 sullo speciale, niente sul fisico', () => {
    const conSpec = calcola(att('kingambit'), dif('incineroar'), 'surf', campo({ battery: { t1: true } }))
    const senzaSpec = calcola(att('kingambit'), dif('incineroar'), 'surf', campo())
    expect(conSpec.maxDmg).toBeGreaterThan(senzaSpec.maxDmg)

    const conFis = calcola(att('kingambit'), dif('incineroar'), 'iron head', campo({ battery: { t1: true } }))
    const senzaFis = calcola(att('kingambit'), dif('incineroar'), 'iron head', campo())
    expect(conFis.rolls, 'Battery tocca anche il fisico').toEqual(senzaFis.rolls)
  })

  it('Power Spot: ×1.3 su tutto, senza guardare la categoria', () => {
    for (const mossa of ['surf', 'iron head']) {
      const con = calcola(att('kingambit'), dif('incineroar'), mossa, campo({ powerSpot: { t1: true } }))
      const senza = calcola(att('kingambit'), dif('incineroar'), mossa, campo())
      expect(con.maxDmg, `Power Spot non tocca ${mossa}`).toBeGreaterThan(senza.maxDmg)
    }
  })

  it('Steely Spirit dell\'alleato: ×1.5 solo sull\'Acciaio', () => {
    const conAcciaio = calcola(att('kingambit'), dif('incineroar'), 'iron head', campo({ steelySpirit: { t1: true } }))
    const senzaAcciaio = calcola(att('kingambit'), dif('incineroar'), 'iron head', campo())
    expect(conAcciaio.maxDmg).toBeGreaterThan(senzaAcciaio.maxDmg)

    const altroTipo = calcola(att('kingambit'), dif('incineroar'), 'knock off', campo({ steelySpirit: { t1: true } }))
    const altroSenza = calcola(att('kingambit'), dif('incineroar'), 'knock off', campo())
    expect(altroTipo.rolls).toEqual(altroSenza.rolls)
  })

  it('sono `if` indipendenti: due alleati si sommano', () => {
    // Nel riferimento d.i, d.ii e d.iii sono tre `if` separati, non una catena.
    // Un compagno con Power Spot e un altro con Battery si sommano davvero.
    const solo = calcola(att('kingambit'), dif('incineroar'), 'surf', campo({ battery: { t1: true } }))
    const due = calcola(att('kingambit'), dif('incineroar'), 'surf',
      campo({ battery: { t1: true }, powerSpot: { t1: true } }))
    expect(due.maxDmg, 'i due non si sommano: qualcuno li ha incatenati').toBeGreaterThan(solo.maxDmg)
  })
})

describe('Friend Guard protegge chi subisce', () => {
  it('×0.75 sul danno ricevuto', () => {
    // Sta dal lato del DIFENSORE: acceso su t2, e ad attaccare è t1.
    const con = calcola(att('kingambit'), dif('incineroar'), 'iron head', campo({ friendGuard: { t2: true } }))
    const senza = calcola(att('kingambit'), dif('incineroar'), 'iron head', campo())
    expect(con.maxDmg).toBeLessThan(senza.maxDmg)
  })

  it('acceso sul lato sbagliato non fa niente', () => {
    // È il controllo che distingue una casella «del difensore» da una «di
    // campo»: se `buildField` la leggesse dal lato dell'attaccante, questo
    // test passerebbe soltanto per sbaglio.
    const suDiMe = calcola(att('kingambit'), dif('incineroar'), 'iron head', campo({ friendGuard: { t1: true } }))
    const senza = calcola(att('kingambit'), dif('incineroar'), 'iron head', campo())
    expect(suDiMe.rolls).toEqual(senza.rolls)
  })

  it('Mold Breaker lo buca', () => {
    // Nel riferimento `abilityIgnore` accende `move.ignoresFriendGuard` anche
    // quando l'abilità del difensore non è ignorabile — quindi lo sfondamento
    // passa comunque.
    const conSfondatore = calcola(att('excadrill', 'mold-breaker'), dif('incineroar'), 'iron head',
      campo({ friendGuard: { t2: true } }))
    const senzaCasella = calcola(att('excadrill', 'mold-breaker'), dif('incineroar'), 'iron head', campo())
    expect(conSfondatore.rolls, 'Friend Guard resiste a Mold Breaker').toEqual(senzaCasella.rolls)
  })
})

describe('Flower Gift: una casella, due versi', () => {
  it('col sole alza l\'Attacco di chi ce l\'ha sul proprio lato', () => {
    const con = calcola(att('kingambit'), dif('incineroar'), 'iron head',
      campo({ flowerGift: { t1: true }, weather: 'sun' }))
    const senza = calcola(att('kingambit'), dif('incineroar'), 'iron head', campo({ weather: 'sun' }))
    expect(con.maxDmg).toBeGreaterThan(senza.maxDmg)
  })

  it('e la Difesa Speciale di chi ce l\'ha sul lato che subisce', () => {
    const con = calcola(att('kingambit'), dif('incineroar'), 'surf',
      campo({ flowerGift: { t2: true }, weather: 'sun' }))
    const senza = calcola(att('kingambit'), dif('incineroar'), 'surf', campo({ weather: 'sun' }))
    expect(con.maxDmg).toBeLessThan(senza.maxDmg)
  })

  it('senza sole non fa niente, da nessuno dei due versi', () => {
    for (const [lato, mossa] of [['t1', 'iron head'], ['t2', 'surf']]) {
      const con = calcola(att('kingambit'), dif('incineroar'), mossa, campo({ flowerGift: { [lato]: true } }))
      const senza = calcola(att('kingambit'), dif('incineroar'), mossa, campo())
      expect(con.rolls, `Flower Gift funziona senza sole su ${lato}`).toEqual(senza.rolls)
    }
  })

  it('l\'Utility Umbrella la spegne', () => {
    // Il riferimento controlla `attacker.item !== 'Utility Umbrella'` sul lato
    // che attacca e `defender.item` su quello che difende: sono due controlli
    // diversi, e uno solo dei due sarebbe metà trascrizione.
    const conOmbrello = calcola(
      att('kingambit', null, { atkItem: 'utility umbrella' }), dif('incineroar'), 'iron head',
      campo({ flowerGift: { t1: true }, weather: 'sun' }))
    const senzaCasella = calcola(
      att('kingambit', null, { atkItem: 'utility umbrella' }), dif('incineroar'), 'iron head',
      campo({ weather: 'sun' }))
    expect(conOmbrello.rolls).toEqual(senzaCasella.rolls)

    const difOmbrello = calcola(
      att('kingambit'), dif('incineroar', null, { defItem: 'utility umbrella' }), 'surf',
      campo({ flowerGift: { t2: true }, weather: 'sun' }))
    const difSenza = calcola(
      att('kingambit'), dif('incineroar', null, { defItem: 'utility umbrella' }), 'surf',
      campo({ weather: 'sun' }))
    expect(difOmbrello.rolls).toEqual(difSenza.rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Il confine: quali alleati esistono davvero
// ═══════════════════════════════════════════════════════════════════════════

describe('quattro su cinque non hanno un alleato legale in M-B', () => {
  const norm = s => String(s).toLowerCase().replace(/ /g, '-')
  const legali = new Set(regSpecie.specie['M-B'])
  const portatoriLegali = (chiave) => Object.entries(pokemonData)
    .filter(([k, v]) => legali.has(k) && (v.abilities ?? []).map(norm).includes(chiave))
    .map(([k]) => k)

  it('Friend Guard ce l\'ha un compagno vero', () => {
    expect(portatoriLegali('friend-guard').length,
      'nessun alleato legale porta più Friend Guard: la casella è diventata irraggiungibile')
      .toBeGreaterThan(0)
  })

  it('le altre quattro no — e quando lo saranno, questo test lo dirà', () => {
    const irraggiungibili = ['battery', 'power-spot', 'steely-spirit', 'flower-gift']
      .filter(c => portatoriLegali(c).length === 0)
    expect(irraggiungibili.sort(),
      'una di queste è diventata raggiungibile: toglila da qui e dalla nota in cima')
      .toEqual(['battery', 'flower-gift', 'power-spot', 'steely-spirit'])
  })

  it('ma le specie esistono in anagrafica, quindi l\'oracolo le sa calcolare', () => {
    for (const [chiave, specie] of [
      ['battery', 'charjabug'], ['power-spot', 'stonjourner'],
      ['flower-gift', 'cherrim'], ['steely-spirit', 'perrserker'],
    ]) {
      expect((pokemonData[specie]?.abilities ?? []).map(norm), `${specie}`).toContain(chiave)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. L'oracolo
// ═══════════════════════════════════════════════════════════════════════════

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
    ['Battery sullo speciale',  'surf',       campo({ battery: { t1: true } })],
    ['Battery sul fisico',      'iron head',  campo({ battery: { t1: true } })],
    ['Power Spot',              'surf',       campo({ powerSpot: { t1: true } })],
    ['Power Spot sul fisico',   'iron head',  campo({ powerSpot: { t1: true } })],
    ['Steely Spirit alleato',   'iron head',  campo({ steelySpirit: { t1: true } })],
    ['Steely Spirit, altro tipo', 'knock off', campo({ steelySpirit: { t1: true } })],
    ['Battery e Power Spot insieme', 'surf',  campo({ battery: { t1: true }, powerSpot: { t1: true } })],
    ['Friend Guard',            'iron head',  campo({ friendGuard: { t2: true } })],
    ['Flower Gift in attacco',  'iron head',  campo({ flowerGift: { t1: true }, weather: 'sun' })],
    ['Flower Gift in difesa',   'surf',       campo({ flowerGift: { t2: true }, weather: 'sun' })],
    ['Flower Gift senza sole',  'iron head',  campo({ flowerGift: { t1: true } })],
    ['nessuna casella',         'iron head',  campo()],
  ]

  for (const [nome, mossa, f] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const attacker = att('kingambit')
      const defender = dif('incineroar')
      const rif = harness.calcola({ attacker, defender, move: mossa, field: f })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(calcola(attacker, defender, mossa, f).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})
