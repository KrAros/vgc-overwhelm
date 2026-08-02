/**
 * src/__tests__/ncpGolden.test.js
 *
 * Confronta il nostro motore con i numeri di NCP, su 281 configurazioni.
 *
 * ─── DOVE VENGONO I NUMERI ATTESI ──────────────────────────────────────────
 * Da `fixtures/ncp-golden.json`, generato con `npm run ncp:gen` facendo girare
 * il motore di NCP (in `vendor/ncp/`) sulle stesse configurazioni dello
 * snapshot. Questo test NON esegue NCP: legge la fixture e basta, quindi è
 * veloce e continua a funzionare anche senza `vendor/`.
 *
 * ─── TRE FILE, TRE MESTIERI ────────────────────────────────────────────────
 *   snapshot.test.js    "questo numero non è cambiato"      → rileva movimenti
 *   golden.test.js      "questo numero è giusto"            → 8 casi letti a mano
 *   ncpGolden.test.js   "questi 281 numeri sono giusti"     → l'oracolo in blocco
 *
 * Lo snapshot congela anche i bug: è voluto, serve a rispondere a "cosa si è
 * mosso dopo il refactor". Qui invece un test rosso significa che il motore
 * sbaglia, punto.
 *
 * ─── I CASI `divergente` ───────────────────────────────────────────────────
 * Girano con `it.fails`, che si aspetta il fallimento: restano verdi finché il
 * bug c'è, e diventano rossi quando viene corretto. Un test rosso permanente
 * smetteresti di guardarlo dopo due giorni; uno che diventa rosso quando fai
 * la cosa giusta è un promemoria.
 *
 * Quando la sessione D chiude una catena di modificatori, un gruppo intero di
 * questi si rovescia insieme. A quel punto si rigenera la fixture
 * (`npm run ncp:gen`) e quei casi passano da soli a `concorde`.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'
import fixture from './fixtures/ncp-golden.json' with { type: 'json' }

const { meta, cases, esclusi } = fixture

describe('calcEngine — confronto con NCP (fixture generata dall\'harness)', () => {
  it('la fixture è stata generata e contiene casi', () => {
    expect(cases.length).toBeGreaterThan(0)
    expect(meta.fonte).toBe('harness')
    expect(meta.ncpCommit).toBeTruthy()
  })

  it('riepilogo', () => {
    const concordi = cases.filter(c => c.stato === 'concorde').length
    const divergenti = cases.filter(c => c.stato === 'divergente').length
    console.warn(
      `\n  Confronto con NCP @ ${meta.ncpCommit}\n` +
      `     ${concordi} concordi · ${divergenti} divergenti · ${esclusi.length} esclusi\n` +
      `     I divergenti girano con it.fails: sono bug noti, li chiude la sessione D.\n`
    )
    expect(concordi + divergenti).toBe(cases.length)
  })

  it('ogni caso escluso porta scritto il motivo', () => {
    // Un caso saltato in silenzio è un caso perso: fra sei mesi nessuno sa se
    // fosse impossibile da mappare o se ci si era solo arresi.
    for (const e of esclusi) {
      expect(e.motivo, `il caso ${e.id} è escluso senza motivo`).toBeTruthy()
      expect(e.categoria, `il caso ${e.id} è escluso senza categoria`).toBeTruthy()
    }
  })

  it('nessun caso è stato raccolto in un formato che falsi gli schermi', () => {
    // Il formato cambia il moltiplicatore degli schermi. Un caso con schermo
    // attivo raccolto in Singles porterebbe dentro 0x800 invece di 0xAAC: il
    // numero sembrerebbe plausibile e resterebbe per sempre a validare
    // l'errore. L'harness esclude apposta quella combinazione — qui si
    // controlla che nessuno sia sfuggito.
    const sospetti = cases.filter(c => {
      const f = c.input.field || {}
      return c.format === 'Singles' && (f.reflect || f.lightScreen || f.auroraVeil)
    })
    expect(sospetti.map(c => c.id)).toEqual([])
  })

  for (const caso of cases) {
    const test = caso.stato === 'divergente' ? it.fails : it
    const etichetta = caso.stato === 'divergente' ? ' [divergente — atteso rosso finché D non corregge]' : ''

    test(`${caso.id} [${caso.tags.join(',')}]${etichetta}`, () => {
      const risultato = calculateDamage({ ...caso.input, debug: false })

      if (caso.attesoNullo) {
        // NCP dice che questo colpo non fa danno: immunità, oppure una mossa
        // che sotto quel meteo fallisce del tutto.
        const nostroNullo = !risultato || !Array.isArray(risultato.rolls) || risultato.rolls.length !== 16
        expect(nostroNullo, 'NCP dice colpo nullo, noi calcoliamo un danno').toBe(true)
        return
      }

      expect(risultato).not.toBeNull()
      // Il confronto è roll per roll, mai su minimo e massimo. Con Life Orb e
      // Reflect insieme gli estremi coincidono ma cinque roll intermedi no —
      // e sono proprio quelli che alimentano il calcolo della probabilità di KO.
      expect(risultato.rolls).toEqual(caso.rolls)
      if (caso.defHP !== undefined) expect(risultato.defHP).toBe(caso.defHP)
    })
  }
})
