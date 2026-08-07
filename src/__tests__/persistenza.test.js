/**
 * src/__tests__/persistenza.test.js
 *
 * La scrittura su localStorage aspetta, il caricamento no.
 *
 * ─── COSA VERIFICA DAVVERO ─────────────────────────────────────────────────
 * Non che l'app sia più veloce: il ritardo vale 8,2 µs per scrittura su ~7 ms
 * di lavoro per movimento di slider, cioè niente. Verifica che venti
 * modifiche di fila producano **una** scrittura invece di venti, e — la parte
 * che conta — che l'ultima non si perda mai: né allo scadere del ritardo, né
 * se la pagina se ne va prima.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Lo store legge localStorage al momento dell'import: va stubbato prima.
const memoria = new Map()
let scritture = 0
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => { scritture++; memoria.set(k, String(v)) },
  removeItem: k => memoria.delete(k),
}
globalThis.window = globalThis.window || {}
globalThis.window.location = { search: '', origin: 'http://test', pathname: '/' }

const { default: useCalcStore, salvaSubito, RITARDO_SALVATAGGIO } =
  await import('../store/useCalcStore.js')

const LETTURA = () => JSON.parse(memoria.get('vgc-overwhelm-teams') || '{}')

describe('persistenza — scrittura ritardata', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    scritture = 0
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('una modifica non scrive subito', () => {
    useCalcStore.getState().setPokemon('team1', 0, 'garchomp')
    expect(scritture).toBe(0)
  })

  it('scrive una volta sola dopo il ritardo', () => {
    for (let i = 0; i < 20; i++) {
      useCalcStore.getState().setSPs('team1', 0, [i, 0, 0, 0, 0, 0])
    }
    expect(scritture).toBe(0)
    vi.advanceTimersByTime(RITARDO_SALVATAGGIO)
    expect(scritture).toBe(1)
  })

  it('quello che finisce su disco è l’ultimo valore, non il primo', () => {
    useCalcStore.getState().setSPs('team1', 0, [1, 0, 0, 0, 0, 0])
    useCalcStore.getState().setSPs('team1', 0, [7, 0, 0, 0, 0, 0])
    vi.advanceTimersByTime(RITARDO_SALVATAGGIO)
    expect(LETTURA().team1[0].sps[0]).toBe(7)
  })

  it('il ritardo si azzera a ogni modifica: prima della scadenza niente', () => {
    useCalcStore.getState().setSPs('team1', 0, [2, 0, 0, 0, 0, 0])
    vi.advanceTimersByTime(RITARDO_SALVATAGGIO - 50)
    useCalcStore.getState().setSPs('team1', 0, [3, 0, 0, 0, 0, 0])
    vi.advanceTimersByTime(RITARDO_SALVATAGGIO - 50)
    expect(scritture).toBe(0)
    vi.advanceTimersByTime(50)
    expect(scritture).toBe(1)
  })

  it('se la pagina se ne va prima, la modifica non si perde', () => {
    useCalcStore.getState().setSPs('team1', 0, [9, 0, 0, 0, 0, 0])
    expect(scritture).toBe(0)
    salvaSubito()
    expect(scritture).toBe(1)
    expect(LETTURA().team1[0].sps[0]).toBe(9)
  })

  it('salvaSubito a vuoto non scrive niente', () => {
    salvaSubito()
    const prima = scritture
    salvaSubito()
    expect(scritture).toBe(prima)
  })
})
