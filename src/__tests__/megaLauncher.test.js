/**
 * src/__tests__/megaLauncher.test.js
 *
 * Megalancio: ×1.5 sulle mosse-impulso.
 *
 * ─── PERCHE' PROPRIO QUESTA, DELLE 109 ─────────────────────────────────────
 *
 * Nel riferimento sta in un ramo che ne raccoglie sei — «1.5x Abilities»,
 * `damage_MASTER.js:1668`: Technician, Flare Boost, Toxic Boost, Mega
 * Launcher, Strong Jaw, Steely Spirit. Nessuna delle sei era implementata.
 *
 * È entrata questa perché è la prima che tocca un set del meta: il Mega
 * Blastoise con Dark Pulse, aggiunto poco fa. Prima di implementarla il
 * numero di quella mossa era più basso del vero di un terzo, e il segnalino
 * «non calcolata» lo dichiarava.
 *
 * ─── L'ORACOLO E' IL RIFERIMENTO, NON UN NUMERO CHE HO SCRITTO IO ──────────
 *
 * Lo snapshot dei 586 casi non copre Megalancio — verificato prima di
 * cominciare: dopo la modifica dava ancora zero divergenze. Serve quindi a
 * provare che non ho rotto il resto, non che la cosa nuova sia giusta.
 *
 * Perciò qui si esegue NCP e si confronta roll per roll. Un numero atteso
 * scritto a mano avrebbe provato solo che il motore fa quello che credevo io.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const attaccante = (atkAbility) => ({
  atkPokemon: 'blastoise-mega', atkSPs: [1, 0, 1, 32, 0, 32], atkNature: 'modest',
  atkAbility, atkItem: 'blastoisinite', level: 50,
})
const DIFENSORE = {
  defPokemon: 'incineroar', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}
const nostro = (move, atkAbility) => calculateDamage({
  attacker: attaccante(atkAbility), defender: DIFENSORE, move, field: {}, debug: false,
})

describe('le mosse-impulso vengono dal riferimento, non da una lista a mano', () => {
  it('sono sette, e sono quelle', () => {
    const pulse = Object.entries(movesData).filter(([, v]) => v.pulse).map(([k]) => k).sort()
    expect(pulse).toEqual([
      'aura sphere', 'dark pulse', 'dragon pulse', 'heal pulse',
      'origin pulse', 'terrain pulse', 'water pulse',
    ])
  })

  it('il flag sta nei dati, non nel motore', () => {
    // Se qualcuno riportasse la lista dentro calcEngine.js, `gen-flag-dati.mjs`
    // smetterebbe di governarla e diventerebbe una tabella che marcisce.
    const motore = fs.readFileSync(path.join(RADICE, 'src', 'calcEngine.js'), 'utf8')
    const nomi = ['aura sphere', 'dragon pulse', 'origin pulse', 'terrain pulse']
    expect(nomi.filter(n => motore.includes(`'${n}'`)), 'elenco di mosse-impulso nel motore')
      .toEqual([])
  })
})

describe('Megalancio, contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  for (const move of ['dark pulse', 'water pulse', 'aura sphere', 'dragon pulse']) {
    it.runIf(vendorPresente)(`${move} con Megalancio ≡ NCP`, () => {
      const input = { attacker: attaccante('mega-launcher'), defender: DIFENSORE, move, field: {} }
      const rif = harness.calcola(input)
      expect(rif.motivo ?? null, 'il caso non è esprimibile per l\'harness').toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(move, 'mega-launcher').rolls, `${move}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }

  it.runIf(vendorPresente)('una mossa NON impulso non prende il bonus — e NCP è d\'accordo', () => {
    // Controllo negativo contro l'oracolo: se il ramo si accendesse su tutto,
    // questo caso divergerebbe.
    const move = 'water spout'
    const rif = harness.calcola({ attacker: attaccante('mega-launcher'), defender: DIFENSORE, move, field: {} })
    expect(rif.ok).toBe(true)
    expect(nostro(move, 'mega-launcher').rolls).toEqual(rif.rolls)
  })
})

describe('Megalancio muove davvero il numero', () => {
  it('Dark Pulse cresce di metà', () => {
    // Senza questo, i test contro il riferimento passerebbero anche se
    // l'abilità non facesse NIENTE e NCP nemmeno — cioè se avessimo sbagliato
    // a guidare l'harness.
    const con = nostro('dark pulse', 'mega-launcher')
    const senza = nostro('dark pulse', null)
    expect(con.maxDmg, 'Megalancio non cambia il danno').toBeGreaterThan(senza.maxDmg)
  })

  it('e non tocca le mosse che non sono impulso', () => {
    const con = nostro('water spout', 'mega-launcher')
    const senza = nostro('water spout', null)
    expect(con.rolls, 'il bonus si accende su una mossa qualunque').toEqual(senza.rolls)
  })
})
