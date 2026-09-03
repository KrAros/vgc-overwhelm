// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/tipoEffettivo.test.js
 *
 * Le cinque che riscrivono un tipo: Forecast, Mimicry, Galvanize, Normalize,
 * Mega Sol.
 *
 * ─── DUE COSE DIVERSE CHE SEMBRANO UNA ─────────────────────────────────────
 *
 * Forecast e Mimicry cambiano il tipo del POKÉMON (`damage_MASTER.js:415` e
 * `:429`). Galvanize e Normalize cambiano il tipo della MOSSA (`:1081`,
 * `:1091`). Non è la stessa cosa, e la differenza si legge nello STAB: chi
 * cambia il proprio tipo guadagna lo STAB su quel tipo per ogni mossa, chi
 * cambia la mossa se lo porta dietro solo su quella.
 *
 * Tutt'e due i cambi di tipo del Pokémon AZZERANO il secondo tipo: chi le
 * porta diventa monotipo. Su Stunfisk-Galar — Terra/Acciaio — Mimicry non
 * aggiunge un tipo, ne toglie uno.
 *
 * ─── NORMALIZE NON STA NELLA TABELLA DELLE «-ate» ──────────────────────────
 *
 * Le «-ate» chiedono che la mossa sia già Normale; Normalize la rende Normale
 * qualunque fosse. Nel riferimento sono `if` ed `else if` della stessa
 * funzione, e la condizione della prima è esplicitamente
 * `attacker.ability !== "Normalize"`. Una tabella tipo→tipo non saprebbe
 * esprimerlo, ed è il motivo per cui Galvanize ci sta e Normalize no.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { buildField } from '../lib/battleState.js'
import { tipiEffettivi, ABILITA_ATE } from '../lib/rules.js'
import { TYPES } from '../data/typeChart.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]
const att = (atkPokemon, atkAbility) => ({
  atkPokemon, atkSPs: SP, atkNature: null, atkAbility, atkItem: null, level: 50,
  atkAbilityFlags: {},
})
const dif = (defPokemon, defAbility = null) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const campo = (extra = {}) => buildField({ doubleTarget: true, ...extra }, 't1')
const calcola = (attacker, defender, move, extra = {}) =>
  calculateDamage({ attacker, defender, move, field: campo(extra), debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// 1. `tipiEffettivi`, provata da sola
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti: le specie hanno queste abilità', () => {
  for (const [chiave, specie] of [
    ['forecast', 'castform'], ['mimicry', 'stunfisk-galar'],
    ['galvanize', 'golem-alola'], ['normalize', 'delcatty'],
    ['mega-sol', 'meganium-mega'],
  ]) {
    it(`${chiave}: ${specie}`, () => {
      expect(pokemonData[specie].abilities).toContain(chiave)
    })
  }

  it('Castform è monotipo, ed è il motivo per cui un caso più sotto è costruito', () => {
    expect(pokemonData['castform'].type).toHaveLength(1)
  })
})

