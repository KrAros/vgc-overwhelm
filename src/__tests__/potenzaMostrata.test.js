// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/potenzaMostrata.test.js
 *
 * Che la potenza scritta accanto alla mossa sia quella che il motore usa.
 *
 * ─── PERCHÉ IL CRITERIO È L'UGUAGLIANZA, E NON UN NUMERO ───────────────────
 *
 * `calculateDamage` restituisce `effectiveBP`: la potenza che ha davvero
 * usato, prima della catena dei moltiplicatori. Quindi il confronto si può
 * fare fra due numeri veri, invece che fra un numero e una mia aspettativa
 * riscritta a mano.
 *
 * È la differenza fra «Forza Ancestrale a +2 deve dire 60, credo» e «deve dire
 * quello che il motore usa». La prima forma è già stata sbagliata due volte in
 * questa sessione — 90/183 che credevo verde, e il conto della probabilità di
 * KO multi-colpo.
 *
 * ─── E PERCHÉ ANCHE UN CONTROLLO NEGATIVO ──────────────────────────────────
 *
 * Un test che confronta due funzioni può essere verde perché tutt'e due
 * restituiscono lo stesso valore SBAGLIATO — per esempio il dato grezzo, se
 * l'una e l'altra si fermassero lì. Quindi ogni caso dice anche che il numero
 * si è MOSSO rispetto a `moves.json`: se un domani `potenzaMostrata` tornasse
 * a restituire il dato grezzo, questo file diventerebbe rosso invece di
 * accompagnarla.
 */

import { describe, it, expect } from 'vitest'
import { potenzaMostrata } from '../lib/potenzaMostrata.js'
import { calculateDamage } from '../calcEngine.js'
import { buildAttackerInput, buildDefenderInput } from '../lib/battleState.js'
import { emptyPokemon } from '../store/useCalcStore.js'
import movesData from '../data/moves.json' with { type: 'json' }

const slot = (extra = {}) => ({ ...emptyPokemon(), ...extra })

/** Il difensore è sempre lo stesso e non entra in nessuna delle otto formule. */
const DIFENSORE = slot({ key: 'amoonguss' })

/** La potenza che il motore usa davvero, per questa mossa da questo slot. */
function potenzaDelMotore(mossa, atk, campo = {}) {
  const r = calculateDamage({
    attacker: buildAttackerInput(atk),
    defender: buildDefenderInput(DIFENSORE),
    move: mossa,
    field: campo,
  })
  expect(r, `il motore non calcola ${mossa}`).not.toBeNull()
  return r.effectiveBP
}

// ─── Le otto che l'editor può sapere ────────────────────────────────────────

/**
 * [descrizione, mossa, slot di chi tira, campo]
 *
 * Ogni riga è un caso in cui il dato grezzo di `moves.json` NON è la risposta.
 */
const CASI = [
  ['Forza Ancestrale a +2 in due statistiche',
    'stored power', slot({ key: 'garchomp', atkBoost: 2, speBoost: 2 }), {}],
  ['Sfoggio a +1',
    'power trip', slot({ key: 'garchomp', atkBoost: 1 }), {}],
  ['Forza Ancestrale con uno stadio NEGATIVO — che non conta',
    'stored power', slot({ key: 'garchomp', atkBoost: 3, defBoost: -2 }), {}],
  // ─── IL CASO CHE DISTINGUE «STADI EFFETTIVI» DA «STADI MESSI A MANO» ────
  //
  // Spadelnvitta dà +1 all'Attacco all'entrata: nello store lo stadio è zero,
  // e il motore ne conta uno. Senza questa riga si può leggere `slot.atkBoost`
  // invece degli stadi preparati e restare verdi — provato, e restava verde.
  //
  // È il motivo per cui la funzione chiama `stadiEffettivi` e non fa il conto
  // per conto suo.
  ['Forza Ancestrale su chi ha Spadelnvitta, con lo stadio a zero nello store',
    'stored power', slot({ key: 'zacian', ability: 'Intrepid Sword' }), {}],
  ['Forza Ancestrale con Spadelnvitta E uno stadio messo a mano',
    'stored power', slot({ key: 'zacian', ability: 'Intrepid Sword', speBoost: 2 }), {}],
  ['Acrobazia senza strumento',
    'acrobatics', slot({ key: 'garchomp' }), {}],
  ['Ritorno',      'return',      slot({ key: 'garchomp' }), {}],
  ['Frustrazione', 'frustration', slot({ key: 'garchomp' }), {}],
  ['Ultimatum',    'trump card',  slot({ key: 'garchomp' }), {}],
  ['Ultimo Sigillo con due alleati caduti',
    'last respects', slot({ key: 'houndstone', lastRespectsKOs: 2 }), {}],
  ['Facciatosta con la bruciatura',
    'facade', slot({ key: 'garchomp', status: 'burned' }), {}],
  ['Palla Clima sotto il sole',
    'weather ball', slot({ key: 'garchomp' }), { weather: 'sun' }],
  ['Eruzione a metà vita',
    'eruption', slot({ key: 'torkoal', ps: 70 }), {}],
  ['Rovesciamento quasi morto',
    'reversal', slot({ key: 'garchomp', ps: 3 }), {}],
]

describe('la riga della mossa dice quello che il motore usa', () => {
  it.each(CASI)('%s', (_, mossa, atk, campo) => {
    const mostrata = potenzaMostrata(mossa, atk, { meteo: campo.weather ?? null })
    expect(mostrata).toBe(potenzaDelMotore(mossa, atk, campo))
  })

  it.each(CASI)('%s — e il numero si è mosso dal dato grezzo', (_, mossa, atk, campo) => {
    // Il controllo negativo: senza, il file passerebbe anche se
    // `potenzaMostrata` restituisse sempre `movesData[mossa].power` e il
    // motore facesse lo stesso.
    const mostrata = potenzaMostrata(mossa, atk, { meteo: campo.weather ?? null })
    expect(mostrata, 'questo caso non distingue più niente')
      .not.toBe(movesData[mossa].power)
  })
})

