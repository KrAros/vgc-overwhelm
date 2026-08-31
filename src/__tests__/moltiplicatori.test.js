// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/moltiplicatori.test.js
 *
 * Dodici abilità che moltiplicano e basta, prese in un colpo solo perché nel
 * riferimento sono dodici clausole dentro cinque punti già scritti: nessuna
 * di loro inventa un anello nuovo della catena.
 *
 *   catena della STATISTICA (`calcAtkMods`)
 *     punto d, :1941-1955   Dragon's Maw, Steelworker, Rocky Payload,
 *                           Sharpness, Gorilla Tactics          ×1.5
 *     punto e, :1965        Transistor                          ×1.3
 *
 *   catena della POTENZA (`calcBPMods`)
 *     punto c.ii, :1604     Iron Fist, Reckless                 ×1.2
 *     punto e.v,  :1649     Punk Rock, quando attacca           ×1.3
 *
 *   modificatori FINALI (`calcFinalMods`)
 *     punto b, :2336        Neuroforce, se super efficace       ×1.25
 *     punto d, :2346        Sniper, sul colpo critico           ×1.5
 *     punto e, :2351        Tinted Lens, se poco efficace       ×2
 *     punto i, :2370        Punk Rock, quando difende           ×0.5
 *
 * ─── I DUE PUNTI DOVE UNA LETTURA DISTRATTA SBAGLIA ────────────────────────
 *
 * 1. TRANSISTOR NON È UNA ×1.5. Nel riferimento compare due volte: a `:1946`
 *    dentro il ramo delle ×1.5 con la condizione `gen == 8`, e a `:1965` nel
 *    ramo successivo con `gen >= 9`. Noi giriamo a `gen = 10`, quindi vale il
 *    secondo. Chi si fermasse alla prima riga trovata darebbe un numero
 *    plausibile e sbagliato del quindici per cento — e nessun test che
 *    guardasse solo «con l'abilità fa più danno» se ne accorgerebbe.
 *
 * 2. RECKLESS NON GUARDA SOLO IL CONTRACCOLPO. Il riferimento chiede
 *    `move.hasRecoil || move.recoilHP || move.hasCrash`: le ultime quattro
 *    sono le mosse che feriscono chi MANCA il bersaglio, non chi colpisce.
 *    Noi avevamo già un campo `recoil` in moves.json, ma è la frazione del
 *    contraccolpo e copre solo le prime tredici. Usarlo avrebbe dato il numero
 *    giusto su tredici mosse e quello sbagliato su tre — vedi il caso di
 *    Calciosalto in fondo, che esiste per questo.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import movesData from '../data/moves.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]

