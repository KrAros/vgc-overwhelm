// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/moldBreaker.test.js
 *
 * Mold Breaker, Teravolt, Turboblaze: ignorano l'abilità del bersaglio.
 *
 * ─── NON È SPARSA: È UNA SOSTITUZIONE SOLA ─────────────────────────────────
 *
 * Sembrava l'abilità che tocca tutte le altre, e non lo è. Nel riferimento
 * `abilityIgnore` (`damage_MASTER.js:998`) gira UNA volta, all'inizio del
 * calcolo (`damage_SV.js:125`), e rimpiazza `defAbility` con la sentinella
 * `"[ignored]"`. Nessuna delle funzioni a valle sa che Mold Breaker esiste:
 * leggono una stringa che non combacia con niente.
 *
 * Il motore fa lo stesso in un punto solo, e i ventitré campi che legge dal
 * difensore si spengono insieme.
 *
 * ─── LE TRE COSE CHE NON SI SPENGONO ───────────────────────────────────────
 *
 * Sono la ragione per cui questo file esiste. Un'implementazione che
 * spegnesse l'abilità del difensore «ovunque» passerebbe la maggior parte dei
 * casi qui sotto e sbaglierebbe questi tre, in silenzio:
 *
 *   1. L'AUREA. Il riferimento scrive `(gen > 7 || defAbility !== '[ignored]')`
 *      alla riga 1655: a gen 10 la prima metà è già vera, quindi il ×1,33 di
 *      Fairy Aura resta anche contro Mold Breaker. Contro ogni intuizione.
 *
 *   2. LA PREPARAZIONE. Intimidate, Download, Intrepid Sword e le abilità
 *      paradosso girano PRIMA di `abilityIgnore`. Mold Breaker non annulla un
 *      Intimidate già subito.
 *
 *   3. LE DIECI NON IGNORABILI (`:999`): Shadow Shield, Full Metal Body,
 *      Prism Armor, As One, Protosynthesis, Quark Drive e le quattro «of
 *      Ruin».
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { ABILITA_NON_IGNORABILI, MOSSE_CHE_IGNORANO_ABILITA } from '../lib/rules.js'
import movesData from '../data/moves.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]

