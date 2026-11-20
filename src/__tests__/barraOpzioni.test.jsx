// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/barraOpzioni.test.jsx
 *
 * La barra delle opzioni sta su UNA riga: un solo contenitore flex che non va
 * a capo, con tre gruppi etichettati (Opzioni, Campo, Meteo). In SSR non c'è
 * layout, quindi si asserisce sulla struttura, non sui pixel.
 */
import { describe, it, expect, vi } from 'vitest'

async function html() {
  vi.resetModules()
  const memoria = new Map()
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
  const TopBar = (await import('../components/TopBar.jsx')).default
  return renderToStaticMarkup(React.createElement(TopBar))
}

const classi = (s) => [...s.matchAll(/class="([^"]*)"/g)].map(m => m[1].split(/\s+/))

describe('barra opzioni compatta', () => {
  it('contiene Trick Room, campo e meteo', async () => {
    const h = await html()
    expect(h).toContain('trick room')
    for (const k of ['Grassy', 'Electric', 'Misty', 'Psychic', 'Sun', 'Rain', 'Sand', 'Snow'])
      expect(h).toContain('>' + k + '<')
  })

  it('tre gruppi con etichetta nella striscia desktop', async () => {
    const h = await html()
    const striscia = h.slice(h.indexOf('overflow-x-auto'), h.indexOf('sm:hidden'))
    for (const e of ['Options', 'Field', 'Weather'])
      expect(striscia).toContain('tracking-[0.15em] font-semibold">' + e + '<')
  })

  it('la striscia desktop è un solo contenitore flex senza flex-wrap', async () => {
    const h = await html()
    const striscia = classi(h).filter(c => c.includes('overflow-x-auto'))
    expect(striscia).toHaveLength(1)
    expect(striscia[0]).toContain('flex')
    expect(striscia[0]).toContain('flex-nowrap')
    expect(striscia[0].some(c => /(^|:)flex-wrap$/.test(c))).toBe(false)
  })

  it('sotto 640 px Campo e Meteo sono tendine', async () => {
    const h = await html()
    expect(h.match(/<select/g)).toHaveLength(2)
  })
})
