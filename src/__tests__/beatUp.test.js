// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/beatUp.test.js
 *
 * Beat Up: potenza 14 per colpo, da uno a sei colpi.
 *
 * ─── ERA TENUTA FUORI, E LA RAGIONE ERA SBAGLIATA ──────────────────────────
 *
 * `docs/lavoro-aperto.md` la dava come aggiudicazione, e `potenzaAssunta.test.js`
 * lo presidiava con questa motivazione scritta:
 *
 *     «l'oracolo la calcola con UN colpo solo mentre i nostri dati ne prevedono
 *      da uno a sei: il numero non sarebbe confrontabile»
 *
 * Misurato, è falso su tutt'e due le metà — e le due misure sono qui sotto come
 * casi, perché una motivazione che nessuno verifica è quella che è durata due
 * sessioni.
 *
 * **Il riferimento ha il nostro stesso intervallo.** Le sue tabelle di mosse
 * sono fusioni profonde (`$.extend(true, {}, PRECEDENTE, {...})`): `MOVES_GSC`
 * definisce Beat Up con `hitRange: [1, 6]`, e `MOVES_BW` ne cambia SOLO la
 * potenza a 14 (`move_data.js:2796`). La fusione conserva il resto, quindi alla
 * generazione di Champions il dato è
 *
 *     { bp: 14, type: 'Dark', category: 'Physical', hitRange: [1, 6] }
 *
 * **E il conto dei colpi non entra nel confronto.** Per le multi-colpo il
 * riferimento torna i roll di UN colpo; quante volte colpisca vive da noi, in
 * `colpiScelti`. È già così per tre mosse fatte, e il caso qui sotto lo misura
 * invece di crederci.
 *
 * ─── IL NUMERO E' UNA MEDIA, E IL RIFERIMENTO MOSTRA IL CONTO ──────────────
 *
 *     bp: 14, //average fully evolved atk. stat is ~90. 90/10 + 5 = 14.
 *
 * È la quarta della famiglia di `MOSSE_POTENZA_ASSUNTA`, e l'unica con
 * l'aritmetica scritta accanto. Nel gioco la potenza di ogni colpo dipende
 * dall'Attacco base dell'alleato che lo tira; qui c'è un alleato medio,
 * ipotizzato una volta per tutte. Return assume il MASSIMO, Trump Card il
 * MINIMO, Beat Up una MEDIA: tre ipotesi di forma diversa nella stessa tabella.
 *
 * ─── PERCHE' LO SNAPSHOT NON PROTEGGE QUESTO CAMBIAMENTO ───────────────────
 *
 * Perché non la conosce: zero occorrenze di `beat up` in `snapshot-cases.mjs`,
 * in `snapshot.json` e nelle fixture golden — misurato prima di cominciare.
 * `snapshot:diff` resta a zero qualunque cosa succeda qui, e uno zero che non
 * poteva essere diverso non è una verifica. La protezione è il confronto contro
 * il riferimento, più il controllo che il numero si muova.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { MOSSE_POTENZA_ASSUNTA, haPotenzaAssunta } from '../lib/rules.js'
import movesData from '../data/moves.json' with { type: 'json' }

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = (extra = {}) => ({
  atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
  atkAbility: null, atkItem: null, level: 50, atkAbilityFlags: {}, ...extra,
})
/** Blissey: Normale puro, quindi Buio la colpisce neutro e il numero non è mai
 *  zero. Un difensore immune renderebbe il confronto verde per costruzione. */
