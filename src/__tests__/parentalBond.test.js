// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/parentalBond.test.js
 *
 * Parental Bond: la mossa colpisce due volte, la seconda a un quarto.
 *
 * ─── PERCHÉ NON È UN'ESTENSIONE DEI COLPI MULTIPLI ─────────────────────────
 *
 * La macchina che abbiamo per Population Bomb assume colpi IDENTICI: dieci
 * volte lo stesso tiro. Qui i due colpi sono diversi, e la differenza non è
 * cosmetica — la somma di due distribuzioni diverse non è due volte una di
 * loro, quindi la probabilità di KO va calcolata su tutt'e due.
 *
 * ─── DOVE SI APPLICA IL QUARTO ─────────────────────────────────────────────
 *
 * Al danno BASE, subito dopo il modificatore delle mosse ad area e prima di
 * tutto il resto (`damage_MASTER.js:2160`, `childMod = 0x0400`). Non è «il
 * primo colpo diviso quattro»: fra il danno base e il numero finale ci sono
 * meteo, critico, tiro, STAB, efficacia e la catena finale, e ognuno
 * arrotonda. Farlo alla fine darebbe un altro numero.
 *
 * ─── LE DUE FONTI, E DOVE NON COINCIDONO ───────────────────────────────────
 *
 * Il meccanismo è trascritto dal riferimento e confermato dalla wiki, che per
 * la settima generazione in poi dice «un quarto del danno». Sul numero le due
 * fonti coincidono.
 *
 * Su QUALI mosse no: la wiki elenca famiglie che il riferimento non esclude,
 * perché il riferimento calcola il numero di un colpo e non la sequenza del
 * turno. Delle sue esclusioni quattro ci riguardano, e stanno in
 * `MOSSE_SENZA_PARENTAL_BOND` con la fonte accanto. Su quelle quattro
 * divergiamo dall'oracolo DI PROPOSITO, ed è l'unico posto del motore dove
 * succede: il test in fondo le elenca una per una, così è un fatto rosso o
 * verde e non una nota in un commento.
 *
 * Due voci della wiki sono state tolte perché sbagliate, e le ha corrette
 * Simone: le mosse a caricamento (caricano al primo turno e al secondo
 * colpiscono due volte) e Uproar (sceglie un bersaglio singolo, quindi
 * l'abilità si attiva). Su tutt'e due il riferimento aveva ragione.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { MOSSE_SENZA_PARENTAL_BOND } from '../lib/rules.js'
import { koChanceCumulative } from '../lib/damage.js'
import movesData from '../data/moves.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

// Il set del meta, com'è scritto in `metaPresets.js`.
const kangaskhan = (atkAbility) => ({
  atkPokemon: 'kangaskhan-mega', atkSPs: [32, 32, 1, 0, 1, 0], atkNature: 'adamant',
  atkAbility, atkItem: 'kangaskhanite', level: 50,
})
const INCINEROAR = {
  defPokemon: 'incineroar', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}
const nostro = (atkAbility, move, doubleTarget = true) => calculateDamage({
  attacker: kangaskhan(atkAbility), defender: INCINEROAR, move,
  field: { doubleTarget }, debug: false,
})

describe('due colpi, e il secondo è suo', () => {
  it('con l\'abilità i colpi sono due', () => {
    const r = nostro('parental-bond', 'double-edge')
    expect(r.colpi).toBe(2)
    expect(r.rollsFiglio).not.toBeNull()
    expect(r.rollsFiglio.length).toBe(16)
  })

  it('senza l\'abilità è uno solo', () => {
    const r = nostro(null, 'double-edge')
    expect(r.colpi).toBe(1)
    expect(r.rollsFiglio).toBeNull()
  })

  it('il primo colpo è identico con e senza l\'abilità', () => {
    // Parental Bond non moltiplica niente: aggiunge un colpo. Se il primo
    // cambiasse, vorrebbe dire che è finita nella catena sbagliata.
    expect(nostro('parental-bond', 'double-edge').rolls)
      .toEqual(nostro(null, 'double-edge').rolls)
  })

  it('il secondo è circa un quarto del primo, non la metà né uguale', () => {
    const r = nostro('parental-bond', 'double-edge')
    const primo = r.rolls[r.rolls.length - 1]
    const secondo = r.rollsFiglio[r.rollsFiglio.length - 1]
    expect(secondo).toBeGreaterThan(primo * 0.2)
    expect(secondo).toBeLessThan(primo * 0.3)
  })

  it('il totale è la SOMMA dei due, non un moltiplicatore', () => {
    const r = nostro('parental-bond', 'double-edge')
    expect(r.minDmg).toBe(r.rolls[0] + r.rollsFiglio[0])
    expect(r.maxDmg).toBe(r.rolls[15] + r.rollsFiglio[15])
  })
})

describe('quando NON si applica', () => {
  it('su una mossa già multi-colpo', () => {
    // `!move.hitRange` nel riferimento. Bullet Seed colpisce da sé.
    expect(nostro('parental-bond', 'bullet seed').rollsFiglio).toBeNull()
  })

  it('su una mossa ad area con più bersagli in campo', () => {
    expect(nostro('parental-bond', 'rock slide', true).rollsFiglio).toBeNull()
  })

  it('ma la stessa mossa ad area, con UN bersaglio solo, colpisce due volte', () => {
    // È la distinzione che fa la fonte del gioco — «se tale mossa colpisce un
    // solo bersaglio, essa colpisce due volte» — e che il nostro
    // `doubleTarget` esprimeva già senza saperlo.
    expect(nostro('parental-bond', 'rock slide', false).rollsFiglio).not.toBeNull()
  })

  it('e sulle quattro mosse dell\'elenco dichiarato', () => {
    for (const move of MOSSE_SENZA_PARENTAL_BOND) {
      expect(nostro('parental-bond', move, false).rollsFiglio, move).toBeNull()
      expect(nostro('parental-bond', move, false).colpi, move).toBe(1)
    }
  })
})

describe('la probabilità di KO usa tutt\'e due le distribuzioni', () => {
  it('due colpi diversi non sono due volte lo stesso', () => {
    // Il difetto che si prenderebbe passando `colpiPerTurno: 2` e basta.
    const primo  = new Array(16).fill(40)
    const figlio = new Array(16).fill(10)
    const conFiglio = koChanceCumulative(primo, 45, 0, 1, 2, figlio)[0]
    const dueUguali = koChanceCumulative(primo, 45, 0, 1, 2)[0]
    // 40 + 10 = 50 > 45 → KO certo. 40 + 40 = 80 → anche, ma su altri HP i due
    // conti divergono: qui basta che il caso col figlio sia calcolato davvero.
    expect(conFiglio).toBe(1)
    expect(dueUguali).toBe(1)
    // Il caso che li separa: HP fra le due somme.
    expect(koChanceCumulative(primo, 60, 0, 1, 2, figlio)[0]).toBe(0)
    expect(koChanceCumulative(primo, 60, 0, 1, 2)[0]).toBe(1)
  })
})

describe('contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  // Le quattro mosse del set del meta, più una ad area su un bersaglio solo.
  // Il set porta quattro mosse; qui ce ne sono TRE, e la quarta ha una ragione
  // scritta nel test qui sotto.
  const casi = [
    ['Double-Edge', 'double-edge', true],
    ['Ice Punch',   'ice punch',   true],
    ['Fake Out',    'fake out',    true],
    ['Rock Slide su un bersaglio solo', 'rock slide', false],
  ]

  for (const [nome, move, doubleTarget] of casi) {
    it.runIf(vendorPresente)(`${nome}: TUTT'E DUE i colpi ≡ NCP`, () => {
      const rif = harness.calcola({
        attacker: kangaskhan('parental-bond'), defender: INCINEROAR, move,
        field: { doubleTarget },
      })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      const r = nostro('parental-bond', move, doubleTarget)

      expect(r.rolls, `${nome}: primo colpo`).toEqual(rif.rolls)
      // Il pezzo che conta: senza questo, il quarto di danno non sarebbe
      // verificato da niente — il primo colpo è identico con e senza abilità.
      expect(rif.rollsAggiuntivi.length, `${nome}: il riferimento non dà un secondo colpo`).toBe(1)
      expect(r.rollsFiglio, `${nome}: secondo colpo`).toEqual(rif.rollsAggiuntivi[0])
    })
  }

  it('Low Kick, la quarta mossa del set, non è calcolabile — e non per colpa di questa abilità', () => {
    // Fatto registrato invece che saltato in silenzio: il set del meta di
    // Kangaskhan Mega porta Low Kick, e il motore per quella mossa non
    // restituisce niente. La potenza dipende dal PESO del bersaglio, e il peso
    // è un campo che il progetto toglie dal bundle di proposito
    // (`potatura-dati.mjs`) perché nessuna riga di `src/` lo legge.
    //
    // È un buco dichiarato e precedente a Parental Bond, ma vale la pena che
    // stia scritto qui: di quattro mosse del set, tre prendono il secondo
    // colpo e la quarta non produce nemmeno un numero.
    expect(movesData['low kick'].power).toBe(0)
    expect(nostro('parental-bond', 'low kick')).toBeNull()
    expect(nostro(null, 'low kick'), 'e non è Parental Bond a romperla').toBeNull()
  })

  it.runIf(vendorPresente)('senza l\'abilità il riferimento non aggiunge colpi', () => {
    const rif = harness.calcola({
      attacker: kangaskhan(null), defender: INCINEROAR, move: 'double-edge',
      field: { doubleTarget: true },
    })
    expect(rif.rollsAggiuntivi).toEqual([])
    expect(nostro(null, 'double-edge').rolls).toEqual(rif.rolls)
  })
})

describe('le quattro divergenze volute, elencate', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(vendorPresente)('su queste quattro il riferimento raddoppia e noi no, di proposito', () => {
    // Non è un difetto ed è l'unico punto del motore dove succede. Elencato
    // qui perché sia un fatto verificabile: se un giorno il riferimento
    // smettesse di raddoppiarle, questo test lo direbbe e l'elenco andrebbe
    // tolto.
    const divergono = []
    for (const move of MOSSE_SENZA_PARENTAL_BOND) {
      const rif = harness.calcola({
        attacker: kangaskhan('parental-bond'), defender: INCINEROAR, move,
        field: { doubleTarget: false },
      })
      if (!rif.ok) continue
      const noi = nostro('parental-bond', move, false)
      if (rif.rollsAggiuntivi.length === 1 && noi.rollsFiglio === null) divergono.push(move)
    }
    expect(divergono.sort()).toEqual([...MOSSE_SENZA_PARENTAL_BOND].sort())
  })
})
