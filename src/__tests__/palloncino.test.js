// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/palloncino.test.js
 *
 * Il Palloncino: immune alle mosse Terra, e non tocca il terreno.
 *
 * ─── L'UNICO GENERICO DEI TRENTANOVE ───────────────────────────────────────
 *
 * Gli altri strumenti col segnalino vogliono una specie precisa — Silvally,
 * Genesect, Marowak, Clamperl, Ditto, Pikachu. Il Palloncino lo può tenere
 * chiunque, quindi è anche l'unico dove il numero sbagliato lo incontrava
 * chiunque.
 *
 * ─── ERA DATO PER FAMIGLIA B, ED E' A. MISURATO. ───────────────────────────
 *
 * L'ipotesi di partenza era che il riferimento non lo calcolasse e servisse
 * un'aggiudicazione. È falsa: lo calcola in DUE posti indipendenti, e le due
 * cose non sono la stessa condizione letta due volte.
 *
 *   1. `damage_MASTER.js:1119` — immunità a Terra, `return damage: [0]`.
 *   2. `damage_MASTER.js:1298` — `pIsGrounded`, cioè se i terreni si applicano.
 *
 * Un Volante è NON ancorato ma è immune a Terra per il tipo; Levitate è non
 * ancorata ma immunizza come abilità. Il Palloncino fa tutt'e due le cose per
 * conto suo, con due righe in due funzioni diverse — perciò due campi in
 * tabella, e qui due gruppi di casi.
 *
 * ─── QUANTO SI SBAGLIAVA, PRIMA ────────────────────────────────────────────
 *
 *   Terremoto su chi ha il Palloncino     NCP 0        noi 43-51
 *   Fulmine, terreno elettrico            NCP 45-54    noi 58-70
 *   Pulsardragon, terreno nebbioso        NCP 22-27    noi 11-14
 *
 * La prima riga è la direzione peggiore: un danno pieno dove il gioco non ne
 * fa nessuno. Le altre due sono più piccole e vanno in tutt'e due i versi.
 *
 * ─── L'ORACOLO ────────────────────────────────────────────────────────────
 *
 * Lo snapshot non nomina il Palloncino — zero occorrenze in
 * `scripts/snapshot-cases.mjs`, verificato. Si esegue il riferimento.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import { TYPES } from '../data/typeChart.js'
import MOVE_DATA from '../data/moves.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = (item = null, extra = {}) => ({
  atkPokemon: 'pikachu', atkSPs: [0, 0, 0, 32, 0, 0], atkNature: 'modest',
  atkAbility: null, atkItem: item, level: 50, atkAbilityFlags: {}, ...extra,
})
/** Blissey: Normale puro. Non è né Volante né immune a Terra per il tipo,
 *  quindi l'immunità che si misura può venire SOLO dal Palloncino. */
