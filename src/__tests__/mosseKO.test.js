// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/mosseKO.test.js
 *
 * Le quattro mosse KO — Guillotine, Horn Drill, Fissure, Sheer Cold — e
 * Sturdy, che è l'unica cosa che le ferma.
 *
 * ─── QUESTA VOLTA L'ORACOLO C'E' ───────────────────────────────────────────
 *
 * Le ultime sessioni hanno lavorato dove il riferimento tace — il contraccolpo,
 * il fine turno — e ogni riga era un'aggiudicazione. Qui no: il riferimento
 * calcola tutto, e ogni caso qui sotto è confrontato roll per roll con
 * l'oracolo eseguito. Si trascrive, non si decide.
 *
 * ─── MA L'HARNESS NON SAPEVA DIRLO ─────────────────────────────────────────
 *
 * Chiedendogli «Fissure su Walrein» rispondeva `nullo: true, rolls: []`, cioè
 * «il riferimento dice zero». Falso: il riferimento dice 185. L'harness
 * trattava come colpo nullo qualunque risposta che non fosse di sedici roll, e
 * il danno fisso è di UN numero.
 *
 * La distinzione fra `[0]` e `[185]` è stata aggiunta lì, ed è il pezzo di
 * questo lavoro che serve anche a tutto il resto: sotto lo stesso `if` del
 * riferimento ci sono Seismic Toss, Night Shade, Dragon Rage, Sonic Boom e
 * Psywave, che restano da fare e che adesso hanno un oracolo interrogabile.
 *
 * ─── STURDY, E LA META' CHE NON C'E' ───────────────────────────────────────
 *
 * Nel gioco Sturdy fa due cose: azzera le mosse KO e fa sopravvivere con un
 * punto salute a un colpo che ucciderebbe da vita piena. Nel riferimento c'è
 * solo la prima (`damage_MASTER.js:1144`), e la seconda non c'è perché non è
 * la catena del danno di un colpo: è cosa succede dopo che il danno è stato
 * calcolato. Il nostro modello calcola un colpo, e quindi nemmeno noi.
 *
 * Questa non è una mezza abilità taciuta: sta scritto qui, e sta in
 * `descrizioniSilenziose.test.js` se e quando la descrizione la prometterà.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { ABILITA_NON_IGNORABILI } from '../lib/rules.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = (abilita = null) => ({
  atkPokemon: 'garchomp', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
  atkAbility: abilita, atkItem: null, level: 50,
})
const dif = (specie, abilita = null) => ({
  defPokemon: specie, defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: abilita, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const nostro = (a, d, move) => calculateDamage({ attacker: a, defender: d, move, field: {} })

// ═══════════════════════════════════════════════════════════════════════════
// 1. Il flag viene dal riferimento, non da una lista scritta a mano
// ═══════════════════════════════════════════════════════════════════════════

describe('le quattro mosse KO vengono dal riferimento', () => {
  it('sono quattro, e il flag sta nei dati', () => {
    const ko = Object.entries(movesData).filter(([, v]) => v.koSecco).map(([k]) => k).sort()
    expect(ko).toEqual(['fissure', 'guillotine', 'horn drill', 'sheer cold'])
  })

  it('e il motore ne nomina UNA sola, che è l\'eccezione del riferimento', () => {
    // `sheer cold` compare nel motore perché il riferimento scrive l'eccezione
    // sul NOME (`move.name == 'Sheer Cold'`), non su un flag. Le altre tre no:
    // se comparissero, qualcuno avrebbe rimesso una lista nel motore.
    const motore = fs.readFileSync(path.join(RADICE, 'src', 'calcEngine.js'), 'utf8')
    const nominate = ['fissure', 'guillotine', 'horn drill', 'sheer cold']
      .filter(n => motore.includes(`'${n}'`))
    expect(nominate).toEqual(['sheer cold'])
  })

  it('hanno potenza zero, e passano lo stesso', () => {
    // La riga che le fa entrare è la stessa che fa entrare le mosse a peso.
    // Se qualcuno la stringesse, tornerebbero `null` e la matrice tornerebbe a
    // disegnarle come `~`.
    for (const m of ['fissure', 'guillotine', 'horn drill', 'sheer cold']) {
      expect(movesData[m].power, `${m} ha una potenza`).toBe(0)
      expect(nostro(att(), dif('blissey'), m), `${m} esce null`).not.toBeNull()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Cosa fanno, da noi
// ═══════════════════════════════════════════════════════════════════════════

describe('il danno è i punti salute del bersaglio, e non ha variazione', () => {
  it('un roll solo, non sedici', () => {
    const r = nostro(att(), dif('blissey'), 'horn drill')
    expect(r.rolls).toHaveLength(1)
    expect(r.rolls[0]).toBe(r.defHP)
    expect(r.minPct).toBe(100)
    expect(r.maxPct).toBe(100)
  })

  it('e cambia col bersaglio, perché è il bersaglio', () => {
    const grosso = nostro(att(), dif('blissey'), 'horn drill')
    const piccolo = nostro(att(), dif('walrein'), 'horn drill')
    expect(grosso.rolls[0]).toBeGreaterThan(piccolo.rolls[0])
  })

  it('Sheer Cold contro un Ghiaccio fallisce, le altre tre no', () => {
    // L'eccezione è di Sheer Cold sola: il riferimento la scrive sul nome.
    const r = nostro(att(), dif('walrein'), 'sheer cold')
    expect(r.immune).toBe(true)
    expect(r.reason).toBe('move')
    expect(nostro(att(), dif('walrein'), 'fissure').rolls).toHaveLength(1)
  })

  it('e contro un non-Ghiaccio Sheer Cold passa', () => {
    // Il controllo negativo: senza, il test sopra passerebbe anche se Sheer
    // Cold fallisse sempre.
    expect(nostro(att(), dif('garchomp'), 'sheer cold').rolls).toHaveLength(1)
  })

  it('l\'immunità di tipo viene prima, e vince', () => {
    // Fissure è Terra e Skarmory è Volante; Guillotine è Normale e Gengar è
    // Spettro. Non è il ramo delle mosse KO a fermarle.
    expect(nostro(att(), dif('skarmory'), 'fissure').immune).toBe(true)
    expect(nostro(att(), dif('gengar'), 'guillotine').reason).toBe('type')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Sturdy
// ═══════════════════════════════════════════════════════════════════════════

describe('Sturdy azzera le mosse KO, e nient\'altro', () => {
  it('la voce dichiara l\'effetto', () => {
    expect(ABILITY_EFFECTS['sturdy'].sturdy).toBe(true)
  })

  it('le quattro non passano', () => {
    for (const m of ['fissure', 'guillotine', 'horn drill']) {
      const r = nostro(att(), dif('blissey', 'sturdy'), m)
      expect(r.immune, m).toBe(true)
      expect(r.reason, m).toBe('ability')
      expect(r.abilityName, m).toBe('Sturdy')
    }
  })

  it('e una mossa qualunque passa intera', () => {
    // Il ramo si accende sul FLAG della mossa, non sull'abilità: senza questo,
    // un `return` messo troppo in alto passerebbe il test qui sopra.
    const con = nostro(att(), dif('walrein', 'sturdy'), 'earthquake')
    const senza = nostro(att(), dif('walrein'), 'earthquake')
    expect(con.immune ?? false).toBe(false)
    expect(con.rolls).toEqual(senza.rolls)
  })

  it('Mold Breaker la ignora, e non c\'è una riga che lo dica', () => {
    // La condizione legge `defAbilEffect`, che è già `null` quando l'abilità è
    // ignorata: Mold Breaker arriva gratis, come nel riferimento — che legge
    // `defAbility`, il valore già passato da `abilityIgnore`.
    expect(ABILITA_NON_IGNORABILI.has('sturdy'), 'Sturdy è finita fra le non ignorabili').toBe(false)
    const r = nostro(att('mold-breaker'), dif('walrein', 'sturdy'), 'fissure')
    expect(r.immune ?? false).toBe(false)
    expect(r.rolls).toEqual([r.defHP])
  })

  it('la metà che NON c\'è: sopravvivere con un punto salute', () => {
    // Nel gioco Sturdy fa anche questo, nel riferimento no, e da noi nemmeno.
    // Il giorno che qualcuno la scrive, questo test diventa rosso e la nota in
    // testa al file va riscritta nello stesso commit.
    expect(ABILITY_EFFECTS['sturdy'].sopravvive).toBeUndefined()
    expect(Object.keys(ABILITY_EFFECTS['sturdy']).sort()).toEqual(['showInSmogon', 'sturdy'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Contro l'oracolo
// ═══════════════════════════════════════════════════════════════════════════

describe('contro il riferimento eseguito', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    harness = (await import('../../scripts/ncp/harness.mjs')).creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const CASI = [
    ['Fissure su Walrein',                   att(),              dif('walrein'),           'fissure'],
    ['Fissure contro Sturdy',                att(),              dif('walrein', 'sturdy'), 'fissure'],
    ['Fissure contro Sturdy, con Mold Breaker', att('mold-breaker'), dif('walrein', 'sturdy'), 'fissure'],
    ['Fissure su uno Volante',               att(),              dif('skarmory'),          'fissure'],
    ['Guillotine su uno Spettro',            att(),              dif('gengar'),            'guillotine'],
    ['Sheer Cold su un Ghiaccio',            att(),              dif('walrein'),           'sheer cold'],
    ['Sheer Cold su chi Ghiaccio non è',     att(),              dif('garchomp'),          'sheer cold'],
    ['Horn Drill su Blissey',                att(),              dif('blissey'),           'horn drill'],
    ['Guillotine contro Sturdy',             att(),              dif('blissey', 'sturdy'), 'guillotine'],
    ['Terremoto contro Sturdy — il controllo negativo', att(),    dif('walrein', 'sturdy'), 'earthquake'],
  ]

  for (const [nome, a, d, move] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker: a, defender: d, move, field: {} })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      const r = nostro(a, d, move)
      expect(r.immune ? [] : r.rolls).toEqual(rif.rolls)
    })
  }

  it.runIf(vendorPresente)('e l\'harness distingue il danno fisso dal colpo nullo', () => {
    // La correzione che ha reso questo file possibile. Senza, tutte le righe
    // qui sopra confronterebbero `[]` con `[]` e passerebbero senza provare
    // niente — che è esattamente quello che facevano prima.
    const fisso = harness.calcola({ attacker: att(), defender: dif('walrein'), move: 'fissure', field: {} })
    expect(fisso.fisso).toBe(true)
    expect(fisso.nullo).toBe(false)
    expect(fisso.rolls).toEqual([fisso.defHP])

    const nullo = harness.calcola({ attacker: att(), defender: dif('walrein', 'sturdy'), move: 'fissure', field: {} })
    expect(nullo.fisso ?? false).toBe(false)
    expect(nullo.nullo).toBe(true)
  })
})
