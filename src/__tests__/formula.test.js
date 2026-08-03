/**
 * src/__tests__/formula.test.js
 *
 * Sessione D — due gruppi di regole che i golden non coprivano.
 *
 * ─── PERCHÉ NON BASTAVANO I GOLDEN ─────────────────────────────────────────
 * Dopo aver corretto il critico contro i boost, `snapshot:diff` ha detto
 * ZERO divergenze. Non perché la correzione non facesse niente, ma perché
 * nei 318 casi di caratterizzazione non ce n'è nemmeno uno che metta insieme
 * un critico e un boost. Un cambiamento vero e invisibile al termometro: è
 * esattamente il caso in cui bisogna scrivere il test a mano, prima di
 * andare avanti e dimenticarsene.
 *
 * Stessa storia per Fire Mane, spostata di catena perché lo dice il motore di
 * riferimento e non perché un test fosse rosso.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'

const attaccante = (extra = {}) => ({
  atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
  atkAbility: null, atkItem: null, atkBoost: 0, spAtkBoost: 0, atkDefBoost: 0,
  atkAbilityFlags: {}, level: 50, ...extra,
})

const difensore = (extra = {}) => ({
  defPokemon: 'incineroar', defSPs: [32, 0, 18, 0, 16, 0], defNature: 'careful',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, ...extra,
})

const calc = (atk, def, move, field = {}) =>
  calculateDamage({ attacker: atk, defender: def, move, field, debug: false })

// ───────────────────────────────────────────────────────────────────────────

describe('critico — quali boost ignora', () => {
  const crit = { crit: true }

  it('ignora il CALO di attacco dell\'attaccante', () => {
    expect(calc(attaccante({ atkBoost: -2 }), difensore(), 'earthquake', crit).rolls)
      .toEqual(calc(attaccante(), difensore(), 'earthquake', crit).rolls)
  })

  it('ignora il BOOST di difesa del bersaglio', () => {
    expect(calc(attaccante(), difensore({ defBoost: 2 }), 'earthquake', crit).rolls)
      .toEqual(calc(attaccante(), difensore(), 'earthquake', crit).rolls)
  })

  it('NON ignora il boost di attacco dell\'attaccante', () => {
    expect(calc(attaccante({ atkBoost: 2 }), difensore(), 'earthquake', crit).minDmg)
      .toBeGreaterThan(calc(attaccante(), difensore(), 'earthquake', crit).minDmg)
  })

  it('NON ignora il calo di difesa del bersaglio', () => {
    expect(calc(attaccante(), difensore({ defBoost: -2 }), 'earthquake', crit).minDmg)
      .toBeGreaterThan(calc(attaccante(), difensore(), 'earthquake', crit).minDmg)
  })

  it('senza critico i boost sfavorevoli continuano a contare', () => {
    expect(calc(attaccante({ atkBoost: -2 }), difensore(), 'earthquake').minDmg)
      .toBeLessThan(calc(attaccante(), difensore(), 'earthquake').minDmg)
    expect(calc(attaccante(), difensore({ defBoost: 2 }), 'earthquake').minDmg)
      .toBeLessThan(calc(attaccante(), difensore(), 'earthquake').minDmg)
  })

  it('vale anche sul lato speciale', () => {
    const spec = attaccante({ atkPokemon: 'gholdengo', spAtkBoost: -2, atkNature: 'modest' })
    const base = attaccante({ atkPokemon: 'gholdengo', atkNature: 'modest' })
    expect(calc(spec, difensore({ spDefBoost: 2 }), 'shadow ball', crit).rolls)
      .toEqual(calc(base, difensore(), 'shadow ball', crit).rolls)
  })
})

// ───────────────────────────────────────────────────────────────────────────

describe('abilità difensive — non sono più rami morti', () => {
  const meno = (def, move, atk = attaccante()) =>
    expect(calc(atk, def, move).maxDmg).toBeLessThan(calc(atk, difensore(), move).maxDmg)

  it('Fur Coat dimezza il fisico', () => meno(difensore({ defAbility: 'fur coat' }), 'earthquake'))

  it('Fur Coat non tocca lo speciale', () => {
    const spec = attaccante({ atkPokemon: 'gholdengo', atkNature: 'modest' })
    expect(calc(spec, difensore({ defAbility: 'fur coat' }), 'shadow ball').rolls)
      .toEqual(calc(spec, difensore(), 'shadow ball').rolls)
  })

  it('Ice Scales dimezza lo speciale', () => {
    const spec = attaccante({ atkPokemon: 'gholdengo', atkNature: 'modest' })
    meno(difensore({ defAbility: 'ice scales' }), 'shadow ball', spec)
  })

  it('Heatproof riduce il Fuoco', () => {
    const fuoco = attaccante({ atkPokemon: 'charizard', atkNature: 'modest' })
    const conAbil = difensore({ defPokemon: 'venusaur', defAbility: 'heatproof' })
    const senza   = difensore({ defPokemon: 'venusaur' })
    expect(calc(fuoco, conAbil, 'flamethrower').maxDmg)
      .toBeLessThan(calc(fuoco, senza, 'flamethrower').maxDmg)
  })

  it('Filter e Solid Rock riducono solo le super efficaci', () => {
    for (const abil of ['filter', 'solid rock']) {
      // Terremoto su Incineroar (Fuoco/Buio) è super efficace
      meno(difensore({ defAbility: abil }), 'earthquake')
    }
  })
})

describe('Fire Mane — spostata nella catena d\'attacco', () => {
  // Nessun golden la copriva: lo spostamento è nato leggendo NCP. Questo test
  // verifica almeno che l'effetto continui a esistere e sia limitato al Fuoco.
  const pyroar = (abil) => attaccante({
    atkPokemon: 'pyroar-mega', atkNature: 'modest', atkSPs: [0, 0, 0, 32, 0, 0], atkAbility: abil,
  })

  it('potenzia le mosse Fuoco', () => {
    const con = calc(pyroar('fire mane'), difensore({ defPokemon: 'venusaur' }), 'flamethrower')
    const senza = calc(pyroar(null), difensore({ defPokemon: 'venusaur' }), 'flamethrower')
    expect(con.minDmg).toBeGreaterThan(senza.minDmg)
  })

  it('non tocca gli altri tipi', () => {
    const con = calc(pyroar('fire mane'), difensore({ defPokemon: 'venusaur' }), 'hyper voice')
    const senza = calc(pyroar(null), difensore({ defPokemon: 'venusaur' }), 'hyper voice')
    expect(con.rolls).toEqual(senza.rolls)
  })
})

describe('Punching Glove', () => {
  const glove = attaccante({ atkItem: 'punching glove' })

  it('potenzia i pugni', () => {
    expect(calc(glove, difensore(), 'drain punch').minDmg)
      .toBeGreaterThan(calc(attaccante(), difensore(), 'drain punch').minDmg)
  })

  it('non potenzia le altre fisiche — era il bug §1.10', () => {
    expect(calc(glove, difensore(), 'earthquake').rolls)
      .toEqual(calc(attaccante(), difensore(), 'earthquake').rolls)
  })

  it('toglie il contatto al pugno, quindi Tough Claws smette di applicarsi', () => {
    const tcGuanto = attaccante({ atkAbility: 'tough claws', atkItem: 'punching glove' })
    // Col guanto il pugno non è più una mossa contatto: Tough Claws non vede
    // più niente e il danno coincide con quello di chi non ce l'ha.
    expect(calc(tcGuanto, difensore(), 'drain punch').rolls)
      .toEqual(calc(glove, difensore(), 'drain punch').rolls)
    // Senza guanto invece Tough Claws si applica eccome.
    expect(calc(attaccante({ atkAbility: 'tough claws' }), difensore(), 'drain punch').minDmg)
      .toBeGreaterThan(calc(attaccante(), difensore(), 'drain punch').minDmg)
  })
})

describe('Eviolite', () => {
  it('funziona su chi può ancora evolversi', () => {
    const chansey = difensore({ defPokemon: 'chansey', defItem: 'eviolite' })
    const nudo = difensore({ defPokemon: 'chansey' })
    expect(calc(attaccante(), chansey, 'earthquake').maxDmg)
      .toBeLessThan(calc(attaccante(), nudo, 'earthquake').maxDmg)
  })

  it('non fa niente su chi è già completamente evoluto', () => {
    expect(calc(attaccante(), difensore({ defItem: 'eviolite' }), 'earthquake').rolls)
      .toEqual(calc(attaccante(), difensore(), 'earthquake').rolls)
  })
})
