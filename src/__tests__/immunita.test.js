// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/immunita.test.js
 *
 * Dodici abilità che non riducono il danno: lo annullano.
 *
 * ─── PERCHÉ QUESTE PRIMA DI ALTRE ──────────────────────────────────────────
 *
 * Perché è il tipo di errore peggiore che l'app possa fare. Un moltiplicatore
 * mancante dà un numero sbagliato; questo dà una DECISIONE sbagliata. L'app
 * scriveva «87-103, 2HKO» dove il gioco dice «non ha effetto», e chi legge
 * pianifica un turno su una mossa che non parte.
 *
 * ─── UNA CONDIZIONE SOLA, NON DODICI ───────────────────────────────────────
 *
 * Nel riferimento sono un solo `||` con un solo `return damage: [0]`
 * (`damage_MASTER.js:1107-1116`). Otto guardano il tipo della mossa, tre la
 * sua famiglia, una — Wonder Guard — l'efficacia. Il motore le tiene insieme
 * per la stessa ragione: sono la stessa regola con parametri diversi.
 *
 * Damp è a parte (`:1138`) perché non guarda il tipo ma quattro nomi di mosse,
 * e perché è l'unica del gruppo che vale anche quando ce l'ha CHI ATTACCA.
 *
 * ─── IL TRANELLO DI QUESTO FILE ────────────────────────────────────────────
 *
 * Confrontare un'immunità con l'oracolo è vacuo: zero uguale a zero passa
 * anche se il motore non ha mai sentito nominare l'abilità, perché senza
 * implementazione il colpo... fa danno, e allora non passa. Ma basta un errore
 * nell'altro verso — un'immunità di TIPO che copre già il caso — e il
 * confronto torna verde senza dire niente.
 *
 * Per questo ogni caso ha il suo gemello: la STESSA mossa contro lo STESSO
 * Pokémon senza l'abilità deve fare danno. Se non lo fa, il caso è muto e il
 * test lo dice invece di passare.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { MOSSE_ANNULLATE_DA_DAMP } from '../lib/rules.js'
import movesData from '../data/moves.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }
import it_ from '../locales/it.json' with { type: 'json' }
import { statMostrata } from '../lib/statMostrata.js'
import { emptyPokemon } from '../store/useCalcStore.js'
import { applyBoost, STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD, STAT_SPE } from '../lib/rules.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]

