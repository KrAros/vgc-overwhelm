// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/inventarioMotore.test.js
 *
 * La seconda fonte, quella che non condivide l'assunzione della prima.
 *
 * ─── PERCHÉ `gap.test.js` NON BASTAVA ──────────────────────────────────────
 * `gap.test.js` afferma «nessuna abilità che calcoliamo porta il badge», ma
 * alla riga 37 ridefinisce lo stesso `haEffetto` del generatore: una voce
 * «che calcoliamo» è, per entrambi, una voce con un campo meccanico in
 * `ABILITY_EFFECTS`. Pixilate è implementata a `calcEngine.js:200` e in
 * tabella ha solo `desc`, quindi non entrava nell'insieme controllato.
 * Il test era verde perché cercava l'errore solo dove non poteva esserci.
 *
 * Questo file parte dall'altro capo: `scripts/gen-inventario-motore.mjs`
 * legge su cosa il MOTORE ramifica davvero, senza aprire nessuna delle due
 * tabelle. È la regola dei due oracoli indipendenti applicata all'interfaccia.
 *
 * ─── COSA RENDE FALSIFICABILE QUESTO FILE ──────────────────────────────────
 * Misurato in sessione, non dedotto: togliendo il ramo `pixilate` da
 * `calcEngine.js:200`, le abilità nell'inventario scendono da 17 a 16 e i
 * badge da togliere da 6 a 5. Il rilevatore vede la differenza.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { abilitaNonCalcolata, strumentoNonCalcolato } from '../lib/gap.js'

const RADICE = fileURLToPath(new URL('../..', import.meta.url))
const inventario = JSON.parse(
  fs.readFileSync(new URL('./fixtures/inventario-motore.json', import.meta.url), 'utf8'),
)

const VERDETTI = new Set([
  'badge-sbagliato',
  'meccanica-diversa',
  'citata-non-applicata',
  'effetto-non-osservabile',
])

/** Le tre convenzioni: `sand rush`, `sand-rush`, `sand_rush`. */
const comeLetterale = (chiave) =>
  new RegExp(`['"\`]${chiave.replace(/[\s\-_]+/g, '[\\s\\-_]+')}['"\`]`, 'i')

/**
 * Le voci classificate stanno nella fixture anche quando il badge è già stato
 * tolto, ed è voluto: se il test guardasse le collisioni ancora aperte,
 * diventerebbe vuoto esattamente nel momento in cui la correzione funziona.
 * Guardando le classificate resta capace di fallire per sempre.
 */
const classificate = inventario.classificate

describe('inventario del motore — la seconda fonte', () => {
  it('la fixture dichiara la superficie su cui è stata costruita', () => {
    // Senza la superficie il numero non è interpretabile: «17 abilità» non
    // vuol dire niente se non si sa dove sono state cercate.
    expect(inventario.meta.superficie).toEqual(['src/calcEngine.js', 'src/lib', 'src/utils'])
    expect(inventario.meta.fileEsaminati).toBeGreaterThan(0)
    expect(inventario.inventario.abilita.length).toBeGreaterThan(0)
  })

  it('ogni collisione con il badge porta un verdetto ammesso', () => {
    for (const v of classificate) {
      expect(VERDETTI.has(v.verdetto), `${v.chiave}: verdetto «${v.verdetto}»`).toBe(true)
      expect(v.nota, `${v.chiave} è classificata senza motivazione`).toBeTruthy()
    }
  })

  it('ogni prova è ancora vera: quel file, a quella riga, nomina la voce', () => {
    // È il controllo di freschezza. Una fixture che invecchia in silenzio è
    // peggio di nessuna fixture: continua ad affermare con sicurezza cose che
    // non sono più vere. Qui la prova si riapre e si rilegge.
    for (const v of [...inventario.inventario.abilita, ...inventario.inventario.strumenti]) {
      const percorso = RADICE + v.prova.file
      expect(fs.existsSync(percorso), `${v.chiave}: ${v.prova.file} non esiste più`).toBe(true)

      const riga = fs.readFileSync(percorso, 'utf8').split('\n')[v.prova.riga - 1]
      expect(riga, `${v.chiave}: ${v.prova.file} non ha la riga ${v.prova.riga}`).toBeDefined()
      expect(
        comeLetterale(v.chiave).test(riga),
        `${v.chiave}: ${v.prova.file}:${v.prova.riga} non la nomina più — rigenerare con \`npm run inventario:gen\``,
      ).toBe(true)
    }
  })

  it('nessuna voce che il motore applica porta ancora il badge', () => {
    // IL TEST CHE `gap.test.js` NON POTEVA SCRIVERE.
    // Qui «la applichiamo» viene dall'inventario del motore, non dalla
    // tabella che genera il badge. Le due fonti sono indipendenti, quindi
    // questo confronto può fallire — ed è il punto.
    const sbagliate = classificate
      .filter(v => v.verdetto === 'badge-sbagliato')
      .filter(v => (v.tipo === 'abilita' ? abilitaNonCalcolata : strumentoNonCalcolato)(v.chiave))
      .map(v => `${v.chiave} (${v.prova.file}:${v.prova.riga})`)

    expect(
      sbagliate,
      'queste voci il motore le calcola davvero, e l\'interfaccia dice il contrario',
    ).toEqual([])
  })

  it('una voce inventata non compare nell\'inventario', () => {
    // Controllo negativo: senza, i test sopra passerebbero anche con uno
    // scanner che risponde sempre di sì.
    const chiavi = new Set(inventario.inventario.abilita.map(v => v.chiave))
    expect(chiavi.has('abilità che non esiste')).toBe(false)
    expect(chiavi.has('pixilate')).toBe(true)
  })
})
