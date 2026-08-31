// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/ingegnoAcciaio.test.js
 *
 * Ingegno Acciaio (`steely-spirit`): ×1,5 sulle mosse di tipo Acciaio.
 *
 * ─── LA TERZA DELLE SEI, E L'ULTIMA RAGGIUNGIBILE ──────────────────────────
 *
 * Il ramo delle «1.5x Abilities» (`damage_MASTER.js:1668`) ne raccoglie sei.
 * Con questa siamo a tre: Megalancio, Ferromascella, Ingegno Acciaio. Delle
 * altre tre, due non sono raggiungibili — Flare Boost vuole lo stato
 * «bruciato», Toxic Boost «avvelenato», e gli stati non li modelliamo (§1.12)
 * — e Technician sì, ma ha una condizione che dipende dalla potenza GIÀ
 * modificata e va guardata a parte.
 *
 * ─── METÀ ABILITÀ, METÀ CASELLA DI CAMPO ───────────────────────────────────
 *
 * Nel riferimento Ingegno Acciaio compare DUE volte, con lo stesso `0x1800`:
 *
 *     punto g      attacker.ability === "Steely Spirit"   ← questa
 *     punto d.iii  field.isSteelySpirit                   ← l'alleato
 *
 * La seconda è il caso in cui ce l'ha un ALLEATO: in NCP è una casella di
 * campo, come Battery e Power Spot, e noi le caselle di campo non le abbiamo.
 * Quella metà resta fuori, ed è la stessa ragione per cui `battery` e
 * `power spot` restano nel divario.
 *
 * Non è una scelta di comodo: l'harness passa `isSteelySpirit: false` a NCP,
 * quindi l'oracolo qui sotto misura esattamente la metà che abbiamo scritto.
 * Il test in fondo la mette per iscritto.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { elencoGap } from '../lib/gap.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const perrserker = (atkAbility) => ({
  atkPokemon: 'perrserker', atkSPs: [0, 32, 0, 0, 0, 12], atkNature: 'adamant',
  atkAbility, atkItem: null, level: 50,
})
const INCINEROAR = {
  defPokemon: 'incineroar', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}
const nostro = (atkAbility, move) => calculateDamage({
  attacker: perrserker(atkAbility), defender: INCINEROAR, move, field: {}, debug: false,
})

describe('Ingegno Acciaio, contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  for (const [nome, atkAbility, move] of [
    ['Iron Head col bonus',           'steely-spirit', 'iron head'],
    ['Gigaton Hammer col bonus',      'steely-spirit', 'gigaton hammer'],
    ['Bullet Punch col bonus',        'steely-spirit', 'bullet punch'],
    // Controllo negativo: Close Combat non è Acciaio.
    ['Close Combat, che Acciaio non è', 'steely-spirit', 'close combat'],
    ['Iron Head senza l\'abilità',    null,            'iron head'],
    // L'altra abilità di Perrserker, sulla stessa mossa: se i due rami si
    // confondessero, questo caso lo direbbe. Iron Head è a contatto, quindi
    // Tough Claws si accende davvero — ma con ×1.3, non ×1.5.
    ['Iron Head con Tough Claws',     'tough-claws',   'iron head'],
  ]) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({
        attacker: perrserker(atkAbility), defender: INCINEROAR, move, field: {},
      })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(nostro(atkAbility, move).rolls, `${nome}: divergiamo dal riferimento`)
        .toEqual(rif.rolls)
    })
  }
})

describe('Ingegno Acciaio muove il numero, e solo sull\'Acciaio', () => {
  it('Iron Head cresce di metà', () => {
    expect(nostro('steely-spirit', 'iron head').maxDmg)
      .toBeGreaterThan(nostro(null, 'iron head').maxDmg)
  })

  it('e cresce più che con Tough Claws, che è ×1.3 sulla stessa mossa', () => {
    // I due rami esistono tutti e due e danno numeri diversi: senza questo,
    // un ×1.3 scritto per sbaglio passerebbe il test qui sopra.
    expect(nostro('steely-spirit', 'iron head').maxDmg)
      .toBeGreaterThan(nostro('tough-claws', 'iron head').maxDmg)
  })

  it('Close Combat no', () => {
    expect(nostro('steely-spirit', 'close combat').rolls)
      .toEqual(nostro(null, 'close combat').rolls)
  })
})

/**
 * ─── LA METÀ CHE MANCAVA ADESSO C'È ────────────────────────────────────────
 *
 * Questo blocco si chiamava «la metà che non c'è resta dichiarata» e registrava
 * un'assenza: l'Ingegno Acciaio dell'ALLEATO è `field.isSteelySpirit`, una
 * casella di campo, e caselle di campo non ne avevamo.
 *
 * Diceva anche dove guardare — «se un giorno arrivassero le caselle di campo,
 * questo test dice dove guardare» — e il giorno è arrivato: sono cinque, e
 * stanno in `caselleAlleato.test.js`.
 *
 * Il blocco resta, girato dall'altra parte: adesso prova che la METÀ C'È e che
 * la voce le dichiara tutt'e due. Un'assenza registrata che viene colmata non
 * si cancella, si rovescia — così chi legge trova la storia invece del solo
 * stato finale.
 */
describe('le due metà ci sono tutt\'e due', () => {
  it('quella dell\'alleato è una casella di campo, e adesso ce l\'abbiamo', () => {
    // Le altre quattro dello stesso genere. Non sono più nel divario: il campo
    // `casellaDiCampo` dice che il motore le calcola, solo che le legge
    // dall'interruttore nella barra invece che dallo slot.
    for (const chiave of ['battery', 'power-spot', 'friend-guard', 'flower-gift']) {
      expect(ABILITY_EFFECTS[chiave]?.casellaDiCampo, `${chiave}`).toBeTruthy()
    }
    expect(elencoGap.abilita).not.toContain('battery')
    expect(elencoGap.abilita).not.toContain('power spot')
  })

  it('la voce dichiara la metà offensiva E quella dell\'alleato', () => {
    expect(ABILITY_EFFECTS['steely-spirit']).toEqual({
      steelySpirit: true, casellaDiCampo: 'steelySpirit', showInSmogon: true,
    })
  })
})
