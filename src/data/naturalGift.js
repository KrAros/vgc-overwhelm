// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { TYPES } from './typeChart.js'

/**
 * ─── DONONATURALE: LA BACCA DECIDE TIPO E POTENZA ──────────────────────────
 *
 * Trascritta da `getNaturalGift` (`vendor/ncp/item_data.js:655`), sessantasei
 * voci, ognuna `[tipo, potenza]`.
 *
 * ─── PERCHE' UN FILE SUO E NON UN CAMPO IN `items.json` ────────────────────
 *
 * Perche' non e' una proprieta' della bacca: e' una proprieta' della COPPIA
 * bacca-mossa. La Bacca Cheri non ha «tipo Fuoco» — cura la paralisi. Il tipo
 * Fuoco ce l'ha solo quando qualcuno le tira addosso Dononaturale. Scriverlo
 * in `items.json` avrebbe dato l'idea di un fatto sulla bacca, e non lo e'.
 *
 * ─── LE SESSANTASEI E LE QUARANTOTTO ───────────────────────────────────────
 *
 * Il riferimento ne elenca 66. Di bacche selezionabili da noi ce ne sono 49,
 * e 48 sono qui dentro: l'unica fuori e' `berry juice`, che nel riferimento
 * non conta come bacca — e non per una svista, ma per come e' scritto il
 * controllo. Vedi `haBaccaDaDono` piu' sotto.
 *
 * Le altre diciotto sono bacche che NCP ha e noi no. Restano trascritte perche'
 * la tabella e' una copia: toglierle vorrebbe dire che il giorno che una di
 * quelle entra in `items.json` la mossa le darebbe il valore di ripiego in
 * silenzio, invece del suo.
 *
 * ─── UNA RIGA DEL RIFERIMENTO CHE NON E' QUI, E LA RAGIONE ─────────────────
 *
 *     if (gen < 6) { gift.p -= 20; }
 *
 * Champions gira a `gen = 10` (`scripts/ncp/contesto.mjs`), quindi quel ramo
 * non si accende mai. E' codice morto alla nostra generazione, non un pezzo
 * mancante — la stessa forma del ×1.5 della Gemmadanima, chiuso da `gen <= 6`.
 *
 * La tabella e' GENERATA dal vendor e riletta da `dononaturale.test.js`, che
 * la confronta voce per voce con `item_data.js`: una trascrizione a mano di
 * sessantasei righe sarebbe stata sessantasei occasioni di sbagliare un numero.
 */
export const DONO_NATURALE = Object.freeze({
  'aguav berry':       [TYPES.DRAGON,     80],
  'apicot berry':      [TYPES.GROUND,     100],
  'aspear berry':      [TYPES.ICE,        80],
  'babiri berry':      [TYPES.STEEL,      80],
  'belue berry':       [TYPES.ELECTRIC,   100],
  'bluk berry':        [TYPES.FIRE,       90],
  'charti berry':      [TYPES.ROCK,       80],
  'cheri berry':       [TYPES.FIRE,       80],
  'chesto berry':      [TYPES.WATER,      80],
  'chilan berry':      [TYPES.NORMAL,     80],
  'chople berry':      [TYPES.FIGHTING,   80],
  'coba berry':        [TYPES.FLYING,     80],
  'colbur berry':      [TYPES.DARK,       80],
  'cornn berry':       [TYPES.BUG,        90],
  'custap berry':      [TYPES.GHOST,      100],
  'durin berry':       [TYPES.WATER,      100],
  'enigma berry':      [TYPES.BUG,        100],
  'figy berry':        [TYPES.BUG,        80],
  'ganlon berry':      [TYPES.ICE,        100],
  'grepa berry':       [TYPES.FLYING,     90],
  'haban berry':       [TYPES.DRAGON,     80],
  'hondew berry':      [TYPES.GROUND,     90],
  'iapapa berry':      [TYPES.DARK,       80],
  'jaboca berry':      [TYPES.DRAGON,     100],
  'kasib berry':       [TYPES.GHOST,      80],
  'kebia berry':       [TYPES.POISON,     80],
  'kee berry':         [TYPES.FAIRY,      100],
  'lansat berry':      [TYPES.FLYING,     100],
  'leppa berry':       [TYPES.FIGHTING,   80],
  'liechi berry':      [TYPES.GRASS,      100],
  'lum berry':         [TYPES.FLYING,     80],
  'mago berry':        [TYPES.GHOST,      80],
  'magost berry':      [TYPES.ROCK,       90],
  'maranga berry':     [TYPES.DARK,       100],
  'micle berry':       [TYPES.ROCK,       100],
  'nanab berry':       [TYPES.WATER,      90],
  'nomel berry':       [TYPES.DRAGON,     90],
  'occa berry':        [TYPES.FIRE,       80],
  'oran berry':        [TYPES.POISON,     80],
  'pamtre berry':      [TYPES.STEEL,      90],
  'passho berry':      [TYPES.WATER,      80],
  'payapa berry':      [TYPES.PSYCHIC,    80],
  'pecha berry':       [TYPES.ELECTRIC,   80],
  'persim berry':      [TYPES.GROUND,     80],
  'petaya berry':      [TYPES.POISON,     100],
  'pinap berry':       [TYPES.GRASS,      90],
  'pomeg berry':       [TYPES.ICE,        90],
  'qualot berry':      [TYPES.POISON,     90],
  'rabuta berry':      [TYPES.GHOST,      90],
  'rawst berry':       [TYPES.GRASS,      80],
  'razz berry':        [TYPES.STEEL,      80],
  'rindo berry':       [TYPES.GRASS,      80],
  'roseli berry':      [TYPES.FAIRY,      80],
  'rowap berry':       [TYPES.DARK,       100],
  'salac berry':       [TYPES.FIGHTING,   100],
  'shuca berry':       [TYPES.GROUND,     80],
  'sitrus berry':      [TYPES.PSYCHIC,    80],
  'spelon berry':      [TYPES.DARK,       90],
  'starf berry':       [TYPES.PSYCHIC,    100],
  'tamato berry':      [TYPES.PSYCHIC,    90],
  'tanga berry':       [TYPES.BUG,        80],
  'wacan berry':       [TYPES.ELECTRIC,   80],
  'watmel berry':      [TYPES.FIRE,       100],
  'wepear berry':      [TYPES.ELECTRIC,   90],
  'wiki berry':        [TYPES.ROCK,       80],
  'yache berry':       [TYPES.ICE,        80],
})

/**
 * Vero se lo strumento e' una bacca AI FINI DI DONONATURALE.
 *
 * ─── PERCHE' `' berry'` COL SPAZIO DAVANTI, E NON `'berry'` ────────────────
 *
 * Perche' cosi' e' scritto nel riferimento — `attacker.item.indexOf(" Berry")`
 * (`damage_MASTER.js:1152`) — e quello spazio NON e' un dettaglio di stile:
 * e' l'unica cosa che tiene fuori il Succo di Bacche.
 *
 *     'cheri berry'.includes(' berry')   true
 *     'berry juice'.includes(' berry')   false   ← «berry» sta all'inizio
 *
 * Il Succo di Bacche e' l'unico dei nostri 49 oggetti «bacca» a non essere
 * nella tabella, e il riferimento non lo tratta come un caso speciale: cade da
 * se' fuori dal controllo. Scrivendo `'berry'` senza spazio ci entrerebbe, e
 * poi non trovando la sua riga prenderebbe il valore di ripiego — cioe' un
 * danno piccolo al posto di nessun danno.
 */
export function haBaccaDaDono(chiaveStrumento) {
  return String(chiaveStrumento || '').includes(' berry')
}
