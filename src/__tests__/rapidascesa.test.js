// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/rapidascesa.test.js
 *
 * Rapidascesa (`eelevate`): l'immunità alle mosse Terra.
 *
 * ─── IL TERZO BUCO DEL REGISTRO, E UNA PREMESSA CHE ERA FALSA ──────────────
 *
 * La sessione è partita da questa convinzione: «Rapidascesa esiste solo in
 * Champions, NCP non la conosce, quindi non c'è divergenza da misurare e non
 * può entrare nelle 108 per costruzione». Sembrava un limite vero del
 * registro, di natura diversa da quello delle aure.
 *
 * È falsa. NCP la conosce e la implementa, in due punti:
 *
 *     damage_MASTER.js:1112   immunityChecks — ['Levitate','Eelevate']
 *     damage_MASTER.js:1298   pIsGrounded    — ['Levitate','Eelevate']
 *
 * Un oracolo c'è, ed è quello che questo file usa. La verifica è roll per
 * roll come per le aure, non «per conseguenza».
 *
 * ─── ALLORA PERCHÉ NON ERA NELLE 108 ───────────────────────────────────────
 *
 * Per un terzo motivo ancora, diverso da quello delle aure. Le aure il
 * generatore non le ha viste per come LEGGE il codice del riferimento. Questa
 * non l'ha vista perché non era nel suo UNIVERSO: `gen-gap-noti.mjs` enumera
 * le abilità di `abilities.json`, e `abilities.json` non aveva la riga —
 * mentre `pokemon.json` la assegnava a `eelektross-mega` da sempre, e due set
 * del meta la usano.
 *
 * Cioè: un'abilità che l'utente poteva già scegliere nella tendina (che si
 * disegna da `pokemon.json`) era invisibile al registro che dovrebbe
 * dichiarare cosa non calcoliamo.
 *
 * Misurato, e vale la pena avere il numero: con la riga nel listino e senza
 * l'effetto nel motore, `npm run gap:report` la trova subito — 108 → 109,
 * canale STR, prova `damage_MASTER.js:1298`. Non era un limite del registro:
 * era un buco nel suo elenco d'ingresso.
 *
 * ─── LA SECONDA METÀ NON È IMPLEMENTATA ────────────────────────────────────
 *
 * La descrizione dice due cose: «Immunizza alle mosse Terra. Aumenta la
 * statistica più alta di 1 grado quando mette KO un avversario.» Solo la prima
 * è entrata. La seconda è uno stato che l'utente imposta a mano, come per
 * Aegislash, Morpeko e Palafin — un interruttore nell'editor, non un ramo del
 * motore — e non si inventa un ramo per un pezzo di interfaccia che non è
 * stato deciso.
 *
 * Non sparisce però: sta nel registro delle PARZIALI in
 * `descrizioniSilenziose.test.js`, perché il presidio da solo non l'avrebbe
 * vista — gli basta che l'abilità abbia UN effetto per non considerarla muta.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import abilities from '../data/abilities.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }
