// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/sheerForce.test.js
 *
 * Sheer Force (`sheer-force`): ×1.3 sulle mosse con un effetto secondario.
 *
 * Nel riferimento è il punto e.i della catena della potenza
 * (`damage_MASTER.js:1628`), cioè il PRIMO anello dell'`else if` di cui Impeto
 * Sabbia è il secondo, Analytic il terzo, Tough Claws il quarto e Punk Rock il
 * quinto.
 *
 * ─── PERCHÉ IL FLAG NON SI POTEVA DEDURRE ──────────────────────────────────
 *
 * «Ha un effetto secondario» sembra una cosa che si decide leggendo la mossa,
 * e non lo è. Il vendor ne marca 207; il flag `secondario` di moves.json le
 * trascrive, e 193 esistono anche da noi.
 *
 * Il primo blocco di questo file è lì per rendere la trascrizione
 * FALSIFICABILE: prende cinque mosse che un lettore classificherebbe a occhio
 * e controlla che il dato dica quello che dice il vendor. Se un giorno il
 * flag venisse ricostruito a mano o da un'altra fonte, quelle cinque righe si
 * accorgerebbero della differenza.
 *
 * ─── COSA NON FA ───────────────────────────────────────────────────────────
 *
 * Nel gioco l'abilità toglie l'effetto secondario e spegne il contraccolpo del
 * Life Orb. Il riferimento non modella né l'una né l'altra cosa nel danno, e
 * nemmeno noi. È una mancanza dichiarata, non una svista: l'ultimo test la
 * registra, così chi si aspetta che il Life Orb non faccia male trova scritto
 * perché non è così.
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

