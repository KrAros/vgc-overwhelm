/**
 * src/__tests__/stagioneSelezionata.test.js
 *
 * La stagione scelta: da dove parte, dove NON deve finire, e cosa filtra.
 *
 * ─── IL TEST CHE CONTA DI PIU' E' QUELLO SUL LINK ──────────────────────────
 *
 * La stagione è una preferenza di chi scrive la squadra, non una condizione
 * della battaglia. Se finisse nel link condiviso, aprire lo stesso link con
 * un'altra stagione selezionata cambierebbe cosa si vede — e il giorno in cui
 * qualcuno la usasse anche per filtrare le specie, cambierebbe la squadra.
 *
 * La separazione dei negozi lo rende impossibile per costruzione, ma
 * «impossibile per costruzione» è un'affermazione, e qui si verifica.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { STAGIONI, stagioneConSetPiuRecente } from '../lib/reg.js'
import { META_PRESETS } from '../data/metaPresets.js'
import { encodeTeamsToURL, decodeTeamsFromURL } from '../store/useCalcStore.js'

describe('da quale stagione si parte', () => {
  it('se la corrente ha set, si parte da quella', () => {
    const conSet = new Set(['M-4', 'M-5'])
    expect(stagioneConSetPiuRecente(conSet, new Date('2026-08-25T12:00:00'))).toBe('M-5')
  })

  it('se la corrente non ha set, si scende all\'indietro', () => {
    // È il caso di OGGI: la stagione in corso è M-5, i venti set sono di M-4.
    // Partire dalla corrente darebbe una tendina vuota a chi apre l'app.
    const conSet = new Set(['M-4'])
    expect(stagioneConSetPiuRecente(conSet, new Date('2026-08-25T12:00:00'))).toBe('M-4')
  })

  it('si scende di più di un passo, se serve', () => {
    expect(stagioneConSetPiuRecente(new Set(['M-1']), new Date('2026-08-25T12:00:00'))).toBe('M-1')
    expect(stagioneConSetPiuRecente(new Set(['M-2', 'M-3']), new Date('2026-08-25T12:00:00'))).toBe('M-3')
  })

  it('non si sale MAI verso una stagione futura', () => {
    // Un set di una stagione che non è ancora cominciata non esiste; uno di
    // una passata è solo più vecchio. Il ripiego ha una direzione sola.
    expect(stagioneConSetPiuRecente(new Set(['M-5']), new Date('2026-06-20T12:00:00')))
      .toBeNull()
    expect(stagioneConSetPiuRecente(new Set(['M-3', 'M-5']), new Date('2026-06-20T12:00:00')))
      .toBe('M-3')
  })

  it('senza nessun set risponde null, e il negozio ripiega su «tutte»', () => {
    expect(stagioneConSetPiuRecente(new Set())).toBeNull()
  })

  it('con i set veri di oggi la partenza è M-4', () => {
    // Il caso reale, non un'ipotesi: legge i preset committati.
    const conSet = new Set(META_PRESETS.map(p => p.stagione))
    expect(conSet.has('M-4')).toBe(true)
    expect(stagioneConSetPiuRecente(conSet, new Date('2026-08-25T12:00:00'))).toBe('M-4')
  })
})

describe('la stagione non entra nello stato condiviso', () => {
  const squadra = () => Array(6).fill(null).map(() => ({
    key: null, item: null, ability: null, nature: null,
    sps: [0, 0, 0, 0, 0, 0], moves: [null, null, null, null],
  }))

  it('il link condiviso non contiene la stagione', () => {
    const url = encodeTeamsToURL(squadra(), squadra(),
      { weather: 'sun', terrain: null, trickRoom: true, doubleTarget: true })
    const testo = decodeURIComponent(String(url))
    for (const s of STAGIONI) {
      expect(testo.includes(s.id), `il link nomina ${s.id}`).toBe(false)
    }
    expect(testo.includes('stagione'), 'il link nomina la stagione').toBe(false)
  })

  it('controllo negativo: quello che DEVE stare nel link ci arriva', () => {
    // Senza, il test sopra passerebbe anche se `encodeTeamsToURL` producesse
    // una stringa vuota per un difetto suo. Il giro completo è il controllo
    // giusto: cercare «sun» nella stringa non proverebbe niente, perché il
    // payload è codificato e non contiene i nomi in chiaro.
    const url = encodeTeamsToURL(squadra(), squadra(),
      { weather: 'sun', terrain: null, trickRoom: true, doubleTarget: true })
    const tornato = decodeTeamsFromURL(url)
    expect(tornato, 'il link non si rilegge').toBeTruthy()
    expect(tornato.field.weather, 'il meteo deve viaggiare nel link').toBe('sun')
    expect(tornato.field.trickRoom).toBe(true)
  })
})

describe('il negozio della stagione', () => {
  beforeEach(() => {
    try { localStorage.removeItem('sixth_ember_stagione') } catch { /* niente */ }
  })

  it('accetta solo stagioni che esistono, e «tutte»', async () => {
    const { default: useStagione, TUTTE } = await import('../store/useStagione.js')
    const { setStagione } = useStagione.getState()

    setStagione('M-3')
    expect(useStagione.getState().stagione).toBe('M-3')

    setStagione(TUTTE)
    expect(useStagione.getState().stagione).toBe(TUTTE)

    // Una stagione inventata non deve poter entrare: arriverebbe da un
    // localStorage manomesso o da un registro cambiato sotto i piedi.
    setStagione('M-inventata')
    expect(useStagione.getState().stagione, 'valore rifiutato').toBe(TUTTE)
  })
})
