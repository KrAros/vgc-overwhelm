// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/psBassi.test.js
 *
 * Le cinque che il riferimento accende dai punti salute, e che da noi si
 * accendono con una levetta.
 *
 *     Overgrow   mosse Erba       ×1,5   PS ≤ 1/3   `damage_MASTER.js:1942`
 *     Blaze      mosse Fuoco      ×1,5   PS ≤ 1/3   `:1943`
 *     Torrent    mosse Acqua      ×1,5   PS ≤ 1/3   `:1944`
 *     Swarm      mosse Coleottero ×1,5   PS ≤ 1/3   `:1945`
 *     Defeatist  qualunque mossa  ×0,5   PS ≤ 1/2   `:1925`
 *
 * ─── PERCHE' UNA LEVETTA E NON I PUNTI SALUTE ──────────────────────────────
 *
 * I punti salute non stanno nel nostro modello. Metterceli non e' aggiungere
 * un campo: e' riaprire tutto quello che il riferimento scala sui PS —
 * Eruption, Water Spout, Flail, Reversal, Endeavor, Super Fang — che oggi non
 * calcoliamo affatto (il divario delle mosse, registrato in CONTRIBUTING).
 *
 * Simone ha scelto la levetta: l'utente dichiara che l'abilita' e' attiva, che
 * e' l'informazione di cui il danno ha bisogno.
 *
 * ─── COSA VUOL DIRE INTERROGARE L'ORACOLO, ALLORA ──────────────────────────
 *
 * NCP non ha la levetta. L'harness la traduce in punti salute bassi —
 * `floor(maxHP / 3)`, che soddisfa sia la soglia di un terzo sia quella di
 * meta' — nello stesso punto in cui gia' traduceva `hpPieni` per Multiscale.
 *
 * E qui c'e' la trappola, che vale la pena scrivere: abbassare `curHP` cambia
 * in NCP anche la POTENZA di Eruption, Water Spout, Flail, Reversal, Crush
 * Grip e Wring Out (`:1354`, `:1360`, `:1367`, `:1371`). Nessun caso oracolo
 * qui sotto usa quelle sei mosse: un caso cosi' divergerebbe, e divergerebbe
 * per il divario delle mosse, non per l'abilita' in prova. Il test piu' in
 * basso lo verifica invece di fidarsi di questa frase.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { buildField } from '../lib/battleState.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { TYPES } from '../data/typeChart.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]
const ACCESO = { interruttore: true }

const att = (atkPokemon, atkAbility, flags = {}) => ({
  atkPokemon, atkSPs: SP, atkNature: null, atkAbility, atkItem: null, level: 50,
  atkAbilityFlags: flags,
})
const dif = (defPokemon = 'incineroar') => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const campo = () => buildField({ doubleTarget: true }, 't1')
const calcola = (attacker, move) =>
  calculateDamage({ attacker, defender: dif(), move, field: campo(), debug: false })

