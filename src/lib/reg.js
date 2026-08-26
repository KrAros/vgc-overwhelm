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
 * ─── PERCHE' UN PRESET PORTA LA REG E NON LA STAGIONE ──────────────────────
 *
 * Un campo solo, perche' scriverne due renderebbe rappresentabile
 * `reg: 'M-A', stagione: 'M-5'`, una contraddizione che nessun test coglie
 * finche' qualcuno non la legge.
 *
 * Quel campo e' stato per un po' la STAGIONE, che determina la reg. Sembrava
 * la scelta piu' ricca: un set e' un'osservazione, e l'osservazione ha una
 * data. Ma il filtro dell'interfaccia usava quella data per rispondere a
 * un'altra domanda — «quali set posso usare adesso?» — e le due divergono,
 * perche' le specie cambiano solo fra REG.
 *
 * Misurato: con M-5 come stagione di partenza la tendina mostrava set per 2
 * specie su 20; gli altri venti erano legali e invisibili. Da li' la scelta di
 * etichettare per reg.
 *
 * Le stagioni restano qui sotto, ma come MECCANISMO e non come etichetta:
 * servono a sapere quale reg e' in corso oggi, perche' e' la finestra di una
 * stagione a contenere la data. Nessun set le nomina piu'.
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
 * La reg in corso: quella della stagione la cui finestra contiene oggi.
 * `null` se il registro e' indietro.
 */
export function regCorrente(quando = new Date()) {
  return stagioneCorrente(quando)?.reg ?? null
}

/** L'ultima reg dichiarata, ripiego quando il registro e' indietro. */
export const REG_PIU_RECENTE = REG[REG.length - 1].id

/**
 * La reg da mostrare per prima. Non restituisce mai `null`: se il registro e'
 * indietro si ripiega sull'ultima conosciuta, perche' un calcolatore senza set
 * proposti e' peggio di un calcolatore con set di ieri. Che il registro sia
 * indietro lo dice il test, non l'interfaccia.
 */
export function regPredefinita(quando = new Date()) {
  return regCorrente(quando) ?? REG_PIU_RECENTE
}

/**
 * La reg da cui partire quando si propongono i set: la corrente, e se quella
 * non ha set si scende all'indietro finche' una non ne ha.
 *
 * Il ripiego e' all'indietro e mai in avanti: un set di una reg futura non
 * esiste, uno di una passata e' solo piu' vecchio.
 *
 * Serve meno di quando la chiave era la stagione — le reg sono due e non
 * cinque — ma la ragione per cui esiste non e' cambiata: il giorno che arriva
 * M-C, per un po' non avra' set, e chi apre l'app deve vedere quelli di M-B
 * invece di una tendina vuota.
 *
 * @param {Set<string>|string[]} conSet  gli id delle reg che hanno set
 * @returns {string|null} l'id, oppure `null` se nessuna reg ha set
 */
export function regConSetPiuRecente(conSet, quando = new Date()) {
  const ha = conSet instanceof Set ? conSet : new Set(conSet)
  const partenza = regPredefinita(quando)
  const da = REG.findIndex(r => r.id === partenza)
  for (let i = da; i >= 0; i--) if (ha.has(REG[i].id)) return REG[i].id
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
