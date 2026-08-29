// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/aure.test.js
 *
 * Aura Fatata e Aura Oscura: ×1,33 sulle mosse del proprio tipo, da qualunque
 * lato del campo.
 *
 * ─── PERCHÉ IL REGISTRO DEL DIVARIO NON LE VEDEVA ──────────────────────────
 *
 * Non è una svista di chi ha scritto `gen-gap-noti.mjs`: è il punto esatto in
 * cui la sua regola smette di valere.
 *
 * Il generatore cerca il nome dell'abilità nel codice di NCP, per stringa o
 * per identificatore, dopo aver tolto i commenti. Toglie i commenti per una
 * ragione buona e documentata (riga 61 di quel file): `//m. Metronome item` è
 * un commento senza codice sotto, e cercarlo nel testo grezzo darebbe un
 * segnalino sbagliato.
 *
 * Ma qui il nome è COSTRUITO a runtime, `damage_MASTER.js:1568`:
 *
 *     var isAttackerAura = attacker.ability === (move.type + " Aura");
 *
 * Le stringhe "Fairy Aura" e "Dark Aura" non compaiono mai nel codice
 * raggiunto dalla chiusura. Compaiono in un commento — `//f. Fairy Aura, Dark
 * Aura`, riga 1654 — e quel commento viene buttato via. Due difese entrambe
 * corrette, e queste due abilità cadono nel varco fra loro.
 *
 * Che l'incoerenza fosse visibile lo diceva il registro stesso: `aura break`,
 * l'abilità che esiste unicamente per contrastare le aure, è nelle 108. Le
 * aure no.
 *
 * A trovarle è stato `descrizioniSilenziose.test.js`, che guarda da un terzo
 * lato: non cosa fa il riferimento, ma cosa l'app dice di sé. E l'app diceva
 * «potenzia le mosse di tipo Folletto del 33%» mentre non lo faceva.
 *
 * ─── L'ORACOLO ESISTE, E HA RICHIESTO DI APRIRE UNA CASELLA ────────────────
 *
 * NCP le implementa, quindi si verificano roll per roll. Ma non si leggono
 * dall'abilità: `calcBPMods` guarda una casella di spunta della pagina, e il
 * nostro finto jQuery rispondeva "spento" a tutte e quattordici. Non era un
 * oracolo che diceva zero — era un oracolo che non si poteva interrogare.
 *
 * L'harness adesso può accenderle (`prelude.js` §2-bis, `harness.mjs`
 * `CASELLE_DA_ABILITA`). Che la traduzione non stia "aiutando" NCP lo prova
 * il riferimento stesso: nella descrizione che costruisce scrive il nome
 * dell'abilità. Se la casella non volesse dire «c'è un'aura di quel tipo in
 * campo», attribuire il bonus all'abilità sarebbe un errore suo. Il test
 * `il riferimento attribuisce il bonus all'abilità` è lì per questo.
 *
 * ─── LO SNAPSHOT NON COPRIVA IL CASO ───────────────────────────────────────
 *
 * Verificato prima di cominciare: nessun caso dei 586 usa un'aura. Lo snapshot
 * prova quindi che non abbiamo rotto il resto, non che questa cosa sia giusta.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { MOD } from '../lib/modifiers.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { TYPES } from '../data/typeChart.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

// Il set del meta che pagava il conto: `floette-mega`, «Bulky Special
// Attacker», tre mosse Folletto su quattro.
const FLOETTE = (atkAbility) => ({
  atkPokemon: 'floette-mega', atkSPs: [10, 0, 19, 5, 0, 32], atkNature: 'modest',
  atkAbility, atkItem: 'floettite', level: 50,
})
const YVELTAL = (atkAbility) => ({
  atkPokemon: 'yveltal', atkSPs: [4, 0, 0, 32, 0, 28], atkNature: 'modest',
  atkAbility, atkItem: null, level: 50,
})
const difensore = (defPokemon, defAbility = null) => ({
  defPokemon, defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})
const INCINEROAR = difensore('incineroar')

const nostro = (attacker, move, defender = INCINEROAR) =>
  calculateDamage({ attacker, defender, move, field: {}, debug: false })

describe('il moltiplicatore è trascritto, non dedotto', () => {
  it('è 0x1548 e non uno dei due ×1.3 già in tabella', () => {
    // 0x1548/4096 = 1,33007…  0x14CD/4096 = 1,29980…
    // Prenderne uno per l'altro darebbe numeri plausibili e sbagliati, ed è
    // l'errore più facile da fare leggendo «33%» nella descrizione.
    expect(MOD.X1_33).toBe(0x1548)
    expect(MOD.X1_33).not.toBe(MOD.X1_3)
    expect(MOD.X1_33).not.toBe(MOD.X1_3_ORB)
  })

  it('le due voci portano un TIPO, e sono le uniche due', () => {
    // Un ramo solo per due abilità: cambia il tipo che deve combaciare. Se un
    // giorno ne arrivasse una terza, questo test lo dice invece di lasciarla
    // funzionare per caso.
    const conAura = Object.entries(ABILITY_EFFECTS)
      .filter(([, v]) => v.aura !== undefined)
      .map(([k, v]) => [k, v.aura])
    expect(conAura).toEqual([['fairy-aura', TYPES.FAIRY], ['dark-aura', TYPES.DARK]])
  })
})

