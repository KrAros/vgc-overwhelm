// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/polvereMetallica.test.js
 *
 * La Polvere Metallica: ×2 sulla Difesa, ma solo addosso a Ditto e solo
 * contro le mosse fisiche.
 *
 * ─── LA SECONDA E ULTIMA DELLE DUE VIVE ────────────────────────────────────
 *
 * Il gruppo 4 della misura — «raddoppio di statistica su una specie sola» — ha
 * quattro voci; Pikachu e Ditto sono in M-B, le altre specie no. Fatta la
 * Sferascintilla, questa è l'altra metà: stessa meccanica, altra catena.
 *
 * ─── DOVE TOCCA IL DANNO, TRASCRITTO ───────────────────────────────────────
 *
 * `damage_MASTER.js:2125`, `calcDefMods`, ramo `//g. 2.0x Items`, `0x2000`:
 *
 *     (defender.item === "Metal Powder" && defender.name === "Ditto"
 *                                       && hitsPhysical)
 *
 * ─── LA TRAPPOLA, ED È L'OPPOSTA DELL'ALTRA ────────────────────────────────
 *
 * Sulla Sferascintilla l'errore facile era AGGIUNGERE un controllo di
 * categoria che il riferimento non ha. Qui è TOGLIERLO: `hitsPhysical` c'è, e
 * un `spdMult` scritto per simmetria con la sorella raddoppierebbe anche la
 * Difesa Speciale. Le due voci della stessa famiglia hanno condizioni diverse,
 * e la simmetria fra loro è la guida sbagliata. Perciò qui c'è un caso
 * speciale contro l'oracolo, che è quello che cade se si sbaglia in quel modo.
 *
 * ─── L'ORACOLO ────────────────────────────────────────────────────────────
 *
 * Lo snapshot non nomina né Ditto né la Polvere — zero occorrenze in
 * `scripts/snapshot-cases.mjs`, verificato — e infatti `snapshot:diff` dava
 * zero divergenze prima e continua a darne zero. Prova che non si è rotto il
 * resto, non che la cosa nuova sia giusta.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import POKEMON_DATA from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const FISICA   = 'earthquake'
const SPECIALE = 'draco meteor'

/** Garchomp investe in tutt'e due gli attacchi: la stessa coppia di SP serve
 *  il caso fisico e quello speciale, e il difensore non cambia fra i due. */
const ATTACCANTE = {
  atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 32, 0, 0], atkNature: null,
  atkAbility: null, atkItem: null, level: 50,
}

/**
 * Ditto è Normale, quindi non è immune né a Terra né a Drago: tutt'e due le
 * mosse fanno danno vero. Un difensore immune renderebbe il confronto contro
 * il riferimento verde per costruzione — zero contro zero — e non proverebbe
 * niente.
 *
 * Chansey è il controllo negativo: anche lei Normale, stesse due mosse non
 * nulle, e la Polvere addosso non deve fare niente.
 */
const dif = (specie, item) => ({
  defPokemon: specie, defSPs: [32, 0, 16, 0, 16, 0], defNature: 'bold',
  defAbility: null, defItem: item, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})

const nostro = (specie, item, move) => calculateDamage({
  attacker: ATTACCANTE, defender: dif(specie, item), move, field: {}, debug: false,
})

describe('la Polvere Metallica è in tabella, con la condizione giusta', () => {
  it('×2 sulla Difesa, e solo su Ditto', () => {
    const e = ITEM_EFFECTS['metal powder']
    expect(e, 'metal powder non è in ITEM_EFFECTS').toBeTruthy()
    expect(e.defMult).toBe(2)
    expect(e.soloSpecie).toEqual(['ditto'])
  })

  it('e NON tocca la Difesa Speciale', () => {
    // Il riferimento scrive `hitsPhysical`. Se qualcuno aggiungesse
    // `spdMult: 2` per simmetria con la Sferascintilla, questo diventa rosso
    // prima che lo faccia un caso NCP.
    expect(ITEM_EFFECTS['metal powder'].spdMult).toBeUndefined()
  })

  it('e lo slug che nomina esiste davvero nel dex', () => {
    // Un refuso in `soloSpecie` non lo vedrebbe nessuno: il ×2 semplicemente
    // non si accenderebbe mai. Silenzio, non errore.
    for (const slug of ITEM_EFFECTS['metal powder'].soloSpecie) {
      expect(POKEMON_DATA[slug], `${slug} non è nel dex`).toBeTruthy()
    }
  })
})

describe('la Polvere Metallica contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const confronta = (specie, item, move) => {
    const rif = harness.calcola({
      attacker: ATTACCANTE, defender: dif(specie, item), move, field: {},
    })
    expect(rif.motivo ?? null, 'caso non esprimibile per l\'harness').toBeNull()
    expect(rif.ok).toBe(true)
    expect(nostro(specie, item, move).rolls, `${specie} + ${item} + ${move}: divergiamo`)
      .toEqual(rif.rolls)
  }

  it.runIf(vendorPresente)('contro una mossa FISICA ≡ NCP', () => {
    confronta('ditto', 'metal powder', FISICA)
  })

  it.runIf(vendorPresente)('contro una mossa SPECIALE non fa niente ≡ NCP', () => {
    // Il caso che cade se si toglie il controllo di categoria.
    confronta('ditto', 'metal powder', SPECIALE)
  })

  it.runIf(vendorPresente)('su Chansey non fa niente — e NCP è d\'accordo', () => {
    confronta('chansey', 'metal powder', FISICA)
    confronta('chansey', null, FISICA)
  })

  it.runIf(vendorPresente)('e a mani vuote Ditto ≡ NCP lo stesso', () => {
    // Se divergessimo già senza lo strumento, i casi qui sopra non direbbero
    // niente sulla Polvere.
    confronta('ditto', null, FISICA)
    confronta('ditto', null, SPECIALE)
  })
})

