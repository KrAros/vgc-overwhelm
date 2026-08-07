/**
 * src/__tests__/prestazioni.test.jsx
 *
 * Quante volte la matrice chiama il motore per disegnarsi.
 *
 * ─── PERCHÉ UN TEST E NON UNA MISURA UNA TANTUM ────────────────────────────
 * Il numero da cui parte la sessione E — 576 chiamate per render — non era
 * scritto da nessuna parte nel codice: era una proprietà emergente del fatto
 * che `getBestMove` richiamasse `calcAllMoves` invece di ricevere l'array già
 * calcolato. Una proprietà emergente si riperde nello stesso modo in cui è
 * comparsa, e senza un test nessuno se ne accorgerebbe: l'app continuerebbe a
 * mostrare i numeri giusti, solo al doppio del prezzo.
 *
 * Qui il conto è un'asserzione.
 *
 * ─── COME SI CONTA ─────────────────────────────────────────────────────────
 * Si renderizza `DamageTable` davvero, con `react-dom/server`, mettendo un
 * contatore attorno a `calculateDamage`. Non si moltiplica 36 × 8 a mente:
 * quello è esattamente il tipo di numero dedotto che le regole di ingaggio
 * vietano.
 *
 * ─── LA PARTE NOIOSA: COME ARRIVANO I TEAM ─────────────────────────────────
 * In SSR zustand v5 usa `getInitialState` come server snapshot, quindi un
 * `setState` fatto dopo l'import NON arriva al componente: si vedrebbero
 * trentasei celle vuote e zero chiamate, e il test passerebbe dicendo niente.
 * I team vanno quindi seminati PRIMA dell'import dello store, e l'unica via
 * d'ingresso che lo store legge all'avvio è localStorage.
 *
 * Il controllo `celle piene` qui sotto esiste apposta: se la semina smettesse
 * di funzionare, il conto crollerebbe a zero e il test fallirebbe invece di
 * diventare una sonda cieca.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'

// ─── Semina, prima di qualunque import applicativo ───────────────────────────

const slot = (key, moves) => ({
  key,
  moves,
  sps: [4, 4, 4, 4, 4, 4],
  nature: 'adamant',
  ability: null,
  item: null,
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {},
  lastRespectsKOs: 0,
})

const MOSSE_T1 = ['earthquake', 'rock slide', 'dragon claw', 'flamethrower']
const MOSSE_T2 = ['shadow ball', 'dark pulse', 'icy wind', 'thunderbolt']

const TEAM_1 = ['garchomp', 'incineroar', 'rillaboom', 'amoonguss', 'dragonite', 'flutter-mane']
  .map(k => slot(k, MOSSE_T1))
const TEAM_2 = ['gholdengo', 'chi-yu', 'kingambit', 'iron-hands', 'ogerpon', 'urshifu']
  .map(k => slot(k, MOSSE_T2))

const CELLE = TEAM_1.length * TEAM_2.length          // 36
const MOSSE_PER_CELLA = MOSSE_T1.length + MOSSE_T2.length  // 8, due direzioni
const ATTESE = CELLE * MOSSE_PER_CELLA               // 288

const memoria = new Map([
  ['vgc-overwhelm-teams', JSON.stringify({ team1: TEAM_1, team2: TEAM_2 })],
])
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: k => memoria.delete(k),
}
globalThis.window = globalThis.window || {}
globalThis.window.location = { search: '', origin: 'http://test', pathname: '/' }

// ─── Contatore attorno al motore ─────────────────────────────────────────────

let chiamate = 0
vi.mock('../calcEngine', async (importOriginal) => {
  const vero = await importOriginal()
  return {
    ...vero,
    calculateDamage: (...args) => {
      chiamate++
      return vero.calculateDamage(...args)
    },
  }
})

let React, renderToString, DamageTable

beforeAll(async () => {
  React = (await import('react')).default
  renderToString = (await import('react-dom/server')).renderToString
  await import('../i18n.js')
  DamageTable = (await import('../components/DamageTable.jsx')).default
})

describe('matrice — costo per render', () => {
  it('una griglia 6×6 piena costa due passate per cella, non quattro', () => {
    chiamate = 0
    const html = renderToString(React.createElement(DamageTable, {}))

    // Controllo che la semina abbia funzionato: senza questo, zero celle
    // renderizzate darebbero zero chiamate e il test passerebbe a vuoto.
    const cellePiene = (html.match(/–/g) || []).length
    expect(cellePiene).toBeGreaterThan(0)

    expect(chiamate).toBe(ATTESE)
  })
})
