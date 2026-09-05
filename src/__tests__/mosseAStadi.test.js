// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/mosseAStadi.test.js
 *
 * Stored Power, Power Trip e Punishment — il punto f di `basePowerFunc`
 * (`damage_MASTER.js:1385-1395`), la potenza che si ricava dagli stadi.
 *
 * ─── DUE DI QUESTE TRE NON ERANO NEL DIVARIO, ED È IL PUNTO ────────────────
 *
 * Punishment ha `power: 0` nei dati: usciva `null`, disegnava `~`, e almeno
 * portava il segnalino «non calcolata».
 *
 * Stored Power e Power Trip no. Hanno `power: 20`, quindi il motore quel 20 lo
 * usava e mostrava un numero — **senza nessun avviso**. Con chi attacca a +6 in
 * due statistiche il riferimento dice 260 di potenza; noi dicevamo 20, e il
 * danno usciva dodici volte più basso.
 *
 * Il registro delle mosse non poteva vederle: elenca chi esce `null`, e queste
 * uscivano un numero. È la categoria peggiore delle tre — non «non lo so», ma
 * «ecco il numero», detto con sicurezza e sbagliato.
 *
 * ─── E POWER TRIP SI CHIAMAVA «POWER RIP» ──────────────────────────────────
 *
 * Manca la T. Il nome nei nostri dati è la chiave con cui l'harness trova la
 * mossa nel riferimento, quindi Power Trip era **invisibile all'oracolo**:
 * qualunque cosa il motore ne facesse, il confronto rispondeva «mossa non
 * presente in NCP» e il caso veniva escluso. Lo stesso valeva per
 * Nature's Madness, scritta «Natures's Madness».
 *
 * Sono due caratteri, e tenevano fuori due mosse dalla verifica.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }
