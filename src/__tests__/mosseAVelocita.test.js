// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/mosseAVelocita.test.js
 *
 * Gyro Ball ed Electro Ball — il punto a di `basePowerFunc`
 * (`damage_MASTER.js:1305-1316`), cioè il blocco subito sopra quello delle
 * mosse a peso che il progetto aveva già.
 *
 * ─── PERCHE' NON SI POTEVANO FARE PRIMA ────────────────────────────────────
 *
 * La loro potenza è il rapporto fra le due Velocità, e la Velocità che il
 * riferimento guarda è quella EFFETTIVA — Ferrolimo, Ferroblocco, paralisi,
 * abilità meteo. Fino alla correzione di Analytic il nostro motore leggeva la
 * Velocità coi soli stadi, e l'harness sbagliava d'accordo con lui: a
 * chiedergli «Gyro Ball contro un bersaglio col Ferrolimo» rispondeva 96 BP,
 * lo stesso numero del caso nudo, per SETTE configurazioni diverse.
 *
 * Scritte allora, queste due mosse sarebbero nate sbagliate e verdi.
 *
 * ─── LE DUE NON SONO SIMMETRICHE ───────────────────────────────────────────
 *
 * Gyro Ball è una formula continua col tetto a 150: ogni punto di Velocità
 * sposta il numero. Electro Ball è una scala a cinque gradini sul rapporto
 * INTERO: fra 1,0 e 1,9 volte la Velocità del bersaglio la potenza è 60 e non
 * si muove. Due forme diverse perché nel riferimento sono due forme diverse.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }
