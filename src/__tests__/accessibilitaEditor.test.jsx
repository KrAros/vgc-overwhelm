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
 * ─── CARATTERIZZAZIONE, NON ANCORA UN CRITERIO ─────────────────────────────
 *
 * Questi numeri NON sono lo stato desiderato: sono lo stato di oggi, scattato
 * il giorno in cui il buco è stato scoperto. Cinquanta controlli dell'editor
 * non hanno nome accessibile.
 *
 * Sono scritti come asserzioni esatte apposta. Così:
 *   - un peggioramento diventa rosso, che è quello che serve subito
 *   - un MIGLIORAMENTO diventa rosso anche lui, e chi paga il debito deve
 *     abbassare il numero a mano — cioè il progresso si vede invece di
 *     scivolare dentro un test già verde
 *
 * Il debito va pagato in una sessione dedicata, dove dare un nome a cinquanta
 * controlli è l'unico criterio: servono chiavi di traduzione nuove, e
 * `traduzioni.test.js` vieta stringhe identiche fra le due lingue salvo
 * quindici elencate. Mescolarlo al lavoro sul layout sarebbe applicare due
 * criteri di segno diverso nella stessa sessione.
 *
 * I bottoni sono già a zero: li ha chiusi la sessione P.
 */
describe('editor pieno — controlli senza nome accessibile', () => {
  it('nessun <button> senza nome — chiuso in P, e deve restare così', () => {
    expect(esito.bottoni).toEqual([])
  })

  it('<select> senza nome: 14 su 18 — debito noto, da abbassare', () => {
    expect({ senzaNome: esito.tendine.length, totali: esito.totali.tendine })
      .toEqual({ senzaNome: 14, totali: 18 })
  })

  it('<input> senza nome: 36 su 36 — debito noto, da abbassare', () => {
    expect({ senzaNome: esito.campi.length, totali: esito.totali.campi })
      .toEqual({ senzaNome: 36, totali: 36 })
  })
})
