/**
 * src/__tests__/stats.test.js
 *
 * Sessione C — blocco 1.
 *
 * ─── COSA DIMOSTRA ─────────────────────────────────────────────────────────
 * Che unificare le due implementazioni del calcolo statistiche non ha spostato
 * nessun numero. Lo snapshot del motore già lo dice per la strada del danno,
 * ma non copre `speedOrder` né l'editor, che passavano dall'*altra*
 * implementazione — quella senza bonus meteo.
 *
 * ─── IL METODO: DUE ORACOLI ────────────────────────────────────────────────
 * Le due funzioni storiche sono ricopiate qui sotto, parola per parola, e
 * usate come riferimento. È lo stesso metodo della sessione B: il test non
 * chiede "il risultato sembra giusto?", chiede "il risultato è identico a
 * quello che l'utente vedeva ieri?".
 *
 * Sono due e non una perché differivano davvero:
 *   - `calcStatStorica` (da calcEngine) conosceva i bonus meteo
 *   - `calcFinalStatStorica` (da utils/statCalc) no, e scriveva i tetti SP
 *     come numeri magici invece che come costanti
 * L'unificazione deve coincidere con la prima sempre, e con la seconda ovunque
 * il meteo non c'entri — cioè ovunque la seconda venisse effettivamente usata.
 */

import { describe, it, expect } from 'vitest'
import { NATURE_MODIFIERS, NATURES } from '../data/natures.js'
import { TYPES } from '../data/typeChart.js'
import pokemonData from '../data/pokemon.json'
import { calcStat, getBaseStat, getNatureModifier } from '../lib/stats.js'
import {
  applyBoost, spToEv, totalSPs, areSPsLegal,
  MAX_HITS, MAX_SP_PER_STAT, MAX_SP_TOTAL, IV, LEVEL,
  STAT_HP, STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD, STAT_SPE,
} from '../lib/rules.js'

// ─── ORACOLO 1 — copia di src/calcEngine.js prima della sessione C ──────────

function getNatureModifierStorica(nature, stat) {
  if (!nature || !NATURE_MODIFIERS[nature]) return 10
  const [boost, drop] = NATURE_MODIFIERS[nature]
  if (boost === 0) return 10
  if (stat === boost) return 11
  if (stat === drop) return 9
  return 10
}

function calcStatStorica(base, sp, level = 50, nature = null, stat, weather = null, pokeTypes = []) {
  const ev = Math.min(sp ?? 0, 32) * 8
  const iv = 31
  let result
  if (stat === 0) {
    result = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
  } else {
    const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
    result = Math.floor(raw * getNatureModifierStorica(nature, stat) / 10)
  }
  if (weather === 'sand' && stat === 4) {
    if (pokeTypes.includes(TYPES.ROCK)) result = Math.floor(result * 1.5)
  }
  if (weather === 'snow' && stat === 2) {
    if (pokeTypes.includes(TYPES.ICE)) result = Math.floor(result * 1.5)
  }
  return result
}

// ─── ORACOLO 2 — copia di src/utils/statCalc.js prima della sessione C ──────

function calcFinalStatStorica(base, sp, level, nature, statIdx) {
  const ev = Math.min(sp ?? 0, 32) * 8
  const iv = 31
  if (statIdx === 0) {
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
  }
  const mod = nature && NATURE_MODIFIERS[nature]
    ? (NATURE_MODIFIERS[nature][0] === statIdx ? 11
      : NATURE_MODIFIERS[nature][1] === statIdx ? 9 : 10)
    : 10
  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
  return Math.floor(raw * mod / 10)
}

// ─── Tabelle boost storiche, tutte e tre ───────────────────────────────────
// calcEngine e StatRow avevano 1/1 in posizione neutra, speedOrder 2/2.

const BOOST_NUM_MOTORE = [2,2,2,2,2,2,1,3,4,5,6,7,8]
const BOOST_DEN_MOTORE = [8,7,6,5,4,3,1,2,2,2,2,2,2]
const BOOST_NUM_VELOCITA = [2,2,2,2,2,2,2,3,4,5,6,7,8]
const BOOST_DEN_VELOCITA = [8,7,6,5,4,3,2,2,2,2,2,2,2]

// ─── Griglia di casi, deterministica ───────────────────────────────────────
// Nessun numero casuale: rieseguire produce esattamente gli stessi casi.

