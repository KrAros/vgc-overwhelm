// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/squadreSalvate.test.js
 *
 * Una squadra salvata con un'abilità impossibile si guarisce al caricamento.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * La sessione Y ha corretto l'import, e Simone ha rivisto lo stesso difetto su
 * Raichu-Mega-Y il giorno dopo. Misurato: entrambi i parser producono
 * `no-guard` per quel paste, quindi il valore sbagliato non veniva
 * dall'ingresso — veniva da `localStorage`, dove la squadra era stata salvata
 * PRIMA della correzione.
 *
 * **Correggere l'ingresso non basta quando lo stato è persistente.** È il
 * genere di conclusione che si può solo misurare: entrambe le ipotesi
 * — «l'import sbaglia ancora» e «il dato è vecchio» — spiegano il sintomo, e
 * solo la sonda le distingue.
 *
 * ─── LA SEMINA ─────────────────────────────────────────────────────────────
 *
 * Stessa forma di `accessibilitaEditor.test.jsx`: lo store legge
 * `localStorage` all'import ed è un singleton, quindi gli import applicativi
 * devono venire DOPO — da qui `beforeAll` con import dinamici.
 */

import { describe, it, expect, beforeAll } from 'vitest'

const LS_KEY = 'vgc-overwhelm-teams'

const slot = (key, ability) => ({
  key, ability, moves: [null, null, null, null], sps: [0, 0, 0, 0, 0, 0],
  nature: null, item: null,
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {}, lastRespectsKOs: 0,
})

// Le tre abilità sono impossibili per la specie che le porta: sono quelle del
// Pokémon PRE-mega, che è esattamente quello che un paste Showdown scrive.
const SALVATO = {
  team1: [slot('charizard-mega-y', 'blaze'), slot('floette-mega', 'flower veil')],
  team2: [slot('raichu-mega-y', 'static'), slot('charizard', 'solar-power')],
}

let store
beforeAll(async () => {
  globalThis.localStorage = {
    _d: { [LS_KEY]: JSON.stringify(SALVATO) },
    getItem(k) { return this._d[k] ?? null },
    setItem(k, v) { this._d[k] = String(v) },
    removeItem(k) { delete this._d[k] },
  }
  store = (await import('../store/useCalcStore.js')).default
})

describe('le squadre salvate prima della correzione', () => {
  it('si guariscono al caricamento, in entrambi i team', () => {
    const s = store.getState()
    expect(s.team1[0].ability, 'charizard-mega-y').toBe('drought')
    expect(s.team1[1].ability, 'floette-mega').toBe('fairy-aura')
    expect(s.team2[0].ability, 'raichu-mega-y — il caso di Simone').toBe('no-guard')
  })

  it('un’abilità legittima non viene toccata', () => {
    // IL CONTROLLO CHE SI MUOVE: senza, il test passerebbe anche se il
    // caricamento sovrascrivesse SEMPRE con la prima abilità della specie —
    // `charizard` ha `blaze` come prima, e `solar-power` come seconda.
    expect(store.getState().team2[1].ability).toBe('solar-power')
  })

  it('la semina è arrivata davvero allo store', () => {
    // La sonda cieca della sessione L: se lo store avesse ignorato
    // `localStorage`, i due team sarebbero vuoti e le attese sopra
    // confronterebbero `undefined` con `undefined`.
    expect(store.getState().team1[0].key).toBe('charizard-mega-y')
    expect(store.getState().team2[0].key).toBe('raichu-mega-y')
  })
})
