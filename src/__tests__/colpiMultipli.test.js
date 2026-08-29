// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/colpiMultipli.test.js
 *
 * Le mosse che colpiscono più volte. Trentuno su 810.
 *
 * ─── PERCHÉ ADESSO ─────────────────────────────────────────────────────────
 *
 * Per il set del meta `maushold` «Population Bomb Attacker». Bombardamento
 * colpisce fino a dieci volte, e fino a oggi l'app mostrava il danno di UNO
 * di quei dieci colpi. Non era un errore del dieci per cento: era un decimo
 * del numero vero, e nessuno lo dichiarava.
 *
 * ─── IL NUMERO DI COLPI NON VIENE DAL RIFERIMENTO ──────────────────────────
 *
 * Questa è la parte da tenere dritta. `GET_DAMAGE_SV` calcola il danno di UN
 * colpo e basta — `move.hits` gli serve solo per scrivere «(10 hits)» nella
 * descrizione. Quante volte colpisca lo sceglie l'utente nell'interfaccia di
 * NCP, che non abbiamo vendorizzato.
 *
 * Quindi la divisione del lavoro è:
 *
 *   TRASCRITTO   l'intervallo `[min, max]`, che è `hitRange` del vendor,
 *                copiato da `gen-flag-dati.mjs` come i flag `bite` e `pulse`.
 *   TRASCRITTO   il danno del singolo colpo, verificato contro NCP come sempre.
 *   NOSTRO       quale numero dentro quell'intervallo. È una scelta di
 *                modello, e la scelta è: lo dichiara chi usa l'app, con il
 *                massimo come valore di riposo. Stessa forma del contatore di
 *                Ultimo Rispetto, e per la stessa ragione — è uno stato del
 *                turno, non una cosa che il motore possa dedurre.
 *
 * ─── LO SNAPSHOT NON POTEVA VEDERLO ────────────────────────────────────────
 *
 * Nessuno dei 586 casi usa una mossa multi-colpo: verificato contandoli. Lo
 * snapshot è stato comunque rigenerato in questo commit, ma per una ragione
 * diversa e dichiarata — il risultato del motore ha un campo in più (`colpi`)
 * e i 586 casi confrontano l'oggetto intero. `npm run snapshot:diff` prima
 * della rigenerazione diceva «rolls invariati» su tutti e 565, e l'unica
 * differenza elencata era quel campo.
 *
 * ─── DUE MOSSE RESTANO FUORI, E SI VEDE ────────────────────────────────────
 *
 * Tricalcio e Triplo Axel hanno `isTripleHit`: la potenza SALE a ogni colpo
 * (10/20/30 e 20/40/60), quindi il totale non è «un colpo per tre». È una
 * meccanica diversa e non è implementata. Restano a un colpo, marcate con
 * `potenzaCrescente` invece che moltiplicate a caso.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { koChanceCumulative } from '../lib/damage.js'
import movesData from '../data/moves.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const maushold = (extra = {}) => ({
  atkPokemon: 'maushold', atkSPs: [2, 32, 0, 0, 0, 32], atkNature: 'jolly',
  atkAbility: 'technician', atkItem: null, level: 50, ...extra,
})
const INCINEROAR = {
  defPokemon: 'incineroar', defSPs: [32, 0, 24, 0, 8, 2], defNature: 'impish',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}
const bomba = (extra = {}) => calculateDamage({
  attacker: maushold(extra), defender: INCINEROAR,
  move: 'population bomb', field: {}, debug: false,
})

