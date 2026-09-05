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
import { ABILITA_A_VITA_BASSA } from '../lib/rules.js'
import { calculateDamage } from '../calcEngine.js'
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
      .toBeGreaterThanOrEqual(4)
    for (const atteso of ['plusMinus', 'caricata', 'protean', 'stakeout', 'slowStart']) {
      expect([...campi], `il motore non legge più ${atteso} con l'interruttore`)
        .toContain(atteso)
    }
  })

  it('e le cinque a vita bassa NON ci sono più, perché adesso leggono un numero', () => {
    // ─── L'ELENCO SI È ACCORCIATO, E VA BENE COSÌ ────────────────────────
    //
    // `defeatist` e `psBassiTipo` stavano in questa lista: il motore le
    // accendeva con l'interruttore, come Protean o Stakeout. Adesso leggono i
    // punti salute, e l'interruttore ci arriva tradotto in un numero.
    //
    // Il test non è stato allentato: è stato girato. Prima presidiava che il
    // motore le leggesse con l'interruttore; adesso presidia che NON lo faccia
    // più — perché due strade per lo stesso fatto sono il difetto che i punti
    // salute sono venuti a togliere.
    for (const campo of ['defeatist', 'psBassiTipo']) {
      expect(
        [...campi],
        `${campo} è tornato a leggere l'interruttore invece dei punti salute`,
      ).not.toContain(campo)
    }
    expect([...ABILITA_A_VITA_BASSA].sort())
      .toEqual(['blaze', 'defeatist', 'overgrow', 'swarm', 'torrent'])
  })

  it('ma la levetta le accende ancora: la traduzione arriva fino al numero', () => {
    // Il controllo che rende vero il test qui sopra. Senza, «non le legge più»
    // sarebbe soddisfatto anche da un motore che le ha semplicemente perse.
    //
    // La catena è: levetta nell'interfaccia → `interruttore` → `psDaLevetta`
    // → punti salute → soglia del riferimento. Qui si tira l'ultimo anello e
    // si guarda il numero.
    const att = (abilita, acceso) => ({
      atkPokemon: 'incineroar', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
      atkAbility: abilita, atkItem: null, level: 50,
      atkAbilityFlags: { interruttore: acceso },
    })
    const dif = {
      defPokemon: 'amoonguss', defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
      defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
    }
    const danno = (abilita, acceso) => calculateDamage({
      attacker: att(abilita, acceso), defender: dif, move: 'flare blitz', field: {},
    }).maxDmg

    expect(danno('blaze', true), 'la levetta di Blaze non arriva più al numero')
      .toBeGreaterThan(danno('blaze', false))
    expect(danno('defeatist', true), 'la levetta di Defeatist non arriva più al numero')
      .toBeLessThan(danno('defeatist', false))
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
    // Le cinque a vita bassa vanno aggiunte a mano: il motore non le legge più
    // con l'interruttore, ma la levetta nell'interfaccia ce l'hanno ancora, e
    // quindi le due stringhe le servono come prima.
    const conLevetta = [...new Set([
      ...Object.keys(ABILITY_EFFECTS)
        .filter(k => [...campi].some(c => ABILITY_EFFECTS[k]?.[c] !== undefined)),
      ...ABILITA_A_VITA_BASSA,
    ])]

    // Il presupposto: se l'elenco fosse vuoto il test passerebbe senza dire
    // niente.
    expect(conLevetta.length).toBeGreaterThanOrEqual(6)

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
