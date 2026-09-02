// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/copiatori.test.js
 *
 * Trace e Neutralizing Gas: i due che riscrivono QUALE abilita' si ha.
 *
 * ─── ERANO SEI, E SONO DUE ─────────────────────────────────────────────────
 *
 * Il divario elencava sei «copiatori»: Trace, Imposter, Receiver, Power of
 * Alchemy, Illusion, Neutralizing Gas. Misurato prima di scrivere: quattro di
 * loro compaiono nel riferimento in UN posto solo, la lista `cannotCopy` di
 * `checkTrace` (`damage_MASTER.js:387`), e da nessun'altra parte.
 *
 * Comparire li' dentro e' il contrario di essere calcolati: e' essere
 * l'eccezione al calcolo di qualcun altro. Il riferimento per loro non calcola
 * niente, e il registro le contava perche' cerca i nomi. Sono uscite dal
 * divario (vedi `listeDiSoliNomi.test.js`), e questo file resta con le due
 * vere.
 *
 * ─── DOVE STANNO, E PERCHE' CONTA ──────────────────────────────────────────
 *
 * Sono le prime tre righe di `CALCULATE_ALL_MOVES_SV` (`damage_SV.js:7-9`),
 * prima di ogni altro controllo:
 *
 *     checkTrace(p1, p2);
 *     checkTrace(p2, p1);
 *     checkNeutralGas(p1, p2, field.getNeutralGas());
 *
 * Non moltiplicano niente. Cambiano l'abilita', e tutto quello che viene dopo
 * — Intimidate, Download, il paradosso, le catene — gira sull'abilita' nuova.
 * E' il motivo per cui da noi stanno in `abilitaEffettive`, chiamata prima di
 * risolvere le chiavi in `calcEngine.js`.
 *
 * ─── LE DUE LISTE NON COINCIDONO ───────────────────────────────────────────
 *
 * `cannotCopy` ha 24 nomi, `cannotSupress` 15. Undici stanno solo nella prima
 * (Trace non le copia, il gas le spegne), due solo nella seconda (il gas non
 * le spegne, Trace le copierebbe). Dedurre l'una dall'altra sbaglierebbe
 * tredici voci su ventiquattro, e per questo sono trascritte separate.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { buildField } from '../lib/battleState.js'
import { abilitaEffettive } from '../lib/preparazione.js'
import { ABILITA_NON_COPIABILI, ABILITA_NON_SPEGNIBILI } from '../lib/rules.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const SORGENTE = path.join(RADICE, 'vendor', 'ncp', 'damage_MASTER.js')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const SP = [0, 0, 0, 0, 0, 0]
const ACCESO = { interruttore: true }

const att = (atkPokemon, atkAbility, flags = {}) => ({
  atkPokemon, atkSPs: SP, atkNature: null, atkAbility, atkItem: null, level: 50,
  atkAbilityFlags: flags,
})
const dif = (defPokemon, defAbility = null, flags = {}) => ({
  defPokemon, defSPs: SP, defNature: null,
  defAbility, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: flags,
})
const campo = () => buildField({ doubleTarget: true }, 't1')
const calcola = (attacker, defender, move) =>
  calculateDamage({ attacker, defender, move, field: campo(), debug: false })

// ═══════════════════════════════════════════════════════════════════════════
// 1. Le due liste, trascritte e non dedotte
// ═══════════════════════════════════════════════════════════════════════════

