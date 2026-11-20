// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/controlBar.test.jsx
 *
 * `ControlBar.jsx` era al 31%. Il componente ha DUE alberi — uno per lo
 * schermo largo (`hidden sm:block`) e uno per il telefono — con le stesse
 * azioni scritte due volte. Quel che si sorveglia qui è che le due copie non
 * divergano e che ogni controllo abbia un nome per chi non vede lo schermo.
 *
 * ─── COSA SORVEGLIA ────────────────────────────────────────────────────────
 *
 *   · ogni pulsante ha un nome accessibile (testo o `aria-label`);
 *   · i modificatori di Team 1 e Team 2 sono gli stessi dodici, nello stesso
 *     ordine, e quelli del telefono sono gli stessi del desktop;
 *   · i toggle dichiarano il proprio stato con `aria-pressed`, e a stato
 *     iniziale nessun modificatore è attivo;
 *   · Importa / Esporta / Cancella sono distinguibili per team a chi usa uno
 *     screen reader («Importa — Team 1», non «Importa» due volte).
 *
 * Non copre: il click (Importa, Esporta, Condividi, Libreria team, i toggle),
 * che richiede un DOM — vedi `modals.test.jsx` per il perché non c'è jsdom.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { caricaLingua } from '../i18n.js'
import ControlBar from '../components/ControlBar.jsx'

beforeAll(() => caricaLingua('it'))

const html = () => renderToStaticMarkup(<ControlBar />)

const bottoni = (h) => [...h.matchAll(/<button([^>]*)>(.*?)<\/button>/gs)].map(m => {
  const attr = (n) => m[1].match(new RegExp(` ${n}="([^"]*)"`))?.[1]
  return {
    ariaLabel: attr('aria-label'),
    pressed: attr('aria-pressed'),
    testo: m[2].replace(/<[^>]+>/g, '').trim(),
  }
})
const nome = (b) => b.ariaLabel || b.testo

/** Il markup fra l'apertura di un gruppo con quell'`aria-label` e il successivo. */
function gruppo(h, etichetta) {
  const i = h.indexOf(`role="group" aria-label="${etichetta}"`)
  expect(i, `gruppo «${etichetta}»`).toBeGreaterThan(-1)
  // Finisce al gruppo successivo o, per l'ultimo, prima di «Solo KO» (che sta
  // fuori dai gruppi di squadra): altrimenti la fetta includerebbe anche l'albero
  // del telefono e il confronto fra squadre sarebbe sbagliato per costruzione.
  const fine = [h.indexOf('role="group"', i + 10), h.indexOf('Solo KO', i)]
    .filter(k => k > -1)
  return h.slice(i, Math.min(...fine))
}

describe('struttura', () => {
  it('ha il gruppo dei modificatori e un gruppo per squadra', () => {
    const h = html()
    expect(h).toContain('role="group" aria-label="Modificatori e azioni del team"')
    expect(h).toContain('role="group" aria-label="Team 1"')
    expect(h).toContain('role="group" aria-label="Team 2"')
  })

  it('c\'è parecchio da guardare (altrimenti i controlli sotto non verificano niente)', () => {
    expect(bottoni(html()).length).toBeGreaterThan(40)
  })
})

describe('nomi accessibili', () => {
  it('ogni pulsante ha un nome', () => {
    const senza = bottoni(html()).filter(b => !nome(b))
    expect(senza).toEqual([])
  })
})

describe('modificatori', () => {
  const toggle = (h) => bottoni(h).filter(b => b.pressed !== undefined)

  it('nessuno è attivo a stato iniziale', () => {
    const attivi = toggle(html()).filter(b => b.pressed !== 'false')
    expect(attivi).toEqual([])
  })

  it('Team 1 e Team 2 hanno gli stessi dodici, nello stesso ordine', () => {
    const h = html()
    const t1 = toggle(gruppo(h, 'Team 1')).map(nome)
    const t2 = toggle(gruppo(h, 'Team 2')).map(nome)
    expect(t1).toHaveLength(12)
    expect(t2).toEqual(t1)
    expect(new Set(t1).size).toBe(12)
  })

  it('il telefono ha gli stessi modificatori del desktop', () => {
    const h = html()
    const desktop = toggle(gruppo(h, 'Team 1')).map(nome)
    const telefono = toggle(h).filter(b => b.ariaLabel).map(nome)
    // Il telefono ripete i dodici per ciascuna squadra.
    for (const n of desktop) expect(telefono).toContain(n)
  })
})

describe('azioni per squadra', () => {
  it('Importa, Esporta e Cancella si distinguono per team', () => {
    const nomi = bottoni(html()).map(nome)
    for (const azione of ['Importa', 'Esporta', 'Cancella'])
      for (const team of ['Team 1', 'Team 2'])
        expect(nomi).toContain(`${azione} — ${team}`)
  })

  it('ci sono anche Solo KO, Libreria team e Condividi', () => {
    const nomi = bottoni(html()).map(nome)
    for (const n of ['Solo KO', 'Libreria team', 'Condividi']) expect(nomi).toContain(n)
  })
})