const att = (atkPokemon, atkAbility = null) => ({
  atkPokemon, atkSPs: SP, atkNature: null,
  atkAbility, atkItem: null, level: 50,
})
const dif = (defPokemon, defAbility = null) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const nostro = (attacker, defender, move) =>
  calculateDamage({ attacker, defender, move, field: {}, debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// I casi. `lato` dice chi porta l'abilità: quasi sempre il difensore, ma Damp
// vale anche dall'altra parte ed è l'unica ragione per cui questo campo esiste.
// ═══════════════════════════════════════════════════════════════════════════

const IMMUNITA = [
  //  nome                    attaccante           difensore                         mossa
  ['Sap Sipper',      att('venusaur'),   dif('azumarill', 'sap-sipper'),        'giga drain'],
  ['Water Absorb',    att('politoed'),   dif('vaporeon', 'water-absorb'),       'surf'],
  ['Dry Skin',        att('politoed'),   dif('toxicroak', 'dry-skin'),          'surf'],
  ['Volt Absorb',     att('manectric'),  dif('jolteon', 'volt-absorb'),         'thunderbolt'],
  ['Motor Drive',     att('manectric'),  dif('emolga', 'motor-drive'),          'thunderbolt'],
  ['Lightning Rod',   att('jolteon'),    dif('manectric', 'lightning-rod'),     'thunderbolt'],
  ['Earth Eater',     att('excadrill'),  dif('orthworm', 'earth-eater'),        'earthquake'],
  ['Bulletproof',     att('venusaur'),   dif('chesnaught', 'bulletproof'),      'energy ball'],
  // Le quattro senza una specie legale in M-B. La specie però esiste in
  // anagrafica, quindi l'oracolo le sa calcolare e il confronto è vero.
  ['Well-Baked Body', att('charizard'),  dif('dachsbun', 'well-baked-body'),    'flamethrower'],
  ['Storm Drain',     att('politoed'),   dif('gastrodon', 'storm-drain'),       'surf'],
  ['Wind Rider',      att('charizard'),  dif('brambleghast', 'wind-rider'),     'heat wave'],
  ['Wonder Guard',    att('politoed'),   dif('shedinja', 'wonder-guard'),       'surf'],
]

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti, letti e non creduti', () => {
  it('ogni abilità è davvero di quella specie', () => {
    const norm = s => String(s).toLowerCase().replace(/ /g, '-')
    const sbagliate = []
    for (const [nome, , d] of IMMUNITA) {
      const sue = (pokemonData[d.defPokemon]?.abilities ?? []).map(norm)
      if (!sue.includes(d.defAbility)) sbagliate.push(`${nome}: ${d.defPokemon} non ha ${d.defAbility}`)
    }
    expect(sbagliate).toEqual([])
  })

  it('le mosse portano i flag delle tre famiglie', () => {
    expect(movesData['energy ball'].bullet).toBe(true)
    expect(movesData['heat wave'].vento).toBe(true)
    // `vento` è il flag nuovo di questa sessione, e non è indovinabile dal
    // nome: quattordici mosse fra cui Blizzard, Petal Blizzard e Aeroblast,
    // che vento nel nome non ce l'hanno né in inglese né in italiano.
    expect(movesData['blizzard'].vento).toBe(true)
    expect(movesData['aeroblast'].vento).toBe(true)
    expect(movesData['flamethrower'].vento).toBeUndefined()
  })

  it('le quattro di Damp sono quelle del riferimento', () => {
    expect([...MOSSE_ANNULLATE_DA_DAMP].sort())
      .toEqual(['explosion', 'mind blown', 'misty explosion', 'self-destruct'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Ogni caso è vero, e ogni caso è VIVO
// ═══════════════════════════════════════════════════════════════════════════

describe('l\'immunità c\'è, e il caso non è muto', () => {
  for (const [nome, attacker, defender, move] of IMMUNITA) {
    it(`${nome}: la mossa non ha effetto`, () => {
      const r = nostro(attacker, defender, move)
      expect(r.immune, `${nome}: l'app mostra ancora un danno`).toBe(true)
      expect(r.rolls).toEqual([])
    })

    it(`${nome}: senza l'abilità la stessa mossa fa danno`, () => {
      // Il gemello che tiene onesto il caso sopra. Se questo fallisce, il
      // Pokémon era già immune per TIPO e il caso non provava niente.
      const senza = nostro(attacker, { ...defender, defAbility: null }, move)
      expect(senza.immune ?? false, `${nome}: era già immune per tipo — caso muto`).toBe(false)
      expect(senza.rolls.length).toBe(16)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Damp, che vale da tutt'e due i lati
// ═══════════════════════════════════════════════════════════════════════════

describe('Damp spegne quattro mosse, e anche a chi ce l\'ha', () => {
  it('sul DIFENSORE', () => {
    const r = nostro(att('swampert'), dif('politoed', 'damp'), 'explosion')
    expect(r.immune).toBe(true)
  })

  it('sull\'ATTACCANTE — la metà che è facile dimenticare', () => {
    // Il riferimento scrive `defAbility === "Damp" || attacker.ability ===
    // "Damp"`. Chi ce l'ha spegne queste mosse anche a sé stesso: un motore
    // che controllasse solo il difensore sarebbe metà abilità con l'aria di
    // essere intera.
    const r = nostro(att('politoed', 'damp'), dif('swampert'), 'explosion')
    expect(r.immune, 'Damp è implementata solo in difesa').toBe(true)
  })

  it('e il nome mostrato è di chi ce l\'ha davvero', () => {
    const daAtt = nostro(att('politoed', 'damp'), dif('swampert'), 'explosion')
    const daDif = nostro(att('swampert'), dif('politoed', 'damp'), 'explosion')
    expect(daAtt.abilityName).toBe(daDif.abilityName)
    expect(daAtt.abilityName).toBeTruthy()
  })

  it('su una mossa qualunque non fa niente', () => {
    const con  = nostro(att('swampert'), dif('politoed', 'damp'), 'surf')
    const senza = nostro(att('swampert'), dif('politoed'), 'surf')
    expect(con.rolls).toEqual(senza.rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Le due metà di Dry Skin
// ═══════════════════════════════════════════════════════════════════════════

describe('Dry Skin ha due metà in due punti diversi', () => {
  it('immune all\'Acqua', () => {
    expect(nostro(att('politoed'), dif('toxicroak', 'dry-skin'), 'surf').immune).toBe(true)
  })

  it('e prende ×1.25 dal Fuoco', () => {
    const con  = nostro(att('charizard'), dif('toxicroak', 'dry-skin'), 'flamethrower')
    const senza = nostro(att('charizard'), dif('toxicroak'), 'flamethrower')
    expect(con.maxDmg).toBeGreaterThan(senza.maxDmg)
    const rapporto = con.maxDmg / senza.maxDmg
    expect(rapporto).toBeGreaterThan(1.2)
    expect(rapporto).toBeLessThan(1.3)
  })

  it('il ×1.25 sta DOPO le ×1.5 nella catena, non prima dell\'aura', () => {
    // Fra il punto f e il punto g il riferimento calcola `tempBP`, cioè la
    // potenza su cui Technician decide se accendersi. La prima stesura aveva
    // messo Dry Skin prima di f: un modificatore di là dalla riga sbagliata
    // non sposta solo l'ordine di una moltiplicazione commutativa, sposta
    // una soglia.
    //
    // ─── LA MOSSA VA SCELTA, NON PRESA A CASO ────────────────────────────
    // La prima stesura usava Ember, potenza 40. Non serviva a niente: 40 ×
    // 1,25 fa 50, che è sotto la soglia comunque, quindi Tecnico restava
    // acceso da tutt'e due le parti e la rottura passava inosservata.
    // Misurato spostando davvero il blocco: zero rossi.
    //
    // Serve una mossa Fuoco che ATTRAVERSI la soglia una volta moltiplicata,
    // cioè con potenza fra 49 e 60. Incinerate è esattamente 60: con Dry Skin
    // al posto giusto `tempBP` vale 60 e Tecnico si accende; spostata prima di
    // f varrebbe 75 e Tecnico si spegnerebbe.
    expect(movesData['incinerate'].power).toBe(60)
    expect(movesData['incinerate'].power * 1.25).toBeGreaterThan(60)
    const conTecnico = nostro(att('toxtricity', 'technician'), dif('toxicroak', 'dry-skin'), 'incinerate')
    const senzaTecnico = nostro(att('toxtricity'), dif('toxicroak', 'dry-skin'), 'incinerate')
    expect(conTecnico.maxDmg, 'Dry Skin ha spento Tecnico: sta prima di `tempBP`')
      .toBeGreaterThan(senzaTecnico.maxDmg)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Wonder Guard è un filtro, non una resistenza
// ═══════════════════════════════════════════════════════════════════════════

describe('Wonder Guard lascia passare solo il super efficace', () => {
  it('la neutra è annullata, non ridotta', () => {
    // Il riferimento scrive `typeEffectiveness <= 1`, non `< 1`.
    const neutra = nostro(att('politoed'), dif('shedinja'), 'surf')
    expect(neutra.effectiveness).toBe(1)
    expect(nostro(att('politoed'), dif('shedinja', 'wonder-guard'), 'surf').immune).toBe(true)
  })

  it('la super efficace passa', () => {
    const r = nostro(att('gengar'), dif('shedinja', 'wonder-guard'), 'shadow ball')
    expect(r.effectiveness).toBeGreaterThan(1)
    expect(r.immune ?? false).toBe(false)
    expect(r.rolls.length).toBe(16)
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
    ...IMMUNITA.map(([nome, a, d, m]) => [nome, a, d, m, true]),
    // Gli stessi senza l'abilità: il riferimento deve dire che il colpo passa.
    ...IMMUNITA.map(([nome, a, d, m]) => [`${nome}, abilità spenta`, a, { ...d, defAbility: null }, m, false]),
    // Le due metà di Damp e il ×1.25 di Dry Skin.
    ['Damp sul difensore',  att('swampert'), dif('politoed', 'damp'), 'explosion', true],
    ['Damp sull\'attaccante', att('politoed', 'damp'), dif('swampert'), 'explosion', true],
    ['Dry Skin contro il Fuoco', att('charizard'), dif('toxicroak', 'dry-skin'), 'flamethrower', false],
    ['Wonder Guard, super efficace', att('gengar'), dif('shedinja', 'wonder-guard'), 'shadow ball', false],
  ]

  for (const [nome, attacker, defender, move, nullo] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker, defender, move, field: {} })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(rif.nullo, `${nome}: il riferimento non è d'accordo sul colpo nullo`).toBe(nullo)
      expect(nostro(attacker, defender, move).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. La seconda metà di cinque di loro: il boost
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── QUESTA PARTE NON HA UN ORACOLO, E VA DETTO ────────────────────────────
 *
 * Il riferimento implementa l'immunità di queste abilità e nient'altro:
 * «Lightning Rod» compare in una riga sola di tutto il vendor,
 * `damage_MASTER.js:1112`. Non è una sua svista — è lo stesso confine di Beast
 * Boost e della seconda metà di Rapidascesa, che il registro del divario ha
 * già misurato come non calcolate.
 *
 * Quindi qui non c'è nessun confronto roll per roll: i valori sono stati
 * CHIESTI a Simone e confermati da lui, come per Parental Bond e Skill Link.
 *
 * ─── UNA CONFERMA CHE NON MI ASPETTAVO ─────────────────────────────────────
 *
 * Le descrizioni nei locali dell'app dicevano già gli stessi numeri — «se
 * colpito da una, l'Attacco sale di 1 grado» su Mangiaerba, «l'Attacco
 * Speciale sale di 1 grado» su Parafulmine. Erano lì da prima, e l'app le
 * mostrava senza applicarle: è esattamente il difetto che il presidio
 * `descrizioniSilenziose` esiste per registrare.
 *
 * Il test qui sotto le usa come SECONDA FONTE: se un giorno la tabella delle
 * abilità e il testo mostrato all'utente divergessero, diventa rosso.
 */
describe('cinque di loro alzano anche una statistica', () => {
  const CINQUE = [
    ['Sap Sipper',      'azumarill', 'sap-sipper',      STAT_ATT, 1],
    ['Lightning Rod',   'manectric', 'lightning-rod',   STAT_SPA, 1],
    ['Storm Drain',     'gastrodon', 'storm-drain',     STAT_SPA, 1],
    ['Motor Drive',     'emolga',    'motor-drive',     STAT_SPE, 1],
    ['Well-Baked Body', 'dachsbun',  'well-baked-body', STAT_DEF, 2],
  ]

  for (const [nome, specie, chiave, statIdx, gradi] of CINQUE) {
    it(`${nome}: l'interruttore alza la statistica giusta di ${gradi}`, () => {
      const base = { ...emptyPokemon(), key: specie, ability: chiave }
      const acceso = {
        ...base,
        abilityFlags: { ...emptyPokemon().abilityFlags, assorbimentoAttivo: true },
      }

      // Spento: niente si muove, su nessuna delle cinque statistiche.
      for (const i of [STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD, STAT_SPE]) {
        expect(statMostrata(base, i).modificata, `${nome}: si muove da spento`).toBe(false)
      }

      // Acceso: si muove SOLO quella, e del numero di gradi giusto.
      for (const i of [STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD, STAT_SPE]) {
        const r = statMostrata(acceso, i)
        if (i === statIdx) {
          expect(r.modificata, `${nome}: la statistica non si muove`).toBe(true)
          expect(r.effettiva, `${nome}: gradi sbagliati`)
            .toBe(applyBoost(r.grezza, gradi))
        } else {
          expect(r.modificata, `${nome}: muove anche un'altra statistica`).toBe(false)
        }
      }
    })
  }

  it('le tre che curano invece non alzano niente', () => {
    // Water Absorb, Volt Absorb ed Earth Eater recuperano PS, e il recupero
    // non è una cosa che il calcolo del danno modelli. Per loro c'è
    // l'immunità e basta: se un giorno qualcuno gli attaccasse un boost per
    // simmetria, questo test lo direbbe.
    for (const [specie, chiave] of [
      ['vaporeon', 'water-absorb'], ['jolteon', 'volt-absorb'], ['orthworm', 'earth-eater'],
    ]) {
      const acceso = {
        ...emptyPokemon(), key: specie, ability: chiave,
        abilityFlags: { ...emptyPokemon().abilityFlags, assorbimentoAttivo: true },
      }
      for (const i of [STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD, STAT_SPE]) {
        expect(statMostrata(acceso, i).modificata, `${chiave} alza qualcosa`).toBe(false)
      }
    }
  })

  it('il boost arriva anche al DANNO, non solo alla colonna', () => {
    // Manectric con Parafulmine che ha già assorbito: +1 Att. Speciale, quindi
    // le sue mosse speciali fanno più male. Se il flag si fermasse
    // all'interfaccia, questi due numeri sarebbero uguali.
    const conBoost = calculateDamage({
      attacker: {
        atkPokemon: 'manectric', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
        atkAbility: 'lightning-rod', atkItem: null, level: 50,
        atkAbilityFlags: { assorbimentoAttivo: true },
      },
      defender: {
        defPokemon: 'incineroar', defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
        defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
      },
      move: 'thunderbolt', field: {}, debug: false,
    })
    const senza = calculateDamage({
      attacker: {
        atkPokemon: 'manectric', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
        atkAbility: 'lightning-rod', atkItem: null, level: 50,
        atkAbilityFlags: {},
      },
      defender: {
        defPokemon: 'incineroar', defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
        defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
      },
      move: 'thunderbolt', field: {}, debug: false,
    })
    expect(conBoost.maxDmg, 'il flag non arriva al motore').toBeGreaterThan(senza.maxDmg)
  })

  it('i numeri combaciano con le descrizioni che l\'app mostra già', () => {
    // La seconda fonte. Le descrizioni erano nei locali da prima che il boost
    // fosse implementato: se tabella e testo divergono, uno dei due mente.
    const cifre = { 1: /\b1 grado\b/, 2: /\b2 gradi\b/ }
    const statNelTesto = {
      [STAT_ATT]: /Attacco(?! Speciale)/,
      [STAT_DEF]: /Difesa/,
      [STAT_SPA]: /Attacco Speciale/,
      [STAT_SPE]: /Velocità/,
    }
    for (const [nome, , chiave, statIdx, gradi] of CINQUE) {
      const testo = it_.abilities_desc[chiave]
      expect(testo, `${nome}: manca la descrizione`).toBeTruthy()
      expect(cifre[gradi].test(testo), `${nome}: la descrizione non dice ${gradi} gradi`).toBe(true)
      expect(statNelTesto[statIdx].test(testo), `${nome}: la descrizione nomina un'altra statistica`).toBe(true)
    }
  })
})
