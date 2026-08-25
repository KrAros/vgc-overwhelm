/**
 * src/__tests__/reg.test.js
 *
 * Il registro delle regolazioni, e le due cose che possono marcire dentro:
 * un elenco che si contraddice, e una data che passa.
 *
 * ─── IL TEST CHE DIVENTERA' ROSSO DA SOLO ──────────────────────────────────
 *
 * «la stagione in corso e' derivabile» fallisce il giorno dopo la fine di
 * M-5, senza che nessuno abbia toccato una riga di codice. Non e' un difetto
 * del test: e' il suo scopo. Vuol dire che il registro e' indietro e che
 * l'app sta proponendo i set di una stagione finita.
 *
 * Quel giorno si aggiunge la stagione nuova al registro e torna verde. Nel
 * frattempo l'applicazione NON si rompe — `stagionePredefinita()` ripiega
 * sull'ultima conosciuta — perche' il ritardo lo deve vedere chi costruisce,
 * non chi calcola danni.
 */

import { describe, it, expect } from 'vitest'
import registro from '../data/regChampions.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }
import {
  REG, STAGIONI, stagioneCorrente, stagionePredefinita,
  regDiStagione, specieDiReg, specieDiStagione, STAGIONE_PIU_RECENTE,
} from '../lib/reg.js'

describe('registro delle reg — coerenza interna', () => {
  it('ogni specie elencata esiste nell\'anagrafica', () => {
    const ignote = [...new Set(REG.flatMap(r => r.specie))].filter(s => !pokemonData[s])
    expect(ignote, 'slug che pokemon.json non conosce').toEqual([])
  })

  it('nessuna reg elenca due volte la stessa specie', () => {
    for (const r of REG) {
      const doppie = r.specie.filter((s, i) => r.specie.indexOf(s) !== i)
      expect(doppie, `${r.id} ha doppioni`).toEqual([])
    }
  })

  it('ogni stagione appartiene a una sola reg, e gli identificatori sono unici', () => {
    const ids = STAGIONI.map(s => s.id)
    expect(ids.filter((x, i) => ids.indexOf(x) !== i), 'stagioni duplicate').toEqual([])
    for (const s of STAGIONI) expect(regDiStagione(s.id), s.id).toBeTruthy()
  })

  it('M-B contiene M-A per intero: aggiunge e non toglie', () => {
    // Dichiarato nelle condizioni del file. Se un giorno una reg togliesse
    // qualcosa, questo test va cambiato di proposito — non è una legge, è
    // ciò che vale per M-A → M-B.
    const ma = new Set(specieDiReg('M-A'))
    const mb = new Set(specieDiReg('M-B'))
    const perse = [...ma].filter(s => !mb.has(s))
    expect(perse, 'M-B avrebbe perso specie di M-A').toEqual([])
    expect(mb.size).toBeGreaterThan(ma.size)
  })

  it('i controlli dichiarati nel file sono veri', () => {
    // IL CONTROLLO NEGATIVO DEL REGISTRO. Senza, ogni test qui sopra
    // passerebbe anche con due elenchi identici o vuoti.
    const c = registro.condizioni.controllo
    const ma = new Set(specieDiReg('M-A'))
    const mb = new Set(specieDiReg('M-B'))

    for (const s of c.dentro_ma) {
      expect(ma.has(s), `${s} dovrebbe essere in M-A`).toBe(true)
      expect(mb.has(s), `${s} dovrebbe essere anche in M-B`).toBe(true)
    }
    for (const s of c.solo_mb) {
      expect(ma.has(s), `${s} NON deve essere in M-A`).toBe(false)
      expect(mb.has(s), `${s} dovrebbe essere in M-B`).toBe(true)
    }
    for (const s of c.fuori_da_tutte) {
      expect(ma.has(s), `${s} non è in nessuna reg`).toBe(false)
      expect(mb.has(s), `${s} non è in nessuna reg`).toBe(false)
    }
  })

  it('le decisioni sulle forme sono quelle prese a mano', () => {
    const mb = new Set(specieDiReg('M-B'))

    // Ombrello applicato: una riga sola, tutte le forme.
    for (const s of ['rotom', 'rotom-wash', 'rotom-heat', 'rotom-frost', 'rotom-fan', 'rotom-mow'])
      expect(mb.has(s), `${s} entra sotto l'ombrello di Rotom`).toBe(true)
    for (const s of ['gourgeist', 'gourgeist-small', 'gourgeist-large', 'gourgeist-super'])
      expect(mb.has(s), `${s}: le quattro taglie contano tutte`).toBe(true)

    // Ombrello NON applicato: stati di battaglia, non scelte di squadra.
    expect(mb.has('aegislash')).toBe(true)
    expect(mb.has('aegislash-blade'), 'forma di battaglia, non si sceglie').toBe(false)
    expect(mb.has('morpeko-hangry'), 'forma di battaglia').toBe(false)
    expect(mb.has('palafin-hero'), 'forma di battaglia').toBe(false)

    // Una riga «Qwilfish» è la sola forma base.
    expect(mb.has('qwilfish')).toBe(true)
    expect(mb.has('qwilfish-hisui'), 'la lista la nomina una volta sola').toBe(false)

    // La riga «Floette» è il Fiore Eterno: la base non è legale.
    expect(mb.has('floette-eternal')).toBe(true)
    expect(mb.has('floette'), 'la Floette base non è in nessuna reg').toBe(false)
    expect(mb.has('floette-mega')).toBe(true)
  })
})

