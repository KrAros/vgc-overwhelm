/**
 * src/__tests__/damage.test.js
 *
 * Test della libreria KO chance / EOT (src/lib/damage.js).
 *
 * ─── PERCHÉ QUESTO FILE ESISTE ─────────────────────────────────────────────
 * La sessione B riscrive `calcKOChance` da ricorsione 16^n a programmazione
 * dinamica sugli stati HP, e nel farlo corregge due errori di logica. Una
 * riscrittura del genere ha bisogno di due tipi di test diversi:
 *
 *   1. test di EQUIVALENZA — dove la nuova implementazione deve dare gli
 *      stessi identici numeri della vecchia. Servono a dimostrare che la DP
 *      non ha rotto niente. La vecchia ricorsione è ricopiata qui sotto come
 *      oracolo: è l'unico posto del progetto dove ha ancora senso che esista.
 *
 *   2. test di DIVERGENZA — dove la nuova implementazione deve dare numeri
 *      DIVERSI, perché la vecchia sbagliava. Ogni caso qui sotto documenta
 *      quale bug dimostra e con quali numeri.
 *
 * Più un oracolo indipendente (`forzaBruta`) che enumera tutte le sequenze di
 * roll con la semantica corretta: lento, ma non condivide una riga di codice
 * con la DP, quindi se i due coincidono l'errore dovrebbe essere in entrambi.
 */

import { describe, it, expect } from 'vitest'
import {
  calcEOT,
  isSandImmune,
  calcKOChance,
  koChanceCumulative,
  findBestNHKO,
  MAX_HITS,
} from '../lib/damage.js'
import { TYPES } from '../data/typeChart.js'
import { calculateDamage } from '../calcEngine.js'
import { buildSmogonString } from '../utils/smogonString.js'

// ── Oracoli ───────────────────────────────────────────────────────────────────

/**
 * La ricorsione com'era prima della sessione B, ricopiata identica.
 * Controlla il KO solo dopo l'ultimo colpo e non limita la cura agli HP
 * massimi: sono esattamente i due bug corretti.
 *
 * Costa 16^hits: non chiamarla con più di 4-5 colpi.
 */
function ricorsioneStorica(rolls, defHP, eotNet, hits) {
  const n = rolls.length
  const calcP = (hp, h) => {
    if (h === 0) return hp <= 0 ? 1 : 0
    let s = 0
    for (const r of rolls) s += calcP(hp - r + eotNet, h - 1)
    return s / n
  }
  return calcP(defHP, hits)
}

/**
 * Enumerazione esaustiva di tutte le sequenze di roll con la semantica
 * corretta. Non condivide codice con la DP: è l'oracolo indipendente.
 *
 * Costa 16^hits come la ricorsione storica: solo per hits piccoli.
 */
function forzaBruta(rolls, defHP, eotNet, hits) {
  const n = rolls.length
  const rec = (hp, h) => {
    if (h === 0) return 0
    let s = 0
    for (const roll of rolls) {
      let nuoviHP = hp - roll
      if (nuoviHP <= 0) { s += 1; continue }
      nuoviHP += eotNet
      if (nuoviHP <= 0) { s += 1; continue }
      if (nuoviHP > defHP) nuoviHP = defHP
      s += rec(nuoviHP, h - 1)
    }
    return s / n
  }
  return rec(defHP, hits)
}

/** 16 roll linearmente distribuiti tra min e max, come li produce il motore. */
function rollsFinti(min, max) {
  return Array.from({ length: 16 }, (_, i) => min + Math.round(i * (max - min) / 15))
}

