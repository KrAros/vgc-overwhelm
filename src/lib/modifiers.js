/**
 * src/lib/modifiers.js
 *
 * L'aritmetica in virgola fissa della formula del danno.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 * Il piano lo assegna alla sessione D. È stato creato in G con il solo pezzo
 * che serviva subito — `pokeRound` — perché la correzione degli schermi ne
 * aveva bisogno e la stessa espressione era già ricopiata a mano tre volte
 * dentro `calcEngine.js` (penalità spread, Life Orb, e ora gli schermi).
 * Tre copie della stessa riga sono tre occasioni di scriverla storta.
 *
 * D ci aggiungerà `chainMods` e le costanti fixed-point. Non aggiungere qui
 * niente che dipenda dai dati o dallo stato: questo file è aritmetica pura.
 */

/**
 * L'arrotondamento di Game Freak: verso l'alto solo se la parte frazionaria
 * supera 0.5 *stretto*. A esattamente 0.5 arrotonda verso il basso, che è il
 * contrario di quello che fa `Math.round`.
 *
 *   pokeRound(45.5) === 45      Math.round(45.5) === 46
 *   pokeRound(45.6) === 46
 *
 * Quella mezza unità non è un dettaglio: è la differenza fra un 2HKO
 * garantito e un 2HKO al 94%. Verificato identico all'implementazione di
 * riferimento in NCP (`damage_MASTER.js`, funzione `pokeRound`).
 *
 * @param {number} n
 * @returns {number}
 */
export function pokeRound(n) {
  return n % 1 > 0.5 ? Math.ceil(n) : Math.floor(n)
}

/**
 * Il denominatore della virgola fissa. I moltiplicatori del gioco sono
 * frazioni di 4096: ×1.5 è 6144, ×0.5 è 2048, la riduzione degli schermi
 * nei doppi è 2732.
 */
export const FIXED_POINT = 4096