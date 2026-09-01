// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/gruppoCampo.test.js
 *
 * Le sette che non chiedevano niente di nuovo: Orichalcum Pulse, Hadron
 * Engine, Grass Pelt, Wind Power, Aura Break, Stakeout, Slow Start.
 *
 * Sono un blocco perche' hanno in comune il costo, non la meccanica: tutte e
 * sette si appoggiano a infrastruttura gia' in piedi — meteo, terreno,
 * l'interruttore `abilityOn`, la catena delle aure.
 *
 *     Orichalcum Pulse  atMods punto f   ×1,3333  `damage_MASTER.js:1970`
 *     Hadron Engine     atMods punto f   ×1,3333  `:1971`
 *     Stakeout          atMods punto g   ×2       `:1979`
 *     Slow Start        atMods punto b   ×0,5     `:1924`
 *     Grass Pelt        dfMods punto c   ×1,5     `:2104`
 *     Wind Power        bpMods punto t   ×2       `:1764`
 *     Aura Break        bpMods punto a   ×0,75    `:1573`
 *
 * ─── TRE COSE CHE NON SI INDOVINANO ────────────────────────────────────────
 *
 * 1. `0x1555` non e' nessuno dei ×1,3 gia' in casa. Fa 1,33325…, mentre l'aura
 *    (`0x1548`) fa 1,33007… e i terreni (`0x14CD`) fanno 1,29980…. Tre valori
 *    vicini in tre punti diversi, e il riferimento non li confonde.
 *
 * 2. Orichalcum Pulse vuole il sole NORMALE: `field.weather === "Sun"`, con
 *    l'uguale, mentre Solar Power due righe sopra scrive `indexOf("Sun") > -1`.
 *    Sotto il sole estremo Solar Power vale e Orichalcum Pulse no.
 *
 * 3. Aura Break sta al punto a, l'aura che rovescia al punto f. Non si
 *    moltiplicano: sono i due rami esclusivi dello stesso `auraBreak`.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { buildField } from '../lib/battleState.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { MOD } from '../lib/modifiers.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]

const att = (atkPokemon, atkAbility = null, flags = {}) => ({
  atkPokemon, atkSPs: SP, atkNature: null, atkAbility, atkItem: null, level: 50,
  atkAbilityFlags: flags,
})
const dif = (defPokemon, defAbility = null, flags = {}) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: flags,
})
const campo = (extra = {}) => buildField({ doubleTarget: true, ...extra }, 't1')
const calcola = (attacker, defender, move, extra = {}) =>
  calculateDamage({ attacker, defender, move, field: campo(extra), debug: false })