describe('e non raddoppia quando non deve', () => {
  it('Facciatosta su un Pokémon sano vale la potenza base', () => {
    // Il caso negativo. Senza, «raddoppia sempre» resterebbe verde: tutti i
    // casi sopra hanno lo stato addosso, quindi non distinguono «raddoppia
    // sullo stato» da «raddoppia».
    const sano = slot({ key: 'garchomp' })
    expect(potenzaMostrata('facade', sano, {})).toBe(movesData['facade'].power)
    expect(potenzaMostrata('facade', sano, {})).toBe(potenzaDelMotore('facade', sano))
  })

  it('e nemmeno con uno stato che non lo accende', () => {
    // `STATI_CHE_ACCENDONO_FACADE` è bruciatura, paralisi e i due veleni: il
    // sonno e il congelamento NON la accendono, ed è la trascrizione del
    // riferimento, non una scelta nostra.
    const addormentato = slot({ key: 'garchomp', status: 'asleep' })
    expect(potenzaMostrata('facade', addormentato, {}))
      .toBe(potenzaDelMotore('facade', addormentato))
    expect(potenzaMostrata('facade', addormentato, {})).toBe(movesData['facade'].power)
  })

  it('Palla Clima senza meteo resta al dato grezzo', () => {
    const s = slot({ key: 'garchomp' })
    expect(potenzaMostrata('weather ball', s, { meteo: null }))
      .toBe(movesData['weather ball'].power)
  })

  it('Ultimo Sigillo senza alleati caduti vale la potenza base', () => {
    const s = slot({ key: 'houndstone' })
    expect(potenzaMostrata('last respects', s, {})).toBe(movesData['last respects'].power)
    expect(potenzaMostrata('last respects', s, {})).toBe(potenzaDelMotore('last respects', s))
  })

  it('Acrobazia CON uno strumento resta a 55', () => {
    const s = slot({ key: 'garchomp', item: 'life orb' })
    expect(potenzaMostrata('acrobatics', s, {})).toBe(movesData['acrobatics'].power)
    expect(potenzaMostrata('acrobatics', s, {})).toBe(potenzaDelMotore('acrobatics', s))
  })
})

// ─── Il confine: quelle che chiedono l'avversario ───────────────────────────

describe('e tace su quelle che l\'editor non può sapere', () => {
  const ATTACCANTE = slot({ key: 'garchomp', atkBoost: 6, item: 'life orb', ps: 40 })

  it.each([
    ['Punizione — gli stadi del bersaglio',        'punishment'],
    ['Presa Ferrea — i suoi punti salute',         'crush grip'],
    ['Strizzata — idem',                           'wring out'],
    ['Pressoduro — idem',                          'hard press'],
    ['Erbafrusta — il suo peso',                   'grass knot'],
    ['Calciobasso — idem',                         'low kick'],
    ['Vortexpalla — tutt\'e due le Velocità',      'gyro ball'],
    ['Elettropalla — idem',                        'electro ball'],
  ])('%s resta a zero, e la riga scrive «—»', (_, mossa) => {
    // Zero e non «un numero qualsiasi»: chi chiama scrive il trattino, e il
    // trattino qui è la risposta GIUSTA. Inventare un numero su un avversario
    // che non c'è sarebbe peggio — è l'errore che questa funzione toglie,
    // rifatto al contrario.
    expect(potenzaMostrata(mossa, ATTACCANTE, {})).toBe(0)
  })

  it.each([
    ['Sciagura',        'hex'],
    ['Velenoshock',     'venoshock'],
    ['Sale Risveglia',  'smelling salts'],
    ['Schiaffosveglia', 'wake-up slap'],
  ])('%s mostra la potenza base: il raddoppio dipende da chi subisce', (_, mossa) => {
    // Queste hanno una potenza vera nei dati, e il ×2 lo decide lo stato
    // dell'AVVERSARIO. Mostrare la base è giusto; mostrare il doppio sarebbe
    // una promessa che l'editor non può mantenere.
    expect(potenzaMostrata(mossa, ATTACCANTE, {})).toBe(movesData[mossa].power)
    expect(movesData[mossa].power).toBeGreaterThan(0)
  })
})

// ─── I casi degeneri ────────────────────────────────────────────────────────

describe('senza dati non si inventa niente', () => {
  it('una mossa che non esiste vale zero', () => {
    for (const m of [null, undefined, '', 'mossa-inventata']) {
      expect(potenzaMostrata(m, slot({ key: 'garchomp' }), {})).toBe(0)
    }
  })

  it('senza Pokémon scelto si mostra il dato grezzo', () => {
    // Il pannello vuoto non deve dichiarare una potenza costruita su un
    // Pokémon che non c'è. Per le tre a potenza assunta invece il numero è
    // giusto comunque: non dipende dal Pokémon.
    for (const vuoto of [null, undefined, {}, slot()]) {
      expect(potenzaMostrata('stored power', vuoto, {})).toBe(20)
      expect(potenzaMostrata('acrobatics', vuoto, {})).toBe(55)
      expect(potenzaMostrata('eruption', vuoto, {})).toBe(150)
      expect(potenzaMostrata('return', vuoto, {})).toBe(102)
    }
  })

  it('una mossa che non ha niente di speciale passa liscia', () => {
    expect(potenzaMostrata('earthquake', slot({ key: 'garchomp' }), {}))
      .toBe(movesData['earthquake'].power)
  })
})
