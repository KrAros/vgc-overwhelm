// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/mosseDaiPuntiSalute.test.js
 *
 * Le cinque mosse il cui DANNO sono i punti salute di qualcuno — i punti b e c
 * di `setDamage` (`damage_MASTER.js:1221-1254`), i due blocchi sopra quello
 * del danno fisso che il progetto ha già.
 *
 *   Super Fang, Nature's Madness, Ruination   metà dei PS di CHI SUBISCE
 *   Endeavor                                  la differenza fra i due
 *   Final Gambit                              tutti i PS di CHI TIRA
 *
 * ─── TRE MODI DIVERSI, E NON SI POSSONO UNIFICARE ──────────────────────────
 *
 * Endeavor è l'unica mossa del motore che legge i punti salute di tutt'e due i
 * lati nella stessa riga. Ed è l'unica che può tornare zero senza che ci sia
 * un'immunità: se chi tira sta meglio del bersaglio, il colpo arriva e non
 * toglie niente.
 *
 * A vita piena da tutt'e due le parti quello è il caso NORMALE, non un caso
 * limite: Endeavor fra due Pokémon interi fa zero.
 *
 * ─── E PARENTAL BOND FA UNA TERZA COSA ANCORA ──────────────────────────────
 *
 * Su Super Fang e famiglia il riferimento fa ×3/2. Sulle mosse a danno fisso
 * fa ×2, sulle mosse KO non fa niente. Tre famiglie nello stesso blocco, tre
 * comportamenti: non c'è una regola sola da scrivere da qualche parte.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }
import { dannoDaiPuntiSalute, haDannoDaiPuntiSalute } from '../lib/rules.js'
import { mossaNonCalcolata } from '../lib/gap.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const LE_CINQUE = ['super fang', 'natures madness', 'ruination', 'endeavor', 'final gambit']