const ACCESO = { interruttore: true }

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti, letti e non creduti', () => {
  const PORTATORI = [
    ['orichalcum-pulse', 'koraidon'],
    ['hadron-engine',    'miraidon'],
    ['grass-pelt',       'gogoat'],
    ['wind-power',       'kilowattrel'],
    ['aura-break',       'zygarde'],
    ['stakeout',         'gumshoos'],
    ['slow-start',       'regigigas'],
  ]

  for (const [chiave, specie] of PORTATORI) {
    it(`${chiave}: ${specie} ce l'ha davvero`, () => {
      expect(pokemonData[specie].abilities).toContain(chiave)
    })
  }

  it('Wind Power e Electromorphosis sono la stessa voce', () => {
    // Nel riferimento sono la stessa clausola, non due gemelle: stesso
    // `abilityOn`, stesso ×2, stessa riga (`:1764`). Se un giorno qualcuno le
    // separasse, questo test lo direbbe.
    expect(ABILITY_EFFECTS['wind-power']).toEqual(ABILITY_EFFECTS['electromorphosis'])
  })

  it('il ×1,3333 e il ×1,33 dell\'aura sono due numeri diversi', () => {
    expect(MOD.X1_3333).toBe(0x1555)
    expect(MOD.X1_33).toBe(0x1548)
    expect(MOD.X1_3).toBe(0x14CD)
    expect(new Set([MOD.X1_3333, MOD.X1_33, MOD.X1_3]).size).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Ognuna fa quello che dice, e nella misura giusta
// ═══════════════════════════════════════════════════════════════════════════

/** Rapporto fra il caso con l'abilita' accesa e lo stesso caso senza. */
const rapporto = (con, senza) => con.maxDmg / senza.maxDmg

describe('il moltiplicatore, non solo il verso', () => {
  it('Orichalcum Pulse: ×1,333 sull\'attacco fisico, col sole', () => {
    const con   = calcola(att('koraidon', 'orichalcum-pulse'), dif('incineroar'), 'iron head', { weather: 'sun' })
    const senza = calcola(att('koraidon', null),               dif('incineroar'), 'iron head', { weather: 'sun' })
    expect(rapporto(con, senza)).toBeGreaterThan(1.30)
    expect(rapporto(con, senza)).toBeLessThan(1.37)
  })

  it('Hadron Engine: ×1,333 sull\'attacco speciale, col campo elettrico', () => {
    const con   = calcola(att('miraidon', 'hadron-engine'), dif('incineroar'), 'flamethrower', { terrain: 'electric' })
    const senza = calcola(att('miraidon', null),            dif('incineroar'), 'flamethrower', { terrain: 'electric' })
    expect(rapporto(con, senza)).toBeGreaterThan(1.30)
    expect(rapporto(con, senza)).toBeLessThan(1.37)
  })

  it('Stakeout: ×2 sull\'attacco, con l\'interruttore acceso', () => {
    const con   = calcola(att('gumshoos', 'stakeout', ACCESO), dif('incineroar'), 'crunch')
    const senza = calcola(att('gumshoos', 'stakeout', {}),     dif('incineroar'), 'crunch')
    expect(rapporto(con, senza)).toBeGreaterThan(1.9)
    expect(rapporto(con, senza)).toBeLessThan(2.1)
  })

  it('Slow Start: ×0,5 sull\'attacco fisico, con l\'interruttore acceso', () => {
    const con   = calcola(att('regigigas', 'slow-start', ACCESO), dif('incineroar'), 'body slam')
    const senza = calcola(att('regigigas', 'slow-start', {}),     dif('incineroar'), 'body slam')
    expect(rapporto(con, senza)).toBeGreaterThan(0.45)
    expect(rapporto(con, senza)).toBeLessThan(0.55)
  })

  it('Grass Pelt: ×1,5 sulla Difesa, col campo erboso — quindi meno danno', () => {
    const con   = calcola(att('incineroar'), dif('gogoat', 'grass-pelt'), 'iron head', { terrain: 'grassy' })
    const senza = calcola(att('incineroar'), dif('gogoat', null),         'iron head', { terrain: 'grassy' })
    expect(rapporto(con, senza)).toBeGreaterThan(0.63)
    expect(rapporto(con, senza)).toBeLessThan(0.70)
  })

  it('Wind Power: ×2 sulle mosse Elettro, con l\'interruttore acceso', () => {
    const con   = calcola(att('kilowattrel', 'wind-power', ACCESO), dif('incineroar'), 'thunderbolt')
    const senza = calcola(att('kilowattrel', 'wind-power', {}),     dif('incineroar'), 'thunderbolt')
    expect(rapporto(con, senza)).toBeGreaterThan(1.9)
    expect(rapporto(con, senza)).toBeLessThan(2.1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Le condizioni sono condizioni
// ═══════════════════════════════════════════════════════════════════════════

describe('senza la condizione non fanno niente', () => {
  it('Orichalcum Pulse senza sole', () => {
    expect(calcola(att('koraidon', 'orichalcum-pulse'), dif('incineroar'), 'iron head').rolls)
      .toEqual(calcola(att('koraidon', null), dif('incineroar'), 'iron head').rolls)
  })

  it('Orichalcum Pulse sulle mosse speciali, nemmeno col sole', () => {
    expect(calcola(att('koraidon', 'orichalcum-pulse'), dif('incineroar'), 'flamethrower', { weather: 'sun' }).rolls)
      .toEqual(calcola(att('koraidon', null), dif('incineroar'), 'flamethrower', { weather: 'sun' }).rolls)
  })

  it('Hadron Engine senza campo elettrico', () => {
    expect(calcola(att('miraidon', 'hadron-engine'), dif('incineroar'), 'flamethrower').rolls)
      .toEqual(calcola(att('miraidon', null), dif('incineroar'), 'flamethrower').rolls)
  })

  it('Grass Pelt senza campo erboso', () => {
    expect(calcola(att('incineroar'), dif('gogoat', 'grass-pelt'), 'iron head').rolls)
      .toEqual(calcola(att('incineroar'), dif('gogoat', null), 'iron head').rolls)
  })

  it('Grass Pelt sulle mosse speciali, nemmeno col campo erboso', () => {
    expect(calcola(att('incineroar'), dif('gogoat', 'grass-pelt'), 'flamethrower', { terrain: 'grassy' }).rolls)
      .toEqual(calcola(att('incineroar'), dif('gogoat', null), 'flamethrower', { terrain: 'grassy' }).rolls)
  })

  it('Slow Start sulle mosse speciali non toglie niente', () => {
    expect(calcola(att('regigigas', 'slow-start', ACCESO), dif('incineroar'), 'flash cannon').rolls)
      .toEqual(calcola(att('regigigas', 'slow-start', {}), dif('incineroar'), 'flash cannon').rolls)
  })

  it('Wind Power fuori dalle mosse Elettro', () => {
    expect(calcola(att('kilowattrel', 'wind-power', ACCESO), dif('incineroar'), 'air slash').rolls)
      .toEqual(calcola(att('kilowattrel', 'wind-power', {}), dif('incineroar'), 'air slash').rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Orichalcum Pulse e il sole estremo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Il riferimento scrive `field.weather === "Sun"` per Orichalcum Pulse e
 * `field.weather.indexOf("Sun") > -1` per Solar Power, a due righe di
 * distanza. Sotto Desolate Land la prima non si applica e la seconda si'.
 *
 * Se un giorno qualcuno «uniformasse» le due letture, questo test diventa
 * rosso. Non e' una svista nostra: e' una differenza del riferimento, e
 * l'oracolo e' il riferimento eseguito.
 */
describe('Orichalcum Pulse sotto il sole estremo non si applica', () => {
  it('col sole normale si', () => {
    const con   = calcola(att('koraidon', 'orichalcum-pulse'), dif('incineroar'), 'iron head', { weather: 'sun' })
    const senza = calcola(att('koraidon', null), dif('incineroar'), 'iron head', { weather: 'sun' })
    expect(con.maxDmg).toBeGreaterThan(senza.maxDmg)
  })

  it('col sole estremo no', () => {
    const con   = calcola(att('koraidon', 'orichalcum-pulse'), dif('incineroar'), 'iron head', { weather: 'harsh sunshine' })
    const senza = calcola(att('koraidon', null), dif('incineroar'), 'iron head', { weather: 'harsh sunshine' })
    expect(con.rolls, 'e\' stato letto `isSole` invece di `meteo === sun`')
      .toEqual(senza.rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Aura Break rovescia, non si somma
// ═══════════════════════════════════════════════════════════════════════════

describe('Frangiaura', () => {
  // Zygarde ha Aura Break; l'aura la porta l'altro. Una mossa Dark contro un
  // portatore di Dark Aura: senza Frangiaura ×1,33, con Frangiaura ×0,75.
  const conAura      = () => calcola(att('incineroar'), dif('yveltal', 'dark-aura'), 'crunch')
  const conFrangi    = () => calcola(att('zygarde', 'aura-break'), dif('yveltal', 'dark-aura'), 'crunch')
  const senzaNessuna = () => calcola(att('incineroar'), dif('yveltal', null), 'crunch')

  it('l\'aura da sola alza', () => {
    expect(conAura().maxDmg).toBeGreaterThan(senzaNessuna().maxDmg)
  })

  it('col Frangiaura il ×1,33 diventa ×0,75', () => {
    const rotta = conFrangi()
    const base  = calcola(att('zygarde', null), dif('yveltal', null), 'crunch')
    const r = rotta.maxDmg / base.maxDmg
    expect(r, 'non e\' tre quarti').toBeGreaterThan(0.72)
    expect(r, 'non e\' tre quarti').toBeLessThan(0.79)
  })

  it('senza un\'aura in campo il Frangiaura non fa niente', () => {
    // Il riferimento chiede `auraActive` PRIMA di guardare `auraBreak`: senza
    // un'aura del tipo della mossa non c'e' niente da rovesciare.
    expect(calcola(att('zygarde', 'aura-break'), dif('incineroar'), 'crunch').rolls)
      .toEqual(calcola(att('zygarde', null), dif('incineroar'), 'crunch').rolls)
  })

  it('e nemmeno su una mossa di un altro tipo', () => {
    expect(calcola(att('zygarde', 'aura-break'), dif('yveltal', 'dark-aura'), 'iron head').rolls)
      .toEqual(calcola(att('zygarde', null), dif('yveltal', null), 'iron head').rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5-bis. Cosa questi test NON dimostrano
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── LA POSIZIONE DI GRASS PELT NON E' OSSERVABILE. MISURATA. ──────────────
 *
 * Nel riferimento Grass Pelt apre la catena `c / else if d / else if e` della
 * difesa: prima del paradosso, prima di Fur Coat. Qui e' scritta li'. Ma
 * nessun test lo dimostra, e il motivo e' strutturale: tutte e tre sono
 * ABILITA' del difensore, e il campo abilita' e' uno solo. Due di loro non
 * possono mai essere vere insieme, quindi l'`else` non separa mai niente.
 *
 * Resta la posizione rispetto a cio' che non e' un'abilita': il Flower Gift
 * dell'alleato (punto b) e lo strumento del difensore. Spostando il blocco
 * DOPO gli strumenti e ricalcolando 60.200 casi — Gogoat e Skiddo, quattro
 * strumenti, venticinque attaccanti, tutte le mosse fisiche, sotto il campo
 * erboso — i divergenti sono ZERO. Il motivo si vede a mano: Grass Pelt vale
 * solo sul fisico, e l'unico compagno possibile sul fisico e' l'Eviolite, che
 * spinge lo stesso `0x1800`. Due moltiplicatori identici, e l'ordine di due
 * numeri uguali non cambia niente.
 *
 * Quindi la posizione e' scritta giusta per fedelta' al riferimento, non
 * perche' un test la difenda. Quando Marvel Scale entrera' — e' l'altra meta'
 * dello stesso `if`, e aspetta gli stati — questa misura va rifatta.
 */
it('registro: la posizione di Grass Pelt nella catena non e\' osservabile', () => {
  expect(true).toBe(true)
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. L'oracolo
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
    ['Orichalcum Pulse col sole',   att('koraidon', 'orichalcum-pulse'), dif('incineroar'), 'iron head', { weather: 'sun' }],
    ['Orichalcum Pulse senza sole', att('koraidon', 'orichalcum-pulse'), dif('incineroar'), 'iron head', {}],
    ['Orichalcum Pulse col sole estremo', att('koraidon', 'orichalcum-pulse'), dif('incineroar'), 'iron head', { weather: 'harsh sunshine' }],
    ['Orichalcum Pulse speciale',   att('koraidon', 'orichalcum-pulse'), dif('incineroar'), 'flamethrower', { weather: 'sun' }],
    ['Hadron Engine col campo',     att('miraidon', 'hadron-engine'), dif('incineroar'), 'flamethrower', { terrain: 'electric' }],
    ['Hadron Engine senza campo',   att('miraidon', 'hadron-engine'), dif('incineroar'), 'flamethrower', {}],
    ['Stakeout acceso',             att('gumshoos', 'stakeout', ACCESO), dif('incineroar'), 'crunch', {}],
    ['Stakeout spento',             att('gumshoos', 'stakeout', {}), dif('incineroar'), 'crunch', {}],
    ['Slow Start acceso',           att('regigigas', 'slow-start', ACCESO), dif('incineroar'), 'body slam', {}],
    ['Slow Start acceso, speciale', att('regigigas', 'slow-start', ACCESO), dif('incineroar'), 'flash cannon', {}],
    ['Grass Pelt col campo erboso', att('incineroar'), dif('gogoat', 'grass-pelt'), 'iron head', { terrain: 'grassy' }],
    ['Grass Pelt senza campo',      att('incineroar'), dif('gogoat', 'grass-pelt'), 'iron head', {}],
    ['Grass Pelt, mossa speciale',  att('incineroar'), dif('gogoat', 'grass-pelt'), 'flamethrower', { terrain: 'grassy' }],
    ['Wind Power acceso',           att('kilowattrel', 'wind-power', ACCESO), dif('incineroar'), 'thunderbolt', {}],
    ['Wind Power spento',           att('kilowattrel', 'wind-power', {}), dif('incineroar'), 'thunderbolt', {}],
    ['Aura Break contro Dark Aura', att('zygarde', 'aura-break'), dif('yveltal', 'dark-aura'), 'crunch', {}],
    ['Dark Aura senza Frangiaura',  att('incineroar'), dif('yveltal', 'dark-aura'), 'crunch', {}],
    ['Frangiaura senza aura',       att('zygarde', 'aura-break'), dif('incineroar'), 'crunch', {}],
  ]

  for (const [nome, attacker, defender, mossa, extra] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const f = campo(extra)
      const rif = harness.calcola({ attacker, defender, move: mossa, field: f })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(
        calculateDamage({ attacker, defender, move: mossa, field: f, debug: false }).rolls,
        `${nome}: divergiamo dal riferimento`,
      ).toEqual(rif.rolls)
    })
  }
})