const BASI    = [1, 5, 20, 45, 55, 60, 70, 80, 90, 100, 110, 120, 130, 150, 180, 255]
const SP      = [0, 1, 4, 7, 8, 15, 16, 23, 31, 32]
const STATS   = [STAT_HP, STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD, STAT_SPE]
const NATURE  = [null, 'adamant', 'modest', 'timid', 'relaxed', 'hardy', 'serious', 'sassy']

describe('lib/rules — le costanti sono quelle di Champions', () => {
  it('i valori di regola non sono cambiati', () => {
    expect(LEVEL).toBe(50)
    expect(IV).toBe(31)
    expect(MAX_SP_PER_STAT).toBe(32)
    expect(MAX_SP_TOTAL).toBe(66)
    expect(MAX_HITS).toBe(9)
  })

  it('gli indici di statistica seguono l\'ordine dei dati grezzi', () => {
    expect([STAT_HP, STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD, STAT_SPE])
      .toEqual([0, 1, 2, 3, 4, 5])
  })

  it('spToEv applica il tetto per statistica', () => {
    expect(spToEv(0)).toBe(0)
    expect(spToEv(32)).toBe(256)
    expect(spToEv(99)).toBe(256)   // clamp: un valore fuori range non gonfia la stat
    expect(spToEv(null)).toBe(0)
    expect(spToEv(undefined)).toBe(0)
  })

  it('totalSPs e areSPsLegal riconoscono uno spread illegale', () => {
    expect(totalSPs([32, 32, 0, 0, 0, 0])).toBe(64)
    expect(areSPsLegal([32, 32, 2, 0, 0, 0])).toBe(true)    // 66 esatti
    expect(areSPsLegal([32, 32, 3, 0, 0, 0])).toBe(false)   // 67
    expect(areSPsLegal([33, 0, 0, 0, 0, 0])).toBe(false)    // sfora il tetto singolo
  })
})

describe('lib/rules — applyBoost coincide con tutte e tre le tabelle storiche', () => {
  const STATISTICHE = [1, 31, 50, 88, 100, 133, 167, 200, 255, 306, 504]

  for (let boost = -6; boost <= 6; boost++) {
    it(`boost ${boost >= 0 ? '+' : ''}${boost}`, () => {
      for (const stat of STATISTICHE) {
        const atteso = boost === 0
          ? stat
          : Math.floor(stat * BOOST_NUM_MOTORE[6 + boost] / BOOST_DEN_MOTORE[6 + boost])
        expect(applyBoost(stat, boost)).toBe(atteso)

        // La tabella di speedOrder differiva solo in posizione neutra.
        const attesoVelocita = boost === 0
          ? stat
          : Math.floor(stat * BOOST_NUM_VELOCITA[6 + boost] / BOOST_DEN_VELOCITA[6 + boost])
        expect(applyBoost(stat, boost)).toBe(attesoVelocita)
      }
    })
  }

  it('un boost fuori range viene clampato invece di leggere fuori array', () => {
    expect(applyBoost(100, 99)).toBe(applyBoost(100, 6))
    expect(applyBoost(100, -99)).toBe(applyBoost(100, -6))
  })
})