describe('la Polvere Metallica muove davvero il numero', () => {
  it('sulla fisica il danno CALA', () => {
    // Senza questo, i confronti contro il riferimento passerebbero anche se lo
    // strumento non facesse NIENTE e NCP nemmeno — cioè se avessimo sbagliato
    // a guidare l'harness. Ed è l'unica delle due di questa sessione in cui il
    // numero va giù: è un moltiplicatore della DIFESA.
    const con = nostro('ditto', 'metal powder', FISICA)
    const senza = nostro('ditto', null, FISICA)
    expect(con.maxDmg, 'la Polvere non cambia il danno fisico').toBeLessThan(senza.maxDmg)
  })

  it('sulla speciale no', () => {
    expect(nostro('ditto', 'metal powder', SPECIALE).rolls)
      .toEqual(nostro('ditto', null, SPECIALE).rolls)
  })

  it('e su chi non è Ditto no', () => {
    for (const move of [FISICA, SPECIALE]) {
      expect(nostro('chansey', 'metal powder', move).rolls, `si accende su Chansey (${move})`)
        .toEqual(nostro('chansey', null, move).rolls)
    }
  })

  it('non tocca la catena di chi attacca', () => {
    // È un modificatore della DIFESA: addosso all'attaccante non deve fare
    // niente. Il cancello guarda `defPokemon`, e uno scambio di lato sarebbe
    // invisibile a tutti i casi qui sopra.
    const conAtt = calculateDamage({
      attacker: { ...ATTACCANTE, atkPokemon: 'ditto', atkItem: 'metal powder' },
      defender: dif('chansey', null), move: FISICA, field: {},
    })
    const senzaAtt = calculateDamage({
      attacker: { ...ATTACCANTE, atkPokemon: 'ditto', atkItem: null },
      defender: dif('chansey', null), move: FISICA, field: {},
    })
    expect(conAtt.rolls).toEqual(senzaAtt.rolls)
  })
})

describe('Psyshock: una divergenza che c\'era già, misurata', () => {
  /**
   * ─── PERCHE' QUESTO BLOCCO ESISTE ────────────────────────────────────────
   *
   * `hitsPhysical` nel riferimento NON è `!isSpecial`: comprende anche
   * Psyshock, Psystrike e Secret Sword, mosse speciali che colpiscono la
   * Difesa (`damage_MASTER.js:2025`). Il nostro motore non ha quella
   * distinzione — `defStatIdx` sceglie dalla sola categoria — ed è un limite
   * dichiarato al punto a di questa stessa catena, più vecchio di questa
   * sessione.
   *
   * La Polvere Metallica ci cade sopra: contro Psyshock il riferimento la
   * applica, noi no. Non è un difetto INTRODOTTO qui — su quelle tre mosse
   * divergevamo già sulla scelta della statistica, cioè prima e peggio — ma
   * adesso ha un secondo modo di manifestarsi, e va scritto invece che
   * scoperto da qualcun altro fra sei mesi.
   *
   * Il test asserisce la divergenza, non la nasconde: il giorno che qualcuno
   * insegna al motore le tre mosse che colpiscono la Difesa, questo diventa
   * rosso e va girato.
   */
  let harness
  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(vendorPresente)('divergiamo, e già senza lo strumento', () => {
    const senzaRif = harness.calcola({
      attacker: ATTACCANTE, defender: dif('ditto', null), move: 'psyshock', field: {},
    })
    expect(senzaRif.ok).toBe(true)
    expect(
      nostro('ditto', null, 'psyshock').rolls,
      'il motore ha imparato le mosse che colpiscono la Difesa: girare questo test',
    ).not.toEqual(senzaRif.rolls)
  })

  it.runIf(vendorPresente)('e la Polvere non la applichiamo dove il riferimento sì', () => {
    const conRif = harness.calcola({
      attacker: ATTACCANTE, defender: dif('ditto', 'metal powder'), move: 'psyshock', field: {},
    })
    expect(conRif.ok).toBe(true)
    // Da noi Psyshock è speciale e basta, quindi la Polvere non si accende.
    expect(nostro('ditto', 'metal powder', 'psyshock').rolls)
      .toEqual(nostro('ditto', null, 'psyshock').rolls)
    // Nel riferimento invece sì: i suoi due numeri sono diversi fra loro.
    const senzaRif = harness.calcola({
      attacker: ATTACCANTE, defender: dif('ditto', null), move: 'psyshock', field: {},
    })
    expect(conRif.rolls, 'NCP ha smesso di trattare Psyshock come fisica')
      .not.toEqual(senzaRif.rolls)
  })
})