/** Generatore pseudocasuale deterministico: i casi "casuali" sono riproducibili. */
function rngDeterministico(seme) {
  let s = seme
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

// ── calcEOT ───────────────────────────────────────────────────────────────────

describe('calcEOT — effetti di fine turno', () => {
  it('i Leftovers curano 1/16 degli HP massimi', () => {
    const eot = calcEOT({ item: 'leftovers' }, 200, 'none', [])
    expect(eot.leftoversHP).toBe(12)
    expect(eot.eotNet).toBe(12)
  })

  it('la sabbia toglie 1/16 a chi non è immune', () => {
    const eot = calcEOT({ item: null, ability: 'overgrow' }, 200, 'sand', [])
    expect(eot.isSand).toBe(true)
    expect(eot.sandDmgHP).toBe(12)
    expect(eot.eotNet).toBe(-12)
  })

  it('sabbia e Leftovers insieme si annullano', () => {
    const eot = calcEOT({ item: 'leftovers' }, 200, 'sand', [])
    expect(eot.eotNet).toBe(0)
  })

  it('i tipi Roccia sono immuni alla sabbia', () => {
    expect(isSandImmune([TYPES.ROCK], '', '')).toBe(true)
    const eot = calcEOT({ item: null }, 200, 'sand', [TYPES.ROCK])
    expect(eot.sandDmgHP).toBe(0)
  })

  it('gli Occhialoni Filtro rendono immuni alla sabbia', () => {
    expect(isSandImmune([], '', 'safety goggles')).toBe(true)
  })

  it('la Sitrus Berry cura 1/4 degli HP massimi', () => {
    const eot = calcEOT({ item: 'sitrus berry' }, 200, 'none', [])
    expect(eot.sitrusBerryHP).toBe(50)
    // La Sitrus non entra in eotNet: si attiva sotto metà HP, non ogni turno.
    expect(eot.eotNet).toBe(0)
  })
})

// ── koChanceCumulative — proprietà di base ────────────────────────────────────

describe('koChanceCumulative — proprietà', () => {
  it('restituisce un array lungo maxHits', () => {
    expect(koChanceCumulative(rollsFinti(40, 47), 200, 0, 9)).toHaveLength(9)
  })

  it('è cumulativa, quindi non decrescente, e sempre dentro [0, 1]', () => {
    const cum = koChanceCumulative(rollsFinti(30, 36), 200, 3, MAX_HITS)
    for (let i = 0; i < cum.length; i++) {
      expect(cum[i]).toBeGreaterThanOrEqual(0)
      expect(cum[i]).toBeLessThanOrEqual(1)
      if (i > 0) expect(cum[i]).toBeGreaterThanOrEqual(cum[i - 1])
    }
  })

  it('un OHKO garantito vale 1 già al primo colpo', () => {
    const cum = koChanceCumulative(rollsFinti(300, 350), 200, 0, 3)
    expect(cum[0]).toBe(1)
    expect(cum[2]).toBe(1)
  })

  it('metà dei roll che uccidono danno 50% al primo colpo', () => {
    const rolls = [...Array(8).fill(90), ...Array(8).fill(110)]
    expect(koChanceCumulative(rolls, 100, 0, 1)[0]).toBeCloseTo(0.5, 12)
  })

  it('danno nullo non uccide mai', () => {
    expect(koChanceCumulative(new Array(16).fill(0), 200, 0, MAX_HITS).at(-1)).toBe(0)
  })

  it('regge input degeneri senza esplodere', () => {
    expect(koChanceCumulative([], 200, 0, 5).every(v => v === 0)).toBe(true)
    expect(koChanceCumulative(null, 200, 0, 5).every(v => v === 0)).toBe(true)
    expect(koChanceCumulative(rollsFinti(40, 47), 200, 0, 0)).toEqual([])
    expect(calcKOChance(rollsFinti(40, 47), 200, 0, 0)).toBe(0)
  })

  it('calcKOChance è coerente con la cumulativa', () => {
    const rolls = rollsFinti(35, 42)
    const cum = koChanceCumulative(rolls, 190, 4, MAX_HITS)
    for (let h = 1; h <= MAX_HITS; h++) {
      expect(calcKOChance(rolls, 190, 4, h)).toBeCloseTo(cum[h - 1], 12)
    }
  })
})

// ── Equivalenza con la ricorsione storica ─────────────────────────────────────

describe('equivalenza con la ricorsione precedente (eotNet ≤ 0)', () => {
  // Con eotNet ≤ 0 gli HP possono solo scendere: controllare il KO in mezzo o
  // solo alla fine è la stessa cosa, e il tetto degli HP massimi non entra mai
  // in gioco. Quindi i due bug corretti non hanno effetto e i numeri devono
  // coincidere ESATTAMENTE. Questo è il test che àncora la riscrittura.
  const rng = rngDeterministico(20260730)

  it('coincide su 30 casi casuali, hits 1..4', () => {
    for (let caso = 0; caso < 30; caso++) {
      const defHP = 120 + Math.floor(rng() * 220)
      const base  = 5 + Math.floor(rng() * 90)
      const rolls = rollsFinti(base, Math.floor(base * 1.18))
      // eotNet: metà dei casi senza EOT, metà con danno da sabbia
      const eotNet = rng() < 0.5 ? 0 : -Math.floor(defHP / 16)

      for (let hits = 1; hits <= 4; hits++) {
        const nuovo   = calcKOChance(rolls, defHP, eotNet, hits)
        const vecchio = ricorsioneStorica(rolls, defHP, eotNet, hits)
        expect(Math.abs(nuovo - vecchio)).toBeLessThan(1e-9)
      }
    }
  })
})

describe('equivalenza con la forza bruta (semantica corretta)', () => {
  // Qui l'oracolo ha la semantica NUOVA, quindi il confronto vale per
  // qualsiasi eotNet, positivo compreso.
  const rng = rngDeterministico(11235813)

  it('coincide su 20 casi casuali con EOT di ogni segno, hits 1..4', () => {
    for (let caso = 0; caso < 20; caso++) {
      const defHP = 120 + Math.floor(rng() * 220)
      const base  = 5 + Math.floor(rng() * 90)
      const rolls = rollsFinti(base, Math.floor(base * 1.18))
      const passo = Math.floor(defHP / 16)
      const eotNet = [0, passo, -passo, 2 * passo][Math.floor(rng() * 4)]

      for (let hits = 1; hits <= 4; hits++) {
        const dp    = calcKOChance(rolls, defHP, eotNet, hits)
        const bruta = forzaBruta(rolls, defHP, eotNet, hits)
        expect(Math.abs(dp - bruta)).toBeLessThan(1e-9)
      }
    }
  })
})

// ── Divergenza: i due bug corretti ────────────────────────────────────────────

describe('bug 1 — il KO a metà sequenza non veniva rilevato', () => {
  // Difensore da 100 HP con Leftovers (+6). Ogni colpo toglie 55.
  //   turno 1: 100 - 55 = 45 → +6 → 51
  //   turno 2: 51 - 55 = -4  → KO
  // La vecchia implementazione sommava tutto e guardava solo il totale finale:
  //   100 - 55 + 6 - 55 + 6 = 2 HP → nessun KO in 2 colpi.
  // Cioè: il Leftovers curava un Pokémon già esanime.
  const rolls = new Array(16).fill(55)

  it('la vecchia implementazione dichiarava 0% di 2HKO', () => {
    expect(ricorsioneStorica(rolls, 100, 6, 2)).toBe(0)
  })

  it('la nuova dichiara 2HKO garantito', () => {
    expect(calcKOChance(rolls, 100, 6, 2)).toBe(1)
  })

  it('e la forza bruta le dà ragione', () => {
    expect(forzaBruta(rolls, 100, 6, 2)).toBe(1)
  })

  it('findBestNHKO trova 2 colpi, non 3', () => {
    const best = findBestNHKO(rolls, 100, 6)
    expect(best.hits).toBe(2)
    expect(best.guaranteed).toBe(true)
  })
})

describe('bug 2 — la cura superava gli HP massimi', () => {
  // Difensore da 100 HP, EOT +20, roll che valgono 5 oppure 45.
  // Con la vecchia implementazione gli HP salivano indefinitamente: due roll
  // bassi di fila portavano a 130 HP, e da lì quattro roll alti non bastavano
  // più a uccidere. Nel gioco quei 130 HP non esistono: il tetto è 100.
  const rolls = [...Array(8).fill(5), ...Array(8).fill(45)]

  it('la vecchia sottostimava la KO chance in 6 colpi', () => {
    expect(ricorsioneStorica(rolls, 100, 20, 6)).toBeCloseTo(0.109375, 9)
  })

  it('la nuova, confermata dalla forza bruta, dà più del doppio', () => {
    expect(calcKOChance(rolls, 100, 20, 6)).toBeCloseTo(0.25, 9)
    expect(forzaBruta(rolls, 100, 20, 6)).toBeCloseTo(0.25, 9)
  })
})

describe('la sabbia può chiudere il conto a fine turno', () => {
  // 100 HP, sabbia -6, colpi da 95. Il colpo lascia 5 HP, la sabbia finisce
  // il lavoro: è un KO al primo turno, e va contato come tale.
  it('conta il KO da EOT nello stesso turno del colpo', () => {
    const rolls = new Array(16).fill(95)
    expect(calcKOChance(rolls, 100, -6, 1)).toBe(1)
    expect(forzaBruta(rolls, 100, -6, 1)).toBe(1)
  })
})

// ── maxHits ───────────────────────────────────────────────────────────────────

describe('tetto dei colpi alzato da 6 a 9', () => {
  // 200 HP, colpi fissi da 30: servono 7 colpi (6 × 30 = 180, 7 × 30 = 210).
  const rolls = new Array(16).fill(30)

  it('il vecchio tetto di 6 dichiarava "nessun KO"', () => {
    expect(findBestNHKO(rolls, 200, 0, { maxHits: 6 })).toBeNull()
  })

  it('il tetto attuale trova il 7HKO', () => {
    expect(MAX_HITS).toBe(9)
    const best = findBestNHKO(rolls, 200, 0)
    expect(best.hits).toBe(7)
    expect(best.guaranteed).toBe(true)
  })
})

// ── Prestazioni ───────────────────────────────────────────────────────────────

describe('prestazioni', () => {
  it('nove colpi costano meno di 5 ms', () => {
    const rolls = rollsFinti(40, 47)
    koChanceCumulative(rolls, 400, 5, MAX_HITS)      // giro a vuoto per il JIT

    const inizio = performance.now()
    koChanceCumulative(rolls, 400, 5, MAX_HITS)
    const durata = performance.now() - inizio

    // Riferimento misurato: ~0,11 ms. La soglia a 5 ms lascia margine alle
    // macchine lente della CI senza smettere di intercettare una regressione
    // di ordine di grandezza (la vecchia ricorsione, qui, costava 4.400 ms).
    expect(durata).toBeLessThan(5)
  })

  it('lo scenario del ReportPanel (4 mosse, NHKO + stringa Smogon) sta sotto i 20 ms', () => {
    const rolls = rollsFinti(38, 45)
    const inizio = performance.now()
    for (let mossa = 0; mossa < 4; mossa++) {
      findBestNHKO(rolls, 350, 3)                    // badge NHKO
      findBestNHKO(rolls, 350, 3, { minHits: 2 })    // suffisso stringa Smogon
    }
    expect(performance.now() - inizio).toBeLessThan(20)
  })
})

// ── findBestNHKO ──────────────────────────────────────────────────────────────

describe('findBestNHKO', () => {
  it('restituisce null quando non c\'è nessun KO possibile', () => {
    // Danno minimo, Leftovers che curano più di quanto il colpo tolga.
    expect(findBestNHKO(new Array(16).fill(2), 300, 20)).toBeNull()
  })

  it('minHits salta l\'OHKO quando richiesto', () => {
    // Metà dei roll uccidono al primo colpo.
    const rolls = [...Array(8).fill(90), ...Array(8).fill(110)]
    expect(findBestNHKO(rolls, 100, 0).hits).toBe(1)
    expect(findBestNHKO(rolls, 100, 0, { minHits: 2 }).hits).toBe(2)
  })

  it('pct è la chance arrotondata a un decimale', () => {
    const rolls = [...Array(5).fill(90), ...Array(11).fill(110)]
    const best = findBestNHKO(rolls, 100, 0)
    expect(best.chance).toBeCloseTo(11 / 16, 12)
    expect(best.pct).toBe(68.8)
    expect(best.guaranteed).toBe(false)
  })

  it('ignora le probabilità sotto la soglia dello 0,01%', () => {
    // Un solo roll su 16 uccide al secondo colpo: 1/256 ≈ 0,39%, sopra soglia.
    // Serve un caso più estremo per stare sotto: qui la chance a 2 colpi è 0.
    const rolls = [...Array(15).fill(30), 34]
    expect(findBestNHKO(rolls, 100, 0).hits).toBe(3)
  })
})

// ── Integrazione: la stringa Smogon ───────────────────────────────────────────

describe('buildSmogonString — suffisso NHKO', () => {
  // Stesso matchup del caso golden 01: Garchomp Crunch vs Venusaur.
  // roll 41-49, difensore 187 HP.
  const attacker = {
    atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0],
    atkNature: 'hardy', atkAbility: 'sand veil', atkItem: null, level: 50,
  }
  const defender = {
    defPokemon: 'venusaur', defSPs: [32, 0, 32, 0, 0, 0],
    defNature: 'hardy', defAbility: 'chlorophyll', defItem: null,
  }
  const slotAtk = { key: 'garchomp', sps: [0, 32, 0, 0, 0, 0], nature: 'hardy', ability: 'sand veil', item: null }
  const slotDef = { key: 'venusaur', sps: [32, 0, 32, 0, 0, 0], nature: 'hardy', ability: 'chlorophyll', item: null }

  const risultato = calculateDamage({ attacker, defender, move: 'crunch', field: {}, debug: false })

  it('il matchup di riferimento è quello atteso', () => {
    expect(risultato.rolls).toEqual([41, 42, 42, 43, 43, 44, 44, 45, 45, 46, 46, 47, 47, 48, 48, 49])
    expect(risultato.defHP).toBe(187)
  })

  it('senza EOT riporta il primo NHKO possibile, mai un 1HKO', () => {
    const s = buildSmogonString(slotAtk, slotDef, 'crunch', risultato, {})
    expect(s).toMatch(/-- (guaranteed|[\d.]+% chance to) [2-9]HKO$/)
  })

  it('con i Leftovers nomina la condizione', () => {
    const s = buildSmogonString(
      slotAtk, { ...slotDef, item: 'leftovers' }, 'crunch', risultato, {}
    )
    expect(s).toContain('after Leftovers recovery')
  })

  it('sotto sabbia nomina il danno da sabbia', () => {
    const s = buildSmogonString(
      slotAtk, slotDef, 'crunch', risultato, { weather: 'sand' }
    )
    expect(s).toContain('after sandstorm damage')
  })

  it('sabbia e Leftovers che si annullano non vengono nominati', () => {
    // eotNet === 0: il KO si calcola senza EOT e la condizione non compare,
    // come faceva la versione precedente.
    const s = buildSmogonString(
      slotAtk, { ...slotDef, item: 'leftovers' }, 'crunch', risultato, { weather: 'sand' }
    )
    expect(s).not.toContain('after')
  })

  it('un OHKO garantito non produce nessun suffisso', () => {
    const forte = calculateDamage({
      attacker: { ...attacker, atkPokemon: 'garchomp' },
      defender: { ...defender, defPokemon: 'shedinja' },
      move: 'crunch', field: {}, debug: false,
    })
    const s = buildSmogonString(
      slotAtk, { ...slotDef, key: 'shedinja', sps: [0, 0, 0, 0, 0, 0] }, 'crunch', forte, {}
    )
    expect(s).not.toContain('HKO')
  })
})