describe('gli intervalli vengono dal vendor, non scritti a mano', () => {
  it('sono trentuno, con la forma `[min, max]` sempre', () => {
    const conColpi = Object.entries(movesData).filter(([, v]) => v.colpi)
    expect(conColpi.length).toBe(31)
    for (const [nome, v] of conColpi) {
      expect(Array.isArray(v.colpi), `${nome}: la forma non è una coppia`).toBe(true)
      expect(v.colpi.length, nome).toBe(2)
      expect(v.colpi[0], `${nome}: min sopra max`).toBeLessThanOrEqual(v.colpi[1])
    }
  })

  it('i colpi fissi sono `[n, n]`, non un numero', () => {
    // In NCP il campo ha due forme — un numero quando i colpi sono fissi, una
    // coppia quando variano. Normalizzarle a una sola toglie un `if` a ogni
    // uso, e con lui il giorno che qualcuno se lo dimentica.
    expect(movesData['double kick'].colpi).toEqual([2, 2])
    expect(movesData['bullet seed'].colpi).toEqual([2, 5])
    expect(movesData['population bomb'].colpi).toEqual([1, 10])
  })

  it('le due a potenza crescente sono marcate', () => {
    const crescenti = Object.entries(movesData)
      .filter(([, v]) => v.potenzaCrescente).map(([k]) => k).sort()
    expect(crescenti).toEqual(['triple axel', 'triple kick'])
  })

  it('la lista non è nel motore', () => {
    const motore = fs.readFileSync(path.join(RADICE, 'src', 'calcEngine.js'), 'utf8')
    const nomi = ['population bomb', 'bullet seed', 'icicle spear', 'rock blast']
    expect(nomi.filter(n => motore.includes(`'${n}'`)), 'elenco di mosse multi-colpo nel motore')
      .toEqual([])
  })
})

describe('quante volte colpisce', () => {
  it('di riposo è il massimo', () => {
    expect(bomba().colpi).toBe(10)
  })

  it('la scelta dell\'utente vince', () => {
    expect(bomba({ colpiScelti: 3 }).colpi).toBe(3)
  })

  it('una scelta fuori intervallo viene tagliata, non presa alla lettera', () => {
    // Il selettore dell'editor copre l'unione degli intervalli dello slot,
    // quindi con due mosse diverse può proporre un numero che UNA delle due
    // non può fare. Il taglio è qui e non nell'interfaccia: così vale anche
    // per un link condiviso con un valore vecchio.
    const seminta = (colpiScelti) => calculateDamage({
      attacker: maushold({ colpiScelti }), defender: INCINEROAR,
      move: 'bullet seed', field: {}, debug: false,
    })
    expect(seminta(10).colpi, 'Semintamitraglia arriva a cinque').toBe(5)
    expect(seminta(1).colpi, 'e non scende sotto due').toBe(2)
    expect(seminta(3).colpi).toBe(3)
  })

  it('una mossa normale colpisce una volta', () => {
    expect(calculateDamage({
      attacker: maushold(), defender: INCINEROAR, move: 'feint', field: {}, debug: false,
    }).colpi).toBe(1)
  })

  it('Tricalcio resta a uno anche se ne dichiara tre', () => {
    // Non è «non l'abbiamo trascritta»: è trascritta e dichiarata NON
    // modellata, perché la potenza sale a ogni colpo.
    const r = calculateDamage({
      attacker: { ...maushold(), atkPokemon: 'hitmontop', atkAbility: 'technician' },
      defender: INCINEROAR, move: 'triple kick', field: {}, debug: false,
    })
    expect(r.colpi).toBe(1)
  })

  it('Abilità Multipla inchioda al massimo, anche contro la scelta', () => {
    const cinccino = (atkAbility, colpiScelti) => calculateDamage({
      attacker: {
        atkPokemon: 'cinccino', atkSPs: [0, 32, 0, 0, 0, 32], atkNature: 'jolly',
        atkAbility, atkItem: null, level: 50, colpiScelti,
      },
      defender: INCINEROAR, move: 'tail slap', field: {}, debug: false,
    })
    expect(cinccino('skill-link', 2).colpi, 'la scelta non deve poter scendere').toBe(5)
    expect(cinccino('technician', 2).colpi, 'senza l\'abilità invece scende').toBe(2)
  })
})

