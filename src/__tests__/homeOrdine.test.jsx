// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/homeOrdine.test.jsx
 *
 * La home mostra prima le squadre; la matrice dei danni compare dopo, e solo
 * quando ciascuna squadra ha almeno un Pokémon (altrimenti una guida).
 *
 * Il modulo App legge `localStorage` all'import dello store, quindi ogni
 * scenario resetta i moduli e rimonta App con la sua memoria.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const slot = (key) => ({
  key, moves: ['protect', null, null, null], sps: [4, 4, 4, 4, 4, 4],
  nature: 'adamant', ability: null, item: null,
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {}, lastRespectsKOs: 0,
})

async function render(squadre) {
  vi.resetModules()
  const memoria = new Map()
  if (squadre) memoria.set('vgc-overwhelm-teams', JSON.stringify(squadre))
  globalThis.localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  }
  globalThis.window = globalThis.window || {}
  globalThis.window.location = { search: '', origin: 'http://test', pathname: '/' }
  const React = (await import('react')).default
  const { renderToStaticMarkup } = await import('react-dom/server')
  await import('../i18n.js')
  const App = (await import('../App.jsx')).default
  return renderToStaticMarkup(React.createElement(App))
}

describe('ordine e soglia della home', () => {
  beforeEach(() => { vi.resetModules() })

  it('squadre vuote: due squadre e la guida per entrambe, nessuna matrice', async () => {
    const html = await render(null)
    expect(html).toContain('id="main-content"')
    expect(html).toContain('aria-label="Team 1"')
    expect(html).toContain('aria-label="Team 2"')
    expect(html).toContain('role="status"')
    expect(html).toContain('Add at least one Pokémon to each team')
    expect(html).not.toContain('id="damage-table"')
  })

  it('localStorage corrotto: guida e nessun crash', async () => {
    vi.resetModules()
    globalThis.localStorage = {
      getItem: () => '{non json', setItem: () => {}, removeItem: () => {},
    }
    globalThis.window = globalThis.window || {}
    globalThis.window.location = { search: '', origin: 'http://test', pathname: '/' }
    const React = (await import('react')).default
    const { renderToStaticMarkup } = await import('react-dom/server')
    await import('../i18n.js')
    const App = (await import('../App.jsx')).default
    const html = renderToStaticMarkup(React.createElement(App))
    expect(html).toContain('role="status"')
    expect(html).not.toContain('id="damage-table"')
  })

  it('solo la squadra 1 piena: la guida nomina la 2, nessuna matrice', async () => {
    const html = await render({ team1: [slot('garchomp')], team2: [] })
    expect(html).toContain('Add at least one Pokémon to Team 2')
    expect(html).not.toContain('Add at least one Pokémon to Team 1')
    expect(html).not.toContain('id="damage-table"')
  })

  it('solo la squadra 2 piena: la guida nomina la 1', async () => {
    const html = await render({ team1: [], team2: [slot('gholdengo')] })
    expect(html).toContain('Add at least one Pokémon to Team 1')
    expect(html).not.toContain('id="damage-table"')
  })

  it('entrambe piene: la matrice c’è ed è DOPO il secondo editor, senza guida', async () => {
    const html = await render({ team1: [slot('garchomp')], team2: [slot('gholdengo')] })
    const matrice = html.indexOf('id="damage-table"')
    const secondoEditor = html.indexOf('aria-label="Team 2"')
    expect(matrice).toBeGreaterThan(-1)
    expect(secondoEditor).toBeGreaterThan(-1)
    expect(matrice).toBeGreaterThan(secondoEditor)
    expect(html).not.toContain('Add at least one Pokémon')
  })

  it('entrambe piene: la barra opzioni sta DOPO il secondo editor e PRIMA della matrice', async () => {
    const html = await render({ team1: [slot('garchomp')], team2: [slot('gholdengo')] })
    const barra = html.indexOf('aria-label="Battle conditions"')
    const secondoEditor = html.indexOf('aria-label="Team 2"')
    const matrice = html.indexOf('id="damage-table"')
    expect(barra).toBeGreaterThan(-1)
    expect(barra).toBeGreaterThan(secondoEditor)
    expect(barra).toBeLessThan(matrice)
  })

  it('squadre vuote: la barra opzioni non compare', async () => {
    const html = await render(null)
    expect(html).not.toContain('aria-label="Battle conditions"')
  })
})
