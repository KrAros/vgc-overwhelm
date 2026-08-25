// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/lib/reg.js
 *
 * Le regolazioni di Champions e le loro stagioni.
 *
 * ─── DUE COSE DIVERSE CHE SI CHIAMANO QUASI UGUALE ─────────────────────────
 *
 *   reg        M-A, M-B — le REGOLE: quali specie si possono usare
 *   stagione   M-1…M-5  — il PERIODO di classifica dentro una reg
 *
 * Una stagione appartiene a esattamente una reg. M-A ha avuto M-1 e M-2; con
 * M-B sono arrivate specie nuove, e la sua prima stagione e' stata M-3.
 * Cambiare stagione dentro la stessa reg di norma non cambia le specie: e' un
 * azzeramento delle classifiche.
 *
 * ─── PERCHE' UN PRESET PORTA LA STAGIONE E NON LA REG ──────────────────────
 *
 * Perche' la stagione determina la reg, ma non il contrario. Scrivere
 * entrambe renderebbe rappresentabile `reg: 'M-A', stagione: 'M-5'`, una
 * contraddizione che nessun test coglie finche' qualcuno non la legge. Un
 * campo solo la rende impossibile da scrivere — la stessa disciplina della
 * versione, letta da `package.json` e non ricopiata nel JSX.
 *
 * ─── «CORRENTE» NON E' UN CAMPO ────────────────────────────────────────────
 *
 * Nessuna riga del registro dice `corrente: true`. La stagione in corso e'
 * quella la cui finestra contiene oggi, e si calcola. Un flag scritto a mano
 * sarebbe l'ennesimo dato che invecchia in silenzio: resterebbe `true` su una
 * stagione finita, e l'app filtrerebbe i set su un periodo morto senza che
 * niente diventi rosso.
 *
 * Il prezzo, dichiarato: quando M-5 finisce e nessuno aggiorna il registro,
 * `stagioneCorrente()` restituisce `null`. L'APP non si rompe — chi la usa
 * ripiega sull'ultima stagione conosciuta — ma `reg.test.js` diventa rosso, ed
 * e' li' che il ritardo si deve vedere.
 */

import registro from '../data/regChampions.json'

export const REG = registro.reg

/** Tutte le stagioni, con la reg di appartenenza già attaccata. */
export const STAGIONI = REG.flatMap(r => r.stagioni.map(s => ({ ...s, reg: r.id })))

/** Data di oggi in `AAAA-MM-GG`, nel fuso di chi guarda. */
function oggiIso(quando = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${quando.getFullYear()}-${p(quando.getMonth() + 1)}-${p(quando.getDate())}`
}

/**
 * La stagione la cui finestra contiene la data, estremi inclusi.
 * `null` se nessuna la contiene — cioè se il registro è indietro.
 *
 * Il confronto è fra stringhe `AAAA-MM-GG`, che per questo formato è
 * equivalente all'ordine cronologico e non passa dai fusi orari: `new Date()`
 * su una data senza ora la interpreta come UTC, e a Roma l'avrebbe fatta
 * cominciare due ore prima.
 */
export function stagioneCorrente(quando = new Date()) {
  const oggi = oggiIso(quando)
  return STAGIONI.find(s => s.dal && s.al && s.dal <= oggi && oggi <= s.al) ?? null
}

/** L'ultima stagione dichiarata, che è il ripiego quando il registro è indietro. */
export const STAGIONE_PIU_RECENTE = STAGIONI[STAGIONI.length - 1]

/**
 * La stagione da mostrare per prima. Non restituisce mai `null`: se il
 * registro è indietro si ripiega sull'ultima conosciuta, perché un
 * calcolatore senza set proposti è peggio di un calcolatore con set di ieri.
 * Che il registro sia indietro lo dice il test, non l'interfaccia.
 */
export function stagionePredefinita(quando = new Date()) {
  return stagioneCorrente(quando) ?? STAGIONE_PIU_RECENTE
}

/** La reg a cui appartiene una stagione. */
export function regDiStagione(idStagione) {
  return STAGIONI.find(s => s.id === idStagione)?.reg ?? null
}

/** Le specie utilizzabili in una reg. */
export function specieDiReg(idReg) {
  return REG.find(r => r.id === idReg)?.specie ?? []
}

/** Le specie utilizzabili in una stagione, passando dalla sua reg. */
export function specieDiStagione(idStagione) {
  const reg = regDiStagione(idStagione)
  return reg ? specieDiReg(reg) : []
}