describe('lib/stats — calcStat coincide con le implementazioni storiche', () => {
  it(`copre ${BASI.length * SP.length * STATS.length * NATURE.length} combinazioni senza meteo`, () => {
    let casi = 0
    for (const base of BASI) {
      for (const sp of SP) {
        for (const stat of STATS) {
          for (const nature of NATURE) {
            const nuovo = calcStat(base, sp, LEVEL, nature, stat)
            expect(nuovo).toBe(calcStatStorica(base, sp, 50, nature, stat))
            expect(nuovo).toBe(calcFinalStatStorica(base, sp, 50, nature, stat))
            casi++
          }
        }
      }
    }
    expect(casi).toBeGreaterThan(100)
  })

  it('coincide anche su ogni natura del gioco', () => {
    for (const nature of NATURES) {
      for (const stat of STATS) {
        expect(calcStat(100, 16, LEVEL, nature, stat))
          .toBe(calcStatStorica(100, 16, 50, nature, stat))
        expect(calcStat(100, 16, LEVEL, nature, stat))
          .toBe(calcFinalStatStorica(100, 16, 50, nature, stat))
      }
    }
  })

  it('coincide con l\'oracolo del motore anche coi bonus meteo attivi', () => {
    const combinazioni = [
      ['sand', [TYPES.ROCK]],
      ['sand', [TYPES.ROCK, TYPES.GROUND]],
      ['sand', [TYPES.WATER]],
      ['snow', [TYPES.ICE]],
      ['snow', [TYPES.ICE, TYPES.FLYING]],
      ['snow', [TYPES.FIRE]],
      ['rain', [TYPES.ROCK]],
      [null,   [TYPES.ROCK]],
    ]
    for (const [weather, tipi] of combinazioni) {
      for (const base of BASI) {
        for (const stat of STATS) {
          expect(calcStat(base, 16, LEVEL, 'relaxed', stat, weather, tipi))
            .toBe(calcStatStorica(base, 16, 50, 'relaxed', stat, weather, tipi))
        }
      }
    }
  })

  it('la sabbia alza la SpD dei Roccia del 50%, la neve la Def dei Ghiaccio', () => {
    const nudo    = calcStat(100, 0, LEVEL, null, STAT_SPD)
    const inSabbia = calcStat(100, 0, LEVEL, null, STAT_SPD, 'sand', [TYPES.ROCK])
    expect(inSabbia).toBe(Math.floor(nudo * 1.5))

    const nudoDef = calcStat(100, 0, LEVEL, null, STAT_DEF)
    const inNeve  = calcStat(100, 0, LEVEL, null, STAT_DEF, 'snow', [TYPES.ICE])
    expect(inNeve).toBe(Math.floor(nudoDef * 1.5))
  })

  it('senza meteo il risultato è identico a prima — è il caso di speedOrder e dell\'editor', () => {
    for (const base of BASI) {
      expect(calcStat(base, 20, LEVEL, 'jolly', STAT_SPE))
        .toBe(calcFinalStatStorica(base, 20, 50, 'jolly', 5))
    }
  })
})

describe('lib/stats — getNatureModifier', () => {
  it('coincide con la versione storica su tutte le nature', () => {
    for (const nature of [...NATURES, null, 'inesistente']) {
      for (const stat of STATS) {
        expect(getNatureModifier(nature, stat)).toBe(getNatureModifierStorica(nature, stat))
      }
    }
  })

  it('le nature neutre non toccano nessuna statistica', () => {
    for (const neutra of ['hardy', 'bashful', 'docile', 'serious', 'quirky']) {
      for (const stat of STATS) {
        expect(getNatureModifier(neutra, stat)).toBe(10)
      }
    }
  })
})

describe('lib/stats — getBaseStat', () => {
  it('legge il Pokédex per un Pokémon qualsiasi', () => {
    for (const stat of STATS) {
      expect(getBaseStat('amoonguss', stat)).toBe(pokemonData.amoonguss.stats[stat])
    }
  })

  it('restituisce 0 per una chiave inesistente o nulla', () => {
    expect(getBaseStat('non-esiste', STAT_ATT)).toBe(0)
    expect(getBaseStat(null, STAT_ATT)).toBe(0)
    expect(getBaseStat(undefined, STAT_ATT)).toBe(0)
  })

  it('Aegislash attacca con i valori della forma Spada', () => {
    // Nel Pokédex `aegislash` è la forma Scudo: 50 di Atk e SpA.
    expect(pokemonData.aegislash.stats[STAT_ATT]).toBe(50)
    expect(pokemonData.aegislash.stats[STAT_SPA]).toBe(50)
    // Ma Stance Change lo porta in forma Spada nel momento in cui attacca.
    expect(getBaseStat('aegislash', STAT_ATT)).toBe(150)
    expect(getBaseStat('aegislash', STAT_SPA)).toBe(150)
  })

  it('Aegislash difende con i valori della forma Scudo', () => {
    expect(getBaseStat('aegislash', STAT_DEF)).toBe(150)
    expect(getBaseStat('aegislash', STAT_SPD)).toBe(150)
    expect(getBaseStat('aegislash', STAT_HP)).toBe(60)
  })

  it('l\'eccezione riguarda solo aegislash, non la entry -blade', () => {
    expect(getBaseStat('aegislash-blade', STAT_ATT)).toBe(150)
    expect(getBaseStat('aegislash-blade', STAT_DEF)).toBe(50)
  })
})