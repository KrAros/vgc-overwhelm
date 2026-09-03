// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/lavoroAperto.test.js
 *
 * Il presidio di `docs/lavoro-aperto.md`.
 *
 * ─── PERCHÉ UN REGISTRO VA VERIFICATO ──────────────────────────────────────
 *
 * Un elenco di «cose da fare» che nessuno controlla diventa una lapide: le
 * voci restano scritte dopo essere state fatte, e chi legge non sa più quali
 * sono vere. È già successo in questo progetto in piccolo — un verdetto di
 * `descrizioniSilenziose` che diceva «gli stati non sono modellati» quando lo
 * erano diventati, e i numeri di `CONTRIBUTING.md` fermi a due sessioni prima.
 *
 * Quindi ogni voce del documento che si possa rendere falsificabile è qui, e
 * asserisce che **è ancora aperta**. Il giorno che una viene fatta questo file
 * diventa rosso, e la riga nel documento va tolta nello stesso commit.
 *
 * ─── COSA NON PUÒ CONTROLLARE ──────────────────────────────────────────────
 *
 * Le voci della famiglia B — quelle che aspettano una decisione di Simone —
 * sono verificabili solo come «non è ancora stata presa». Che la decisione sia
 * *giusta* non lo dice nessun test, ed è il punto: sono decisioni, non
 * trascrizioni.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { vociFineTurnoDaStato } from '../lib/damage.js'
import movesData from '../data/moves.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }
import gapNoti from '../data/gapNoti.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const DOCUMENTO = path.join(RADICE, 'docs', 'lavoro-aperto.md')

const att = { atkPokemon: 'garchomp', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null, atkAbility: null, atkItem: null, level: 50 }
const dif = (abilita = null, status = null) => ({
  defPokemon: 'blissey', defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: abilita, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, defStatus: status,
})

describe('il documento esiste ed è raggiungibile', () => {
  it('c\'è, e CONTRIBUTING.md ci manda', () => {
    expect(fs.existsSync(DOCUMENTO)).toBe(true)
    const contribuire = fs.readFileSync(path.join(RADICE, 'CONTRIBUTING.md'), 'utf8')
    expect(
      contribuire.includes('docs/lavoro-aperto.md'),
      'il documento c\'è ma nessuno ci arriva: rimettere il rimando',
    ).toBe(true)
  })
})

describe('A — le voci che aspettano una trascrizione sono ancora aperte', () => {
  it('le quattro mosse a danno fisso escono ancora `null`', () => {
    // Il giorno che entrano, questo test dice di togliere la voce dal
    // documento — e di aggiungerne i casi contro l'oracolo, che adesso
    // risponde.
    for (const m of ['seismic toss', 'night shade', 'dragon rage', 'sonic boom']) {
      expect(movesData[m].power, `${m} ha una potenza`).toBe(0)
      expect(
        calculateDamage({ attacker: att, defender: dif(), move: m, field: {} }),
        `${m} adesso il motore la calcola: aggiornare docs/lavoro-aperto.md`,
      ).toBeNull()
    }
  })

  it('`gapNoti.json` non ha ancora la lista delle mosse', () => {
    expect(Object.keys(gapNoti)).toEqual(['meta', 'abilita', 'strumenti'])
  })

  it('gli strumenti col badge sono ancora trentanove', () => {
    // Non è un numero da difendere: è il numero che nessuno ha ancora
    // guardato. Se scende, la voce nel documento va aggiornata.
    expect(gapNoti.strumenti.length).toBe(39)
  })
})

describe('B — le decisioni non sono ancora state prese', () => {
  it('Merciless non accende il critico da sola', () => {
    expect(ABILITY_EFFECTS['merciless'], 'Merciless è stata implementata').toBeUndefined()
  })

  it('il menù dello stato non è ristretto dalle abilità che immunizzano', () => {
    // Un difensore con Immunity può essere dichiarato avvelenato, e prende il
    // danno da veleno. È la scelta presa — lo stato è un'asserzione di chi usa
    // l'app — e questo test la tiene visibile invece che sottintesa.
    const conImmunity = vociFineTurnoDaStato('poisoned', 'immunity', 200)
    expect(conImmunity).toHaveLength(1)
    expect(conImmunity[0].hp).toBe(-25)
  })

  it('Sturdy ha ancora una metà sola', () => {
    expect(Object.keys(ABILITY_EFFECTS['sturdy']).sort()).toEqual(['showInSmogon', 'sturdy'])
  })

  it('i punti salute non sono nel modello', () => {
    // Tre prove che l'assunzione «vita piena» è ancora ovunque: nessuno slot
    // porta i PS correnti, Eruption usa la potenza piena, e una mossa KO
    // toglie tutti i PS massimi.
    // Solo il CODICE: `curHP` compare nei commenti del punto f, dove si
    // spiega che il riferimento legge i PS correnti e noi assumiamo la vita
    // piena. La prima stesura di questa riga guardava tutto il file ed è
    // diventata rossa su quel commento — cercava la parola, non la cosa.
    const motore = fs.readFileSync(path.join(RADICE, 'src/calcEngine.js'), 'utf8')
      .split('\n').filter(r => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n')
    expect(/\bcurHP\b/.test(motore), 'i PS correnti sono entrati nel motore').toBe(false)
    expect(movesData['eruption'].power).toBe(150)
  })
})

describe('C — il dato che manca, manca ancora', () => {
  it('Rivalry è l\'unica abilità nel divario', () => {
    expect(gapNoti.abilita).toEqual(['rivalry'])
  })

  it('e il sesso è nullo su quasi ottocento specie', () => {
    // 986 su 1225 quando il documento è stato scritto. La soglia è larga di
    // proposito: un audit parziale non deve far fallire il test, ma un audit
    // vero — che porterebbe il numero vicino a zero — sì.
    const senza = Object.values(pokemonData).filter(v => v.gender == null).length
    expect(
      senza,
      'il dato sul sesso è arrivato: Rivalry si può fare, aggiornare docs/lavoro-aperto.md',
    ).toBeGreaterThan(500)
  })
})

describe('e le due mezze abilità trovate a mano restano intere', () => {
  it('Magic Guard e Heatproof hanno tutt\'e due le metà', () => {
    // Sono l'esempio che il documento porta per spiegare la forma. Se una
    // delle due tornasse a metà, l'esempio sarebbe ancora vero — ma per il
    // motivo sbagliato.
    expect(ABILITY_EFFECTS['magic-guard'].annullaContraccolpo).toBe(true)
    expect(ABILITY_EFFECTS['magic-guard'].annullaDannoDaStato).toBe(true)
    expect(ABILITY_EFFECTS['heatproof'].heatproof).toBe(true)
    expect(ABILITY_EFFECTS['heatproof'].dimezzaBruciatura).toBe(true)
  })
})
