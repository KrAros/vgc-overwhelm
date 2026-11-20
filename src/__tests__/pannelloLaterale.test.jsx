// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * Pannello laterale del report: logica pura (ruolo per larghezza, Esc, trap
 * del Tab), ruoli/aria in SSR, assenza di scrollIntoView verso il report in
 * App.jsx e parità delle traduzioni. L'interazione vera (focus, Esc, body
 * bloccato) si verifica con Playwright, fuori dal repo.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { SOGLIA_DESKTOP, ruoloPannello, eTastoChiusura, prossimoIndiceFocus } from '../lib/pannello.js'
import { GuscioPannello } from '../components/PannelloLaterale.jsx'

describe('ruoloPannello', () => {
  it('sotto 1024 px è un dialog modale, da 1024 in su un complementary', () => {
    expect(SOGLIA_DESKTOP).toBe(1024)
    expect(ruoloPannello(375)).toEqual({ role: 'dialog', modale: true })
    expect(ruoloPannello(1023)).toEqual({ role: 'dialog', modale: true })
    expect(ruoloPannello(1024)).toEqual({ role: 'complementary', modale: false })
    expect(ruoloPannello(1280)).toEqual({ role: 'complementary', modale: false })
  })
})

describe('eTastoChiusura', () => {
  it('Esc chiude, altri tasti no, e un Esc già gestito (defaultPrevented) no', () => {
    expect(eTastoChiusura({ key: 'Escape', defaultPrevented: false })).toBe(true)
    expect(eTastoChiusura({ key: 'Enter', defaultPrevented: false })).toBe(false)
    expect(eTastoChiusura({ key: 'Escape', defaultPrevented: true })).toBe(false)
  })
})

describe('prossimoIndiceFocus (trap del Tab)', () => {
  it('cicla in avanti e indietro, con 0 elementi non si muove', () => {
    expect(prossimoIndiceFocus(0, 3, false)).toBe(1)
    expect(prossimoIndiceFocus(2, 3, false)).toBe(0)
    expect(prossimoIndiceFocus(0, 3, true)).toBe(2)
    expect(prossimoIndiceFocus(1, 3, true)).toBe(0)
    expect(prossimoIndiceFocus(-1, 3, false)).toBe(0)
    expect(prossimoIndiceFocus(-1, 3, true)).toBe(2)
    expect(prossimoIndiceFocus(0, 0, false)).toBe(-1)
  })
})

describe('GuscioPannello in SSR', () => {
  const render = (modale) => renderToStaticMarkup(
    <GuscioPannello modale={modale} etichetta="Analisi danni" chiudiAria="Chiudi pannello"
      chiudiTesto="Chiudi" onClose={() => {}}><p>contenuto</p></GuscioPannello>)

  it('desktop: complementary con aria-label, senza aria-modal', () => {
    const html = render(false)
    expect(html).toContain('role="complementary"')
    expect(html).toContain('aria-label="Analisi danni"')
    expect(html).not.toContain('aria-modal')
    expect(html).toContain('aria-label="Chiudi pannello"')
    expect(html).toContain('>Chiudi<')
    expect(html).toContain('contenuto')
  })
  it('mobile: dialog modale con aria-label', () => {
    const html = render(true)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-label="Analisi danni"')
    expect(html).not.toContain('role="complementary"')
  })
})

describe('App.jsx e traduzioni', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  it('non fa più scorrere la pagina verso report o tabella', () => {
    expect(app).not.toContain('scrollIntoView')
    expect(app).toContain('PannelloLaterale')
  })
  it('la chiave del titolo esiste in it e en', () => {
    for (const l of ['it', 'en']) {
      const j = JSON.parse(readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'))
      expect(j.report.pannello_titolo, l).toBeTruthy()
    }
  })
})
