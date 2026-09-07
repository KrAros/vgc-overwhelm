// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/sferascintilla.test.js
 *
 * La Sferascintilla: ×2 sulla statistica d'attacco, ma solo addosso a Pikachu.
 *
 * ─── PERCHE' QUESTA E NON UN'ALTRA DEI TRENTAQUATTRO ───────────────────────
 *
 * Perché è una delle DUE vive. Il gruppo 4 della misura — «raddoppio di
 * statistica su una specie sola» — ha quattro voci, e tre chiedono specie che
 * Champions non ha: Clava Ossea vuole Marowak, Squamastrana e Perlamarina
 * vogliono Clamperl, Gemmadanima vuole Latios o Latias. Nessuna in M-B.
 *
 * Pikachu invece c'è, quindi questa la si può tenere davvero, e il numero
 * sbagliato lo vedrebbe qualcuno.
 *
 * ─── DOVE TOCCA IL DANNO, TRASCRITTO ───────────────────────────────────────
 *
 * `damage_MASTER.js:1993`, `calcAtMods`, ramo `//i. 2.0x Items`, `0x2000`:
 *
 *     (attacker.item === "Light Ball" && (attacker.name === "Pikachu"
 *                                      || attacker.name === "Pikachu-Gmax"))
 *
 * Il punto della catena conta: è un modificatore della STATISTICA d'attacco,
 * non della potenza né del danno finale, e i tre arrotondano in momenti
 * diversi. Che sia il punto giusto lo dice il confronto roll per roll — non
 * il fatto che il numero raddoppi all'incirca.
 *
 * ─── LA TRAPPOLA: QUELLO CHE NEL RIFERIMENTO NON C'E' ──────────────────────
 *
 * Le altre due voci dello stesso `if` hanno un controllo di categoria — Clava
 * Ossea solo fisiche, Squamastrana solo speciali — e la Sferascintilla NO.
 * Vale su tutt'e due. Scriverla «×2 sull'Attacco» per simmetria con le sorelle
 * sarebbe l'errore facile, e dimezzerebbe metà dei casi in silenzio: qui c'è
 * un caso fisico E uno speciale, tutt'e due contro l'oracolo.
 *
 * ─── L'ORACOLO ────────────────────────────────────────────────────────────
 *
 * Lo snapshot dei casi golden non nomina né Pikachu né la Sferascintilla —
 * zero occorrenze in `scripts/snapshot-cases.mjs`, verificato — e infatti
 * `snapshot:diff` dava zero divergenze prima e continua a darne zero. Prova
 * che non si è rotto il resto, non che la cosa nuova sia giusta.
 *
 * Quindi si esegue il riferimento e si confronta roll per roll.
 *
 * ─── COSA I CASI QUI SOTTO NON POSSONO VEDERE, MISURATO ────────────────────
 *
 * Rompendo l'implementazione in quattro modi, tre li vedono e uno no:
 *
 *   statType: 'physical'          → 3 rossi
 *   il cancello soloSpecie salta  → 2 rossi
 *   il ×2 nella catena FINALE     → 5 rossi
 *   il ×2 fuori da `chainMods`    → nessun rosso
 *
 * L'ultimo non è un buco della suite: è che la differenza NON ESISTE. Un ×2
 * esatto è 0x2000, e `chainMods` lo accumula senza resto — `pokeRound` di un
 * intero raddoppiato è quell'intero raddoppiato — quindi dentro la catena o
 * fuori danno lo stesso numero. Misurato anche fra catena della STATISTICA e
 * catena della POTENZA: su quattro terne (BP, Atk, Dif) rispondono identiche,
 * mentre la catena finale risponde 74 contro 72, perché lì il `+2` della
 * formula è già stato aggiunto e viene raddoppiato anche lui.
 *
 * Cioè: per QUESTO strumento le due catene d'ingresso sono indistinguibili, e
 * l'unico errore di posizione osservabile è quello che i casi NCP prendono. La
 * frase «sbagliare punto dà numeri che divergono di un arrotondamento» vale in
 * generale, non per un moltiplicatore esatto — e vale la pena averlo misurato
 * invece che averlo assunto in una direzione o nell'altra.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import POKEMON_DATA from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

/** Mossa → i SP e la natura che la rendono sensata, per categoria. */
const FISICA  = { move: 'iron tail',   sps: [0, 32, 0, 0, 0, 0], nature: 'adamant' }
const SPECIALE = { move: 'thunderbolt', sps: [0, 0, 0, 32, 0, 0], nature: 'modest' }

const attaccante = (specie, item, { sps, nature }) => ({
  atkPokemon: specie, atkSPs: sps, atkNature: nature,
  atkAbility: null, atkItem: item, level: 50,
})

/**
 * Dragonite, e la ragione va scritta: prende danno da tutt'e due le mosse.
 * Pikachu è Elettro, e la metà dei difensori plausibili è di Terra — cioè
 * IMMUNE. Con un difensore immune il confronto contro il riferimento passa
 * lo stesso, perché tutt'e due dicono zero, e non prova niente.
 *
 * Dragonite è Drago/Volante: Fulmine ×2, Codaferrea neutra. Nessuno dei due
 * numeri può essere zero, quindi «lo strumento muove il numero» ha qualcosa
 * da misurare.
 */
const DIFENSORE = {
  defPokemon: 'dragonite', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}

