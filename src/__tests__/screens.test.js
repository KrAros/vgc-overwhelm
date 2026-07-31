/**
 * src/__tests__/screens.test.js
 *
 * Sessione G — gli schermi.
 *
 * ─── COSA COPRE, E PERCHÉ NON BASTAVA IL GOLDEN ────────────────────────────
 * Il file golden verifica dei NUMERI contro NCP. Questo verifica delle REGOLE:
 * quale schermo si applica, quanti se ne applicano, e chi li attraversa.
 * Sono due domande diverse. Un numero giusto per caso non dimostra che la
 * regola sia giusta, e una regola può essere giusta in un matchup e sbagliata
 * in un altro senza che il golden se ne accorga.
 *
 * Quasi tutti i test qui sotto sono espressi come RELAZIONI fra due calcoli
 * («questo dev'essere identico a quello», «questo dev'essere maggiore»),
 * non come valori assoluti. Così restano validi anche dopo la sessione D,
 * che cambierà i numeri ma non queste regole.
 *
 *   1. il valore dei doppi (2732) e non quello dei singoli (2048)
 *   2. gli schermi non si sommano — Aurora Veil ha la precedenza
 *   3. Reflect guarda la categoria della mossa, non la difesa che colpisce
 *   4. critico, Brick Break/Psychic Fangs/Raging Bull e Infiltrator li bucano
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'
import { SCREEN_MOD, SCREEN_MOD_DOUBLES, SCREEN_MOD_SINGLES, FORMAT } from '../lib/rules.js'
import { pokeRound, FIXED_POINT } from '../lib/modifiers.js'

// ─── Attori ─────────────────────────────────────────────────────────────────
// Garchomp / Venusaur: la stessa coppia dei golden 01–04, dove il motore
// riproduce NCP roll per roll. Partire da una base verificata significa che
// un fallimento qui riguarda lo schermo e nient'altro.

const GARCHOMP = {
  atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'hardy',
  atkAbility: 'sand veil', atkItem: null, level: 50,
}
const VENUSAUR = {
  defPokemon: 'venusaur', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy',
  defAbility: 'chlorophyll', defItem: null,
}
// Ruoli invertiti, per il ramo speciale (Light Screen).
const VENUSAUR_ATT = {
  atkPokemon: 'venusaur', atkSPs: [32, 0, 32, 0, 0, 0], atkNature: 'hardy',
  atkAbility: 'chlorophyll', atkItem: null, level: 50,
}
const GARCHOMP_DIF = {
  defPokemon: 'garchomp', defSPs: [0, 32, 0, 0, 0, 0], defNature: 'hardy',
  defAbility: 'sand veil', defItem: null,
}

/** Esegue un calcolo e restituisce i 16 roll. */
function rolls(attacker, defender, move, field = {}) {
  const r = calculateDamage({ attacker, defender, move, field, debug: false })
  expect(r, `il calcolo di "${move}" ha restituito null`).not.toBeNull()
  return r.rolls
}

/** Il caso di riferimento: attacco fisico, nessuno schermo. */
const fisico = (field) => rolls(GARCHOMP, VENUSAUR, 'high horsepower', field)
/** Attacco speciale, nessuno schermo. */
const speciale = (field) => rolls(VENUSAUR_ATT, GARCHOMP_DIF, 'energy ball', field)

// ────────────────────────────────────────────────────────────────────────────

describe('schermi — il valore è quello dei doppi', () => {
  it('FORMAT è doubles e SCREEN_MOD vale 2732', () => {
    // Se un giorno qualcuno cambia FORMAT, questo test glielo ricorda: non è
    // una costante innocua, è il moltiplicatore di ogni calcolo con schermo.
    expect(FORMAT).toBe('doubles')
    expect(SCREEN_MOD_DOUBLES).toBe(2732)
    expect(SCREEN_MOD_SINGLES).toBe(2048)
    expect(SCREEN_MOD).toBe(SCREEN_MOD_DOUBLES)
  })

  it('Reflect riduce di circa un terzo, non della metà', () => {
    const senza = fisico({})
    const con   = fisico({ reflect: true })

    // Ogni roll è il roll senza schermo passato per 2732/4096.
    // È la formulazione più forte possibile: vincola tutti e 16 i valori,
    // non solo il minimo e il massimo.
    const atteso = senza.map(d => pokeRound(d * SCREEN_MOD / FIXED_POINT))
    expect(con).toEqual(atteso)
  })

  it('il danno con Reflect è nettamente sopra la metà del danno pieno', () => {
    // Il bug che G corregge in una frase: prima il danno con schermo era
    // esattamente metà. Questo test lo rende irripetibile.
    const senza = fisico({})
    const con   = fisico({ reflect: true })
    for (let i = 0; i < senza.length; i++) {
      expect(con[i]).toBeGreaterThan(Math.floor(senza[i] * 0.5))
      expect(con[i]).toBeLessThan(senza[i])
    }
  })
})

describe('schermi — se ne applica uno solo', () => {
  it('Reflect e Aurora Veil insieme non raddoppiano la riduzione', () => {
    // Nell'interfaccia sono tre interruttori indipendenti, quindi un utente
    // può accenderli entrambi. Prima di G il danno veniva ridotto due volte.
    const soloVeil = fisico({ auroraVeil: true })
    const entrambi = fisico({ reflect: true, auroraVeil: true })
    expect(entrambi).toEqual(soloVeil)
  })

  it('Aurora Veil ha la precedenza su Reflect', () => {
    // Coincidono per valore, ma l'ordine è quello di NCP e va tenuto:
    // se un giorno i due moltiplicatori divergessero, questo test lo coglie.
    const soloReflect = fisico({ reflect: true })
    const entrambi    = fisico({ reflect: true, auroraVeil: true })
    expect(entrambi).toEqual(soloReflect)
  })

  it('tutti e tre insieme riducono una volta sola', () => {
    const uno  = fisico({ auroraVeil: true })
    const tre  = fisico({ reflect: true, lightScreen: true, auroraVeil: true })
    expect(tre).toEqual(uno)
  })
})

