// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/levette.test.js
 *
 * Che ogni abilità che il motore accende con `interruttore` offra la levetta.
 *
 * ─── IL DIFETTO CHE QUESTO TEST NON HA VISTO, PERCHÉ NON ESISTEVA ──────────
 *
 * Stakeout e Slow Start sono state scritte nel motore, con i loro casi contro
 * l'oracolo, e mergiate. Ma `AbilityFlags.jsx` mostrava la levetta solo per
 * `plusMinus`, `caricata` e `protean`: le due nuove non comparivano, e le
 * stringhe non esistevano.
 *
 * Risultato: il calcolo le applicava e l'utente non poteva accenderle. Non era
 * un numero sbagliato — era un numero irraggiungibile.
 *
 * Nessun presidio l'ha visto. `riquadroAbilita.test.js` sorveglia le ALTEZZE
 * dei riquadri, `gap.test.js` sorveglia che il badge «non calcolata» non
 * compaia su ciò che calcoliamo. Che una levetta necessaria ESISTA non lo
 * guardava nessuno.
 *
 * ─── PERCHÉ GUARDA IL SORGENTE ─────────────────────────────────────────────
 *
 * Perché ciò che si sorveglia è una proprietà del sorgente: la condizione del
 * ramo in `AbilityFlags.jsx` deve nominare tutti i campi che il motore legge
 * insieme a `interruttore`. È lo stesso schema di `riquadroAbilita.test.js` e
 * di `ordineCorretto.test.js`.
 *
 * Montare il componente sarebbe più diretto, ma richiederebbe un ambiente DOM
 * che questo progetto non usa nei test del motore; e la domanda vera — «il
 * ramo conosce questo campo?» — è testuale.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import it_ from '../locales/it.json' with { type: 'json' }
import en from '../locales/en.json' with { type: 'json' }

const sorgenteMotore = readFileSync(
  new URL('../calcEngine.js', import.meta.url), 'utf8')
const sorgenteRiquadro = readFileSync(
  new URL('../components/editor/AbilityFlags.jsx', import.meta.url), 'utf8')

/**
 * I campi di ABILITY_EFFECTS che il motore legge INSIEME a
 * `atkAbilityFlags.interruttore`, estratti dal sorgente del motore.
 *
 * ─── PERCHE' IL GRUPPO DI PARENTESI, E NON UN INTORNO DI RIGHE ─────────────
 *
 * La prima stesura guardava tre righe sopra e due sotto. Prendeva dentro
 * condizioni VICINE ma diverse — `waterBubble` e `adaptability` — e chiedeva
 * per loro una levetta che non gli serve. Un presidio che si lamenta di cose
 * giuste lo si spegne, ed e' peggio di non averlo.
 *
 * Qui invece, da ogni `interruttore`, si risale al gruppo di parentesi che lo
 * CONTIENE e si guarda solo li' dentro. E' il confine che il linguaggio stesso
 * disegna attorno a una condizione.
 */
function campiConInterruttore() {
  const trovati = new Set()
  const src = sorgenteMotore
  const AGO = 'atkAbilityFlags.interruttore'

  for (let i = src.indexOf(AGO); i !== -1; i = src.indexOf(AGO, i + 1)) {
    // Indietro fino alla parentesi aperta che non e' stata chiusa: e' quella
    // che apre la condizione.
    let profondita = 0
    let apertura = -1
    for (let j = i; j >= 0; j--) {
      if (src[j] === ')') profondita++
      else if (src[j] === '(') {
        if (profondita === 0) { apertura = j; break }
        profondita--
      }
    }
    if (apertura === -1) continue

    // E avanti fino alla sua chiusura.
    profondita = 0
    let chiusura = -1
    for (let j = apertura; j < src.length; j++) {
      if (src[j] === '(') profondita++
      else if (src[j] === ')') {
        profondita--
        if (profondita === 0) { chiusura = j; break }
      }
    }
    if (chiusura === -1) continue

    for (const m of src.slice(apertura, chiusura).matchAll(/atkAbilEffect\?\.(\w+)/g)) {
      trovati.add(m[1])
    }
  }
  return trovati
}

describe('le levette dichiarate e quelle offerte', () => {
  const campi = campiConInterruttore()

  it('il motore legge almeno i campi che ci aspettiamo', () => {
    // Se questo diventa rosso, è cambiato il modo in cui il motore scrive le
    // condizioni con l'interruttore, e l'estrazione qui sopra non le trova
    // più. In quel caso il test successivo diventerebbe vuoto e VERDE per il
    // motivo sbagliato: questo lo impedisce.
    expect(campi.size, 'l\'estrazione dal sorgente non trova più niente')
      .toBeGreaterThanOrEqual(6)
    for (const atteso of ['plusMinus', 'caricata', 'protean', 'stakeout', 'slowStart', 'defeatist', 'psBassiTipo']) {
      expect([...campi], `il motore non legge più ${atteso} con l'interruttore`)
        .toContain(atteso)
    }
  })

  it('il riquadro conosce ogni campo che il motore accende con l\'interruttore', () => {
    // Il difetto, in una riga: un campo che il motore legge e il riquadro no
    // è un effetto che l'utente non può accendere.
    const ignorati = [...campi].filter(c => !sorgenteRiquadro.includes(`?.${c}`))
    expect(
      ignorati,
      'il motore accende questi con l\'interruttore, ma AbilityFlags.jsx non li '
      + 'nomina: la levetta non compare e l\'effetto resta irraggiungibile',
    ).toEqual([])
  })

  it('ogni abilità con la levetta ha le due stringhe, in tutt\'e due le lingue', () => {
    const conLevetta = Object.keys(ABILITY_EFFECTS)
      .filter(k => [...campi].some(c => ABILITY_EFFECTS[k]?.[c] !== undefined))

    // Il presupposto: se l'elenco fosse vuoto il test passerebbe senza dire
    // niente.
    expect(conLevetta.length).toBeGreaterThanOrEqual(12)

    const mancanti = []
    for (const k of conLevetta) {
      for (const [lingua, dizionario] of [['it', it_], ['en', en]]) {
        if (!dizionario.abilities_desc_on?.[k]) mancanti.push(`${lingua}/on/${k}`)
        if (!dizionario.abilities_desc_off?.[k]) mancanti.push(`${lingua}/off/${k}`)
      }
    }
    expect(
      mancanti,
      'la levetta comparirebbe con l\'etichetta vuota',
    ).toEqual([])
  })
})
