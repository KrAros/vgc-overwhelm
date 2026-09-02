// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/efficacia.test.js
 *
 * Le tre abilità che riscrivono l'efficacia di tipo: Scrappy, Mind's Eye,
 * Tera Shell.
 *
 *   Scrappy e Mind's Eye  Normale e Lotta colpiscono i Ghost  `:230`
 *   Tera Shell            tutto ciò che è sopra 0,5 → 0,5     `:215`, `:266`
 *
 * ─── SCRAPPY AVEVA MEZZO EFFETTO, E IL REGISTRO NON POTEVA VEDERLO ─────────
 *
 * Non era nel divario, e sembrava a posto: `ABILITY_EFFECTS['scrappy']`
 * esisteva, con `intimidateAnnulla`. Ma quella è la metà minore. La metà
 * principale — colpire i Ghost — non era implementata, su quattordici specie.
 *
 * Il registro guarda se una voce ha UN effetto, non se ha IL suo effetto: un
 * buco che per costruzione non poteva segnalare. Mind's Eye, che nel
 * riferimento sta nella stessa identica clausola, era invece nel divario
 * perché non aveva voce affatto — la stessa meccanica, due destini diversi.
 *
 * ─── L'ECCEZIONE VALE PER TIPO, NON PER POKÉMON ────────────────────────────
 *
 * Il riferimento calcola i due tipi separatamente e poi moltiplica
 * (`:212-214`). Su Sableye — Buio/Ghost — una mossa Lotta vale 2 × 0, cioè
 * zero; con Scrappy il Ghost diventa 1 e resta il 2 del Buio: **due**, non
 * uno. La versione precedente usciva allo zero al primo tipo immune e non ci
 * sarebbe mai arrivata.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { buildField } from '../lib/battleState.js'
