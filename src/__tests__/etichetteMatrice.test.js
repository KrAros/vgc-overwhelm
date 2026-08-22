// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/etichetteMatrice.test.js
 *
 * Due Pokémon diversi non possono avere la stessa etichetta nella matrice.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * `formatPokeName` tornava `key.split('-')[0]` per tutto ciò che non è una
 * Mega. Contato sull'anagrafica prima di correggere: **82 etichette valevano
 * per più di una specie, e 212 specie perdevano identità**.
 *
 *   «Iron»     10 specie — Iron Hands, Iron Bundle, Iron Moth, Iron Jugulis…
 *   «Silvally» 18
 *   «Rotom»    6
 *
 * E i Tesori della Rovina diventavano parole italiane per caso: `chi-yu` →
 * «Chi». Nella matrice si leggeva una colonna intitolata «Chi».
 *
 * Non era un caso di nicchia: è il meta di ogni formato recente.
 */

import { describe, it, expect } from 'vitest'
import { formatPokeName, cercaSpecie, ordinaPerRoster, inRosterChampions } from '../utils/nomiPokemon.js'
import pokemonData from '../data/pokemon.json'

const CHIAVI = Object.keys(pokemonData)

describe('le etichette della matrice', () => {
  it('nessuna etichetta vale per due specie diverse', () => {
    const per = new Map()
    for (const k of CHIAVI) {
      const e = formatPokeName(k)
      if (!per.has(e)) per.set(e, [])
      per.get(e).push(k)
    }
    const collisioni = [...per].filter(([, v]) => v.length > 1)
      .map(([e, v]) => `«${e}» → ${v.join(', ')}`)
    expect(collisioni).toEqual([])
  })

  it('i casi che hanno aperto la sessione', () => {
    expect(formatPokeName('chi-yu')).toBe('Chi-Yu')
    expect(formatPokeName('iron-hands')).toBe('Iron Hands')
    expect(formatPokeName('iron-bundle')).toBe('Iron Bundle')
    expect(formatPokeName('flutter-mane')).toBe('Flutter Mane')
    expect(formatPokeName('rotom-wash')).toBe('Rotom-Wash')
  })

  it('le Mega restano compatte, come già approvato guardandole', () => {
    // L'unica abbreviazione che resta, e non è nuova: era già così.
    expect(formatPokeName('charizard-mega-y')).toBe('Charizard M·Y')
    expect(formatPokeName('charizard-mega-x')).toBe('Charizard M·X')
    expect(formatPokeName('scolipede-mega')).toBe('Scolipede Mega')
  })

  it('il controllo: le etichette dicono davvero qualcosa', () => {
    // La sonda cieca della sessione L: se la funzione tornasse la chiave grezza
    // sarebbe iniettiva e passerebbe il primo caso senza risolvere niente.
    expect(formatPokeName('iron-hands')).not.toBe('iron-hands')
    expect(formatPokeName('')).toBe('')
    expect(CHIAVI.filter(k => !formatPokeName(k)).length).toBe(0)
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SESSIONE HH — la ricerca delle specie ignora i segni
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Confrontava la query con lo SLUG e basta. Le chiavi usano il trattino,
 * quindi scrivere uno spazio dava **zero risultati**: «iron h» → 0,
 * «flutter m» → 0, «chi y» → 0. Sono 241 le specie con la chiave composta, e
 * 31 quelle il cui nome contiene uno spazio — i Paradosso, i Tapu, Mr. Mime.
 *
 * E il nome vero non veniva guardato: `Type: Null` si trovava solo scrivendo
 * `type-null`.
 */
describe('la ricerca delle specie', () => {
  const trova = (q) => CHIAVI.filter(k => cercaSpecie(k, q))

  it.each([
    ['iron h', 'iron-hands'],
    ['iron hands', 'iron-hands'],
    ['flutter m', 'flutter-mane'],
    ['chi y', 'chi-yu'],
    ['mr mime', 'mr-mime'],
    ['type null', 'type-null'],
    ['rotom wash', 'rotom-wash'],
  ])('«%s» trova %s', (q, atteso) => {
    expect(trova(q)).toContain(atteso)
  })

  it('lo stesso nome scritto col trattino continua a funzionare', () => {
    // Il controllo all'indietro: la correzione non doveva rompere chi già
    // scriveva la chiave esatta.
    for (const k of ['iron-hands', 'chi-yu', 'rotom-wash', 'garchomp'])
      expect(trova(k)).toContain(k)
  })

  it('il controllo: non trova tutto', () => {
    // Senza, i casi sopra passerebbero anche se la funzione tornasse sempre
    // `true` — è la sonda cieca della sessione L.
    expect(trova('zzzznonesiste')).toEqual([])
    expect(trova('').length).toBe(0)
    expect(trova('iron h').length).toBeLessThan(20)
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SESSIONE HH — le specie di Champions vengono prima
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'anagrafica ha 1221 specie, Champions molte meno, e la ricerca mostrava i
 * primi 20 in ordine alfabetico. Il registro `rosterChampions.json` — sondato
 * pagina per pagina, con un controllo che distingue — dice quali conosce la
 * fonte: 298 dentro, 923 fuori.
 *
 * ─── PERCHÉ ORDINA E BASTA ─────────────────────────────────────────────────
 *
 * È **una fonte sola** e ha falsi negativi dimostrati: `basculegion-f` dentro
 * e `basculegion-m` fuori, perché la fonte la chiama `basculegion`. Filtrare
 * nasconderebbe specie che il gioco ha; etichettare direbbe una cosa falsa con
 * sicurezza. Ordinare non afferma niente.
 */
describe('l’ordinamento per roster', () => {
  it('a parità di ricerca, chi è nel roster viene prima', () => {
    const risultati = ordinaPerRoster(CHIAVI.filter(k => cercaSpecie(k, 'char')))
    const primoFuori = risultati.findIndex(k => !inRosterChampions(k))
    const ultimoDentro = risultati.map(k => inRosterChampions(k)).lastIndexOf(true)
    expect(primoFuori === -1 || ultimoDentro < primoFuori, 'nessun «fuori» prima di un «dentro»').toBe(true)
  })

  it('l’ordine alfabetico resta dentro ciascun gruppo', () => {
    const r = ordinaPerRoster(CHIAVI.filter(k => cercaSpecie(k, 'char')))
    const dentro = r.filter(inRosterChampions)
    expect(dentro).toEqual([...dentro].sort((a, b) => a.localeCompare(b)))
  })

  it('il controllo: il registro divide davvero in due', () => {
    // Senza, i casi sopra passerebbero anche con un registro vuoto o completo:
    // in entrambi i casi «tutti dentro» o «tutti fuori» soddisfa l'ordinamento.
    const dentro = CHIAVI.filter(inRosterChampions).length
    expect(dentro).toBeGreaterThan(100)
    expect(dentro).toBeLessThan(CHIAVI.length - 100)
  })

  it('non perde nessun risultato: ordina, non filtra', () => {
    // La proprietà che rende sicura la scelta. Se un giorno diventasse un
    // filtro, questo test lo direbbe.
    const trovati = CHIAVI.filter(k => cercaSpecie(k, 'char'))
    expect(ordinaPerRoster(trovati).length).toBe(trovati.length)
    expect([...ordinaPerRoster(trovati)].sort()).toEqual([...trovati].sort())
  })
})
