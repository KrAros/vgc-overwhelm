/**
 * src/__tests__/ncpHarness.test.js
 *
 * Verifica che l'HARNESS sia guidato bene. Non verifica il nostro motore.
 *
 * ─── PERCHÉ QUESTO TEST È IL PIÙ IMPORTANTE DEI DUE ────────────────────────
 * L'harness esegue il codice di NCP in Node riempiendo a mano un oggetto che
 * nell'applicazione vera viene riempito leggendo i campi di una pagina HTML.
 * Se sbagliassimo a riempirlo — un campo dimenticato, una casella che risponde
 * "spuntata" invece che "vuota" — NCP calcolerebbe lo stesso, senza protestare,
 * e produrrebbe numeri plausibili ma sbagliati. Poi quei numeri finirebbero
 * nella fixture come "oracolo", e la sessione D inseguirebbe bug inesistenti.
 *
 * È già successo durante la costruzione: con uno stub jQuery in cui `val()`
 * restituiva un oggetto invece di `undefined`, NCP accendeva da solo le abilità
 * Ruin e il caso 01 usciva 31-37 invece di 41-49. Il numero era credibile.
 *
 * L'unico modo di accorgersene è confrontare l'harness con qualcosa che NON
 * viene dall'harness: i casi che hai letto a mano dall'interfaccia di NCP.
 * Se l'harness li riproduce tutti, roll per roll, è guidato bene.
 *
 * Il piano chiedeva cinque casi. Ce ne sono otto.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { CASI_GOLDEN } from './helpers/casiGolden.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const VENDOR = path.join(RADICE, 'vendor', 'ncp')
const vendorPresente = fs.existsSync(path.join(VENDOR, 'damage_SV.js'))

/**
 * I casi con `fonte: 'previsione'` sono esclusi: i loro numeri li ha prodotti
 * il nostro motore, non NCP, quindi non possono validare niente. Sono l'oggetto
 * dell'altro test qui sotto, non lo strumento.
 */
const CASI_LETTI_A_MANO = CASI_GOLDEN.filter(c => !c.skip && c.fonte !== 'previsione')

describe("l'harness NCP riproduce i casi letti a mano", () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — harness non verificabile', () => {
    console.warn(
      '\n  ⚠  vendor/ncp/ non trovato: i test dell\'harness sono saltati.\n' +
      '     La fixture ncp-golden.json resta valida (i numeri sono già dentro),\n' +
      '     ma non puoi rigenerarla né verificare che l\'harness sia guidato bene.\n'
    )
    expect(vendorPresente).toBe(false)
  })

  it.runIf(vendorPresente)('ci sono almeno cinque casi letti a mano da confrontare', () => {
    expect(CASI_LETTI_A_MANO.length).toBeGreaterThanOrEqual(5)
  })

  for (const caso of CASI_LETTI_A_MANO) {
    it.runIf(vendorPresente)(`harness ≡ NCP letto a mano — ${caso.nome}`, () => {
      const risultato = harness.calcola(caso.input)
      // Un caso golden deve essere esprimibile: se l'harness lo esclude, il
      // problema è nella mappatura, e il messaggio dice esattamente dove.
      expect(risultato.motivo ?? null).toBeNull()
      expect(risultato.ok).toBe(true)
      expect(risultato.rolls).toEqual(caso.rolls)
      if (caso.defHP !== undefined) expect(risultato.defHP).toBe(caso.defHP)
    })
  }

  it.runIf(vendorPresente)('i casi golden sono tutti raccolti in Doubles', () => {
    // La regola d'oro: un caso preso in Singles porterebbe dentro il
    // moltiplicatore sbagliato dello schermo (0x800 invece di 0xAAC). Nessuno
    // dei casi letti a mano usa mosse ad area su bersaglio singolo, quindi
    // devono risultare tutti "Doubles".
    for (const caso of CASI_LETTI_A_MANO) {
      const r = harness.calcola(caso.input)
      expect(r.format, `${caso.nome} è stato mappato su ${r.format}`).toBe('Doubles')
    }
  })
})

describe('i casi ancora dichiarati come previsione', () => {
  const previsioni = CASI_GOLDEN.filter(c => c.fonte === 'previsione' && !c.skip)

  it.runIf(vendorPresente)("l'harness dice se una previsione era giusta", async () => {
    if (previsioni.length === 0) {
      expect(previsioni.length).toBe(0)
      return
    }
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    const h = creaHarness()
    const righe = []
    for (const caso of previsioni) {
      const r = h.calcola(caso.input)
      if (!r.ok) { righe.push(`     · ${caso.nome} — non esprimibile: ${r.motivo}`); continue }
      const coincide = JSON.stringify(r.rolls) === JSON.stringify(caso.rolls)
      righe.push(
        coincide
          ? `     ✓ ${caso.nome} — l'harness conferma: si può togliere fonte:'previsione'`
          : `     ✗ ${caso.nome} — l'harness dà ${r.rolls[0]}–${r.rolls[15]}, il caso dice ${caso.rolls[0]}–${caso.rolls[15]}`
      )
    }
    console.warn(`\n  ${previsioni.length} caso/i ancora marcato/i come previsione:\n` + righe.join('\n') + '\n')
    expect(righe.length).toBe(previsioni.length)
  })
})
