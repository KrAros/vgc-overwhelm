// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/rockHead.test.js
 *
 * Rock Head azzera il contraccolpo delle dieci mosse in cui è una frazione del
 * danno inflitto.
 *
 * ─── QUI L'ORACOLO NON ARRIVA, E VA DETTO PRIMA DI TUTTO ───────────────────
 *
 * Il riferimento il contraccolpo NON lo calcola. `Rock Head` compare in
 * `vendor/ncp/ability_data.js` (un elenco di nomi) e in `pokedex.js` (i dati
 * delle specie), e mai in `damage_MASTER.js` né in `damage_SV.js`. Il
 * contraccolpo lo mostriamo noi, e nessun confronto roll per roll potrà mai
 * dire se questa implementazione è giusta.
 *
 * È quindi una decisione di Simone, non una trascrizione, e sta anche in
 * `divergenzeAggiudicate.test.js` accanto alla potenza di Pound e allo
 * scivolone di Supersweet Syrup.
 *
 * ─── LE DUE FAMIGLIE DI MOSSE ──────────────────────────────────────────────
 *
 * Delle tredici mosse con `recoil` nei nostri dati, dieci sono di tipo
 * `damage` — una frazione del danno inflitto — e tre di tipo `maxhp`: Mind
 * Blown, Chloroblast e Steel Beam, che costano metà dei PS massimi come
 * PREZZO della mossa. Rock Head copre le dieci e non le tre: aggiudicato.
 *
 * ─── E POI MAGIC GUARD ─────────────────────────────────────────────────────
 *
 * Quando questo file è nato, Magic Guard era stata lasciata fuori di proposito
 * — «solo Rock Head, le dieci» — e il test in fondo lo teneva fermo con un
 * elenco esatto. Adesso è entrata, con la stessa aggiudicazione e sulle stesse
 * dieci mosse: la sua descrizione dice «subisce danno solo dagli attacchi
 * diretti», e il contraccolpo non è un attacco.
 *
 * L'altra metà di Magicscudo — la sabbia — era già implementata da prima e per
 * nome, in `SAND_IMMUNE_ABILITIES`. Era metà abilità: la descrizione ne
 * prometteva due e il motore ne applicava una, e nessun presidio poteva dirlo,
 * perché `descrizioniSilenziose` scarta un'abilità appena ha UN effetto.
 *
 * ─── CHI L'AVEVA TROVATA ───────────────────────────────────────────────────
 *
 * `descrizioniSilenziose.test.js`, che la teneva col verdetto `silenziosa` —
 * «l'app descrive un effetto su un numero che mostra, non lo applica, e il
 * segnalino non lo dichiara». Il registro del divario non poteva vederla, e
 * per una ragione strutturale: elenca ciò che il riferimento calcola.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { contraccolpoDaMostrare } from '../lib/damage.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import movesData from '../data/moves.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const VENDOR = path.join(RADICE, 'vendor', 'ncp')
const vendorPresente = fs.existsSync(path.join(VENDOR, 'damage_SV.js'))

const CON_CONTRACCOLPO = Object.keys(movesData).filter(k => movesData[k].recoil)
const DA_DANNO = CON_CONTRACCOLPO.filter(k => movesData[k].recoil.type === 'damage')
const DA_PS_MASSIMI = CON_CONTRACCOLPO.filter(k => movesData[k].recoil.type === 'maxhp')