const dif = (extra = {}) => ({
  defPokemon: 'blissey', defSPs: [32, 0, 16, 0, 16, 0], defNature: 'bold',
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const nostro = (extra = {}) => calculateDamage({
  attacker: att(extra), defender: dif(), move: 'beat up', field: {}, debug: false,
})

describe('Beat Up è nella tabella delle potenze assunte', () => {
  it('14, e la mossa entra nel calcolo', () => {
    expect(MOSSE_POTENZA_ASSUNTA['beat up']).toBe(14)
    expect(haPotenzaAssunta('beat up')).toBe(true)
    expect(nostro(), 'Beat Up esce ancora null').not.toBeNull()
  })

  it('il numero arriva in tabella, e non è la potenza dei dati', () => {
    // `moves.json` dice 0: se il motore leggesse quello, il danno sarebbe zero.
    expect(movesData['beat up'].power).toBe(0)
    expect(nostro().effectiveBP).toBe(14)
  })

  it('e i colpi vengono dai nostri dati, non da un numero scritto qui', () => {
    expect(movesData['beat up'].colpi).toEqual([1, 6])
    expect(nostro().colpi, 'senza scelta si usa il massimo, come le altre multi-colpo').toBe(6)
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

  it.runIf(vendorPresente)('il dato del riferimento conserva `hitRange` dopo la fusione', async () => {
    // La PRIMA delle due misure che smentiscono la vecchia motivazione, letta
    // dal riferimento vero e non riassunta: `MOVES_BW` cambia solo `bp`, e la
    // fusione profonda tiene il `hitRange: [1, 6]` che viene da `MOVES_GSC`.
    //
    // Se una tabella più recente lo sovrascrivesse — o se la potenza smettesse
    // di essere 14 — questo diventa rosso, e la ragione per cui Beat Up è
    // dentro va riletta invece che ereditata.
    const { caricaNCP } = await import('../../scripts/ncp/contesto.mjs')
    const dato = caricaNCP().leggi('moves')['Beat Up']
    expect(dato.hitRange, 'il riferimento NON ha più il nostro stesso intervallo').toEqual([1, 6])
    expect(dato.bp, 'la potenza assunta dal riferimento è cambiata').toBe(14)
    expect(dato.hitRange).toEqual(movesData['beat up'].colpi)
  })

  it.runIf(vendorPresente)('i roll sono identici ai suoi', () => {
    const input = { attacker: att(), defender: dif(), move: 'beat up', field: {} }
    const rif = harness.calcola(input)
    expect(rif.motivo ?? null, 'caso non esprimibile per l\'harness').toBeNull()
    expect(rif.ok).toBe(true)
    expect(nostro().rolls, 'divergiamo dal riferimento').toEqual(rif.rolls)
  })

  it.runIf(vendorPresente)('e i suoi roll sono quelli di UN colpo, come per le altre multi-colpo', () => {
    // La seconda misura che smentisce la vecchia motivazione, e la prova che il
    // conto dei colpi non è nel confronto: su tre multi-colpo già fatte i nostri
    // roll coincidono con quelli del riferimento mentre `colpi` vale 5, 5 e 2.
    // Se il riferimento tornasse il TOTALE, questi tre casi divergerebbero.
    const CASI = [['bullet seed', 5], ['rock blast', 5], ['dual wingbeat', 2]]
    for (const [move, colpiAttesi] of CASI) {
      const input = { attacker: att(), defender: dif(), move, field: {} }
      const rif = harness.calcola(input)
      expect(rif.ok, `${move} non esprimibile`).toBe(true)
      const n = calculateDamage(input)
      expect(n.colpi, `${move}: colpi cambiati`).toBe(colpiAttesi)
      expect(n.rolls, `${move}: i roll del riferimento non sono per colpo`).toEqual(rif.rolls)
    }
  })

  it.runIf(vendorPresente)('e scegliendo un colpo solo i roll non cambiano', () => {
    // Conferma dall'altro lato: il numero di colpi non tocca il roll del
    // singolo colpo, quindi il confronto col riferimento vale per ogni scelta.
    expect(nostro({ colpiScelti: 1 }).rolls).toEqual(nostro().rolls)
    expect(nostro({ colpiScelti: 1 }).colpi).toBe(1)
  })
})

describe('Beat Up muove davvero il numero', () => {
  it('fa danno, e il danno dipende dall\'Attacco come ogni mossa fisica', () => {
    // Senza questo, i confronti contro il riferimento passerebbero anche se la
    // mossa uscisse zero e NCP pure.
    expect(nostro().maxDmg).toBeGreaterThan(0)
    const forte = calculateDamage({
      attacker: att({ atkBoost: 6 }), defender: dif(), move: 'beat up', field: {},
    })
    expect(forte.maxDmg, 'l\'Attacco non tocca Beat Up: sarebbe danno fisso').toBeGreaterThan(nostro().maxDmg)
  })

  it('e il selettore dei colpi cambia il danno totale', () => {
    // I roll sono per colpo, ma `colpi` è quello che moltiplica nella matrice.
    expect(nostro({ colpiScelti: 1 }).colpi).toBeLessThan(nostro().colpi)
  })

  it('è una mossa Buio a tutti gli effetti, non un danno fisso', () => {
    // L'efficacia vale: contro un Buio dimezza, contro uno Psico raddoppia.
    const controBuio = calculateDamage({
      attacker: att(), defender: dif({ defPokemon: 'incineroar' }), move: 'beat up', field: {},
    })
    expect(controBuio.effectiveness, 'Incineroar è Fuoco/Buio: Buio su Buio dimezza').toBe(0.5)
  })
})
