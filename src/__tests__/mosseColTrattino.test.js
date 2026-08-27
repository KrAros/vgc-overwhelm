/**
 * src/__tests__/mosseColTrattino.test.js
 *
 * Le sedici mosse che un set non poteva nominare.
 *
 * ─── IL DIFETTO ────────────────────────────────────────────────────────────
 *
 * Applicare un set meta passava ogni mossa per `m.replace(/-/g, ' ')`, sul
 * presupposto che le chiavi di `moves.json` usino gli spazi. Vale per la
 * stragrande maggioranza — `fake out`, `rock slide` — ma non per sedici, che
 * il trattino ce l'hanno DENTRO la chiave vera:
 *
 *     u-turn · double-edge · x-scissor · v-create · freeze-dry · will-o-wisp
 *     self-destruct · soft-boiled · mud-slap · lock-on · trick-or-treat
 *     topsy-turvy · multi-attack · wake-up slap · baby-doll eyes
 *     power-up punch
 *
 * Per quelle la sostituzione produce `u turn`, che non è una chiave: lo slot
 * restava VUOTO. Non un errore, non un avviso — una mossa in meno.
 *
 * Sono mosse comuni: U-turn e Freeze-Dry stanno in mezzo meta.
 *
 * ─── PERCHE' NON SI ERA MAI VISTO ──────────────────────────────────────────
 *
 * Perché nessuno dei ventitré set ne usava una, e perché il test che avrebbe
 * dovuto accorgersene portava una COPIA della stessa normalizzazione, presa
 * dal componente. Test e app sbagliavano nello stesso modo, quindi il test
 * era verde: un oracolo che ripete l'ipotesi che deve controllare non
 * controlla niente.
 *
 * È saltato fuori al primo set che chiedeva Will-O-Wisp.
 *
 * ─── L'IMPORT DA SHOWDOWN NON ERA ROTTO ────────────────────────────────────
 *
 * `showdownIO.js` faceva già la cosa giusta — prima la chiave grezza, poi
 * quella con gli spazi — quindi incollare una squadra con U-turn ha sempre
 * funzionato. Due percorsi verso la stessa risposta, uno corretto e uno no,
 * per anni. Ora la funzione è una sola ed è quella che già funzionava.
 */

import { describe, it, expect } from 'vitest'
import movesData from '../data/moves.json' with { type: 'json' }
import { findMoveKey } from '../utils/showdownIO.js'

/** Le chiavi di `moves.json` che contengono un trattino. */
const COL_TRATTINO = Object.keys(movesData).filter(k => k.includes('-'))

describe('mosse la cui chiave contiene un trattino', () => {
  it('ce ne sono, e sono queste', () => {
    // Controllo negativo: se `moves.json` cambiasse grafia e non ne restasse
    // nessuna, tutto il file smetterebbe di provare qualcosa senza diventare
    // rosso.
    expect(COL_TRATTINO.length, 'nessuna mossa col trattino: questo file non prova più niente')
      .toBeGreaterThan(10)
    expect(COL_TRATTINO).toContain('u-turn')
    expect(COL_TRATTINO).toContain('will-o-wisp')
  })

  it('ognuna si risolve in se stessa', () => {
    const perse = COL_TRATTINO.filter(k => findMoveKey(k) !== k)
    expect(perse, 'un set che nomina queste mosse lascerebbe lo slot vuoto').toEqual([])
  })

  it('la sostituzione cieca le perdeva tutte: è la misura del difetto', () => {
    // Il difetto in forma esplicita, così resta scritto quanto era ampio.
    const cieca = (m) => m.replace(/-/g, ' ')
    const perseAllora = COL_TRATTINO.filter(k => !movesData[cieca(k)])
    expect(perseAllora.length, 'la vecchia normalizzazione le perdeva')
      .toBe(COL_TRATTINO.length)
  })

  it('le mosse a spazi continuano a risolversi dal loro slug', () => {
    // La forma che i set usano dappertutto non deve essersi rotta: è la
    // stragrande maggioranza, e nessun test la copriva prima.
    for (const [slug, atteso] of [
      ['fake-out', 'fake out'],
      ['rock-slide', 'rock slide'],
      ['flare-blitz', 'flare blitz'],
      ['wide-guard', 'wide guard'],
    ]) {
      expect(findMoveKey(slug), `${slug} non si risolve più`).toBe(atteso)
    }
  })

  it('una mossa inventata resta null, invece di inventarsi una chiave', () => {
    expect(findMoveKey('mossa-che-non-esiste')).toBeNull()
    expect(findMoveKey(null)).toBeNull()
    expect(findMoveKey('')).toBeNull()
  })
})