const att = (atkPokemon, atkAbility) => ({
  atkPokemon, atkSPs: SP, atkNature: null,
  atkAbility, atkItem: null, level: 50,
})
const dif = (defPokemon, defAbility = null) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const nostro = (attacker, defender, move, field = {}) =>
  calculateDamage({ attacker, defender, move, field, debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// I casi. Ognuno nomina la specie che l'abilità ce l'ha davvero: usare un
// Pokémon a caso col nome dell'abilità appiccicato sopra farebbe passare i
// test e non direbbe niente su cosa vede l'utente.
// ═══════════════════════════════════════════════════════════════════════════

const CASI = [
  // ── catena della statistica, ×1.5 ────────────────────────────────────────
  ['Dragon\'s Maw',  att('regidrago',  'dragons-maw'),   dif('incineroar'), 'dragon claw'],
  ['Steelworker',    att('dhelmise',   'steelworker'),   dif('incineroar'), 'iron head'],
  ['Rocky Payload',  att('bombirdier', 'rocky-payload'), dif('incineroar'), 'rock slide'],
  // Il bersaglio NON è Incineroar come gli altri: Psycocolpo è Psico e
  // Incineroar è Buio, cioè immune. Il confronto con l'oracolo sarebbe
  // passato lo stesso — zero uguale a zero — e non avrebbe detto niente.
  // L'ha trovato il test «senza l'abilità il numero cambia», che è lì apposta.
  ['Sharpness',      att('gallade',    'sharpness'),     dif('regidrago'),  'psycho cut'],
  // ── catena della statistica, ×1.3 ────────────────────────────────────────
  ['Transistor',     att('regieleki',  'transistor'),    dif('incineroar'), 'thunderbolt'],
  // ── catena della potenza ─────────────────────────────────────────────────
  ['Iron Fist',      att('infernape',  'iron-fist'),     dif('incineroar'), 'mach punch'],
  ['Reckless',       att('staraptor',  'reckless'),      dif('incineroar'), 'brave bird'],
  ['Reckless su una mossa che ferisce chi MANCA',
                     att('hitmonlee',  'reckless'),      dif('incineroar'), 'high jump kick'],
  ['Punk Rock in attacco',
                     att('toxtricity', 'punk-rock'),     dif('incineroar'), 'overdrive'],
  // ── modificatori finali ──────────────────────────────────────────────────
  ['Neuroforce',     att('necrozma-ultra', 'neuroforce'), dif('regidrago'), 'dragon claw'],
  ['Sniper',         att('beedrill',   'sniper'),        dif('gallade'),    'poison jab', { crit: true }],
  ['Tinted Lens',    att('butterfree', 'tinted-lens'),   dif('charizard'),  'bug buzz'],
  ['Punk Rock in difesa',
                     att('incineroar', null),            dif('toxtricity', 'punk-rock'), 'snarl'],
]

// ═══════════════════════════════════════════════════════════════════════════
// 1. I fatti su cui poggiano i test, letti dai dati invece che creduti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti, letti e non creduti', () => {
  it('ogni abilità è davvero di quella specie', () => {
    const norm = s => String(s).toLowerCase().replace(/ /g, '-')
    const sbagliate = []
    for (const [nome, a, d] of CASI) {
      const chiave = a.atkAbility ?? d.defAbility
      const specie = a.atkAbility ? a.atkPokemon : d.defPokemon
      const sue = (pokemonData[specie]?.abilities ?? []).map(norm)
      if (!sue.includes(chiave)) sbagliate.push(`${nome}: ${specie} non ha ${chiave}`)
    }
    expect(sbagliate, 'un caso che poggia su un Pokémon che quell\'abilità non può avere')
      .toEqual([])
  })

  it('le mosse portano i flag che le condizioni guardano', () => {
    expect(movesData['psycho cut'].slicing).toBe(true)
    expect(movesData['mach punch'].punch).toBe(true)
    expect(movesData['overdrive'].sound).toBe(true)
    expect(movesData['snarl'].sound).toBe(true)
    // Le due facce di `rinculo`: Baldeali si ferisce colpendo, Calciosalto si
    // ferisce MANCANDO. Nel vendor sono due campi diversi, `recoilHP` e
    // `hasCrash`; da noi sono lo stesso flag perché il riferimento le mette
    // in `or` nella stessa condizione.
    expect(movesData['brave bird'].rinculo).toBe(true)
    expect(movesData['high jump kick'].rinculo).toBe(true)
    // E questa è la differenza col campo che avevamo già: `recoil` — la
    // frazione che il pannello scrive — su Calciosalto non c'è.
    expect(movesData['brave bird'].recoil).toBeTruthy()
    expect(movesData['high jump kick'].recoil).toBeUndefined()
  })

  it('le efficacie sono quelle che le tre finali richiedono', () => {
    // Neuroforce vuole > 1, Tinted Lens < 1. Se un giorno la tabella dei tipi
    // cambiasse, i due casi diventerebbero muti senza diventare rossi.
    const superEff = nostro(att('necrozma-ultra', null), dif('regidrago'), 'dragon claw')
    const pocoEff  = nostro(att('butterfree', null), dif('charizard'), 'bug buzz')
    expect(superEff.effectiveness).toBeGreaterThan(1)
    expect(pocoEff.effectiveness).toBeLessThan(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. L'oracolo: il riferimento eseguito, roll per roll
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

  for (const [nome, attacker, defender, move, field = {}] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker, defender, move, field })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(attacker, defender, move, field).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })

    // Lo stesso caso senza l'abilità. Serve a due cose: prova che l'abilità
    // sposta davvero il numero (un'implementazione che non fa niente passa il
    // test qui sopra, perché anche il riferimento senza abilità non fa niente
    // — ma non passa questo), e tiene onesto il confronto.
    it.runIf(vendorPresente)(`${nome}: senza l'abilità il numero cambia`, () => {
      const spento = attacker.atkAbility
        ? [{ ...attacker, atkAbility: null }, defender]
        : [attacker, { ...defender, defAbility: null }]
      const conAbilita = nostro(attacker, defender, move, field)
      const senza = nostro(spento[0], spento[1], move, field)
      expect(conAbilita.rolls, `${nome}: l'abilità non sposta niente`)
        .not.toEqual(senza.rolls)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Transistor: il numero, non solo il verso
// ═══════════════════════════════════════════════════════════════════════════

describe('Transistor vale ×1.3, non ×1.5', () => {
  // Il confronto con l'oracolo qui sopra lo prova già. Questo test lo dice a
  // voce alta, perché è l'errore che il riferimento invita a fare: la riga
  // con `0x1800` viene prima di quella con `0x14CD`, e cercando «Transistor»
  // si trova quella.
  it('il rapporto col caso senza abilità è quello del ×1.3', () => {
    const a = att('regieleki', 'transistor')
    const senza = nostro(att('regieleki', null), dif('incineroar'), 'thunderbolt')
    const con   = nostro(a, dif('incineroar'), 'thunderbolt')

    const rapporto = con.maxDmg / senza.maxDmg
    expect(rapporto).toBeGreaterThan(1.25)
    expect(rapporto).toBeLessThan(1.35)
  })

  it('non è nel ramo delle ×1.5: ha un flag suo', () => {
    expect(ABILITY_EFFECTS['transistor'].boostTipoAtk).toBeUndefined()
    expect(ABILITY_EFFECTS['transistor'].transistor).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Punk Rock ha due versi, e li ha tutt'e due
// ═══════════════════════════════════════════════════════════════════════════

describe('Punk Rock in attacco e in difesa', () => {
  it('un solo flag, letto da due punti della catena', () => {
    expect(ABILITY_EFFECTS['punk-rock']).toEqual({ punkRock: true, showInSmogon: true })
  })

  it('in attacco alza, in difesa abbassa', () => {
    const su  = nostro(att('toxtricity', 'punk-rock'), dif('incineroar'), 'overdrive')
    const suNo = nostro(att('toxtricity', null), dif('incineroar'), 'overdrive')
    expect(su.maxDmg).toBeGreaterThan(suNo.maxDmg)

    const giu   = nostro(att('incineroar', null), dif('toxtricity', 'punk-rock'), 'snarl')
    const giuNo = nostro(att('incineroar', null), dif('toxtricity', null), 'snarl')
    expect(giu.maxDmg).toBeLessThan(giuNo.maxDmg)
  })

  it('su una mossa NON sonora non fa niente, da nessuno dei due lati', () => {
    // Se qualcuno un giorno togliesse il controllo sul flag `sound`,
    // Punk Rock diventerebbe un ×1.3 su tutto e un ×0.5 su tutto.
    const conAtt = nostro(att('toxtricity', 'punk-rock'), dif('incineroar'), 'thunderbolt')
    const senzAtt = nostro(att('toxtricity', null), dif('incineroar'), 'thunderbolt')
    expect(conAtt.rolls).toEqual(senzAtt.rolls)

    const conDif = nostro(att('incineroar', null), dif('toxtricity', 'punk-rock'), 'knock off')
    const senzDif = nostro(att('incineroar', null), dif('toxtricity', null), 'knock off')
    expect(conDif.rolls).toEqual(senzDif.rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Le tre finali si sommano fra loro
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── UNA COSA CHE NON RIESCO A METTERE SOTTO TEST, E LO DICO ───────────────
 *
 * Nel riferimento b, d ed e sono tre `if` INDIPENDENTI, mentre c.ii ed e.v
 * sono anelli di catene `else if`. Il motore li ha trascritti così. Ma la
 * differenza fra le due forme si vede solo quando DUE delle tre condizioni
 * sono vere insieme, e non può succedere: Neuroforce, Sniper e Tinted Lens
 * sono tutte e tre abilità di chi attacca, e un Pokémon ha una abilità sola.
 *
 * Misurato, non supposto: riscrivendo i tre `if` come catena `else if`, in
 * questo file non diventa rosso NIENTE. La forma è difesa dalla lettura del
 * riferimento, non da un test — come il flag `prioritaria` in
 * `gen-flag-dati.mjs`, per la stessa ragione e con la stessa onestà.
 *
 * Diventerebbe osservabile il giorno che una casella di campo, una copia
 * dell'abilità o un Neutralizing Gas facessero coesistere due di queste tre.
 */
describe('le tre finali fanno ognuna il suo mestiere', () => {
  it('un critico poco efficace prende Tinted Lens, e il critico resta', () => {
    const a = att('butterfree', 'tinted-lens')
    const d = dif('charizard')
    const normale = nostro(a, d, 'bug buzz')
    const critico = nostro(a, d, 'bug buzz', { crit: true })
    expect(critico.maxDmg).toBeGreaterThan(normale.maxDmg)
  })

  it('Sniper non fa niente senza critico', () => {
    const a = att('beedrill', 'sniper')
    const d = dif('gallade')
    expect(nostro(a, d, 'poison jab').rolls)
      .toEqual(nostro(att('beedrill', null), d, 'poison jab').rolls)
  })

  it('Neuroforce non fa niente su un\'efficacia neutra', () => {
    // Gallade e non Incineroar, per la stessa ragione del caso di Sharpness:
    // Psico contro Buio è immune, e un'immunità non è un'efficacia neutra.
    const d = dif('gallade')
    const neutra = nostro(att('necrozma-ultra', null), d, 'psychic')
    expect(neutra.effectiveness).toBe(1)
    expect(nostro(att('necrozma-ultra', 'neuroforce'), d, 'psychic').rolls)
      .toEqual(neutra.rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. Gorilla Tactics: implementata e irraggiungibile
// ═══════════════════════════════════════════════════════════════════════════

describe('Gorilla Tactics non ha una specie che possa portarla', () => {
  /**
   * È la dodicesima delle dodici, sta nella stessa riga del riferimento delle
   * altre cinque ×1.5, ed è implementata come loro. Ma in Champions nessuna
   * specie ce l'ha: Darmanitan-Galar, che nei giochi principali la porta, nel
   * dex non c'è — c'è `darmanitan` con Sheer Force e Zen Mode.
   *
   * Sta in `abilities.json`, quindi il registro del divario la contava fra le
   * 95 e adesso la conta fra le calcolate. Il registro dice «selezionabile»,
   * ma selezionabile vuol dire «esiste nell'elenco», non «un Pokémon può
   * averla»: `abilitaPerSpecie` la rifiuterebbe su qualunque slot.
   *
   * Questo test non la aggiusta. La REGISTRA: se un giorno il dex prendesse
   * una specie che la porta, il test diventa rosso e qualcuno viene a leggere
   * questa nota invece di scoprire il buco da un numero sbagliato.
   */
  it('nessuna specie del dex la porta', () => {
    const norm = s => String(s).toLowerCase().replace(/ /g, '-')
    const portatrici = Object.entries(pokemonData)
      .filter(([, v]) => (v.abilities ?? []).map(norm).includes('gorilla-tactics'))
      .map(([k]) => k)
    expect(portatrici, 'ora è raggiungibile: togli questo test e mettine uno contro l\'oracolo')
      .toEqual([])
  })

  it('ma l\'effetto c\'è, e ×1.5 sul fisico', () => {
    // Verificabile solo forzando l'abilità su una specie che non ce l'ha —
    // cosa che l'interfaccia non permette, e che qui si fa apposta.
    const con  = nostro(att('incineroar', 'gorilla-tactics'), dif('gallade'), 'knock off')
    const senza = nostro(att('incineroar', null), dif('gallade'), 'knock off')
    expect(con.maxDmg).toBeGreaterThan(senza.maxDmg)
  })

  it('e non tocca le mosse speciali', () => {
    const con  = nostro(att('incineroar', 'gorilla-tactics'), dif('gallade'), 'snarl')
    const senza = nostro(att('incineroar', null), dif('gallade'), 'snarl')
    expect(con.rolls).toEqual(senza.rolls)
  })
})
