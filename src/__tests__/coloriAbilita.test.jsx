// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/coloriAbilita.test.jsx
 *
 * Che colore ha il riquadro di ogni abilità, e in quale stato.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * Prima della sessione Q **nessun test importava `AbilityFlags`**. Verificato
 * sugli import, non cercando il nome: i file che il `grep` segnalava
 * contenevano `abilityFlags`, il campo dati, non il componente.
 *
 * Significa che i colori si potevano riscrivere tutti — compreso sbagliarli —
 * senza che una sola riga diventasse rossa. Zero casi capaci di muoversi, cioè
 * il criterio vuoto che le regole di ingaggio vietano.
 *
 * ─── COSA HA MOSTRATO LA FOTOGRAFIA ────────────────────────────────────────
 *
 * Che convivevano DUE convenzioni opposte, più una terza:
 *
 *   guidati dallo stato   chlorophyll, defiant, competitive
 *                         grigio quando spento, colorato quando attivo
 *   colore fisso          flash fire, multiscale, supreme overlord, intimidate
 *                         stesso colore acceso e spento: cambia solo il testo
 *   semantici             le dieci di COLOR_MAP, colore per «cosa fa»
 *
 * E `competitive` si accendeva di ROSA nella stessa identica condizione in cui
 * `defiant` si accende di verde.
 *
 * ─── COME SI LEGGE QUESTO FILE ─────────────────────────────────────────────
 *
 * La tabella è una CARATTERIZZAZIONE: non dice come dovrebbe essere, dice
 * com'era il giorno in cui è stata scattata. Ogni riga che cambia durante la
 * sessione va cambiata a mano e attribuita — è il modo in cui il colore nuovo
 * diventa una decisione invece di un effetto collaterale.
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AbilityFlags from '../components/editor/AbilityFlags.jsx'
import '../i18n.js'

/**
 * La famiglia di colore del riquadro: la prima classe `bg-<nome>-<n>/<a>`.
 *
 * Si guarda il FONDO e non il testo perché è il fondo a dare il colpo d'occhio,
 * ed è l'unica parte presente in tutti e tre i tipi di riquadro.
 */
function famigliaColore(html) {
  const m = html.match(/bg-([a-z]+)-\d{2,3}\//)
  if (m) return m[1]
  if (html.includes('text-amber-300')) return 'amber(badge)'
  return html.trim() ? '?' : '(niente)'
}

function rendi(ability, extra = {}) {
  const props = {
    ability,
    flags: {},
    opponentHasIntimidateActive: false,
    onFlagChange: () => {},
    weather: null,
    ...extra,
  }
  return renderToStaticMarkup(<AbilityFlags {...props} />)
}

/** [abilità, stato, colore atteso, descrizione dello stato] */
const CASI = [
  // ── guidati dallo stato: grigio spento, colorato attivo ──────────────────
  ['chlorophyll',      {},                                     'gray',   'nessun meteo'],
  ['chlorophyll',      { weather: 'sun' },                     'green',  'sole'],
  ['defiant',          {},                                     'gray',   'nessun Intimidate'],
  ['defiant',          { opponentHasIntimidateActive: true },  'green',  'Intimidate avversario'],
  ['competitive',      {},                                     'gray',   'nessun Intimidate'],
  ['competitive',      { opponentHasIntimidateActive: true },  'pink',   'Intimidate avversario'],

  // ── colore fisso: NON cambia fra spento e acceso ─────────────────────────
  ['flash fire',       {},                                     'red',    'levetta spenta'],
  ['flash fire',       { flags: { flashFireActive: true } },   'red',    'levetta accesa'],
  ['multiscale',       {},                                     'blue',   'levetta spenta'],
  ['multiscale',       { flags: { multiscaleActive: true } },  'blue',   'levetta accesa'],
  ['supreme overlord', { flags: { supremeOverlordKOs: 0 } },   'purple', 'nessun KO alleato'],
  ['supreme overlord', { flags: { supremeOverlordKOs: 3 } },   'purple', 'tre KO alleati'],
  ['intimidate',       {},                                     'yellow', 'levetta spenta'],
  ['intimidate',       { flags: { intimidateActive: true } },  'yellow', 'levetta accesa'],

  // ── semantici: le dieci di COLOR_MAP ─────────────────────────────────────
  ['huge power',       {}, 'red',    'statico'],
  ['pure power',       {}, 'red',    'statico'],
  ['adaptability',     {}, 'teal',   'statico'],
  ['fire mane',        {}, 'orange', 'statico'],
  ['tough claws',      {}, 'yellow', 'statico'],
  ['thick fat',        {}, 'blue',   'statico'],
  ['filter',           {}, 'indigo', 'statico'],
  ['solid rock',       {}, 'indigo', 'statico'],
  ['fluffy',           {}, 'pink',   'statico'],
  ['levitate',         {}, 'sky',    'statico'],

  // ── le quattro -ate: nessuno stato, oggi tutte grigie ────────────────────
  ['pixilate',         {}, 'gray',   'statico'],
  ['aerilate',         {}, 'gray',   'statico'],
  ['refrigerate',      {}, 'gray',   'statico'],
  ['dragonize',        {}, 'gray',   'statico'],

  // ── il default ───────────────────────────────────────────────────────────
  ['poison heal',      {}, 'gray',   'statico'],
  ['sturdy',           {}, 'gray',   'statico'],
]

describe('colori dei riquadri abilità — caratterizzazione', () => {
  /**
   * Senza questa asserzione il file passerebbe anche se `AbilityFlags`
   * restituisse `null` per tutto: trenta «(niente)» confrontati con trenta
   * «(niente)». È la sonda cieca che la sessione L ha trovato otto volte.
   */
  it('i casi renderizzano davvero qualcosa', () => {
    const vuoti = CASI.filter(([a, extra]) => famigliaColore(rendi(a, extra)) === '(niente)')
    expect(vuoti.map(([a]) => a)).toEqual([])
  })

  it.each(CASI)('%s (%o) → %s', (ability, extra, atteso) => {
    expect(famigliaColore(rendi(ability, extra))).toBe(atteso)
  })
})

describe('la proprietà che la sessione Q vuole stabilire', () => {
  /**
   * Oggi FALLIREBBE, ed è giusto così: è scritta qui perché il criterio della
   * sessione sia leggibile accanto allo stato di partenza. Verrà attivata
   * quando lo schema sarà applicato.
   *
   * Il criterio: ogni riquadro usa una sola delle tre tavolozze, e la scelta è
   * calcolata dallo stato invece che letta da una tabella scritta a mano.
   */
  it.skip('ogni riquadro usa solo grigio, verde o ambra', () => {
    const fuori = CASI
      .map(([a, extra]) => [a, famigliaColore(rendi(a, extra))])
      .filter(([, c]) => !['gray', 'green', 'amber(badge)'].includes(c))
    expect(fuori).toEqual([])
  })
})
