/**
 * src/__tests__/knockoff.test.js
 *
 * Sessione D — Knock Off e gli strumenti inamovibili.
 *
 * La regola non è «le Megapietre non si tolgono», è «uno strumento è
 * inamovibile solo per il Pokémon a cui appartiene». Il golden copre un solo
 * caso (Gholdengo con la Garchompite); qui copriamo le tre configurazioni che
 * la regola distingue, così se qualcuno un giorno la risemplificasse in
 * «è una Megapietra?» questi test lo direbbero subito.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'

const INCINEROAR = {
  atkPokemon: 'incineroar', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
  atkAbility: null, atkItem: null, level: 50,
}

const difensore = (defPokemon, defItem) => ({
  defPokemon, defSPs: [32, 0, 18, 0, 16, 0], defNature: 'careful',
  defAbility: null, defItem, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})

const knockOff = (defPokemon, defItem) => calculateDamage({
  attacker: INCINEROAR, defender: difensore(defPokemon, defItem),
  move: 'knock off', field: {}, debug: false,
})

describe('Knock Off — il ×1.5 sugli strumenti rimovibili', () => {
  it('senza strumento non prende il bonus', () => {
    const nudo = knockOff('gholdengo', null)
    const conBacca = knockOff('gholdengo', 'sitrus berry')
    expect(conBacca.minDmg).toBeGreaterThan(nudo.minDmg)
  })

  it('la Garchompite su Gholdengo si può togliere: bonus applicato', () => {
    expect(knockOff('gholdengo', 'garchompite').rolls)
      .toEqual(knockOff('gholdengo', 'sitrus berry').rolls)
  })

  it('la Garchompite su Garchomp NON si può togliere: niente bonus', () => {
    expect(knockOff('garchomp', 'garchompite').rolls)
      .toEqual(knockOff('garchomp', null).rolls)
  })

  it('vale anche quando il difensore è già la forma Mega', () => {
    expect(knockOff('garchomp-mega', 'garchompite').rolls)
      .toEqual(knockOff('garchomp-mega', null).rolls)
  })

  it('le due pietre di Charizard sono inamovibili entrambe sul loro Charizard', () => {
    for (const pietra of ['charizardite x', 'charizardite y']) {
      expect(knockOff('charizard', pietra).rolls, pietra)
        .toEqual(knockOff('charizard', null).rolls)
    }
  })

  it('ma la Charizardite X addosso a un altro Pokémon si toglie', () => {
    expect(knockOff('gholdengo', 'charizardite x').rolls)
      .toEqual(knockOff('gholdengo', 'sitrus berry').rolls)
  })
})