describe('schermi — la categoria della mossa decide quale schermo vale', () => {
  it('Light Screen non tocca una mossa fisica', () => {
    expect(fisico({ lightScreen: true })).toEqual(fisico({}))
  })

  it('Reflect non tocca una mossa speciale', () => {
    expect(speciale({ reflect: true })).toEqual(speciale({}))
  })

  it('Light Screen riduce una mossa speciale', () => {
    const senza = speciale({})
    const con   = speciale({ lightScreen: true })
    expect(con).toEqual(senza.map(d => pokeRound(d * SCREEN_MOD / FIXED_POINT)))
  })

  it('Aurora Veil riduce entrambe le categorie', () => {
    expect(fisico({ auroraVeil: true })).not.toEqual(fisico({}))
    expect(speciale({ auroraVeil: true })).not.toEqual(speciale({}))
  })

  it('Body Press passa da Reflect: conta la categoria, non la difesa usata', () => {
    // Body Press è fisica ma calcola con la Difesa dell'attaccante. NCP mette
    // un commento esplicito su questo punto, quindi merita un test esplicito.
    const senza = rolls(GARCHOMP, VENUSAUR, 'body press', {})
    const con   = rolls(GARCHOMP, VENUSAUR, 'body press', { reflect: true })
    expect(con).toEqual(senza.map(d => pokeRound(d * SCREEN_MOD / FIXED_POINT)))
    // e non da Light Screen
    expect(rolls(GARCHOMP, VENUSAUR, 'body press', { lightScreen: true })).toEqual(senza)
  })
})

describe('schermi — chi li attraversa', () => {
  it('un colpo critico ignora lo schermo', () => {
    const critico = fisico({ crit: true })
    expect(fisico({ crit: true, reflect: true })).toEqual(critico)
    expect(fisico({ crit: true, auroraVeil: true })).toEqual(critico)
    expect(fisico({ crit: true, lightScreen: true })).toEqual(critico)
  })

  it.each(['brick break', 'psychic fangs', 'raging bull'])(
    '%s attraversa Reflect e Aurora Veil',
    (mossa) => {
      const senza = rolls(GARCHOMP, VENUSAUR, mossa, {})
      expect(rolls(GARCHOMP, VENUSAUR, mossa, { reflect: true })).toEqual(senza)
      expect(rolls(GARCHOMP, VENUSAUR, mossa, { auroraVeil: true })).toEqual(senza)
    }
  )

  it('una mossa fisica qualunque NON attraversa Reflect', () => {
    // Il complemento del test sopra: senza questo, un bug che disattiva gli
    // schermi per tutti passerebbe inosservato.
    const senza = rolls(GARCHOMP, VENUSAUR, 'crunch', {})
    expect(rolls(GARCHOMP, VENUSAUR, 'crunch', { reflect: true })).not.toEqual(senza)
  })

  it('Infiltrator attraversa qualunque schermo', () => {
    const conInfiltrator = { ...GARCHOMP, atkAbility: 'infiltrator' }
    const senza = rolls(conInfiltrator, VENUSAUR, 'high horsepower', {})
    expect(rolls(conInfiltrator, VENUSAUR, 'high horsepower', { reflect: true })).toEqual(senza)
    expect(rolls(conInfiltrator, VENUSAUR, 'high horsepower', { auroraVeil: true })).toEqual(senza)
  })

  it('Infiltrator non cambia nulla senza schermi', () => {
    // Un bypass che alterasse il danno di suo sarebbe un bug peggiore di
    // quello che stiamo correggendo.
    const conInfiltrator = { ...GARCHOMP, atkAbility: 'infiltrator' }
    expect(rolls(conInfiltrator, VENUSAUR, 'high horsepower', {})).toEqual(fisico({}))
  })
})

describe('schermi — indipendenti da doubleTarget', () => {
  it('lo schermo si applica anche con un solo bersaglio in campo', () => {
    // `doubleTarget` governa la penalità del 25% sulle mosse ad area, NON il
    // formato. In doppio con un nemico solo rimasto la penalità cade, ma lo
    // schermo resta ridotto di un terzo. Legare i due valori sarebbe stato
    // l'errore facile di questa sessione.
    const senza = fisico({ doubleTarget: false })
    const con   = fisico({ doubleTarget: false, reflect: true })
    expect(con).toEqual(senza.map(d => pokeRound(d * SCREEN_MOD / FIXED_POINT)))
  })

  it('la penalità area e lo schermo sono due riduzioni distinte', () => {
    const pieno    = rolls(GARCHOMP, VENUSAUR, 'earthquake', {})
    const areaSola = rolls(GARCHOMP, VENUSAUR, 'earthquake', { doubleTarget: true })
    const entrambe = rolls(GARCHOMP, VENUSAUR, 'earthquake', { doubleTarget: true, reflect: true })
    expect(areaSola[0]).toBeLessThan(pieno[0])
    expect(entrambe[0]).toBeLessThan(areaSola[0])
  })
})