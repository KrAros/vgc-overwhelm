// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/foulPlayAcrobatics.test.js
 *
 * Le due mosse che un numero ce l'avevano, e sbagliato.
 *
 * ─── LA CATEGORIA PEGGIORE, DI NUOVO ───────────────────────────────────────
 *
 * Le venti mosse col badge almeno avvisano: la tabella scrive `~` e il
 * segnalino dice di non fidarsi. Queste due no. Hanno una potenza nei dati, il
 * motore la usava, e mostravano un numero con sicurezza.
 *
 *   Foul Play    attacca con l'Attacco di CHI SUBISCE (`calcAttack` punto a).
 *                Noi usavamo quello di chi tira: Blissey contro Garchomp, 12
 *                invece di 56 — e col bersaglio a +6, 12 invece di 220.
 *
 *   Acrobatics   vale 110 a mani vuote e 55 con qualcosa in mano
 *                (`basePowerFunc` punto g.i). Noi usavamo sempre il 55 dei
 *                dati, cioè metà danno proprio nel modo normale di usarla.
 *
 * ─── LE DUE SONO LA STESSA IDEA DI BODY PRESS, DA DUE LATI ─────────────────
 *
 * Nel riferimento Foul Play e Body Press sono due righe consecutive: la prima
 * cambia DI CHI è la statistica, la seconda QUALE statistica. Body Press il
 * progetto ce l'aveva già; questa è la riga sopra.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }
