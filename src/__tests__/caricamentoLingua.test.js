// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/caricamentoLingua.test.js
 *
 * Che il catalogo arrivi davvero, e si posi sopra il guscio.
 *
 * ─── PERCHÉ QUESTO TEST ESISTE ─────────────────────────────────────────────
 *
 * `taglioLocali.test.js` verifica che il file sia tagliato bene. Non verifica
 * che le due metà si RIMETTANO INSIEME a runtime, che è il pezzo dove stava il
 * difetto vero.
 *
 * `caricaLingua` chiedeva «questa lingua ce l'ho già?» con
 * `i18n.hasResourceBundle(lingua)`. Con il guscio inglese caricato in partenza
 * la risposta per `en` è SÌ — quindi il catalogo inglese non sarebbe mai
 * arrivato. Il sintomo non sarebbe stato un errore: interfaccia perfetta, e
 * nelle tendine `population bomb` invece di «Population Bomb».
 *
 * Questo file gira nella suite e non nel browser perché vitest usa lo stesso
 * `vite.config.js`, quindi le query `?guscio` e `?catalogo` risolvono qui
 * esattamente come in produzione. È l'unico posto dove il taglio è insieme
 * osservabile e automatico.
 *
 * ─── L'ORDINE DEGLI `it` CONTA ─────────────────────────────────────────────
 *
 * `i18n` è un modulo con stato: una volta caricata una lingua resta caricata.
 * Il primo test guarda quindi lo stato APPENA importato, prima che qualunque
 * altro lo sporchi — ed è per questo che sta per primo e non in fondo.
 */

import { describe, it, expect } from 'vitest'
import i18n, { caricaLingua } from '../i18n.js'

describe('in partenza c\'è il guscio, e basta', () => {
  it('le scritte dell\'interfaccia ci sono già', () => {
    // È la proprietà per cui il guscio resta statico: senza catalogo la
    // pagina è brutta, senza guscio è illeggibile.
    expect(i18n.t('report.damage')).not.toBe('report.damage')
    expect(i18n.t('eot.guaranteed')).not.toBe('eot.guaranteed')
  })

  it('i nomi del catalogo invece ancora no', () => {
    // Il controllo che rende sensato il test dopo: se il catalogo fosse già
    // qui, «arriva col caricamento» non proverebbe niente.
    expect(i18n.t('moves.earthquake')).toBe('moves.earthquake')
    expect(i18n.t('abilities.rough-skin')).toBe('abilities.rough-skin')
  })
})

describe('il catalogo arriva, e si posa sopra il guscio', () => {
  it('l\'inglese carica il PROPRIO catalogo — non lo dà per scontato', () => {
    // Il difetto che questo test esisteva per trovare: con la vecchia
    // condizione `!hasResourceBundle('en')` questa riga restava `moves.earthquake`.
    return caricaLingua('en').then(() => {
      expect(i18n.t('moves.earthquake')).toBe('Earthquake')
      expect(i18n.t('abilities.rough-skin')).toBe('Rough Skin')
      expect(i18n.t('items.life orb')).toBe('Life Orb')
      // E il guscio non è stato sovrascritto dal pacchetto che gli si è posato
      // sopra: `addResourceBundle` con `deep` e `overwrite` a true fonde, non
      // sostituisce. Se sostituisse, qui tornerebbe la chiave grezza.
      expect(i18n.t('report.damage')).not.toBe('report.damage')
    })
  })

  it('l\'italiano porta guscio e catalogo insieme', async () => {
    await caricaLingua('it')
    expect(i18n.language).toBe('it')
    expect(i18n.t('moves.earthquake')).toBe('Terremoto')
    expect(i18n.t('report.damage')).not.toBe('report.damage')
    expect(i18n.t('report.damage')).not.toBe('Damage')
  })

  it('e tornando all\'inglese non si riscarica niente', async () => {
    // `caricaLingua` è idempotente, ed è la ragione per cui `Header.jsx` può
    // chiamarla a ogni cambio lingua senza precauzioni.
    await caricaLingua('en')
    expect(i18n.language).toBe('en')
    expect(i18n.t('moves.earthquake')).toBe('Earthquake')
  })

  it('una lingua che non esiste non rompe niente', async () => {
    await caricaLingua('de')
    // Nessun pacchetto da prendere: si cambia lingua e i18next ripiega
    // sull'inglese, che è il motivo per cui il guscio sta nel bundle.
    expect(i18n.t('report.damage')).not.toBe('report.damage')
  })
})
