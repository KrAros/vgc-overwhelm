// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/orbiLeggendari.test.js
 *
 * Gli orbi: ×1.2 su DUE tipi, e quali dipende dalla specie che li tiene.
 *
 * ─── ERANO DATI PER DORMIENTI, E NON LO SONO ───────────────────────────────
 *
 * Il registro li metteva fra le voci «legate a specie che Champions non ha»,
 * cioè fra quelle che nessuno può incontrare. È vero che Dialga, Palkia e
 * Giratina non sono nel roster di M-B — ma il roster da noi **non filtra**:
 * `nomiPokemon.js:115` lo usa per ORDINARE l'elenco, e il commento accanto
 * dice esattamente perché («stringere è una riga», il giorno che la fonte è
 * confermata). Quindi oggi quelle specie si possono scegliere, e chi le
 * sceglieva con un orbo in mano leggeva un numero più basso del vero.
 *
 * ─── DOVE TOCCA IL DANNO, TRASCRITTO ───────────────────────────────────────
 *
 * `damage_MASTER.js:1704`, punto k di `calcBPMods`, `0x1333` — cioè lo stesso
 * `MOD.X1_2` di Carbonella e degli incensi, nella stessa catena. Meccanicamente
 * è il lavoro più vicino a quello già fatto.
 *
 * ─── E POI C'E' LA COSA CHE NON SI INDOVINA ────────────────────────────────
 *
 * `getItemDualTypeBoost` (`item_data.js:567`) è un `switch` di sette casi
 * SENZA NESSUN `break`. Un orbo che non trova la sua specie CADE nel caso
 * successivo. Quindi vale per la sua specie **e per tutte quelle dei casi più
 * in basso**: l'Orbo Bramoso addosso a Palkia dà il bonus di Palkia, e addosso
 * a Latios quello di Latios.
 *
 * Non risale: il Grigiosfera su Palkia non fa niente, perché il caso di Palkia
 * sta sopra il suo. La matrice è TRIANGOLARE, ed è la firma di un `switch` che
 * cade — la si misura, non la si deduce dalle regole del gioco (dove non
 * esiste: è un dettaglio dell'implementazione del riferimento).
 *
 * La tabella ordinata e la matrice stanno accanto a `STRUMENTI_DOPPIO_TIPO` in
 * `lib/rules.js`. Qui ci sono i casi che la verificano contro l'oracolo, uno
 * per cella.
 *
 * ─── L'ORACOLO ────────────────────────────────────────────────────────────
 *
 * Lo snapshot non nomina nessuno dei quattro strumenti — zero occorrenze in
 * `scripts/snapshot-cases.mjs`, verificato.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import { STRUMENTI_DOPPIO_TIPO, tipiDoppioStrumento } from '../lib/rules.js'
import { TYPES } from '../data/typeChart.js'
import POKEMON_DATA from '../data/pokemon.json' with { type: 'json' }
import ITEM_DATA from '../data/items.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

/** I quattro casi del `switch` che si possono davvero scegliere. */
const SCEGLIBILI = ['adamant orb', 'lustrous orb', 'griseous orb', 'soul dew']

/**
 * Dragonite: Drago/Volante. Non è immune a nessuno dei cinque tipi in gioco —
 * Acciaio, Acqua, Spettro, Drago, Psico — quindi ogni caso può muoversi.
 *
 * Il difensore ovvio sarebbe stato Blissey, ed è stato scartato dopo averlo
 * misurato: è Normale, quindi IMMUNE a Spettro, e il caso del Grigiosfera con
 * Palla Ombra dava zero con e senza l'orbo. Il confronto contro il riferimento
 * passava lo stesso, perché anche NCP dice zero.
 */
const DIFENSORE = {
  defPokemon: 'dragonite', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}
const att = (specie, item) => ({
  atkPokemon: specie, atkSPs: [0, 0, 0, 32, 0, 0], atkNature: 'modest',
  atkAbility: null, atkItem: item, level: 50,
})
const nostro = (specie, item, move) => calculateDamage({
  attacker: att(specie, item), defender: DIFENSORE, move, field: {}, debug: false,
})

/** Una mossa speciale per ognuno dei cinque tipi che il `switch` nomina. */
const MOSSA = {
  [TYPES.STEEL]:   'flash cannon',
  [TYPES.WATER]:   'surf',
  [TYPES.GHOST]:   'shadow ball',
  [TYPES.DRAGON]:  'draco meteor',
  [TYPES.PSYCHIC]: 'psychic',
}

/**
 * La matrice attesa, scritta come si legge il `switch`: per ogni specie, il
 * primo caso dal proprio indice in giù che la nomina.
 *
 * NON è generata da `tipiDoppioStrumento`: sarebbe la funzione che verifica sé
 * stessa. È l'elenco misurato contro l'oracolo, trascritto a mano.
 */
const ATTESA = {
  'dialga':          { 'adamant orb': [TYPES.STEEL, TYPES.DRAGON] },
  'palkia':          { 'adamant orb': [TYPES.WATER, TYPES.DRAGON],
                       'lustrous orb': [TYPES.WATER, TYPES.DRAGON] },
  'giratina':        { 'adamant orb': [TYPES.GHOST, TYPES.DRAGON],
                       'lustrous orb': [TYPES.GHOST, TYPES.DRAGON],
                       'griseous orb': [TYPES.GHOST, TYPES.DRAGON] },
  'latios':          { 'adamant orb': [TYPES.DRAGON, TYPES.PSYCHIC],
                       'lustrous orb': [TYPES.DRAGON, TYPES.PSYCHIC],
                       'griseous orb': [TYPES.DRAGON, TYPES.PSYCHIC],
                       'soul dew': [TYPES.DRAGON, TYPES.PSYCHIC] },
  'dialga-origin':   { 'adamant orb': [TYPES.STEEL, TYPES.DRAGON],
                       'lustrous orb': [TYPES.STEEL, TYPES.DRAGON],
                       'griseous orb': [TYPES.STEEL, TYPES.DRAGON],
                       'soul dew': [TYPES.STEEL, TYPES.DRAGON] },
  'giratina-origin': { 'adamant orb': [TYPES.GHOST, TYPES.DRAGON],
                       'lustrous orb': [TYPES.GHOST, TYPES.DRAGON],
                       'griseous orb': [TYPES.GHOST, TYPES.DRAGON],
                       'soul dew': [TYPES.GHOST, TYPES.DRAGON] },
}

describe('la tabella è ordinata, e l\'ordine è la meccanica', () => {
  it('i sette casi sono nell\'ordine del `switch`', () => {
    expect(STRUMENTI_DOPPIO_TIPO.map(r => r.strumento)).toEqual([
      'adamant orb', 'lustrous orb', 'griseous orb', 'soul dew',
      'adamant crystal', 'lustrous globe', 'griseous core',
    ])
  })

  it('i quattro sceglibili sono in `items.json`, i tre in coda no', () => {
    // I tre in coda non sono completismo: sono la coda di una caduta che parte
    // da uno strumento vero. Se un giorno entrassero in `items.json`, questo
    // diventa rosso e vanno trattati come voci a sé.
    for (const k of SCEGLIBILI) expect(ITEM_DATA[k], `${k} non è selezionabile`).toBeTruthy()
    for (const k of ['adamant crystal', 'lustrous globe', 'griseous core']) {
      expect(ITEM_DATA[k], `${k} è diventata selezionabile: rileggere il switch`).toBeUndefined()
    }
  })

  it('le specie che nomina esistono tutte nel dex', () => {
    // Un refuso in uno slug non lo vedrebbe nessuno: il ramo semplicemente non
    // si accenderebbe, e per le tre righe in coda nemmeno un caso lo prende.
    for (const r of STRUMENTI_DOPPIO_TIPO) {
      for (const s of r.specie) expect(POKEMON_DATA[s], `${s} non è nel dex`).toBeTruthy()
    }
  })

  it('e i quattro sceglibili dichiarano l\'effetto in ITEM_EFFECTS', () => {
    for (const k of SCEGLIBILI) expect(ITEM_EFFECTS[k]?.doppioTipo, `${k}`).toBe(true)
  })

  it('il roster NON filtra: quelle specie si possono scegliere davvero', () => {
    // È la ragione per cui questa voce non era dormiente. Se un giorno il
    // roster stringesse, questo diventa rosso — e allora la domanda «vale la
    // pena» torna aperta.
    const roster = JSON.parse(fs.readFileSync(
      path.join(RADICE, 'src/data/rosterChampions.json'), 'utf8'))
    expect(roster.nel_roster).not.toContain('dialga')
    const fonte = fs.readFileSync(path.join(RADICE, 'src/utils/nomiPokemon.js'), 'utf8')
    expect(fonte, 'il roster adesso filtra: rileggere se gli orbi sono ancora raggiungibili')
      .toContain('ordinaPerRoster')
  })
})

describe('la caduta del `switch`, contro il riferimento', () => {
  let harness
  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  // Una cella per combinazione: quattro strumenti × sei specie, sulla mossa
  // Drago — che compare in TUTTE le coppie del `switch`, quindi da sola dice
  // se il ramo si è acceso.
  for (const specie of Object.keys(ATTESA)) {
    for (const item of SCEGLIBILI) {
      const attesa = ATTESA[specie][item]
      const etichetta = attesa ? 'si accende' : 'NON si accende (il caso sta sopra)'
      it.runIf(vendorPresente)(`${item} su ${specie}: ${etichetta}`, () => {
        const move = MOSSA[TYPES.DRAGON]
        const input = { attacker: att(specie, item), defender: DIFENSORE, move, field: {} }
        const rif = harness.calcola(input)
        expect(rif.motivo ?? null, 'caso non esprimibile per l\'harness').toBeNull()
        expect(rif.ok).toBe(true)
        expect(nostro(specie, item, move).rolls, `${item}/${specie}: divergiamo`)
          .toEqual(rif.rolls)

        // E il controllo che rende il caso una prova: il numero si muove solo
        // dove la matrice dice che deve muoversi.
        const senza = nostro(specie, null, move)
        const con = nostro(specie, item, move)
        if (attesa) {
          expect(con.maxDmg, `${item}/${specie}: il ramo non si accende`)
            .toBeGreaterThan(senza.maxDmg)
        } else {
          expect(con.rolls, `${item}/${specie}: il ramo si accende dove non deve`)
            .toEqual(senza.rolls)
        }
      })
    }
  }
})

describe('e i tipi sono i due giusti, non solo «uno dei due»', () => {
  let harness
  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  // Il caso Drago da solo non distingue Acciaio/Drago da Acqua/Drago: il Drago
  // c'è in tutt'e due. Qui si prova l'ALTRO tipo di ogni coppia, ed è quello
  // che cade se la caduta portasse alla riga sbagliata.
  const CASI = [
    ['dialga',   'adamant orb',  TYPES.STEEL,   TYPES.WATER],
    ['palkia',   'adamant orb',  TYPES.WATER,   TYPES.STEEL],
    ['giratina', 'lustrous orb', TYPES.GHOST,   TYPES.WATER],
    ['latios',   'adamant orb',  TYPES.PSYCHIC, TYPES.STEEL],
  ]

  for (const [specie, item, tipoSi, tipoNo] of CASI) {
    it.runIf(vendorPresente)(`${item} su ${specie}: potenzia ${MOSSA[tipoSi]} e non ${MOSSA[tipoNo]}`, () => {
      for (const [tipo, deveCrescere] of [[tipoSi, true], [tipoNo, false]]) {
        const move = MOSSA[tipo]
        const input = { attacker: att(specie, item), defender: DIFENSORE, move, field: {} }
        const rif = harness.calcola(input)
        expect(rif.ok).toBe(true)
        expect(nostro(specie, item, move).rolls, `${move}: divergiamo`).toEqual(rif.rolls)

        const senza = nostro(specie, null, move)
        expect(senza.maxDmg, `${move} non fa danno: il caso non prova niente`).toBeGreaterThan(0)
        const con = nostro(specie, item, move)
        if (deveCrescere) expect(con.maxDmg).toBeGreaterThan(senza.maxDmg)
        else expect(con.rolls).toEqual(senza.rolls)
      }
    })
  }
})

describe('la funzione da sola', () => {
  it('non risale mai', () => {
    // Il Grigiosfera su Palkia: il caso di Palkia sta SOPRA il suo.
    expect(tipiDoppioStrumento('griseous orb', 'palkia')).toBeNull()
    expect(tipiDoppioStrumento('soul dew', 'dialga')).toBeNull()
  })

  it('e su uno strumento che non è nel `switch` non fa niente', () => {
    expect(tipiDoppioStrumento('charcoal', 'dialga')).toBeNull()
    expect(tipiDoppioStrumento('', 'dialga')).toBeNull()
  })

  it('i tre casi in coda si raggiungono solo cadendoci dentro', () => {
    // Nessuno può tenere il Cristallo Adamante, ma il Grigiosfera su
    // Dialga-Origin ci finisce. Senza quelle tre righe darebbe null.
    expect(tipiDoppioStrumento('griseous orb', 'dialga-origin'))
      .toEqual([TYPES.STEEL, TYPES.DRAGON])
    expect(tipiDoppioStrumento('soul dew', 'giratina-origin'))
      .toEqual([TYPES.GHOST, TYPES.DRAGON])
  })
})
