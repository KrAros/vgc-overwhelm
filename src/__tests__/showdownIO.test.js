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
import { parseShowdownPaste, teamToShowdown } from '../utils/showdownIO.js'
import { MAX_SP_PER_STAT, MAX_SP_TOTAL } from '../lib/rules.js'
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

/**
 * ─── LA CONVERSIONE SP ⇄ EV ────────────────────────────────────────────────
 *
 * Aggiunti in M. Prima di questi test la conversione non era coperta da NIENTE:
 * cambiare `EV_TO_SP` da `Math.min(32, ev)` a `Math.round(ev/8)` lasciava tutti
 * i 1734 test verdi. Un criterio senza casi che si muovono è un criterio vuoto,
 * quindi la rete si costruisce qui.
 *
 * Il difetto era visibile solo cliccando: incollando un normale 252/4/252
 * l'editor scriveva `(-2/66)` — budget negativo — e lasciava passare.
 */
describe('import Showdown — la conversione EV → SP', () => {
  const conEV = (ev) => `Garchomp @ Life Orb
Ability: Rough Skin
Level: 50
EVs: ${ev}
Jolly Nature
- Protect`

  const sps = (ev) => parseShowdownPaste(conEV(ev)).pokemon[0]?.sps

  it('1 SP vale 8 EV, come dichiara rules.js', () => {
    // [HP, Atk, Def, SpA, SpD, Spe]
    expect(sps('252 HP')[0]).toBe(32)
    expect(sps('100 Atk')[1]).toBe(13)   // 12,5 arrotondato
    expect(sps('8 Def')[2]).toBe(1)
    expect(sps('0 SpA')[3]).toBe(0)
  })

  it('il massimo di Showdown diventa il massimo di Champions', () => {
    // 252/8 fa 31,5: senza arrotondamento un set massimale perderebbe un punto.
    expect(sps('252 Spe')[5]).toBe(MAX_SP_PER_STAT)
  })

  it('i 4 EV di avanzo non valgono più di mezzo punto', () => {
    // Era il caso peggiore del troncamento: 4 EV diventavano 4 SP, cioè 32 EV.
    expect(sps('4 Atk')[1]).toBe(1)
  })

  it('nessuno spread legale in Showdown può sforare il tetto di 66', () => {
    // La proprietà che rende la correzione sicura, e non è una stima:
    // 508 EV fanno 63,5 SP, l'arrotondamento aggiunge al più mezzo punto per
    // statistica — 3 in tutto — quindi il peggior caso è 66,5, cioè 66 su
    // interi. Qui si prova su spread reali, incluso quello che rompeva prima.
    const spread = [
      '252 HP / 4 Atk / 252 SpD',
      '252 HP / 252 Atk / 4 SpD',
      '4 HP / 252 SpA / 252 Spe',
      '252 HP / 124 Def / 124 SpD / 4 Spe',
      '84 HP / 84 Atk / 84 Def / 84 SpA / 84 SpD / 84 Spe',
    ]
    for (const s of spread) {
      const totale = sps(s).reduce((a, b) => a + b, 0)
      expect(totale, `${s} → ${sps(s).join('/')} = ${totale}`).toBeLessThanOrEqual(MAX_SP_TOTAL)
    }
  })

  it('andata e ritorno: esportare e rileggere non sposta gli SP', () => {
    // Il giro si rompeva se si correggeva una sola delle due direzioni:
    // l'export scriveva gli SP grezzi e la rilettura li divideva per otto.
    const originale = parseShowdownPaste(conEV('252 HP / 4 Atk / 252 SpD')).pokemon[0]
    const testo = teamToShowdown([originale])
    const riletto = parseShowdownPaste(testo).pokemon[0]
    expect(riletto.sps).toEqual(originale.sps)
  })

  it('l\'export non produce spread illegali per Showdown', () => {
    // 32 SP varrebbero 256 EV, che in Showdown è oltre il tetto di 252.
    const p = parseShowdownPaste(conEV('252 HP / 252 Atk')).pokemon[0]
    const testo = teamToShowdown([p])
    const valori = [...testo.matchAll(/(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)/g)].map(m => Number(m[1]))
    expect(valori.every(v => v <= 252), testo).toBe(true)
  })
})