const att = (extra = {}) => ({
  atkPokemon: 'garchomp', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
  atkAbility: null, atkItem: null, level: 50, atkAbilityFlags: {}, ...extra,
})
const dif = (specie = 'blissey', extra = {}) => ({
  defPokemon: specie, defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const nostro = (a, d, move) => calculateDamage({ attacker: a, defender: d, move, field: {} })

// ═══════════════════════════════════════════════════════════════════════════
// 1. Entrano, e il badge se n'è andato
// ═══════════════════════════════════════════════════════════════════════════

describe('le cinque entrano nel calcolo', () => {
  it('hanno potenza zero nei dati e passano lo stesso', () => {
    for (const m of LE_CINQUE) {
      expect(movesData[m].power, `${m} ha una potenza`).toBe(0)
      expect(nostro(att(), dif(), m), `${m} esce null`).not.toBeNull()
      expect(mossaNonCalcolata(m), `${m} porta ancora il badge`).toBe(false)
    }
  })

  it('e una mossa qualunque non ci finisce dentro', () => {
    expect(haDannoDaiPuntiSalute('earthquake')).toBe(false)
    expect(dannoDaiPuntiSalute('earthquake', 100, 100)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Le tre formule, e i lati che leggono
// ═══════════════════════════════════════════════════════════════════════════

describe('metà dei punti salute di CHI SUBISCE', () => {
  it('Super Fang, Nature\'s Madness e Ruination fanno la stessa cosa', () => {
    for (const m of ['super fang', 'natures madness', 'ruination']) {
      expect(dannoDaiPuntiSalute(m, 999, 200), m).toBe(100)
    }
  })

  it('tronca, e non guarda chi tira', () => {
    expect(dannoDaiPuntiSalute('super fang', 1, 101)).toBe(50)
    expect(dannoDaiPuntiSalute('super fang', 999, 101)).toBe(50)
  })

  it('nel motore: dimezza il residuo, non il massimo', () => {
    // Il caso che distingue «metà dei punti correnti» da «metà del massimo».
    const pieno = nostro(att(), dif('blissey'), 'super fang')
    const ferito = nostro(att(), dif('blissey', { defPS: 100 }), 'super fang')
    expect(pieno.rolls[0]).toBe(Math.floor(pieno.defHP / 2))
    expect(ferito.rolls[0]).toBe(50)
  })
})

describe('Endeavor legge tutt\'e due i lati', () => {
  it('porta il bersaglio ai punti salute di chi tira', () => {
    expect(dannoDaiPuntiSalute('endeavor', 10, 100)).toBe(90)
  })

  it('e fa ZERO se chi tira sta già peggio o uguale', () => {
    // Non è un\'immunità: il colpo arriva e non toglie niente.
    expect(dannoDaiPuntiSalute('endeavor', 100, 10)).toBe(0)
    expect(dannoDaiPuntiSalute('endeavor', 50, 50)).toBe(0)
  })

  it('a vita piena fa danno lo stesso, se il bersaglio è più grosso', () => {
    // Il confronto è sui punti salute CORRENTI, non sui massimi. Garchomp
    // intero (183) contro Blissey intera (330) toglie 147 — ed è un caso che
    // l'app può mostrare adesso, senza aspettare l'interfaccia.
    const r = nostro(att(), dif('blissey'), 'endeavor')
    expect(r.rolls[0]).toBe(r.defHP - 183)
  })

  it('e fa zero fra due Pokémon identici — senza essere immune', () => {
    // Stessa specie, stessi punti statistica: stessi punti salute. Zero danno
    // NON è immunità — il tipo passa, la mossa arriva, e la differenza conta
    // perché la tabella le disegna in due modi diversi.
    const r = nostro(att(), dif('garchomp'), 'endeavor')
    expect(r.rolls).toEqual([0])
    expect(r.immune ?? false).toBe(false)
  })

  it('e con chi tira ferito toglie la differenza', () => {
    const r = nostro(att({ atkPS: 1 }), dif('blissey'), 'endeavor')
    expect(r.rolls[0]).toBe(r.defHP - 1)
  })
})

describe('Final Gambit sono i punti salute di CHI TIRA', () => {
  it('non guarda affatto il bersaglio', () => {
    expect(dannoDaiPuntiSalute('final gambit', 183, 999)).toBe(183)
    expect(dannoDaiPuntiSalute('final gambit', 183, 1)).toBe(183)
  })

  it('nel motore cambia col ferito che tira, non con quello che subisce', () => {
    const nudo = nostro(att(), dif('blissey'), 'final gambit')
    expect(nostro(att(), dif('blissey', { defPS: 1 }), 'final gambit').rolls).toEqual(nudo.rolls)
    expect(nostro(att({ atkPS: 7 }), dif('blissey'), 'final gambit').rolls).toEqual([7])
  })
})

describe('Parental Bond fa una terza cosa ancora', () => {
  it('×3/2 su Super Fang, non ×2 e non niente', () => {
    // Le mosse a danno fisso raddoppiano, le mosse KO non cambiano. Tre
    // famiglie nello stesso blocco del riferimento, tre comportamenti.
    expect(dannoDaiPuntiSalute('super fang', 999, 200, true)).toBe(150)
    expect(dannoDaiPuntiSalute('super fang', 999, 200, false)).toBe(100)
  })

  it('e NON tocca Endeavor né Final Gambit', () => {
    // Le loro righe nel riferimento non nominano `isParentBond`.
    expect(dannoDaiPuntiSalute('endeavor', 10, 100, true)).toBe(90)
    expect(dannoDaiPuntiSalute('final gambit', 183, 1, true)).toBe(183)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Contro l'oracolo
// ═══════════════════════════════════════════════════════════════════════════

describe('contro il riferimento eseguito', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    harness = (await import('../../scripts/ncp/harness.mjs')).creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const kanga = (extra = {}) => att({ atkPokemon: 'kangaskhan', atkAbility: 'parental-bond', ...extra })

  const CASI = [
    ['Super Fang a vita piena',        'super fang',   att(), dif('blissey'), {}],
    ['Super Fang su un ferito',        'super fang',   att(), dif('blissey', { defPS: 101 }), {}],
    ['Super Fang su un punto solo',    'super fang',   att(), dif('blissey', { defPS: 1 }), {}],
    ['Nature\'s Madness',              'natures madness', att(), dif('blissey'), {}],
    ['Ruination',                      'ruination',    att(), dif('blissey'), {}],
    ['Ruination su uno Spettro — passa', 'ruination',  att(), dif('gengar'), {}],
    ['Endeavor fra due interi',        'endeavor',     att(), dif('blissey'), {}],
    ['Endeavor con chi tira ferito',   'endeavor',     att({ atkPS: 1 }), dif('blissey'), {}],
    ['Endeavor col bersaglio più basso', 'endeavor',   att(), dif('blissey', { defPS: 10 }), {}],
    ['Final Gambit intero',            'final gambit', att(), dif('blissey'), {}],
    ['Final Gambit ferito',            'final gambit', att({ atkPS: 7 }), dif('blissey'), {}],
    ['Final Gambit su uno Spettro — immune', 'final gambit', att(), dif('gengar'), {}],
    ['Super Fang con Parental Bond',   'super fang',   kanga(), dif('blissey'), {}],
    ['Endeavor con Parental Bond',     'endeavor',     kanga({ atkPS: 1 }), dif('blissey'), {}],
    ['Final Gambit con Parental Bond', 'final gambit', kanga(), dif('blissey'), {}],
    ['Terremoto — il controllo negativo', 'earthquake', att(), dif('blissey', { defPS: 1 }), {}],
  ]

  for (const [nome, move, a, d, field] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker: a, defender: d, move, field })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      const r = nostro(a, d, move)
      // ─── CONFRONTARE IL DANNO, NON LA FORMA ────────────────────────
      //
      // Quando il danno è zero il riferimento torna `damage: [0]`, e
      // l'harness lo classifica come colpo nullo — è la sua regola, scritta
      // lì: «`[0]` non è un danno fisso». Noi torniamo `rolls: [0]`, che dice
      // la stessa cosa con un campo in più.
      //
      // Confrontando gli array alla lettera, `[0]` contro `[]` sarebbe una
      // divergenza dove non c'è: le due risposte dicono lo stesso numero.
      if (rif.nullo) {
        expect(r.immune ? 0 : r.maxDmg, `${nome}: il riferimento dice zero`).toBe(0)
        return
      }
      expect(r.immune ? [] : r.rolls).toEqual(rif.rolls)
    })
  }

  it.runIf(vendorPresente)('e l\'oracolo distingue davvero i punti salute', () => {
    // Il controllo che rende vere le righe qui sopra: se l'harness ignorasse
    // `ps`, Super Fang risponderebbe uguale a intero e ferito.
    const max = (ps) => harness.calcola({
      attacker: att(), defender: dif('blissey', ps === null ? {} : { defPS: ps }),
      move: 'super fang', field: {},
    }).rolls.at(-1)
    expect(max(101)).not.toBe(max(null))
  })
})
