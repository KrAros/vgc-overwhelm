// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/listeDiSoliNomi.test.js
 *
 * Che comparire in una lista di esclusione non conti come «il riferimento la
 * calcola».
 *
 * ─── IL DIFETTO ────────────────────────────────────────────────────────────
 *
 * Il registro del divario cerca il nome di un'abilita' dentro il sorgente del
 * riferimento: se lo trova, conclude che il riferimento la calcola e l'app le
 * mette il segnalino «non calcolata». Per quasi tutte e' vero.
 *
 * Per due liste no:
 *
 *     `cannotCopy`     in `checkTrace`       (`damage_MASTER.js:387`)
 *     `cannotSupress`  in `checkNeutralGas`  (`:403`)
 *
 * Sono le abilita' che Trace non puo' copiare e che Neutralizing Gas non puo'
 * spegnere. Comparire li' dentro non e' essere calcolati: e' essere
 * l'ECCEZIONE al calcolo di qualcun altro.
 *
 * Otto abilita' stavano nel divario solo per questo, e il segnalino diceva
 * all'utente che siamo indietro su qualcosa che non ha niente da calcolare.
 *
 * ─── PERCHE' QUESTO TEST, E NON SOLO LA CORREZIONE ─────────────────────────
 *
 * Perche' il filtro riconosce le liste per NOME (`cannotCopy`,
 * `cannotSupress`). Se un domani il vendor le rinominasse, il filtro
 * smetterebbe di trovarle e tornerebbe a non fare niente — in silenzio, e con
 * il registro che ricomincia a gonfiarsi senza che nessuno se ne accorga.
 *
 * Qui si controlla che le due liste esistano ancora nel riferimento, e che le
 * otto siano fuori dal divario. Le due cose insieme: la prima perche' la
 * seconda non passi per il motivo sbagliato.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import gapNoti from '../data/gapNoti.json' with { type: 'json' }
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const SORGENTE = path.join(RADICE, 'vendor', 'ncp', 'damage_MASTER.js')
const vendorPresente = fs.existsSync(SORGENTE)

/**
 * Le otto che comparivano SOLO dentro `cannotCopy`. Misurate: nessuna
 * occorrenza altrove nel riferimento.
 *
 * Non ci sono Battle Bond, Comatose, Forecast e Trace, che pure stanno in
 * quella lista: quelle il riferimento le calcola ALTROVE, e restano nel
 * divario com'e' giusto. E' la ragione per cui il filtro toglie i letterali
 * dentro la lista, e non le abilita' che la lista nomina.
 */
const SOLO_NOMI = [
  'commander', 'disguise', 'gulp missile', 'ice face',
  'illusion', 'imposter', 'power of alchemy', 'receiver',
]

/**
 * Le tre che stanno dentro `cannotCopy` E che il riferimento calcola ALTROVE.
 *
 * Sono uscite dal divario una dopo l'altra — Trace, poi Battle Bond, poi
 * Comatose e Forecast — perche' le abbiamo implementate. Nessuna e' uscita
 * perche' il filtro l'ha mangiata, ed e' la differenza che questo test
 * sorveglia.
 *
 * ─── PERCHE' NON BASTA PIU' CONTROLLARE CHE SIANO NEL DIVARIO ─────────────
 *
 * Finche' ce n'era almeno una dentro, il controllo era «queste devono
 * restare». Adesso sono implementate tutte, l'elenco «devono restare» e'
 * vuoto, e un test su una lista vuota passa anche se il filtro si mangiasse
 * tutto.
 *
 * Il controllo diventa quindi un altro: fuori dal divario ci sono, ma con una
 * VOCE che dichiara l'effetto. Un filtro troppo largo — che togliesse le
 * abilita' NOMINATE dalle liste invece dei letterali DENTRO le liste — le
 * porterebbe fuori lo stesso, ma senza voce. E' cio' che distingue le due
 * ragioni.
 */
const NELLA_LISTA_MA_CALCOLATE = ['battle bond', 'comatose', 'forecast', 'trace']

/** Il campo di ABILITY_EFFECTS che prova che l'abbiamo implementata davvero. */
const CAMPO_CHE_LO_PROVA = {
  'battle bond': 'battleBond',
  'comatose': 'comatose',
  'forecast': 'forecast',
  'trace': 'trace',
}

describe('le liste di soli nomi del riferimento', () => {
  it.runIf(vendorPresente)('le due liste esistono ancora, con quei nomi', () => {
    // Se questo diventa rosso il filtro in `gen-gap-noti.mjs` non trova piu'
    // niente da filtrare, e il test successivo passerebbe solo finche'
    // qualcuno non rigenera il registro.
    const src = fs.readFileSync(SORGENTE, 'utf8')
    expect(src, 'cannotCopy non c\'e\' piu\': il filtro del registro e\' muto')
      .toMatch(/\bcannotCopy\s*=\s*\[/)
    expect(src, 'cannotSupress non c\'e\' piu\': il filtro del registro e\' muto')
      .toMatch(/\bcannotSupress\s*=\s*\[/)
  })

  it.runIf(vendorPresente)('le otto compaiono davvero SOLO dentro quelle liste', () => {
    // Il presupposto della correzione, verificato invece che ricordato. Le
    // righe 386-389 sono `cannotCopy`, le 402-407 `checkNeutralGas`.
    const righe = fs.readFileSync(SORGENTE, 'utf8').split('\n')
    const fuoriDalleListe = righe
      .map((testo, i) => ({ testo, n: i + 1 }))
      .filter(({ n }) => !(n >= 386 && n <= 389) && !(n >= 402 && n <= 407))
      .map(r => r.testo)
      .join('\n')

    const NOMI_NCP = {
      'commander': 'Commander', 'disguise': 'Disguise', 'gulp missile': 'Gulp Missile',
      'ice face': 'Ice Face', 'illusion': 'Illusion', 'imposter': 'Imposter',
      'power of alchemy': 'Power of Alchemy', 'receiver': 'Receiver',
    }
    const intruse = SOLO_NOMI.filter(k => fuoriDalleListe.includes(NOMI_NCP[k]))
    expect(
      intruse,
      'il riferimento le nomina anche altrove: allora qualcosa lo calcola, '
      + 'e toglierle dal divario e\' sbagliato',
    ).toEqual([])
  })

  it('nessuna delle otto porta piu\' il segnalino', () => {
    const rimaste = SOLO_NOMI.filter(k => gapNoti.abilita.includes(k))
    expect(
      rimaste,
      'rigenerare con `npm run gap:gen`: queste non hanno niente da calcolare, '
      + 'e il segnalino dice all\'utente il contrario',
    ).toEqual([])
  })

  it('le quattro sono uscite dal divario, e con una voce che lo prova', () => {
    // Il filtro toglie i LETTERALI dentro la lista, non le abilita' che la
    // lista nomina. Se togliesse queste, sarebbero fuori dal divario senza
    // che nessuno le calcoli — e il segnalino direbbe il falso al contrario.
    const senzaVoce = NELLA_LISTA_MA_CALCOLATE.filter(
      k => ABILITY_EFFECTS[k.replace(/ /g, '-')]?.[CAMPO_CHE_LO_PROVA[k]] !== true)
    expect(
      senzaVoce,
      'fuori dal divario ma senza effetto: il filtro si e\' mangiato dei nomi',
    ).toEqual([])

    const ancoraDentro = NELLA_LISTA_MA_CALCOLATE.filter(k => gapNoti.abilita.includes(k))
    expect(ancoraDentro, 'implementata ma ancora nel divario: rigenerare').toEqual([])
  })
})
