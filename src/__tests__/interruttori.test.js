// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/interruttori.test.js
 *
 * Sette abilità: cinque che il riferimento accende con `abilityOn`, più due che
 * non chiedono niente.
 *
 *   Plus, Minus        :1951  ×1.5 Att. Speciale, se l'alleato ha l'altra
 *   Electromorphosis   :1764  ×2 sulle mosse Elettro, se si è caricata
 *   Protean, Libero    :2231  STAB su qualunque mossa
 *   Solar Power        :1958  ×1.5 Att. Speciale col sole — nessun interruttore
 *   Klutz              :448   lo strumento non conta più
 *
 * Nel riferimento l'interruttore è UNO solo — `attacker.abilityOn` — letto da
 * condizioni diverse. Da noi è il flag `interruttore`, e vale per tutte e
 * cinque: un Pokémon ha un'abilità sola, quindi non possono accendersi insieme.
 *
 * ─── DUE COSE CHE HO IMPARATO PRIMA DI SCRIVERE ────────────────────────────
 *
 * SOLAR POWER NON CHIEDE GLI HP. L'avevo messa fra le abilità bloccate dagli
 * HP correnti, e mi sbagliavo: nel gioco costa PS ogni turno, ma quello non è
 * danno e il riferimento non lo modella. Bastano sole, mossa speciale e niente
 * Utility Umbrella.
 *
 * KLUTZ VUOLE L'INGRESSO ALTO. `checkKlutz` sta in `CALCULATE_ALL_MOVES_SV`,
 * come `checkAirLock` — quindi da `GET_DAMAGE_SV` non viene eseguita affatto.
 * L'avevo scritto nel test di Cloud Nine dicendo che la prossima abilità di
 * quello strato avrebbe trovato la stessa divergenza. È successo alla prima.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { STRUMENTI_IMMUNI_A_KLUTZ } from '../lib/rules.js'
import itemsData from '../data/items.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]
const ACCESO = { interruttore: true }

