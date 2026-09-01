// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/protect.test.js
 *
 * Protect, e le due abilità che lo bucano.
 *
 * ─── PROTECT DA SOLO NON FA NIENTE, ED È LA COSA DA SAPERE ─────────────────
 *
 * Sembra la meccanica difensiva per eccellenza, e nel calcolo del danno non lo
 * è. Il riferimento non ha nessun ramo dove `field.isProtect` blocchi un colpo:
 * ha un ramo solo, e riduce il danno a un QUARTO per chi il Protect lo buca
 * (`damage_MASTER.js:833`):
 *
 *     field.isProtect && (move.isZ || move.isSignatureZ || attacker.isDynamax
 *                         || attacker.ability === 'Piercing Drill'
 *                         || (attacker.ability === 'Unseen Fist' && gen >= 10))
 *
 * È coerente: un calcolatore di danno assume che la mossa arrivi. Protect conta
 * solo per chi arriva LO STESSO.
 *
 * Mosse Z e Dynamax da noi non esistono. Quindi «implementare Protect» è
 * implementare Unseen Fist e Piercing Drill, e l'interruttore del campo conta
 * solo per loro — un portatore legale ciascuna, Golurk-Mega ed Excadrill-Mega.
 *
 * ─── ERA STATO MORTO ───────────────────────────────────────────────────────
 *
 * `protect: { t1, t2 }` esisteva nello store e non arrivava da nessuna parte:
 * né a `buildField`, né al link di condivisione, né a un componente. Dichiarato
 * e mai letto. Adesso serve, quindi è stato collegato.
 *
 * ─── IL QUARTO STA FUORI DALLA CATENA ──────────────────────────────────────
 *
 * È il punto j (`:2261`), DOPO i modificatori finali e con un `pokeRound` suo.
 * Metterlo in `finalMods` darebbe un numero vicino e diverso, perché
 * `chainMods` concatena in virgola fissa e arrotonda una volta sola.
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
  atkPokemon, atkSPs: SP, atkNature: null,
  atkAbility, atkItem: null, level: 50,
})
const dif = (defPokemon = 'incineroar') => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
/** Il campo come lo produce `buildField`: t1 attacca, t2 si protegge. */
const campo = (protetto) => buildField(
  { doubleTarget: true, ...(protetto ? { protect: { t2: true } } : {}) }, 't1')