describe('i presupposti', () => {
  it('tredici mosse, dieci di un tipo e tre dell\'altro', () => {
    expect(CON_CONTRACCOLPO).toHaveLength(13)
    expect(DA_DANNO).toHaveLength(10)
    expect(DA_PS_MASSIMI.sort()).toEqual(['chloroblast', 'mind blown', 'steel beam'])
  })

  it('ventitré specie hanno Rock Head', () => {
    const con = Object.keys(pokemonData)
      .filter(k => (pokemonData[k].abilities ?? []).includes('rock-head'))
    expect(con.length).toBeGreaterThanOrEqual(23)
  })

  it('le due voci dichiarano l\'effetto', () => {
    expect(ABILITY_EFFECTS['rock-head'].annullaContraccolpo).toBe(true)
    expect(ABILITY_EFFECTS['magic-guard'].annullaContraccolpo).toBe(true)
  })

  it.runIf(vendorPresente)('il riferimento non calcola il contraccolpo — verificato, non ricordato', () => {
    // Il presupposto della decisione. Se un aggiornamento del vendor lo
    // implementasse, questa smetterebbe di essere un'aggiudicazione e
    // diventerebbe una trascrizione — con un oracolo da rispettare.
    // ─── LA PRIMA STESURA DI QUESTO CONTROLLO ERA TROPPO LARGA ────────────
    //
    // Chiedeva che la parola `recoil` non comparisse affatto, ed e' diventata
    // rossa: il riferimento la nomina. Ma la nomina per LEGGERLA come flag di
    // Reckless — `move.hasRecoil || move.recoilHP || move.hasCrash`
    // (`damage_MASTER.js:1604`) — cioe' sa QUALI mosse hanno il contraccolpo,
    // e non ne calcola mai il danno.
    //
    // Il fatto che regge la decisione e' un altro, ed e' questo: `Rock Head`
    // non compare mai nei due file del danno. Nessuna condizione, da nessuna
    // parte, guarda quell'abilita'.
    for (const file of ['damage_MASTER.js', 'damage_SV.js']) {
      const src = fs.readFileSync(path.join(VENDOR, file), 'utf8')
      expect(src.includes('Rock Head'), `${file} ora nomina Rock Head`).toBe(false)
    }

    // E le uniche occorrenze di `recoil` sono quelle di Reckless: se ne
    // comparisse una terza, qualcuno ha cominciato a calcolarlo.
    const master = fs.readFileSync(path.join(VENDOR, 'damage_MASTER.js'), 'utf8')
    const righeConRecoil = master.split('\n')
      .map((r, i) => ({ r, n: i + 1 }))
      .filter(({ r }) => /recoil/i.test(r))
    expect(
      righeConRecoil.map(x => x.n),
      'il riferimento nomina il contraccolpo in righe nuove: rileggere questa decisione',
    ).toEqual([1603, 1604])
  })
})

describe('cosa azzera e cosa no', () => {
  for (const mossa of DA_DANNO) {
    it(`${mossa}: Rock Head e Magic Guard lo azzerano`, () => {
      expect(contraccolpoDaMostrare(movesData[mossa].recoil, 'rock-head')).toBe(false)
      expect(contraccolpoDaMostrare(movesData[mossa].recoil, 'magic-guard')).toBe(false)
      expect(contraccolpoDaMostrare(movesData[mossa].recoil, 'blaze')).toBe(true)
    })
  }

  for (const mossa of DA_PS_MASSIMI) {
    it(`${mossa}: non è contraccolpo, è un prezzo — nessuna delle due lo tocca`, () => {
      expect(contraccolpoDaMostrare(movesData[mossa].recoil, 'rock-head')).toBe(true)
      expect(contraccolpoDaMostrare(movesData[mossa].recoil, 'magic-guard')).toBe(true)
    })
  }

  it('una mossa senza contraccolpo non ne ha da mostrare', () => {
    expect(contraccolpoDaMostrare(movesData['flamethrower'].recoil, 'rock-head')).toBe(false)
    expect(contraccolpoDaMostrare(null, 'blaze')).toBe(false)
  })

  it('sono due, e sono queste', () => {
    // Elenco esatto e non «almeno queste»: se ne compare una terza è una
    // decisione nuova, e va scritta in `divergenzeAggiudicate.test.js` prima
    // che qui. Qui c'era `['rock-head']` da sola, ed è la riga in cui si vede
    // la decisione di Simone cambiare.
    const azzerano = Object.keys(ABILITY_EFFECTS)
      .filter(k => ABILITY_EFFECTS[k].annullaContraccolpo).sort()
    expect(azzerano).toEqual(['magic-guard', 'rock-head'])
  })
})

describe('il caso concreto che il registro citava', () => {
  it('Arcanine di Hisui ha Rock Head, e il preset gli dà due mosse con contraccolpo', () => {
    // `descrizioniSilenziose.test.js` lo portava come prova che il difetto non
    // era teorico: «Rock Head Attacker», con Flare Blitz e Wild Charge.
    expect(pokemonData['arcanine-hisui']?.abilities ?? []).toContain('rock-head')
    for (const mossa of ['flare blitz', 'wild charge']) {
      expect(movesData[mossa].recoil?.type).toBe('damage')
      expect(contraccolpoDaMostrare(movesData[mossa].recoil, 'rock-head')).toBe(false)
    }
  })
})
