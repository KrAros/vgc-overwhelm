/**
 * src/__tests__/calcEngine.snapshot.test.js
 *
 * Test di caratterizzazione: confronta il motore attuale con la fotografia
 * salvata in fixtures/snapshot.json.
 *
 * Non verifica che i numeri siano GIUSTI — verifica che non siano CAMBIATI.
 * È la rete di sicurezza per i refactor: se sposti una riga in calcEngine.js
 * e un roll si muove, questo test te lo dice subito e ti dice quale caso.
 *
 * Il confronto avviene per `id`, non per posizione: aggiungere casi nuovi in
 * fondo a snapshot-cases.mjs non rompe nulla, solo un valore che cambia lo fa.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'
import snapshot from './fixtures/snapshot.json'

/** Esegue un caso e normalizza l'output come fa il generatore. */
function esegui(input) {
  const risultato = calculateDamage({ ...input, debug: false })
  if (!risultato) return null
  // `log` viene escluso: a debug spento è null, e comunque è testo per gli
  // umani, non un risultato del calcolo. Le chiavi vengono ordinate perché il
  // confronto avviene su oggetti serializzati.
  const ordinato = {}
  for (const chiave of Object.keys(risultato).sort()) {
    if (chiave === 'log') continue
    ordinato[chiave] = risultato[chiave] === undefined ? null : risultato[chiave]
  }
  return ordinato
}

describe('calcEngine — snapshot di caratterizzazione', () => {
  it('la fixture contiene i casi attesi', () => {
    expect(snapshot.cases.length).toBe(snapshot.meta.caseCount)
    expect(snapshot.cases.length).toBeGreaterThan(300)
    const ids = new Set(snapshot.cases.map(c => c.id))
    expect(ids.size).toBe(snapshot.cases.length)
  })

  // Un test per caso: se ne fallisce uno, il nome del test dice già quale
  // combinazione si è mossa, senza dover leggere il diff.
  for (const caso of snapshot.cases) {
    it(`${caso.id} [${caso.tags.join(' ')}]`, () => {
      expect(esegui(caso.input)).toEqual(caso.output)
    })
  }
})

describe('calcEngine — purezza', () => {
  it('non tocca il DOM e non restituisce log con debug spento', () => {
    const caso = snapshot.cases[0]
    const risultato = calculateDamage({ ...caso.input, debug: false })
    expect(risultato.log).toBeNull()
  })

  it('costruisce il log quando debug è acceso, senza cambiare i numeri', () => {
    const caso = snapshot.cases[0]
    const spento = calculateDamage({ ...caso.input, debug: false })
    const acceso = calculateDamage({ ...caso.input, debug: true })

    expect(Array.isArray(acceso.log)).toBe(true)
    expect(acceso.log.length).toBeGreaterThan(5)
    // I rolls devono essere identici: il debug non partecipa al calcolo
    expect(acceso.rolls).toEqual(spento.rolls)
    expect(acceso.defHP).toBe(spento.defHP)
  })

  it('è deterministica: due chiamate identiche danno lo stesso risultato', () => {
    const caso = snapshot.cases[10]
    expect(esegui(caso.input)).toEqual(esegui(caso.input))
  })
})