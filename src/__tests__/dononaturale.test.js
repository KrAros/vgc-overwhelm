// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/dononaturale.test.js
 *
 * Dononaturale: la bacca decide il TIPO e la POTENZA della mossa.
 *
 * ─── PERCHE' NON E' «UNA TABELLA E BASTA» ──────────────────────────────────
 *
 * Perche' la parte che conta non e' la potenza, e' il TIPO. Con la Bacca Chople
 * la mossa e' di Lotta, e su Blissey vale doppio: 240-284 invece di 120-142.
 * Una trascrizione che prendesse solo `p` e lasciasse il tipo Normale darebbe
 * un numero plausibile e sbagliato della meta', senza nessun avviso.
 *
 * Per questo il tipo si decide accanto a quello di Palla Clima, prima
 * dell'efficacia, e non fra i modificatori.
 *
 * ─── LE TRE COSE CHE IL REGISTRO NON DICEVA ────────────────────────────────
 *
 * Il registro elencava «la tabella e le due condizioni al contorno». Misurando
 * ne sono uscite altre tre, e tutte e tre cambiano il risultato:
 *
 *   1. LE «-ate» NON LA TOCCANO. `damage_SV.js:131` esclude otto mosse da
 *      `checkAbilityTypeChange`, e Dononaturale e' una di quelle. Con la Bacca
 *      Cilan la mossa e' Normale, quindi senza l'esclusione Pixilate la
 *      convertirebbe in Folletto e aggiungerebbe il ×1,2.
 *
 *   2. ERA GIA' UN DIFETTO NOSTRO, su un'altra mossa. Nello stesso elenco c'e'
 *      Palla Clima, che senza meteo e' Normale: misurato prima di toccare
 *      niente, con Pixilate davamo 12-13 dove il riferimento da' 11-13. Il
 *      difetto e' stato corretto qui perche' e' la stessa riga del riferimento
 *      — trascriverne meta' l'avrebbe lasciato in piedi.
 *
 *   3. GOFFAGGINE LA SPEGNE DEL TUTTO. `checkKlutz` scrive `item = "Klutz"`,
 *      che non contiene `" Berry"`: niente cambio di tipo e danno zero.
 *
 * ─── UNA MISURA CHE VA LETTA DAL PERCORSO GIUSTO ───────────────────────────
 *
 * Il caso di Goffaggine, chiesto a `calcola`, dice che il riferimento fa danno
 * — e sembrerebbe che divergiamo. Non e' cosi': `checkKlutz` gira in
 * `CALCULATE_ALL_MOVES_SV` (`damage_SV.js:18`), e `calcola` entra un livello
 * sotto, da `GET_DAMAGE_SV`. Dall'ingresso ALTO il riferimento risponde zero,
 * come noi. E' la stessa trappola gia' documentata nell'harness per Intimidate,
 * e qui c'e' un caso che la usa invece di raccontarla.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { DONO_NATURALE, haBaccaDaDono } from '../data/naturalGift.js'
import { MOSSE_CON_TIPO_PROPRIO } from '../lib/rules.js'
import { TYPES } from '../data/typeChart.js'
import itemsData from '../data/items.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = (item, extra = {}) => ({
  atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
  atkAbility: null, atkItem: item, level: 50, atkAbilityFlags: {}, ...extra,
})
/** Blissey, Normale puro: nessuno dei tipi in tabella le e' immune, quindi ogni
 *  caso puo' muoversi — e Lotta le vale doppio, che e' come si vede il tipo. */
const DIF = {
  defPokemon: 'blissey', defSPs: [32, 0, 16, 0, 16, 0], defNature: 'bold',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
}
const nostro = (item, extra = {}) => calculateDamage({
  attacker: att(item, extra), defender: DIF, move: 'natural gift', field: {}, debug: false,
})
const nostreBacche = Object.keys(itemsData).filter(k => k in DONO_NATURALE)

