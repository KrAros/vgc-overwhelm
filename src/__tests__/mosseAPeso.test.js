// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/mosseAPeso.test.js
 *
 * Quattro mosse, due abilità e uno strumento, tutti fermi dallo stesso dato.
 *
 *   Low Kick, Grass Knot     potenza dal peso del BERSAGLIO      :1320
 *   Heavy Slam, Heat Crash   potenza dal RAPPORTO fra i due pesi :1334
 *   Heavy Metal, Light Metal ×2 e ÷2 sul peso                    :717
 *   Float Stone              ÷2 sul peso                         :723
 *
 * ─── IL DATO C'ERA E NESSUNO LO GUARDAVA ───────────────────────────────────
 *
 * `weight` è in `pokemon.json` da sempre, ma era POTATO dal bundle: le quattro
 * mosse hanno `power: 0`, il motore usciva prima di guardarle, e le due
 * abilità erano un miraggio — comparivano nel divario senza che nulla potesse
 * renderle osservabili.
 *
 * Lo script di potatura aveva previsto esattamente questo momento:
 *
 *     «Aggiungere un campo qui è quindi un'affermazione forte: nessuno lo
 *      legge. Il test la verifica; se un giorno smette di essere vera, va
 *      tolto da qui, non silenziato là.»
 *
 * `potaturaDati.test.js` è diventato rosso alla prima riga di motore che tocca
 * `weight`, e la correzione è stata quella prescritta. Costo: 3,33 kB gzip.
 *
 * ─── ATTENZIONE AI PESI CHE NON COINCIDONO ─────────────────────────────────
 *
 * L'harness passa a NCP il peso di NCP, non il nostro. Su quaranta specie i due
 * non concordano — quasi tutte forme Mega — e su quelle il confronto con
 * l'oracolo fallirebbe senza che sia colpa del motore.
 *
 * I casi qui sotto stanno su specie dove i due pesi COINCIDONO, e il primo
 * blocco lo verifica invece di darlo per scontato. L'ultimo blocco registra le
 * quaranta, perché adesso il dato è osservabile e vanno aggiudicate.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import {
  potenzaDaPeso, potenzaDaRapportoPeso,
  MOSSE_PESO_BERSAGLIO, MOSSE_PESO_RAPPORTO, haPotenzaDaPeso,
} from '../lib/rules.js'
import movesData from '../data/moves.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }

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
const calcola = (attacker, defender, move) =>
  calculateDamage({ attacker, defender, move, field: {}, debug: false })

