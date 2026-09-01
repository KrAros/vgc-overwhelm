// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/rovina.test.js
 *
 * Le quattro Rovina: Tablets, Vessel, Sword, Beads of Ruin.
 *
 * ─── COSA FANNO ────────────────────────────────────────────────────────────
 *
 * Ognuna abbassa di un quarto (×0,75, `0x0C00`) una statistica di TUTTI gli
 * altri in campo:
 *
 *     Tablets of Ruin  → Attacco            `damage_MASTER.js:1913`
 *     Vessel of Ruin   → Attacco Speciale   `:1917`
 *     Sword of Ruin    → Difesa             `:2082`
 *     Beads of Ruin    → Difesa Speciale    `:2086`
 *
 * Un portatore ciascuna: Wo-Chien, Ting-Lu, Chien-Pao, Chi-Yu.
 *
 * ─── DUE CATENE DIVERSE ────────────────────────────────────────────────────
 *
 * Tablets e Vessel stanno nella catena della statistica d'ATTACCO, Sword e
 * Beads in quella della DIFESA. In tutt'e due sono la PRIMA cosa della catena.
 * Non e' un dettaglio estetico: `chainMods` accumula in virgola fissa, e con
 * tre o piu' modificatori la posizione cambia il numero.
 *
 * ─── IL PORTATORE E' ESENTE DA SE' STESSO ──────────────────────────────────
 *
 * L'Attacco di Wo-Chien non viene abbassato dal proprio Tablets of Ruin
 * (`attacker.ability !== "Tablets of Ruin"` nel riferimento). Confermato da
 * Simone.
 *
 * ─── E NELLO SPECCHIO NON SI ANNULLANO ─────────────────────────────────────
 *
 * Wo-Chien contro Wo-Chien e' il caso che distingue la trascrizione giusta da
 * quella comoda. Scrivere «se l'ALTRO ce l'ha, abbassa» sembra equivalente nel
 * nostro modello a due Pokemon — e non lo e': con tutt'e due portatori la
 * scorciatoia abbassa, il riferimento no.
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

const att = (atkPokemon, atkAbility = null, atkItem = null) => ({
  atkPokemon, atkSPs: SP, atkNature: null, atkAbility, atkItem, level: 50,
})
const dif = (defPokemon, defAbility = null, defItem = null) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const campo = () => buildField({ doubleTarget: true }, 't1')
const calcola = (attacker, defender, move) =>
  calculateDamage({ attacker, defender, move, field: campo(), debug: false })

/**
 * Le quattro, con: portatore, categoria della mossa su cui agiscono, chi
 * SUBISCE l'abbassamento, e da che parte va il danno.
 *
 * ─── PERCHE' DUE VERSI ──────────────────────────────────────────────────────
 *
 * Tablets e Vessel abbassano una statistica di chi ATTACCA, quindi il danno
 * cala. Sword e Beads abbassano una statistica di chi SUBISCE, quindi il danno
 * SALE — un quarto in meno alla difesa e' un terzo in piu' di danno.
 *
 * La prima stesura di questi test dava per scontato che «Rovina» volesse dire
 * «meno danno» per tutt'e quattro, ed e' diventata rossa su Sword e Beads. Il
 * motore aveva ragione: le due che tolgono difesa aumentano il danno.
 */