describe("la tabella è una copia del riferimento, non una trascrizione a mano", () => {
  it.runIf(vendorPresente)('sessantasei voci, tipo e potenza identici', async () => {
    // ─── I DUE ORACORI INDIPENDENTI ─────────────────────────────────────────
    // La tabella e' stata GENERATA leggendo `item_data.js`, quindi rileggerla
    // qui non e' una seconda copia: e' il confronto fra il file generato e la
    // sorgente da cui viene. Il giorno che il vendor cambia un numero, questo
    // diventa rosso — che e' l'unico modo di accorgersene, visto che nessun
    // caso di danno copre tutte e sessantasei.
    const src = fs.readFileSync(path.join(RADICE, 'vendor/ncp/item_data.js'), 'utf8')
    const blocco = src.slice(src.indexOf('function getNaturalGift'))
    const voci = [...blocco.slice(0, blocco.indexOf('}[item];')).matchAll(
      /'([A-Za-z' -]+ Berry)'\s*:\s*\{\s*'t'\s*:\s*'([A-Za-z]+)'\s*,\s*'p'\s*:\s*(\d+)/g)]
    expect(voci.length, "il riferimento non ha più sessantasei bacche").toBe(66)
    expect(Object.keys(DONO_NATURALE).length).toBe(66)

    const NOME_TIPO = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]))
    for (const [, nome, tipo, potenza] of voci) {
      const nostra = DONO_NATURALE[nome.toLowerCase()]
      expect(nostra, `${nome} manca nella nostra tabella`).toBeTruthy()
      expect(NOME_TIPO[nostra[0]], `${nome}: tipo diverso`).toBe(tipo.toUpperCase())
      expect(nostra[1], `${nome}: potenza diversa`).toBe(Number(potenza))
    }
  })

  it("delle nostre 49 «bacche» ne copre 48, e quella fuori è il Succo", () => {
    const conNome = Object.keys(itemsData).filter(k => k.includes('berry') || k.includes('juice'))
    expect(conNome.length).toBe(49)
    expect(nostreBacche.length).toBe(48)
    expect(conNome.filter(k => !(k in DONO_NATURALE))).toEqual(['berry juice'])
  })

  it("e il Succo cade fuori per lo SPAZIO, non per un elenco a parte", () => {
    // Il riferimento non lo tratta come caso speciale: `indexOf(" Berry")` non
    // lo trova perche' «berry» sta all'inizio del nome. Se qualcuno scrivesse
    // `includes('berry')` senza spazio, il Succo entrerebbe e prenderebbe il
    // valore di ripiego — un danno piccolo invece di nessun danno.
    expect(haBaccaDaDono('cheri berry')).toBe(true)
    expect(haBaccaDaDono('berry juice')).toBe(false)
    expect(haBaccaDaDono('leftovers')).toBe(false)
    expect(haBaccaDaDono(null)).toBe(false)
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

  it.runIf(vendorPresente)('tutte e quarantotto le bacche selezionabili', () => {
    const divergenti = []
    for (const bacca of nostreBacche) {
      const input = { attacker: att(bacca), defender: DIF, move: 'natural gift', field: {} }
      const rif = harness.calcola(input)
      expect(rif.motivo ?? null, `${bacca}: non esprimibile`).toBeNull()
      const n = nostro(bacca)
      if (JSON.stringify(n.rolls) !== JSON.stringify(rif.rolls)) divergenti.push(bacca)
    }
    expect(divergenti, 'divergiamo su queste bacche').toEqual([])
  })

  it.runIf(vendorPresente)('e i tre modi di non avere una bacca danno zero', () => {
    for (const item of [null, 'leftovers', 'berry juice']) {
      const input = { attacker: att(item), defender: DIF, move: 'natural gift', field: {} }
      const rif = harness.calcola(input)
      expect(rif.rolls, `${item}: il riferimento non dà più zero`).toEqual([])
      const n = nostro(item)
      expect(n.immune, `${item}: noi facciamo danno`).toBe(true)
      expect(n.reason, "è la mossa che fallisce, non il difensore che immunizza").toBe('move')
    }
  })

  it.runIf(vendorPresente)("Goffaggine la spegne — letto dall'ingresso ALTO", () => {
    const input = { attacker: att('cheri berry', { atkAbility: 'klutz' }),
      defender: DIF, move: 'natural gift', field: {} }
    // `calcola` entra da `GET_DAMAGE_SV`, sotto a `checkKlutz`: li' la bacca
    // funziona ancora, e sembrerebbe che divergiamo.
    expect(harness.calcola(input).rolls.length, "l'ingresso basso ha smesso di ignorare Klutz").toBe(16)
    // L'ingresso alto invece lo esegue, ed e' d'accordo con noi.
    expect(harness.calcolaConPreparazione(input).rolls).toEqual([])
    expect(nostro('cheri berry', { atkAbility: 'klutz' }).immune).toBe(true)
  })

  it.runIf(vendorPresente)("le «-ate» non la convertono, nemmeno quando è Normale", () => {
    // La Bacca Cilan da' tipo Normale: e' l'unico caso in cui il ramo delle
    // «-ate» potrebbe accendersi, ed e' quello che il riferimento esclude.
    expect(DONO_NATURALE['chilan berry'][0]).toBe(TYPES.NORMAL)
    const conPix = { attacker: att('chilan berry', { atkAbility: 'pixilate' }),
      defender: DIF, move: 'natural gift', field: {} }
    const rif = harness.calcola(conPix)
    expect(nostro('chilan berry', { atkAbility: 'pixilate' }).rolls).toEqual(rif.rolls)
    // e il numero e' lo stesso che senza abilita': la conversione non avviene.
    expect(rif.rolls).toEqual(harness.calcola(
      { attacker: att('chilan berry'), defender: DIF, move: 'natural gift', field: {} }).rolls)
  })

  it.runIf(vendorPresente)("e Palla Clima nemmeno — il difetto che c'era prima", () => {
    // Stessa riga del riferimento, altra mossa. Prima di questa sessione
    // davamo 12-13 dove il riferimento da' 11-13: la convertivamo in Folletto.
    const input = { attacker: att(null, { atkAbility: 'pixilate' }),
      defender: DIF, move: 'weather ball', field: {} }
    const rif = harness.calcola(input)
    const n = calculateDamage(input)
    expect(n.rolls, "Palla Clima è tornata convertibile dalle «-ate»").toEqual(rif.rolls)
    expect(n.effectiveMoveType, "il tipo non è più Normale").toBe(TYPES.NORMAL)
  })
})

