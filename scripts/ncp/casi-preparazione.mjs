// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/ncp/casi-preparazione.mjs
 *
 * I casi che esercitano lo strato di PREPARAZIONE di NCP: tutto quello che
 * `CALCULATE_ALL_MOVES_SV` fa ai due Pokémon prima di calcolare il danno.
 *
 * ─── PERCHÉ UNA FAMIGLIA A PARTE ───────────────────────────────────────────
 * I 509 golden della sessione H entrano da `GET_DAMAGE_SV`, che riceve i due
 * Pokémon già preparati. Erano quindi ciechi su Intimidate, Intrepid Sword,
 * Dauntless Shield, Download e le abilità paradosso. F-2 ha aperto l'ingresso
 * alto e la prima sonda ha trovato quattordici divergenze su sedici.
 *
 * Restano due famiglie separate perché rispondono a due domande diverse:
 * «la formula è giusta» (H) e «lo stato di partenza è giusto» (questa).
 *
 * ─── LA REGOLA CHE GOVERNA QUESTO FILE ─────────────────────────────────────
 * Ogni caso ha un CONTROLLO NEGATIVO, e il controllo deve muoversi.
 *
 * La prima sonda di F-2 conteneva una trappola: Download alza l'Attacco
 * Speciale, la mossa di prova era fisica, i due motori davano lo stesso numero
 * e il caso sembrava «concorde». Non era un accordo, era una misura cieca —
 * la stessa cecità osservativa che la sessione D ha imparato a riconoscere.
 *
 * Quindi ogni gruppo qui sotto è costruito così:
 *
 *   - un caso BERSAGLIO, dove il meccanismo si accende
 *   - un caso CONTROLLO identico salvo la condizione che lo accende
 *
 * e il generatore verifica che i due producano roll DIVERSI in NCP. Se non li
 * producono, il caso non è capace di far fallire niente e viene scartato con
 * un avviso: è una sonda cieca, non un test.
 *
 * ─── COME SI LEGGE `atteso` ────────────────────────────────────────────────
 * Non c'è. I roll attesi li scrive il generatore leggendoli da NCP, come per i
 * golden di H. Qui stanno solo gli input.
 */

// Spread vuoto ovunque: questi casi misurano la preparazione, non le statistiche.
// Un solo asse che varia per volta, altrimenti una divergenza non si attribuisce.
const VUOTO = [0, 0, 0, 0, 0, 0]

function caso(id, { atk, atkAb = null, atkItem = null, atkFlags = {}, mossa,
                    dif, difAb = null, difItem = null, difFlags = {},
                    field = {}, nota }) {
  return {
    id,
    nota,
    input: {
      attacker: {
        atkPokemon: atk,
        atkSPs: VUOTO,
        atkNature: 'serious',
        atkAbility: atkAb,
        atkItem,
        atkAbilityFlags: atkFlags,
      },
      defender: {
        defPokemon: dif,
        defSPs: VUOTO,
        defNature: 'serious',
        defAbility: difAb,
        defItem: difItem,
        defAbilityFlags: difFlags,
      },
      move: mossa,
      field: { doubleTarget: true, ...field },
    },
  }
}

// ─── Gruppo 1 · Intimidate e chi lo contrasta ──────────────────────────────
//
// Incineroar con Intimidate ACCESO davanti a Garchomp che usa Earthquake.
// Earthquake è fisica: il calo di Attacco arriva ai numeri per forza.
//
// ─── IL CONTROLLO GIUSTO NON È «INTIMIDATE SPENTO» ─────────────────────────
// Il primo tentativo confrontava ogni abilità con sé stessa a Intimidate
// spento. Sbagliato: per le nove abilità che ANNULLANO il calo i due casi
// coincidono per costruzione — è esattamente ciò che «annullare» significa —
// e il generatore le scartava tutte come sonde cieche.
//
// Il confronto che discrimina è contro un'abilità NEUTRA con Intimidate
// acceso: se Clear Body blocca, Clear Body e Pressure danno numeri diversi.
// Pressure è la neutra scelta perché non tocca né danno né immunità.

const NEUTRA = 'pressure'

