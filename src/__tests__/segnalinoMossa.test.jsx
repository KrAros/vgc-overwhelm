// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/segnalinoMossa.test.jsx
 *
 * Il segnalino «non calcolata» sulla riga della mossa.
 *
 * ─── PERCHÉ QUESTO ARRIVA DOPO GLI ALTRI DUE, E SERVIVA PRIMA ──────────────
 *
 * Il badge esisteva per le abilità e per gli strumenti, e in tutt'e due i casi
 * avvisa su un numero che c'è ed è sbagliato di un moltiplicatore. Sulle mosse
 * non c'era, e lì il numero non c'è affatto: la matrice disegna `~`, che è
 * esattamente come disegna Protect.
 *
 * Ventidue mosse che il riferimento calcola si presentavano quindi come mosse
 * di stato, senza nessun avviso. Era l'unico divario del progetto interamente
 * silenzioso.
 *
 * ─── IL CONFINE, LO STESSO DI `svuotaCampi.test.jsx` ───────────────────────
 *
 * Niente jsdom: si rende in SSR e si guarda il markup. Qui si verifica CHE il
 * segnalino ci sia, con che nome accessibile, e che sparisca dove non serve —
 * non come si comporta al passaggio del mouse.
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MoveSearch } from '../components/editor/SearchSelects.jsx'
import { elencoGap } from '../lib/gap.js'
import i18n from '../i18n.js'

const rendi = (value) =>
  renderToStaticMarkup(<MoveSearch value={value} onChange={() => {}} placeholder="—" />)

/** Vero se il markup contiene un elemento con `role="note"`. */
const haSegnalino = (html) => /role="note"/.test(html)

/**
 * Il nome accessibile del segnalino, se c'è.
 *
 * Le entità HTML vanno sciolte: la frase inglese contiene un apostrofo, che
 * nel markup SSR esce `&#x27;`. Confrontarla senza scioglierle darebbe un test
 * che fallisce in inglese e passa in italiano — cioè un test sull'ortografia
 * della lingua invece che sul componente.
 */
const nomeAccessibile = (html) => {
  const grezzo = html.match(/role="note" aria-label="([^"]*)"/)?.[1]
  if (grezzo === undefined) return null
  return grezzo
    .replace(/&#x27;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

describe('il segnalino sulla mossa', () => {
  it('compare su una mossa del divario', () => {
    expect(haSegnalino(rendi('counter'))).toBe(true)
    expect(haSegnalino(rendi('crush grip'))).toBe(true)
  })

  it('non compare su una mossa che calcoliamo', () => {
    // Il controllo che si muove: senza, «compare dove serve» passerebbe anche
    // con un segnalino sempre acceso.
    expect(haSegnalino(rendi('earthquake'))).toBe(false)
    expect(haSegnalino(rendi('seismic toss'))).toBe(false)
  })

  it('né su una mossa di stato, né a campo vuoto', () => {
    // Protect è il confronto che dà il nome a tutta questa storia: si disegna
    // `~` come le ventidue, e a differenza loro `~` è la verità.
    expect(haSegnalino(rendi('protect'))).toBe(false)
    expect(haSegnalino(rendi(null))).toBe(false)
  })

  it('e dice perché, non solo che', () => {
    // Il glifo ⚠ da solo non direbbe niente. È la stessa regola per cui la X
    // che svuota un campo ha dovuto prendersi un nome.
    //
    // Le due frasi si leggono da `i18n` e non si scrivono qui: la lingua di
    // questa suite è l'inglese, e un letterale italiano proverebbe solo di che
    // umore era chi ha scritto il test.
    const nome = nomeAccessibile(rendi('counter'))
    expect(nome).toContain(i18n.t('gap.badge'))
    expect(nome).toContain(i18n.t('gap.spiegazioneMossa'))
    // La ragione, non solo l'avviso: la frase nomina il `~` della matrice.
    expect(i18n.t('gap.spiegazioneMossa')).toContain('~')
  })

  it('la frase è quella delle mosse, non quella delle abilità', () => {
    // `BadgeNonCalcolata` sceglie la chiave dal `tipo`. Con un `tipo` non
    // riconosciuto ricadrebbe sulla frase delle abilità — e la riga direbbe
    // «questa abilità» sopra una mossa, che è il difetto che questo caso
    // esiste per vedere.
    expect(i18n.t('gap.spiegazioneMossa')).not.toBe(i18n.t('gap.spiegazioneAbilita'))
    expect(nomeAccessibile(rendi('counter'))).not.toContain(i18n.t('gap.spiegazioneAbilita'))
  })

  it('tutte e ventidue le mosse della lista lo mostrano', () => {
    // Il segnalino legge `mossaNonCalcolata`, che normalizza le chiavi. Un
    // nome con l'apostrofo o col trattino che non trovasse il suo badge
    // resterebbe silenzioso proprio come prima.
    const senza = elencoGap.mosse.filter(m => !haSegnalino(rendi(m)))
    expect(senza).toEqual([])
  })
})
