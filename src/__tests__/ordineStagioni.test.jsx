/**
 * src/__tests__/ordineStagioni.test.jsx
 *
 * L'ordine delle voci nella tendina delle stagioni.
 *
 * ─── PERCHE' UN TEST PER UN ORDINE ─────────────────────────────────────────
 *
 * Perché è già stato sbagliato una volta, e in un modo che non si vedeva
 * leggendo il codice. Le stagioni erano invertite dentro ogni gruppo ma i
 * gruppi no, quindi la tendina mostrava M-2, M-1, poi M-5: un ordine che non
 * è né crescente né decrescente. Serviva aprirla per accorgersene.
 *
 * Un `reverse()` in meno è una riga che nessuna revisione nota. Qui l'ordine
 * atteso è scritto per esteso, così tornare indietro diventa rosso.
 *
 * ─── PERCHE' DAL PIU' RECENTE ──────────────────────────────────────────────
 *
 * Il registro elenca in ordine cronologico perché è l'ordine in cui le cose
 * sono successe. La tendina serve l'ordine opposto: chi la apre cerca quasi
 * sempre la stagione in corso, che è l'ultima ed è anche quella scelta di
 * default. In avanti, la voce più probabile finiva in fondo.
 */

import { describe, it, expect, beforeAll } from 'vitest'

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}
globalThis.window = globalThis.window || {}
globalThis.window.location = { search: '', origin: 'http://test', pathname: '/' }

let renderToString, StagioneSelect, REG, STAGIONI

beforeAll(async () => {
  ;({ renderToString } = await import('react-dom/server'))
  ;({ default: StagioneSelect } = await import('../components/StagioneSelect.jsx'))
  ;({ REG, STAGIONI } = await import('../lib/reg.js'))
})

/** Le etichette dei gruppi e delle opzioni, nell'ordine in cui sono rese. */
function reso() {
  const html = renderToString(<StagioneSelect />)
  return {
    gruppi: [...html.matchAll(/<optgroup[^>]*label="([^"]*)"/g)].map(m => m[1]),
    valori: [...html.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]),
  }
}

describe('ordine della tendina delle stagioni', () => {
  it('le reg vanno dalla più recente alla più vecchia', () => {
    const { gruppi } = reso()
    const cronologico = REG.map(r => r.id)
    expect(gruppi, 'i gruppi devono essere invertiti rispetto al registro')
      .toEqual([...cronologico].reverse())
  })

  it('dentro ogni reg le stagioni vanno dalla più recente', () => {
    const { valori } = reso()
    // La prima voce è «tutte»; le altre sono gli id di stagione.
    const stagioni = valori.slice(1)
    const attese = [...REG].reverse().flatMap(r => [...r.stagioni].reverse().map(s => s.id))
    expect(stagioni).toEqual(attese)
  })

  it('la prima stagione della tendina è la più recente in assoluto', () => {
    // Il caso concreto che motiva tutto: oggi deve essere M-5, non M-2.
    const { valori } = reso()
    const piuRecente = STAGIONI[STAGIONI.length - 1].id
    expect(valori[1], 'la voce subito dopo «tutte»').toBe(piuRecente)
  })

  it('controllo negativo: l\'ordine reso non è quello del registro', () => {
    // Senza, i casi sopra passerebbero anche se `reverse()` sparisse e il
    // registro fosse già scritto al contrario — cioè proverebbero una
    // coincidenza invece di una scelta.
    const { valori } = reso()
    const cronologico = STAGIONI.map(s => s.id)
    expect(valori.slice(1)).not.toEqual(cronologico)
    expect(cronologico.length).toBeGreaterThan(1)
  })

  it('ci sono tutte, e nessuna in più', () => {
    const { valori } = reso()
    expect(new Set(valori.slice(1))).toEqual(new Set(STAGIONI.map(s => s.id)))
    expect(valori[0], 'la prima voce resta «tutte»').toBe('tutte')
  })
})
