// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/stato.test.js
 *
 * Lo stato del Pokémon: undici cose che ne dipendono.
 *
 *   la bruciatura dimezza il danno fisico      `damage_MASTER.js:2255`
 *   la paralisi dimezza la Velocità            `:351`
 *   Quick Feet     ×1,5 Velocità, ogni stato   `:324`
 *   Guts           ×1,5 attacco fisico         `:1941`
 *   Flare Boost    ×1,5 potenza speciale       `:1670`
 *   Toxic Boost    ×1,5 potenza fisica         `:1671`
 *   Marvel Scale   ×1,5 Difesa                 `:2103`
 *   Facade         ×2 potenza base             `:1770`
 *   Hex            ×2 potenza base             `:1407`
 *   Smelling Salts ×2 potenza base             `:1412`
 *   Wake-Up Slap   ×2 potenza base             `:1417`
 *   Venoshock      ×2 potenza base             `:1772`
 *   Dream Eater    danno zero se non dorme     `:1163`
 *
 * ─── GLI STATI SONO SEI, E CONGELATO NON C'È ───────────────────────────────
 *
 * La stringa `Frozen` non compare in tutto `vendor/ncp/`. Offrirlo nel menù
 * sarebbe offrire una scelta che non cambia nessun numero.
 *
 * ─── DUE TRAPPOLE, UNA PER PARTE DELLA CATENA ──────────────────────────────
 *
 * La bruciatura NON è un modificatore finale: è un `Math.floor(damage / 2)`
 * nudo, fra l'efficacia di tipo (punto g) e la catena finale (punto i). È lo
 * stesso genere di errore del quarto di Protect, dall'altro lato.
 *
 * La paralisi NON è un moltiplicatore di velocità: è un passaggio a sé DOPO
 * il `pokeRound` di tutti gli altri, e tronca. Scriverla come `×0.5` darebbe
 * un numero diverso su ogni Velocità dispari.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { buildField } from '../lib/battleState.js'
import { calcEffectiveSpe } from '../utils/speedOrder.js'
import { STATI } from '../lib/rules.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]