const ABILITA_INTIMIDATE = [
  ['clear body',      'annulla il calo'],
  ['white smoke',     'annulla il calo'],
  ['hyper cutter',    'annulla il calo'],
  ['full metal body', 'annulla il calo'],
  ['inner focus',     'annulla il calo (da ottava generazione)'],
  ['oblivious',       'annulla il calo (da ottava generazione)'],
  ['own tempo',       'annulla il calo (da ottava generazione)'],
  ['scrappy',         'annulla il calo (da ottava generazione)'],
  ['guard dog',       'inverte: +1 invece di -1'],
  ['contrary',        'inverte: +1 invece di -1'],
  ['defiant',         'il calo si applica, poi +2 Attacco'],
  ['competitive',     'il calo si applica, poi +2 Att. Speciale'],
  ['mirror armor',    'il calo torna al mittente'],
  ['simple',          'raddoppia: -2 invece di -1'],
  ['rattled',         'il calo si applica, più Velocità'],
]

const idIntim = (ab) => `P1-intimidate-${ab.replace(/ /g, '-')}`

const gruppoIntimidate = [
  // Il controllo neutro, uno solo per tutto il gruppo.
  caso(`${idIntim(NEUTRA)}`, {
    atk: 'garchomp', atkAb: NEUTRA, mossa: 'earthquake',
    dif: 'incineroar', difAb: 'intimidate', difFlags: { intimidateActive: true },
    nota: 'controllo neutro — il calo di Intimidate si applica senza ostacoli',
  }),
  // Un secondo controllo: Intimidate spento. Serve a dimostrare che il calo
  // esiste davvero, cioè che il controllo neutro non è neutro per caso.
  caso('P1-intimidate-spento', {
    atk: 'garchomp', atkAb: NEUTRA, mossa: 'earthquake',
    dif: 'incineroar', difAb: 'intimidate', difFlags: { intimidateActive: false },
    nota: 'controllo — Intimidate spento: nessun calo',
  }),
  ...ABILITA_INTIMIDATE.map(([ab, nota]) => caso(idIntim(ab), {
    atk: 'garchomp', atkAb: ab, mossa: 'earthquake',
    dif: 'incineroar', difAb: 'intimidate', difFlags: { intimidateActive: true },
    nota: `Intimidate acceso · ${nota}`,
  })),
]

// ─── Gruppo 2 · Boost automatici all'ingresso in campo ─────────────────────
//
// Intrepid Sword (+1 Att.) e Dauntless Shield (+1 Dif.).
//
// ─── ATTENZIONE A `abilityOn` ──────────────────────────────────────────────
// In NCP la condizione è `gen !== 9 || pokemon.abilityOn`. In Champions `gen`
// vale 10, quindi la prima metà è vera e il boost si applica SEMPRE, acceso o
// spento che sia il flag. Un controllo costruito su `abilityOn` confronterebbe
// due cose identiche per costruzione — errore commesso e corretto in F-2.
//
// Il controllo giusto è la stessa specie con un'abilità neutra.

const gruppoIngresso = [
  caso('P2-intrepid-sword', {
    atk: 'zacian', atkAb: 'intrepid sword', mossa: 'play rough', dif: 'garchomp',
    nota: 'Intrepid Sword: +1 Attacco entrando in campo',
  }),
  caso('P2-intrepid-sword-controllo', {
    atk: 'zacian', atkAb: NEUTRA, mossa: 'play rough', dif: 'garchomp',
    nota: 'controllo — stessa specie, abilità neutra',
  }),
  caso('P2-dauntless-shield', {
    atk: 'garchomp', atkAb: NEUTRA, mossa: 'earthquake',
    dif: 'zamazenta', difAb: 'dauntless shield',
    nota: 'Dauntless Shield: +1 Difesa entrando in campo',
  }),
  caso('P2-dauntless-shield-controllo', {
    atk: 'garchomp', atkAb: NEUTRA, mossa: 'earthquake',
    dif: 'zamazenta', difAb: NEUTRA,
    nota: 'controllo — stessa specie, abilità neutra',
  }),
]

// ─── Gruppo 3 · Abilità paradosso e Booster Energy ─────────────────────────
//
// Protosynthesis e Quark Drive potenziano del 30% la statistica più alta
// (del 50% se è la Velocità, che sul danno non si vede). Si accendono con il
// meteo/terreno giusto oppure con Booster Energy.
//
// Tre casi per abilità: acceso da Booster Energy, acceso dal campo, spento.
// Il terzo è il controllo.

