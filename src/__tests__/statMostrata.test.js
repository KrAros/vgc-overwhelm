// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/statMostrata.test.js
 *
 * La colonna «Mod»: quanto vale una statistica con tutto quello che il Pokémon
 * ha addosso.
 *
 * ─── LA REGOLA CHE QUESTO FILE DIFENDE ─────────────────────────────────────
 *
 * Chiesta da Simone: di un'abilità che potenzia una statistica si deve SEMPRE
 * poter leggere il NUOVO VALORE, non solo vederne l'effetto nel danno. Chi
 * costruisce un set decide su quel numero.
 *
 * ─── COS'ERA ROTTO ─────────────────────────────────────────────────────────
 *
 * `StatRow` si calcolava la colonna da sé, e sapeva meno di quanto sapesse
 * l'app: applicava il ×2 delle abilità meteo e quello di Tailwind, e basta.
 * A due centimetri di distanza `calcEffectiveSpe` — usata per l'ordine di
 * velocità nella stessa schermata — conosceva anche Choice Scarf, Iron Ball,
 * Macho Brace, Surge Surfer e il ×1.5 del paradosso.
 *
 * E di tutto quello che non è Velocità non mostrava NIENTE: Huge Power,
 * Fur Coat, Gorilla Tactics, il ×1.3 delle abilità paradosso, il +1 di
 * Rapidascesa quando ha messo KO, l'Intrepid Sword. Il motore li applicava al
 * danno, e il numero non compariva da nessuna parte.
 *
 * ─── IL TEST CHE VALE PIÙ DEGLI ALTRI ──────────────────────────────────────
 *
 * L'ultimo blocco. Non controlla che il numero sia «giusto» secondo un conto
 * rifatto a mano — sarebbe una terza copia della formula, cioè il difetto che
 * stiamo togliendo. Controlla che sia lo STESSO numero che il motore ha usato
 * per calcolare il danno, letto dal suo log di debug.
 *
 * Se un giorno la colonna e il motore divergono, quel test diventa rosso senza
 * che nessuno debba accorgersene guardando lo schermo.
 */

import { describe, it, expect } from 'vitest'
import { statMostrata } from '../lib/statMostrata.js'
import { calculateDamage } from '../calcEngine.js'
import { emptyPokemon } from '../store/useCalcStore.js'
import { calcStat } from '../lib/stats.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }
import { STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPE } from '../lib/rules.js'

/** Uno slot dello store, con quello che serve e niente di inventato. */
const slot = (key, extra = {}) => ({
  ...emptyPokemon(),
  key,
  sps: extra.sps ?? [0, 0, 0, 0, 0, 0],
  nature: extra.nature ?? null,
  ability: extra.ability ?? (pokemonData[key]?.abilities?.[0] ?? null),
  item: extra.item ?? null,
  ...extra,
})

const grezza = (key, statIdx, sps = [0, 0, 0, 0, 0, 0], nature = null) =>
  calcStat(pokemonData[key].stats[statIdx], sps[statIdx], 50, nature, statIdx)

// ═══════════════════════════════════════════════════════════════════════════
// 1. I moltiplicatori che appartengono al Pokémon
// ═══════════════════════════════════════════════════════════════════════════