const att = (atkPokemon, atkAbility, flags = {}, extra = {}) => ({
  atkPokemon, atkSPs: SP, atkNature: null,
  atkAbility, atkItem: null, level: 50, atkAbilityFlags: flags, ...extra,
})
const dif = (defPokemon = 'incineroar') => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const calcola = (attacker, move, field = {}, defender = dif()) =>
  calculateDamage({ attacker, defender, move, field, debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti, letti e non creduti', () => {
  const norm = s => String(s).toLowerCase().replace(/ /g, '-')
  it('ogni specie ha davvero la sua abilità', () => {
    const coppie = [
      ['charizard', 'solar-power'], ['ampharos', 'plus'], ['manectric', 'minus'],
      ['bellibolt', 'electromorphosis'], ['greninja', 'protean'], ['lopunny', 'klutz'],
    ]
    expect(coppie.filter(([s, a]) => !(pokemonData[s]?.abilities ?? []).map(norm).includes(a)))
      .toEqual([])
  })

  it('Greninja è Acqua/Buio: Geloraggio è FUORI tipo, Surf no', () => {
    // È il fatto su cui poggia tutto il blocco di Protean. Se cambiasse, i
    // test direbbero il falso in silenzio invece di diventare rossi.
    expect(pokemonData['greninja'].type).toEqual([2, 15])
  })

  it('dei sette strumenti immuni a Klutz, uno solo esiste nei nostri dati', () => {
    // Misurato, non creduto. Se il conto cambia — perché i dati crescono —
    // questo test lo dice, e la nota in `rules.js` va riletta.
    const presenti = [...STRUMENTI_IMMUNI_A_KLUTZ].filter(k => k in itemsData)
    expect(presenti).toEqual(['macho brace'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Le cinque con l'interruttore
// ═══════════════════════════════════════════════════════════════════════════

describe('Plus e Minus: ×1.5 se l\'alleato ha l\'altra', () => {
  for (const [nome, specie, chiave] of [['Plus', 'ampharos', 'plus'], ['Minus', 'manectric', 'minus']]) {
    it(`${nome}: acceso alza, spento no`, () => {
      const acceso = calcola(att(specie, chiave, ACCESO), 'thunderbolt')
      const spento = calcola(att(specie, chiave), 'thunderbolt')
      const senza = calcola(att(specie, null), 'thunderbolt')
      expect(spento.rolls, `${nome}: fa effetto anche da spento`).toEqual(senza.rolls)
      expect(acceso.maxDmg).toBeGreaterThan(spento.maxDmg)
    })
  }

  /**
   * ─── IL RIFERIMENTO LE APPLICA ANCHE AL FISICO, E IL GIOCO NO ────────────
   *
   * Questo test diceva il contrario, ed era io che avevo ASSUNTO la regola del
   * gioco invece di trascriverla: nei giochi Plus e Minus alzano solo
   * l'Attacco Speciale.
   *
   * Il riferimento no. Nella stessa riga (`damage_MASTER.js:1941-1955`) Guts e
   * Gorilla Tactics portano `move.category === "Physical"`, e Plus/Minus non
   * portano NIENTE:
   *
   *     || (["Plus", "Minus"].indexOf(attacker.ability) !== -1 && attacker.abilityOn)
   *
   * `atMods` moltiplica la statistica con cui si attacca, qualunque sia —
   * quindi su una mossa fisica alza l'Attacco.
   *
   * La regola del progetto è trascrivere, non correggere: il caso è passato
   * all'oracolo qui sotto, che dà ragione al riferimento. Se un giorno si
   * decidesse di divergere, il posto dove scriverlo è questo, e la divergenza
   * andrebbe registrata come le quattro di Parental Bond.
   */
  it('il riferimento le applica anche al fisico — trascritto, non corretto', () => {
    const acceso = calcola(att('ampharos', 'plus', ACCESO), 'iron tail')
    const spento = calcola(att('ampharos', 'plus'), 'iron tail')
    expect(acceso.maxDmg, 'qui il motore ha «corretto» il riferimento')
      .toBeGreaterThan(spento.maxDmg)
  })
})

describe('Electromorphosis: ×2, non ×1.5', () => {
  it('raddoppia le mosse Elettro', () => {
    const acceso = calcola(att('bellibolt', 'electromorphosis', ACCESO), 'thunderbolt')
    const spento = calcola(att('bellibolt', 'electromorphosis'), 'thunderbolt')
    expect(spento.rolls).toEqual(calcola(att('bellibolt', null), 'thunderbolt').rolls)
    // Il numero, non solo il verso: è l'unico ×2 del gruppo, e scriverlo come
    // ×1.5 darebbe un danno plausibile e sbagliato di un terzo.
    const rapporto = acceso.maxDmg / spento.maxDmg
    expect(rapporto).toBeGreaterThan(1.9)
    expect(rapporto).toBeLessThan(2.1)
  })

  it('e solo quelle', () => {
    const acceso = calcola(att('bellibolt', 'electromorphosis', ACCESO), 'surf')
    const senza = calcola(att('bellibolt', null), 'surf')
    expect(acceso.rolls).toEqual(senza.rolls)
  })
})

describe('Protean e Libero: lo STAB anche fuori tipo', () => {
  it('Geloraggio, che è fuori tipo, prende lo STAB', () => {
    const acceso = calcola(att('greninja', 'protean', ACCESO), 'ice beam')
    const spento = calcola(att('greninja', 'protean'), 'ice beam')
    expect(acceso.maxDmg).toBeGreaterThan(spento.maxDmg)
    const rapporto = acceso.maxDmg / spento.maxDmg
    expect(rapporto).toBeGreaterThan(1.45)
    expect(rapporto).toBeLessThan(1.55)
  })

  it('Surf, che è già del suo tipo, non cambia — ed è la trappola', () => {
    // Nel riferimento Protean è un `else`: se la mossa è già del tipo del
    // Pokémon vince il primo ramo e Protean non viene nemmeno valutata.
    //
    // Un test scritto su Surf passerebbe anche con l'abilità NON implementata,
    // perché lo STAB c'è comunque. È lo stesso genere di caso muto che mi ha
    // già morso due volte in questa sessione.
    const acceso = calcola(att('greninja', 'protean', ACCESO), 'surf')
    const senza = calcola(att('greninja', null), 'surf')
    expect(acceso.rolls).toEqual(senza.rolls)
  })

  it('Libero fa la stessa cosa: sono una riga sola nel riferimento', () => {
    expect(ABILITY_EFFECTS['libero']).toEqual(ABILITY_EFFECTS['protean'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Solar Power, che non chiede niente
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── UNA FORMA CHE NON RIESCO A METTERE SOTTO TEST, E LO DICO ──────────────
 *
 * Nel riferimento Solar Power è l'`else if` del punto d, non un `if` a sé
 * (`:1958`): non può quindi sommarsi alle ×1.5 che lo precedono. Il motore l'ha
 * trascritto così.
 *
 * Ma la differenza non è osservabile: le condizioni del punto d sono altre
 * abilità — Dragon's Maw, Sharpness, Gorilla Tactics, Flash Fire, Plus, Minus —
 * e un Pokémon ne ha una sola. Misurato riscrivendo l'`else if` come `if`: in
 * questo file non diventa rosso niente.
 *
 * È la stessa situazione dei tre modificatori finali e della condizione di Mold
 * Breaker sul difensore: la forma è difesa dalla lettura del riferimento, non
 * da un test. Lo scrivo invece di lasciar credere che i test la coprano.
 */
describe('Solar Power: solo il sole, non gli HP', () => {
  it('col sole alza lo speciale', () => {
    const conSole = calcola(att('charizard', 'solar-power'), 'flamethrower', { weather: 'sun' })
    const senzaAbilita = calcola(att('charizard', null), 'flamethrower', { weather: 'sun' })
    expect(conSole.maxDmg).toBeGreaterThan(senzaAbilita.maxDmg)
  })

  it('senza sole non fa niente', () => {
    expect(calcola(att('charizard', 'solar-power'), 'flamethrower').rolls)
      .toEqual(calcola(att('charizard', null), 'flamethrower').rolls)
  })

  it('sul fisico nemmeno', () => {
    expect(calcola(att('charizard', 'solar-power'), 'earthquake', { weather: 'sun' }).rolls)
      .toEqual(calcola(att('charizard', null), 'earthquake', { weather: 'sun' }).rolls)
  })

  it('l\'Utility Umbrella la spegne', () => {
    const con = calcola(att('charizard', 'solar-power', {}, { atkItem: 'utility umbrella' }),
      'flamethrower', { weather: 'sun' })
    const senza = calcola(att('charizard', null, {}, { atkItem: 'utility umbrella' }),
      'flamethrower', { weather: 'sun' })
    expect(con.rolls).toEqual(senza.rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Klutz
// ═══════════════════════════════════════════════════════════════════════════

describe('Klutz: lo strumento non conta più', () => {
  it('il Life Orb non fa niente', () => {
    const conKlutz = calcola(att('lopunny', 'klutz', {}, { atkItem: 'life orb' }), 'body slam')
    const senzaOggetto = calcola(att('lopunny', 'klutz'), 'body slam')
    const conOrbSenzaKlutz = calcola(att('lopunny', null, {}, { atkItem: 'life orb' }), 'body slam')

    expect(conKlutz.rolls, 'il Life Orb conta ancora').toEqual(senzaOggetto.rolls)
    expect(conOrbSenzaKlutz.maxDmg, 'caso muto: il Life Orb non faceva niente')
      .toBeGreaterThan(senzaOggetto.maxDmg)
  })

  it('vale anche sul DIFENSORE', () => {
    // Klutz spegne lo strumento di chi ce l'ha, da qualunque parte stia.
    const difConKlutz = {
      ...dif('audino'), defAbility: 'klutz', defItem: 'assault vest',
    }
    const difSenzaKlutz = { ...dif('audino'), defAbility: null, defItem: 'assault vest' }
    const difSenzaOggetto = { ...dif('audino'), defAbility: 'klutz', defItem: null }

    const a = att('incineroar', null)
    expect(calcola(a, 'dark pulse', {}, difConKlutz).rolls,
      'il Giubbotto conta ancora').toEqual(calcola(a, 'dark pulse', {}, difSenzaOggetto).rolls)
    expect(calcola(a, 'dark pulse', {}, difSenzaKlutz).maxDmg,
      'caso muto: il Giubbotto non faceva niente')
      .toBeLessThan(calcola(a, 'dark pulse', {}, difSenzaOggetto).maxDmg)
  })

  it('i sette attrezzi da allenamento restano — ma oggi non è osservabile', () => {
    // Questo NON è un test dell'effetto: è la registrazione di un confine.
    //
    // Dei sette strumenti che Klutz non annulla, uno solo esiste nei nostri
    // dati (`macho brace`) e non ha alcun effetto sul DANNO — dimezza la
    // Velocità, che il calcolo del danno non guarda. Quindi l'eccezione è
    // scritta, trascritta dal riferimento, e non muove nessun numero.
    //
    // Il giorno che uno dei sette avesse un effetto sul danno, questo test va
    // sostituito con uno vero.
    const conBrace = calcola(att('lopunny', 'klutz', {}, { atkItem: 'macho brace' }), 'body slam')
    const senzaNiente = calcola(att('lopunny', 'klutz'), 'body slam')
    expect(conBrace.rolls, 'il Macho Brace ha cominciato a toccare il danno')
      .toEqual(senzaNiente.rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. LA METÀ DI PROTEAN CHE ABBIAMO DECISO DI NON FARE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── UNA SCELTA, NON UNA DIMENTICANZA ──────────────────────────────────────
 *
 * Nel gioco Protean CAMBIA IL TIPO di chi la usa, e il cambiamento vale anche
 * in difesa: un Greninja che ha usato Surf diventa Acqua e prende doppio
 * dall'Elettro.
 *
 * Il riferimento non lo modella. Ha `checkTerastal` (`:438`), che per la
 * Teracristallizzazione riscrive `type1`/`type2` conservando gli originali in
 * `teraSTAB1/2` — ma per Protean non c'è niente di simile: solo lo STAB.
 *
 * Simone ha scelto di curare per ora la sola metà offensiva. La metà rinviata
 * costerebbe:
 *
 *   · un «tipo effettivo» al posto di `pokemonData[key].type`, propagato agli
 *     UNDICI punti che oggi leggono il tipo — badge dell'editor compresi;
 *   · una scelta di modello sul lato difensivo, perché la matrice calcola
 *     quattro mosse per lato e il tipo assunto dipende dal turno PRECEDENTE,
 *     che la mossa in corso di calcolo non dice;
 *   · una divergenza dichiarata dall'oracolo, perché su quella metà il
 *     riferimento non può darci né ragione né torto.
 *
 * La stessa infrastruttura servirebbe alla Teracristallizzazione, che il
 * riferimento invece modella — ma in Champions non esiste: verificato con
 * Simone.
 *
 * I due test qui sotto REGISTRANO lo stato: il tipo non cambia. Se un giorno
 * cambiasse, diventano rossi e chi li legge trova qui la scelta e il suo costo,
 * invece di scoprire il buco da un numero.
 */
describe('la metà difensiva di Protean è rinviata, e lo diciamo', () => {
  it('il tipo del Pokémon non cambia: resta quello della specie', () => {
    const greninja = { ...dif('greninja'), defAbility: 'protean', defAbilityFlags: ACCESO }
    const senzaProtean = { ...dif('greninja'), defAbility: null }
    // Una mossa Elettro contro Greninja: se il tipo fosse diventato Acqua
    // (dopo Surf) il danno raddoppierebbe. Non succede, ed è voluto.
    const a = att('ampharos', null)
    expect(calcola(a, 'thunderbolt', {}, greninja).rolls)
      .toEqual(calcola(a, 'thunderbolt', {}, senzaProtean).rolls)
  })

  it('e l\'efficacia è quella dei tipi della specie', () => {
    const greninja = { ...dif('greninja'), defAbility: 'protean', defAbilityFlags: ACCESO }
    // Acqua/Buio: l'Elettro è super efficace sull'Acqua.
    expect(calcola(att('ampharos', null), 'thunderbolt', {}, greninja).effectiveness).toBe(2)
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
    ['Plus acceso',        att('ampharos', 'plus', ACCESO),  'thunderbolt', {}],
    ['Plus spento',        att('ampharos', 'plus'),          'thunderbolt', {}],
    ['Minus acceso',       att('manectric', 'minus', ACCESO), 'thunderbolt', {}],
    ['Plus su una mossa FISICA', att('ampharos', 'plus', ACCESO), 'iron tail', {}],
    ['Electromorphosis',   att('bellibolt', 'electromorphosis', ACCESO), 'thunderbolt', {}],
    ['Electromorphosis, altro tipo', att('bellibolt', 'electromorphosis', ACCESO), 'surf', {}],
    ['Protean fuori tipo', att('greninja', 'protean', ACCESO), 'ice beam', {}],
    ['Protean spento',     att('greninja', 'protean'),        'ice beam', {}],
    ['Protean nel tipo',   att('greninja', 'protean', ACCESO), 'surf', {}],
    ['Solar Power col sole', att('charizard', 'solar-power'), 'flamethrower', { weather: 'sun' }],
    ['Solar Power senza sole', att('charizard', 'solar-power'), 'flamethrower', {}],
    ['Solar Power sul fisico', att('charizard', 'solar-power'), 'earthquake', { weather: 'sun' }],
  ]

  for (const [nome, attacker, mossa, campo] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker, defender: dif(), move: mossa, field: campo })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(calcola(attacker, mossa, campo).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }

  /**
   * ─── KLUTZ VUOLE L'INGRESSO ALTO ─────────────────────────────────────────
   *
   * `checkKlutz` sta in `CALCULATE_ALL_MOVES_SV` (`damage_SV.js:18-19`), come
   * `checkAirLock`: da `GET_DAMAGE_SV` non viene eseguita affatto, e il
   * riferimento terrebbe lo strumento in mano.
   *
   * L'avevo scritto nel test di Cloud Nine — «la prossima abilità di quello
   * strato troverà la stessa divergenza» — ed è successo alla prima.
   */
  const CASI_INGRESSO_ALTO = [
    ['Klutz col Life Orb', att('lopunny', 'klutz', {}, { atkItem: 'life orb' }), 'body slam', {}],
    ['Klutz senza strumento', att('lopunny', 'klutz'), 'body slam', {}],
    ['Life Orb senza Klutz', att('lopunny', null, {}, { atkItem: 'life orb' }), 'body slam', {}],
  ]

  for (const [nome, attacker, mossa, campo] of CASI_INGRESSO_ALTO) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP (ingresso alto)`, () => {
      const rif = harness.calcolaConPreparazione({ attacker, defender: dif(), move: mossa, field: campo })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(calcola(attacker, mossa, campo).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})
