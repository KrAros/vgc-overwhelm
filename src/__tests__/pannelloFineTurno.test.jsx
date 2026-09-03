// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/pannelloFineTurno.test.jsx
 *
 * Che le voci di fine turno arrivino DAVVERO sullo schermo.
 *
 * ─── PERCHÉ SERVIVA, E PERCHÉ NON C'ERA ────────────────────────────────────
 *
 * `fineTurno.test.js` prova la libreria: le frazioni, le condizioni, la somma,
 * il conteggio dei turni al KO, la stringa Smogon. Tutto vero, e tutto
 * invisibile all'utente se il pannello non le disegna.
 *
 * Del pannello non esisteva nessun test che lo montasse — è il file più grande
 * del progetto e nessuno lo aveva mai eseguito. Finché le voci erano due
 * scritte a mano si poteva anche non accorgersene; adesso sono sette e vengono
 * da una lista, e una lista può arrivare vuota in silenzio.
 *
 * ─── PERCHÉ `MoveCard` E NON `ReportPanel` ─────────────────────────────────
 *
 * Il pannello intero il meteo lo legge dallo store, e questa suite non ha
 * jsdom: si rende in SSR, e lì Zustand serve lo stato INIZIALE — `setState`
 * prima del render non si vede. Provato, e il primo abbozzo di questo file
 * chiedeva la sabbia e otteneva una catena senza sabbia.
 *
 * `MoveCard` il campo lo riceve come proprietà, ed è il pezzo che disegna la
 * catena. È stata esportata per questo, con la ragione scritta accanto.
 *
 * ─── LA LINGUA, E UN'ALTRA COSA IMPARATA QUI ───────────────────────────────
 *
 * I nomi delle abilità stanno in un CATALOGO che l'app carica a parte —
 * `i18n.js` lo spiega: il guscio è nel bundle, i cataloghi no, e valgono 19,7
 * kB gzip. Un test che non aspetta `caricaLingua` vede `t('abilities.ice-body')`
 * ricadere sullo slug, e leggerebbe «ice-body» dove l'utente legge «Ice Body».
 *
 * La prima stesura di questo file non lo aspettava, e chiedeva «Ice Body»
 * ottenendo «ice-body»: sembrava che il pannello non disegnasse niente. Non
 * era così, ed è il motivo per cui il `beforeAll` qui sotto esiste.
 *
 * Le etichette attese sono quindi quelle inglesi — «Ice Body», non
 * «Corpogelo» — perché in test la lingua è l'inglese.
 *
 * ─── COSA COPRE E COSA NO, DICHIARATO ──────────────────────────────────────
 *
 * Copre: che il nome della voce, il suo segno e i suoi PS compaiano nel
 * markup. NON copre: che stiano nel posto giusto, che l'icona si veda, che su
 * telefono la catena vada a capo. Quello resta materiale da occhio, come lo
 * skip link di `accessibilita.test.jsx`.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MoveCard } from '../components/ReportPanel'
import { calculateDamage } from '../calcEngine'
import { buildAttackerInput, buildDefenderInput } from '../lib/battleState'
import { caricaLingua } from '../i18n'

const slot = (key, extra = {}) => ({
  key, ability: null, moves: [null, null, null, null], sps: [0, 0, 0, 0, 0, 0],
  nature: null, item: null, status: null,
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {}, lastRespectsKOs: 0,
  ...extra,
})

// Garchomp con Morso su Walrein: 22-27%, cioè quattro turni. Il pannello
// disegna la catena del fine turno solo quando il KO non è immediato.
const ATT = slot('garchomp', { moves: ['crunch', null, null, null] })
const MOSSA = 'crunch'

const disegna = (def, meteo) => {
  const field = meteo ? { weather: meteo } : {}
  const result = calculateDamage({
    attacker: buildAttackerInput(ATT),
    defender: buildDefenderInput(def),
    move: MOSSA, field,
  })
  return renderToStaticMarkup(
    <MoveCard atk={ATT} def={def} move={MOSSA} result={result} field={field} onClose={() => {}} />)
}

beforeAll(() => caricaLingua('en'))

describe('il pannello disegna le voci di fine turno', () => {
  it('il caso di controllo: senza niente, nessuna voce', () => {
    // Senza questo, i test qui sotto passerebbero anche se il pannello
    // scrivesse sempre tutto.
    const html = disegna(slot('walrein'), null)
    expect(html).not.toContain('Ice Body')
    expect(html).not.toContain('Leftovers')
    expect(html).not.toContain('Sandstorm')
  })

  it('Ice Body sotto la neve: il nome e i PS, col segno giusto', () => {
    const html = disegna(slot('walrein', { ability: 'ice-body' }), 'snow')
    expect(html).toContain('Ice Body')
    expect(html).toMatch(/\+\d+ HP/)
  })

  it('Solar Power sotto il sole: il segno è quello opposto', () => {
    const html = disegna(slot('walrein', { ability: 'solar-power' }), 'sun')
    expect(html).toContain('Solar Power')
    expect(html).toMatch(/−\d+ HP/)
  })

  it('Poison Heal sull\'avvelenato, che non guarda il meteo', () => {
    const html = disegna(
      slot('walrein', { ability: 'poison-heal', status: 'badly-poisoned' }), null)
    expect(html).toContain('Poison Heal')
  })

  it('Rain Dish sotto la Pioggia Intensa, non solo sotto la pioggia', () => {
    const html = disegna(slot('walrein', { ability: 'rain-dish' }), 'heavy rain')
    expect(html).toContain('Rain Dish')
  })

  it('l\'Utility Umbrella la spegne, e la catena torna vuota', () => {
    const html = disegna(
      slot('walrein', { ability: 'rain-dish', item: 'utility umbrella' }), 'rain')
    expect(html).not.toContain('Rain Dish')
  })

  it('le vecchie voci ci sono ancora, e insieme alle nuove', () => {
    // La prova che il passaggio a lista non ha perso per strada sabbia e
    // Avanzi: sono le due che c'erano prima, scritte a mano.
    const html = disegna(slot('walrein', { ability: 'ice-body', item: 'leftovers' }), 'snow')
    expect(html).toContain('Ice Body')
    expect(html).toContain('Leftovers')
  })

  it('sotto la sabbia il difensore la subisce', () => {
    const html = disegna(slot('walrein'), 'sand')
    expect(html).toContain('Sandstorm')
  })

  it('e Magic Guard la toglie', () => {
    const html = disegna(slot('walrein', { ability: 'magic-guard' }), 'sand')
    expect(html).not.toContain('Sandstorm')
  })
})
