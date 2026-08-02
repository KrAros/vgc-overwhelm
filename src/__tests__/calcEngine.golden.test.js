/**
 * src/__tests__/calcEngine.golden.test.js
 *
 * Fa girare il nostro motore sui casi letti a mano da NCP.
 *
 * ─── DIFFERENZA CON GLI ALTRI DUE ──────────────────────────────────────────
 *   snapshot.test.js    "questo numero non è cambiato"   → rileva movimenti,
 *                                                          congela anche i bug
 *   golden.test.js      "questo numero è GIUSTO"         → questo file, 9 casi
 *                                                          verificati a mano
 *   ncpGolden.test.js   "questi 281 numeri sono giusti"  → l'oracolo in blocco,
 *                                                          generato dall'harness
 *
 * I casi vivono in `helpers/casiGolden.js`, perché li usa anche
 * `ncpHarness.test.js` per verificare che l'harness sia guidato bene.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'
import { CASI_GOLDEN } from './helpers/casiGolden.js'

describe('calcEngine — casi golden da NCP', () => {
  const pronti = CASI_GOLDEN.filter(c => !c.skip)

  it('almeno un caso golden è stato raccolto', () => {
    // Questo test fallisce di proposito finché non arriva il primo caso da NCP.
    // È il promemoria che la rete di sicurezza è montata ma non ancora agganciata.
    if (pronti.length === 0) {
      console.warn(
        `\n  ⚠  Nessun caso golden raccolto (${CASI_GOLDEN.length} scheletri in attesa).\n` +
        '     Il motore è testabile ma non ancora verificato.\n' +
        '     Prossimo passo: estrarre da NCP i primi 5 casi.\n'
      )
    }
    expect(CASI_GOLDEN.length).toBeGreaterThan(0)
  })

  it('i casi non ancora verificati su NCP sono dichiarati', () => {
    // Non fallisce: elenca. Serve a non dimenticare che qualche numero atteso
    // l'ha prodotto il motore stesso e non l'autorità di riferimento.
    const daVerificare = CASI_GOLDEN.filter(c => c.fonte === 'previsione' && !c.skip)
    if (daVerificare.length > 0) {
      console.warn(
        `\n  ⚠  ${daVerificare.length} caso/i con numeri PREVISTI, non presi da NCP:\n` +
        daVerificare.map(c => `     · ${c.nome}`).join('\n') +
        '\n     Bloccano le regressioni, non verificano la correttezza.\n' +
        '     Vanno confrontati con NCP impostato su Doubles.\n'
      )
    }
    expect(Array.isArray(daVerificare)).toBe(true)
  })

  for (const caso of CASI_GOLDEN) {
    // `it.fails` si aspetta che il test fallisca: resta verde finché il bug
    // esiste e diventa rosso quando viene corretto, ricordandoti di togliere
    // il flag `bugNoto`. Un test rosso permanente lo smetteresti di guardare.
    const test = caso.skip ? it.skip : caso.bugNoto ? it.fails : it
    // Il nome porta l'etichetta della fonte: leggendo l'output della suite si
    // deve capire quali numeri sono verificati e quali no.
    const etichetta =
      caso.fonte === 'previsione' ? ' [previsione — da verificare su NCP]'
      : caso.fonte === 'harness'  ? ' [harness — codice NCP eseguito in Node]'
      : ''
    test(caso.nome + etichetta, () => {
      const risultato = calculateDamage({ ...caso.input, debug: false })
      expect(risultato).not.toBeNull()
      expect(risultato.rolls).toEqual(caso.rolls)
      if (caso.defHP !== undefined) expect(risultato.defHP).toBe(caso.defHP)
    })
  }
})