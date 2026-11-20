/**
 * Task 9 home: la legenda sta sotto la tabella a tutte le larghezze.
 * Niente colonna laterale (aside), niente contenitore `xl:flex` che la
 * affianca; i tre suggerimenti «Come si usa» stanno in una sola riga.
 */
import { describe, it, expect, beforeAll } from 'vitest'

let React, renderToStaticMarkup, DamageTable, i18n
beforeAll(async () => {
  React = (await import('react')).default
  renderToStaticMarkup = (await import('react-dom/server')).renderToStaticMarkup
  i18n = (await import('../i18n.js')).default
  DamageTable = (await import('../components/DamageTable.jsx')).default
})

const conta = (s, sub) => s.split(sub).length - 1

describe('DamageTable — legenda sotto la tabella', () => {
  const html = () => renderToStaticMarkup(React.createElement(DamageTable, {}))

  it('non c\'è più la colonna laterale né il contenitore xl:flex', () => {
    const h = html()
    expect(h).not.toContain('<aside')
    expect(h).not.toContain('xl:flex')
    expect(h).not.toContain('xl:hidden')
  })

  it('la legenda compare una sola volta, visibile a tutte le larghezze', () => {
    const h = html()
    expect(conta(h, `>${i18n.t('report.legend')}<`)).toBe(1)
    expect(conta(h, '100%+ KO')).toBe(1)
  })

  it('i tre suggerimenti «Come si usa» stanno tutti nell\'HTML, una volta', () => {
    const h = html()
    for (const k of ['how_to_1', 'how_to_2', 'how_to_3']) {
      const testo = i18n.t(`report.${k}`).replace(/→/g, '→')
      expect(conta(h, testo)).toBe(1)
    }
  })
})