describe('registro delle reg — la stagione in corso', () => {
  it('la stagione in corso è derivabile: il registro non è indietro', () => {
    const corrente = stagioneCorrente()
    expect(
      corrente,
      'nessuna stagione contiene la data di oggi. Il registro è INDIETRO: '
      + 'aggiungi la stagione nuova a src/data/regChampions.json con le sue date. '
      + `L'ultima dichiarata è ${STAGIONE_PIU_RECENTE.id}, finita il ${STAGIONE_PIU_RECENTE.al}.`,
    ).not.toBeNull()
  })

  it('si deriva dalle date, non da un campo scritto a mano', () => {
    // Falsificabilità: con una data dentro M-5 dà M-5, con una data prima
    // dell'inizio dà null. Se `stagioneCorrente` leggesse un flag,
    // risponderebbe lo stesso in tutti e tre i casi.
    expect(stagioneCorrente(new Date('2026-08-25T12:00:00')).id).toBe('M-5')
    expect(stagioneCorrente(new Date('2026-08-05T12:00:00')).id, 'estremo iniziale incluso').toBe('M-5')
    expect(stagioneCorrente(new Date('2026-09-09T12:00:00')).id, 'estremo finale incluso').toBe('M-5')
    expect(stagioneCorrente(new Date('2026-08-04T12:00:00')), 'il giorno prima').toBeNull()
    expect(stagioneCorrente(new Date('2026-09-10T12:00:00')), 'il giorno dopo').toBeNull()
    expect(stagioneCorrente(new Date('2020-01-01T12:00:00'))).toBeNull()

    // E nessuna riga del registro dichiara di essere corrente.
    const testo = JSON.stringify(registro)
    expect(testo.includes('"corrente"'), 'la stagione corrente non si scrive, si calcola').toBe(false)
  })

  it('l\'app non resta senza stagione, nemmeno se il registro è indietro', () => {
    // Il ripiego che tiene separato il ritardo del registro dal danno
    // all'utente: il test sopra diventa rosso, l'interfaccia no.
    expect(stagionePredefinita(new Date('2030-01-01T12:00:00')).id).toBe(STAGIONE_PIU_RECENTE.id)
    expect(stagionePredefinita(new Date('2026-08-25T12:00:00')).id).toBe('M-5')
  })

  it('M-5 sta sotto M-B, e le sue specie sono quelle di M-B', () => {
    expect(regDiStagione('M-5')).toBe('M-B')
    expect(regDiStagione('M-1')).toBe('M-A')
    expect(specieDiStagione('M-5')).toEqual(specieDiReg('M-B'))
    expect(specieDiStagione('M-1')).toEqual(specieDiReg('M-A'))
    expect(specieDiStagione('M-inventata')).toEqual([])
  })
})