describe('il tipo e la potenza arrivano davvero al numero', () => {
  it('la potenza viene dalla tabella, non dai dati della mossa', () => {
    expect(nostro('cheri berry').effectiveBP).toBe(80)
    expect(nostro('apicot berry').effectiveBP).toBe(100)
    expect(nostro('cornn berry').effectiveBP).toBe(90)
  })

  it("e il TIPO cambia l'efficacia, che è la metà che si dimentica", () => {
    // Chople e' Lotta: su Blissey (Normale) vale doppio. Cheri e' Fuoco:
    // neutro. Stessa potenza — 80 — e danno diverso della meta'.
    expect(DONO_NATURALE['chople berry']).toEqual([TYPES.FIGHTING, 80])
    expect(DONO_NATURALE['cheri berry']).toEqual([TYPES.FIRE, 80])
    const lotta = nostro('chople berry')
    const fuoco = nostro('cheri berry')
    expect(lotta.effectiveBP).toBe(fuoco.effectiveBP)
    expect(lotta.effectiveness).toBe(2)
    expect(fuoco.effectiveness).toBe(1)
    expect(lotta.maxDmg, "il tipo della bacca non tocca l'efficacia").toBeGreaterThan(fuoco.maxDmg)
  })

  it("il tipo effettivo è quello della bacca", () => {
    expect(nostro('chople berry').effectiveMoveType).toBe(TYPES.FIGHTING)
    expect(nostro('yache berry').effectiveMoveType).toBe(TYPES.ICE)
  })

  it('e senza bacca la mossa fallisce invece di fare zero danno', () => {
    // La differenza si vede nel riquadro: «Fallisce» e non «Immune».
    const senza = nostro(null)
    expect(senza.immune).toBe(true)
    expect(senza.reason).toBe('move')
    expect(senza.moveName).toBe('natural gift')
  })
})

describe("l'elenco delle mosse col tipo proprio", () => {
  it('sono le otto del riferimento', () => {
    expect([...MOSSE_CON_TIPO_PROPRIO].sort()).toEqual([
      'hidden power', 'judgement', 'multi-attack', 'natural gift',
      'revelation dance', 'techno blast', 'terrain pulse', 'weather ball',
    ])
  })

  it("e protegge anche le due che avevamo già e nessuno guardava", () => {
    // `multi-attack` e `terrain pulse` sono in `moves.json` da prima di questa
    // sessione, e prendevano la conversione come Palla Clima.
    expect(MOSSE_CON_TIPO_PROPRIO.has('multi-attack')).toBe(true)
    expect(MOSSE_CON_TIPO_PROPRIO.has('terrain pulse')).toBe(true)
  })
})
