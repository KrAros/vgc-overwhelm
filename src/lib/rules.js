/**
 * src/lib/rules.js
 *
 * Le regole del gioco, in un posto solo.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 * Prima della sessione C questi numeri erano sparsi in almeno cinque file, a
 * volte come costante con un nome, più spesso come numero magico dentro
 * un'espressione. Alcuni esempi reali:
 *
 *   calcEngine.js       MAX_SP_PER_STAT = 32, MAX_SP_TOTAL = 66, IV = 31
 *   utils/statCalc.js   Math.min(sp ?? 0, 32) * 8   ← gli stessi numeri, muti
 *   calcEngine.js       BOOST_NUM / BOOST_DEN
 *   utils/speedOrder.js BOOST_NUM / BOOST_DEN       ← seconda copia
 *   editor/StatRow.jsx  BOOST_NUM / BOOST_DEN       ← terza copia
 *   lib/damage.js       MAX_HITS = 9
 *
 * Pokémon Champions è un gioco vivo: prima o poi cambierà uno di questi
 * valori. Con le copie sparse lo cambieresti in un posto e ne dimenticheresti
 * altri due, e il bug che ne esce è di quelli silenziosi — numeri leggermente
 * sbagliati, nessun errore in console.
 *
 * ─── COSA NON VA QUI ───────────────────────────────────────────────────────
 * Solo costanti e funzioni pure che dipendono unicamente da esse. Niente
 * import da `data/`, niente stato, niente React. Se una cosa ha bisogno del
 * Pokédex, sta in `lib/stats.js`; se ha bisogno del campo di battaglia, sta
 * in `lib/battleState.js`.
 */

// ─── Livello e IV ────────────────────────────────────────────────────────────

/** Champions gioca a livello fisso. Non è un default modificabile: è la regola. */
export const LEVEL = 50

/** Gli IV sono fissi a 31 in Champions — non esiste la variabilità classica. */
export const IV = 31

// ─── Sistema SP ──────────────────────────────────────────────────────────────

/** 1 SP vale 8 EV nella formula classica. */
export const EV_PER_SP = 8

/** Tetto per singola statistica. */
export const MAX_SP_PER_STAT = 32

/** Tetto complessivo sui sei valori. */
export const MAX_SP_TOTAL = 66

/**
 * Converte SP in EV, applicando il tetto per statistica.
 * Il clamp sta qui e non nel chiamante: così un valore fuori range salvato in
 * localStorage o arrivato da un link condiviso non può gonfiare una statistica.
 *
 * @param {number} sp
 * @returns {number} EV equivalenti
 */
export function spToEv(sp) {
  return Math.min(sp ?? 0, MAX_SP_PER_STAT) * EV_PER_SP
}

/**
 * Somma degli SP di uno spread.
 * @param {number[]} sps — sei valori, ordine [HP, Atk, Def, SpA, SpD, Spe]
 * @returns {number}
 */
export function totalSPs(sps = []) {
  return sps.reduce((a, b) => a + (b || 0), 0)
}

/**
 * Uno spread è legale se non sfora né il tetto totale né quello per statistica.
 * @param {number[]} sps
 * @returns {boolean}
 */
export function areSPsLegal(sps = []) {
  if (totalSPs(sps) > MAX_SP_TOTAL) return false
  return sps.every(v => (v || 0) >= 0 && (v || 0) <= MAX_SP_PER_STAT)
}

// ─── Indici delle statistiche ────────────────────────────────────────────────
// L'ordine è quello dei dati grezzi di Showdown, usato da pokemon.json e da
// tutti gli array `sps` dello store.

export const STAT_HP  = 0
export const STAT_ATT = 1
export const STAT_DEF = 2
export const STAT_SPA = 3
export const STAT_SPD = 4
export const STAT_SPE = 5

/** Etichette brevi, nello stesso ordine degli indici. Usate dall'editor. */
export const STAT_NAMES = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']

// ─── Tabella dei boost ───────────────────────────────────────────────────────
/**
 * I boost (da −6 a +6) si applicano come frazione, non come decimale: il gioco
 * fa una divisione intera, e usare 0.66 al posto di 2/3 sposta l'ultima unità
 * di danno in una percentuale non trascurabile di casi.
 *
 * L'indice è `6 + boost`, quindi la posizione 6 è il valore neutro.
 *
 * ─── NOTA SULL'UNIFICAZIONE ────────────────────────────────────────────────
 * Le tre copie che questo file sostituisce non erano identiche: `calcEngine` e
 * `StatRow` avevano 1/1 in posizione neutra, `speedOrder` aveva 2/2. Danno
 * entrambe 1, quindi l'unificazione è sicura al bit — ma il fatto che fossero
 * diverse e per caso equivalenti è esattamente il motivo per cui adesso ce
 * n'è una sola.
 */
export const BOOST_NUM = [2, 2, 2, 2, 2, 2, 1, 3, 4, 5, 6, 7, 8]
export const BOOST_DEN = [8, 7, 6, 5, 4, 3, 1, 2, 2, 2, 2, 2, 2]

/**
 * Applica un boost a una statistica già calcolata.
 *
 * @param {number} stat  — statistica finale, prima del boost
 * @param {number} boost — da −6 a +6
 * @returns {number}
 */
export function applyBoost(stat, boost) {
  if (!boost) return stat
  const i = 6 + Math.min(6, Math.max(-6, boost))
  return Math.floor(stat * BOOST_NUM[i] / BOOST_DEN[i])
}

// ─── Ricerca del KO ──────────────────────────────────────────────────────────

/**
 * Quanti colpi al massimo cerca `findBestNHKO` prima di dire "nessun KO".
 *
 * Era 6 fino alla sessione B, quando la ricorsione esponenziale rendeva
 * proibitivo salire. Con la programmazione dinamica il costo è lineare nei
 * colpi, quindi 9 non si sente. Sopra i 9 turni la domanda smette di avere
 * senso pratico in doubles: la partita è finita per altre ragioni.
 *
 * Chi legge questa costante: `lib/damage.js` (che la ri-esporta per
 * compatibilità) e, dalla sessione F, il ReportPanel per la scritta
 * "nessun KO in N turni".
 */
export const MAX_HITS = 9