const gruppoParadosso = [
  caso('P3-protosynthesis-booster', {
    atk: 'roaring-moon', atkAb: 'protosynthesis', atkItem: 'booster energy',
    mossa: 'knock off', dif: 'garchomp',
    nota: 'Protosynthesis acceso da Booster Energy',
  }),
  caso('P3-protosynthesis-sole', {
    atk: 'roaring-moon', atkAb: 'protosynthesis',
    mossa: 'knock off', dif: 'garchomp', field: { weather: 'sun' },
    nota: 'Protosynthesis acceso dal sole',
  }),
  caso('P3-protosynthesis-spento', {
    atk: 'roaring-moon', atkAb: 'protosynthesis',
    mossa: 'knock off', dif: 'garchomp',
    nota: 'controllo — niente sole, niente Booster Energy',
  }),
  caso('P3-quark-drive-booster', {
    atk: 'iron-valiant', atkAb: 'quark drive', atkItem: 'booster energy',
    mossa: 'close combat', dif: 'garchomp',
    nota: 'Quark Drive acceso da Booster Energy',
  }),
  caso('P3-quark-drive-campo', {
    atk: 'iron-valiant', atkAb: 'quark drive',
    mossa: 'close combat', dif: 'garchomp', field: { terrain: 'electric' },
    nota: 'Quark Drive acceso dal Campo Elettrico',
  }),
  caso('P3-quark-drive-spento', {
    atk: 'iron-valiant', atkAb: 'quark drive',
    mossa: 'close combat', dif: 'garchomp',
    nota: 'controllo — niente campo, niente Booster Energy',
  }),
]

// ─── Gruppo 4 · Download ───────────────────────────────────────────────────
//
// Download alza l'Attacco o l'Att. Speciale a seconda di quale difesa
// avversaria è più bassa. Serve quindi UNA MOSSA DELLA CATEGORIA GIUSTA,
// altrimenti il boost c'è ma non si vede: è la trappola in cui è caduta la
// prima sonda di F-2.
//
// Blissey ha Difesa 10 e Dif. Speciale 135: Download sceglie l'Attacco fisico.
// La mossa di prova è quindi fisica.

const gruppoDownload = [
  caso('P4-download-fisico', {
    atk: 'genesect', atkAb: 'download', mossa: 'iron head', dif: 'blissey',
    nota: 'Download su difesa fisica bassa → +1 Attacco, mossa fisica: visibile',
  }),
  caso('P4-download-controllo', {
    atk: 'genesect', atkAb: NEUTRA, mossa: 'iron head', dif: 'blissey',
    nota: 'controllo — stessa configurazione con abilità neutra',
  }),
]

export const CASI_PREPARAZIONE = [
  ...gruppoIntimidate,
  ...gruppoIngresso,
  ...gruppoParadosso,
  ...gruppoDownload,
]

/**
 * Le coppie bersaglio/controllo, per la verifica di falsificabilità.
 * Il generatore controlla che ogni coppia produca roll DIVERSI in NCP.
 */
export const COPPIE = [
  // Ogni abilità del gruppo 1 contro il controllo NEUTRO, non contro sé stessa
  // a Intimidate spento: vedi la nota in cima al gruppo.
  ...ABILITA_INTIMIDATE.map(([ab]) => [idIntim(ab), idIntim(NEUTRA)]),
  // E il controllo neutro contro Intimidate spento, a dimostrare che il calo c'è.
  [idIntim(NEUTRA), 'P1-intimidate-spento'],
  ['P2-intrepid-sword', 'P2-intrepid-sword-controllo'],
  ['P2-dauntless-shield', 'P2-dauntless-shield-controllo'],
  ['P3-protosynthesis-booster', 'P3-protosynthesis-spento'],
  ['P3-protosynthesis-sole', 'P3-protosynthesis-spento'],
  ['P3-quark-drive-booster', 'P3-quark-drive-spento'],
  ['P3-quark-drive-campo', 'P3-quark-drive-spento'],
  ['P4-download-fisico', 'P4-download-controllo'],
]