/** Le sei specie che coprono i sei gradini della tabella del bersaglio. */
const GRADINI = [
  ['aggron',     360,   120],
  ['arcanine',   155,   100],
  ['incineroar',  83,    80],
  ['absol',       47,    60],
  ['altaria',     20.6,  40],
  ['chimecho',     1,    20],
]

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti — e il peso che l'oracolo userà
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti, letti e non creduti', () => {
  it('le quattro mosse hanno potenza 0 nei dati', () => {
    // Non è cambiato il dato: è cambiato chi lo guarda. Se un giorno qualcuno
    // ci scrivesse una potenza dentro, il motore userebbe comunque il peso e
    // il numero scritto sarebbe morto — meglio saperlo.
    for (const m of [...MOSSE_PESO_BERSAGLIO, ...MOSSE_PESO_RAPPORTO]) {
      expect(movesData[m]?.power, `${m}`).toBe(0)
      expect(haPotenzaDaPeso(m), `${m}`).toBe(true)
    }
  })

  it('i pesi delle specie di prova sono quelli che credo', () => {
    for (const [specie, peso] of GRADINI) {
      expect(pokemonData[specie].weight, specie).toBe(peso)
    }
    expect(pokemonData['snorlax'].weight).toBe(460)
  })

  it.runIf(vendorPresente)('e coincidono con quelli di NCP — altrimenti l\'oracolo mentirebbe', async () => {
    // L'harness passa a NCP il peso di NCP. Su quaranta specie i due non
    // concordano, e su quelle un confronto roll per roll fallirebbe senza che
    // sia colpa del motore. Questo test tiene i casi lontani da quelle.
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    const { traduttore, ncp } = creaHarness()
    const diversi = []
    for (const [specie] of [...GRADINI, ['snorlax'], ['kangaskhan-mega']]) {
      const nome = traduttore.pokemonNCP(specie)
      const loro = ncp.pokedex[nome]?.w
      const nostro = pokemonData[specie].weight
      if (loro !== nostro) diversi.push(`${specie}: noi ${nostro}, NCP ${loro}`)
    }
    expect(diversi, 'un caso di prova sta su una specie dove i pesi divergono').toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Le due tabelle
// ═══════════════════════════════════════════════════════════════════════════

describe('la tabella del peso del bersaglio', () => {
  it('i sei gradini, uno per uno', () => {
    // La funzione da sola, senza il motore: se la catena di ternari viene
    // riscritta con un `>` invece di un `>=`, o con le soglie spostate di uno,
    // qui si vede subito.
    expect(potenzaDaPeso(200)).toBe(120)
    expect(potenzaDaPeso(199.9)).toBe(100)
    expect(potenzaDaPeso(100)).toBe(100)
    expect(potenzaDaPeso(99.9)).toBe(80)
    expect(potenzaDaPeso(50)).toBe(80)
    expect(potenzaDaPeso(49.9)).toBe(60)
    expect(potenzaDaPeso(25)).toBe(60)
    expect(potenzaDaPeso(24.9)).toBe(40)
    expect(potenzaDaPeso(10)).toBe(40)
    expect(potenzaDaPeso(9.9)).toBe(20)
    expect(potenzaDaPeso(0.1)).toBe(20)
  })

  it('e il motore la usa: sei bersagli, sei potenze', () => {
    for (const [specie, , potenza] of GRADINI) {
      const r = calcola(att('machamp'), dif(specie), 'low kick')
      expect(r, `${specie}: Low Kick non calcolabile`).not.toBeNull()
      expect(r.effectiveBP, `${specie}`).toBe(potenza)
    }
  })

  /**
   * ─── IL PESO NON SI ARROTONDA, E SERVE UN CASO PER DIRLO ─────────────────
   *
   * Il riferimento confronta il peso in virgola mobile: `w >= 25`, non
   * `Math.round(w) >= 25`. Sembra un dettaglio senza conseguenze, e non lo è.
   *
   * Misurato: arrotondando il peso all'intero, con i sei casi qui sopra non
   * diventava rosso NIENTE — nessuno dei sei ha una frazione che attraversi
   * una soglia. Fra le specie legali in M-B ce ne sono sei che lo fanno, e
   * Jolteon è una: pesa 24,5 kg, cioè un soffio SOTTO il gradino dei 25.
   *
   * Arrotondato diventerebbe 25 e la potenza salirebbe da 40 a 60 — un terzo
   * di danno in più su un Pokémon comune, e nessun test l'avrebbe detto.
   */
  it('Jolteon pesa 24,5: il peso NON si arrotonda', () => {
    expect(pokemonData['jolteon'].weight).toBe(24.5)
    expect(calcola(att('machamp'), dif('jolteon'), 'low kick').effectiveBP,
      'il peso è stato arrotondato: 24,5 è diventato 25').toBe(40)
  })
})

describe('la tabella del rapporto', () => {
  it('i cinque gradini', () => {
    expect(potenzaDaRapportoPeso(5)).toBe(120)
    expect(potenzaDaRapportoPeso(4.9)).toBe(100)
    expect(potenzaDaRapportoPeso(4)).toBe(100)
    expect(potenzaDaRapportoPeso(3)).toBe(80)
    expect(potenzaDaRapportoPeso(2)).toBe(60)
    // La catena è più corta dell'altra: sotto 2 non scende oltre 40.
    expect(potenzaDaRapportoPeso(1.9)).toBe(40)
    expect(potenzaDaRapportoPeso(0.01)).toBe(40)
  })

  it('e guarda TUTT\'E DUE i pesi, non solo quello del bersaglio', () => {
    // Aggron (360) contro Chimecho (1): rapporto 360, quindi 120.
    expect(calcola(att('aggron'), dif('chimecho'), 'heavy slam').effectiveBP).toBe(120)
    // Aggron (360) contro Snorlax (460): rapporto 0,78, quindi il gradino più basso.
    expect(calcola(att('aggron'), dif('snorlax'), 'heavy slam').effectiveBP).toBe(40)
    // Lo stesso bersaglio, un attaccante diverso: se il motore guardasse solo
    // il difensore questi due numeri sarebbero uguali.
    expect(calcola(att('chimecho'), dif('chimecho'), 'heavy slam').effectiveBP).toBe(40)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Chi cambia il peso
// ═══════════════════════════════════════════════════════════════════════════

describe('Heavy Metal, Light Metal e la Pietrapiuma', () => {
  it('Heavy Metal sul bersaglio raddoppia il peso, e la potenza sale', () => {
    // Absol pesa 47: gradino 60. Raddoppiato fa 94, che è ancora sotto 100 →
    // gradino 80. Un gradino solo, e va provato col numero perché «sale» lo
    // direbbe anche un raddoppio sbagliato.
    const normale = calcola(att('machamp'), dif('absol'), 'low kick')
    const pesante = calcola(att('machamp'), dif('absol', 'heavy-metal'), 'low kick')
    expect(normale.effectiveBP).toBe(60)
    expect(pesante.effectiveBP).toBe(80)
  })

  it('Light Metal dimezza, e la potenza scende', () => {
    // Aggron pesa 360: gradino 120. Dimezzato fa 180 → gradino 100.
    expect(calcola(att('machamp'), dif('aggron'), 'low kick').effectiveBP).toBe(120)
    expect(calcola(att('machamp'), dif('aggron', 'light-metal'), 'low kick').effectiveBP).toBe(100)
  })

  it('la Pietrapiuma dimezza anche lei', () => {
    const conPietra = calcola(att('machamp'), dif('aggron', null, { defItem: 'float stone' }), 'low kick')
    expect(conPietra.effectiveBP).toBe(100)
  })

  it('Heavy Metal e Pietrapiuma si annullano — è un `if` a sé, non un `else`', () => {
    // 360 × 2 ÷ 2 = 360, cioè il gradino di partenza. Se la Pietrapiuma fosse
    // scritta come `else if` di Heavy Metal, il peso resterebbe 720 e il
    // gradino sarebbe lo stesso per caso: per questo il caso vero è Absol.
    const aggron = calcola(att('machamp'),
      dif('aggron', 'heavy-metal', { defItem: 'float stone' }), 'low kick')
    expect(aggron.effectiveBP).toBe(120)

    // Absol: 47 × 2 = 94 (gradino 80), ÷ 2 = 47 (gradino 60). Se le due si
    // escludessero, il risultato sarebbe 80 e non 60.
    const absol = calcola(att('machamp'),
      dif('absol', 'heavy-metal', { defItem: 'float stone' }), 'low kick')
    expect(absol.effectiveBP, 'la Pietrapiuma non si somma a Heavy Metal').toBe(60)
  })

  it('sul rapporto contano da tutt\'e due i lati', () => {
    // Aggron (360) contro Snorlax (460) fa 0,78 → 40. Con Light Metal su
    // Snorlax il bersaglio pesa 230 e il rapporto sale a 1,56 → ancora 40;
    // con Heavy Metal su Aggron l'attaccante pesa 720 e il rapporto fa 1,56 →
    // sempre 40. Insieme: 720 / 230 = 3,13 → 80.
    const insieme = calcola(
      att('aggron', 'heavy-metal'), dif('snorlax', 'light-metal'), 'heavy slam')
    expect(insieme.effectiveBP, 'un lato solo dei due viene guardato').toBe(80)
  })

  it('Klutz spegne la Pietrapiuma', () => {
    // `checkKlutz` gira PRIMA di `getWeightMods` nel riferimento, quindi lo
    // strumento è già sparito quando i pesi si calcolano.
    const conKlutz = calcola(att('machamp'),
      dif('aggron', 'klutz', { defItem: 'float stone' }), 'low kick')
    expect(conKlutz.effectiveBP, 'la Pietrapiuma funziona nonostante Klutz').toBe(120)
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
    ...GRADINI.map(([specie]) => [`Low Kick contro ${specie}`, att('machamp'), dif(specie), 'low kick']),
    ['Grass Knot contro Aggron',  att('venusaur'), dif('aggron'),  'grass knot'],
    ['Low Kick contro Jolteon, 24,5 kg', att('machamp'), dif('jolteon'), 'low kick'],
    ['Heavy Slam, rapporto alto', att('aggron'),   dif('chimecho'), 'heavy slam'],
    ['Heavy Slam, rapporto basso', att('aggron'),  dif('snorlax'), 'heavy slam'],
    ['Heat Crash',                att('aggron'),   dif('altaria'), 'heat crash'],
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

  /**
   * ─── CHI CAMBIA IL PESO VUOLE L'INGRESSO ALTO ────────────────────────────
   *
   * I quattro casi qui sotto stavano nell'elenco sopra e divergevano: noi
   * applicavamo Heavy Metal, il riferimento no.
   *
   * Non era un difetto nostro. `getWeightMods` sta in `CALCULATE_ALL_MOVES_SV`
   * (`damage_SV.js:59`), come `checkAirLock` e `checkKlutz` — quindi da
   * `GET_DAMAGE_SV` non viene eseguita affatto, e il riferimento usa il peso
   * grezzo del pokedex.
   *
   * È la TERZA volta in questa sessione che una meccanica di quello strato si
   * presenta come una divergenza di trascrizione: prima Cloud Nine, poi Klutz,
   * adesso i pesi. Da qui in avanti la domanda da farsi per prima è «questa
   * funzione dove sta?», non «ho sbagliato a leggere?».
   *
   * Le mosse a peso SENZA modificatori restano nell'elenco sopra, sull'ingresso
   * basso: la potenza dal peso si calcola in `basePowerFunc`, che il livello
   * basso esegue.
   */
  const CASI_INGRESSO_ALTO = [
    ['Low Kick con Heavy Metal',  att('machamp'), dif('absol', 'heavy-metal'), 'low kick'],
    ['Low Kick con Light Metal',  att('machamp'), dif('aggron', 'light-metal'), 'low kick'],
    ['Low Kick con la Pietrapiuma', att('machamp'),
      dif('aggron', null, { defItem: 'float stone' }), 'low kick'],
    ['Heavy Slam coi due metalli', att('aggron', 'heavy-metal'),
      dif('snorlax', 'light-metal'), 'heavy slam'],
    ['Heavy Metal e Pietrapiuma insieme', att('machamp'),
      dif('absol', 'heavy-metal', { defItem: 'float stone' }), 'low kick'],
    // Klutz spegne la Pietrapiuma, e `checkKlutz` gira PRIMA di
    // `getWeightMods` (`:18` contro `:59`): quando i pesi si calcolano lo
    // strumento è già sparito.
    ['Klutz spegne la Pietrapiuma', att('machamp'),
      dif('aggron', 'klutz', { defItem: 'float stone' }), 'low kick'],
  ]

  for (const [nome, attacker, defender, mossa] of CASI_INGRESSO_ALTO) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP (ingresso alto)`, () => {
      const rif = harness.calcolaConPreparazione({ attacker, defender, move: mossa, field: {} })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(calcola(attacker, defender, mossa).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. LE QUARANTA SPECIE DA AGGIUDICARE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── LE QUARANTA SONO STATE AGGIUDICATE ────────────────────────────────────
 *
 * `gen-flag-dati.mjs` elencava le specie dove il nostro peso e quello di NCP
 * non concordano, con la nota: «entrambe le parti sbagliano a turno, quindi
 * ogni voce va aggiudicata a mano quando il dato diventerà osservabile».
 *
 * È diventato osservabile in questa sessione, e Simone ha aggiudicato: NCP su
 * tutte le ventinove forme Mega e su altre cinque, noi su tre. Il verdetto,
 * riga per riga e con la sua fonte, sta in `pesiAggiudicati.test.js`.
 *
 * ─── RESTANO SEI DIVERGENZE, IN DUE CATEGORIE DIVERSE ─────────────────────
 *
 * E la differenza fra le due conta più del numero:
 *
 *   AGGIUDICATE A NOI   lurantis, drednaw, arctovish. Divergono da NCP perché
 *                       Simone ha deciso che il nostro dato è quello giusto —
 *                       su Drednaw NCP dice 8,5 kg, che non sta in piedi. Una
 *                       divergenza voluta, come le quattro mosse di Parental
 *                       Bond.
 *
 *   ANCORA APERTE       kommo-o, typhlosion-hisui, tauros-paldea-aqua. Non
 *                       sono Mega e non erano nel gruppo su cui la domanda è
 *                       stata posta, quindi il verdetto non le copre. Tengono
 *                       il nostro valore per inerzia, non per decisione.
 *
 * Da qui in avanti «divergiamo da NCP sul peso» non è più di per sé un
 * problema: metà di queste sei è una scelta. Il test le tiene separate proprio
 * per non far ricomparire la domanda già risposta.
 */
describe('le specie dove il nostro peso e quello di NCP non concordano', () => {
  it.runIf(vendorPresente)('ne restano sei: tre per scelta, tre da chiedere', async () => {
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    const { traduttore, ncp } = creaHarness()

    const diverse = []
    for (const [slug, voce] of Object.entries(pokemonData)) {
      const nome = traduttore.pokemonNCP(slug)
      const loro = ncp.pokedex[nome]?.w
      if (loro === undefined || voce.weight === undefined) continue
      if (loro !== voce.weight) diverse.push(slug)
    }

    const VOLUTE = ['arctovish', 'drednaw', 'lurantis']
    const APERTE = ['kommo-o', 'tauros-paldea-aqua', 'typhlosion-hisui']

    expect(diverse.filter(s => VOLUTE.includes(s)).sort(),
      'una divergenza VOLUTA è sparita: qualcuno ha allineato il peso a NCP senza chiedere')
      .toEqual(VOLUTE)
    expect(diverse.filter(s => APERTE.includes(s)).sort(),
      'una delle tre aperte è stata decisa senza passare dall\'aggiudicazione')
      .toEqual(APERTE)
    expect(diverse.sort(), 'è comparsa una divergenza nuova: va aggiudicata')
      .toEqual([...VOLUTE, ...APERTE].sort())
  })
})
