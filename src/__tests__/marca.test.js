// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/marca.test.js
 *
 * I meta tag che leggono Discord, X e Google.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * Prima della sessione DD `index.html` dichiarava `lang="it"` mentre l'app
 * parte in inglese (`lng: 'en'`). I crawler e gli screen reader leggono
 * l'HTML statico, non l'app: il sito si presentava come italiano e si apriva
 * in inglese, e nessun test poteva accorgersene perché nessuno guardava
 * `index.html`.
 *
 * E mancava `og:image`: chi condivideva il link mostrava un rettangolo vuoto.
 *
 * ─── LA PROPRIETÀ CHE VALE DI PIÙ ──────────────────────────────────────────
 *
 * Che `lang` e la lingua predefinita dell'app **dicano la stessa cosa**. È
 * l'unico modo per impedire che tornino a divergere: sono in due file diversi,
 * e cambiarne uno non fa nessun rumore.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const HTML = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8')
const I18N = fs.readFileSync(path.join(RADICE, 'src/i18n.js'), 'utf8')

const meta = (chiave) => {
  const m = HTML.match(new RegExp(`<meta[^>]*(?:property|name)="${chiave}"[^>]*content="([^"]*)"`))
  return m ? m[1] : null
}

describe('i meta tag della condivisione', () => {
  it('`lang` dice la stessa lingua con cui l’app parte', () => {
    const lang = (HTML.match(/<html lang="([^"]*)"/) ?? [])[1]
    const lng = (I18N.match(/\blng:\s*'([a-z-]+)'/) ?? [])[1]
    expect(lng, 'lingua predefinita in i18n.js').toBeTruthy()
    expect(lang, '`lang` di index.html').toBe(lng)
  })

  it('c’è tutto quello che serve per un’anteprima', () => {
    const mancanti = ['og:type', 'og:url', 'og:title', 'og:description',
      'og:image', 'og:image:width', 'og:image:height', 'twitter:card']
      .filter(k => !meta(k))
    expect(mancanti).toEqual([])
  })

  it('`og:image` è un URL assoluto', () => {
    // Un percorso relativo lo scarta quasi ogni client: l'anteprima esce vuota
    // e non c'è nessun errore da nessuna parte.
    expect(meta('og:image')).toMatch(/^https:\/\//)
    expect(meta('twitter:image')).toMatch(/^https:\/\//)
  })

  it('og:url, canonical e og:image stanno sullo stesso dominio', () => {
    // Il giorno del passaggio a sixthember.gg vanno cambiati insieme: se se ne
    // dimentica uno, questo test diventa rosso invece di lasciare
    // un'anteprima che punta al dominio vecchio.
    const dom = (u) => new URL(u).origin
    const canon = (HTML.match(/rel="canonical" href="([^"]*)"/) ?? [])[1]
    expect(canon).toBeTruthy()
    expect(new Set([dom(canon), dom(meta('og:url')), dom(meta('og:image'))]).size).toBe(1)
  })

  it('i file che i meta promettono esistono davvero', () => {
    for (const f of ['og-image.png', 'apple-touch-icon.png', 'favicon.svg'])
      expect(fs.existsSync(path.join(RADICE, 'public', f)), f).toBe(true)
  })

  it('l’immagine misura 1200×630', () => {
    // Letto dall'intestazione PNG: larghezza e altezza stanno nei byte 16-23.
    const b = fs.readFileSync(path.join(RADICE, 'public/og-image.png'))
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1200, 630])
    // I meta devono dire la stessa misura del file, o i client riservano lo
    // spazio sbagliato e l'anteprima salta.
    expect([meta('og:image:width'), meta('og:image:height')]).toEqual(['1200', '630'])
  })

  it('il controllo: il test legge davvero i file', () => {
    // La sonda cieca della sessione L: con un `index.html` vuoto tutte le
    // ricerche tornerebbero `null` e i casi sopra fallirebbero — ma questo
    // rende esplicito che stiamo guardando qualcosa.
    expect(HTML.length).toBeGreaterThan(500)
    expect(I18N.length).toBeGreaterThan(500)
  })
})