import { getEffectiveness, TYPES } from '../data/typeChart.js'
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
const campo = () => buildField({ doubleTarget: true }, 't1')
const calcola = (attacker, defender, move) =>
  calculateDamage({ attacker, defender, move, field: campo(), debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// 1. La funzione, provata da sola
// ═══════════════════════════════════════════════════════════════════════════

describe('getEffectiveness con le opzioni', () => {
  const GHOST_VELENO = [TYPES.GHOST, TYPES.POISON]     // Gengar
  const BUIO_GHOST   = [TYPES.DARK, TYPES.GHOST]       // Sableye

  it('senza opzioni si comporta come prima', () => {
    expect(getEffectiveness(TYPES.NORMAL, GHOST_VELENO)).toBe(0)
    expect(getEffectiveness(TYPES.FIGHTING, BUIO_GHOST)).toBe(0)
  })

  it('con `ignoraGhost` la mossa Normale arriva, e vale 1', () => {
    expect(getEffectiveness(TYPES.NORMAL, GHOST_VELENO, { ignoraGhost: true })).toBe(1)
  })

  it('e su Buio/Ghost una mossa Lotta vale DUE, non uno', () => {
    // Il caso che distingue «per tipo» da «per Pokémon». Se l'eccezione fosse
    // applicata al risultato invece che al singolo tipo, uscirebbe 1.
    expect(getEffectiveness(TYPES.FIGHTING, BUIO_GHOST, { ignoraGhost: true })).toBe(2)
  })

  it('`ignoraGhost` non tocca le mosse che non sono Normale o Lotta', () => {
    expect(getEffectiveness(TYPES.PSYCHIC, [TYPES.DARK], { ignoraGhost: true })).toBe(0)
  })

  it('Tera Shell porta a 0,5 tutto ciò che era sopra', () => {
    expect(getEffectiveness(TYPES.FIGHTING, [TYPES.NORMAL], { teraShell: true })).toBe(0.5)
    expect(getEffectiveness(TYPES.WATER, [TYPES.NORMAL], { teraShell: true })).toBe(0.5)
  })

  it('ma non alza ciò che era già sotto, e non risuscita un\'immunità', () => {
    // La condizione è `> 0.5`, non «riduci»: 0,25 resta 0,25 e lo zero resta
    // zero. Scriverla come «metti 0,5» sarebbe più forte del riferimento.
    expect(getEffectiveness(TYPES.GHOST, [TYPES.NORMAL], { teraShell: true })).toBe(0)
    expect(getEffectiveness(TYPES.FIGHTING, [TYPES.GHOST, TYPES.FLYING], { teraShell: true }))
      .toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti', () => {
  it('Scrappy tiene tutt\'e due le metà', () => {
    // Se qualcuno togliesse `intimidateAnnulla` credendo di ripulire, Scrappy
    // smetterebbe di bloccare Intimidate senza che nessun altro test lo dica.
    expect(ABILITY_EFFECTS['scrappy']).toEqual({
      intimidateAnnulla: true, ignoraGhost: true,
    })
  })

  it('Scrappy e Mind\'s Eye fanno la stessa cosa: nel riferimento sono una clausola sola', () => {
    expect(ABILITY_EFFECTS['minds-eye'].ignoraGhost)
      .toBe(ABILITY_EFFECTS['scrappy'].ignoraGhost)
  })

  it('le specie ce le hanno', () => {
    expect(pokemonData['kangaskhan'].abilities).toContain('scrappy')
    expect(pokemonData['ursaluna-bloodmoon'].abilities).toContain('minds-eye')
    expect(pokemonData['terapagos-terastal'].abilities).toContain('tera-shell')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. E si vede nel danno
// ═══════════════════════════════════════════════════════════════════════════

describe('nel danno', () => {
  it('Kangaskhan con Scrappy colpisce Gengar con una mossa Normale', () => {
    const con   = calcola(att('kangaskhan', 'scrappy'), dif('gengar'), 'body slam')
    const senza = calcola(att('kangaskhan', 'early-bird'), dif('gengar'), 'body slam')
    expect(senza.immune, 'senza Scrappy Gengar deve essere immune').toBe(true)
    expect(con.immune ?? false).toBe(false)
    expect(con.maxDmg).toBeGreaterThan(0)
  })

  it('Ursaluna-Bloodmoon con Mind\'s Eye fa lo stesso', () => {
    const con = calcola(att('ursaluna-bloodmoon', 'minds-eye'), dif('gengar'), 'body slam')
    expect(con.immune ?? false).toBe(false)
    expect(con.maxDmg).toBeGreaterThan(0)
  })

  it('Tera Shell dimezza un colpo che sarebbe neutro', () => {
    const con   = calcola(att('incineroar'), dif('terapagos-terastal', 'tera-shell'), 'knock off')
    const senza = calcola(att('incineroar'), dif('terapagos-terastal', null), 'knock off')
    const r = con.maxDmg / senza.maxDmg
    expect(r).toBeGreaterThan(0.48)
    expect(r).toBeLessThan(0.52)
  })

  it('Mold Breaker spegne Tera Shell, senza che serva scriverlo', () => {
    // Nel riferimento la condizione guarda `defAbility`, cioè il valore già
    // sostituito con `[ignored]`. Da noi `defAbilEffect` diventa null, e la
    // conseguenza arriva da sé.
    const conMold = calcola(att('excadrill', 'mold-breaker'),
      dif('terapagos-terastal', 'tera-shell'), 'iron head')
    const senzaMold = calcola(att('excadrill', 'sand-rush'),
      dif('terapagos-terastal', 'tera-shell'), 'iron head')
    expect(conMold.maxDmg, 'Mold Breaker non sta spegnendo Tera Shell')
      .toBeGreaterThan(senzaMold.maxDmg)
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
    ['Scrappy contro Gengar',        att('kangaskhan', 'scrappy'),    dif('gengar'),  'body slam'],
    ['senza Scrappy, lo stesso',     att('kangaskhan', 'early-bird'), dif('gengar'),  'body slam'],
    ['Scrappy contro Sableye, Lotta', att('kangaskhan', 'scrappy'),   dif('sableye'), 'brick break'],
    ['Scrappy su una mossa che non c\'entra', att('kangaskhan', 'scrappy'), dif('gengar'), 'crunch'],
    ['Mind\'s Eye contro Gengar',    att('ursaluna-bloodmoon', 'minds-eye'), dif('gengar'), 'body slam'],
    ['Tera Shell su un colpo neutro', att('incineroar'), dif('terapagos-terastal', 'tera-shell'), 'knock off'],
    ['Tera Shell su un colpo super efficace', att('machamp'), dif('terapagos-terastal', 'tera-shell'), 'close combat'],
    ['Tera Shell su un\'immunità',   att('gengar'), dif('terapagos-terastal', 'tera-shell'), 'shadow ball'],
    ['Tera Shell spenta',            att('incineroar'), dif('terapagos-terastal', null), 'knock off'],
    ['Mold Breaker contro Tera Shell', att('excadrill', 'mold-breaker'), dif('terapagos-terastal', 'tera-shell'), 'iron head'],
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
