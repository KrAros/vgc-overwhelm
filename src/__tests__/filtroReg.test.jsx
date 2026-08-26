/**
 * src/__tests__/filtroReg.test.jsx
 *
 * Che la reg scelta filtri DAVVERO la tendina dei set.
 *
 * ─── PERCHE' NON BASTA IL TEST SUL NEGOZIO ─────────────────────────────────
 *
 * `regSelezionata.test.js` prova che il valore parte giusto e che non finisce
 * nel link. Nessuno dei due tocca `PresetSelect`, che è dove il filtro vive:
 * si poteva scrivere la reg nel negozio, leggerla nel componente e poi non
 * usarla, e tutti quei test sarebbero rimasti verdi. Qui il componente si
 * renderizza davvero e si contano le opzioni.
 *
 * ─── PERCHE' OGNI CASO RIPARTE DA ZERO ─────────────────────────────────────
 *
 * Perché `renderToString` non vede i cambi di stato del negozio, e capirlo è
 * costato un giro: React chiama `useSyncExternalStore` con il suo terzo
 * argomento — `getServerSnapshot` — e zustand ci mette `getInitialState()`,
 * cioè lo stato al momento della CREAZIONE del negozio. Un `setStagione()`
 * fatto dopo l'import non arriva al render lato server: si vedrebbe sempre la
 * stagione iniziale, e il test passerebbe o fallirebbe per la ragione
 * sbagliata.
 *
 * Nel browser non succede — lì vale `getState()`, e il filtro si è visto
 * funzionare aprendo l'app. È un limite del modo in cui qui si renderizza.
 *
 * La via che regge è seminare `localStorage` PRIMA di importare il negozio, e
 * ricaricare i moduli a ogni caso. È lo stesso vincolo che `prestazioni.test.jsx`
 * documenta per le squadre.
 */

import { describe, it, expect, vi } from 'vitest'

const slot = (key) => ({
  key,
  moves: ['protect', null, null, null],
  sps: [0, 0, 0, 0, 0, 0],
  nature: 'adamant',
  ability: null,
  item: null,
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {},
  lastRespectsKOs: 0,
})

// Incineroar ha un set meta di M-B: è la specie su cui si vede il filtro.
const SLOT = slot('incineroar')
const TEAM = [SLOT, ...Array(5).fill(null).map(() => slot(null))]
const VUOTA = Array(6).fill(null).map(() => slot(null))

const memoria = new Map()
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: k => memoria.delete(k),
}
globalThis.window = globalThis.window || {}
globalThis.window.location = { search: '', origin: 'http://test', pathname: '/' }

/**
 * Renderizza la tendina con una reg già scelta, e restituisce le etichette
 * delle `<option>`.
 *
 * `currentSlug` e `currentSlot` sono props: il componente li riceve da
 * `SlotEditor`, quindi passarli è la chiamata vera, non una scorciatoia.
 */
async function opzioniCon(reg) {
  memoria.clear()
  memoria.set('vgc-overwhelm-teams', JSON.stringify({ team1: TEAM, team2: VUOTA }))
  memoria.set('sixth_ember_reg', reg)
  vi.resetModules()

  const { renderToString } = await import('react-dom/server')
  const { default: PresetSelect } = await import('../components/editor/PresetSelect.jsx')
  const html = renderToString(
    <PresetSelect team="team1" index={0} currentSlug={SLOT.key} currentSlot={SLOT} externalRev={0} />,
  )
  return [...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map(m => m[1].trim())
}

describe('la reg filtra la tendina dei set', () => {
  it('con la reg dei set, il set di Incineroar c\'è', async () => {
    const o = await opzioniCon('M-B')
    expect(o.some(x => /Sitrus/i.test(x)), `nessun set M-B: ${o.join(' / ')}`).toBe(true)
  })

  it('con una reg senza set, la tendina resta senza set meta', async () => {
    // IL CASO CHE PROVA IL FILTRO. Se `PresetSelect` ignorasse la reg, qui
    // vedremmo lo stesso elenco del test sopra.
    //
    // M-A oggi non ha set, ed è la ragione per cui funziona come caso di
    // prova. Se un giorno ne avesse, questo test comincerebbe a passare per
    // la ragione sbagliata — perciò il controllo negativo in fondo verifica
    // che i due render diano davvero risultati diversi.
    const o = await opzioniCon('M-A')
    expect(o.some(x => /Sitrus/i.test(x)), `set di M-B mostrati sotto M-A: ${o.join(' / ')}`).toBe(false)
    // …ma la tendina esiste ancora: «vuota di set meta» non è «non resa».
    expect(o.length, 'il componente non ha reso nulla').toBeGreaterThan(0)
  })

  it('con «tutte» i set tornano, e portano scritta la reg', async () => {
    const o = await opzioniCon('tutte')
    const conReg = o.filter(x => /·\s*M-[AB]/.test(x))
    expect(conReg.length, `nessuna opzione etichettata: ${o.join(' / ')}`).toBeGreaterThan(0)
    expect(conReg.some(x => /M-B/.test(x))).toBe(true)
  })

  it('filtrando su M-B non si perde nessun set di M-B', async () => {
    // Il difetto che ha fatto cambiare chiave, in forma di test: filtrando per
    // stagione, con M-5 selezionata si vedevano 2 set su 22. Qui si conta che
    // il filtro sulla reg di oggi mostri gli stessi set di «tutte».
    const conM_B = (await opzioniCon('M-B')).filter(x => /Sitrus/i.test(x))
    const conTutte = (await opzioniCon('tutte')).filter(x => /Sitrus/i.test(x))
    expect(conM_B.length, 'il filtro sulla reg corrente nasconde set di quella reg')
      .toBe(conTutte.length)
  })

  it('controllo negativo: la semina arriva davvero al componente', async () => {
    // Senza, il secondo caso passerebbe anche se `opzioniCon` non riuscisse a
    // impostare niente e il componente partisse sempre dallo stesso stato.
    const conSet = await opzioniCon('M-B')
    const senzaSet = await opzioniCon('M-A')
    expect(conSet, 'i due render danno lo stesso risultato: la semina non morde')
      .not.toEqual(senzaSet)
  })
})