import {
  MOSSE_STADI_ATTACCANTE, MOSSE_STADI_DIFENSORE, haPotenzaDaStadi,
  contaStadiPositivi, potenzaDaStadiAttaccante, potenzaDaStadiDifensore,
} from '../lib/rules.js'
import { mossaNonCalcolata } from '../lib/gap.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = (extra = {}) => ({
  atkPokemon: 'garchomp', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
  atkAbility: null, atkItem: null, level: 50,
  atkBoost: 0, spAtkBoost: 0, atkDefBoost: 0, atkSpDefBoost: 0, atkSpeBoost: 0,
  atkAbilityFlags: {}, ...extra,
})
const dif = (extra = {}) => ({
  defPokemon: 'blissey', defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: null, defItem: null,
  defBoost: 0, spDefBoost: 0, defAtkBoost: 0, defSpAtkBoost: 0, defSpeBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const nostro = (a, d, move, field = {}) => calculateDamage({ attacker: a, defender: d, move, field })

// ═══════════════════════════════════════════════════════════════════════════
// 1. I due caratteri che tenevano due mosse fuori dalla verifica
// ═══════════════════════════════════════════════════════════════════════════

describe('i nomi combaciano col riferimento', () => {
  it('Power Trip e Nature\'s Madness sono scritte giuste', () => {
    expect(movesData['power trip'].name).toBe('Power Trip')
    expect(movesData['natures madness'].name).toBe("Nature's Madness")
  })

  it.runIf(vendorPresente)('e nessun\'altra mossa ha un nome che il riferimento non riconosce', async () => {
    // Il controllo generale, che è il motivo per cui i due refusi sono usciti:
    // cercarli a mano su 810 nomi non sarebbe successo. Restano fuori solo le
    // mosse che NCP non ha affatto — quelle hanno la chiave diversa, non il
    // nome sbagliato.
    const norma = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const { caricaNCP } = await import('../../scripts/ncp/contesto.mjs')
    const loro = caricaNCP().leggi('moves')
    const perNorma = new Map(Object.keys(loro).map(n => [norma(n), n]))
    const refusi = Object.entries(movesData)
      .filter(([, v]) => !loro[v.name])
      .filter(([k]) => perNorma.has(norma(k)))
      .map(([k, v]) => `${k}: "${v.name}" invece di "${perNorma.get(norma(k))}"`)
    expect(refusi).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Le due formule
// ═══════════════════════════════════════════════════════════════════════════

describe('si contano solo gli stadi POSITIVI', () => {
  it('i negativi non si sottraggono', () => {
    // `damage_MASTER.js:701`: la somma salta i valori <= 0. Un Pokémon a +2 e
    // −2 conta 2, non 0 — e uno scritto con una somma algebrica direbbe zero.
    expect(contaStadiPositivi({ at: 2, df: -2, sa: 0, sd: 0, sp: 0 })).toBe(2)
    expect(contaStadiPositivi({ at: -6, df: -6, sa: -6, sd: -6, sp: -6 })).toBe(0)
  })

  it('e le statistiche sono cinque: la Velocità entra, i PS no', () => {
    // `STATS_GSC = [AT, DF, SA, SD, SP]`.
    expect(contaStadiPositivi({ at: 1, df: 1, sa: 1, sd: 1, sp: 1 })).toBe(5)
    expect(contaStadiPositivi({ at: 0, df: 0, sa: 0, sd: 0, sp: 3 })).toBe(3)
    expect(contaStadiPositivi({ hp: 6, at: 0, df: 0, sa: 0, sd: 0, sp: 0 })).toBe(0)
  })
})

describe('due formule, e una sola delle due ha il tetto', () => {
  it('Stored Power e Power Trip: 20 + 20 per stadio, senza tetto', () => {
    expect(potenzaDaStadiAttaccante({ at: 0, df: 0, sa: 0, sd: 0, sp: 0 })).toBe(20)
    expect(potenzaDaStadiAttaccante({ at: 6, df: 0, sa: 0, sd: 0, sp: 0 })).toBe(140)
    // A +6 su tutte e cinque fa 620, e il riferimento lo lascia salire: se
    // qualcuno ci mettesse il tetto di Punishment per simmetria, qui uscirebbe
    // 200.
    expect(potenzaDaStadiAttaccante({ at: 6, df: 6, sa: 6, sd: 6, sp: 6 })).toBe(620)
  })

  it('Punishment: 60 + 20 per stadio, col tetto a 200', () => {
    expect(potenzaDaStadiDifensore({ at: 0, df: 0, sa: 0, sd: 0, sp: 0 })).toBe(60)
    expect(potenzaDaStadiDifensore({ at: 6, df: 0, sa: 0, sd: 0, sp: 0 })).toBe(180)
    expect(potenzaDaStadiDifensore({ at: 6, df: 6, sa: 0, sd: 0, sp: 0 })).toBe(200)
    expect(potenzaDaStadiDifensore({ at: 6, df: 6, sa: 6, sd: 6, sp: 6 })).toBe(200)
  })

  it('le tre mosse stanno in due liste, perché guardano lati diversi', () => {
    expect([...MOSSE_STADI_ATTACCANTE].sort()).toEqual(['power trip', 'stored power'])
    expect([...MOSSE_STADI_DIFENSORE]).toEqual(['punishment'])
    expect(haPotenzaDaStadi('earthquake')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Nel motore, e il lato giusto
// ═══════════════════════════════════════════════════════════════════════════

describe('il motore le calcola, e guarda il lato giusto', () => {
  it('Stored Power cresce con gli stadi di CHI ATTACCA', () => {
    expect(nostro(att(), dif(), 'stored power').effectiveBP).toBe(20)
    expect(nostro(att({ atkBoost: 6 }), dif(), 'stored power').effectiveBP).toBe(140)
    expect(nostro(att({ atkBoost: 6, spAtkBoost: 6 }), dif(), 'stored power').effectiveBP).toBe(260)
  })

  it('e NON con quelli di chi subisce', () => {
    // Il controllo che si muove: senza, un motore che legge il lato sbagliato
    // passerebbe il test qui sopra sui casi nudi.
    expect(nostro(att(), dif({ defBoost: 6, defAtkBoost: 6 }), 'stored power').effectiveBP).toBe(20)
  })

  it('Punishment cresce con gli stadi di CHI SUBISCE', () => {
    expect(nostro(att(), dif(), 'punishment').effectiveBP).toBe(60)
    expect(nostro(att(), dif({ defAtkBoost: 6 }), 'punishment').effectiveBP).toBe(180)
    expect(nostro(att(), dif({ defAtkBoost: 6, defBoost: 6 }), 'punishment').effectiveBP).toBe(200)
  })

  it('e NON con quelli di chi attacca', () => {
    expect(nostro(att({ atkBoost: 6 }), dif(), 'punishment').effectiveBP).toBe(60)
  })

  it('Punishment entra nel calcolo, e ha perso il badge', () => {
    expect(movesData['punishment'].power).toBe(0)
    expect(nostro(att(), dif(), 'punishment')).not.toBeNull()
    expect(mossaNonCalcolata('punishment')).toBe(false)
  })

  it('Power Trip fa quello che fa Stored Power', () => {
    // Nel riferimento sono due `case` dello stesso ramo. Se un giorno
    // divergessero, sarebbe stato per distrazione.
    const a = att({ atkBoost: 3, atkSpeBoost: 2 })
    expect(nostro(a, dif(), 'power trip').effectiveBP)
      .toBe(nostro(a, dif(), 'stored power').effectiveBP)
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

  const CASI = [
    ['Stored Power, nudo',            'stored power', att(), dif(), {}],
    ['Stored Power, chi attacca a +6', 'stored power', att({ atkBoost: 6 }), dif(), {}],
    ['Stored Power, +6 e +6',         'stored power', att({ atkBoost: 6, spAtkBoost: 6 }), dif(), {}],
    ['Stored Power, +2 e -2',         'stored power', att({ atkBoost: 2, atkDefBoost: -2 }), dif(), {}],
    ['Stored Power, stadi sul bersaglio', 'stored power', att(), dif({ defAtkBoost: 6 }), {}],
    ['Power Trip, chi attacca a +6',  'power trip',   att({ atkBoost: 6 }), dif(), {}],
    ['Power Trip, nudo',              'power trip',   att(), dif(), {}],
    ['Punishment, bersaglio nudo',    'punishment',   att(), dif(), {}],
    ['Punishment, bersaglio a +6',    'punishment',   att(), dif({ defAtkBoost: 6 }), {}],
    ['Punishment, bersaglio oltre il tetto', 'punishment', att(), dif({ defAtkBoost: 6, defBoost: 6 }), {}],
    ['Punishment, stadi su chi attacca', 'punishment', att({ atkBoost: 6 }), dif(), {}],
    ['Terremoto — il controllo negativo', 'earthquake', att({ atkBoost: 6 }), dif(), {}],
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

  it.runIf(vendorPresente)('Power Trip adesso l\'oracolo la trova', () => {
    // Prima del refuso corretto rispondeva «mossa non presente in NCP», e
    // tutti i casi qui sopra sarebbero stati esclusi in silenzio.
    const r = harness.calcola({ attacker: att(), defender: dif(), move: 'power trip', field: {} })
    expect(r.ok, r.motivo).toBe(true)
    const n = harness.calcola({ attacker: att(), defender: dif(), move: 'natures madness', field: {} })
    expect(n.ok, n.motivo).toBe(true)
  })
})
