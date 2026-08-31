// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/costoZero.test.js
 *
 * Sette abilità che il motore poteva già calcolare e non calcolava: non
 * chiedono nessuno stato nuovo, nessuna casella, nessun dato che non ci fosse.
 *
 *   Shell Armor, Battle Armor   il critico non si applica    critMove:1018
 *   Air Lock, Cloud Nine        il meteo sparisce            checkAirLock:411
 *   Analytic                    ×1.3 se non muovi per primo  calcBPMods:1639
 *   Liquid Voice                le sonore diventano Acqua    :1063
 *   Hustle                      ×1.5 Attacco fisico          calcAttack:1896
 *
 * ─── I DUE PUNTI DOVE SI SBAGLIA ───────────────────────────────────────────
 *
 * 1. ANALYTIC NON GUARDA LA VELOCITÀ EFFETTIVA. Il riferimento ricava l'ordine
 *    di turno da sé, in una riga (`damage_SV.js:147`), confrontando `stats[SP]`
 *    — la Velocità con gli STADI e nient'altro. Niente Choice Scarf, niente
 *    meteo, niente Tailwind, niente ×1.5 del paradosso.
 *
 *    Il motore ha già `calcEffectiveSpe`, che tutte quelle cose le sa. Usarla
 *    qui sarebbe stato «migliorare» il riferimento — cioè divergere da lui con
 *    le migliori intenzioni. Il caso con lo Choice Scarf, più sotto, è quello
 *    che rende la differenza rossa invece che invisibile.
 *
 *    E il confronto è `>` STRETTO: a parità esatta di Velocità, Analytic si
 *    accende. Un `>=` scritto per simmetria lo spegnerebbe, e nessun numero
 *    lo direbbe ad alta voce.
 *
 * 2. HUSTLE NON STA NELLA CATENA. Il riferimento lo commenta da sé — è l'unica
 *    volta che lo fa per avvertire di una differenza di forma:
 *
 *        // unlike all other attack modifiers, Hustle gets applied directly
 *        attack = pokeRound(attack * 3 / 2);
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]

