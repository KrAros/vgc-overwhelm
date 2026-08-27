/**
 * src/__tests__/grafiaAbilita.test.js
 *
 * Una grafia sola per le abilità, e la ragione per cui non era un dettaglio.
 *
 * ─── COSA C'ERA ────────────────────────────────────────────────────────────
 *
 * `pokemon.json` scriveva le abilità in due modi. Sessantatré comparivano in
 * ENTRAMBI, su specie diverse: `swift-swim` su Swampert Mega e `swift swim`
 * su Basculegion, `flash-fire` su Arcanine e `flash fire` sull'Arcanine di
 * Hisui — due righe distanti nello stesso listino.
 *
 * Sembrava una bruttura cosmetica. Non lo era.
 *
 * ─── IL DIFETTO ────────────────────────────────────────────────────────────
 *
 * `abilitaPerSpecie` protegge l'app da un'abilità impossibile: normalizza la
 * scelta e la confronta con quelle della specie, e se non c'è ripiega sulla
 * prima. La normalizzazione produce TRATTINI. Quando la lista della specie
 * usava gli spazi, il confronto falliva sempre — e la funzione concludeva che
 * l'abilità non fosse consentita.
 *
 * Misurato prima di correggere: **143 coppie (specie, abilità) su 117 specie**
 * non tornavano se stesse, e NESSUNA era la prima della lista, cioè nessuna
 * era innocua. In 33 casi l'abilità scartata cambiava il danno.
 *
 * Il caso più netto, Frosmoth: l'utente sceglie Scagliegelo, che dimezza il
 * danno speciale. Alla ricarica successiva diventa Schermopolvere, e Palla
 * Ombra passa da **33-39 a 67-79** — il doppio, senza un avviso.
 *
 * E girava su tre percorsi, non uno: il caricamento da localStorage a ogni
 * apertura dell'app, la lettura di un link condiviso, e l'import da Showdown.
 *
 * ─── PERCHE' I TRATTINI ────────────────────────────────────────────────────
 *
 * Non per gusto: è la forma che il resto del progetto usa già. La producono
 * `normalizeAbilityKey` e quindi `ABILITY_EFFECTS`, e le chiavi di traduzione
 * in `it.json` e `en.json`. Nel listino erano già la maggioranza, 1089 contro
 * 300.
 *
 * `abilities.json` resta con gli spazi ed è giusto così: è un catalogo di nomi
 * per l'import da Showdown, non l'anagrafica delle specie, e chi lo legge
 * normalizza prima di confrontare.
 */

import { describe, it, expect } from 'vitest'
import pokemonData from '../data/pokemon.json' with { type: 'json' }
import { abilitaPerSpecie } from '../lib/abilitaSpecie.js'
import { normalizeAbilityKey } from '../data/abilityEffects.js'

const COPPIE = Object.entries(pokemonData)
  .flatMap(([specie, d]) => (d.abilities ?? []).map(a => [specie, a]))

describe('le abilità del listino hanno una grafia sola', () => {
  it('nessuna contiene uno spazio', () => {
    const conSpazio = [...new Set(COPPIE.filter(([, a]) => a.includes(' ')).map(([, a]) => a))]
    expect(conSpazio, 'grafia con lo spazio: `abilitaPerSpecie` non la riconoscerà')
      .toEqual([])
  })

  it('nessuna abilità compare in due grafie diverse', () => {
    // Il controllo che descrive il difetto direttamente, invece che una sua
    // conseguenza: se domani entrasse una terza convenzione — un punto, un
    // trattino basso — il test sopra non se ne accorgerebbe.
    const perForma = {}
    for (const [, a] of COPPIE) (perForma[a.replace(/[ \-_.]/g, '')] ??= new Set()).add(a)
    const doppie = Object.values(perForma).filter(s => s.size > 1).map(s => [...s].join(' ≠ '))
    expect(doppie, 'la stessa abilità scritta in due modi su specie diverse').toEqual([])
  })

  it('la grafia del listino è quella che il motore normalizza', () => {
    // Il legame che rende il resto vero: se `normalizeAbilityKey` cambiasse
    // convenzione, il listino resterebbe indietro e il difetto tornerebbe
    // identico, su tutte le abilità invece che su sessantatré.
    const diverse = [...new Set(COPPIE.map(([, a]) => a))]
      .filter(a => normalizeAbilityKey(a) !== a)
    expect(diverse.slice(0, 8), 'il motore normalizza queste diversamente da come le scrive il listino')
      .toEqual([])
  })
})

describe('l\'abilità scelta non viene buttata via', () => {
  it('ogni abilità di ogni specie torna se stessa', () => {
    // IL TEST CHE CONTA. Gli altri guardano la forma dei dati; questo guarda
    // la conseguenza — che è ciò che l'utente subiva.
    const rotte = COPPIE
      .filter(([s, a]) => abilitaPerSpecie(s, a) !== a)
      .map(([s, a]) => `${s}: «${a}» → «${abilitaPerSpecie(s, a)}»`)
    expect(
      rotte.slice(0, 10),
      'chiedendo un\'abilità che la specie HA se ne ottiene un\'altra: '
      + 'la scelta dell\'utente sparisce a ogni ricaricamento',
    ).toEqual([])
    expect(rotte.length, `${rotte.length} coppie rotte in tutto`).toBe(0)
  })

  it('funziona anche partendo dalla grafia di Showdown', () => {
    // Un paste scrive «Ice Scales», e `findAbilityKey` la trova in
    // abilities.json come `ice scales` CON LO SPAZIO — quel file non è stato
    // normalizzato, di proposito. Il giro deve reggere lo stesso.
    expect(abilitaPerSpecie('frosmoth', 'ice scales')).toBe('ice-scales')
    expect(abilitaPerSpecie('frosmoth', 'Ice Scales')).toBe('ice-scales')
    expect(abilitaPerSpecie('rillaboom', 'grassy surge')).toBe('grassy-surge')
  })

  it('un\'abilità che la specie NON ha ripiega ancora sulla prima', () => {
    // La protezione non deve essersi spenta: era il motivo per cui la funzione
    // esiste. Charizard-Mega-Y con Blaze, che è del Charizard base.
    expect(abilitaPerSpecie('charizard-mega-y', 'blaze'))
      .toBe(pokemonData['charizard-mega-y'].abilities[0])
  })

  it('controllo negativo: si sta guardando davvero qualcosa', () => {
    expect(COPPIE.length, 'nessuna coppia da controllare').toBeGreaterThan(2000)
    expect(pokemonData['frosmoth'].abilities).toContain('ice-scales')
  })
})