describe('le aure, contro il riferimento', () => {
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
    ['Aura Fatata, Luce Nefasta',    FLOETTE('fairy-aura'), 'light of ruin',  INCINEROAR],
    ['Aura Fatata, Forza Lunare',    FLOETTE('fairy-aura'), 'moonblast',      INCINEROAR],
    ['Aura Fatata, Scintillio',      FLOETTE('fairy-aura'), 'dazzling gleam', INCINEROAR],
    ['Aura Oscura, Pulsar Notturna', YVELTAL('dark-aura'),  'dark pulse',     INCINEROAR],
    ['Aura Oscura, Ringhio',         YVELTAL('dark-aura'),  'snarl',          INCINEROAR],
    // Il tipo sbagliato: l'aura c'è, la mossa non è del suo tipo.
    ['Aura Fatata su mossa Fuoco',   FLOETTE('fairy-aura'), 'flamethrower',   INCINEROAR],
    ['Aura Oscura su mossa Volante', YVELTAL('dark-aura'),  'hurricane',      INCINEROAR],
    // L'aura del DIFENSORE potenzia la mossa dell'attaccante: è un'aura di
    // campo, non un bonus di chi la possiede.
    ['Aura Fatata dal lato del difensore',
      FLOETTE(null), 'moonblast', difensore('xerneas', 'fairy-aura')],
    ['nessuna aura, stesso attaccante', FLOETTE(null), 'moonblast', INCINEROAR],
  ]

  for (const [nome, attacker, move, defender] of casi) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker, defender, move, field: {} })
      expect(rif.motivo ?? null, 'il caso non è esprimibile per l\'harness').toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(attacker, move, defender).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }

  it.runIf(vendorPresente)('il riferimento attribuisce il bonus all\'abilità', () => {
    // Il controllo che rende lecita la traduzione «abilità → casella spuntata».
    // NCP non legge l'aura dall'abilità, la legge da una casella; ma quando la
    // casella è accesa E l'abilità c'è, scrive il nome dell'abilità nella
    // descrizione che costruisce. Cioè: la casella VUOLE DIRE quell'abilità.
    // Se un giorno la casella significasse altro, questo test lo direbbe.
    const fatata = harness.calcola({
      attacker: FLOETTE('fairy-aura'), defender: INCINEROAR, move: 'moonblast', field: {},
    })
    expect(fatata.descrizione).toContain('Fairy Aura')

    const oscura = harness.calcola({
      attacker: YVELTAL('dark-aura'), defender: INCINEROAR, move: 'dark pulse', field: {},
    })
    expect(oscura.descrizione).toContain('Dark Aura')

    // E il nome NON compare quando l'aura non c'entra: altrimenti la prova
    // sopra sarebbe soddisfatta da una descrizione che nomina sempre tutto.
    const fuoco = harness.calcola({
      attacker: FLOETTE('fairy-aura'), defender: INCINEROAR, move: 'flamethrower', field: {},
    })
    expect(fuoco.descrizione).not.toContain('Fairy Aura')
  })

  it.runIf(vendorPresente)('ogni caso riparte da caselle sue, non da quelle di prima', () => {
    // Il contesto NCP è uno solo e viene riusato da tutti i casi della suite.
    // Se `calcola` accendesse le caselle solo quando ce n'è da accendere,
    // un'aura resterebbe addosso al caso successivo: un moltiplicatore non
    // dovuto, un numero plausibile, e nessuno che se ne accorge.
    //
    // Qui il contesto viene sporcato a mano prima di chiedere un caso SENZA
    // aura. Se la pulizia dipendesse dal caso precedente invece che da questo,
    // il confronto salterebbe.
    harness.ncp.spuntaCaselle(['fairy-aura', 'dark-aura'])
    const pulito = harness.calcola({
      attacker: FLOETTE(null), defender: INCINEROAR, move: 'moonblast', field: {},
    })
    expect(pulito.ok).toBe(true)
    expect(pulito.rolls).toEqual(nostro(FLOETTE(null), 'moonblast').rolls)

    // E il contrario: sporcare non serve a far passare il caso CON l'aura,
    // che se la accende da sé.
    harness.ncp.spuntaCaselle([])
    const conAura = harness.calcola({
      attacker: FLOETTE('fairy-aura'), defender: INCINEROAR, move: 'moonblast', field: {},
    })
    expect(conAura.rolls).not.toEqual(pulito.rolls)
  })
})

describe('le aure muovono davvero il numero', () => {
  // Senza questi, i confronti col riferimento passerebbero anche se l'abilità
  // non facesse niente né da noi né da lui — cioè se avessimo sbagliato a
  // guidare l'harness.
  it('Luce Nefasta cresce di circa un terzo', () => {
    const con = nostro(FLOETTE('fairy-aura'), 'light of ruin')
    const senza = nostro(FLOETTE(null), 'light of ruin')
    expect(con.maxDmg).toBeGreaterThan(senza.maxDmg)
  })

  it('Pulsar Notturna cresce con Aura Oscura', () => {
    expect(nostro(YVELTAL('dark-aura'), 'dark pulse').maxDmg)
      .toBeGreaterThan(nostro(YVELTAL(null), 'dark pulse').maxDmg)
  })

  it('e nessuna delle due tocca una mossa di un altro tipo', () => {
    expect(nostro(FLOETTE('fairy-aura'), 'flamethrower').rolls)
      .toEqual(nostro(FLOETTE(null), 'flamethrower').rolls)
    expect(nostro(YVELTAL('dark-aura'), 'hurricane').rolls)
      .toEqual(nostro(YVELTAL(null), 'hurricane').rolls)
  })

  it('l\'aura del difensore potenzia la mossa di chi attacca', () => {
    // Il caso che si sbaglia se si legge «potenzia le SUE mosse».
    const controAura = nostro(FLOETTE(null), 'moonblast', difensore('xerneas', 'fairy-aura'))
    const controNulla = nostro(FLOETTE(null), 'moonblast', difensore('xerneas', null))
    expect(controAura.maxDmg).toBeGreaterThan(controNulla.maxDmg)
  })
})