const nostro = (specie, item, caso) => calculateDamage({
  attacker: attaccante(specie, item, caso), defender: DIFENSORE,
  move: caso.move, field: {}, debug: false,
})

describe('la Sferascintilla è in tabella, con la condizione giusta', () => {
  it('×2 sull\'attacco, e solo su Pikachu', () => {
    const e = ITEM_EFFECTS['light ball']
    expect(e, 'light ball non è in ITEM_EFFECTS').toBeTruthy()
    expect(e.atkMult).toBe(2)
    expect(e.soloSpecie).toEqual(['pikachu'])
  })

  it('NON ha un controllo di categoria, ed è deliberato', () => {
    // La differenza con le tre sorelle dello stesso `if` del riferimento.
    // Se qualcuno aggiungesse `statType: 'physical'` per simmetria con la
    // Clava Ossea, questo diventa rosso prima che lo faccia un caso NCP.
    expect(ITEM_EFFECTS['light ball'].statType).toBeUndefined()
  })

  it('e lo slug che nomina esiste davvero nel dex', () => {
    // `soloSpecie` è un elenco di stringhe: un refuso non lo vedrebbe nessuno,
    // e il ×2 semplicemente non si accenderebbe mai. Silenzio, non errore.
    for (const slug of ITEM_EFFECTS['light ball'].soloSpecie) {
      expect(POKEMON_DATA[slug], `${slug} non è nel dex`).toBeTruthy()
    }
    // E le forme Gigamax non ci sono affatto: è la ragione per cui
    // `Pikachu-Gmax` del riferimento non è trascritto qui.
    expect(Object.keys(POKEMON_DATA).filter(k => k.includes('gmax'))).toEqual([])
  })
})

describe('la Sferascintilla contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const confronta = (specie, item, caso) => {
    const rif = harness.calcola({
      attacker: attaccante(specie, item, caso), defender: DIFENSORE,
      move: caso.move, field: {},
    })
    expect(rif.motivo ?? null, 'caso non esprimibile per l\'harness').toBeNull()
    expect(rif.ok).toBe(true)
    expect(nostro(specie, item, caso).rolls, `${specie} + ${item}: divergiamo`)
      .toEqual(rif.rolls)
  }

  it.runIf(vendorPresente)('su una mossa FISICA ≡ NCP', () => {
    confronta('pikachu', 'light ball', FISICA)
  })

  it.runIf(vendorPresente)('su una mossa SPECIALE ≡ NCP', () => {
    // Il caso che cade se qualcuno restringe l'effetto alle fisiche.
    confronta('pikachu', 'light ball', SPECIALE)
  })

  it.runIf(vendorPresente)('su Raichu non fa niente — e NCP è d\'accordo', () => {
    // Controllo negativo contro l'oracolo. Misurato: NCP risponde gli stessi
    // sedici roll con e senza lo strumento, su Raichu e su Pichu. Se il
    // cancello `soloSpecie` saltasse, questo caso divergerebbe.
    confronta('raichu', 'light ball', SPECIALE)
    confronta('raichu', null, SPECIALE)
  })

  it.runIf(vendorPresente)('e senza lo strumento Pikachu ≡ NCP lo stesso', () => {
    // Il riferimento va confrontato anche a mani vuote: se divergessimo già
    // lì, i due casi qui sopra non direbbero niente sulla Sferascintilla.
    confronta('pikachu', null, FISICA)
    confronta('pikachu', null, SPECIALE)
  })
})

describe('la Sferascintilla muove davvero il numero', () => {
  it('cresce sulla fisica E sulla speciale', () => {
    // Senza questo, i confronti contro il riferimento passerebbero anche se lo
    // strumento non facesse NIENTE e NCP nemmeno — cioè se avessimo sbagliato
    // a guidare l'harness.
    for (const caso of [FISICA, SPECIALE]) {
      const con = nostro('pikachu', 'light ball', caso)
      const senza = nostro('pikachu', null, caso)
      expect(con.maxDmg, `${caso.move}: la Sferascintilla non cambia il danno`)
        .toBeGreaterThan(senza.maxDmg)
    }
  })

  it('e su chi non è Pikachu no', () => {
    for (const caso of [FISICA, SPECIALE]) {
      const con = nostro('raichu', 'light ball', caso)
      const senza = nostro('raichu', null, caso)
      expect(con.rolls, `${caso.move}: la Sferascintilla si accende su Raichu`)
        .toEqual(senza.rolls)
    }
  })

  it('non tocca la catena di chi difende', () => {
    // È un modificatore dell'ATTACCO: addosso al difensore non deve fare
    // niente. Il cancello guarda `atkPokemon`, e uno scambio di lato sarebbe
    // invisibile a tutti i casi qui sopra.
    const conDif = calculateDamage({
      attacker: attaccante('raichu', null, SPECIALE),
      defender: { ...DIFENSORE, defPokemon: 'pikachu', defItem: 'light ball' },
      move: SPECIALE.move, field: {},
    })
    const senzaDif = calculateDamage({
      attacker: attaccante('raichu', null, SPECIALE),
      defender: { ...DIFENSORE, defPokemon: 'pikachu', defItem: null },
      move: SPECIALE.move, field: {},
    })
    expect(conDif.rolls).toEqual(senzaDif.rolls)
  })
})