const att = (atkPokemon, atkAbility, atkStatus = null) => ({
  atkPokemon, atkSPs: SP, atkNature: null, atkAbility, atkItem: null, level: 50,
  atkAbilityFlags: {}, atkStatus,
})
const dif = (defPokemon, defAbility = null, defStatus = null) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {}, defStatus,
})
const campo = () => buildField({ doubleTarget: true }, 't1')
const calcola = (attacker, defender, move) =>
  calculateDamage({ attacker, defender, move, field: campo(), debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti', () => {
  it('gli stati sono sei, e congelato non c\'è', () => {
    expect(STATI).toEqual(
      ['healthy', 'burned', 'paralyzed', 'poisoned', 'badly-poisoned', 'asleep'])
  })

  it.runIf(vendorPresente)('«Frozen» non compare in tutto il vendor', () => {
    // Il presupposto della scelta, verificato invece che ricordato. Se un
    // aggiornamento del riferimento lo reintroducesse, questo lo direbbe.
    const dir = path.join(RADICE, 'vendor', 'ncp')
    const conFrozen = fs.readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .filter(f => fs.readFileSync(path.join(dir, f), 'utf8').includes('Frozen'))
    expect(conFrozen).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. La bruciatura
// ═══════════════════════════════════════════════════════════════════════════

describe('la bruciatura', () => {
  it('dimezza il danno fisico', () => {
    const bruciato = calcola(att('garchomp', null, 'burned'), dif('incineroar'), 'earthquake')
    const sano     = calcola(att('garchomp', null, null),     dif('incineroar'), 'earthquake')
    const r = bruciato.maxDmg / sano.maxDmg
    expect(r).toBeGreaterThan(0.48)
    expect(r).toBeLessThan(0.52)
  })

  it('non tocca le mosse speciali', () => {
    expect(calcola(att('garchomp', null, 'burned'), dif('incineroar'), 'draco meteor').rolls)
      .toEqual(calcola(att('garchomp', null, null), dif('incineroar'), 'draco meteor').rolls)
  })

  it('Guts la annulla — ed è la stessa riga che dà il ×1,5', () => {
    // Nel riferimento `applyBurn` esclude Guts esplicitamente (`:2237`). Chi ha
    // Guts ed è bruciato prende il potenziamento E non prende il dimezzamento.
    const conGuts = calcola(att('machamp', 'guts', 'burned'), dif('incineroar'), 'close combat')
    const senza   = calcola(att('machamp', null, 'burned'),   dif('incineroar'), 'close combat')
    // Senza Guts: ×0,5. Con Guts: ×1,5 e nessun dimezzamento. Il rapporto fra
    // i due è quindi circa 3.
    expect(conGuts.maxDmg / senza.maxDmg).toBeGreaterThan(2.8)
  })

  it('Facade la ignora: è l\'unica mossa con `ignoresBurn` nel vendor', () => {
    // E raddoppia anche di potenza. Le due cose insieme: bruciato, Facade fa
    // il doppio del danno e non viene dimezzata.
    const bruciato = calcola(att('garchomp', null, 'burned'), dif('incineroar'), 'facade')
    const sano     = calcola(att('garchomp', null, null),     dif('incineroar'), 'facade')
    expect(bruciato.maxDmg / sano.maxDmg).toBeGreaterThan(1.9)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. La paralisi e la Velocità
// ═══════════════════════════════════════════════════════════════════════════

describe('la paralisi', () => {
  const jolteon = (ability, status) => ({
    key: 'jolteon', sps: SP, nature: null, ability, status, speBoost: 0,
  })

  it('dimezza la Velocità', () => {
    const sano = calcEffectiveSpe(jolteon('volt-absorb', null), null)
    const para = calcEffectiveSpe(jolteon('volt-absorb', 'paralyzed'), null)
    expect(para).toBe(Math.floor(sano / 2))
  })

  /**
   * ─── DOVE SI VEDE CHE STA FUORI DAI MOLTIPLICATORI ───────────────────────
   *
   * La prima stesura di questo test diceva «su una Velocità dispari si vede»,
   * e la motivazione era falsa: `v / 2` ha parte decimale 0 oppure esattamente
   * 0,5, e `pokeRound` a 0,5 tronca — quindi `floor(v/2)` e `pokeRound(v/2)`
   * coincidono SEMPRE. Il test passava per il motivo sbagliato.
   *
   * La differenza compare quando c'è un ALTRO modificatore di velocità, perché
   * allora l'ordine conta: il riferimento arrotonda tutti gli altri insieme e
   * POI tronca la metà, mentre uno `0.5` dentro `altriMod` arrotonderebbe una
   * volta sola sul prodotto.
   *
   * Raticate col Choice Scarf: 117 → ×1,5 → 175,5 → `pokeRound` 175 → metà
   * troncata 87. Scritto come moltiplicatore: 117 × 0,75 = 87,75 →
   * `pokeRound` 88. Ottantasette contro ottantotto.
   */
  it('è un passaggio a sé DOPO gli altri modificatori, e tronca', () => {
    const raticate = (status) => ({
      key: 'raticate', sps: SP, nature: null, ability: 'run-away',
      item: 'choice scarf', status, speBoost: 0,
    })
    const conScarf = calcEffectiveSpe(raticate(null), null)
    const paralizzato = calcEffectiveSpe(raticate('paralyzed'), null)

    expect(paralizzato, 'la paralisi è finita dentro i moltiplicatori')
      .toBe(Math.floor(conScarf / 2))
    // E il numero che la scrittura sbagliata darebbe, per non lasciare il
    // confronto implicito.
    expect(paralizzato).not.toBe(Math.round(conScarf * 0.5 + 0.001))
  })

  it('Quick Feet dà ×1,5 e annulla il dimezzamento', () => {
    const sano = calcEffectiveSpe(jolteon('volt-absorb', null), null)
    const qf   = calcEffectiveSpe(jolteon('quick-feet', 'paralyzed'), null)
    expect(qf / sano).toBeGreaterThan(1.45)
    expect(qf / sano).toBeLessThan(1.55)
  })

  it('Quick Feet non fa niente senza uno stato', () => {
    expect(calcEffectiveSpe(jolteon('quick-feet', null), null))
      .toBe(calcEffectiveSpe(jolteon('volt-absorb', null), null))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Le quattro abilità
// ═══════════════════════════════════════════════════════════════════════════

describe('le quattro abilità che leggono lo stato', () => {
  it('Guts: ×1,5 sull\'attacco fisico, con qualunque stato', () => {
    // Avvelenato invece che bruciato, così il dimezzamento non c\'entra e il
    // rapporto è il ×1,5 pulito.
    const con   = calcola(att('machamp', 'guts', 'poisoned'), dif('incineroar'), 'close combat')
    const senza = calcola(att('machamp', 'guts', null),       dif('incineroar'), 'close combat')
    const r = con.maxDmg / senza.maxDmg
    expect(r).toBeGreaterThan(1.45)
    expect(r).toBeLessThan(1.55)
  })

  it('Flare Boost: ×1,5 sulle speciali, e solo se bruciato', () => {
    const con   = calcola(att('drifblim', 'flare-boost', 'burned'), dif('incineroar'), 'shadow ball')
    const senza = calcola(att('drifblim', 'flare-boost', null),     dif('incineroar'), 'shadow ball')
    expect(con.maxDmg / senza.maxDmg).toBeGreaterThan(1.45)

    // Avvelenato non basta: è la condizione che la distingue da Guts.
    expect(calcola(att('drifblim', 'flare-boost', 'poisoned'), dif('incineroar'), 'shadow ball').rolls)
      .toEqual(senza.rolls)
  })

  it('Toxic Boost: ×1,5 sulle fisiche, e con tutt\'e due i veleni', () => {
    const senza = calcola(att('zangoose', 'toxic-boost', null), dif('incineroar'), 'close combat')
    for (const veleno of ['poisoned', 'badly-poisoned']) {
      const con = calcola(att('zangoose', 'toxic-boost', veleno), dif('incineroar'), 'close combat')
      expect(con.maxDmg / senza.maxDmg, veleno).toBeGreaterThan(1.45)
    }
    // Bruciato no: quello è Flare Boost, e sull\'altra categoria.
    expect(calcola(att('zangoose', 'toxic-boost', 'burned'), dif('incineroar'), 'close combat').maxDmg)
      .toBeLessThan(senza.maxDmg)   // qui vale il dimezzamento da bruciatura
  })

  it('Marvel Scale: ×1,5 sulla Difesa di chi subisce', () => {
    const con   = calcola(att('garchomp'), dif('milotic', 'marvel-scale', 'poisoned'), 'earthquake')
    const senza = calcola(att('garchomp'), dif('milotic', 'marvel-scale', null),       'earthquake')
    const r = con.maxDmg / senza.maxDmg
    expect(r).toBeGreaterThan(0.63)
    expect(r).toBeLessThan(0.70)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Le mosse
// ═══════════════════════════════════════════════════════════════════════════

describe('le mosse che lo stato raddoppia', () => {
  const RADDOPPI = [
    ['Hex',            'hex',            'asleep',         true],
    ['Hex, altro stato', 'hex',          'burned',         true],
    ['Venoshock',      'venoshock',      'poisoned',       true],
    ['Venoshock, veleno grave', 'venoshock', 'badly-poisoned', true],
    ['Smelling Salts', 'smelling salts', 'paralyzed',      true],
    ['Wake-Up Slap',   'wake-up slap',   'asleep',         true],
  ]

  for (const [nome, mossa, stato] of RADDOPPI) {
    it(`${nome}: ×2 se chi subisce è ${stato}`, () => {
      const con   = calcola(att('garchomp'), dif('incineroar', null, stato), mossa)
      const senza = calcola(att('garchomp'), dif('incineroar', null, null),  mossa)
      expect(con.maxDmg / senza.maxDmg).toBeGreaterThan(1.9)
    })
  }

  it('Smelling Salts non raddoppia su uno stato che non è la paralisi', () => {
    expect(calcola(att('garchomp'), dif('incineroar', null, 'burned'), 'smelling salts').rolls)
      .toEqual(calcola(att('garchomp'), dif('incineroar', null, null), 'smelling salts').rolls)
  })

  it('Facade legge lo stato di CHI ATTACCA, non di chi subisce', () => {
    const suDiMe  = calcola(att('garchomp', null, 'paralyzed'), dif('incineroar'), 'facade')
    const sullAltro = calcola(att('garchomp'), dif('incineroar', null, 'paralyzed'), 'facade')
    const nessuno = calcola(att('garchomp'), dif('incineroar'), 'facade')
    expect(suDiMe.maxDmg / nessuno.maxDmg).toBeGreaterThan(1.9)
    expect(sullAltro.rolls, 'Facade sta leggendo il lato sbagliato').toEqual(nessuno.rolls)
  })

  it('Facade NON raddoppia sul sonno: la lista del riferimento non lo include', () => {
    expect(calcola(att('garchomp', null, 'asleep'), dif('incineroar'), 'facade').rolls)
      .toEqual(calcola(att('garchomp'), dif('incineroar'), 'facade').rolls)
  })

  it('Dream Eater non fa niente contro chi non dorme', () => {
    // Il difensore NON è Incineroar: è Fire/Dark, e Psico contro Buio è zero.
    // Il caso sarebbe uscito «immune» in tutt'e due i versi, per il tipo, e non
    // avrebbe provato niente sul sonno. Milotic è Acqua: Psico la colpisce.
    const sveglio = calcola(att('garchomp'), dif('milotic', null, null), 'dream eater')
    expect(sveglio.immune).toBe(true)
    expect(sveglio.reason).toBe('move')

    const dorme = calcola(att('garchomp'), dif('milotic', null, 'asleep'), 'dream eater')
    expect(dorme.immune ?? false, 'contro chi dorme deve arrivare').toBe(false)
    expect(dorme.maxDmg).toBeGreaterThan(0)
  })
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
    ['bruciato, mossa fisica',   att('garchomp', null, 'burned'), dif('incineroar'), 'earthquake'],
    ['bruciato, mossa speciale', att('garchomp', null, 'burned'), dif('incineroar'), 'draco meteor'],
    ['sano, la stessa fisica',   att('garchomp', null, null),     dif('incineroar'), 'earthquake'],
    ['Guts bruciato',   att('machamp', 'guts', 'burned'),   dif('incineroar'), 'close combat'],
    ['Guts avvelenato', att('machamp', 'guts', 'poisoned'), dif('incineroar'), 'close combat'],
    ['Guts sano',       att('machamp', 'guts', null),       dif('incineroar'), 'close combat'],
    ['Flare Boost bruciato',   att('drifblim', 'flare-boost', 'burned'),   dif('incineroar'), 'shadow ball'],
    ['Flare Boost avvelenato', att('drifblim', 'flare-boost', 'poisoned'), dif('incineroar'), 'shadow ball'],
    ['Toxic Boost avvelenato', att('zangoose', 'toxic-boost', 'poisoned'), dif('incineroar'), 'close combat'],
    ['Toxic Boost veleno grave', att('zangoose', 'toxic-boost', 'badly-poisoned'), dif('incineroar'), 'close combat'],
    ['Marvel Scale',      att('garchomp'), dif('milotic', 'marvel-scale', 'poisoned'), 'earthquake'],
    ['Marvel Scale sana', att('garchomp'), dif('milotic', 'marvel-scale', null),       'earthquake'],
    ['Facade su chi attacca', att('garchomp', null, 'paralyzed'), dif('incineroar'), 'facade'],
    ['Facade sul sonno',      att('garchomp', null, 'asleep'),    dif('incineroar'), 'facade'],
    ['Facade bruciato: raddoppia e non si dimezza', att('garchomp', null, 'burned'), dif('incineroar'), 'facade'],
    ['Hex',            att('garchomp'), dif('incineroar', null, 'asleep'),         'hex'],
    ['Venoshock',      att('garchomp'), dif('incineroar', null, 'poisoned'),       'venoshock'],
    ['Venoshock grave', att('garchomp'), dif('incineroar', null, 'badly-poisoned'), 'venoshock'],
    ['Smelling Salts', att('garchomp'), dif('incineroar', null, 'paralyzed'),      'smelling salts'],
    ['Smelling Salts, stato sbagliato', att('garchomp'), dif('incineroar', null, 'burned'), 'smelling salts'],
    ['Wake-Up Slap',   att('garchomp'), dif('incineroar', null, 'asleep'),         'wake-up slap'],
    ['Dream Eater contro chi dorme', att('garchomp'), dif('milotic', null, 'asleep'), 'dream eater'],
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