describe('i moltiplicatori del Pokémon compaiono nella colonna', () => {
  it('Huge Power raddoppia l\'Attacco', () => {
    const s = slot('azumarill', { ability: 'huge-power' })
    const r = statMostrata(s, STAT_ATT)
    expect(r.modificata).toBe(true)
    expect(r.effettiva).toBe(r.grezza * 2)
  })

  it('Pure Power anche', () => {
    const s = slot('medicham', { ability: 'pure-power' })
    expect(statMostrata(s, STAT_ATT).effettiva).toBe(grezza('medicham', STAT_ATT) * 2)
  })

  it('e non tocca l\'Att. Speciale', () => {
    const s = slot('azumarill', { ability: 'huge-power' })
    const r = statMostrata(s, STAT_SPA)
    expect(r.modificata).toBe(false)
    expect(r.effettiva).toBe(r.grezza)
  })

  it('Fur Coat raddoppia la Difesa', () => {
    const s = slot('furfrou', { ability: 'fur-coat' })
    const r = statMostrata(s, STAT_DEF)
    expect(r.effettiva).toBe(r.grezza * 2)
  })

  it('Gorilla Tactics dà ×1.5 all\'Attacco', () => {
    // Nessuna specie del dex la porta (vedi `moltiplicatori.test.js`): qui si
    // forza, perché la colonna deve saperla mostrare il giorno che arriva.
    const s = slot('incineroar', { ability: 'gorilla-tactics' })
    const r = statMostrata(s, STAT_ATT)
    expect(r.effettiva).toBeGreaterThan(r.grezza)
    expect(r.effettiva / r.grezza).toBeCloseTo(1.5, 1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Le abilità paradosso, che scelgono la statistica
// ═══════════════════════════════════════════════════════════════════════════

describe('Protosynthesis e Quark Drive potenziano la più alta', () => {
  it('col sole la statistica più alta sale', () => {
    const s = slot('flutter-mane', { ability: 'protosynthesis' })
    const spento = statMostrata(s, STAT_SPA, { meteo: null })
    const acceso = statMostrata(s, STAT_SPA, { meteo: 'sun' })
    expect(spento.modificata).toBe(false)
    expect(acceso.effettiva).toBeGreaterThan(spento.effettiva)
  })

  it('senza il sole non succede niente', () => {
    const s = slot('flutter-mane', { ability: 'protosynthesis' })
    expect(statMostrata(s, STAT_SPA, { meteo: 'rain' }).modificata).toBe(false)
  })

  it('la Booster Energy la accende senza meteo', () => {
    const s = slot('flutter-mane', { ability: 'protosynthesis', item: 'booster energy' })
    expect(statMostrata(s, STAT_SPA, { meteo: null }).modificata).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. I gradi che vengono dalle abilità
// ═══════════════════════════════════════════════════════════════════════════

describe('gli stadi che l\'utente non ha messo a mano', () => {
  it('Intrepid Sword: +1 all\'Attacco, sempre', () => {
    const s = slot('zacian', { ability: 'intrepid-sword' })
    const r = statMostrata(s, STAT_ATT)
    // +1 grado è ×1.5 arrotondato per difetto.
    expect(r.effettiva).toBe(Math.floor(r.grezza * 1.5))
  })

  it('Rapidascesa: +1 alla più alta, ma solo quando ha messo KO', () => {
    const spento = slot('eelektross-mega', { ability: 'eelevate' })
    const acceso = slot('eelektross-mega', {
      ability: 'eelevate',
      abilityFlags: { ...emptyPokemon().abilityFlags, eelevateKOActive: true },
    })
    // Qual è la più alta lo decide la preparazione, non questo test: si guarda
    // che UNA delle cinque si muova, e che senza l'interruttore nessuna lo faccia.
    const statistiche = [STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPE]
    const mosseSpento = statistiche.filter(i => statMostrata(spento, i).modificata)
    const mosseAcceso = statistiche.filter(i => statMostrata(acceso, i).modificata)
    expect(mosseSpento).toEqual([])
    expect(mosseAcceso.length, 'l\'interruttore non muove niente nella colonna')
      .toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. La Velocità, cioè la contraddizione che c'era
// ═══════════════════════════════════════════════════════════════════════════

describe('la Velocità sa quello che sapeva già l\'ordine di velocità', () => {
  it('lo Choice Scarf compare — prima no', () => {
    // È il caso che rende visibile il difetto: la vecchia colonna applicava
    // solo meteo e Tailwind, quindi con lo Scarf mostrava «—» mentre l'ordine
    // di velocità, nella stessa schermata, sapeva del ×1.5.
    const senza = slot('incineroar', { item: null })
    const con   = slot('incineroar', { item: 'choice scarf' })
    expect(statMostrata(senza, STAT_SPE).modificata).toBe(false)
    const r = statMostrata(con, STAT_SPE)
    expect(r.modificata, 'lo Choice Scarf non compare nella colonna').toBe(true)
    expect(r.effettiva).toBeGreaterThan(r.grezza)
  })

  it('l\'Iron Ball dimezza, e si vede', () => {
    const s = slot('incineroar', { item: 'iron ball' })
    const r = statMostrata(s, STAT_SPE)
    expect(r.modificata).toBe(true)
    expect(r.effettiva).toBeLessThan(r.grezza)
  })

  it('le abilità meteo raddoppiano sotto il loro meteo', () => {
    const s = slot('stoutland', { ability: 'sand rush' })
    expect(statMostrata(s, STAT_SPE, { meteo: null }).modificata).toBe(false)
    const r = statMostrata(s, STAT_SPE, { meteo: 'sand' })
    expect(r.effettiva).toBe(r.grezza * 2)
  })

  it('Tailwind pure', () => {
    const s = slot('incineroar')
    const r = statMostrata(s, STAT_SPE, { tailwind: true })
    expect(r.effettiva).toBe(r.grezza * 2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Gli HP non hanno niente, e la colonna non deve inventarlo
// ═══════════════════════════════════════════════════════════════════════════

describe('la riga degli HP resta ferma', () => {
  it('nessuna abilità di questo gruppo la tocca', () => {
    for (const ab of ['huge-power', 'fur-coat', 'protosynthesis', 'eelevate']) {
      const r = statMostrata(slot('azumarill', { ability: ab }), 0, { meteo: 'sun' })
      expect(r.modificata, `${ab} muove gli HP`).toBe(false)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. IL TEST CHE CONTA: la colonna dice il numero che il motore ha usato
// ═══════════════════════════════════════════════════════════════════════════

describe('la colonna e il motore dicono lo stesso numero', () => {
  /**
   * Il log di debug del motore scrive la statistica d'attacco che ha davvero
   * usato: `⚔️  Stat attacco: 246 (base …)`. Confrontare la colonna con quella
   * riga è l'unica verifica che non sia una terza copia della formula.
   */
  const statDalMotore = (attacker, defender, move, field = {}) => {
    const r = calculateDamage({ attacker, defender, move, field, debug: true })
    const riga = r.log.find(x => x && x.includes('Stat attacco'))
    return parseInt(riga.match(/Stat attacco:\s*(\d+)/)[1], 10)
  }

  /**
   * ─── PERCHÉ C'È UN CASO COL ×1.3 ─────────────────────────────────────────
   *
   * Perché senza, l'arrotondamento non è osservabile. `pokeRound` è
   * `n % 1 > 0.5 ? ceil : floor`: differisce da un `floor` secco SOLO quando
   * la parte decimale supera un mezzo. Con ×2 il risultato è esatto e con
   * ×1.5 la parte decimale vale esattamente 0,5 — che `pokeRound` arrotonda
   * per difetto come farebbe `floor`.
   *
   * Misurato: sostituendo `pokeRound` con `Math.floor` in `statMostrata`, con
   * i soli casi ×2 e ×1.5 non diventava rosso niente. Il ×1.3 delle abilità
   * paradosso (0x14CD, cioè 1,30005…) produce parti decimali qualunque, e
   * rende la differenza visibile.
   */
  const casi = [
    ['Huge Power',      'azumarill',    'huge-power',      'play rough',  {}, STAT_ATT],
    ['Pure Power',      'medicham',     'pure-power',      'drain punch', {}, STAT_ATT],
    ['Gorilla Tactics', 'incineroar',   'gorilla-tactics', 'knock off',   {}, STAT_ATT],
    ['nessuna abilità', 'incineroar',   null,              'knock off',   {}, STAT_ATT],
    ['Protosynthesis al sole — il caso che vede l\'arrotondamento',
      'flutter-mane', 'protosynthesis', 'moonblast', { weather: 'sun' }, STAT_SPA],
  ]

  for (const [nome, specie, abilita, mossa, campo, statIdx] of casi) {
    it(`${nome}: la colonna combacia col motore`, () => {
      const s = slot(specie, { ability: abilita })
      const attacker = {
        atkPokemon: specie, atkSPs: s.sps, atkNature: null,
        atkAbility: abilita, atkItem: null, level: 50,
      }
      const defender = {
        defPokemon: 'incineroar', defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
        defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
      }
      expect(statMostrata(s, statIdx, { meteo: campo.weather ?? null }).effettiva)
        .toBe(statDalMotore(attacker, defender, mossa, campo))
    })
  }
})
