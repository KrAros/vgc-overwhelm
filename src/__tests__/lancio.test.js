// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/lancio.test.js
 *
 * Lancio: la potenza dipende dallo strumento che si tira.
 *
 * ─── L'ULTIMA DELLE SETTE, E LA PIU' RICCA ─────────────────────────────────
 *
 * Il registro la dava come «una tabella con tre regole per famiglia dentro, e
 * una guardia». Misurando, il conto era un altro:
 *
 *   il registro diceva        misurato
 *   53 nominati, 29 nostri    86 dei nostri 320 prendono un valore non di ripiego
 *   «tre regole»              due regole per famiglia (Plate 90, Memory 50)
 *   «una guardia»             undici condizioni, e una riguarda il DIFENSORE
 *
 * La differenza fra 29 e 86 e' tutta nelle due regole per famiglia: diciassette
 * Tavole e diciassette Memorie entrano senza essere nominate.
 *
 * ─── PERCHE' UNA CATENA E NON UNA TABELLA ──────────────────────────────────
 *
 * Perche' nel riferimento e' una catena di undici ternari annidati, e l'ordine
 * e' la meccanica: l'EVOLCONDENSA compare due volte, 80 al quarto livello e 40
 * al nono, e vince il primo. Una tabella piatta avrebbe dovuto SCEGLIERE, e
 * scegliere avrebbe voluto dire correggere il riferimento invece di copiarlo.
 *
 * ─── IL CASO CHE HA TROVATO TUTTO ──────────────────────────────────────────
 *
 * Provare TUTTI e 320 gli strumenti contro l'oracolo, invece di una manciata
 * scelta a mano, ha trovato due cose che nessun caso mirato avrebbe preso:
 *
 *   cinque strumenti le cui chiavi in `items.json` non hanno gli spazi
 *   (`deepseatooth`, `blackglasses`, …) e che quindi non si trovavano negli
 *   elenchi scritti col nome del listino;
 *
 *   e un difetto che col Lancio non c'entrava niente — quattro potenziatori di
 *   tipo che non si accendevano MAI, per lo stesso disallineamento di chiavi.
 *   Corretto nel commit precedente.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { potenzaLancio, nonSiPuoLanciare } from '../lib/rules.js'
