// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/accessibilitaEditor.test.jsx
 *
 * La stessa proprietà di `accessibilita.test.jsx` — nessun controllo senza
 * nome accessibile — ma con DUE SQUADRE CARICATE.
 *
 * ─── PERCHÉ SERVE UN SECONDO FILE ──────────────────────────────────────────
 *
 * Il test della sessione P renderizzava `App` con i team vuoti, e in
 * quello stato l'applicazione mostra DUE <select> e ZERO cursori. Con una
 * squadra ce ne sono dodici di cursori, più i <select> di stadio, natura,
 * preset, abilità, strumento e mosse.
 *
 * Quel test era quindi cieco all'editor intero, e passava per questo. Nel
 * piano avevo scritto che «asserisce la proprietà»: era troppo forte — la
 * asseriva sulla sola pagina d'ingresso. Trovato in P-2 contando i nodi.
 *
 * Non si può fare in un file solo: lo store legge `localStorage` all'import ed
 * è un singleton, quindi una volta seminato non si torna allo stato vuoto.
 * Vitest isola i moduli per file, e due file danno due stati puliti. La logica
 * di analisi però è UNA, in `helpers/nomiAccessibili.js`: due copie sarebbero
 * due copie della stessa assunzione.
 *
 * ─── LA SEMINA ─────────────────────────────────────────────────────────────
 *
 * Stessa forma di `prestazioni.test.jsx`, che è collaudata: `localStorage` è
 * l'unica via d'ingresso che lo store legge all'avvio, e gli import
 * applicativi devono venire DOPO — da qui `beforeAll` con import dinamici.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { nomiAccessibili } from './helpers/nomiAccessibili.js'

// ─── Semina, prima di qualunque import applicativo ───────────────────────────

const slot = (key, moves) => ({
  key, moves,
  sps: [4, 4, 4, 4, 4, 4],
  nature: 'adamant', ability: null, item: null,
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {}, lastRespectsKOs: 0,
})
const MOSSE_1 = ['flamethrower', 'earthquake', 'rock slide', 'dragon claw']
const MOSSE_2 = ['shadow ball', 'dark pulse', 'icy wind', 'thunderbolt']
const SQUADRE = {
  team1: ['garchomp', 'incineroar', 'rillaboom', 'amoonguss', 'dragonite', 'flutter-mane'].map((k) => slot(k, MOSSE_1)),
  team2: ['gholdengo', 'chi-yu', 'kingambit', 'iron-hands', 'ogerpon', 'urshifu'].map((k) => slot(k, MOSSE_2)),
}

const memoria = new Map([['vgc-overwhelm-teams', JSON.stringify(SQUADRE)]])
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = globalThis.window || {}
globalThis.window.location = { search: '', origin: 'http://test', pathname: '/' }

// ─── Render ──────────────────────────────────────────────────────────────────

let html, esito

beforeAll(async () => {
  const React = (await import('react')).default
  const { renderToStaticMarkup } = await import('react-dom/server')
  await import('../i18n.js')
  const App = (await import('../App.jsx')).default
  html = renderToStaticMarkup(React.createElement(App))
  esito = nomiAccessibili(html)
})

describe('editor pieno — la semina', () => {
  /** Senza questo controllo il file misurerebbe la stessa pagina vuota di
   *  `accessibilita.test.jsx` e passerebbe dicendo esattamente niente: è la
   *  ragione per cui esiste. */
  it('le squadre sono davvero caricate', () => {
    // minuscolo: nel markup i nomi sono in minuscolo e la maiuscola la mette
    // il CSS con `capitalize`. Cercare 'Garchomp' faceva fallire il controllo
    // su una semina perfettamente riuscita.
    expect(html).toContain('garchomp')
  })

  it('ci sono i cursori delle statistiche, che nello stato vuoto erano zero', () => {
    expect((html.match(/type="range"/g) || []).length).toBeGreaterThan(10)
  })
})

/**
 * ─── DA CARATTERIZZAZIONE A CRITERIO ───────────────────────────────────────
 *
 * In P-2/1 questi numeri erano un debito scritto: 14 <select> senza nome su
 * 18, e 36 <input> su 36. Erano asserzioni esatte apposta, perché anche un
 * MIGLIORAMENTO diventasse rosso e il progresso si vedesse invece di scivolare
 * dentro un test già verde.
 *
 * Pagato in S. I cinquanta controlli stavano in quattro componenti soli:
 *
 *   StatRow          cursore, campo numerico e stadio × 6 statistiche × 2
 *                    squadre = 36 nodi. Il nome porta dentro la sigla della
 *                    statistica, altrimenti uno screen reader legge dodici
 *                    cursori identici
 *   SearchSelects    le tre ricerche e la tendina abilità
 *   SlotEditor       la natura
 *
 * Dove esisteva già una stringa — `ui.search_pokemon`, `ui.search_item` — il
 * nome la RILEGGE invece di duplicarla. Sei chiavi nuove in `aria.*`, solo
 * dove non c'era niente da riusare.
 *
 * Da qui in poi sono zero, e restano zero.
 */
describe('editor pieno — controlli senza nome accessibile', () => {
  it('nessun <button> senza nome', () => {
    expect(esito.bottoni).toEqual([])
  })

  it('nessun <select> senza nome', () => {
    expect(esito.tendine).toEqual([])
  })

  it('nessun <input> senza nome', () => {
    expect(esito.campi).toEqual([])
  })

  /** Che i controlli ci siano davvero: senza, tre elenchi vuoti confrontati
   *  con tre elenchi vuoti passerebbero dicendo niente. */
  it('i controlli da verificare esistono', () => {
    expect(esito.totali.tendine).toBeGreaterThan(10)
    expect(esito.totali.campi).toBeGreaterThan(30)
  })
})
