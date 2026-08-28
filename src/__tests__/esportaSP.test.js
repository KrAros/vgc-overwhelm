/**
 * src/__tests__/esportaSP.test.js
 *
 * L'export scrive SP, e ciò che scrive si rilegge.
 *
 * ─── IL DIFETTO ────────────────────────────────────────────────────────────
 *
 * L'export moltiplicava gli SP per otto e li scriveva sotto `EVs:`, che è
 * l'unità di Showdown. Un set costruito come 32 PS / 11 Dif / 23 AttSp usciva
 * come «EVs: 252 HP / 88 Def / 184 SpA»: numeri giusti nel loro sistema, e
 * illeggibili per chi gioca a Champions — l'utente ne aveva scritti 32 e ne
 * rileggeva 252.
 *
 * ─── PERCHE' NESSUNO L'AVEVA VISTO ─────────────────────────────────────────
 *
 * Perché le due superfici dicevano cose diverse e nessun test le confrontava.
 * L'ANTEPRIMA in `PresetSelect.jsx` mostrava già `SP: 32 / 11 / 23`, per una
 * decisione dichiarata del progetto; l'EXPORT scriveva 252/88/184. Chi guardava
 * l'anteprima vedeva la cosa giusta, chi copiava la cosa sbagliata, e
 * `unSoloParser.test.js` presidiava che il serializzatore fosse UNO — non che
 * dicesse la stessa cosa dell'anteprima.
 *
 * ─── LA PARTE CHE SI ROMPE IN SILENZIO ─────────────────────────────────────
 *
 * Cambiare l'etichetta senza toccare la lettura sarebbe stato peggio del
 * difetto: `SPs:` non corrispondeva a nessun ramo del parser, la riga sarebbe
 * stata ignorata senza avvisi, e reimportare un set esportato avrebbe dato
 * tutti gli SP a zero. Il file lo avvertiva già in testa — «le due funzioni
 * vanno cambiate INSIEME» — per un difetto gemello della sessione L.
 *
 * Per questo il test centrale qui è l'ANDATA E RITORNO, non la forma della
 * riga.
 */

import { describe, it, expect } from 'vitest'
import { teamToShowdown, parseShowdownPaste } from '../utils/showdownIO.js'
import { MAX_SP_PER_STAT, MAX_SP_TOTAL } from '../lib/rules.js'

const slot = (sps) => ({
  key: 'dragalge-mega', item: 'dragalgite', ability: 'regenerator', nature: 'modest',
  sps, moves: ['draco meteor', 'sludge bomb', 'thunderbolt', 'protect'],
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {}, lastRespectsKOs: 0,
})

/** Gli SP del primo slot di un paste riletto. */
const rileggi = (testo) => parseShowdownPaste(testo).pokemon[0].sps

describe('l\'export scrive SP', () => {
  it('il caso segnalato: 32/11/23 esce come 32/11/23', () => {
    const testo = teamToShowdown([slot([32, 0, 11, 23, 0, 0])])
    expect(testo).toContain('SPs: 32 HP / 11 Def / 23 SpA')
    // E il difetto in negativo: i numeri in EV non devono più comparire.
    expect(testo, 'esporta ancora in EV').not.toContain('252')
    expect(testo).not.toContain('EVs:')
  })

  it('non scrive le statistiche a zero', () => {
    const testo = teamToShowdown([slot([32, 0, 11, 23, 0, 0])])
    expect(testo).not.toContain('0 Atk')
    expect(testo).not.toContain('0 Spe')
  })
})

describe('e ciò che scrive si rilegge', () => {
  it('andata e ritorno: gli SP tornano identici', () => {
    // IL TEST CHE CONTA. Senza il ramo `SPs:` nel parser, questo darebbe
    // [0,0,0,0,0,0] — cioè il set svuotato, in silenzio.
    for (const sps of [[32, 0, 11, 23, 0, 0], [1, 32, 1, 0, 0, 32], [32, 0, 21, 0, 11, 2]]) {
      expect(rileggi(teamToShowdown([slot(sps)])), `giro rotto su ${sps}`).toEqual(sps)
    }
  })

  it('il giro non inventa punti né ne perde', () => {
    const sps = [32, 0, 11, 23, 0, 0]
    const tornati = rileggi(teamToShowdown([slot(sps)]))
    expect(tornati.reduce((a, b) => a + b, 0)).toBe(sps.reduce((a, b) => a + b, 0))
    expect(Math.max(...tornati)).toBeLessThanOrEqual(MAX_SP_PER_STAT)
    expect(tornati.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(MAX_SP_TOTAL)
  })
})

describe('i paste veri di Showdown continuano a entrare', () => {
  it('un set in EV resta letto come EV', () => {
    // La ragione per cui `EV_TO_SP` non è stato tolto: chi incolla da Showdown
    // porta EV veri, e vanno divisi per otto. 252 → 32, 88 → 11.
    const paste = [
      'Dragalge-Mega @ Dragalgite',
      'Ability: Regenerator',
      'EVs: 252 HP / 88 Def / 184 SpA',
      'Modest Nature',
      '- Draco Meteor',
    ].join('\n')
    const sps = rileggi(paste)
    expect(sps[0], 'PS').toBe(32)
    expect(sps[2], 'Dif').toBe(11)
    expect(sps[3], 'AttSp').toBe(23)
  })

  it('controllo negativo: le due etichette portano a risultati DIVERSI', () => {
    // Senza, i test sopra passerebbero anche se il parser trattasse `SPs:` e
    // `EVs:` allo stesso modo — cioè se il ramo nuovo non mordesse.
    const righe = (etichetta) => [
      'Dragalge-Mega @ Dragalgite', 'Ability: Regenerator',
      `${etichetta} 32 HP`, 'Modest Nature', '- Protect',
    ].join('\n')
    expect(rileggi(righe('SPs:'))[0], 'sotto SPs: 32 resta 32').toBe(32)
    expect(rileggi(righe('EVs:'))[0], 'sotto EVs: 32 è una distribuzione SP legale').toBe(32)
    // Un valore che come EV supera il tetto SP distingue davvero i due rami.
    expect(rileggi(righe('EVs:').replace('32 HP', '200 HP'))[0], '200 EV = 25 SP').toBe(25)
    expect(rileggi(righe('SPs:').replace('32 HP', '200 HP'))[0], '200 SP si taglia al tetto').toBe(32)
  })
})