const att = (atkPokemon, atkAbility, extra = {}) => ({
  atkPokemon, atkSPs: SP, atkNature: null,
  atkAbility, atkItem: null, level: 50, ...extra,
})
const dif = (defPokemon, defAbility, extra = {}) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {}, ...extra,
})
const calcola = (attacker, defender, move, field = {}) =>
  calculateDamage({ attacker, defender, move, field, debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// I casi. Excadrill è uno degli undici portatori legali in M-B.
// ═══════════════════════════════════════════════════════════════════════════

const SFONDATORE = 'excadrill'

/** [nome, difensore, abilità del difensore, mossa] */
const IGNORABILI = [
  // Immunità che spariscono del tutto: sono il caso più visibile.
  ['Levitate',      'rotom',      'levitate',      'earthquake'],
  ['Soundproof',    'kommo-o',    'soundproof',    'hyper voice'],
  ['Sap Sipper',    'azumarill',  'sap-sipper',    'energy ball'],
  ['Bulletproof',   'chesnaught', 'bulletproof',   'energy ball'],
  ['Water Absorb',  'vaporeon',   'water-absorb',  'surf'],
  // Riduzioni che spariscono.
  ['Multiscale',    'dragonite',  'multiscale',    'iron head'],
  ['Fur Coat',      'furfrou',    'fur-coat',      'iron head'],
  ['Thick Fat',     'snorlax',    'thick-fat',     'ice punch'],
  ['Ice Scales',    'frosmoth',   'ice-scales',    'flamethrower'],
  ['Fluffy',        'houndstone', 'fluffy',        'iron head'],
  ['Filter',        'aggron-mega', 'filter',       'earthquake'],
  ['Solid Rock',    'rhyperior',  'solid-rock',    'surf'],
  ['Heatproof',     'sinistcha',  'heatproof',     'flamethrower'],
  ['Purifying Salt', 'garganacl', 'purifying-salt', 'shadow ball'],
]

/** Le non ignorabili, che devono restare in piedi. */
const NON_IGNORABILI = [
  ['Shadow Shield', 'lunala',   'shadow-shield', 'shadow ball'],
  ['Prism Armor',   'necrozma', 'prism-armor',   'shadow ball'],
]

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti, letti e non creduti', () => {
  const norm = s => String(s).toLowerCase().replace(/ /g, '-')

  it('Excadrill ha davvero Mold Breaker', () => {
    expect((pokemonData[SFONDATORE].abilities ?? []).map(norm)).toContain('mold-breaker')
  })

  it('ogni difensore ha davvero la sua abilità', () => {
    const sbagliati = []
    for (const [nome, specie, chiave] of [...IGNORABILI, ...NON_IGNORABILI]) {
      const sue = (pokemonData[specie]?.abilities ?? []).map(norm)
      if (!sue.includes(chiave)) sbagliati.push(`${nome}: ${specie} non ha ${chiave}`)
    }
    expect(sbagliati).toEqual([])
  })

  it('le dieci non ignorabili sono quelle del riferimento', () => {
    expect([...ABILITA_NON_IGNORABILI].sort()).toEqual([
      'as-one', 'beads-of-ruin', 'full-metal-body', 'prism-armor',
      'protosynthesis', 'quark-drive', 'shadow-shield', 'sword-of-ruin',
      'tablets-of-ruin', 'vessel-of-ruin',
    ])
  })

  it('delle nove mosse che ignorano, tre esistono nei nostri dati', () => {
    // Il riferimento ne elenca nove (`:1002`). Sei non ci sono: le tre mosse Z
    // e le tre G-Max. Se un giorno entrassero, questo conto cambia e la lista
    // in `rules.js` va allungata — meglio un rosso che un silenzio.
    const NOVE = [
      'moongeist beam', 'sunsteel strike', 'photon geyser',
      'searing sunraze smash', 'menacing moonraze maelstrom',
      'light that burns the sky', 'g-max drum solo', 'g-max fireball',
      'g-max hydrosnipe',
    ]
    const presenti = NOVE.filter(m => movesData[m])
    expect(presenti.sort()).toEqual(['moongeist beam', 'photon geyser', 'sunsteel strike'])
    expect([...MOSSE_CHE_IGNORANO_ABILITA].sort()).toEqual(presenti.sort())
  })

  it('le tre abilità hanno la stessa voce, perché sono la stessa riga', () => {
    const atteso = { ignoraAbilita: true, showInSmogon: true }
    expect(ABILITY_EFFECTS['mold-breaker']).toEqual(atteso)
    expect(ABILITY_EFFECTS['teravolt']).toEqual(atteso)
    expect(ABILITY_EFFECTS['turboblaze']).toEqual(atteso)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Quello che si spegne
// ═══════════════════════════════════════════════════════════════════════════

describe('l\'abilità del bersaglio smette di contare', () => {
  for (const [nome, specie, chiave, mossa] of IGNORABILI) {
    it(`${nome}: con Mold Breaker il numero è quello di chi non ha abilità`, () => {
      const conSfondatore = calcola(att(SFONDATORE, 'mold-breaker'), dif(specie, chiave), mossa)
      const senzaAbilita  = calcola(att(SFONDATORE, 'mold-breaker'), dif(specie, null), mossa)
      const senzaSfondatore = calcola(att(SFONDATORE, null), dif(specie, chiave), mossa)

      // Con Mold Breaker il difensore vale come se l'abilità non ce l'avesse.
      expect(conSfondatore.rolls, `${nome}: l'abilità conta ancora`)
        .toEqual(senzaAbilita.rolls)

      // E il caso NON è muto: senza Mold Breaker l'abilità cambiava qualcosa.
      // Senza questo controllo, un'abilità che il motore non applica affatto
      // passerebbe il test qui sopra senza dire niente.
      expect(conSfondatore.rolls, `${nome}: caso muto — l'abilità non faceva niente`)
        .not.toEqual(senzaSfondatore.rolls)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Quello che NON si spegne
// ═══════════════════════════════════════════════════════════════════════════

describe('le dieci che Mold Breaker non riesce a ignorare', () => {
  for (const [nome, specie, chiave, mossa] of NON_IGNORABILI) {
    it(`${nome} resta in piedi`, () => {
      const conSfondatore = calcola(att(SFONDATORE, 'mold-breaker'), dif(specie, chiave), mossa)
      const senzaSfondatore = calcola(att(SFONDATORE, null), dif(specie, chiave), mossa)
      const senzaAbilita = calcola(att(SFONDATORE, 'mold-breaker'), dif(specie, null), mossa)

      expect(conSfondatore.rolls, `${nome}: Mold Breaker l'ha spenta`)
        .toEqual(senzaSfondatore.rolls)
      expect(conSfondatore.rolls, `${nome}: caso muto — l'abilità non fa niente`)
        .not.toEqual(senzaAbilita.rolls)
    })
  }
})

describe('l\'aurea resta accesa, contro ogni intuizione', () => {
  it('Fairy Aura potenzia le mosse Folletto anche contro Mold Breaker', () => {
    // `(gen > 7 || defAbility !== '[ignored]')`, riga 1655: a gen 10 la prima
    // metà è già vera. Un motore che spegnesse `defAbilEffect` in blocco
    // toglierebbe il ×1,33 e darebbe un numero più basso del riferimento.
    const conAura = calcola(att(SFONDATORE, 'mold-breaker'), dif('xerneas', 'fairy-aura'), 'play rough')
    const senzAura = calcola(att(SFONDATORE, 'mold-breaker'), dif('xerneas', null), 'play rough')
    expect(conAura.maxDmg, 'Mold Breaker ha spento l\'aura').toBeGreaterThan(senzAura.maxDmg)
  })
})

/**
 * ─── UNA ROTTURA CHE NON HO POTUTO METTERE SOTTO TEST, E LO DICO ───────────
 *
 * Nel riferimento la condizione guarda `attacker.ability`, e basta. Scrivendo
 * per sbaglio anche `defAbilEffettiva?.ignoraAbilita` — cioè «vale pure se ce
 * l'ha il difensore» — in questo file non diventa rosso NIENTE. Misurato.
 *
 * E non è un test debole: è che quella riga in più non ha conseguenze. Se il
 * difensore ha Mold Breaker, l'unica abilità che verrebbe spenta è Mold
 * Breaker stessa, che di campi difensivi non ne ha nessuno — il motore ne
 * legge ventitré dal difensore e la sua voce non ne porta uno.
 *
 * Quindi la condizione è difesa dalla lettura del riferimento, non da un test,
 * come il flag `prioritaria` in `gen-flag-dati.mjs` e come i tre `if`
 * indipendenti dei modificatori finali. Diventerebbe osservabile solo il
 * giorno che Mold Breaker prendesse un effetto difensivo, che non ha.
 */
describe('la preparazione gira prima, e Mold Breaker non la tocca', () => {
  it('un Intimidate già subito resta subito', () => {
    // Nel riferimento `checkIntimidate` sta nello strato di preparazione, che
    // gira prima di `abilityIgnore`. Un'implementazione che spegnesse
    // l'abilità del difensore «ovunque» farebbe sparire anche questo — e
    // sarebbe un danno più alto, cioè plausibile e sbagliato.
    const conIntimidate = calcola(
      att(SFONDATORE, 'mold-breaker'),
      dif('incineroar', 'intimidate', { defAbilityFlags: { intimidateActive: true } }),
      'iron head',
    )
    const senzaIntimidate = calcola(
      att(SFONDATORE, 'mold-breaker'),
      dif('incineroar', 'intimidate', { defAbilityFlags: { intimidateActive: false } }),
      'iron head',
    )
    expect(conIntimidate.maxDmg, 'Mold Breaker ha annullato l\'Intimidate')
      .toBeLessThan(senzaIntimidate.maxDmg)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Le tre mosse che fanno lo stesso senza l'abilità
// ═══════════════════════════════════════════════════════════════════════════

describe('Moongeist Beam, Sunsteel Strike e Photon Geyser', () => {
  for (const mossa of ['moongeist beam', 'sunsteel strike', 'photon geyser']) {
    it(`${mossa} ignora l'abilità anche da un attaccante qualunque`, () => {
      // Il difensore è Dragonite con Multiscale: dimezza il danno a PS pieni,
      // e queste mosse devono passare come se non ce l'avesse.
      const conAbilita = calcola(att('incineroar', null), dif('dragonite', 'multiscale'), mossa)
      const senzAbilita = calcola(att('incineroar', null), dif('dragonite', null), mossa)
      const conAltraMossa = calcola(att('incineroar', null), dif('dragonite', 'multiscale'), 'shadow ball')
      const conAltraSenza = calcola(att('incineroar', null), dif('dragonite', null), 'shadow ball')

      expect(conAbilita.rolls, `${mossa}: Multiscale conta ancora`).toEqual(senzAbilita.rolls)
      // Controllo negativo: su una mossa qualunque Multiscale deve contare.
      expect(conAltraMossa.rolls, 'Multiscale non fa niente nemmeno di suo')
        .not.toEqual(conAltraSenza.rolls)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. L'oracolo
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
    ...IGNORABILI.map(([nome, specie, chiave, mossa]) =>
      [`${nome} ignorata`, att(SFONDATORE, 'mold-breaker'), dif(specie, chiave), mossa]),
    ...IGNORABILI.map(([nome, specie, chiave, mossa]) =>
      [`${nome} senza Mold Breaker`, att(SFONDATORE, null), dif(specie, chiave), mossa]),
    ...NON_IGNORABILI.map(([nome, specie, chiave, mossa]) =>
      [`${nome} NON ignorata`, att(SFONDATORE, 'mold-breaker'), dif(specie, chiave), mossa]),
    ['Fairy Aura resta accesa',
      att(SFONDATORE, 'mold-breaker'), dif('xerneas', 'fairy-aura'), 'play rough'],
    ['Moongeist Beam contro Multiscale',
      att('incineroar', null), dif('dragonite', 'multiscale'), 'moongeist beam'],
    ['Sunsteel Strike contro Multiscale',
      att('incineroar', null), dif('dragonite', 'multiscale'), 'sunsteel strike'],
  ]

  for (const [nome, attacker, defender, mossa] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker, defender, move: mossa, field: {} })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(calcola(attacker, defender, mossa).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})
