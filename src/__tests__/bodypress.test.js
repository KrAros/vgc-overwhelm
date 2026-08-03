/**
 * src/__tests__/bodypress.test.js
 *
 * Sessione D — Body Press legge lo stage giusto.
 *
 * ─── IL BUG, IN UNA RIGA ───────────────────────────────────────────────────
 * Il motore sceglieva il boost con `isSpecial ? spAtkBoost : atkBoost`, cioè
 * guardando la CATEGORIA della mossa. Body Press è fisica, quindi prendeva il
 * boost di Attacco — ma attacca con la Difesa. Un Registeel a Difesa −1 e
 * Attacco 0 tirava un Body Press a piena potenza; a Difesa 0 e Attacco +2 ne
 * tirava uno da +2. Entrambe le volte il numero era slegato dalla realtà.
 *
 * ─── PERCHÉ I TEST SONO RELAZIONI E NON NUMERI ─────────────────────────────
 * Come in `screens.test.js`: i numeri assoluti cambieranno ancora dentro
 * questa sessione (le quattro catene, `chainMods`). Le relazioni no. «Con la
 * Difesa a +2 il Body Press picchia più forte che a +0» resta vera qualunque
 * cosa faccia l'aritmetica intorno.
 *
 * La regola completa è su Bulbapedia: si applicano gli stage di Difesa al
 * posto di quelli di Attacco, ma per il resto valgono i modificatori
 * offensivi (strumento, abilità, bruciatura).
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'

// Registeel: Difesa base 150, Attacco base 75. La forbice fra le due è così
// larga che qualunque scambio fra i due stage salta all'occhio.
const registeel = (extra = {}) => ({
  atkPokemon: 'registeel', atkSPs: [32, 0, 32, 0, 0, 0], atkNature: 'hardy',
  atkAbility: null, atkItem: null, atkBoost: 0, spAtkBoost: 0, atkDefBoost: 0,
  level: 50, ...extra,
})

const INCINEROAR = {
  defPokemon: 'incineroar', defSPs: [32, 0, 18, 0, 16, 0], defNature: 'careful',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}

const bodyPress = (attacker, defender = INCINEROAR) =>
  calculateDamage({ attacker, defender, move: 'body press', field: {}, debug: false })

const neutro = () => bodyPress(registeel())

describe('Body Press — quale stage conta', () => {
  it('il boost di Difesa aumenta il danno', () => {
    expect(bodyPress(registeel({ atkDefBoost: 2 })).minDmg)
      .toBeGreaterThan(neutro().minDmg)
  })

  it('il calo di Difesa lo riduce', () => {
    expect(bodyPress(registeel({ atkDefBoost: -1 })).minDmg)
      .toBeLessThan(neutro().minDmg)
  })

  it('il boost di Attacco non cambia niente', () => {
    expect(bodyPress(registeel({ atkBoost: 2 })).rolls).toEqual(neutro().rolls)
  })

  it('il calo di Attacco non cambia niente', () => {
    expect(bodyPress(registeel({ atkBoost: -2 })).rolls).toEqual(neutro().rolls)
  })

  it('una mossa fisica normale continua a leggere il boost di Attacco', () => {
    const conAtk = calculateDamage({
      attacker: registeel({ atkBoost: 2 }), defender: INCINEROAR,
      move: 'iron head', field: {}, debug: false,
    })
    const senza = calculateDamage({
      attacker: registeel(), defender: INCINEROAR,
      move: 'iron head', field: {}, debug: false,
    })
    expect(conAtk.minDmg).toBeGreaterThan(senza.minDmg)
  })
})

describe('Body Press — Intimidate', () => {
  // Intimidate abbassa lo stage di ATTACCO. Body Press usa quelli di Difesa,
  // quindi non deve accorgersene. Prima della correzione il motore sottraeva
  // uno stadio a `atkBoostVal` senza guardare quale statistica fosse.
  const conIntimidate = {
    ...INCINEROAR,
    defAbility: 'intimidate',
    defAbilityFlags: { intimidateActive: true },
  }

  it('Intimidate non indebolisce Body Press', () => {
    expect(bodyPress(registeel(), conIntimidate).rolls)
      .toEqual(bodyPress(registeel(), INCINEROAR).rolls)
  })

  it('Intimidate indebolisce invece una mossa fisica normale', () => {
    const con = calculateDamage({
      attacker: registeel(), defender: conIntimidate,
      move: 'iron head', field: {}, debug: false,
    })
    const senza = calculateDamage({
      attacker: registeel(), defender: INCINEROAR,
      move: 'iron head', field: {}, debug: false,
    })
    expect(con.minDmg).toBeLessThan(senza.minDmg)
  })
})

describe('Body Press — modificatori offensivi', () => {
  // «Per il resto valgono i modificatori d'Attacco»: Choice Band alza il
  // Body Press anche se il Body Press non usa l'Attacco.
  it('Choice Band potenzia comunque Body Press', () => {
    expect(bodyPress(registeel({ atkItem: 'choice band' })).minDmg)
      .toBeGreaterThan(neutro().minDmg)
  })
})
