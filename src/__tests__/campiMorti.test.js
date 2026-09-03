// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/campiMorti.test.js
 *
 * Ogni campo meccanico dichiarato in `ABILITY_EFFECTS` e `ITEM_EFFECTS` deve
 * essere LETTO da qualcuno.
 *
 * ─── IL VERSO CHE MANCAVA ──────────────────────────────────────────────────
 *
 * I presidi che c'erano guardano tre direzioni:
 *
 *   `gapNoti.json`              ciò che il riferimento calcola e noi no
 *   `descrizioniSilenziose`     ciò che l'app DESCRIVE e non applica
 *   `anomalieListino`           effetti scritti per voci non selezionabili
 *
 * Nessuno dei tre vede questo: un campo scritto in `ABILITY_EFFECTS`, che
 * SEMBRA il meccanismo, e che nessuna riga di codice legge. Il divario non lo
 * vede perché la voce «ha un effetto» e quindi esce dal setaccio;
 * `descrizioniSilenziose` per lo stesso motivo, ed è il suo punto cieco
 * dichiarato — scarta un'abilità appena ha UN campo.
 *
 * ─── COSA HA TROVATO ───────────────────────────────────────────────────────
 *
 * Due campi su 112: `sandRush` (su Sand Rush) e `speedWeather` (su
 * Chlorophyll, Swift Swim, Slush Rush). Nessuno dei due era letto da nessun
 * file: il raddoppio della Velocità col meteo vive in `utils/speedOrder.js`,
 * che teneva la corrispondenza abilità → meteo in una tabella sua.
 *
 * Non era un difetto visibile — l'effetto funzionava — ma era la QUARTA copia
 * della stessa tabella, e la testa di `speedOrder.js` racconta che le altre
 * tre erano disallineate e che due su quattro sbagliavano. Questa era
 * sopravvissuta alla riunificazione proprio perché dormiente: una copia che
 * non fa niente non può divergere in modo visibile, e nessuno la corregge.
 *
 * Chiusa spostando il DATO in `ABILITY_EFFECTS` — `speedWeather: ['sun',
 * 'harsh sunshine']` — e facendo costruire la tabella da lì.
 *
 * ─── COSA QUESTO TEST NON PUÒ DIRE ─────────────────────────────────────────
 *
 * Che il campo sia letto BENE. Cerca il nome del campo nel testo dei file, non
 * il ramo che ci si appoggia: un campo letto in una condizione sempre falsa
 * passerebbe di qui. È lo stesso limite di `inventarioMotore.test.js`, ed è
 * dichiarato là come qui. Quello che questo test chiude è il caso in cui il
 * nome non compare PROPRIO da nessuna parte, che è il caso che è successo.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import { SOLO_META } from '../../scripts/campi-meta.mjs'

const RADICE = path.resolve(import.meta.dirname, '..', '..')

/**
 * Tutti i file che possono leggere un campo: l'applicazione e gli script.
 * I test sono ESCLUSI di proposito — un campo letto solo dai suoi test è
 * esattamente il caso che questo file cerca.
 */
function sorgenti(cartella, acc = []) {
  for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
    if (voce.name === '__tests__' || voce.name === 'node_modules') continue
    const pieno = path.join(cartella, voce.name)
    if (voce.isDirectory()) sorgenti(pieno, acc)
    else if (/\.(js|jsx|mjs)$/.test(voce.name)) acc.push(pieno)
  }
  return acc
}

const DICHIARAZIONI = [
  path.join(RADICE, 'src/data/abilityEffects.js'),
  path.join(RADICE, 'src/data/itemEffects.js'),
]

const testo = sorgenti(path.join(RADICE, 'src'))
  .concat(sorgenti(path.join(RADICE, 'scripts')))
  .filter(p => !DICHIARAZIONI.includes(p))
  .map(p => fs.readFileSync(p, 'utf8'))
  .join('\n')

/** I campi meccanici distinti dichiarati, con chi li dichiara. */
function campiMeccanici(tabella) {
  const campi = new Map()
  for (const [chiave, voce] of Object.entries(tabella)) {
    for (const campo of Object.keys(voce)) {
      if (SOLO_META.has(campo)) continue
      if (!campi.has(campo)) campi.set(campo, [])
      campi.get(campo).push(chiave)
    }
  }
  return campi
}

describe('nessun campo dichiarato resta senza nessuno che lo legga', () => {
  for (const [nome, tabella] of [['abilità', ABILITY_EFFECTS], ['strumenti', ITEM_EFFECTS]]) {
    it(`${nome}: ogni campo meccanico compare in almeno un file`, () => {
      const morti = [...campiMeccanici(tabella)]
        .filter(([campo]) => !new RegExp(`\\b${campo}\\b`).test(testo))
        .map(([campo, chi]) => `${campo} (dichiarato da: ${chi.join(', ')})`)
      expect(
        morti,
        'questo campo non lo legge nessuno: o il meccanismo vive altrove — e '
        + 'allora questa è una seconda copia — o l\'effetto non è implementato.',
      ).toEqual([])
    })
  }

  it('e ce ne sono abbastanza perché il controllo voglia dire qualcosa', () => {
    // Senza questa riga il test passerebbe anche se le due tabelle fossero
    // vuote, o se `SOLO_META` crescesse fino a coprire tutto.
    expect(campiMeccanici(ABILITY_EFFECTS).size).toBeGreaterThan(80)
    expect(campiMeccanici(ITEM_EFFECTS).size).toBeGreaterThan(3)
  })
})

describe('le quattro abilità meteo: il dato sta in un posto solo', () => {
  it('`speedWeather` porta i meteo, e non è più un `true`', () => {
    const conMeteo = Object.entries(ABILITY_EFFECTS)
      .filter(([, v]) => v.speedWeather).map(([k]) => k).sort()
    expect(conMeteo).toEqual(['chlorophyll', 'sand-rush', 'slush-rush', 'swift-swim'])
    for (const k of conMeteo) {
      expect(Array.isArray(ABILITY_EFFECTS[k].speedWeather), `${k}`).toBe(true)
    }
  })

  it('e `sandRush` non esiste più: era il campo di una sola abilità', () => {
    // Sand Rush aveva un campo suo, con un nome suo, che faceva la stessa cosa
    // del campo delle altre tre. Due nomi per una cosa sola sono due posti in
    // cui cercarla.
    expect(ABILITY_EFFECTS['sand-rush'].sandRush).toBeUndefined()
  })

  it('la tabella di `speedOrder` si costruisce da lì, e coincide', async () => {
    const { SPEED_WEATHER_ABILITIES } = await import('../utils/speedOrder.js')
    for (const [k, v] of Object.entries(SPEED_WEATHER_ABILITIES)) {
      expect(v, k).toEqual(ABILITY_EFFECTS[k].speedWeather)
    }
    expect(Object.keys(SPEED_WEATHER_ABILITIES).sort())
      .toEqual(['chlorophyll', 'sand-rush', 'slush-rush', 'swift-swim'])
  })
})
