// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/rattled.test.js
 *
 * Rattled: +1 alla Velocità quando subisce Intimidate
 * (`damage_MASTER.js:588`, dentro `checkIntimidate`).
 *
 * ─── IL +1 C'ERA GIÀ, E NON ARRIVAVA DA NESSUNA PARTE ──────────────────────
 *
 * La preparazione lo calcolava da sessioni — `boosts.sp` valeva 1 — ma nessuno
 * leggeva quel campo per la Velocità:
 *
 *   la colonna «Mod» chiama `statMostrata`, che riceve UN Pokémon solo, e
 *   Rattled dipende dall'avversario;
 *
 *   l'indicatore di chi va prima chiama `calcEffectiveSpe`, che legge
 *   `pokemon.speBoost`, cioè lo stadio messo a mano nell'editor.
 *
 * Il badge «non calcolata» era quindi corretto, con verdetto
 * `effetto-non-osservabile`: il grado si calcolava e moriva lì.
 *
 * ─── LE DUE STRADE, E PERCHÉ SERVIVANO INSIEME ─────────────────────────────
 *
 * La colonna «Mod» usa `opponentHasIntimidateActive`, lo stesso booleano con
 * cui il riquadro accende già Defiant, Contrary e Competitive — le altre tre
 * della stessa famiglia. Rattled era l'unica delle quattro senza riquadro.
 *
 * L'indicatore chiede gli stadi alla preparazione, che ha già tutt'e due i
 * Pokémon (`matrice.js` le passa a `whoGoesFirst`).
 *
 * Farne una sola avrebbe lasciato due sorgenti a dire numeri diversi sullo
 * stesso Pokémon — la colonna con il +1 e l'indicatore senza — che è
 * esattamente il difetto per cui `statMostrata` è stata scritta.
 *
 * ─── E DALLA STESSA STRADA ARRIVANO ALTRI DUE ──────────────────────────────
 *
 * L'Orbo Adrenalina (+1 Velocità a chi subisce Intimidate) e Battle Bond
 * erano persi allo stesso modo. Non è una correzione per un'abilità: è la
 * chiusura di un canale.
 */

import { describe, it, expect } from 'vitest'
import { preparaCoppia } from '../lib/preparazione.js'
import { whoGoesFirst, calcEffectiveSpe } from '../utils/speedOrder.js'
import { statMostrata } from '../lib/statMostrata.js'
import { STAT_SPE } from '../lib/rules.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const SP = [0, 0, 0, 0, 0, 0]

const slot = (key, ability, extra = {}) => ({
  key, sps: SP, nature: null, ability, item: null, abilityFlags: {},
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  moves: ['tackle'], ...extra,
})
const conIntimidate = (key) => slot(key, 'intimidate', {
  abilityFlags: { intimidateActive: true },
})

