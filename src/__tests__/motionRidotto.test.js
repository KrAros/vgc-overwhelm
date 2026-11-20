// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const leggi = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const css = leggi('index.css')

// Estrae il corpo del blocco che inizia a `apertura` (conta le graffe).
function blocco(src, apertura) {
  const i = src.indexOf(apertura)
  if (i < 0) return null
  const j = src.indexOf('{', i)
  let d = 0
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++
    else if (src[k] === '}' && --d === 0) return src.slice(j + 1, k)
  }
  return null
}

describe('motion ridotto e transizioni globali', () => {
  it('esiste il blocco prefers-reduced-motion', () => {
    expect(blocco(css, '@media (prefers-reduced-motion: reduce)')).not.toBeNull()
  })

  it('il blocco azzera durata di animazioni/transizioni e scroll-behavior', () => {
    const b = blocco(css, '@media (prefers-reduced-motion: reduce)') ?? ''
    expect(b).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(b).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(b).toMatch(/scroll-behavior:\s*auto\s*!important/)
  })

  it('la transition-property globale non include filter', () => {
    const props = [...css.matchAll(/transition-property:\s*([^;]+);/g)].map((m) => m[1])
    expect(props.length).toBeGreaterThan(0)
    for (const p of props) expect(p).not.toMatch(/\bfilter\b/)
  })
})

describe('un solo accento: niente ambra/viola sui controlli non semantici', () => {
  it('Team Library in ControlBar non usa ambra', () => {
    const src = leggi('components/ControlBar.jsx')
    const righe = src.split('\n').filter((r) => /btnLib\s*=|team_library/.test(r) || /IconLibrary/.test(r))
    expect(righe.length).toBeGreaterThan(0)
    for (const r of righe) expect(r).not.toMatch(/amber|violet|purple/)
    // il pulsante compatto (riga successiva a team_library) non usa ambra
    const m = src.match(/aria-label=\{t\('ui\.team_library'\)\}[^>]*\n[^>]*className="([^"]*)"/)
    expect(m?.[1] ?? '').not.toMatch(/amber|violet|purple/)
  })

  it('il rosso in ControlBar resta su reset/KO/errori (nessun rosso su Team Library)', () => {
    const src = leggi('components/ControlBar.jsx')
    expect(src).toMatch(/btnReset\s*=.*red-/)
    expect(src).not.toMatch(/btnLib\s*=.*red-/)
  })
})

describe('footer: testo legale leggibile, niente ambra', () => {
  const f = leggi('components/Footer.jsx')
  it('nessun gray-500/600 né ambra nei testi del footer', () => {
    expect(f).not.toMatch(/text-gray-(500|600)/)
    expect(f).not.toMatch(/amber|violet|purple/)
  })
  it('il disclaimer usa gray-400 o più chiaro su gray-800 (>= 4,5:1)', () => {
    expect(f).toMatch(/text-\[9px\] text-gray-400/)
    // gray-400 #9ca3af su gray-800 #1f2937
    const lum = (h) => {
      const c = [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const r = (lum('#9ca3af') + 0.05) / (lum('#1f2937') + 0.05)
    expect(r).toBeGreaterThanOrEqual(4.5)
  })
})

describe('gerarchia: titolo e logo pesano più dei chip', () => {
  it('Header: il titolo è più grande e più pesante del chip «Damage Calc»', () => {
    const h = leggi('components/Header.jsx')
    expect(h).toMatch(/text-base[^"]*font-semibold|font-semibold[^"]*text-base/)
    expect(h).toMatch(/<FiammaLogo size=\{24\}/)
  })
})
