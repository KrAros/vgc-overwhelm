// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/lib/gap.js
 *
 * Risponde a una domanda sola: «questa abilità / questo strumento entra nel
 * calcolo del danno, oppure no?»
 *
 * ─── PERCHÉ UN MODULO E NON UN IMPORT DIRETTO DEL JSON ─────────────────────
 * Perché la forma del file è un dettaglio del generatore. Oggi `gapNoti.json`
 * ha un array di oggetti con la riga di prova dentro; domani potrebbe essere
 * un array di stringhe, o avere i motivi tradotti. Se dieci componenti lo
 * leggessero da soli, cambiarlo costerebbe dieci modifiche.
 *
 * Qui dentro succede anche l'unica cosa non ovvia: la NORMALIZZAZIONE delle
 * chiavi. Nel progetto convivono tre convenzioni per lo stesso nome —
 * `abilities.json` usa gli spazi (`huge power`), `ABILITY_EFFECTS` i trattini
 * (`huge-power`), NCP le maiuscole (`Huge Power`). Confrontarle senza
 * normalizzare è il baco che in §1.8 aveva spento Sand Rush per mesi, ed è lo
 * stesso in cui sono ricascato aprendo questa sessione.
 */

import gapNoti from '../data/gapNoti.json'

/** Toglie spazi, trattini, punti e apostrofi. «Punk Rock» ≡ «punk-rock». */
function normalizza(nome) {
  return String(nome || '').toLowerCase().replace(/[.'’:]/g, '').replace(/[\s\-_]+/g, '')
}

// Il file contiene solo le chiavi. Le righe di prova che le hanno fatte
// entrare stanno in `scripts/ncp/gap-rapporto.json`, fuori dal bundle: nel
// browser non servono, e pesavano 25 kB misurati.
const ABILITA_NEL_GAP = new Set(gapNoti.abilita.map(normalizza))
const STRUMENTI_NEL_GAP = new Set(gapNoti.strumenti.map(normalizza))

/**
 * ─── LE MOSSE, CHE NON HANNO IL PROBLEMA DELLE TRE CONVENZIONI ──────────────
 *
 * Le chiavi delle mosse sono le stesse dappertutto — `moves.json`, il motore e
 * questa lista usano la minuscola con gli spazi — quindi la normalizzazione
 * qui non serve a far combaciare due convenzioni. Si applica lo stesso, per
 * una ragione più povera e più solida: è la stessa funzione delle altre due, e
 * una terza porta che accetta un formato diverso sarebbe il punto in cui, fra
 * sei mesi, `Seismic Toss` non trova il suo badge.
 */
const MOSSE_NEL_GAP = new Set(gapNoti.mosse.map(normalizza))

/**
 * Vero se il riferimento calcola questa abilità nel danno e noi no.
 * @param {string|null} abilita chiave o nome, in qualunque convenzione
 */
export function abilitaNonCalcolata(abilita) {
  if (!abilita) return false
  return ABILITA_NEL_GAP.has(normalizza(abilita))
}

/** Vero se il riferimento calcola questo strumento nel danno e noi no. */
export function strumentoNonCalcolato(strumento) {
  if (!strumento) return false
  return STRUMENTI_NEL_GAP.has(normalizza(strumento))
}

/**
 * Vero se il riferimento calcola questa mossa e il nostro motore esce `null`.
 *
 * ─── PERCHE' QUESTA E' PIU' URGENTE DELLE ALTRE DUE ────────────────────────
 *
 * Un'abilità nel divario lascia comunque un numero in tabella: sbagliato di un
 * moltiplicatore, ma un numero. Una mossa nel divario non lascia niente — la
 * matrice disegna `~`, che è il disegno di una mossa di stato. Senza questo
 * badge, Seismic Toss e Protect si somigliano.
 */
export function mossaNonCalcolata(mossa) {
  if (!mossa) return false
  return MOSSE_NEL_GAP.has(normalizza(mossa))
}

/** I metadati della generazione: commit NCP, data, conteggi. */
export const metaGap = gapNoti.meta

/** Le tre liste di chiavi, per chi deve enumerarle. */
export const elencoGap = {
  abilita: gapNoti.abilita,
  strumenti: gapNoti.strumenti,
  mosse: gapNoti.mosse,
}
