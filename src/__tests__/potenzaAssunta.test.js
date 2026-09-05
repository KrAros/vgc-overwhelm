// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/potenzaAssunta.test.js
 *
 * Return, Frustration e Trump Card — le tre mosse la cui potenza non è una
 * formula da trascrivere ma **un numero che vale sotto un'ipotesi**.
 *
 * Nel gioco la loro potenza è variabile: le prime due con l'affetto, la terza
 * coi PP rimasti. Il riferimento non le calcola e lo dichiara — i punti d ed
 * i.vii di `basePowerFunc` sono commenti senza codice sotto, come Psywave —
 * e cade sul `move.bp` dei suoi dati: 102, 102, 40.
 *
 * ─── DUE IPOTESI, E SONO OPPOSTE ───────────────────────────────────────────
 *
 *   Return, Frustration   102 è il MASSIMO, e il riferimento lo dice a voce:
 *                         «assumendo che faccia sempre il danno massimo».
 *   Trump Card            40 è il MINIMO, cioè il valore con quattro o più PP.
 *                         A un PP solo la mossa vale 200.
 *
 * Il numero sta in `rules.js` e non in `moves.json` per questo: in un file di
 * dati sembrerebbe un fatto sulla mossa, e non lo è — è una scelta, e va letta
 * accanto alla ragione.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }
import { MOSSE_POTENZA_ASSUNTA, haPotenzaAssunta } from '../lib/rules.js'
import { mossaNonCalcolata } from '../lib/gap.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const LE_TRE = ['return', 'frustration', 'trump card']

const att = (extra = {}) => ({
  atkPokemon: 'garchomp', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
  atkAbility: null, atkItem: null, level: 50, atkBoost: 0, spAtkBoost: 0,
  atkAbilityFlags: {}, ...extra,
})
const dif = (specie = 'blissey', extra = {}) => ({
  defPokemon: specie, defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const nostro = (a, d, move, field = {}) => calculateDamage({ attacker: a, defender: d, move, field })

describe('le tre entrano nel calcolo, e il badge se n\'è andato', () => {
  it('hanno potenza zero nei dati e passano lo stesso', () => {
    for (const m of LE_TRE) {
      expect(movesData[m].power, `${m} ha una potenza nei dati`).toBe(0)
      expect(nostro(att(), dif(), m), `${m} esce null`).not.toBeNull()
      expect(mossaNonCalcolata(m), `${m} porta ancora il badge`).toBe(false)
    }
  })

  it('e Beat Up no, che sembra della stessa famiglia', () => {
    // Anche Beat Up è un commento senza codice nel riferimento (punto i.i) e
    // cade su `move.bp: 14`. Non è qui perché l'oracolo la calcola con UN
    // colpo solo mentre i nostri dati ne prevedono da uno a sei: il numero
    // non sarebbe confrontabile, e sceglierne uno sarebbe un'aggiudicazione.
    expect(movesData['beat up'].colpi).toEqual([1, 6])
    expect(haPotenzaAssunta('beat up')).toBe(false)
    expect(mossaNonCalcolata('beat up')).toBe(true)
  })
})

describe('i tre numeri, e le due ipotesi opposte', () => {
  it('102, 102 e 40', () => {
    expect(MOSSE_POTENZA_ASSUNTA).toEqual({ 'return': 102, 'frustration': 102, 'trump card': 40 })
  })

  it('Return e Frustration danno lo stesso danno', () => {
    // Nel gioco sono opposte — una cresce con l'affetto, l'altra cala — ma
    // sotto l'ipotesi del massimo coincidono, ed è il riferimento a dirlo.
    expect(nostro(att(), dif(), 'return').rolls).toEqual(nostro(att(), dif(), 'frustration').rolls)
  })

  it('e il numero arriva in tabella', () => {
    expect(nostro(att(), dif(), 'return').effectiveBP).toBe(102)
    expect(nostro(att(), dif(), 'trump card').effectiveBP).toBe(40)
  })

  it('sono mosse normali per tutto il resto', () => {
    // Il numero è assunto, la catena no: efficacia, STAB e stadi valgono.
    // Se qualcuno le trattasse come danno fisso, questo diventerebbe rosso.
    const nudo = nostro(att(), dif(), 'return')
    expect(nostro(att({ atkBoost: 2 }), dif(), 'return').minDmg).toBeGreaterThan(nudo.minDmg)
    expect(nostro(att(), dif('gengar'), 'return').immune).toBe(true)
    expect(nudo.rolls).toHaveLength(16)
  })
})

describe('contro il riferimento eseguito', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    harness = (await import('../../scripts/ncp/harness.mjs')).creaHarness()
    const { caricaNCP } = await import('../../scripts/ncp/contesto.mjs')
    const mosse = caricaNCP().leggi('moves')
    globalThis.__bp = Object.fromEntries(Object.entries(mosse).map(([n, v]) => [n, v.bp]))
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const CASI = [
    ['Return su Blissey',            'return',      att(), dif(), {}],
    ['Frustration su Blissey',       'frustration', att(), dif(), {}],
    ['Trump Card su Blissey',        'trump card',  att(), dif(), {}],
    ['Return con lo stadio',         'return',      att({ atkBoost: 2 }), dif(), {}],
    ['Return su uno Spettro',        'return',      att(), dif('gengar'), {}],
    ['Trump Card contro chi resiste', 'trump card', att(), dif('umbreon'), {}],
    ['Terremoto — il controllo negativo', 'earthquake', att(), dif(), {}],
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

  it.runIf(vendorPresente)('e i numeri vengono dal riferimento, non da noi', () => {
    // Il controllo che tiene ferma la tabella: se qualcuno cambiasse 102 in
    // 100 «perché è più tondo», i casi qui sopra diventerebbero rossi. Questo
    // lo dice esplicitamente, leggendo la potenza dai dati del vendor.
    const dati = harness.calcola({ attacker: att(), defender: dif(), move: 'return', field: {} })
    expect(dati.ok).toBe(true)
    for (const [mossa, potenza] of Object.entries(MOSSE_POTENZA_ASSUNTA)) {
      const nome = movesData[mossa].name
      expect(globalThis.__bp[nome], `${mossa}: il numero non è quello del riferimento`).toBe(potenza)
    }
  })
})
