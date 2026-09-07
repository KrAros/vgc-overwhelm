/**
 * src/__tests__/incensi.test.js
 *
 * I cinque incensi: ×1.2 sulle mosse del loro tipo.
 *
 * ─── PERCHE' MANCAVANO, E PERCHE' SONO IL CASO PIU' NETTO DEI TRENTANOVE ───
 *
 * `ITEM_EFFECTS` aveva già diciotto potenziatori di tipo — Carbonella,
 * Acquamistica, Beccaffilato, Magnete… — tutti con la stessa forma:
 * `typBoost` più `bpMod: MOD.X1_2`.
 *
 * Il riferimento non distingue affatto gli incensi da quelli: `getItemBoostType`
 * (`item_data.js:496`) li mette nello stesso `switch`, e il ramo che ne usa il
 * risultato è lo stesso — `//k. 1.2x Items`, `damage_MASTER.js:1699`, che spinge
 * `0x1333`, cioè esattamente `MOD.X1_2`.
 *
 * Mancavano e basta: cinque righe che nessuno aveva scritto, mentre diciotto
 * sorelle c'erano. Erano cinque dei trentanove strumenti col segnalino «non
 * calcolata».
 *
 * ─── I TIPI SONO TRASCRITTI, NON DEDOTTI ───────────────────────────────────
 *
 * Dal nome non si indovinano: Sea e Wave sono **entrambi** Acqua, e Odd è
 * **Psico**. Presi dal `switch` del riferimento, uno per uno.
 *
 * ─── L'ORACOLO ─────────────────────────────────────────────────────────────
 *
 * Lo snapshot dei casi golden non li copre — verificato: prima di questa
 * modifica dava zero divergenze e continua a darne zero. Prova che non si è
 * rotto il resto, non che la cosa nuova sia giusta.
 *
 * Quindi si esegue il riferimento e si confronta roll per roll.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import { TYPES } from '../data/typeChart.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

/** Incenso → tipo potenziato → una mossa di quel tipo per provarlo. */
const CASI = [
  ['rose incense', TYPES.GRASS,   'energy ball'],
  ['odd incense',  TYPES.PSYCHIC, 'psychic'],
  ['sea incense',  TYPES.WATER,   'surf'],
  ['wave incense', TYPES.WATER,   'surf'],
  ['rock incense', TYPES.ROCK,    'rock slide'],
]

const attaccante = (atkItem) => ({
  atkPokemon: 'gholdengo', atkSPs: [0, 0, 0, 32, 0, 0], atkNature: 'modest',
  atkAbility: null, atkItem, level: 50,
})
/**
 * Dragonite e non Incineroar, e la ragione va scritta: Incineroar e' Fuoco/BUIO,
 * quindi immune a Psico. Con lui il caso dell'Odd Incense dava 0 con e senza
 * l'incenso — e il confronto contro il riferimento passava lo stesso, perche'
 * anche NCP dice 0. Un caso di prova che non puo' muoversi non prova niente.
 *
 * Su Dragonite tutte e cinque le mosse fanno danno, quindi il controllo
 * «l'incenso muove il numero» ha qualcosa da misurare.
 */
const DIFENSORE = {
  defPokemon: 'dragonite', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}
const nostro = (move, atkItem) => calculateDamage({
  attacker: attaccante(atkItem), defender: DIFENSORE, move, field: {}, debug: false,
})

describe('gli incensi sono nella tabella, con il tipo giusto', () => {
  it('tutti e cinque, con ×1.2', () => {
    for (const [incenso, tipo] of CASI) {
      const e = ITEM_EFFECTS[incenso]
      expect(e, `${incenso} non è in ITEM_EFFECTS`).toBeTruthy()
      expect(e.typBoost, `${incenso}: tipo sbagliato`).toBe(tipo)
      expect(e.bpMod, `${incenso}: moltiplicatore sbagliato`).toBe(ITEM_EFFECTS['charcoal'].bpMod)
    }
  })

  it('Sea e Wave sono entrambi Acqua, Odd è Psico', () => {
    // I tre che dal nome si sbaglierebbero. Se qualcuno «correggesse» Odd in
    // Normale o Wave in Volante, questo diventa rosso.
    expect(ITEM_EFFECTS['sea incense'].typBoost).toBe(TYPES.WATER)
    expect(ITEM_EFFECTS['wave incense'].typBoost).toBe(TYPES.WATER)
    expect(ITEM_EFFECTS['odd incense'].typBoost).toBe(TYPES.PSYCHIC)
  })
})

describe('gli incensi contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  for (const [incenso, , move] of CASI) {
    it.runIf(vendorPresente)(`${incenso} su ${move} ≡ NCP`, () => {
      const input = { attacker: attaccante(incenso), defender: DIFENSORE, move, field: {} }
      const rif = harness.calcola(input)
      expect(rif.motivo ?? null, 'caso non esprimibile per l\'harness').toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(move, incenso).rolls, `${incenso}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }

  it.runIf(vendorPresente)('su una mossa di ALTRO tipo non fa niente — e NCP è d\'accordo', () => {
    // Controllo negativo contro l'oracolo: se il ramo si accendesse su tutto,
    // questo caso divergerebbe.
    const move = 'shadow ball'
    const rif = harness.calcola({ attacker: attaccante('sea incense'), defender: DIFENSORE, move, field: {} })
    expect(rif.ok).toBe(true)
    expect(nostro(move, 'sea incense').rolls).toEqual(rif.rolls)
  })
})

describe('l\'incenso muove davvero il numero', () => {
  it('la mossa del tipo giusto cresce', () => {
    // Senza questo, i confronti contro il riferimento passerebbero anche se
    // l'incenso non facesse NIENTE e NCP nemmeno — cioè se avessimo sbagliato
    // a guidare l'harness.
    for (const [incenso, , move] of CASI) {
      const con = nostro(move, incenso)
      const senza = nostro(move, null)
      expect(con.maxDmg, `${incenso} non cambia il danno di ${move}`).toBeGreaterThan(senza.maxDmg)
    }
  })

  it('e la mossa di un altro tipo no', () => {
    const con = nostro('shadow ball', 'sea incense')
    const senza = nostro('shadow ball', null)
    expect(con.rolls, 'l\'incenso si accende su una mossa qualunque').toEqual(senza.rolls)
  })
})
