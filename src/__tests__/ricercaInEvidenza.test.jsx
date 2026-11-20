// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * Task 2 «squadre prima»: su uno slot vuoto la ricerca è la prima azione.
 * Squadre vuote (localStorage vuoto); si legge l'HTML del pannello slot.
 */
import { describe, it, expect, beforeAll } from 'vitest'

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
globalThis.window = globalThis.window || {}
globalThis.window.location = { search: '', origin: 'http://test', pathname: '/' }

let html = ''
let etichetta = ''

beforeAll(async () => {
  const React = (await import('react')).default
  const { renderToStaticMarkup } = await import('react-dom/server')
  const i18n = (await import('../i18n.js')).default
  etichetta = i18n.t('ui.search_pokemon')
  const PokemonPanel = (await import('../components/editor/SlotEditor.jsx')).default
  html = renderToStaticMarkup(React.createElement(PokemonPanel, { team: 'team1', index: 0 }))
})

const tagInput = () => html.match(new RegExp(`<input[^>]*aria-label="${etichetta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`))?.[0]

describe('slot vuoto — ricerca in evidenza', () => {
  it('il campo di ricerca compare prima del primo pulsante dello slot', () => {
    const iInput = html.indexOf(`aria-label="${etichetta}"`)
    const iPulsante = html.indexOf('<button')
    expect(iInput).toBeGreaterThan(-1)
    expect(iPulsante).toBeGreaterThan(-1)
    expect(iInput).toBeLessThan(iPulsante)
  })

  it('il campo è attivo: né disabled né readonly, bordo teal e fondo scuro', () => {
    const tag = tagInput()
    expect(tag).toBeTruthy()
    expect(tag).not.toMatch(/\bdisabled\b/)
    expect(tag).not.toMatch(/\breadonly\b/i)
    expect(tag).toContain('border-teal-500')
    expect(tag).toContain('bg-gray-900')
  })

  it('c\'è una sola ricerca Pokémon nello slot (nessun duplicato)', () => {
    expect(html.split(`aria-label="${etichetta}"`).length - 1).toBe(1)
  })
})
