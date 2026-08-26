/**
 * src/__tests__/ordineReg.test.jsx
 *
 * L'ordine delle voci nella tendina delle reg.
 *
 * ─── PERCHE' UN TEST PER UN ORDINE ─────────────────────────────────────────
 *
 * Perché è già stato sbagliato una volta, e in un modo che non si vedeva
 * leggendo il codice. Quando la tendina elencava le stagioni raggruppate per
 * reg, le stagioni erano invertite dentro ogni gruppo ma i gruppi no: si
 * vedeva M-2, M-1, poi M-5, un ordine che non è né crescente né decrescente.
 * Serviva aprirla per accorgersene.
 *
 * Ora i livelli sono uno solo e il difetto di allora non è più
 * rappresentabile, ma la ragione del test resta: un `reverse()` in meno è una
 * riga che nessuna revisione nota. Qui l'ordine atteso è scritto per esteso,
 * così tornare indietro diventa rosso.
 *
 * ─── PERCHE' DALLA PIU' RECENTE ────────────────────────────────────────────
 *
 * Il registro elenca in ordine cronologico perché è l'ordine in cui le cose
 * sono successe. La tendina serve l'ordine opposto: chi la apre cerca quasi
 * sempre la reg in corso, che è l'ultima ed è anche quella scelta di default.
 * In avanti, la voce più probabile finiva in fondo.
 */

import { describe, it, expect, beforeAll } from 'vitest'

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}
globalThis.window = globalThis.window || {}
globalThis.window.location = { search: '', origin: 'http://test', pathname: '/' }

let renderToString, RegSelect, REG

beforeAll(async () => {
  ;({ renderToString } = await import('react-dom/server'))
  ;({ default: RegSelect } = await import('../components/RegSelect.jsx'))
  ;({ REG } = await import('../lib/reg.js'))
})

/** I valori delle opzioni, nell'ordine in cui sono rese. */
function reso() {
  const html = renderToString(<RegSelect />)
  return {
    valori: [...html.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]),
    gruppi: [...html.matchAll(/<optgroup[^>]*label="([^"]*)"/g)].map(m => m[1]),
  }
}

describe('ordine della tendina delle reg', () => {
  it('le reg vanno dalla più recente alla più vecchia', () => {
    const { valori } = reso()
    const cronologico = REG.map(r => r.id)
    // La prima voce è «tutte»; le altre sono gli id di reg.
    expect(valori.slice(1), 'le reg devono essere invertite rispetto al registro')
      .toEqual([...cronologico].reverse())
  })

  it('la prima reg della tendina è la più recente in assoluto', () => {
    // Il caso concreto che motiva tutto: oggi deve essere M-B, non M-A.
    const { valori } = reso()
    expect(valori[1], 'la voce subito dopo «tutte»').toBe(REG[REG.length - 1].id)
  })

  it('non ci sono più gruppi: le stagioni non si scelgono', () => {
    // La tendina raggruppava le stagioni per reg. Se un `<optgroup>`
    // ricomparisse, vorrebbe dire che il livello delle stagioni è tornato
    // nell'interfaccia — e con lui il filtro che nascondeva set giocabili.
    const { gruppi } = reso()
    expect(gruppi, 'la tendina è tornata a due livelli').toEqual([])
  })

  it('nessuna voce è una stagione', async () => {
    // Il controllo che lega la tendina al modello: gli id di stagione
    // (M-1…M-5) non devono comparire fra i valori selezionabili.
    const { STAGIONI } = await import('../lib/reg.js')
    const { valori } = reso()
    const idStagioni = new Set(STAGIONI.map(s => s.id))
    const intrusi = valori.filter(v => idStagioni.has(v))
    expect(intrusi, 'una stagione è selezionabile nella tendina delle reg').toEqual([])
  })

  it('controllo negativo: l\'ordine reso non è quello del registro', () => {
    // Senza, i casi sopra passerebbero anche se `reverse()` sparisse e il
    // registro fosse già scritto al contrario — cioè proverebbero una
    // coincidenza invece di una scelta.
    const { valori } = reso()
    const cronologico = REG.map(r => r.id)
    expect(valori.slice(1)).not.toEqual(cronologico)
    expect(cronologico.length, 'con una reg sola l\'ordine non prova niente').toBeGreaterThan(1)
  })

  it('ci sono tutte, e nessuna in più', () => {
    const { valori } = reso()
    expect(new Set(valori.slice(1))).toEqual(new Set(REG.map(r => r.id)))
    expect(valori[0], 'la prima voce resta «tutte»').toBe('tutte')
  })
})