import {
  MOSSE_POTENZA_DA_VELOCITA, haPotenzaDaVelocita,
  potenzaGyroBall, potenzaElectroBall,
} from '../lib/rules.js'
import { mossaNonCalcolata } from '../lib/gap.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = (extra = {}) => ({
  atkPokemon: 'ferrothorn', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
  atkAbility: null, atkItem: null, level: 50, atkSpeBoost: 0, ...extra,
})
const dif = (specie, extra = {}) => ({
  defPokemon: specie, defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defSpeBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const nostro = (a, d, move, field = {}) => calculateDamage({ attacker: a, defender: d, move, field })

// ═══════════════════════════════════════════════════════════════════════════
// 1. Entrano, e prima uscivano `null`
// ═══════════════════════════════════════════════════════════════════════════

describe('le due entrano nel calcolo', () => {
  it('hanno potenza zero nei dati, e passano lo stesso', () => {
    for (const m of ['gyro ball', 'electro ball']) {
      expect(movesData[m].power, `${m} ha una potenza`).toBe(0)
      expect(nostro(att(), dif('flutter-mane'), m), `${m} esce null`).not.toBeNull()
    }
  })

  it('e il badge «non calcolata» se n\'è andato da tutt\'e due', () => {
    // Il registro delle mosse è generato dalla riga d'ingresso del motore:
    // implementarle lo aggiorna da sé. Se questo test è rosso, manca
    // `npm run gap:gen`.
    expect(mossaNonCalcolata('gyro ball')).toBe(false)
    expect(mossaNonCalcolata('electro ball')).toBe(false)
    // E il controllo che si muove: una mossa ancora da fare ce l'ha.
    expect(mossaNonCalcolata('counter')).toBe(true)
  })

  it('sono due, e stanno in una lista sola', () => {
    expect([...MOSSE_POTENZA_DA_VELOCITA].sort()).toEqual(['electro ball', 'gyro ball'])
    expect(haPotenzaDaVelocita('earthquake')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Le due formule, e la loro differenza di forma
// ═══════════════════════════════════════════════════════════════════════════

describe('Gyro Ball è una formula continua col tetto', () => {
  it('25 × (Velocità del bersaglio / la propria), troncata', () => {
    expect(potenzaGyroBall(100, 100)).toBe(25)
    expect(potenzaGyroBall(100, 200)).toBe(50)
    expect(potenzaGyroBall(50, 200)).toBe(100)
    // Il troncamento, non l'arrotondamento: 25 × 119/100 = 29,75 → 29.
    expect(potenzaGyroBall(100, 119)).toBe(29)
  })

  it('col tetto a 150 e senza pavimento a 1', () => {
    expect(potenzaGyroBall(10, 1000)).toBe(150)
    // Il riferimento NON ha il minimo di 1 che il gioco ha: contro un
    // bersaglio abbastanza lento la potenza è 0. Trascritto, non corretto —
    // il giorno che si vuole il minimo è un'aggiudicazione da registrare.
    expect(potenzaGyroBall(300, 10)).toBe(0)
  })

  it('e ogni punto di Velocità sposta il numero', () => {
    // La differenza di forma con Electro Ball, resa rossa-o-verde.
    expect(potenzaGyroBall(100, 101)).not.toBe(potenzaGyroBall(100, 105))
  })
})

describe('Electro Ball è una scala a gradini sul rapporto intero', () => {
  it('cinque gradini: 150, 120, 80, 60, 40', () => {
    expect(potenzaElectroBall(400, 100)).toBe(150)
    expect(potenzaElectroBall(300, 100)).toBe(120)
    expect(potenzaElectroBall(200, 100)).toBe(80)
    expect(potenzaElectroBall(100, 100)).toBe(60)
    expect(potenzaElectroBall(99, 100)).toBe(40)
  })

  it('e dentro un gradino la Velocità non conta', () => {
    // L'opposto di Gyro Ball: fra 1,0 e 1,9 volte la potenza resta 60.
    expect(potenzaElectroBall(100, 100)).toBe(60)
    expect(potenzaElectroBall(199, 100)).toBe(60)
    expect(potenzaElectroBall(200, 100)).toBe(80)
  })

  it('il controllo sulla divisione per zero c\'è perché ce l\'ha il riferimento', () => {
    expect(potenzaElectroBall(100, 0)).toBe(40)
  })
})

describe('e le due guardano il rapporto in versi OPPOSTI', () => {
  it('lento contro veloce: Gyro Ball forte, Electro Ball debole', () => {
    // Se qualcuno passasse le due Velocità nello stesso ordine a tutt'e due,
    // a Velocità simili non si vedrebbe. Qui la differenza è di 15 volte.
    const lento = att()                                  // Ferrothorn, 20 base
    const veloce = dif('flutter-mane')                   // 135 base
    const gyro = nostro(lento, veloce, 'gyro ball')
    const electro = nostro(lento, veloce, 'electro ball')
    expect(gyro.effectiveBP).toBeGreaterThan(electro.effectiveBP)
    expect(electro.effectiveBP).toBe(40)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. È la Velocità EFFETTIVA, non quella coi soli stadi
// ═══════════════════════════════════════════════════════════════════════════

describe('leggono la Velocità effettiva, non quella grezza', () => {
  const base = () => nostro(att(), dif('flutter-mane'), 'gyro ball').effectiveBP

  it('gli stadi del bersaglio contano', () => {
    expect(nostro(att(), dif('flutter-mane', { defSpeBoost: 6 }), 'gyro ball').effectiveBP)
      .toBeGreaterThan(base())
    expect(nostro(att(), dif('flutter-mane', { defSpeBoost: -6 }), 'gyro ball').effectiveBP)
      .toBeLessThan(base())
  })

  it('il Ferrolimo del bersaglio conta', () => {
    expect(nostro(att(), dif('flutter-mane', { defItem: 'choice scarf' }), 'gyro ball').effectiveBP)
      .toBeGreaterThan(base())
  })

  it('la paralisi del bersaglio conta', () => {
    expect(nostro(att(), dif('flutter-mane', { defStatus: 'paralyzed' }), 'gyro ball').effectiveBP)
      .toBeLessThan(base())
  })

  it('e il Ferroblocco di chi attacca lo rende più forte', () => {
    // Gyro Ball premia chi è lento: rallentare sé stessi la potenzia. È il
    // caso che distingue «leggo la Velocità di tutt'e due» da «leggo solo
    // quella del bersaglio».
    expect(nostro(att({ atkItem: 'iron ball' }), dif('flutter-mane'), 'gyro ball').effectiveBP)
      .toBeGreaterThan(base())
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Contro l'oracolo
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

  const veloce = (extra = {}) => att({ atkPokemon: 'flutter-mane', ...extra })

  const CASI = [
    ['Gyro Ball, nudo',                   'gyro ball',    att(), dif('flutter-mane'), {}],
    ['Gyro Ball, bersaglio a +6',         'gyro ball',    att(), dif('flutter-mane', { defSpeBoost: 6 }), {}],
    ['Gyro Ball, bersaglio a -6',         'gyro ball',    att(), dif('flutter-mane', { defSpeBoost: -6 }), {}],
    ['Gyro Ball, bersaglio col Ferrolimo', 'gyro ball',   att(), dif('flutter-mane', { defItem: 'choice scarf' }), {}],
    ['Gyro Ball, bersaglio paralizzato',  'gyro ball',    att(), dif('flutter-mane', { defStatus: 'paralyzed' }), {}],
    ['Gyro Ball, chi attacca a +6',       'gyro ball',    att({ atkSpeBoost: 6 }), dif('flutter-mane'), {}],
    ['Gyro Ball, chi attacca col Ferroblocco', 'gyro ball', att({ atkItem: 'iron ball' }), dif('flutter-mane'), {}],
    ['Gyro Ball contro chi è lento',      'gyro ball',    veloce(), dif('ferrothorn'), {}],
    ['Electro Ball, nudo',                'electro ball', veloce(), dif('ferrothorn'), {}],
    ['Electro Ball, bersaglio a +6',      'electro ball', veloce(), dif('ferrothorn', { defSpeBoost: 6 }), {}],
    ['Electro Ball, bersaglio a -6',      'electro ball', veloce(), dif('ferrothorn', { defSpeBoost: -6 }), {}],
    ['Electro Ball, chi attacca è lento', 'electro ball', att(), dif('flutter-mane'), {}],
    ['Electro Ball, bersaglio paralizzato', 'electro ball', veloce(), dif('ferrothorn', { defStatus: 'paralyzed' }), {}],
    ['Gyro Ball su uno Spettro — l\'immunità viene prima', 'gyro ball', att(), dif('gengar'), {}],
    ['Electro Ball su un Terra — immune',  'electro ball', veloce(), dif('garchomp'), {}],
    ['Terremoto — il controllo negativo',  'earthquake',   att(), dif('flutter-mane'), {}],
  ]

  for (const [nome, move, a, d, field] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker: a, defender: d, move, field })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      const r = nostro(a, d, move, field)
      expect(r.immune ? [] : r.rolls).toEqual(rif.rolls)
    })
  }

  it.runIf(vendorPresente)('e l\'oracolo distingue davvero i casi fra loro', () => {
    // Il controllo che rende vere le righe qui sopra. Prima della correzione
    // sulla Velocità, l'harness rispondeva 96 BP a tutte e sette le
    // configurazioni di Gyro Ball: confrontarsi con lui non provava niente.
    const bp = (a, d) => harness.calcola({ attacker: a, defender: d, move: 'gyro ball', field: {} })
      .descrizione.match(/\((\d+) BP\)/)[1]
    const numeri = new Set([
      bp(att(), dif('flutter-mane')),
      bp(att(), dif('flutter-mane', { defSpeBoost: 6 })),
      bp(att(), dif('flutter-mane', { defItem: 'choice scarf' })),
      bp(att(), dif('flutter-mane', { defStatus: 'paralyzed' })),
      bp(att({ atkSpeBoost: 6 }), dif('flutter-mane')),
    ])
    expect(numeri.size, 'l\'oracolo risponde uguale a configurazioni diverse').toBe(5)
  })
})