describe('il tipo effettivo del Pokémon', () => {
  const FORECAST = ABILITY_EFFECTS['forecast']
  const MIMICRY = ABILITY_EFFECTS['mimicry']

  it('Forecast segue il meteo, e vale anche coi meteo estremi', () => {
    const t = (meteo) => tipiEffettivi([TYPES.NORMAL], FORECAST, 'castform', meteo, null)
    expect(t('sun')).toEqual([TYPES.FIRE])
    expect(t('harsh sunshine')).toEqual([TYPES.FIRE])
    expect(t('rain')).toEqual([TYPES.WATER])
    expect(t('heavy rain')).toEqual([TYPES.WATER])
    expect(t('snow')).toEqual([TYPES.ICE])
  })

  it('senza meteo, e con la sabbia, Forecast dà Normale', () => {
    // Il ramo `else` del riferimento: la sabbia non è fra i tre nominati.
    expect(tipiEffettivi([TYPES.NORMAL], FORECAST, 'castform', null, null))
      .toEqual([TYPES.NORMAL])
    expect(tipiEffettivi([TYPES.NORMAL], FORECAST, 'castform', 'sand', null))
      .toEqual([TYPES.NORMAL])
  })

  it('Forecast chiede Castform, e la condizione è trascritta non dedotta', () => {
    // Nel riferimento c'è `pokemon.name === "Castform"`. Oggi Castform è
    // l'unica specie con Forecast anche da noi, quindi la condizione non
    // separa niente — ma è scritta, e se un giorno l'abilità arrivasse a un
    // altro Pokémon il riferimento non la applicherebbe.
    expect(tipiEffettivi([TYPES.WATER], FORECAST, 'vaporeon', 'sun', null))
      .toEqual([TYPES.WATER])
  })

  it('Mimicry segue il terreno, e senza terreno non fa niente', () => {
    const t = (terreno) => tipiEffettivi(
      [TYPES.GROUND, TYPES.STEEL], MIMICRY, 'stunfisk-galar', null, terreno)
    expect(t('electric')).toEqual([TYPES.ELECTRIC])
    expect(t('grassy')).toEqual([TYPES.GRASS])
    expect(t('misty')).toEqual([TYPES.FAIRY])
    expect(t('psychic')).toEqual([TYPES.PSYCHIC])
    expect(t(null), 'senza terreno Mimicry deve stare ferma')
      .toEqual([TYPES.GROUND, TYPES.STEEL])
  })

  it('tutt\'e due azzerano il secondo tipo', () => {
    // Su Stunfisk-Galar, Terra/Acciaio, il risultato è UN tipo solo.
    expect(tipiEffettivi([TYPES.GROUND, TYPES.STEEL], MIMICRY, 'stunfisk-galar', null, 'grassy'))
      .toHaveLength(1)
  })

  /**
   * ─── PERCHÉ QUI IL CASO È COSTRUITO E NON PESCATO ────────────────────────
   *
   * Castform è monotipo Normale, quindi «azzera il secondo tipo» su di lei non
   * cambia niente: togliendo l'azzeramento dal codice, nessun caso reale
   * diventava rosso — misurato.
   *
   * `tipiEffettivi` è però una funzione pura, e il suo contratto è quello del
   * riferimento: `pokemon.type2 = ""`, senza guardare quanti tipi c'erano.
   * Passarle due tipi verifica il contratto anche dove il gioco non ci porta,
   * ed è lecito proprio perché è pura — non sto inventando un Pokémon, sto
   * chiamando una funzione con un argomento.
   */
  it('e Forecast lo azzera anche su un ipotetico bitipo', () => {
    expect(tipiEffettivi([TYPES.NORMAL, TYPES.WATER], FORECAST, 'castform', 'sun', null))
      .toEqual([TYPES.FIRE])
  })

  it('senza nessuna delle due, i tipi restano quelli', () => {
    expect(tipiEffettivi([TYPES.FIRE, TYPES.DARK], null, 'incineroar', 'sun', 'grassy'))
      .toEqual([TYPES.FIRE, TYPES.DARK])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Galvanize e Normalize
// ═══════════════════════════════════════════════════════════════════════════

describe('il tipo della mossa', () => {
  it('Galvanize sta nella tabella delle «-ate», Normalize no', () => {
    expect(ABILITA_ATE['galvanize']).toBe(TYPES.ELECTRIC)
    expect(ABILITA_ATE['normalize'], 'Normalize non può stare in una tabella tipo→tipo')
      .toBeUndefined()
    expect(ABILITY_EFFECTS['normalize'].normalize).toBe(true)
  })

  it('Galvanize rende Elettro una mossa Normale, e la potenzia', () => {
    // Golem-Alola su Gyarados: Elettro è super efficace, Normale è neutro.
    const con   = calcola(att('golem-alola', 'galvanize'), dif('gyarados'), 'body slam')
    const senza = calcola(att('golem-alola', 'sturdy'),    dif('gyarados'), 'body slam')
    expect(con.maxDmg / senza.maxDmg, 'né il tipo né il ×1,2 sono arrivati')
      .toBeGreaterThan(2)
  })

  it('Normalize rende Normale una mossa che Normale non era', () => {
    // Ed è la differenza con le «-ate»: quelle non toccherebbero una mossa
    // Elettro. Su Gengar, Ghost/Veleno, una mossa Normale non arriva affatto.
    const con = calcola(att('delcatty', 'normalize'), dif('gengar'), 'thunderbolt')
    expect(con.immune, 'la mossa non è diventata Normale').toBe(true)
  })

  it('Normalize prende il ×1,2 come le «-ate»', () => {
    // `isBoosted = gen >= 7 ? true : false`, e giriamo a 10.
    const con   = calcola(att('delcatty', 'normalize'),   dif('incineroar'), 'body slam')
    const senza = calcola(att('delcatty', 'cute-charm'),  dif('incineroar'), 'body slam')
    const r = con.maxDmg / senza.maxDmg
    expect(r).toBeGreaterThan(1.15)
    expect(r).toBeLessThan(1.25)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Mega Sol
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── QUATTRO DEI SETTE PUNTI SONO OSSERVABILI ──────────────────────────────
 *
 * Mega Sol compare in sette punti del riferimento. Quattro li possiamo
 * provare:
 *
 *   Weather Ball diventa Fuoco             `:729`
 *   Weather Ball raddoppia la potenza      `:1424`
 *   le mosse Fuoco prendono il ×1,5        `:2163`
 *   la pioggia NON dimezza le mosse Fuoco  `:2173`
 *
 * Gli altri tre esentano Mega Sol da cose che noi non calcoliamo affatto: il
 * dimezzamento di Solar Beam col maltempo (`:1722`), il +50% difensivo di
 * sabbia e neve (`:2066`), e il ×1,5 su Hydro Steam (`:2164`). Non sono
 * implementati e non sono verificabili — scritto qui, non sottinteso.
 */
describe('Mega Sol', () => {
  const meganium = () => att('meganium-mega', 'mega-sol')
  const spento   = () => att('meganium-mega', null)

  it('dà il ×1,5 alle mosse Fuoco senza nessun sole', () => {
    const con   = calcola(meganium(), dif('incineroar'), 'flamethrower')
    const senza = calcola(spento(),   dif('incineroar'), 'flamethrower')
    const r = con.maxDmg / senza.maxDmg
    expect(r).toBeGreaterThan(1.45)
    expect(r).toBeLessThan(1.55)
  })

  it('e la pioggia non gliele dimezza', () => {
    const conPioggia = calcola(meganium(), dif('incineroar'), 'flamethrower', { weather: 'rain' })
    const senzaMeteo = calcola(meganium(), dif('incineroar'), 'flamethrower')
    expect(conPioggia.rolls, 'la pioggia sta ancora dimezzando').toEqual(senzaMeteo.rolls)
  })

  it('ma NON tocca le mosse Acqua sotto il sole', () => {
    // Il riferimento non nomina Mega Sol in quella riga (`:2173`), e la
    // differenza è voluta: «è come se ci fosse il sole» vale per le mosse
    // Fuoco, non contro quelle Acqua.
    const conSole = calcola(meganium(), dif('incineroar'), 'surf', { weather: 'sun' })
    const senza   = calcola(meganium(), dif('incineroar'), 'surf')
    expect(conSole.maxDmg).toBeLessThan(senza.maxDmg)
  })

  it('rende Weather Ball di tipo Fuoco anche sotto la pioggia', () => {
    // È il PRIMO ramo del ternario (`:729`): viene prima del sole vero, quindi
    // vince su qualunque meteo.
    const sottoPioggia = calcola(meganium(), dif('incineroar'), 'weather ball', { weather: 'rain' })
    const senzaAbilita = calcola(spento(),   dif('incineroar'), 'weather ball', { weather: 'rain' })
    // Incineroar è Fuoco/Buio: Acqua è super efficace, Fuoco è ×0,5.
    expect(sottoPioggia.maxDmg, 'Weather Ball è rimasta Acqua')
      .toBeLessThan(senzaAbilita.maxDmg)
  })

  it('e senza meteo le dà comunque la potenza doppia', () => {
    const con   = calcola(meganium(), dif('incineroar'), 'weather ball')
    const senza = calcola(spento(),   dif('incineroar'), 'weather ball')
    // Senza abilità: Normale, potenza 50. Con: Fuoco, potenza 100, ×1,5 di
    // Mega Sol, ×0,5 di efficacia contro Incineroar, più lo STAB che Meganium
    // non ha sul Fuoco.
    expect(con.maxDmg).toBeGreaterThan(senza.maxDmg)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. L'oracolo
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
    ['Forecast col sole',   att('castform', 'forecast'), dif('incineroar'), 'weather ball', { weather: 'sun' }],
    ['Forecast subisce col sole', att('incineroar'), dif('castform', 'forecast'), 'surf', { weather: 'sun' }],
    ['Forecast subisce con la pioggia', att('incineroar'), dif('castform', 'forecast'), 'thunderbolt', { weather: 'rain' }],
    ['Forecast senza meteo', att('incineroar'), dif('castform', 'forecast'), 'close combat', {}],
    ['Mimicry col campo erboso', att('incineroar'), dif('stunfisk-galar', 'mimicry'), 'flamethrower', { terrain: 'grassy' }],
    ['Mimicry col campo elettrico', att('incineroar'), dif('stunfisk-galar', 'mimicry'), 'earthquake', { terrain: 'electric' }],
    ['Mimicry senza terreno', att('incineroar'), dif('stunfisk-galar', 'mimicry'), 'flamethrower', {}],
    ['Galvanize su una mossa Normale', att('golem-alola', 'galvanize'), dif('gyarados'), 'body slam', {}],
    ['Galvanize su una mossa che Normale non è', att('golem-alola', 'galvanize'), dif('gyarados'), 'earthquake', {}],
    ['Normalize su una mossa Elettro', att('delcatty', 'normalize'), dif('incineroar'), 'thunderbolt', {}],
    ['Normalize su una mossa già Normale', att('delcatty', 'normalize'), dif('incineroar'), 'body slam', {}],
    ['Mega Sol su una mossa Fuoco', att('meganium-mega', 'mega-sol'), dif('incineroar'), 'flamethrower', {}],
    ['Mega Sol col Fuoco sotto pioggia', att('meganium-mega', 'mega-sol'), dif('incineroar'), 'flamethrower', { weather: 'rain' }],
    ['Mega Sol con l\'Acqua sotto il sole', att('meganium-mega', 'mega-sol'), dif('incineroar'), 'surf', { weather: 'sun' }],
    ['Mega Sol e Weather Ball senza meteo', att('meganium-mega', 'mega-sol'), dif('incineroar'), 'weather ball', {}],
    ['Mega Sol e Weather Ball sotto pioggia', att('meganium-mega', 'mega-sol'), dif('incineroar'), 'weather ball', { weather: 'rain' }],
  ]

  for (const [nome, attacker, defender, mossa, extra] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const f = campo(extra)
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

// ═══════════════════════════════════════════════════════════════════════════
// 5. Cosa NON è verificabile, detto e non sottinteso
// ═══════════════════════════════════════════════════════════════════════════

describe('registro: i tre punti di Mega Sol che non possiamo provare', () => {
  it('Solar Beam col maltempo, il difensivo di sabbia e neve, Hydro Steam', () => {
    // Il riferimento esenta Mega Sol da tre cose che noi non calcoliamo:
    //
    //   `:1722`  Solar Beam e Solar Blade dimezzate dal maltempo
    //   `:2066`  il +50% a Difesa/Dif. Speciale di Roccia e Ghiaccio
    //            sotto sabbia e neve
    //   `:2164`  il ×1,5 su Hydro Steam
    //
    // Non essendo implementato ciò da cui esentano, l'esenzione non può
    // cambiare nessun numero. Il test esiste perché quando una delle tre
    // arriverà, Mega Sol vada rivisto — e non ci si arrivi per caso.
    const sorgente = fs.readFileSync(
      path.join(RADICE, 'src', 'calcEngine.js'), 'utf8')
    expect(sorgente.includes('solar beam'), 'Solar Beam ora c\'è: rivedere Mega Sol').toBe(false)
    expect(sorgente.includes('hydro steam'), 'Hydro Steam ora c\'è: rivedere Mega Sol').toBe(false)
  })
})