const dif = (item = null, extra = {}) => ({
  defPokemon: 'blissey', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: item, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const nostro = (input) => calculateDamage({ field: {}, debug: false, ...input })

describe('il Palloncino è in tabella, con tutt\'e due gli effetti', () => {
  it('immune a Terra, e non ancorato', () => {
    const e = ITEM_EFFECTS['air balloon']
    expect(e, 'air balloon non è in ITEM_EFFECTS').toBeTruthy()
    expect(e.immuneTipo).toBe(TYPES.GROUND)
    expect(e.nonAncorato).toBe(true)
  })

  it('e i due effetti sono DUE, non uno scritto due volte', () => {
    // Se qualcuno togliesse `nonAncorato` pensando che l'immunità basti, i
    // casi sul terreno più sotto diventerebbero rossi. Questo lo dice prima.
    const e = ITEM_EFFECTS['air balloon']
    expect(Object.keys(e).sort()).toEqual(['immuneTipo', 'nonAncorato', 'showInSmogon'])
  })

  it('la preparazione non può portarglielo via', () => {
    // Il motore legge lo strumento del difensore DUE volte: una prima della
    // preparazione, per questa immunità, e una dopo, per i moltiplicatori. La
    // differenza fra le due chiavi è lo strumento che la preparazione consuma,
    // e sono due soli — Energia Booster e Orbo Adrenalina.
    //
    // Se il Palloncino ne acquisisse uno, le due letture direbbero cose
    // diverse e nessun caso qui sotto se ne accorgerebbe.
    const e = ITEM_EFFECTS['air balloon']
    expect(e.accendeParadosso, 'il Palloncino adesso si consuma: rileggere calcEngine').toBeUndefined()
    expect(e.orboAdrenalina).toBeUndefined()
  })

  it('Fracassaterra è una mossa KO di tipo Terra, ed è il motivo del posto', () => {
    // Il controllo del Palloncino sta SOPRA il ramo delle mosse KO. Se
    // scendesse sotto, Fracassaterra tornerebbe «KO» dove il gioco non fa
    // niente — e nessun caso sul Terremoto se ne accorgerebbe.
    expect(MOVE_DATA['fissure'].koSecco).toBe(true)
    expect(MOVE_DATA['fissure'].type).toBe(TYPES.GROUND)
  })

  it('Thousand Arrows non è nei nostri dati, ed è perché l\'eccezione non si prova', () => {
    // Nel riferimento il Palloncino NON ferma quella mossa. La condizione è
    // scritta nel motore, ma non è esprimibile: il giorno che la mossa entra
    // in `moves.json` questo test diventa rosso e il caso si può scrivere.
    expect(MOVE_DATA['thousand arrows'], 'Thousand Arrows è arrivata: scrivere il caso').toBeUndefined()
  })
})

describe('l\'immunità a Terra, contro il riferimento', () => {
  let harness
  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const confronta = (input, etichetta) => {
    const rif = harness.calcola({ field: {}, ...input })
    expect(rif.motivo ?? null, 'caso non esprimibile per l\'harness').toBeNull()
    expect(rif.ok).toBe(true)
    const n = nostro(input)
    expect(n.immune ? [] : n.rolls, `${etichetta}: divergiamo`).toEqual(rif.rolls)
  }

  it.runIf(vendorPresente)('Terremoto sul Palloncino ≡ NCP (cioè zero)', () => {
    confronta({ attacker: att(), defender: dif('air balloon'), move: 'earthquake' }, 'terremoto')
  })

  it.runIf(vendorPresente)('e senza Palloncino il danno c\'è, ≡ NCP', () => {
    // Il caso che rende il precedente una prova: se Blissey fosse immune di
    // suo, lo zero non direbbe niente sul Palloncino.
    confronta({ attacker: att(), defender: dif(null), move: 'earthquake' }, 'terremoto nudo')
  })

  it.runIf(vendorPresente)('e una mossa di ALTRO tipo passa lo stesso ≡ NCP', () => {
    // Controllo negativo: se il ramo si accendesse su tutto, questo divergerebbe.
    confronta({ attacker: att(), defender: dif('air balloon'), move: 'thunderbolt' }, 'fulmine')
  })
})

describe('il terreno, contro il riferimento', () => {
  let harness
  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  const confronta = (input, etichetta) => {
    const rif = harness.calcola(input)
    expect(rif.motivo ?? null, 'caso non esprimibile per l\'harness').toBeNull()
    expect(rif.ok).toBe(true)
    const n = nostro(input)
    expect(n.immune ? [] : n.rolls, `${etichetta}: divergiamo`).toEqual(rif.rolls)
  }

  it.runIf(vendorPresente)('chi ATTACCA col Palloncino non prende il terreno elettrico', () => {
    // Prima davamo il ×1.3 lo stesso: 58-70 contro i 45-54 del riferimento.
    confronta({ attacker: att('air balloon'), defender: dif(),
      move: 'thunderbolt', field: { terrain: 'electric' } }, 'terreno elettrico')
  })

  it.runIf(vendorPresente)('e senza Palloncino lo prende, ≡ NCP', () => {
    confronta({ attacker: att(), defender: dif(),
      move: 'thunderbolt', field: { terrain: 'electric' } }, 'terreno elettrico nudo')
  })

  it.runIf(vendorPresente)('chi DIFENDE col Palloncino non è protetto dal terreno nebbioso', () => {
    // Va nell'altro verso: il terreno nebbioso dimezza le mosse Drago su chi è
    // ancorato, e col Palloncino non lo è. Prima dimezzavamo lo stesso.
    confronta({ attacker: att(), defender: dif('air balloon'),
      move: 'dragon pulse', field: { terrain: 'misty' } }, 'terreno nebbioso')
  })

  it.runIf(vendorPresente)('e senza Palloncino lo è, ≡ NCP', () => {
    confronta({ attacker: att(), defender: dif(),
      move: 'dragon pulse', field: { terrain: 'misty' } }, 'terreno nebbioso nudo')
  })
})

describe('il Palloncino muove davvero il numero', () => {
  it('sul Terremoto il danno sparisce', () => {
    const senza = nostro({ attacker: att(), defender: dif(null), move: 'earthquake' })
    expect(senza.immune, 'Blissey è immune a Terra da sola: il caso non prova niente')
      .toBeFalsy()
    expect(senza.maxDmg).toBeGreaterThan(0)

    const con = nostro({ attacker: att(), defender: dif('air balloon'), move: 'earthquake' })
    expect(con.immune).toBe(true)
    expect(con.reason).toBe('item')
    expect(con.itemName).toBe('air balloon')
  })

  it('e sui due terreni il numero cambia, in due versi opposti', () => {
    const elettrico = (item) => nostro({ attacker: att(item), defender: dif(),
      move: 'thunderbolt', field: { terrain: 'electric' } })
    expect(elettrico('air balloon').maxDmg,
      'il Palloncino non toglie più il terreno a chi attacca').toBeLessThan(elettrico(null).maxDmg)

    const nebbioso = (item) => nostro({ attacker: att(), defender: dif(item),
      move: 'dragon pulse', field: { terrain: 'misty' } })
    expect(nebbioso('air balloon').maxDmg,
      'il Palloncino non toglie più la protezione a chi difende').toBeGreaterThan(nebbioso(null).maxDmg)
  })

  it('su una mossa di altro tipo non fa niente', () => {
    const con = nostro({ attacker: att(), defender: dif('air balloon'), move: 'thunderbolt' })
    const senza = nostro({ attacker: att(), defender: dif(null), move: 'thunderbolt' })
    expect(con.rolls).toEqual(senza.rolls)
  })

  it('ferma anche Fracassaterra, che è una mossa KO', () => {
    // Il caso che cade se il controllo scende sotto il ramo delle mosse KO.
    const senza = nostro({ attacker: att(), defender: dif(null), move: 'fissure' })
    expect(senza.immune, 'Fracassaterra non arriva più: il caso non prova niente').toBeFalsy()

    const con = nostro({ attacker: att(), defender: dif('air balloon'), move: 'fissure' })
    expect(con.immune).toBe(true)
    expect(con.reason).toBe('item')
  })

  it('e Goffaggine glielo toglie di mano', () => {
    // `chiaveStrumentoDopoKlutz`, la funzione che le due letture condividono.
    // Con Goffaggine il riferimento azzera lo strumento, quindi il Palloncino
    // non immunizza più — ed è la sola condizione, oltre al tipo della mossa,
    // che può spegnere questo ramo.
    const con = nostro({ attacker: att(),
      defender: dif('air balloon', { defAbility: 'klutz' }), move: 'earthquake' })
    expect(con.immune, 'Goffaggine non annulla più il Palloncino').toBeFalsy()
    expect(con.maxDmg).toBeGreaterThan(0)
  })
})
