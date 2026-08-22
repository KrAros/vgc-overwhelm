// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/attribuzioneTeam.test.jsx
 *
 * Ogni azione di squadra dice a QUALE squadra appartiene.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * La striscia sopra gli editor aveva due righe: una con l'etichetta della
 * squadra e le levette, una con Importa/Esporta/Cancella **senza etichetta**.
 * A chi appartenesse un bottone lo diceva soltanto la posizione orizzontale.
 *
 * Misurato prima di correggere: sotto i 1280 px l'attribuzione si rompeva del
 * tutto. A 1100 le due etichette TEAM finivano su righe diverse — y=407 e
 * y=441, perché la fila andava a capo — mentre i due gruppi di azioni
 * restavano affiancati sulla stessa riga, y=479 entrambi.
 *
 * E in pagina ci sono QUATTRO «Importa»: due di squadra e due di singolo
 * Pokémon, a 127 px di distanza verticale, con la stessa identica parola.
 *
 * ─── COSA SORVEGLIA ────────────────────────────────────────────────────────
 *
 * Non la posizione, che dipende dalla larghezza e non si può asserire in SSR.
 * Sorveglia la proprietà che rende la posizione irrilevante: **il nome
 * accessibile di ogni azione di squadra contiene il nome della squadra**.
 */

import { describe, it, expect, beforeAll } from 'vitest'

const slot = (key) => ({
  key, moves: ['protect', null, null, null], sps: [4, 4, 4, 4, 4, 4],
  nature: 'adamant', ability: null, item: null,
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {}, lastRespectsKOs: 0,
})
const SQUADRE = {
  team1: ['garchomp', 'incineroar'].map(slot),
  team2: ['gholdengo', 'chi-yu'].map(slot),
}

const memoria = new Map([['vgc-overwhelm-teams', JSON.stringify(SQUADRE)]])
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = globalThis.window || {}
globalThis.window.location = { search: '', origin: 'http://test', pathname: '/' }

let html
beforeAll(async () => {
  const React = (await import('react')).default
  const { renderToStaticMarkup } = await import('react-dom/server')
  await import('../i18n.js')
  const App = (await import('../App.jsx')).default
  html = renderToStaticMarkup(React.createElement(App))
})

/** I `<button>` con la loro aria-label, se ce l'hanno, e il testo visibile. */
function bottoni(markup) {
  return [...markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => ({
    aria: (m[1].match(/aria-label="([^"]*)"/) ?? [])[1] ?? null,
    testo: m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
  }))
}

describe('l’attribuzione delle azioni di squadra', () => {
  it('esistono due gruppi, uno per squadra', () => {
    const gruppi = [...html.matchAll(/role="group" aria-label="(Team [12])"/g)].map(m => m[1])
    expect(gruppi).toEqual(['Team 1', 'Team 2'])
  })

  it('ogni azione di squadra nomina la propria squadra', () => {
    // Le azioni di squadra sono quelle con l'aria-label composta: se una
    // perdesse il suffisso, il suo nome tornerebbe uguale a quello del gemello
    // dell'altra squadra e a quello dei bottoni del singolo Pokémon.
    const conSquadra = bottoni(html).filter(b => b.aria && / — Team [12]$/.test(b.aria))
    expect(conSquadra.length, 'tre azioni per due squadre').toBe(6)
    expect(new Set(conSquadra.map(b => b.aria)).size, 'tutte distinte').toBe(6)
  })

  it('nessuna coppia di azioni di squadra si chiama allo stesso modo', () => {
    // IL CONTROLLO CHE SI MUOVE: senza, il caso sopra passerebbe anche se i
    // sei nomi fossero tutti «Importa — Team 1».
    const conSquadra = bottoni(html).filter(b => b.aria && / — Team [12]$/.test(b.aria))
    const t1 = conSquadra.filter(b => b.aria.endsWith('Team 1')).length
    const t2 = conSquadra.filter(b => b.aria.endsWith('Team 2')).length
    expect([t1, t2]).toEqual([3, 3])
  })

  it('il controllo: la pagina è stata davvero renderizzata', () => {
    // La sonda cieca della sessione L: con un markup vuoto le ricerche
    // tornerebbero liste vuote e due casi su tre passerebbero.
    expect(html.length).toBeGreaterThan(5000)
    expect(bottoni(html).length).toBeGreaterThan(20)
  })
})
