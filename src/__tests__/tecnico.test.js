// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/tecnico.test.js
 *
 * Tecnico (`technician`): ×1,5 sulle mosse con potenza 60 o meno.
 *
 * ─── L'ULTIMA FATTIBILE DELLE SEI, E LA PIÙ DIVERSA ────────────────────────
 *
 * Il ramo delle «1.5x Abilities» (`damage_MASTER.js:1668`) ne raccoglie sei.
 * Cinque guardano la MOSSA — è un impulso, è un morso, è di tipo Acciaio.
 * Questa guarda un NUMERO, e il numero non è quello scritto nei dati della
 * mossa: è la potenza già passata per i modificatori precedenti.
 *
 * Il riferimento la calcola apposta, fra il punto f e il punto g, e mette un
 * commento sopra (`damage_MASTER.js:1665`):
 *
 *     //If the BP before this point would trigger Technician, don't apply it
 *     var tempBP = pokeRound(basePower * chainMods(bpMods) / 0x1000);
 *
 * ─── PERCHÉ QUESTO CAMBIA LE REGOLE DELLA CATENA ───────────────────────────
 *
 * Il commento in cima alla catena della potenza, in `calcEngine.js`, diceva
 * che l'ordine dei push non sposta nessun numero — con pochi modificatori
 * `chainMods` è commutativo — e che il riordino serviva «per quando la catena
 * si allargherà».
 *
 * Si è allargata oggi. Da adesso un modificatore spinto PRIMA di `tempBP` può
 * spegnere Tecnico, e uno spinto DOPO no. La posizione di ogni push è
 * diventata parte della trascrizione, non una scelta di stile.
 *
 * I due test in fondo sono lì per questo, e sono i più importanti del file:
 * uno prova che un modificatore SUCCESSIVO non spegne Tecnico, l'altro che uno
 * PRECEDENTE lo spegne. Con `tempBP` messo in fondo alla catena — che è dove
 * l'avevo messo alla prima stesura — il primo fallisce.
 *
 * ─── PERCHÉ ADESSO E NON PRIMA ─────────────────────────────────────────────
 *
 * Perché tocca un set del meta: `maushold` «Population Bomb Attacker».
 * Infestazione ha potenza 20, quindi ogni colpo passa largamente sotto la
 * soglia. Attenzione però a cosa vuol dire «tocca il set»: qui si sistema il
 * danno di UN colpo. Che i colpi siano fino a dieci è un'altra cosa, non
 * modellata (`hitRange`, §1.11), e non la sistema questo file.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

// Il set del meta, com'è scritto in `metaPresets.js`.
const maushold = (atkAbility) => ({
  atkPokemon: 'maushold', atkSPs: [2, 32, 0, 0, 0, 32], atkNature: 'jolly',
  atkAbility, atkItem: null, level: 50,
})
const bersaglio = (defAbility = null, defPokemon = 'incineroar') => ({
  defPokemon, defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const nostro = (atkAbility, move, field = {}, defender = bersaglio()) =>
  calculateDamage({ attacker: maushold(atkAbility), defender, move, field, debug: false })

describe('la soglia è sui 60 compresi', () => {
  it('le due mosse di prova stanno una da una parte e una dall\'altra', () => {
    // I numeri che rendono sensati i test sotto, letti dai dati invece che
    // creduti: se un giorno cambiassero, i test direbbero il falso in
    // silenzio.
    expect(movesData['aerial ace'].power).toBe(60)
    expect(movesData['stomp'].power).toBe(65)
    expect(movesData['population bomb'].power).toBe(20)
  })

  it('a 60 si accende', () => {
    expect(nostro('technician', 'aerial ace').maxDmg)
      .toBeGreaterThan(nostro(null, 'aerial ace').maxDmg)
  })

  it('a 65 no', () => {
    expect(nostro('technician', 'stomp').rolls).toEqual(nostro(null, 'stomp').rolls)
  })
})

describe('Tecnico, contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const casi = [
    ['Infestazione, il colpo del set del meta', 'technician', 'population bomb', {}, bersaglio()],
    ['Fintoattacco, 30 di potenza',              'technician', 'feint',           {}, bersaglio()],
    ['Aeroassalto, esattamente 60',              'technician', 'aerial ace',      {}, bersaglio()],
    ['Pestone, 65: sopra la soglia',             'technician', 'stomp',           {}, bersaglio()],
    ['Infestazione senza l\'abilità',           null,         'population bomb', {}, bersaglio()],
    // I due che riguardano l'ORDINE della catena.
    ['Aeroassalto con Aiutone — spinto DOPO',    'technician', 'aerial ace', { helpingHand: true }, bersaglio()],
    ['Assorbibacio contro un\'Aura Fatata — spinta PRIMA',
      'technician', 'draining kiss', {}, bersaglio('fairy-aura', 'xerneas')],
    ['Assorbibacio senza aura',                 'technician', 'draining kiss', {}, bersaglio(null, 'xerneas')],
  ]

  for (const [nome, atkAbility, move, field, defender] of casi) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker: maushold(atkAbility), defender, move, field })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(atkAbility, move, field, defender).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})

describe('la soglia si misura sulla potenza GIÀ modificata', () => {
  // I due test che rendono osservabile l'ordine della catena. Sono la ragione
  // per cui `tempBP` sta dov'è e non in fondo.

  it('un modificatore spinto DOPO non spegne Tecnico', () => {
    // Aiutone è il punto s del riferimento, cioè dopo. Aeroassalto è a 60:
    // se `tempBP` si calcolasse a fine catena vedrebbe 90 e Tecnico si
    // spegnerebbe. Misurato: con Aiutone e Tecnico il danno resta ×1,5 sopra
    // quello con il solo Aiutone.
    const conAbilita = nostro('technician', 'aerial ace', { helpingHand: true })
    const senza      = nostro(null,         'aerial ace', { helpingHand: true })
    expect(conAbilita.maxDmg, 'Tecnico si è spento per colpa di Aiutone')
      .toBeGreaterThan(senza.maxDmg)
  })

  it('un modificatore spinto PRIMA lo spegne davvero', () => {
    // L'Aura Fatata è il punto f, cioè prima. Assorbibacio ha potenza 50:
    // 50 × 1,33 fa 67, che è sopra la soglia. Quindi contro un difensore con
    // l'Aura Fatata, Tecnico NON si accende — e il danno è identico a quello
    // di chi l'abilità non ce l'ha.
    //
    // È il caso che nessun test avrebbe potuto costruire prima di questa
    // settimana: serviva che le aure fossero implementate.
    const conAura = bersaglio('fairy-aura', 'xerneas')
    const senzAura = bersaglio(null, 'xerneas')

    expect(
      nostro('technician', 'draining kiss', {}, conAura).rolls,
      'Tecnico si è acceso su una potenza che l\'aura aveva già portato a 67',
    ).toEqual(nostro(null, 'draining kiss', {}, conAura).rolls)

    // Controllo positivo: senza l'aura la stessa mossa Tecnico ce l'ha.
    // Senza questo, il test sopra passerebbe anche se Tecnico non funzionasse
    // affatto.
    expect(nostro('technician', 'draining kiss', {}, senzAura).maxDmg)
      .toBeGreaterThan(nostro(null, 'draining kiss', {}, senzAura).maxDmg)
  })
})