const calcola = (attacker, move, protetto = false, defender = dif()) =>
  calculateDamage({ attacker, defender, move, field: campo(protetto), debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti, letti e non creduti', () => {
  const norm = s => String(s).toLowerCase().replace(/ /g, '-')
  it('le due specie hanno davvero le due abilità', () => {
    expect((pokemonData['golurk-mega'].abilities ?? []).map(norm)).toContain('unseen-fist')
    expect((pokemonData['excadrill-mega'].abilities ?? []).map(norm)).toContain('piercing-drill')
  })

  it('le due voci sono identiche: nel riferimento sono la stessa clausola', () => {
    expect(ABILITY_EFFECTS['unseen-fist']).toEqual(ABILITY_EFFECTS['piercing-drill'])
  })

  it('`protect` adesso arriva al motore, e dal lato giusto', () => {
    // Era stato morto: esisteva nello store e non usciva di lì. Si legge dal
    // lato del DIFENSORE — è lui che si protegge — come gli schermi.
    expect(buildField({ protect: { t2: true } }, 't1').protect).toBe(true)
    expect(buildField({ protect: { t1: true } }, 't1').protect,
      'letto dal lato di chi attacca').toBe(false)
    expect(buildField({ protect: { t1: true } }, 't2').protect).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Protect da solo non riduce niente
// ═══════════════════════════════════════════════════════════════════════════

describe('contro chi NON lo buca, l\'interruttore non cambia un numero', () => {
  it('un attaccante qualunque fa lo stesso danno', () => {
    // Non è una svista: il riferimento non ha nessun ramo che riduca il danno
    // per il solo Protect. Se un giorno qualcuno «aggiustasse» questa cosa
    // aggiungendo un blocco, questo test lo direbbe.
    expect(calcola(att('incineroar'), 'knock off', true).rolls)
      .toEqual(calcola(att('incineroar'), 'knock off', false).rolls)
  })

  it('nemmeno con un\'abilità che non c\'entra', () => {
    expect(calcola(att('excadrill', 'mold-breaker'), 'iron head', true).rolls)
      .toEqual(calcola(att('excadrill', 'mold-breaker'), 'iron head', false).rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Le due che lo bucano
// ═══════════════════════════════════════════════════════════════════════════

describe('Unseen Fist e Piercing Drill passano, per un quarto', () => {
  for (const [nome, specie, chiave, mossa] of [
    ['Unseen Fist',    'golurk-mega',    'unseen-fist',    'shadow punch'],
    ['Piercing Drill', 'excadrill-mega', 'piercing-drill', 'iron head'],
  ]) {
    it(`${nome}: contro il Protect il danno è un quarto`, () => {
      const scoperto = calcola(att(specie, chiave), mossa, false)
      const protetto = calcola(att(specie, chiave), mossa, true)

      // Il rapporto, non solo il verso: un ×0.5 scritto per sbaglio passerebbe
      // un test che chiedesse soltanto «è meno».
      const rapporto = protetto.maxDmg / scoperto.maxDmg
      expect(rapporto).toBeGreaterThan(0.24)
      expect(rapporto).toBeLessThan(0.27)
    })

    it(`${nome}: senza Protect l'abilità non fa niente`, () => {
      // Il caso gemello: l'abilità non è un potenziamento, è un permesso.
      // Senza il Protect davanti non deve muovere nulla.
      expect(calcola(att(specie, chiave), mossa, false).rolls)
        .toEqual(calcola(att(specie, null), mossa, false).rolls)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Il quarto sta FUORI dalla catena, e serve un caso per dirlo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── UNA ROTTURA CHE NON SI VEDEVA, E COSA CI È VOLUTO ─────────────────────
 *
 * Nel riferimento il quarto è il punto j, DOPO i modificatori finali, con un
 * `pokeRound` suo (`damage_MASTER.js:2261`). Scriverlo dentro `finalMods`
 * sarebbe una trascrizione sbagliata.
 *
 * Misurato: spostandolo nella catena, con i casi qui sopra non diventava rosso
 * NIENTE. Il motivo è che lì la catena finale è VUOTA, e con un modificatore
 * solo concatenare o applicare separatamente dà lo stesso numero.
 *
 * La differenza compare quando c'è dell'altro da concatenare, perché
 * `chainMods` accumula in virgola fissa e arrotonda una volta sola, mentre due
 * `pokeRound` in fila arrotondano due volte. Il Life Orb è il compagno più
 * comodo: modificatore finale dell'attaccante, nessuna casella di campo.
 *
 * Ma il Life Orb da solo non basta: su `shadow punch` contro Incineroar i due
 * modi danno lo STESSO risultato. Serve un caso dove il doppio arrotondamento
 * si veda davvero. Cercandolo su 9.040 combinazioni (le due specie, tutte le
 * mosse fisiche fino a 60 di potenza, 40 difensori robusti, col Life Orb e il
 * Protect alzato), 4.236 distinguono i due modi. Questi due sono scelti fra
 * quelle: mossa di un solo colpo, STAB della specie, e prima roll diversa —
 * 16 col quarto al posto giusto, 17 col quarto nella catena.
 *
 * I numeri qui sotto sono trascritti dal riferimento eseguito, così il caso
 * regge anche senza `vendor/ncp`. La verifica roll per roll è più sotto.
 */
describe('il quarto è fuori dalla catena, non dentro', () => {
  const CON_ORB = [
    ['Unseen Fist',    'golurk-mega',    'unseen-fist',    'shadow sneak', 'vaporeon',
      [16, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 19, 19, 19, 19, 20]],
    ['Piercing Drill', 'excadrill-mega', 'piercing-drill', 'metal claw',   'nidoqueen',
      [16, 16, 16, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 19, 19, 19]],
  ]

  for (const [nome, specie, chiave, mossa, bersaglio, attesi] of CON_ORB) {
    it(`${nome} col Life Orb: i due modi danno numeri diversi`, () => {
      const res = calculateDamage({
        attacker: { ...att(specie, chiave), atkItem: 'life orb' },
        defender: dif(bersaglio), move: mossa, field: campo(true), debug: false,
      })

      // Col quarto dentro `finalMods` la prima roll sarebbe 17.
      expect(res.rolls, `${nome}: il quarto è nel posto sbagliato della catena`)
        .toEqual(attesi)
    })

    it(`${nome} col Life Orb: lo strumento conta davvero`, () => {
      // Se il Life Orb non spostasse niente il caso sarebbe muto, e la
      // rottura tornerebbe invisibile senza che nessuno se ne accorga.
      const senza = calcola(att(specie, chiave), mossa, true, dif(bersaglio))
      expect(senza.rolls[0], 'il Life Orb non fa niente: caso muto')
        .toBeLessThan(attesi[0])
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
    ['Unseen Fist contro il Protect', att('golurk-mega', 'unseen-fist'), 'shadow punch', true],
    ['Unseen Fist senza Protect',     att('golurk-mega', 'unseen-fist'), 'shadow punch', false],
    ['Unseen Fist, abilità spenta',   att('golurk-mega', null),          'shadow punch', true],
    ['Piercing Drill contro il Protect', att('excadrill-mega', 'piercing-drill'), 'iron head', true],
    ['Piercing Drill senza Protect',  att('excadrill-mega', 'piercing-drill'), 'iron head', false],
    ['un attaccante qualunque contro il Protect', att('incineroar'), 'knock off', true],
  ]

  // I due casi col Life Orb: sono quelli che distinguono il quarto messo FUORI
  // dalla catena finale da quello messo dentro. Senza, spostarlo non fa
  // fallire niente — misurato.
  const CASI_CON_ALTRI_MODIFICATORI = [
    ['Unseen Fist col Life Orb contro il Protect',
      'golurk-mega', 'unseen-fist', 'shadow sneak', 'vaporeon', true],
    ['Unseen Fist col Life Orb senza Protect',
      'golurk-mega', 'unseen-fist', 'shadow sneak', 'vaporeon', false],
    ['Piercing Drill col Life Orb contro il Protect',
      'excadrill-mega', 'piercing-drill', 'metal claw', 'nidoqueen', true],
    ['Piercing Drill col Life Orb senza Protect',
      'excadrill-mega', 'piercing-drill', 'metal claw', 'nidoqueen', false],
  ]

  for (const [nome, specie, chiave, mossa, bersaglio, protetto] of CASI_CON_ALTRI_MODIFICATORI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const attacker = { ...att(specie, chiave), atkItem: 'life orb' }
      const defender = dif(bersaglio)
      const f = campo(protetto)
      const rif = harness.calcola({ attacker, defender, move: mossa, field: f })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(
        calculateDamage({ attacker, defender, move: mossa, field: f, debug: false }).rolls,
        `${nome}: il quarto è nel posto sbagliato della catena`,
      ).toEqual(rif.rolls)
    })
  }

  for (const [nome, attacker, mossa, protetto] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const f = campo(protetto)
      const rif = harness.calcola({ attacker, defender: dif(), move: mossa, field: f })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(calcola(attacker, mossa, protetto).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})
