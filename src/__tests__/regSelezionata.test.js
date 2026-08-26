/**
 * src/__tests__/regSelezionata.test.js
 *
 * La reg scelta: da dove parte, dove NON deve finire, e cosa filtra.
 *
 * ─── IL TEST CHE CONTA DI PIU' E' QUELLO SUL LINK ──────────────────────────
 *
 * La reg è una preferenza di chi scrive la squadra, non una condizione della
 * battaglia. Se finisse nel link condiviso, aprire lo stesso link con un'altra
 * reg selezionata cambierebbe cosa si vede — e il giorno in cui qualcuno la
 * usasse anche per filtrare le specie, cambierebbe la squadra.
 *
 * La separazione dei negozi lo rende impossibile per costruzione, ma
 * «impossibile per costruzione» è un'affermazione, e qui si verifica.
 *
 * ─── IL LINK NON DEVE NOMINARE NEMMENO LE STAGIONI ─────────────────────────
 *
 * Le stagioni non si scelgono più, ma esistono ancora nei dati: `reg.js` le usa
 * per sapere quale reg è in corso. Il controllo sul link le include lo stesso,
 * perché il motivo per cui non devono starci non è mai stato «l'utente le
 * sceglie» — è che sono preferenze e non condizioni di battaglia.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { REG, STAGIONI, regConSetPiuRecente } from '../lib/reg.js'
import { META_PRESETS } from '../data/metaPresets.js'
import { encodeTeamsToURL, decodeTeamsFromURL } from '../store/useCalcStore.js'

const OGGI = new Date('2026-08-25T12:00:00')

describe('da quale reg si parte', () => {
  it('se la corrente ha set, si parte da quella', () => {
    expect(regConSetPiuRecente(new Set(['M-A', 'M-B']), OGGI)).toBe('M-B')
  })

  it('se la corrente non ha set, si scende all\'indietro', () => {
    // Il 25 agosto 2026 la reg in corso è M-B. Se un giorno avesse zero set —
    // il caso vero il giorno che arriva M-C — si deve vedere M-A invece di una
    // tendina vuota.
    expect(regConSetPiuRecente(new Set(['M-A']), OGGI)).toBe('M-A')
  })

  it('non si sale MAI verso una reg futura', () => {
    // Con una data dentro M-A, avere set solo in M-B non deve far saltare
    // avanti: un set di una reg non ancora cominciata non esiste.
    const dentroMA = new Date('2026-04-20T12:00:00')
    expect(regConSetPiuRecente(new Set(['M-B']), dentroMA)).toBeNull()
  })

  it('senza nessun set risponde null, e il negozio ripiega su «tutte»', () => {
    expect(regConSetPiuRecente(new Set())).toBeNull()
  })

  it('con i set veri di oggi la partenza è M-B', () => {
    // Il caso reale, non un'ipotesi: legge i preset committati.
    //
    // Questo test ha già cambiato risposta due volte, ed è il suo mestiere.
    // Diceva «si parte da M-4», poi «da M-5» quando è arrivato il primo set di
    // quella stagione. Ora la stagione non è più la chiave e la risposta è la
    // reg — ma la domanda è sempre la stessa: chi apre l'app vede dei set?
    const conSet = new Set(META_PRESETS.map(p => p.reg))
    expect(conSet.has('M-B')).toBe(true)
    expect(regConSetPiuRecente(conSet, OGGI)).toBe('M-B')
  })

  it('e con M-B si vedono TUTTI i set, non una parte', () => {
    // Il difetto che ha fatto cambiare chiave: filtrando per stagione, con M-5
    // selezionata si vedevano set per 2 specie su 20. Il filtro rispondeva
    // «quando è stato visto» a chi chiedeva «cosa posso usare».
    //
    // Non un conteggio fisso, che invecchierebbe a ogni set aggiunto: la
    // proprietà è che filtrare sulla reg di partenza non nasconda niente di
    // quella reg.
    const partenza = regConSetPiuRecente(new Set(META_PRESETS.map(p => p.reg)), OGGI)
    const visibili = META_PRESETS.filter(p => p.reg === partenza)

    // Deve mostrarne la stragrande maggioranza: se un giorno la partenza
    // mostrasse una minoranza dei set esistenti, è di nuovo il difetto di
    // prima sotto un altro nome.
    expect(
      visibili.length / META_PRESETS.length,
      'la reg di partenza mostra una minoranza dei set',
    ).toBeGreaterThan(0.5)

    // ─── IL RESIDUO, SCRITTO PERCHE' NON SI DIMENTICHI ───────────────────
    //
    // M-B ha solo AGGIUNTO specie rispetto a M-A, quindi ogni set osservato
    // in M-A resta giocabile in M-B — e il filtro M-B lo nasconderebbe. È lo
    // stesso difetto di prima, un piano più su.
    //
    // Oggi è vuoto: nessun set è di M-A. Il controllo resta qui perché il
    // giorno che qualcuno ne aggiunge uno deve diventare una decisione presa,
    // non una sorpresa. Se allora la risposta sarà «va bene così», si toglie
    // questa riga di proposito.
    //
    // Non varrà per M-C: una reg che TOGLIE specie invaliderebbe davvero i
    // set precedenti, ed è il caso per cui la reg è la chiave giusta.
    const nascostiMaGiocabili = META_PRESETS.filter(p => p.reg !== partenza)
    expect(
      nascostiMaGiocabili.map(p => `${p.slug}/${p.label} (${p.reg})`),
      'set di una reg precedente: il filtro li nasconde anche se giocabili',
    ).toEqual([])
  })
})

describe('la reg non entra nello stato condiviso', () => {
  const squadra = () => Array(6).fill(null).map(() => ({
    key: null, item: null, ability: null, nature: null,
    sps: [0, 0, 0, 0, 0, 0], moves: [null, null, null, null],
  }))

  it('il link condiviso non contiene né la reg né la stagione', () => {
    const url = encodeTeamsToURL(squadra(), squadra(),
      { weather: 'sun', terrain: null, trickRoom: true, doubleTarget: true })
    const testo = decodeURIComponent(String(url))
    for (const r of REG) {
      expect(testo.includes(r.id), `il link nomina ${r.id}`).toBe(false)
    }
    for (const s of STAGIONI) {
      expect(testo.includes(s.id), `il link nomina ${s.id}`).toBe(false)
    }
    expect(testo.includes('reg'), 'il link nomina la reg').toBe(false)
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

describe('il negozio della reg', () => {
  beforeEach(() => {
    try { localStorage.removeItem('sixth_ember_reg') } catch { /* niente */ }
  })

  it('accetta solo reg che esistono, e «tutte»', async () => {
    const { default: useReg, TUTTE } = await import('../store/useReg.js')
    const { setReg } = useReg.getState()

    setReg('M-A')
    expect(useReg.getState().reg).toBe('M-A')

    setReg(TUTTE)
    expect(useReg.getState().reg).toBe(TUTTE)

    // Una reg inventata non deve poter entrare: arriverebbe da un
    // localStorage manomesso o da un registro cambiato sotto i piedi.
    setReg('M-inventata')
    expect(useReg.getState().reg, 'valore rifiutato').toBe(TUTTE)

    // E nemmeno una STAGIONE: era un valore valido fino a ieri, e potrebbe
    // arrivare da un localStorage vecchio se qualcuno riusasse la chiave.
    setReg('M-5')
    expect(useReg.getState().reg, 'una stagione non è una reg').toBe(TUTTE)
  })
})