import it_ from '../locales/it.json' with { type: 'json' }
import { META_PRESETS } from '../data/metaPresets.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const LANDORUS = {
  atkPokemon: 'landorus-therian', atkSPs: [0, 32, 0, 0, 0, 20], atkNature: 'adamant',
  atkAbility: null, atkItem: null, level: 50,
}
const eelektross = (defAbility) => ({
  defPokemon: 'eelektross-mega', defSPs: [32, 0, 16, 0, 16, 0], defNature: 'careful',
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const colpo = (defAbility, move, field = {}) => calculateDamage({
  attacker: LANDORUS, defender: eelektross(defAbility), move, field, debug: false,
})

describe('Rapidascesa è nel listino e nel gioco', () => {
  it('è l\'abilità di Eelektross Mega, e la porta un set del meta', () => {
    expect(pokemonData['eelektross-mega'].abilities).toEqual(['eelevate'])
    const suoi = META_PRESETS.filter(s => s.ability === 'eelevate')
    expect(suoi.length, 'nessun set del meta la usa: la sessione stava lavorando a vuoto')
      .toBeGreaterThan(0)
  })

  it('si può scegliere: sta in abilities.json e ha un nome e una descrizione', () => {
    // Senza la riga in `abilities.json` la voce di ABILITY_EFFECTS sarebbe
    // un'anomalia di listino — un ramo del motore che nessuno può accendere —
    // e `anomalieListino.test.js` lo direbbe. La fonte che dice che esiste è
    // `pokemon.json`, che la assegna a una specie.
    expect(abilities['eelevate']).toEqual({ name: 'Eelevate' })
    expect(it_.abilities['eelevate']).toBe('Rapidascesa')
    expect(it_.abilities_desc['eelevate']).toContain('Immunizza alle mosse Terra')
  })
})

describe('l\'immunità alle mosse Terra', () => {
  it('azzera il colpo, e lo dice con il nome giusto', () => {
    const r = colpo('eelevate', 'earthquake')
    expect(r.immune).toBe(true)
    expect(r.reason).toBe('ability')
    expect(r.rolls).toEqual([])
    // Prima del flag il nome era scritto a mano: chi sceglieva Rapidascesa si
    // vedeva «Immune (Levitate)».
    expect(r.abilityName).toBe('Eelevate')
  })

  it('è la STESSA cosa di Levitate, non una simile', () => {
    // La trascrizione, verificata come identità invece che a occhio. Se un
    // giorno una delle due prendesse un ramo suo, questo confronto lo dice.
    for (const move of ['earthquake', 'high horsepower', 'bulldoze', 'stomping tantrum']) {
      const con = colpo('eelevate', move)
      const lev = colpo('levitate', move)
      // Tutto uguale tranne il nome mostrato, che è l'unica cosa che DEVE
      // essere diversa: l'utente ha scelto Rapidascesa e vuole leggere quella.
      expect({ ...con, abilityName: null }, move).toEqual({ ...lev, abilityName: null })
      expect(con.abilityName).toBe('Eelevate')
      expect(lev.abilityName).toBe('Levitate')
    }
  })

  it('non immunizza a nient\'altro', () => {
    // Il ramo si accende sul TIPO, non sull'abilità: senza questo, un
    // `return immune` messo troppo in alto passerebbe i test sopra.
    for (const move of ['ice beam', 'brick break', 'u-turn']) {
      const r = colpo('eelevate', move)
      expect(r.immune ?? false, `${move} non dovrebbe essere immune`).toBe(false)
      expect(r.rolls.length).toBe(16)
    }
  })

  it('toglie il Pokémon da terra, non solo dal tiro', () => {
    // Conseguenza dell'immunità che si vede su un altro numero: chi non è a
    // terra non prende il potenziamento del Terracampo. Vale per l'attaccante,
    // quindi qui Eelektross attacca.
    const attaccante = (atkAbility) => ({
      atkPokemon: 'eelektross-mega', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
      atkAbility, atkItem: null, level: 50,
    })
    const bersaglio = {
      defPokemon: 'incineroar', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
      defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
    }
    const conTerreno = (atkAbility) => calculateDamage({
      attacker: attaccante(atkAbility), defender: bersaglio,
      move: 'wild charge', field: { terrain: 'electric' }, debug: false,
    })
    // Con Rapidascesa non è a terra: niente ×1.3 dal Terracampo Elettrico.
    expect(conTerreno('eelevate').rolls).toEqual(conTerreno('levitate').rolls)
    expect(conTerreno('eelevate').maxDmg).toBeLessThan(conTerreno(null).maxDmg)
  })
})

describe('contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  it.runIf(vendorPresente)('NCP conosce Rapidascesa — la premessa contraria era falsa', () => {
    // Se questo diventasse rosso vorrebbe dire che il riferimento l'ha persa,
    // e allora sì che resteremmo senza oracolo. Finché è verde, ogni verifica
    // qui sotto ha una controparte.
    expect(harness.traduttore.abilitaNCP('eelevate')).toBe('Eelevate')
  })

  for (const move of ['earthquake', 'high horsepower', 'bulldoze']) {
    it.runIf(vendorPresente)(`${move} contro Rapidascesa ≡ NCP (colpo nullo)`, () => {
      const caso = {
        attacker: LANDORUS, defender: eelektross('eelevate'), move, field: {},
      }
      const rif = harness.calcola(caso)
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(rif.nullo, 'NCP dovrebbe considerare il colpo nullo').toBe(true)
      expect(calculateDamage({ ...caso, debug: false }).rolls).toEqual([])
    })
  }

  it.runIf(vendorPresente)('una mossa di un altro tipo passa, e col numero di NCP', () => {
    // Il controllo negativo contro l'oracolo: se l'immunità si accendesse su
    // tutto, questo caso divergerebbe invece di combaciare.
    const caso = {
      attacker: LANDORUS, defender: eelektross('eelevate'), move: 'ice beam', field: {},
    }
    const rif = harness.calcola(caso)
    expect(rif.ok).toBe(true)
    expect(rif.nullo).toBe(false)
    expect(calculateDamage({ ...caso, debug: false }).rolls).toEqual(rif.rolls)
  })

  it.runIf(vendorPresente)('e non è a terra: niente Terracampo, come dice NCP', () => {
    // `pIsGrounded` è il secondo punto in cui il riferimento la nomina, ed è
    // un numero diverso dall'immunità: qui il colpo passa, ma senza il ×1.3.
    const caso = (atkAbility) => ({
      attacker: {
        atkPokemon: 'eelektross-mega', atkSPs: [0, 32, 0, 0, 0, 0],
        atkNature: 'adamant', atkAbility, atkItem: null, level: 50,
      },
      defender: {
        defPokemon: 'incineroar', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
        defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
      },
      move: 'wild charge', field: { terrain: 'electric' },
    })
    const rif = harness.calcola(caso('eelevate'))
    expect(rif.ok).toBe(true)
    expect(calculateDamage({ ...caso('eelevate'), debug: false }).rolls).toEqual(rif.rolls)
    // E il Terracampo il ×1.3 lo dà davvero, a chi è a terra: senza questo il
    // confronto sopra sarebbe soddisfatto anche da un terreno che non fa nulla.
    const senzaAbilita = harness.calcola(caso(null))
    expect(senzaAbilita.rolls.at(-1)).toBeGreaterThan(rif.rolls.at(-1))
  })
})

describe('la seconda metà della descrizione non è implementata', () => {
  it('la voce porta solo `levitate`', () => {
    // Se qualcuno aggiungesse il boost da KO, questo test è il punto in cui
    // deve passare — e togliere la riga dalle PARZIALI del presidio.
    expect(ABILITY_EFFECTS['eelevate']).toEqual({ levitate: true })
  })

  it('la descrizione però promette anche l\'altra metà', () => {
    // Il fatto che rende la voce «parziale» invece che completa. Sta scritto
    // qui perché non resti solo in un commento.
    expect(it_.abilities_desc['eelevate']).toContain('quando mette KO')
  })
})