const lato = (pokemon, abilita, accesa = false, strumento = null) => ({
  pokemon, sps: SP, natura: null, livello: 50, abilita, strumento,
  abilitaAccesa: accesa, boosts: { at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
})

// ═══════════════════════════════════════════════════════════════════════════
// 1. I presupposti
// ═══════════════════════════════════════════════════════════════════════════

describe('i presupposti', () => {
  it('la voce dichiara l\'effetto — ed è il motivo per cui esce dal divario', () => {
    expect(ABILITY_EFFECTS['rattled'].rattled).toBe(true)
  })

  it('venti specie ce l\'hanno', () => {
    const con = Object.keys(pokemonData)
      .filter(k => (pokemonData[k].abilities ?? []).includes('rattled'))
    expect(con.length).toBeGreaterThanOrEqual(20)
  })

  it('la preparazione lo calcolava già, e continua a farlo', () => {
    const r = preparaCoppia({
      attaccante: lato('incineroar', 'intimidate', true),
      difensore: lato('magikarp', 'rattled'),
    })
    expect(r.difensore.boosts.sp).toBe(1)
  })

  it('senza un Intimidate acceso non succede niente', () => {
    const r = preparaCoppia({
      attaccante: lato('incineroar', 'intimidate', false),
      difensore: lato('magikarp', 'rattled'),
    })
    expect(r.difensore.boosts.sp).toBe(0)
  })

  it('e il Clear Amulet lo blocca', () => {
    // Nel riferimento la condizione è `target.item !== "Clear Amulet"`.
    const r = preparaCoppia({
      attaccante: lato('incineroar', 'intimidate', true),
      difensore: lato('magikarp', 'rattled', false, 'clear amulet'),
    })
    expect(r.difensore.boosts.sp).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. La colonna «Mod»
// ═══════════════════════════════════════════════════════════════════════════

describe('la colonna «Mod»', () => {
  const mod = (key, ability, avversarioConIntimidate, item = null) =>
    statMostrata(slot(key, ability, { item }), STAT_SPE, { avversarioConIntimidate })

  it('mostra il +1 quando l\'avversario ha Intimidate attivo', () => {
    const con   = mod('meowth-alola', 'rattled', true)
    const senza = mod('meowth-alola', 'rattled', false)
    expect(con.effettiva).toBeGreaterThan(senza.effettiva)
    expect(con.modificata).toBe(true)
  })

  it('e il rapporto è quello di un grado, non un numero qualunque', () => {
    // Uno stadio +1 vale ×1,5 sulla statistica.
    const con   = mod('meowth-alola', 'rattled', true)
    const senza = mod('meowth-alola', 'rattled', false)
    const r = con.effettiva / senza.effettiva
    expect(r).toBeGreaterThan(1.45)
    expect(r).toBeLessThan(1.55)
  })

  it('non lo mostra a chi non ha Rattled', () => {
    expect(mod('meowth-alola', 'pickup', true).effettiva)
      .toBe(mod('meowth-alola', 'pickup', false).effettiva)
  })

  it('né a chi porta il Clear Amulet', () => {
    expect(mod('meowth-alola', 'rattled', true, 'clear amulet').effettiva)
      .toBe(mod('meowth-alola', 'rattled', false, 'clear amulet').effettiva)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. L'indicatore di chi va prima
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Meowth di Alola ha 90 di Velocità base, Arcanine 95: senza il +1, Arcanine
 * va prima. Col +1 il Meowth passa avanti — ed è la coppia che rende il
 * ribaltamento visibile invece che solo probabile.
 */
describe('l\'ordine di velocità', () => {
  const chiPrima = (t1, t2) =>
    whoGoesFirst(t1, t2, { move: 'tackle' }, { move: 'tackle' }, null, false)

  it('senza Intimidate, va prima il più veloce', () => {
    expect(chiPrima(slot('meowth-alola', 'rattled'), slot('arcanine', 'flash-fire')))
      .toBe('t2')
  })

  it('con Intimidate acceso, il +1 ribalta l\'ordine', () => {
    expect(chiPrima(slot('meowth-alola', 'rattled'), conIntimidate('arcanine')))
      .toBe('t1')
  })

  it('e non ribalta niente per chi non ha Rattled', () => {
    // Stessa Velocità base di Meowth-Alola, abilità diversa.
    expect(chiPrima(slot('meowth-alola', 'pickup'), conIntimidate('arcanine')))
      .toBe('t2')
  })

  it('la Velocità mostrata e quella dell\'ordine sono lo stesso numero', () => {
    // Il difetto che le due strade insieme evitano: una sorgente col +1 e
    // l'altra senza direbbero numeri diversi sullo stesso Pokémon.
    const conMod = statMostrata(slot('meowth-alola', 'rattled'), STAT_SPE,
      { avversarioConIntimidate: true }).effettiva
    const perOrdine = calcEffectiveSpe(
      { ...slot('meowth-alola', 'rattled'), speBoost: 1 }, null)
    expect(conMod).toBe(perOrdine)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Gli altri due che passavano dalla stessa strada
// ═══════════════════════════════════════════════════════════════════════════

describe('dalla stessa strada arrivano anche gli altri', () => {
  it('l\'Orbo Adrenalina dà il suo +1 all\'ordine di velocità', () => {
    const senza = whoGoesFirst(
      slot('meowth-alola', 'pickup'), conIntimidate('arcanine'),
      { move: 'tackle' }, { move: 'tackle' }, null, false)
    const con = whoGoesFirst(
      slot('meowth-alola', 'pickup', { item: 'adrenaline orb' }), conIntimidate('arcanine'),
      { move: 'tackle' }, { move: 'tackle' }, null, false)
    expect(senza).toBe('t2')
    expect(con, 'l\'Orbo Adrenalina non arriva all\'indicatore').toBe('t1')
  })
})
