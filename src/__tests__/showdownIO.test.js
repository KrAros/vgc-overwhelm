/**
 * src/__tests__/showdownIO.test.js
 *
 * L'import da una paste Showdown, dal lato che la sessione I ha riparato.
 *
 * ─── IL BUG ────────────────────────────────────────────────────────────────
 * `findPokemonKey` risolveva un nome provando due forme: il minuscolo, e poi
 * gli spazi trasformati in trattini. Funzionava per tutto Gen 1-7, perché lì le
 * chiavi di `pokemon.json` erano già `landorus-therian`. Non funzionava per
 * niente su Gen 8-9, dove le chiavi erano collassate (`fluttermane`): il nome
 * `Flutter Mane` diventava `flutter mane`, poi `flutter-mane`, e nessuna delle
 * due esisteva.
 *
 * Misurato prima di intervenire: **71 specie su 1221 non erano importabili**.
 * Non 71 a caso — Flutter Mane, Chien-Pao, Iron Hands, Calyrex, Urshifu, i tre
 * Ogerpon, i tre Tauros di Paldea: il meta di Reg M-B quasi per intero. Chi
 * incollava un team se ne accorgeva solo leggendo i warning.
 *
 * Il rinomino degli slug ha chiuso il problema alla radice, e questi test
 * impediscono che una futura importazione di dati riapra le due convenzioni.
 */

import { describe, it, expect } from 'vitest'
import { parseShowdownPaste } from '../utils/showdownIO.js'
import pokemonData from '../data/pokemon.json'

/** Costruisce una paste minima con il solo nome. */
const paste = (nome) => `${nome}\nAbility: Levitate\n- Protect`

/** Slug risolto per un nome, o null se l'import l'ha scartato. */
function risolvi(nome) {
  const { pokemon } = parseShowdownPaste(paste(nome))
  return pokemon[0]?.key ?? null
}

describe('import Showdown — le specie del meta Reg M-B', () => {
  // Prima della sessione I ognuna di queste tornava null.
  it.each([
    ['Flutter Mane', 'flutter-mane'],
    ['Chien-Pao', 'chien-pao'],
    ['Iron Hands', 'iron-hands'],
    ['Iron Bundle', 'iron-bundle'],
    ['Raging Bolt', 'raging-bolt'],
    ['Calyrex-Ice', 'calyrex-ice'],
    ['Calyrex-Shadow', 'calyrex-shadow'],
    ['Urshifu-Rapid-Strike', 'urshifu-rapid-strike'],
    ['Ogerpon-Wellspring', 'ogerpon-wellspring'],
    ['Tauros-Paldea-Aqua', 'tauros-paldea-aqua'],
    ['Great Tusk', 'great-tusk'],
    ['Wo-Chien', 'wo-chien'],
  ])('«%s» → %s', (nome, atteso) => {
    expect(risolvi(nome)).toBe(atteso)
  })
})

describe('import Showdown — le specie che funzionavano già', () => {
  // Queste sono il controllo negativo del rinomino: `mr. mime` e `tapu koko`
  // avevano lo spazio nella chiave e venivano trovate dal vecchio codice.
  // Rinominarle senza toccare `findPokemonKey` le avrebbe ROTTE — è la ragione
  // per cui la sessione ha dovuto uscire da `src/data/`.
  it.each([
    ['Mr. Mime', 'mr-mime'],
    ['Mime Jr.', 'mime-jr'],
    ['Tapu Koko', 'tapu-koko'],
    ["Farfetch'd", 'farfetchd'],
    ['Landorus-Therian', 'landorus-therian'],
    ['Incineroar', 'incineroar'],
    ['Charizard-Mega-Y', 'charizard-mega-y'],
  ])('«%s» → %s', (nome, atteso) => {
    expect(risolvi(nome)).toBe(atteso)
  })
})

describe('import Showdown — copertura complessiva', () => {
  it('ogni specie di pokemon.json è raggiungibile dal proprio nome visibile', () => {
    // Il vero criterio della sessione: non «le dodici che ho elencato», ma
    // tutte. Se una futura importazione reintroduce una chiave collassata,
    // questo test la nomina.
    const irraggiungibili = []
    for (const [slug, voce] of Object.entries(pokemonData)) {
      if (!voce.name) continue
      if (risolvi(voce.name) !== slug) irraggiungibili.push(`${voce.name} → ${slug}`)
    }
    expect(irraggiungibili).toEqual([])
  })

  it('un nome inventato viene scartato con un avviso, non fatto passare', () => {
    const { pokemon, warnings } = parseShowdownPaste(paste('Pikablu'))
    expect(pokemon).toHaveLength(0)
    expect(warnings.join(' ')).toContain('Pikablu')
  })
})