describe('le due liste del riferimento', () => {
  it.runIf(vendorPresente)('sono trascritte alla lettera', () => {
    const righe = fs.readFileSync(SORGENTE, 'utf8').split('\n')
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const estrai = (da, a) => new Set(
      [...righe.slice(da - 1, a).join(' ').matchAll(/'([^']+)'|"([^"]+)"/g)]
        .map(m => norm(m[1] || m[2])))

    expect(ABILITA_NON_COPIABILI).toEqual(estrai(387, 389))
    expect(ABILITA_NON_SPEGNIBILI).toEqual(estrai(403, 404))
  })

  it('non coincidono, e la differenza e\' quella misurata', () => {
    // Se un giorno qualcuno «semplificasse» tenendone una sola, questo lo
    // direbbe: tredici voci su ventiquattro cambierebbero comportamento.
    const soloCopia = [...ABILITA_NON_COPIABILI].filter(k => !ABILITA_NON_SPEGNIBILI.has(k))
    const soloSpegni = [...ABILITA_NON_SPEGNIBILI].filter(k => !ABILITA_NON_COPIABILI.has(k))
    expect(soloCopia.length).toBe(11)
    expect(soloSpegni.sort()).toEqual(['power-construct', 'tera-shift'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. `abilitaEffettive`: si prova da sola, non solo attraverso il danno
// ═══════════════════════════════════════════════════════════════════════════

describe('quale abilita\' ciascuno ha davvero', () => {
  const chiedi = (atk, def, flags = {}) => abilitaEffettive({
    atkAbility: atk, defAbility: def,
    atkInterruttore: flags.atk === true, defInterruttore: flags.def === true,
  })

  it('Trace acceso copia l\'abilita\' dell\'altro', () => {
    expect(chiedi('trace', 'intimidate', { atk: true }).attaccante).toBe('intimidate')
  })

  it('Trace spento non copia niente', () => {
    // Nel riferimento e' `source.abilityOn`: senza, la copia non e' avvenuta.
    expect(chiedi('trace', 'intimidate', {}).attaccante).toBe('trace')
  })

  it('Trace non copia cio\' che sta in `cannotCopy`', () => {
    // Disguise e' nella lista. Resta Trace, e resta inerte.
    expect(chiedi('trace', 'disguise', { atk: true }).attaccante).toBe('trace')
  })

  it('due Trace uno di fronte all\'altro non si copiano', () => {
    // `Trace` sta in `cannotCopy`. E' il caso che rende innocua la sequenza
    // delle due chiamate, dove la seconda leggerebbe quello che la prima ha
    // appena scritto.
    const r = chiedi('trace', 'trace', { atk: true, def: true })
    expect([r.attaccante, r.difensore]).toEqual(['trace', 'trace'])
  })

  it('il gas spegne tutt\'e due, e anche se stesso', () => {
    // `cannotSupress` non contiene Neutralizing Gas: il riferimento azzera
    // `p1.ability` e `p2.ability` senza guardare chi ha portato il gas.
    const r = chiedi('intimidate', 'neutralizing-gas')
    expect(r.attaccante).toBeNull()
    expect(r.difensore, 'il gas non ha spento se stesso').toBeNull()
  })

  it('ma il segnale di campo resta acceso', () => {
    // Serve alle aure e alle quattro Rovina, che nel riferimento lo leggono
    // come `field.isNeutralizingGas`. Se si spegnesse insieme all'abilita',
    // non ci sarebbe piu' niente a dire che il gas c'e' stato.
    expect(chiedi('intimidate', 'neutralizing-gas').gasNeutro).toBe(true)
  })

  it('il gas non spegne cio\' che sta in `cannotSupress`', () => {
    expect(chiedi('disguise', 'neutralizing-gas').attaccante).toBe('disguise')
  })

  it('senza nessuno dei due, le abilita\' restano quelle', () => {
    const r = chiedi('intimidate', 'levitate')
    expect([r.attaccante, r.difensore, r.gasNeutro]).toEqual(['intimidate', 'levitate', false])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. E si vede nel danno
// ═══════════════════════════════════════════════════════════════════════════

describe('l\'abilita\' copiata o spenta cambia il numero', () => {
  it('i presupposti: le specie hanno davvero queste abilita\'', () => {
    expect(pokemonData['gardevoir'].abilities).toContain('trace')
    expect(pokemonData['weezing'].abilities).toContain('neutralizing-gas')
  })

  /**
   * ─── PERCHE' NON INTIMIDATE ──────────────────────────────────────────────
   *
   * Il primo caso scritto qui era «Trace copia Intimidate», e non cambiava un
   * numero. Non era la copia a non funzionare: da noi Intimidate ha una
   * levetta sua (`intimidateActive`), perche' e' l'utente a dire se e' gia'
   * scattato, e copiare l'abilita' non accende quella levetta.
   *
   * Sarebbe stato un caso muto travestito da caso buono. Servono effetti che
   * si vedano da soli: Levitate, che rende immuni, e Huge Power, che
   * raddoppia.
   */
  it('Trace copia Levitate, e la mossa di Terra non arriva piu\'', () => {
    const copiato = calcola(
      att('weezing', 'levitate'), dif('gardevoir', 'trace', ACCESO), 'earthquake')
    const senza = calcola(
      att('weezing', 'levitate'), dif('gardevoir', 'trace', {}), 'earthquake')

    expect(senza.maxDmg, 'senza la copia il caso e\' gia\' muto').toBeGreaterThan(0)
    expect(copiato.immune, 'la copia non ha prodotto nessuna immunita\'').toBe(true)
  })

  it('il gas spegne Huge Power, e l\'attacco torna la meta\'', () => {
    // Weezing spegne tutt'e due le abilita', compresa la propria.
    const colGas = calcola(
      att('azumarill', 'huge-power'), dif('weezing', 'neutralizing-gas'), 'play rough')
    const senza = calcola(
      att('azumarill', 'huge-power'), dif('weezing', 'levitate'), 'play rough')

    const r = colGas.maxDmg / senza.maxDmg
    expect(r, 'il gas non ha spento Huge Power').toBeGreaterThan(0.45)
    expect(r, 'il gas non ha spento Huge Power').toBeLessThan(0.55)
  })

  it('senza gas Huge Power raddoppia davvero: il caso non e\' muto', () => {
    const con = calcola(att('azumarill', 'huge-power'), dif('weezing', 'levitate'), 'play rough')
    const senza = calcola(att('azumarill', null), dif('weezing', 'levitate'), 'play rough')
    expect(con.maxDmg / senza.maxDmg).toBeGreaterThan(1.9)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. L'oracolo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tutti dall'ingresso ALTO. `checkTrace` e `checkNeutralGas` vivono in
 * `CALCULATE_ALL_MOVES_SV`, non in `GET_DAMAGE_SV`: da `calcola` non
 * passerebbero, e i casi uscirebbero uguali per il motivo sbagliato.
 */
describe('roll per roll contro NCP, dall\'ingresso alto', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    const { creaHarness } = await import('../../scripts/ncp/harness.mjs')
    harness = creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const CASI = [
    ['Trace acceso copia Levitate',
      att('weezing', 'levitate'), dif('gardevoir', 'trace', ACCESO), 'earthquake'],
    ['Trace spento, la stessa mossa arriva',
      att('weezing', 'levitate'), dif('gardevoir', 'trace', {}), 'earthquake'],
    ['Trace acceso su un\'abilita\' non copiabile',
      att('mimikyu', 'disguise'), dif('gardevoir', 'trace', ACCESO), 'knock off'],
    ['Trace dal lato di chi attacca copia Huge Power',
      att('gardevoir', 'trace', ACCESO), dif('azumarill', 'huge-power'), 'psychic'],
    ['il gas spegne Huge Power',
      att('azumarill', 'huge-power'), dif('weezing', 'neutralizing-gas'), 'play rough'],
    ['senza gas, lo stesso caso',
      att('azumarill', 'huge-power'), dif('weezing', 'levitate'), 'play rough'],
    ['il gas dal lato di chi attacca',
      att('weezing', 'neutralizing-gas'), dif('azumarill', 'huge-power'), 'sludge bomb'],
    ['il gas contro un\'abilita\' non spegnibile',
      att('mimikyu', 'disguise'), dif('weezing', 'neutralizing-gas'), 'play rough'],
    ['il gas spegne anche il Levitate di chi lo porta',
      att('azumarill', 'huge-power'), dif('weezing', 'neutralizing-gas'), 'earthquake'],
  ]

  for (const [nome, attacker, defender, mossa] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const f = campo()
      const rif = harness.calcolaConPreparazione({ attacker, defender, move: mossa, field: f })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      expect(
        calculateDamage({ attacker, defender, move: mossa, field: f, debug: false }).rolls,
        `${nome}: divergiamo dal riferimento`,
      ).toEqual(rif.rolls)
    })
  }
})
