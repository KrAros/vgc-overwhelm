// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/puntiSalute.test.js
 *
 * I punti salute entrano nel modello — e per adesso non si vedono.
 *
 * ─── COS'ERANO PRIMA: DUE LEVETTE CHE POTEVANO CONTRADDIRSI ────────────────
 *
 * L'app non aveva i punti salute. Aveva due interruttori che li descrivevano
 * a pezzi:
 *
 *   «Multiscale attivo»            = «è a vita piena, sì o no»
 *   l'interruttore delle cinque    = «è sotto un terzo»
 *
 * Erano due affermazioni separate sullo stesso Pokémon, e niente le
 * confrontava: si poteva dire insieme «è a vita piena» e «è sotto un terzo».
 * Con un numero solo, quella contraddizione non è più scrivibile.
 *
 * ─── LA TRADUZIONE NON È INVENTATA QUI ─────────────────────────────────────
 *
 * L'harness traduce quelle levette in punti salute da sempre, per poter
 * interrogare il riferimento — `Multiscale spento` → `massimo − 1`,
 * `interruttore su Blaze` → `un terzo`. È scritta, ed è verificata contro
 * l'oracolo da quando esiste.
 *
 * Adesso quella stessa funzione la usano tutt'e due: il motore per convertire
 * le levette in ingresso, l'harness per costruire il caso NCP. Una levetta
 * vecchia diventa lo stesso numero da tutt'e due le parti, invece che due
 * numeri che si somigliano.
 *
 * ─── PERCHÉ QUESTO COMMIT NON CAMBIA NESSUN NUMERO ─────────────────────────
 *
 * Perché niente manda ancora i punti salute: arrivano `null`, e la traduzione
 * ricava esattamente ciò che le levette dicevano prima. Lo snapshot lo
 * dimostra su 601 casi, quindici dei quali aggiunti apposta per queste sei
 * abilità.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import {
  aVitaPiena, psSottoLaMeta, psSottoUnTerzo, psDaLevetta, ABILITA_A_VITA_BASSA,
} from '../lib/rules.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = (specie, abilita, extra = {}) => ({
  atkPokemon: specie, atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
  atkAbility: abilita, atkItem: null, level: 50, atkAbilityFlags: {}, ...extra,
})
const dif = (specie, abilita = null, extra = {}) => ({
  defPokemon: specie, defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: abilita, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const nostro = (a, d, move) => calculateDamage({ attacker: a, defender: d, move, field: {} })

// ═══════════════════════════════════════════════════════════════════════════
// 1. Le tre soglie, trascritte
// ═══════════════════════════════════════════════════════════════════════════

describe('le tre soglie del riferimento', () => {
  it('«pieni» è un uguale, non un maggiore-uguale', () => {
    // È l'unica delle tre che un punto in meno fa cadere, ed è il modo in cui
    // l'harness la esprime da sempre.
    expect(aVitaPiena(175, 175)).toBe(true)
    expect(aVitaPiena(174, 175)).toBe(false)

    // ─── E QUESTA RIGA NESSUN TEST LA PUÒ DIFENDERE ────────────────────
    //
    // Cambiando `===` in `>=` la suite resta verde, provato. Non è un buco:
    // le due condizioni differiscono solo per `ps > psMax`, che è uno stato
    // che non esiste — nessun Pokémon ha più punti salute del suo massimo.
    //
    // Resta `===` perché così lo scrive il riferimento
    // (`damage_MASTER.js:2360`), e qui si trascrive anche dove la differenza
    // non è osservabile. Il giorno che qualcuno introduce un modo di superare
    // il massimo — una cura che sfora, un'importazione senza controlli — la
    // scelta giusta è già in piedi.
    expect(aVitaPiena(176, 175), 'sopra il massimo non è «pieno»: è uno stato che non deve esistere')
      .toBe(false)
  })

  it('metà e un terzo sono `<=` su una frazione NON arrotondata', () => {
    // Con 100 massimi la soglia del terzo è 33,33: un Pokémon a 33 ci sta
    // dentro. Scrivendo `floor` cambierebbe solo dove il massimo non è
    // divisibile, cioè dove nessuno guarderebbe.
    expect(psSottoUnTerzo(33, 100)).toBe(true)
    expect(psSottoUnTerzo(34, 100)).toBe(false)
    expect(psSottoLaMeta(50, 100)).toBe(true)
    expect(psSottoLaMeta(51, 100)).toBe(false)
  })

  it('e non si confondono fra loro', () => {
    // Un Pokémon a metà è sotto la metà ma NON sotto un terzo: se le due
    // soglie fossero la stessa, Blaze si accenderebbe dove non deve.
    expect(psSottoLaMeta(50, 100)).toBe(true)
    expect(psSottoUnTerzo(50, 100)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. La traduzione dalle vecchie levette
// ═══════════════════════════════════════════════════════════════════════════

describe('le vecchie levette diventano numeri', () => {
  it('«non a vita piena» è un punto in meno, che è il minimo per non esserlo', () => {
    expect(psDaLevetta(175, { pieniSpenti: true })).toBe(174)
    expect(aVitaPiena(psDaLevetta(175, { pieniSpenti: true }), 175)).toBe(false)
  })

  it('«vita bassa» è un terzo, e soddisfa tutt\'e due le soglie', () => {
    // Un valore solo per cinque abilità che ne guardano due diverse: il terzo
    // sta sotto il terzo e anche sotto la metà, quindi accende sia Blaze sia
    // Defeatist. È la scelta che l'harness fa da sempre.
    const ps = psDaLevetta(300, { vitaBassa: true })
    expect(ps).toBe(100)
    expect(psSottoUnTerzo(ps, 300)).toBe(true)
    expect(psSottoLaMeta(ps, 300)).toBe(true)
  })

  it('e senza levette non descrive niente', () => {
    // `null` significa «non ho niente da dire», non «pieni»: il valore di
    // riposo lo mette il motore. Se qui tornasse il massimo, una levetta
    // dimenticata sembrerebbe un'affermazione.
    expect(psDaLevetta(175)).toBeNull()
  })

  it('le cinque a vita bassa sono cinque, e l\'interruttore non è loro', () => {
    expect([...ABILITA_A_VITA_BASSA].sort())
      .toEqual(['blaze', 'defeatist', 'overgrow', 'swarm', 'torrent'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Il motore: il numero comanda, la levetta lo traduce
// ═══════════════════════════════════════════════════════════════════════════

describe('il motore legge il numero', () => {
  const incin = (extra) => att('incineroar', 'blaze', extra)
  const amoon = dif('amoonguss')
  const flare = (a) => nostro(a, amoon, 'flare blitz').maxDmg

  it('i punti salute bassi accendono Blaze come faceva la levetta', () => {
    const conLevetta = flare(incin({ atkAbilityFlags: { interruttore: true } }))
    const conNumero = flare(incin({ atkPS: 1 }))
    const pieno = flare(incin({}))
    expect(conNumero).toBe(conLevetta)
    expect(conNumero).toBeGreaterThan(pieno)
  })

  it('e il numero VINCE sulla levetta quando ci sono tutt\'e due', () => {
    // La contraddizione che il vecchio modello permetteva: levetta accesa
    // («sono sotto un terzo») e punti salute pieni. Adesso una delle due deve
    // perdere, ed è scritto quale.
    //
    // Il massimo si chiede al motore invece di scriverlo a mano: un numero
    // inventato più alto del massimo sarebbe uno stato che non esiste, e il
    // test proverebbe una cosa su un Pokémon impossibile.
    const psMax = nostro(att('amoonguss', null), dif('incineroar'), 'sludge bomb').defHP
    const contraddittorio = flare(incin({
      atkAbilityFlags: { interruttore: true }, atkPS: psMax,
    }))
    expect(contraddittorio).toBe(flare(incin({})))
  })

  it('la soglia è un terzo vero, non «uno o pieni»', () => {
    // Il caso che distingue una soglia da un interruttore. Appena SOPRA il
    // terzo l'abilità non si accende; appena SOTTO sì. Un motore che
    // traducesse «non pieni» in «vita bassa» passerebbe i test qui sopra e
    // fallirebbe questo.
    const psMax = nostro(att('amoonguss', null), dif('incineroar'), 'sludge bomb').defHP
    const terzo = psMax / 3
    expect(flare(incin({ atkPS: Math.ceil(terzo) + 1 })), 'sopra il terzo si accende')
      .toBe(flare(incin({})))
    expect(flare(incin({ atkPS: Math.floor(terzo) })), 'sotto il terzo non si accende')
      .toBeGreaterThan(flare(incin({})))
  })

  it('Multiscale legge lo stesso numero, dall\'altro lato', () => {
    const chomp = att('garchomp', null)
    const dragoPieno = dif('dragonite', 'multiscale')
    const dragoFerito = dif('dragonite', 'multiscale', { defPS: 1 })
    expect(nostro(chomp, dragoFerito, 'knock off').maxDmg)
      .toBeGreaterThan(nostro(chomp, dragoPieno, 'knock off').maxDmg)
  })

  it('e Tera Shell pure', () => {
    const incin2 = att('incineroar', null)
    expect(nostro(incin2, dif('terapagos-terastal', 'tera-shell', { defPS: 1 }), 'knock off').effectiveness)
      .toBe(1)
    expect(nostro(incin2, dif('terapagos-terastal', 'tera-shell'), 'knock off').effectiveness)
      .toBe(0.5)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Contro l'oracolo, coi punti salute espressi come numero
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
    ['Blaze a un punto',        att('incineroar', 'blaze', { atkPS: 1 }), dif('amoonguss'), 'flare blitz'],
    ['Blaze a vita piena',      att('incineroar', 'blaze'), dif('amoonguss'), 'flare blitz'],
    ['Defeatist a un punto',    att('incineroar', 'defeatist', { atkPS: 1 }), dif('amoonguss'), 'knock off'],
    ['Defeatist a vita piena',  att('incineroar', 'defeatist'), dif('amoonguss'), 'knock off'],
    ['Multiscale ferito',       att('incineroar', null), dif('dragonite', 'multiscale', { defPS: 1 }), 'knock off'],
    ['Multiscale intero',       att('incineroar', null), dif('dragonite', 'multiscale'), 'knock off'],
    ['Tera Shell ferito',       att('incineroar', null), dif('terapagos-terastal', 'tera-shell', { defPS: 1 }), 'knock off'],
    ['Tera Shell intero',       att('incineroar', null), dif('terapagos-terastal', 'tera-shell'), 'knock off'],
    ['un colpo qualunque, ferito', att('incineroar', null, { atkPS: 1 }), dif('amoonguss', null, { defPS: 1 }), 'knock off'],
  ]

  for (const [nome, attacker, defender, mossa] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker, defender, move: mossa, field: {} })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(attacker, defender, mossa).rolls).toEqual(rif.rolls)
    })
  }

  it.runIf(vendorPresente)('e l\'oracolo i punti salute li riceve davvero', () => {
    // Il controllo che rende vere le righe qui sopra: se l'harness ignorasse
    // `ps`, risponderebbe uguale a ferito e intero, e i confronti
    // passerebbero confermando qualunque cosa.
    const max = (ps) => harness.calcola({
      attacker: att('incineroar', 'blaze', ps === null ? {} : { atkPS: ps }),
      defender: dif('amoonguss'), move: 'flare blitz', field: {},
    }).rolls.at(-1)
    expect(max(1)).not.toBe(max(null))
  })

  it.runIf(vendorPresente)('e la levetta vecchia dà lo STESSO numero del nuovo', () => {
    // La prova che la traduzione è una sola: un caso scritto con la levetta e
    // uno scritto col numero devono arrivare allo stesso posto, nel motore e
    // nell'oracolo.
    const conLevetta = { attacker: att('incineroar', 'blaze', { atkAbilityFlags: { interruttore: true } }), defender: dif('amoonguss'), move: 'flare blitz', field: {} }
    const rif = harness.calcola(conLevetta)
    expect(rif.ok).toBe(true)
    expect(calculateDamage(conLevetta).rolls).toEqual(rif.rolls)
  })
})