/** Le quattro per tipo: portatore, mossa del tipo giusto, mossa di un altro. */
const PER_TIPO = [
  ['Overgrow', 'overgrow', 'venusaur',  TYPES.GRASS, 'energy ball',  'sludge bomb'],
  ['Blaze',    'blaze',    'charizard', TYPES.FIRE,  'flamethrower', 'air slash'],
  ['Torrent',  'torrent',  'blastoise', TYPES.WATER, 'surf',         'ice beam'],
  ['Swarm',    'swarm',    'beedrill',  TYPES.BUG,   'x-scissor',    'poison jab'],
]

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti, letti e non creduti', () => {
  for (const [nome, chiave, specie, tipo] of PER_TIPO) {
    it(`${nome}: ${specie} ce l'ha, e la voce dice il tipo giusto`, () => {
      expect(pokemonData[specie].abilities).toContain(chiave)
      expect(ABILITY_EFFECTS[chiave].psBassiTipo).toBe(tipo)
    })
  }

  it('Defeatist: Archeops ce l\'ha, ed e\' una delle due sole specie', () => {
    expect(pokemonData['archeops'].abilities).toContain('defeatist')
    const tutti = Object.keys(pokemonData)
      .filter(k => (pokemonData[k].abilities ?? []).includes('defeatist'))
    expect(tutti.sort()).toEqual(['archen', 'archeops'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. La levetta accende, e del giusto
// ═══════════════════════════════════════════════════════════════════════════

describe('con la levetta accesa il moltiplicatore c\'e\'', () => {
  for (const [nome, chiave, specie, , mossaGiusta] of PER_TIPO) {
    it(`${nome}: ×1,5 sulle mosse del proprio tipo`, () => {
      const acceso = calcola(att(specie, chiave, ACCESO), mossaGiusta)
      const spento  = calcola(att(specie, chiave, {}),     mossaGiusta)
      const r = acceso.maxDmg / spento.maxDmg
      expect(r, `${nome}: non e' una volta e mezza`).toBeGreaterThan(1.45)
      expect(r, `${nome}: non e' una volta e mezza`).toBeLessThan(1.55)
    })
  }

  it('Defeatist: ×0,5 sull\'attacco', () => {
    const acceso = calcola(att('archeops', 'defeatist', ACCESO), 'rock slide')
    const spento  = calcola(att('archeops', 'defeatist', {}),     'rock slide')
    const r = acceso.maxDmg / spento.maxDmg
    expect(r).toBeGreaterThan(0.45)
    expect(r).toBeLessThan(0.55)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Le condizioni sono condizioni
// ═══════════════════════════════════════════════════════════════════════════

describe('senza la condizione non fanno niente', () => {
  for (const [nome, chiave, specie, , mossaGiusta, mossaAltra] of PER_TIPO) {
    it(`${nome}: con la levetta spenta`, () => {
      expect(calcola(att(specie, chiave, {}), mossaGiusta).rolls)
        .toEqual(calcola(att(specie, null, {}), mossaGiusta).rolls)
    })

    it(`${nome}: su una mossa di un altro tipo, nemmeno accesa`, () => {
      expect(calcola(att(specie, chiave, ACCESO), mossaAltra).rolls)
        .toEqual(calcola(att(specie, null, {}), mossaAltra).rolls)
    })
  }

  it('Defeatist: con la levetta spenta', () => {
    expect(calcola(att('archeops', 'defeatist', {}), 'rock slide').rolls)
      .toEqual(calcola(att('archeops', null, {}), 'rock slide').rolls)
  })

  it('Defeatist NON ha il controllo di categoria: vale anche sulle speciali', () => {
    // Slow Start, che sta nello stesso `if`, ce l'ha; Defeatist no
    // (`damage_MASTER.js:1925`). E' la differenza che si perde leggendo la
    // riga sopra invece della propria.
    const acceso = calcola(att('archeops', 'defeatist', ACCESO), 'earth power')
    const spento  = calcola(att('archeops', 'defeatist', {}),     'earth power')
    expect(acceso.maxDmg, 'Defeatist non sta toccando le mosse speciali')
      .toBeLessThan(spento.maxDmg)
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

  /**
   * Le sei mosse che in NCP leggono `curHP` per la propria POTENZA. Un caso
   * oracolo che ne usasse una, con la levetta accesa, divergerebbe per il
   * divario delle mosse e non per l'abilita'.
   */
  const MOSSE_CHE_LEGGONO_I_PS = [
    'eruption', 'water spout', 'flail', 'reversal', 'crush grip', 'wring out',
  ]

  const CASI = []
  for (const [nome, chiave, specie, , mossaGiusta, mossaAltra] of PER_TIPO) {
    CASI.push([`${nome} acceso`, att(specie, chiave, ACCESO), mossaGiusta])
    CASI.push([`${nome} spento`, att(specie, chiave, {}), mossaGiusta])
    CASI.push([`${nome} acceso, altro tipo`, att(specie, chiave, ACCESO), mossaAltra])
  }
  CASI.push(['Defeatist acceso', att('archeops', 'defeatist', ACCESO), 'rock slide'])
  CASI.push(['Defeatist spento', att('archeops', 'defeatist', {}), 'rock slide'])
  CASI.push(['Defeatist acceso, speciale', att('archeops', 'defeatist', ACCESO), 'earth power'])

  it('nessun caso oracolo usa una mossa che legge i PS', () => {
    // Il controllo che rende vera la frase scritta in cima, invece di
    // lasciarla come promessa.
    const colpevoli = CASI.filter(([, , m]) => MOSSE_CHE_LEGGONO_I_PS.includes(m))
    expect(colpevoli.map(c => c[0]), 'divergerebbe per il divario delle mosse')
      .toEqual([])
  })

  for (const [nome, attacker, mossa] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const f = campo()
      const rif = harness.calcola({ attacker, defender: dif(), move: mossa, field: f })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(
        calculateDamage({ attacker, defender: dif(), move: mossa, field: f, debug: false }).rolls,
        `${nome}: divergiamo dal riferimento`,
      ).toEqual(rif.rolls)
    })
  }
})