// Conkeldurr è uno dei nove portatori legali in M-B, ed è quello che rende i
// casi interessanti: ha mosse con e senza effetto secondario nello stesso set.
const att = (atkAbility) => ({
  atkPokemon: 'conkeldurr', atkSPs: SP, atkNature: null,
  atkAbility, atkItem: null, level: 50,
})
const dif = () => ({
  defPokemon: 'incineroar', defSPs: SP, defNature: null,
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const nostro = (atkAbility, move, field = {}) =>
  calculateDamage({ attacker: att(atkAbility), defender: dif(), move, field, debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// 1. Il flag: trascritto, e falsificabile
// ═══════════════════════════════════════════════════════════════════════════

describe('il flag `secondario` dice quello che dice il vendor', () => {
  it('Conkeldurr ha davvero Sheer Force', () => {
    const sue = (pokemonData['conkeldurr'].abilities ?? [])
      .map(a => String(a).toLowerCase().replace(/ /g, '-'))
    expect(sue).toContain('sheer-force')
  })

  it('cinque mosse che un lettore classificherebbe a occhio', () => {
    // Con l'effetto: bruciatura, congelamento, paralisi, calo di Difesa.
    expect(movesData['fire punch'].secondario).toBe(true)
    expect(movesData['iron head'].secondario).toBe(true)
    expect(movesData['crunch'].secondario).toBe(true)
    // Senza: Terremoto non fa altro che danno, e Prepotenza abbassa le
    // statistiche di CHI LA USA — che non è un effetto secondario sul bersaglio.
    expect(movesData['earthquake'].secondario).toBeUndefined()
    expect(movesData['close combat'].secondario).toBeUndefined()
  })

  it('sono 193, e il numero è misurato non creduto', () => {
    // Se il conto cambia, o il vendor è cambiato o qualcuno ha toccato il
    // generatore: in tutt'e due i casi va guardato, non aggiornato di riflesso.
    const quante = Object.values(movesData).filter(m => m.secondario).length
    expect(quante).toBe(193)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. L'effetto
// ═══════════════════════════════════════════════════════════════════════════

describe('×1.3 sulle mosse con effetto secondario, e su nessun\'altra', () => {
  it('Colpodifuoco sale', () => {
    const con = nostro('sheer-force', 'fire punch')
    const senza = nostro(null, 'fire punch')
    expect(con.maxDmg).toBeGreaterThan(senza.maxDmg)
    const rapporto = con.maxDmg / senza.maxDmg
    expect(rapporto).toBeGreaterThan(1.25)
    expect(rapporto).toBeLessThan(1.35)
  })

  it('Terremoto no', () => {
    expect(nostro('sheer-force', 'earthquake').rolls)
      .toEqual(nostro(null, 'earthquake').rolls)
  })

  it('Prepotenza nemmeno', () => {
    expect(nostro('sheer-force', 'close combat').rolls)
      .toEqual(nostro(null, 'close combat').rolls)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Il posto nella catena
// ═══════════════════════════════════════════════════════════════════════════

describe('è il primo anello del punto e, e sta nella catena della POTENZA', () => {
  it('la tabella lo dice', () => {
    expect(ABILITY_EFFECTS['sheer-force']).toEqual({ sheerForce: true, showInSmogon: true })
  })

  /**
   * ─── IL CASO CHE HO DOVUTO CERCARE, INVECE DI CREDERE ────────────────────
   *
   * La prima stesura di questo file diceva, in un commento, che il confronto
   * con l'oracolo provava già che il ×1.3 sta nella catena della POTENZA e non
   * in quella della statistica. Non era vero.
   *
   * Misurato spostando davvero il push in `atMods`: con i casi su Conkeldurr
   * non diventava rosso NIENTE. Le due catene danno lo stesso risultato molto
   * più spesso di quanto sembri — `pokeRound(BP × 1,3) × Atk` e
   * `BP × pokeRound(Atk × 1,3)` divergono, ma la differenza deve poi
   * sopravvivere a due divisioni intere e a sedici arrotondamenti.
   *
   * Scanditi tutti i portatori di Sheer Force per tutte le 193 mosse con
   * effetto secondario contro quattro difensori — 24 704 combinazioni — la
   * catena sbagliata cambia i numeri in 2 328 casi, cioè nove volte su cento.
   * I miei erano fra le altre novantuno.
   *
   * Tauros con Thunder Punch contro Incineroar è uno dei 773 che distinguono
   * fra i portatori legali in M-B: 41-49 con il ×1.3 sulla potenza, 40-48 con
   * lo stesso ×1.3 sulla statistica. È lì apposta, e il confronto con
   * l'oracolo su questo caso è quello che difende la posizione.
   */
  const tauros = (atkAbility) => ({
    atkPokemon: 'tauros', atkSPs: SP, atkNature: null,
    atkAbility, atkItem: null, level: 50,
  })

  it('Tauros con Colpotuono: il caso che distingue le due catene', () => {
    const con = calculateDamage({
      attacker: tauros('sheer-force'), defender: dif(), move: 'thunder punch',
      field: {}, debug: false,
    })
    // I due numeri sono quelli misurati: 41-49 dalla catena giusta, 40-48 da
    // quella sbagliata. Scritti come valori e non come disuguaglianza, perché
    // una disuguaglianza qui sarebbe vera in tutt'e due i casi.
    expect(con.minDmg).toBe(41)
    expect(con.maxDmg).toBe(49)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Quello che NON fa, registrato
// ═══════════════════════════════════════════════════════════════════════════

describe('le due metà che il riferimento non modella', () => {
  it('il Life Orb fa male lo stesso', () => {
    // Nel gioco Sheer Force spegne il contraccolpo del Life Orb. Il
    // riferimento non lo modella nel danno, e nemmeno noi — e il Life Orb
    // continua a dare il suo ×1.3 al danno inflitto, che è l'unica metà che
    // il calcolo vede.
    //
    // Questo test non chiede che sia giusto: registra che è così. Se un giorno
    // qualcuno implementasse il contraccolpo, verrebbe a leggere qui.
    const conOrb = calculateDamage({
      attacker: { ...att('sheer-force'), atkItem: 'life orb' },
      defender: dif(), move: 'fire punch', field: {}, debug: false,
    })
    const senzaOrb = nostro('sheer-force', 'fire punch')
    expect(conOrb.maxDmg).toBeGreaterThan(senzaOrb.maxDmg)
  })
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
    ['Colpodifuoco, con effetto secondario', 'sheer-force', 'fire punch'],
    ['Testandata, con effetto secondario',   'sheer-force', 'iron head'],
    ['Sgranocchio, con effetto secondario',  'sheer-force', 'crunch'],
    ['Terremoto, senza',                     'sheer-force', 'earthquake'],
    ['Prepotenza, senza',                    'sheer-force', 'close combat'],
    ['Colpodifuoco senza l\'abilità',       null,          'fire punch'],
  ]

  for (const [nome, abilita, mossa] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker: att(abilita), defender: dif(), move: mossa, field: {} })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(abilita, mossa).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }

  // Il caso che distingue la catena della potenza da quella della statistica.
  // Senza questo, spostare il push da `bpMods` ad `atMods` non farebbe fallire
  // nessuno dei sei confronti qui sopra: misurato.
  it.runIf(vendorPresente)('Tauros con Colpotuono ≡ NCP — il caso che difende la catena', () => {
    const attacker = {
      atkPokemon: 'tauros', atkSPs: SP, atkNature: null,
      atkAbility: 'sheer-force', atkItem: null, level: 50,
    }
    const rif = harness.calcola({ attacker, defender: dif(), move: 'thunder punch', field: {} })
    expect(rif.motivo ?? null).toBeNull()
    expect(rif.ok).toBe(true)
    expect(
      calculateDamage({ attacker, defender: dif(), move: 'thunder punch', field: {}, debug: false }).rolls,
      'il ×1.3 è finito nella catena sbagliata',
    ).toEqual(rif.rolls)
  })
})
