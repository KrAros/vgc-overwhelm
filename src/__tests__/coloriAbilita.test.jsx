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

/**
 * [abilità, stato, colore atteso, descrizione dello stato]
 *
 * Aggiornata in Q/2: 19 righe su 30 sono cambiate, e ognuna è una decisione.
 * Il colore ora dice UNA cosa — se uno stato variabile è attivo — invece di
 * contendersi il canale fra «cosa fa l'abilità» e «è accesa».
 */
const CASI = [
  // ── stato dal campo o dall'avversario ────────────────────────────────────
  ['chlorophyll',      {},                                     'gray',  'nessun meteo'],
  ['chlorophyll',      { weather: 'sun' },                     'green', 'sole'],
  ['defiant',          {},                                     'gray',  'nessun Intimidate'],
  ['defiant',          { opponentHasIntimidateActive: true },  'green', 'Intimidate avversario'],
  ['competitive',      {},                                     'gray',  'nessun Intimidate'],
  // era ROSA: stessa condizione di defiant, colore diverso. Divergenza chiusa.
  ['competitive',      { opponentHasIntimidateActive: true },  'green', 'Intimidate avversario'],

  // ── stato da una levetta: prima il fondo NON cambiava ────────────────────
  ['flash fire',       {},                                     'gray',  'levetta spenta'],
  ['flash fire',       { flags: { flashFireActive: true } },   'green', 'levetta accesa'],
  ['multiscale',       {},                                     'gray',  'levetta spenta'],
  ['multiscale',       { flags: { multiscaleActive: true } },  'green', 'levetta accesa'],
  ['supreme overlord', { flags: { supremeOverlordKOs: 0 } },   'gray',  'nessun KO alleato'],
  ['supreme overlord', { flags: { supremeOverlordKOs: 3 } },   'green', 'tre KO alleati'],
  ['intimidate',       {},                                     'gray',  'levetta spenta'],
  ['intimidate',       { flags: { intimidateActive: true } },  'green', 'levetta accesa'],

  // ── le dieci che erano colorate per «cosa fanno» ─────────────────────────
  // Sempre attive, nessuno stato da calcolare: grigie. Il limite è dichiarato
  // nella tavolozza — grigio qui vuol dire «nessuno stato calcolabile», non
  // «inattiva».
  ['huge power',       {}, 'gray', 'statico'],
  ['pure power',       {}, 'gray', 'statico'],
  ['adaptability',     {}, 'gray', 'statico'],
  ['fire mane',        {}, 'gray', 'statico'],
  ['tough claws',      {}, 'gray', 'statico'],
  ['thick fat',        {}, 'gray', 'statico'],
  ['filter',           {}, 'gray', 'statico'],
  ['solid rock',       {}, 'gray', 'statico'],
  ['fluffy',           {}, 'gray', 'statico'],
  ['levitate',         {}, 'gray', 'statico'],

  // ── le quattro -ate: lo stato viene dal MOVESET (Q/3b) ───────────────────
  // Senza mosse Normali l'abilità è del tutto inerte, e prima di Q quel
  // difetto di costruzione era invisibile: grigio identico a quando lavorava.
  ['pixilate',         {},                                        'gray',  'nessun moveset'],
  // Protect è Normale ma di stato: non fa danno, quindi l'abilità non muove
  // nessun numero. Il caso è qui apposta — al primo giro dava verde.
  ['pixilate',         { moves: ['earthquake', 'protect'] },      'gray',  'solo una Normale di stato'],
  ['pixilate',         { moves: ['hyper voice', 'earthquake'] },  'green', 'ha Hyper Voice'],
  ['aerilate',         { moves: ['hyper voice'] },                'green', 'ha Hyper Voice'],
  ['refrigerate',      { moves: ['hyper voice'] },                'green', 'ha Hyper Voice'],
  ['dragonize',        { moves: ['hyper voice'] },                'green', 'ha Hyper Voice'],
  // Palla Clima è Normale solo SENZA meteo: sotto il sole è Fuoco, e il motore
  // applica le -ate solo dopo la conversione del meteo. Guardare il tipo base
  // direbbe «verde» su un set in cui l'abilità non tocca niente.
  ['pixilate',         { moves: ['weather ball'] },               'green', 'Palla Clima senza meteo'],
  ['pixilate',         { moves: ['weather ball'], weather: 'sun' }, 'gray', 'Palla Clima sotto il sole'],

  // ── il default ───────────────────────────────────────────────────────────
  ['poison heal',      {}, 'gray', 'statico'],
  ['sturdy',           {}, 'gray', 'statico'],
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

describe('nessuna stringa italiana scritta dentro il JSX', () => {
  /**
   * `'nessun boost'` era hardcoded in italiano nel riquadro di Supreme
   * Overlord: un utente inglese lo leggeva così. È la famiglia di difetti
   * della sessione M, e `traduzioni.test.js` non poteva vederlo — sorveglia i
   * file di traduzione, non le stringhe scritte nei componenti.
   *
   * La suite gira in inglese, quindi qui basta cercare la parola italiana.
   * Non è una rete generale contro l'hardcoding: copre i riquadri di questo
   * file, e questo è il suo confine.
   */
  const ITALIANE = ['nessun boost']

  it.each(CASI)('%s (%o) non mostra italiano in inglese', (ability, extra) => {
    const html = rendi(ability, extra).toLowerCase()
    expect(ITALIANE.filter((p) => html.includes(p))).toEqual([])
  })
})

describe('la proprietà stabilita dalla sessione Q', () => {
  /**
   * Attivata in Q/2. Prima falliva su 19 casi su 30.
   *
   * È l'asserzione che impedisce a un colore nuovo di rientrare di soppiatto:
   * qualunque tinta fuori dalle tre — un rosso «solo per questa abilità», un
   * viola «che sta bene» — fa diventare rosso questo test.
   */
  it('ogni riquadro usa solo grigio, verde o ambra', () => {
    const fuori = CASI
      .map(([a, extra]) => [a, famigliaColore(rendi(a, extra))])
      .filter(([, c]) => !['gray', 'green', 'amber(badge)'].includes(c))
    expect(fuori).toEqual([])
  })
})