import { usaAttaccoAvversario, potenzaAcrobatics } from '../lib/rules.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = (specie, extra = {}) => ({
  atkPokemon: specie, atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
  atkAbility: null, atkItem: null, level: 50,
  atkBoost: 0, spAtkBoost: 0, atkDefBoost: 0, atkSpDefBoost: 0, atkSpeBoost: 0,
  atkAbilityFlags: {}, ...extra,
})
const dif = (specie, extra = {}) => ({
  defPokemon: specie, defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: null, defItem: null,
  defBoost: 0, spDefBoost: 0, defAtkBoost: 0, defSpAtkBoost: 0, defSpeBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const nostro = (a, d, move, field = {}) => calculateDamage({ attacker: a, defender: d, move, field })

// ═══════════════════════════════════════════════════════════════════════════
// 1. Foul Play
// ═══════════════════════════════════════════════════════════════════════════

describe('Foul Play attacca con l\'Attacco del bersaglio', () => {
  it('il danno lo decide chi SUBISCE, non chi tira', () => {
    // Blissey ha Attacco 10, Garchomp 130. Se la mossa leggesse l'Attacco di
    // chi tira, Blissey farebbe una carezza.
    const blisseyControGarchomp = nostro(att('blissey'), dif('garchomp'), 'foul play')
    const garchompControBlissey = nostro(att('garchomp'), dif('blissey'), 'foul play')
    // Stessa mossa, i due Pokémon scambiati: chi tira non conta, e il primo
    // caso (bersaglio forte) deve fare più danno base del secondo a parità di
    // difesa — qui basta che i due non coincidano per la ragione sbagliata.
    expect(blisseyControGarchomp).not.toBeNull()
    expect(garchompControBlissey).not.toBeNull()
  })

  it('gli stadi che contano sono quelli del BERSAGLIO', () => {
    const a = att('blissey')
    const nudo = nostro(a, dif('garchomp'), 'foul play')
    const bersaglioSuA = nostro(a, dif('garchomp', { defAtkBoost: 2 }), 'foul play')
    const chiTiraSuA = nostro(att('blissey', { atkBoost: 2 }), dif('garchomp'), 'foul play')

    expect(bersaglioSuA.minDmg, 'il +2 del bersaglio non conta').toBeGreaterThan(nudo.minDmg)
    expect(chiTiraSuA.rolls, 'il +2 di chi tira conta e non dovrebbe').toEqual(nudo.rolls)
  })

  it('e una mossa fisica normale fa l\'opposto', () => {
    // Il controllo che si muove: senza, un motore che ignora ENTRAMBI gli
    // stadi passerebbe metà del test qui sopra.
    const a = att('garchomp')
    const nudo = nostro(a, dif('blissey'), 'crunch')
    expect(nostro(att('garchomp', { atkBoost: 2 }), dif('blissey'), 'crunch').minDmg)
      .toBeGreaterThan(nudo.minDmg)
    expect(nostro(a, dif('blissey', { defAtkBoost: 2 }), 'crunch').rolls).toEqual(nudo.rolls)
  })

  it('la lista è di nomi, e ne contiene uno', () => {
    expect(usaAttaccoAvversario('foul play')).toBe(true)
    expect(usaAttaccoAvversario('crunch')).toBe(false)
    expect(usaAttaccoAvversario('body press')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Acrobatics
// ═══════════════════════════════════════════════════════════════════════════

describe('Acrobatics vale il doppio a mani vuote', () => {
  it('110 senza strumento, 55 con', () => {
    expect(nostro(att('garchomp'), dif('blissey'), 'acrobatics').effectiveBP).toBe(110)
    expect(nostro(att('garchomp', { atkItem: 'leftovers' }), dif('blissey'), 'acrobatics').effectiveBP).toBe(55)
  })

  it('e nei dati la potenza scritta resta 55', () => {
    // Il 55 è il numero del riferimento per il caso «con strumento», e resta
    // nei dati: la mossa non ha due potenze, ne ha una che il punto g.i
    // sostituisce.
    expect(movesData['acrobatics'].power).toBe(55)
  })

  it('la Volagemma non la ferma', () => {
    expect(potenzaAcrobatics('flying gem')).toBe(110)
    expect(potenzaAcrobatics('')).toBe(110)
    expect(potenzaAcrobatics(null)).toBe(110)
    expect(potenzaAcrobatics('leftovers')).toBe(55)
  })

  it('Klutz NON la fa tornare a mani vuote', () => {
    // Il riferimento legge lo strumento dopo `checkKlutz`, che non lo svuota:
    // lo sostituisce con la stringa `"Klutz"`. Da noi va letto lo strumento
    // grezzo, perché la nostra chiave post-Klutz è la stringa vuota — che qui
    // vorrebbe dire l'opposto. Senza questa riga, un Klutz con lo strumento
    // addosso tirerebbe un Acrobatics da 110.
    expect(nostro(
      att('garchomp', { atkItem: 'leftovers', atkAbility: 'klutz' }),
      dif('blissey'), 'acrobatics',
    ).effectiveBP).toBe(55)
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

  const CASI = [
    ['Foul Play, Blissey contro Garchomp',  'foul play',  att('blissey'), dif('garchomp'), {}],
    ['Foul Play, Garchomp contro Blissey',  'foul play',  att('garchomp'), dif('blissey'), {}],
    ['Foul Play, bersaglio a +6',           'foul play',  att('blissey'), dif('garchomp', { defAtkBoost: 6 }), {}],
    ['Foul Play, bersaglio a -6',           'foul play',  att('blissey'), dif('garchomp', { defAtkBoost: -6 }), {}],
    ['Foul Play, chi tira a +6 — non conta', 'foul play', att('blissey', { atkBoost: 6 }), dif('garchomp'), {}],
    ['Foul Play col critico e bersaglio a -6', 'foul play', att('blissey'), dif('garchomp', { defAtkBoost: -6 }), { crit: true }],
    ['Foul Play contro Imprudenza',         'foul play',  att('blissey'), dif('bibarel', { defAbility: 'unaware', defAtkBoost: 6 }), {}],
    ['Foul Play con Hustle su chi tira',    'foul play',  att('flapple', { atkAbility: 'hustle' }), dif('garchomp'), {}],
    ['Crunch — il controllo negativo',      'crunch',     att('blissey'), dif('garchomp', { defAtkBoost: 6 }), {}],
    ['Acrobatics a mani vuote',             'acrobatics', att('garchomp'), dif('blissey'), {}],
    ['Acrobatics con lo strumento',         'acrobatics', att('garchomp', { atkItem: 'leftovers' }), dif('blissey'), {}],
    ['Acrobatics con Klutz e strumento',    'acrobatics', att('garchomp', { atkItem: 'leftovers', atkAbility: 'klutz' }), dif('blissey'), {}],
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

  it.runIf(vendorPresente)('la Volagemma l\'oracolo non la sa rispondere, ed è detto', () => {
    // `flying gem` sta nel nostro `items.json` e NON nei dati del riferimento:
    // l'harness esclude il caso con un motivo scritto. Quindi la clausola
    // «Flying Gem → 110» è trascritta dalla riga del riferimento e verificata
    // solo come funzione, non contro l'oracolo eseguito.
    //
    // Questo caso è qui perché il buco resti dichiarato: il giorno che NCP
    // aggiunge lo strumento, diventa rosso e il confronto vero si può fare.
    const r = harness.calcola({
      attacker: att('garchomp', { atkItem: 'flying gem' }),
      defender: dif('blissey'), move: 'acrobatics', field: {},
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('strumento non presente in NCP')
  })

  it.runIf(vendorPresente)('e l\'oracolo distingue davvero i due lati', () => {
    // Il controllo che rende vere le righe di Foul Play: se l'harness non
    // passasse lo stadio d'Attacco del difensore — come faceva fino a
    // stamattina — risponderebbe uguale a bersaglio nudo e bersaglio a +6.
    const max = (d) => harness.calcola({ attacker: att('blissey'), defender: d, move: 'foul play', field: {} }).rolls.at(-1)
    expect(max(dif('garchomp'))).not.toBe(max(dif('garchomp', { defAtkBoost: 6 })))
  })
})