const att = (atkPokemon, atkAbility, extra = {}) => ({
  atkPokemon, atkSPs: SP, atkNature: null,
  atkAbility, atkItem: null, level: 50, ...extra,
})
const dif = (defPokemon, defAbility = null, extra = {}) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {}, ...extra,
})
const calcola = (attacker, defender, move, field = {}) =>
  calculateDamage({ attacker, defender, move, field, debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti, letti e non creduti', () => {
  const norm = s => String(s).toLowerCase().replace(/ /g, '-')
  const ha = (specie, ab) => (pokemonData[specie]?.abilities ?? []).map(norm).includes(ab)

  it('ogni specie ha davvero la sua abilità', () => {
    const coppie = [
      ['starmie', 'analytic'], ['watchog', 'analytic'], ['flapple', 'hustle'],
      ['primarina', 'liquid-voice'], ['altaria', 'cloud-nine'], ['rayquaza', 'air-lock'],
      ['torkoal', 'shell-armor'], ['falinks', 'battle-armor'],
    ]
    expect(coppie.filter(([s, a]) => !ha(s, a))).toEqual([])
  })

  it('le Velocità di base rendono sensati i casi di Analytic', () => {
    // Se un giorno cambiassero, i test sull'ordine di turno direbbero il falso
    // in silenzio invece di diventare rossi.
    expect(pokemonData['starmie'].stats[5]).toBe(115)
    expect(pokemonData['watchog'].stats[5]).toBe(77)
    expect(pokemonData['charizard'].stats[5]).toBe(100)
    expect(pokemonData['torkoal'].stats[5]).toBe(20)
  })

  it('Granvoce è sonora ed è di tipo Normale', () => {
    expect(movesData['hyper voice'].sound).toBe(true)
    expect(movesData['hyper voice'].type).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Analytic, e il caso che difende la trascrizione
// ═══════════════════════════════════════════════════════════════════════════

describe('Analytic: ×1.3 se non muovi per primo', () => {
  it('più veloce del bersaglio: spenta', () => {
    // Starmie 115 contro Torkoal 20.
    const con = calcola(att('starmie', 'analytic'), dif('torkoal'), 'surf')
    const senza = calcola(att('starmie', null), dif('torkoal'), 'surf')
    expect(con.rolls).toEqual(senza.rolls)
  })

  it('più lento del bersaglio: accesa', () => {
    // Watchog 77 contro Charizard 100.
    const con = calcola(att('watchog', 'analytic'), dif('charizard'), 'hyper voice')
    const senza = calcola(att('watchog', null), dif('charizard'), 'hyper voice')
    expect(con.maxDmg).toBeGreaterThan(senza.maxDmg)
    const rapporto = con.maxDmg / senza.maxDmg
    expect(rapporto).toBeGreaterThan(1.25)
    expect(rapporto).toBeLessThan(1.35)
  })

  it('a PARITÀ di Velocità è accesa, perché il confronto è `>` stretto', () => {
    // Starmie contro Starmie: stessa specie, stessi SP, stessa natura, quindi
    // Velocità identica al punto. Il riferimento scrive
    // `attacker.stats[SP] > defender.stats[SP] ? "FIRST" : "LAST"`, quindi il
    // pareggio cade nell'`else`. Un `>=` scritto per simmetria lo spegnerebbe.
    const con = calcola(att('starmie', 'analytic'), dif('starmie'), 'surf')
    const senza = calcola(att('starmie', null), dif('starmie'), 'surf')
    expect(con.maxDmg, 'a parità di Velocità Analytic si è spenta')
      .toBeGreaterThan(senza.maxDmg)
  })

  it('gli STADI contano', () => {
    // Starmie 115 contro Charizard 100: di suo va per primo, quindi spenta.
    // A −1 Velocità scende a 76 e passa dietro, quindi si accende.
    const veloce = calcola(att('starmie', 'analytic'), dif('charizard'), 'surf')
    const rallentato = calcola(
      att('starmie', 'analytic', { atkSpeBoost: -1 }), dif('charizard'), 'surf')
    const rallentatoSenza = calcola(
      att('starmie', null, { atkSpeBoost: -1 }), dif('charizard'), 'surf')

    expect(veloce.rolls).toEqual(calcola(att('starmie', null), dif('charizard'), 'surf').rolls)
    expect(rallentato.maxDmg, 'lo stadio di Velocità non conta')
      .toBeGreaterThan(rallentatoSenza.maxDmg)
  })

  it('lo CHOICE SCARF non conta — ed è il caso che difende la trascrizione', () => {
    // Watchog 77 contro Charizard 100: più lento, quindi Analytic accesa.
    //
    // Con lo Choice Scarf la Velocità EFFETTIVA diventa 115, cioè maggiore di
    // 100. Un motore che guardasse `calcEffectiveSpe` — che il progetto ha, e
    // che sa dello Scarf — direbbe «muove per primo» e spegnerebbe Analytic.
    //
    // Il riferimento guarda `stats[SP]`, che lo Scarf non tocca: resta 77,
    // resta LAST, resta ×1.3. Questo test è l'unica cosa che tiene ferma la
    // scelta di NON usare la funzione più informata che abbiamo.
    const conScarf = calcola(
      att('watchog', 'analytic', { atkItem: 'choice scarf' }), dif('charizard'), 'hyper voice')
    const senzaAbilita = calcola(
      att('watchog', null, { atkItem: 'choice scarf' }), dif('charizard'), 'hyper voice')

    expect(conScarf.maxDmg, 'lo Choice Scarf ha spento Analytic: si sta usando la Velocità effettiva')
      .toBeGreaterThan(senzaAbilita.maxDmg)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Hustle, fuori dalla catena
// ═══════════════════════════════════════════════════════════════════════════

describe('Hustle: ×1.5 sull\'Attacco, applicato direttamente', () => {
  it('alza il fisico', () => {
    const con = calcola(att('flapple', 'hustle'), dif('incineroar'), 'dragon claw')
    const senza = calcola(att('flapple', null), dif('incineroar'), 'dragon claw')
    expect(con.maxDmg).toBeGreaterThan(senza.maxDmg)
  })

  it('non tocca lo speciale', () => {
    const con = calcola(att('flapple', 'hustle'), dif('incineroar'), 'energy ball')
    const senza = calcola(att('flapple', null), dif('incineroar'), 'energy ball')
    expect(con.rolls).toEqual(senza.rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Liquid Voice: un cambio di tipo, non un moltiplicatore
// ═══════════════════════════════════════════════════════════════════════════

describe('Liquid Voice: le mosse sonore diventano Acqua', () => {
  it('Granvoce da Primarina diventa Acqua, e si vede da tre cose insieme', () => {
    // Primarina è Acqua/Folletto. Granvoce è Normale, quindi senza l'abilità
    // non ha STAB. Diventata Acqua ne prende uno — e contro Torkoal, che è
    // Fuoco, passa da efficacia neutra a super efficace.
    //
    // Il salto è quindi ×1.5 di STAB per ×2 di efficacia: se fosse un semplice
    // moltiplicatore non arriverebbe mai a tanto.
    const con = calcola(att('primarina', 'liquid-voice'), dif('torkoal'), 'hyper voice')
    const senza = calcola(att('primarina', null), dif('torkoal'), 'hyper voice')
    expect(con.maxDmg / senza.maxDmg).toBeGreaterThan(2.5)
  })

  it('su una mossa non sonora non fa niente', () => {
    const con = calcola(att('primarina', 'liquid-voice'), dif('torkoal'), 'moonblast')
    const senza = calcola(att('primarina', null), dif('torkoal'), 'moonblast')
    expect(con.rolls).toEqual(senza.rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Air Lock e Cloud Nine: il meteo sparisce
// ═══════════════════════════════════════════════════════════════════════════

describe('Air Lock e Cloud Nine tolgono il meteo, non lo riducono', () => {
  it('sul DIFENSORE il sole non potenzia più il Fuoco', () => {
    const conSole = calcola(att('charizard', null), dif('altaria'), 'flamethrower', { weather: 'sun' })
    const conCloudNine = calcola(att('charizard', null), dif('altaria', 'cloud-nine'), 'flamethrower', { weather: 'sun' })
    const senzaSole = calcola(att('charizard', null), dif('altaria'), 'flamethrower', {})
    expect(conSole.maxDmg).toBeGreaterThan(senzaSole.maxDmg)
    expect(conCloudNine.rolls, 'Cloud Nine non ha tolto il sole').toEqual(senzaSole.rolls)
  })

  it('sull\'ATTACCANTE vale uguale — il riferimento la chiama su tutt\'e due', () => {
    const conSole = calcola(att('altaria', null), dif('incineroar'), 'hurricane', { weather: 'rain' })
    const conCloudNine = calcola(att('altaria', 'cloud-nine'), dif('incineroar'), 'hurricane', { weather: 'rain' })
    const senzaMeteo = calcola(att('altaria', null), dif('incineroar'), 'hurricane', {})
    // La pioggia non tocca una mossa Volante, quindi qui i tre numeri
    // coincidono: il caso serve a provare che l'abilità non ROMPE niente.
    expect(conCloudNine.rolls).toEqual(senzaMeteo.rolls)
    expect(conSole.rolls).toEqual(senzaMeteo.rolls)
  })

  it('toglie anche il dimezzamento, non solo il potenziamento', () => {
    // Sotto la pioggia il Fuoco è dimezzato. Con Cloud Nine in campo torna
    // pieno: è la prova che il meteo è TOLTO e non attenuato.
    const conPioggia = calcola(att('charizard', null), dif('altaria'), 'flamethrower', { weather: 'rain' })
    const conCloudNine = calcola(att('charizard', null), dif('altaria', 'cloud-nine'), 'flamethrower', { weather: 'rain' })
    expect(conCloudNine.maxDmg).toBeGreaterThan(conPioggia.maxDmg)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. Shell Armor e Battle Armor: niente critico
// ═══════════════════════════════════════════════════════════════════════════

describe('Shell Armor e Battle Armor spengono il critico', () => {
  for (const [nome, specie, chiave] of [
    ['Shell Armor', 'torkoal', 'shell-armor'],
    ['Battle Armor', 'falinks', 'battle-armor'],
  ]) {
    it(`${nome}: col critico acceso il danno è quello normale`, () => {
      const critico = calcola(att('incineroar', null), dif(specie, chiave), 'knock off', { crit: true })
      const normale = calcola(att('incineroar', null), dif(specie, chiave), 'knock off', {})
      const criticoSenza = calcola(att('incineroar', null), dif(specie, null), 'knock off', { crit: true })

      expect(critico.rolls, `${nome}: il critico passa lo stesso`).toEqual(normale.rolls)
      expect(criticoSenza.maxDmg, 'caso muto: il critico non faceva niente')
        .toBeGreaterThan(normale.maxDmg)
    })
  }

  it('ma Mold Breaker lo fa passare', () => {
    // Nel riferimento `critMove` riceve la `defAbility` già passata per
    // `abilityIgnore`, quindi contro Mold Breaker l'armatura non ferma niente.
    // Da noi viene da sé perché `critico` legge `defAbilEffect`, che è già
    // quella sostituita — ma «viene da sé» va provato, non creduto.
    const conSfondatore = calcola(
      att('excadrill', 'mold-breaker'), dif('torkoal', 'shell-armor'), 'iron head', { crit: true })
    const senzaArmatura = calcola(
      att('excadrill', 'mold-breaker'), dif('torkoal', null), 'iron head', { crit: true })
    const normale = calcola(
      att('excadrill', 'mold-breaker'), dif('torkoal', 'shell-armor'), 'iron head', {})

    expect(conSfondatore.rolls, 'Shell Armor ferma il critico anche contro Mold Breaker')
      .toEqual(senzaArmatura.rolls)
    expect(conSfondatore.maxDmg).toBeGreaterThan(normale.maxDmg)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. L'oracolo
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
    ['Analytic, più veloce',   att('starmie', 'analytic'),  dif('torkoal'),   'surf', {}],
    ['Analytic, più lento',    att('watchog', 'analytic'),  dif('charizard'), 'hyper voice', {}],
    ['Analytic, pareggio',     att('starmie', 'analytic'),  dif('starmie'),   'surf', {}],
    ['Analytic con lo Scarf',  att('watchog', 'analytic', { atkItem: 'choice scarf' }),
                               dif('charizard'), 'hyper voice', {}],
    ['Hustle sul fisico',      att('flapple', 'hustle'),    dif('incineroar'), 'dragon claw', {}],
    ['Hustle sullo speciale',  att('flapple', 'hustle'),    dif('incineroar'), 'energy ball', {}],
    ['Liquid Voice',           att('primarina', 'liquid-voice'), dif('torkoal'), 'hyper voice', {}],
    ['Liquid Voice, non sonora', att('primarina', 'liquid-voice'), dif('torkoal'), 'moonblast', {}],
    ['Shell Armor col critico', att('incineroar', null), dif('torkoal', 'shell-armor'),
                               'knock off', { crit: true }],
    ['Battle Armor col critico', att('incineroar', null), dif('falinks', 'battle-armor'),
                               'knock off', { crit: true }],
    ['Mold Breaker buca Shell Armor', att('excadrill', 'mold-breaker'),
                               dif('torkoal', 'shell-armor'), 'iron head', { crit: true }],
  ]

  for (const [nome, attacker, defender, mossa, campo] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker, defender, move: mossa, field: campo })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(calcola(attacker, defender, mossa, campo).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }

  /**
   * ─── CLOUD NINE VUOLE L'ALTRO INGRESSO, E L'HO SCOPERTO SBAGLIANDO ────────
   *
   * I due casi qui sotto stavano nell'elenco sopra e divergevano: noi
   * toglievamo il sole, il riferimento no.
   *
   * Non era un difetto nostro. L'harness ha DUE ingressi. `calcola` entra da
   * `GET_DAMAGE_SV`, che riceve i due Pokémon già preparati; `checkAirLock`
   * invece sta in `CALCULATE_ALL_MOVES_SV` (`damage_SV.js:10-11`), un livello
   * sopra — insieme a checkTrace, checkKlutz, checkForecast, checkMimicry,
   * checkIntimidate e tutta la preparazione.
   *
   * Entrando in basso, Air Lock e Cloud Nine semplicemente non vengono
   * eseguite: il riferimento tiene il sole perché nessuno gliel'ha tolto.
   *
   * È la stessa ragione per cui `calcola` escludeva i casi con Intimidate
   * attivo, e la soluzione è la stessa che il progetto si era già dato:
   * `calcolaConPreparazione`, l'ingresso alto.
   *
   * Vale la pena scriverlo perché la prossima abilità di quello strato —
   * Trace, Forecast, Mimicry, Klutz sono tutte lì — troverà la stessa
   * divergenza, e sarebbe facile leggerla come un errore di trascrizione.
   */
  const CASI_INGRESSO_ALTO = [
    ['Cloud Nine sul difensore', att('charizard', null), dif('altaria', 'cloud-nine'),
                                 'flamethrower', { weather: 'sun' }],
    ['Cloud Nine contro la pioggia', att('charizard', null), dif('altaria', 'cloud-nine'),
                                 'flamethrower', { weather: 'rain' }],
    ['Cloud Nine sull\'attaccante', att('altaria', 'cloud-nine'), dif('incineroar', null),
                                 'flamethrower', { weather: 'sun' }],
    ['senza Cloud Nine il sole conta', att('charizard', null), dif('altaria', null),
                                 'flamethrower', { weather: 'sun' }],
  ]

  for (const [nome, attacker, defender, mossa, campo] of CASI_INGRESSO_ALTO) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP (ingresso alto)`, () => {
      const rif = harness.calcolaConPreparazione({ attacker, defender, move: mossa, field: campo })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(calcola(attacker, defender, mossa, campo).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})
