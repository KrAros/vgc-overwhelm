// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/taglioLocali.test.js
 *
 * Il taglio in due dei file di traduzione, e la sua rete.
 *
 * ─── PERCHÉ SERVE UNA RETE PROPRIO QUI ─────────────────────────────────────
 *
 * Perché il taglio vive in un plugin di `vite.config.js`, e i test importano i
 * file INTERI: nessuno dei 2228 vedrebbe una sezione finita nella metà
 * sbagliata, o in nessuna delle due. Sarebbe verde con l'app rotta — la stessa
 * cecità che `manualChunks` documenta per `it.json`, dove includere una riga
 * in più valeva 23 kB senza che nessun numero della build sembrasse sbagliato.
 *
 * Qui la rete è statica: rilegge le due funzioni del taglio e verifica che
 * insieme restituiscano il file, tutto, senza doppioni.
 *
 * ─── COSA SI ROMPE SE IL TAGLIO SBAGLIA ────────────────────────────────────
 *
 *   una sezione in NESSUNA metà   sparisce dal bundle: nell'app si leggono le
 *                                 chiavi grezze, e nessun test lo vede
 *   `ui` finita nel catalogo      la lingua di ripiego smette di essere un
 *                                 ripiego: se il pacchetto non arriva la
 *                                 pagina diventa illeggibile, che è esattamente
 *                                 la cosa che il guscio esiste per evitare
 */

import { describe, it, expect } from 'vitest'
import en from '../locales/en.json' with { type: 'json' }
import it_ from '../locales/it.json' with { type: 'json' }
import { SEZIONI_CATALOGO, guscio, catalogo } from '../../scripts/sezioni-locale.mjs'

const LINGUE = { en, it: it_ }

describe('il taglio è esaustivo', () => {
  for (const [sigla, locale] of Object.entries(LINGUE)) {
    it(`${sigla}: ogni sezione sta in una metà e in una sola`, () => {
      const tutte = Object.keys(locale).sort()
      const insieme = [...Object.keys(guscio(locale)), ...Object.keys(catalogo(locale))].sort()
      expect(insieme, 'una sezione è finita in tutt\'e due le metà, o in nessuna')
        .toEqual(tutte)
    })

    it(`${sigla}: rimettendo insieme le due metà si riottiene il file`, () => {
      // Il verso forte: non basta che le CHIAVI tornino, devono tornare i
      // valori. Una funzione che restituisse `{}` passerebbe il test sopra
      // insieme all'altra che restituisce tutto.
      expect({ ...guscio(locale), ...catalogo(locale) }).toEqual(locale)
    })
  }
})

describe('il guscio è quello che serve da ripiego', () => {
  it('porta le scritte dell\'interfaccia', () => {
    // Se una di queste finisse nel catalogo, un pacchetto di lingua mancante
    // renderebbe la pagina illeggibile invece che solo brutta.
    const g = guscio(en)
    for (const sezione of ['ui', 'report', 'editor', 'eot', 'aria', 'gap']) {
      expect(g, `«${sezione}» deve restare nel bundle statico`).toHaveProperty(sezione)
    }
  })

  it('NON porta i cataloghi di nomi, che sono il peso', () => {
    const g = guscio(en)
    for (const sezione of SEZIONI_CATALOGO) {
      expect(g, `«${sezione}» è tornato nel bundle statico`).not.toHaveProperty(sezione)
    }
  })

  it('e il guscio pesa una frazione del catalogo', () => {
    // Il numero che giustifica tutta l'operazione, misurato invece che
    // ricordato: se un giorno il guscio si gonfiasse fino a somigliare al
    // catalogo, il taglio avrebbe smesso di valere la pena.
    const peso = (o) => JSON.stringify(o).length
    expect(peso(guscio(en))).toBeLessThan(peso(catalogo(en)) / 3)
  })
})

describe('le due lingue si tagliano allo stesso modo', () => {
  it('stesse sezioni nel guscio, stesse nel catalogo', () => {
    // `i18n.js` posa il catalogo di una lingua SOPRA il guscio inglese. Se le
    // due lingue si tagliassero diversamente, per una resterebbe scoperta una
    // sezione — e si vedrebbe l'inglese in mezzo all'italiano.
    expect(Object.keys(guscio(it_)).sort()).toEqual(Object.keys(guscio(en)).sort())
    expect(Object.keys(catalogo(it_)).sort()).toEqual(Object.keys(catalogo(en)).sort())
  })
})