const ROVINE = [
  {
    nome: 'Tablets of Ruin', chiave: 'tablets-of-ruin', portatore: 'wo-chien',
    lato: 'attaccante', categoria: 'fisica', mossa: 'iron head', verso: 'giu',
  },
  {
    nome: 'Vessel of Ruin', chiave: 'vessel-of-ruin', portatore: 'ting-lu',
    lato: 'attaccante', categoria: 'speciale', mossa: 'flamethrower', verso: 'giu',
  },
  {
    nome: 'Sword of Ruin', chiave: 'sword-of-ruin', portatore: 'chien-pao',
    lato: 'difensore', categoria: 'fisica', mossa: 'iron head', verso: 'su',
  },
  {
    nome: 'Beads of Ruin', chiave: 'beads-of-ruin', portatore: 'chi-yu',
    lato: 'difensore', categoria: 'speciale', mossa: 'flamethrower', verso: 'su',
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti, letti e non creduti', () => {
  for (const { nome, chiave, portatore } of ROVINE) {
    it(`${nome}: ${portatore} ce l'ha davvero, ed e' l'unico`, () => {
      expect(pokemonData[portatore].abilities).toContain(chiave)
      const tutti = Object.keys(pokemonData)
        .filter(k => (pokemonData[k].abilities ?? []).includes(chiave))
      expect(tutti, 'se un giorno ne arriva un secondo, questi test vanno riletti')
        .toEqual([portatore])
    })
  }

  it('le quattro voci esistono e dicono quale delle quattro sono', () => {
    expect(ROVINE.map(r => ABILITY_EFFECTS[r.chiave]?.ruin))
      .toEqual(['tablets', 'vessel', 'sword', 'beads'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Abbassano, e del quarto giusto
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Il metro: un Pokemon qualunque colpisce un altro Pokemon qualunque, e da una
 * parte sola dei due si accende la Rovina. Il danno deve calare, e calare del
 * quarto — non «di qualcosa».
 *
 * Il rapporto e' vicino a 0,75 ma non esattamente: la statistica passa per
 * `pokeRound` e il danno per un `floor`, quindi il quarto si vede con un po'
 * di gioco. Le soglie sono larghe abbastanza da lasciare passare
 * l'arrotondamento e strette abbastanza da bocciare un ×0,5 o un ×1.
 */
describe('ognuna toglie un quarto alla statistica che le compete', () => {
  for (const { nome, chiave, portatore, lato, mossa, verso } of ROVINE) {
    const atteso = verso === 'giu'
      ? { min: 0.72, max: 0.79, dice: 'cala di circa un quarto' }
      : { min: 1.28, max: 1.39, dice: 'sale di circa un terzo' }

    it(`${nome}: il danno ${atteso.dice}`, () => {
      const attaccante = lato === 'attaccante' ? 'incineroar' : portatore
      const difensore  = lato === 'attaccante' ? portatore    : 'incineroar'

      const con = lato === 'attaccante'
        ? calcola(att(attaccante), dif(difensore, chiave), mossa)
        : calcola(att(attaccante, chiave), dif(difensore), mossa)
      const senza = calcola(att(attaccante), dif(difensore), mossa)

      // Il rapporto, non solo il verso: un ×0,5 scritto per sbaglio passerebbe
      // un test che chiedesse soltanto «e' cambiato».
      const rapporto = con.maxDmg / senza.maxDmg
      expect(rapporto, `${nome}: non e' un quarto di statistica`)
        .toBeGreaterThan(atteso.min)
      expect(rapporto, `${nome}: non e' un quarto di statistica`)
        .toBeLessThan(atteso.max)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Ognuna colpisce la SUA statistica e non le altre
// ═══════════════════════════════════════════════════════════════════════════

describe('sulla categoria sbagliata non fanno niente', () => {
  for (const { nome, chiave, portatore, lato, categoria } of ROVINE) {
    // La mossa dell'altra categoria: se Tablets (Attacco) toccasse anche una
    // mossa speciale, sarebbe scritta nel posto sbagliato della catena o senza
    // il controllo di categoria.
    const mossaAltra = categoria === 'fisica' ? 'flamethrower' : 'iron head'

    it(`${nome} non tocca le mosse ${categoria === 'fisica' ? 'speciali' : 'fisiche'}`, () => {
      const attaccante = lato === 'attaccante' ? 'incineroar' : portatore
      const difensore  = lato === 'attaccante' ? portatore    : 'incineroar'

      const con = lato === 'attaccante'
        ? calcola(att(attaccante), dif(difensore, chiave), mossaAltra)
        : calcola(att(attaccante, chiave), dif(difensore), mossaAltra)
      const senza = calcola(att(attaccante), dif(difensore), mossaAltra)

      expect(con.rolls).toEqual(senza.rolls)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Il portatore e' esente da se' stesso
// ═══════════════════════════════════════════════════════════════════════════

describe('la propria Rovina non abbassa la propria statistica', () => {
  it('Wo-Chien attacca: il suo Tablets of Ruin non gli abbassa l\'Attacco', () => {
    const conAbilita = calcola(att('wo-chien', 'tablets-of-ruin'), dif('incineroar'), 'iron head')
    const senza      = calcola(att('wo-chien', null),              dif('incineroar'), 'iron head')
    expect(conAbilita.rolls, 'si sta abbassando da solo').toEqual(senza.rolls)
  })

  it('Chien-Pao subisce: il suo Sword of Ruin non gli abbassa la Difesa', () => {
    const conAbilita = calcola(att('incineroar'), dif('chien-pao', 'sword-of-ruin'), 'iron head')
    const senza      = calcola(att('incineroar'), dif('chien-pao', null),            'iron head')
    expect(conAbilita.rolls, 'si sta abbassando da solo').toEqual(senza.rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Lo specchio: il caso che boccia la scorciatoia
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wo-Chien contro Wo-Chien, tutt'e due con Tablets of Ruin.
 *
 * La casella e' accesa — c'e' un Tablets in campo — ma chi attacca E' il
 * portatore, quindi il riferimento non abbassa niente. Scrivere «se l'altro ce
 * l'ha, abbassa» darebbe un danno piu' basso, e sarebbe sbagliato.
 *
 * E' l'unico caso che separa le due scritture, perche' e' l'unico in cui la
 * Rovina e' in campo da tutt'e due i lati.
 */
describe('nello specchio non si abbassano a vicenda', () => {
  for (const [nome, chiave, portatore, mossa] of [
    ['Tablets of Ruin', 'tablets-of-ruin', 'wo-chien',  'iron head'],
    ['Vessel of Ruin',  'vessel-of-ruin',  'ting-lu',   'flamethrower'],
    ['Sword of Ruin',   'sword-of-ruin',   'chien-pao', 'iron head'],
    ['Beads of Ruin',   'beads-of-ruin',   'chi-yu',    'flamethrower'],
  ]) {
    it(`${nome} contro ${nome}: nessuno dei due cala`, () => {
      const specchio = calcola(
        att(portatore, chiave), dif(portatore, chiave), mossa)
      const spente = calcola(
        att(portatore, null), dif(portatore, null), mossa)
      expect(specchio.rolls, `${nome}: lo specchio abbassa, e non deve`)
        .toEqual(spente.rolls)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 5-bis. Cosa questi test NON dimostrano, e perche'
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── LA POSIZIONE NELLA CATENA NON E' OSSERVABILE. MISURATA. ───────────────
 *
 * Nel riferimento la Rovina e' la PRIMA cosa di tutt'e due le catene (punto a
 * di `calcAtMods` e di `calcDefMods`). Qui e' scritta li'. Ma nessun test lo
 * dimostra, perche' nessun caso puo' dimostrarlo — e questo va detto, non
 * lasciato credere.
 *
 * Cercato in tre modi:
 *
 * 1. Spostando il ×0,75 in CODA a `atMods` (applicato lo stesso, solo per
 *    ultimo) e ricalcolando 27.080 casi — tutte le specie, ogni loro abilita',
 *    cinque strumenti, contro Wo-Chien e Ting-Lu. Divergenti: ZERO.
 *
 * 2. Lo stesso su `dfMods`, con Chien-Pao contro i tre paradosso la cui Difesa
 *    e' la statistica piu' alta, su tutte le mosse fisiche. Divergenti: ZERO.
 *
 * 3. Sul moltiplicatore, senza passare dal danno: `chainMods` accumula in
 *    virgola fissa e arrotonda a ogni passo, quindi in generale l'ordine
 *    CONTA. Su tutte le sequenze fino a quattro modificatori la posizione
 *    cambia il risultato in 151 casi su 781. Ma quelle sequenze non sono
 *    raggiungibili: i punti d, e e g della catena d'attacco sono tutti
 *    abilita' di chi attacca, e lo slot e' uno solo; il punto h e'
 *    un'abilita' di chi subisce, che pero' porta gia' la Rovina; i punti i e j
 *    sono strumenti, e lo strumento e' uno. Restano 12 combinazioni davvero
 *    componibili, e in nessuna delle 12 la posizione cambia il numero. In
 *    difesa, 10 su 10 uguali.
 *
 * Quindi la posizione e' scritta giusta per fedelta' al riferimento, non
 * perche' un test la difenda. Il giorno in cui la catena si allunga — Slow
 * Start e Defeatist portano un altro ×0,5, Orichalcum Pulse un ×1,333 — questa
 * misura va rifatta: potrebbe diventare osservabile, e allora un caso va
 * aggiunto.
 */
it('registro: la posizione della Rovina nella catena non e\' osservabile', () => {
  // Non c'e' niente da eseguire. Il test esiste perche' la misura sopra non
  // finisca in un commento che nessuno rilegge quando la catena cambia.
  expect(true).toBe(true)
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

  // Attaccante, difensore, mossa. Ogni riga e' un caso che il riferimento sa
  // rifare: le quattro accese, le quattro spente, i quattro specchi, e i due
  // casi col portatore che attacca o subisce da solo.
  const CASI = []
  for (const { nome, chiave, portatore, lato, mossa, categoria } of ROVINE) {
    const attaccante = lato === 'attaccante' ? 'incineroar' : portatore
    const difensore  = lato === 'attaccante' ? portatore    : 'incineroar'
    const a = lato === 'attaccante' ? att(attaccante) : att(attaccante, chiave)
    const d = lato === 'attaccante' ? dif(difensore, chiave) : dif(difensore)

    CASI.push([`${nome} accesa`, a, d, mossa])
    CASI.push([`${nome} spenta`, att(attaccante), dif(difensore), mossa])
    CASI.push([`${nome} sulla categoria sbagliata`, a, d,
      categoria === 'fisica' ? 'flamethrower' : 'iron head'])
    CASI.push([`${nome} nello specchio`,
      att(portatore, chiave), dif(portatore, chiave), mossa])
  }

  // Con altri modificatori nella stessa catena: e' quello che rende osservabile
  // la POSIZIONE della Rovina, non solo la sua presenza. Il Choice Band sta
  // nella catena dell'attacco (punto j), l'Eviolite in quella della difesa.
  CASI.push([
    'Tablets of Ruin col Choice Band (due modificatori nella catena d\'attacco)',
    att('incineroar', null, 'choice band'), dif('wo-chien', 'tablets-of-ruin'), 'iron head',
  ])
  CASI.push([
    'Sword of Ruin contro l\'Assault Vest (due modificatori nella catena di difesa)',
    att('chien-pao', 'sword-of-ruin'), dif('incineroar', null, 'assault vest'), 'flamethrower',
  ])
  CASI.push([
    'Beads of Ruin contro l\'Assault Vest',
    att('chi-yu', 'beads-of-ruin'), dif('incineroar', null, 'assault vest'), 'flamethrower',
  ])

  for (const [nome, attacker, defender, mossa] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const f = campo()
      const rif = harness.calcola({ attacker, defender, move: mossa, field: f })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(
        calculateDamage({ attacker, defender, move: mossa, field: f, debug: false }).rolls,
        `${nome}: divergiamo dal riferimento`,
      ).toEqual(rif.rolls)
    })
  }
})
