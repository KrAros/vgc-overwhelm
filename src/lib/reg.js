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
 * La stagione la cui finestra contiene la data. `null` se nessuna la
 * contiene — cioè se il registro è indietro.
 *
 * ─── LA FINESTRA È `[dal, al)` ─────────────────────────────────────────────
 *
 * Primo giorno dentro, ultimo fuori. Non è una convenzione scelta a tavolino:
 * è l'unica compatibile con le date della fonte, dove ogni stagione finisce
 * il giorno in cui comincia la successiva.
 *
 *     M-4   8 luglio  →  5 agosto
 *     M-5   5 agosto  →  9 settembre
 *
 * Il 5 agosto è un giorno solo. Con gli estremi inclusi apparterrebbe a
 * entrambe, e `find` avrebbe risposto M-4 perché viene prima nell'elenco —
 * cioè la stagione sbagliata, in silenzio, per un giorno ogni cinque
 * settimane.
 *
 * Il confronto è fra stringhe `AAAA-MM-GG`, che per questo formato è
 * equivalente all'ordine cronologico e non passa dai fusi orari: `new Date()`
 * su una data senza ora la interpreta come UTC, e a Roma l'avrebbe fatta
 * cominciare due ore prima.
 */
export function stagioneCorrente(quando = new Date()) {
  const oggi = oggiIso(quando)
  return STAGIONI.find(s => s.dal && s.al && s.dal <= oggi && oggi < s.al) ?? null
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

/**
 * La stagione da cui partire quando si propongono i set: la corrente, e se
 * quella non ha set si scende all'indietro finché una non ne ha.
 *
 * Serve perché le due cose non vanno di pari passo. Oggi la stagione in corso
 * è M-5 e i venti set che abbiamo sono di M-4: partire dalla corrente
 * mostrerebbe una tendina vuota a chi apre l'app, cioè una regressione
 * rispetto a prima che le stagioni esistessero.
 *
 * Il ripiego è all'indietro e mai in avanti: un set di una stagione futura non
 * esiste, uno di una passata è solo più vecchio.
 *
 * @param {Set<string>|string[]} conSet  gli id delle stagioni che hanno set
 * @returns {string|null} l'id, oppure `null` se nessuna stagione ha set
 */
export function stagioneConSetPiuRecente(conSet, quando = new Date()) {
  const ha = conSet instanceof Set ? conSet : new Set(conSet)
  const partenza = stagionePredefinita(quando)
  const da = STAGIONI.findIndex(s => s.id === partenza.id)
  for (let i = da; i >= 0; i--) if (ha.has(STAGIONI[i].id)) return STAGIONI[i].id
  return null
}

/** La reg a cui appartiene una stagione. */
export function regDiStagione(idStagione) {
  return STAGIONI.find(s => s.id === idStagione)?.reg ?? null
}

/**
 * ─── GLI ELENCHI DI SPECIE STANNO ALTROVE ──────────────────────────────────
 *
 * `specieDiReg` e `specieDiStagione` vivono in `regSpecie.js`, che importa un
 * secondo file di dati. Non e' una separazione estetica: e' una misura.
 *
 * I 582 slug delle due reg costano 1490 byte gzip, e oggi NESSUN componente
 * li legge — la stagione filtra i set, non le specie. Tenendoli qui finivano
 * nel bundle d'ingresso e li pagava ogni visitatore per niente: il margine
 * sotto la soglia dei 210 kB era sceso a 0,85 kB.
 *
 * Il giorno in cui l'interfaccia filtrera' o segnalera' anche le specie,
 * bastera' importare `regSpecie.js` da un componente e quel peso tornera' nel
 * bundle — misurato da `bundle:check`, come tutto il resto.
 */