describe('il contratto del risultato: i roll restano di UN colpo', () => {
  it('`rolls` è per-colpo, `minDmg` e `maxDmg` sono il totale', () => {
    // È la distinzione che tiene in piedi tutto il resto: i roll restano
    // confrontabili col riferimento (che calcola un colpo), i totali sono ciò
    // che l'utente legge.
    const r = bomba()
    expect(r.colpi).toBe(10)
    expect(r.minDmg).toBe(r.rolls[0] * 10)
    expect(r.maxDmg).toBe(r.rolls[r.rolls.length - 1] * 10)
    expect(r.rolls.length).toBe(16)
  })

  it('e per una mossa normale i due livelli coincidono', () => {
    const r = calculateDamage({
      attacker: maushold(), defender: INCINEROAR, move: 'feint', field: {}, debug: false,
    })
    expect(r.minDmg).toBe(r.rolls[0])
    expect(r.maxDmg).toBe(r.rolls[r.rolls.length - 1])
  })

  it('dieci colpi fanno circa dieci volte il danno', () => {
    const uno = bomba({ colpiScelti: 1 })
    const dieci = bomba({ colpiScelti: 10 })
    expect(dieci.maxDmg).toBe(uno.maxDmg * 10)
    expect(dieci.maxPct).toBeGreaterThan(uno.maxPct * 9)
  })
})

describe('la probabilità di KO non si calcola moltiplicando', () => {
  // Il pezzo che rende il numero utile, ed è anche quello che si sbaglia più
  // facilmente.

  it('dieci colpi in un turno non sono dieci turni', () => {
    // La differenza sta nell'EOT, che scatta una volta per turno. Con gli
    // Avanzi (+16 HP a turno) le due letture divergono di parecchio.
    const rolls = Array(16).fill(10)
    const dieciColpiUnTurno = koChanceCumulative(rolls, 150, 16, 1, 10)
    const dieciTurni        = koChanceCumulative(rolls, 150, 16, 10, 1)
    // 10 colpi × 10 danni = 100 su 150 HP: nessun KO nel turno.
    expect(dieciColpiUnTurno[0]).toBe(0)
    // In dieci turni invece la cura (+16) supera il danno (10) e il difensore
    // non scende mai: nemmeno lì c'è KO, ma per la ragione OPPOSTA.
    expect(dieciTurni[9]).toBe(0)
    // Il caso che li separa: HP bassi. Un turno da dieci colpi uccide, dieci
    // turni no perché fra l'uno e l'altro il difensore si cura.
    expect(koChanceCumulative(rolls, 90, 16, 1, 10)[0]).toBe(1)
    expect(koChanceCumulative(rolls, 90, 16, 10, 1)[9]).toBe(0)
  })

  it('con un colpo per turno il calcolo è identico a prima', () => {
    // Il parametro è nuovo: questo prova che non ha spostato niente per le
    // 779 mosse che colpiscono una volta sola.
    const rolls = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55]
    for (const eot of [0, 12, -8]) {
      expect(koChanceCumulative(rolls, 180, eot, 6, 1))
        .toEqual(koChanceCumulative(rolls, 180, eot, 6))
    }
  })

  it('la somma di dieci tiri è più stretta di dieci volte un tiro', () => {
    // La ragione per cui `minDmg`/`maxDmg` NON bastano per la probabilità:
    // gli estremi del totale esistono, ma sono rarissimi. Con un difensore da
    // 105 HP, dieci colpi da 10-13 arrivano fra 100 e 130 — il KO non è né
    // impossibile né certo, ma la sua probabilità non si legge dagli estremi.
    const rolls = [10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 13, 13, 13, 13]
    const p = koChanceCumulative(rolls, 105, 0, 1, 10)[0]
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
  })
})

describe('Bombardamento, il colpo singolo, contro il riferimento', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  it.runIf(vendorPresente)('il danno di UN colpo combacia, e il numero di colpi non lo cambia', () => {
    // L'oracolo copre solo il singolo colpo, ed è giusto così: è tutto quello
    // che il riferimento calcola. Il secondo `expect` è il punto — cambiare il
    // numero di colpi non deve toccare i roll, altrimenti il confronto con NCP
    // dipenderebbe da una scelta nostra.
    const rif = harness.calcola({
      attacker: maushold(), defender: INCINEROAR, move: 'population bomb', field: {},
    })
    expect(rif.ok).toBe(true)
    expect(bomba({ colpiScelti: 10 }).rolls).toEqual(rif.rolls)
    expect(bomba({ colpiScelti: 1 }).rolls).toEqual(rif.rolls)
  })
})
