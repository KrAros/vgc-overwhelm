// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/accessibilita.test.jsx
 *
 * ─── IL DIFETTO CHE QUESTO FILE ESISTE PER IMPEDIRE ────────────────────────
 *
 * Lo skip link di `App.jsx` puntava a `#main-content`, e **nessun elemento in
 * tutto `src/` aveva quell'id**. Il link non portava da nessuna parte.
 *
 * Non era invisibile: era in cima al file principale dell'applicazione. Ma
 * nessuno lo aveva mai *usato* — ci si arriva solo col Tab da tastiera, cioè
 * per la strada che serve esattamente a chi non usa il mouse. E la diagnosi
 * iniziale (`docs/analisi-critica.md` §4.5) lo aveva letto e classificato come
 * problema cosmetico — «stile inline e testo in inglese» — senza accorgersi
 * che la funzione non funzionava. Un file letto, mai eseguito.
 *
 * ─── PERCHÉ NON UNO SCREENSHOT ─────────────────────────────────────────────
 *
 * In P avevo cominciato a costruire una sonda che pilotava Chrome, premeva Tab
 * e fotografava. Sbagliato come strumento: una fotografia prova com'era quel
 * giorno e non impedisce il ritorno del difetto. Il difetto qui è un contratto
 * — «l'ancora punta a un bersaglio che esiste» — e un contratto si asserisce.
 *
 * Quel che il test NON copre, dichiarato: che il link diventi *visibile* al
 * focus. Quello dipende dalla cascata di `sr-only` / `focus:not-sr-only`, è
 * stato verificato sull'artefatto CSS costruito, e resta materiale da occhio.
 *
 * ─── IL CONTROLLO CHE SI MUOVE ─────────────────────────────────────────────
 *
 * Un test che scorre le ancore e le verifica una per una passa anche quando le
 * ancore sono **zero** — cioè passerebbe se qualcuno cancellasse lo skip link.
 * Sarebbe una sonda cieca, la classe di difetto che la sessione L ha trovato
 * otto volte su quattordici. Perciò la prima asserzione conta le ancore.
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '../App'
import '../i18n'

const html = renderToStaticMarkup(<App />)

const ancore = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
const identificatori = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))

describe('ancore interne', () => {
  it('ce ne sono, altrimenti il test qui sotto non verifica niente', () => {
    expect(ancore.length).toBeGreaterThan(0)
  })

  it.each(ancore)('#%s punta a un elemento che esiste', (bersaglio) => {
    expect(identificatori.has(bersaglio)).toBe(true)
  })
})

/**
 * ─── I CONTROLLI SENZA NOME ────────────────────────────────────────────────
 *
 * Il difetto misurato in P non erano «sette bottoni»: era che l'applicazione
 * ha rami di layout duplicati — `hidden sm:flex` per lo schermo grande,
 * `sm:hidden` per il telefono — e la copia mobile era nata senza nomi.
 *
 *   TopBar   desktop: Campo/Meteo come bottoni, il testo È il nome
 *            mobile:  Campo/Meteo come <select>, nessun nome        (2 nodi)
 *   ControlBar desktop: <IconImport /><span>{t('ui.import')}</span>
 *            mobile:  <IconImport /> e basta                        (7 nodi)
 *
 * Il markup diverso è una scelta legittima: un <select> nativo su telefono
 * apre la rotella di sistema. Ciò che non è legittimo è che una delle due
 * copie dica meno dell'altra.
 *
 * Enumerare i nove nodi qui sarebbe inutile — passerebbe per sempre e non
 * direbbe niente del prossimo ramo `sm:hidden` scritto senza etichette.
 * L'asserzione è quindi sulla PROPRIETÀ: nessun controllo interattivo è senza
 * nome accessibile.
 */
const testo = (frammento) => frammento.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').trim()
const attributo = (attrs, nome) => new RegExp(`\\b${nome}="([^"]*)"`).exec(attrs)?.[1]

const bottoni = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, dentro]) => ({
  attrs,
  // per un <button> il contenuto visibile è già un nome accessibile valido
  nome: testo(dentro) || attributo(attrs, 'aria-label') || attributo(attrs, 'aria-labelledby'),
}))

// per un <select> NO: il testo delle <option> è il valore, non l'etichetta
const etichettati = new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]*)"/g)].map((m) => m[1]))
const tendine = [...html.matchAll(/<select\b([^>]*)>/g)].map(([, attrs]) => ({
  attrs,
  nome: attributo(attrs, 'aria-label') || attributo(attrs, 'aria-labelledby') || (etichettati.has(attributo(attrs, 'id')) ? 'label' : undefined),
}))

describe('controlli senza nome accessibile', () => {
  it('ci sono bottoni e tendine da controllare, altrimenti non si verifica niente', () => {
    expect(bottoni.length).toBeGreaterThan(10)
    expect(tendine.length).toBeGreaterThan(0)
  })

  it('ogni <button> ha un nome', () => {
    expect(bottoni.filter((b) => !b.nome).map((b) => b.attrs.slice(0, 120))).toEqual([])
  })

  it('ogni <select> ha un nome', () => {
    expect(tendine.filter((s) => !s.nome).map((s) => s.attrs.slice(0, 120))).toEqual([])
  })
})

describe('skip link', () => {
  it('esiste e punta al contenuto principale', () => {
    expect(ancore).toContain('main-content')
  })

  it('il testo passa da i18next, non è hardcoded', () => {
    // Se la chiave mancasse, i18next restituirebbe la chiave stessa.
    expect(html).not.toContain('ui.skip_to_content')
    expect(html).toContain('Skip to main content')
  })
})
