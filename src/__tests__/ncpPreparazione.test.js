/**
 * src/__tests__/ncpPreparazione.test.js
 *
 * Confronta il nostro motore con NCP sullo STRATO DI PREPARAZIONE: tutto
 * quello che succede ai due Pokémon prima che il danno venga calcolato.
 *
 * ─── PERCHÉ NON BASTAVA `ncpGolden.test.js` ────────────────────────────────
 * I 509 golden della sessione H entrano da `GET_DAMAGE_SV`, che riceve i due
 * Pokémon GIÀ SISTEMATI. Intimidate, Intrepid Sword, Dauntless Shield,
 * Download e le abilità paradosso vivono un livello sopra, in
 * `CALCULATE_ALL_MOVES_SV`, e non erano confrontati con niente.
 *
 * «Zero divergenze vive dal riferimento» a fine F-1 era vero *per la formula*.
 * Non era vero per lo stato di partenza: aperto l'ingresso alto in F-2, la
 * prima sonda ha trovato quattordici divergenze su sedici.
 *
 * ─── QUATTRO FILE, QUATTRO MESTIERI ────────────────────────────────────────
 *   snapshot.test.js         "questo numero non è cambiato"
 *   golden.test.js           "questo numero è giusto"            8 casi a mano
 *   ncpGolden.test.js        "la formula è giusta"               509 casi
 *   ncpPreparazione.test.js  "lo stato di partenza è giusto"     questo
 *
 * ─── I CASI `divergente` ───────────────────────────────────────────────────
 * Girano con `it.fails`, come in `ncpGolden`: restano verdi finché il bug c'è
 * e diventano rossi quando viene corretto. Li chiude la sessione J.
 *
 * Sono diciotto, e non sono un dettaglio: undici riguardano Intimidate, che
 * NOI GIÀ MODELLIAMO. Non è un'assenza, è un numero sbagliato — di un terzo —
 * su una delle abilità più diffuse del formato.
 *
 * ─── LE SONDE CIECHE ───────────────────────────────────────────────────────
 * Il generatore scarta i casi i cui roll NCP coincidono col loro controllo:
 * il meccanismo si accende ma non arriva ai numeri, quindi il caso non è
 * capace di far fallire niente. Competitive e Rattled finiscono lì, perché
 * alzano Att. Speciale e Velocità mentre la mossa di prova è fisica. Un caso
 * cieco lasciato dentro conterebbe come «concorde» e gonfierebbe il punteggio.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'
import fixture from './fixtures/ncp-preparazione.json' with { type: 'json' }

const { meta, cases, esclusi } = fixture

describe('calcEngine — strato di preparazione di NCP', () => {
  it('la fixture è stata generata dall\'ingresso alto', () => {
    expect(cases.length).toBeGreaterThan(0)
    expect(meta.fonte).toBe('harness-preparazione')
    expect(meta.ingresso).toBe('CALCULATE_ALL_MOVES_SV')
    expect(meta.ncpCommit).toBeTruthy()
  })

  it('riepilogo', () => {
    const concordi = cases.filter(c => c.stato === 'concorde').length
    const divergenti = cases.filter(c => c.stato === 'divergente').length
    console.warn(
      `\n  Preparazione, confronto con NCP @ ${meta.ncpCommit}\n` +
      `     ${concordi} concordi · ${divergenti} divergenti · ${esclusi.length} esclusi\n` +
      `     I divergenti girano con it.fails: li chiude la sessione J.\n`
    )
    expect(concordi + divergenti).toBe(cases.length)
  })

  it('ogni caso escluso porta scritto il motivo', () => {
    for (const e of esclusi) {
      expect(e.motivo, `il caso ${e.id} è escluso senza motivo`).toBeTruthy()
      expect(e.categoria, `il caso ${e.id} è escluso senza categoria`).toBeTruthy()
    }
  })

  it('ogni caso è stato verificato contro un controllo che si muove', () => {
    // Il generatore confronta ogni bersaglio col suo controllo negativo e
    // scarta le coppie che coincidono. Se il conteggio delle coppie fosse
    // zero, la verifica non sarebbe mai stata eseguita e questo file
    // conterebbe accordi che non significano niente.
    expect(meta.coppieVerificate).toBeGreaterThan(0)
    expect(meta.coppieVerificate).toBeGreaterThanOrEqual(cases.length / 2)
  })

  it('nessuna sonda cieca è finita nella fixture', () => {
    const idNellaFixture = new Set(cases.map(c => c.id))
    const ciechi = esclusi.filter(e => e.categoria === 'sonda cieca').map(e => e.id)
    for (const id of ciechi) {
      expect(idNellaFixture.has(id), `${id} è stato scartato ma è nella fixture`).toBe(false)
    }
  })

  for (const caso of cases) {
    const test = caso.stato === 'divergente' ? it.fails : it
    const etichetta = caso.stato === 'divergente'
      ? ' [divergente — atteso rosso finché J non corregge]'
      : ''

    test(`${caso.id}${etichetta} — ${caso.nota}`, () => {
      const risultato = calculateDamage({ ...caso.input, debug: false })

      if (caso.attesoNullo) {
        const nostroNullo = !risultato || !Array.isArray(risultato.rolls) || risultato.rolls.length !== 16
        expect(nostroNullo, 'NCP dice colpo nullo, noi calcoliamo un danno').toBe(true)
        return
      }

      expect(risultato).not.toBeNull()
      expect(risultato.rolls).toEqual(caso.rolls)
      if (caso.defHP !== undefined) expect(risultato.defHP).toBe(caso.defHP)
    })
  }
})