import itemsData from '../data/items.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = (item, extra = {}) => ({
  atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
  atkAbility: null, atkItem: item, level: 50, atkAbilityFlags: {}, ...extra,
})
const dif = (extra = {}) => ({
  defPokemon: 'blissey', defSPs: [32, 0, 16, 0, 16, 0], defNature: 'bold',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const nostro = (item, extra = {}, d = {}) => calculateDamage({
  attacker: att(item, extra), defender: dif(d), move: 'fling', field: {}, debug: false,
})

describe('la catena, coi valori misurati contro l\'oracolo', () => {
  it('i dieci livelli, uno per uno', () => {
    expect(potenzaLancio('iron ball')).toBe(130)
    expect(potenzaLancio('hard stone')).toBe(100)
    expect(potenzaLancio('thick club')).toBe(90)
    expect(potenzaLancio('assault vest')).toBe(80)
    expect(potenzaLancio('poison barb')).toBe(70)
    expect(potenzaLancio('rocky helmet')).toBe(60)
    expect(potenzaLancio('sharp beak')).toBe(50)
    expect(potenzaLancio('icy rock')).toBe(40)
    expect(potenzaLancio('charcoal')).toBe(30)
    expect(potenzaLancio('leftovers'), 'il ripiego').toBe(10)
  })

  it("l'Evolcondensa vale 80, non 40 — vince la prima delle due righe", () => {
    // È la cosa che una tabella piatta non può esprimere: il riferimento la
    // nomina due volte con due valori, e l'ordine decide.
    expect(potenzaLancio('eviolite')).toBe(80)
  })

  it('due regole valgono per FAMIGLIA, non per nome', () => {
    // Nessuna Tavola e nessuna Memoria è nominata negli elenchi: entrano da
    // `includes`. Sono 34 strumenti su 86.
    const tavole = Object.keys(itemsData).filter(k => k.includes('plate'))
    const memorie = Object.keys(itemsData).filter(k => k.includes('memory'))
    expect(tavole.length).toBe(17)
    expect(memorie.length).toBe(17)
    for (const t of tavole) expect(potenzaLancio(t), t).toBe(90)
    for (const m of memorie) expect(potenzaLancio(m), m).toBe(50)
  })

  it("e il Grigiosfera cade sul ripiego, dove gli altri due orbi stanno a 60", () => {
    // Sembra un refuso del riferimento e si trascrive com'è. Misurato: 16
    // danni contro i 90 di Orbo Adamante e Orbo Bramoso.
    expect(potenzaLancio('adamant orb')).toBe(60)
    expect(potenzaLancio('lustrous orb')).toBe(60)
    expect(potenzaLancio('griseous orb'), 'non è nella lista dei 60').toBe(10)
  })

  it('le cinque chiavi senza spazi si trovano lo stesso', () => {
    // `items.json` le scrive così, e scritte solo col nome del listino
    // avrebbero preso il ripiego in silenzio. È successo, e l'ha visto il caso
    // che prova tutti e 320 gli strumenti.
    expect(potenzaLancio('deepseatooth')).toBe(90)
    expect(potenzaLancio('blackglasses')).toBe(30)
    expect(potenzaLancio('nevermeltice')).toBe(30)
    expect(potenzaLancio('twistedspoon')).toBe(30)
    expect(potenzaLancio('deepseascale')).toBe(30)
  })
})

describe('la guardia: quando lo strumento non si lancia', () => {
  it('le condizioni che ci riguardano', () => {
    expect(nonSiPuoLanciare('', 'garchomp', false), 'niente in mano').toBe(true)
    expect(nonSiPuoLanciare('normal gem', 'garchomp', false), 'le gemme').toBe(true)
    expect(nonSiPuoLanciare('cheri berry', 'garchomp', true), 'bacca contro Unnerve').toBe(true)
    expect(nonSiPuoLanciare('cheri berry', 'garchomp', false), 'bacca senza Unnerve').toBe(false)
    expect(nonSiPuoLanciare('charcoal', 'garchomp', false)).toBe(false)
  })

  it('e le quattro legate alla specie', () => {
    expect(nonSiPuoLanciare('griseous orb', 'giratina-origin', false)).toBe(true)
    expect(nonSiPuoLanciare('griseous orb', 'garchomp', false)).toBe(false)
    expect(nonSiPuoLanciare('flame plate', 'arceus', false)).toBe(true)
    expect(nonSiPuoLanciare('burn drive', 'genesect', false)).toBe(true)
    expect(nonSiPuoLanciare('bug memory', 'silvally', false)).toBe(true)
  })

  it("la condizione sui cristalli Z non può mai scattare, ed è scritta com'è", () => {
    // `atItem.indexOf(" ium Z")` cerca uno SPAZIO prima di «ium Z», e nessun
    // nome ce l'ha. Nel gioco i cristalli Z non si lanciano; nel riferimento
    // sì. Si segue l'oracolo, non la wiki.
    //
    // Il giorno che il riferimento corregge il refuso, questo diventa rosso.
    expect('Normalium Z'.indexOf(' ium Z'), 'lo spazio non combacia').toBe(-1)
    expect('Normalium Z'.indexOf('ium Z'), 'senza spazio combacerebbe').toBeGreaterThan(-1)
    expect(nonSiPuoLanciare('normalium z', 'garchomp', false), 'non è bloccato').toBe(false)
    expect(potenzaLancio('normalium z'), 'e prende il ripiego').toBe(10)
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

  it.runIf(vendorPresente)('TUTTI e 320 gli strumenti selezionabili', () => {
    // Non una manciata scelta a mano: è il caso che ha trovato i cinque nomi
    // senza spazi e i quattro potenziatori spenti. Un campione non li prende.
    const divergenti = []
    let provati = 0
    const esclusi = []
    for (const k of Object.keys(itemsData)) {
      const input = { attacker: att(k), defender: dif(), move: 'fling', field: {} }
      const rif = harness.calcola(input)
      // Ventuno strumenti non sono nel listino di NCP a questa generazione —
      // sedici gemme e cinque voci solo nostre. Il caso non è esprimibile, e si
      // esclude col MOTIVO scritto invece di saltarlo in silenzio.
      if (rif.motivo) { esclusi.push([k, rif.motivo]); continue }
      provati++
      const n = nostro(k)
      const nostri = n.immune ? [] : n.rolls
      if (JSON.stringify(nostri) !== JSON.stringify(rif.rolls)) divergenti.push(k)
    }
    expect(divergenti, 'divergiamo su questi strumenti').toEqual([])
    expect(provati, 'la prova è diventata piccola: qualcosa esclude troppo').toBeGreaterThan(290)

    // Gli esclusi sono esclusi per UNA ragione sola, e scritta: il riferimento
    // non li ha. Se un giorno se ne escludesse uno per un motivo diverso — un
    // limite nostro, non suo — questo lo direbbe invece di lasciarlo passare
    // dentro un conteggio.
    const perAltroMotivo = esclusi.filter(([, m]) => !m.includes('non presente in NCP'))
    expect(perAltroMotivo, 'strumenti esclusi per un motivo che non è «NCP non ce l\'ha»').toEqual([])
    expect(esclusi.length, 'il numero degli esclusi si è mosso: rileggere perché').toBe(21)
  })

  it.runIf(vendorPresente)('Goffaggine lo spegne — letto dall\'ingresso ALTO', () => {
    // Stessa trappola di Dononaturale: `checkKlutz` gira in
    // `CALCULATE_ALL_MOVES_SV` e `calcola` entra un livello sotto.
    const input = { attacker: att('charcoal', { atkAbility: 'klutz' }),
      defender: dif(), move: 'fling', field: {} }
    expect(harness.calcola(input).rolls.length, "l'ingresso basso ha smesso di ignorare Klutz").toBe(16)
    expect(harness.calcolaConPreparazione(input).rolls).toEqual([])
    expect(nostro('charcoal', { atkAbility: 'klutz' }).immune).toBe(true)
  })

  it.runIf(vendorPresente)('la bacca contro Unnerve, che è una condizione del DIFENSORE', () => {
    const bloccato = { attacker: att('cheri berry'), defender: dif({ defAbility: 'unnerve' }),
      move: 'fling', field: {} }
    expect(harness.calcola(bloccato).rolls).toEqual([])
    expect(nostro('cheri berry', {}, { defAbility: 'unnerve' }).immune).toBe(true)
    // e senza Unnerve la bacca si lancia
    expect(nostro('cheri berry').immune).toBeFalsy()
  })

  it.runIf(vendorPresente)('la Megapietra: bloccata solo su chi ci si Megaevolve', () => {
    const suo = { attacker: { ...att('charizardite y'), atkPokemon: 'charizard' },
      defender: dif(), move: 'fling', field: {} }
    expect(harness.calcola(suo).rolls).toEqual([])
    expect(calculateDamage(suo).immune).toBe(true)
    // su un altro è un oggetto qualunque
    const altrui = { attacker: att('charizardite y'), defender: dif(), move: 'fling', field: {} }
    expect(harness.calcola(altrui).rolls.length).toBe(16)
    expect(calculateDamage(altrui).immune).toBeFalsy()
  })
})

describe('il Lancio muove davvero il numero', () => {
  it('la potenza dello strumento cambia il danno, e in ordine', () => {
    const d = (item) => nostro(item).maxDmg
    expect(d('iron ball')).toBeGreaterThan(d('hard stone'))
    expect(d('hard stone')).toBeGreaterThan(d('thick club'))
    expect(d('thick club')).toBeGreaterThan(d('eviolite'))
    expect(d('eviolite')).toBeGreaterThan(d('charcoal'))
    expect(d('charcoal')).toBeGreaterThan(d('leftovers'))
  })

  it('e senza strumento la mossa fallisce', () => {
    const senza = nostro(null)
    expect(senza.immune).toBe(true)
    expect(senza.reason, 'è la mossa che fallisce, non il difensore che immunizza').toBe('move')
    expect(senza.moveName).toBe('fling')
  })

  it('è una mossa Buio a tutti gli effetti', () => {
    // L'efficacia vale: su Incineroar (Fuoco/Buio) il Buio dimezza.
    const controBuio = calculateDamage({
      attacker: att('iron ball'), defender: dif({ defPokemon: 'incineroar' }),
      move: 'fling', field: {},
    })
    expect(controBuio.effectiveness).toBe(0.5)
  })
})
