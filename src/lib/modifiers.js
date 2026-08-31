// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

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

/**
 * Concatena una lista di modificatori in virgola fissa.
 *
 * ─── PERCHÉ NON BASTA MOLTIPLICARE ─────────────────────────────────────────
 * Fino a D-2 il motore applicava i modificatori uno per uno, troncando dopo
 * ognuno:
 *
 *     danno = floor(floor(danno * 1.3) * 1.5)
 *
 * Il gioco invece accumula PRIMA i moltiplicatori fra loro, e applica il
 * risultato al danno UNA volta sola:
 *
 *     M = 4096
 *     M = round(M * 0x14CD / 4096)     ← ×1.3
 *     M = round(M * 0x1800 / 4096)     ← ×1.5
 *     danno = pokeRound(danno * M / 4096)
 *
 * Con UN solo modificatore le due formule coincidono quasi sempre, ed è
 * proprio per questo che l'errore è sopravvissuto tanto: si vede solo quando
 * due o più modificatori finiscono nella STESSA catena, dove il vecchio
 * codice buttava via una frazione a ogni passo invece che una volta in fondo.
 * Sono 1-3 punti danno: abbastanza per spostare un 2HKO, troppo pochi perché
 * qualcuno se ne accorga guardando.
 *
 * ─── DUE DETTAGLI CHE SEMBRANO PIGNOLERIE E NON LO SONO ────────────────────
 * 1. I modificatori pari a 4096 (cioè ×1) vengono SALTATI, non moltiplicati.
 *    Moltiplicare per 4096/4096 sembra innocuo, ma introduce un
 *    arrotondamento in più che può spostare M di un'unità.
 * 2. Qui si usa `Math.round`, non `pokeRound`. Sono davvero diversi: sul
 *    valore accumulato M il gioco arrotonda 0.5 verso l'ALTO, mentre sul
 *    danno finale lo arrotonda verso il basso. Copiato da NCP, non dedotto
 *    (`damage_MASTER.js`, funzione `chainMods`).
 *
 * ─── QUANTO CONTA L'ORDINE (misurato, non dedotto) ─────────────────────────
 * Con DUE modificatori: mai. Verificato su tutte le 81 coppie costruibili
 * con le costanti di `MOD`, zero sensibili all'ordine.
 * Da TRE in su: 279 terne su 729 cambiano risultato a seconda dell'ordine,
 * sempre di una unità su M.
 *
 * Il piano di D-2 dava l'ordine per «vincolante» in generale: è vero solo da
 * tre in su, e nessuna delle terne che il motore produce oggi è sensibile.
 * L'ordine di NCP va copiato lo stesso — serve appena le catene si
 * allargheranno (Expert Belt, Friend Guard, Punk Rock, Neuroforce) — ma non
 * è lui a spiegare i numeri che si sono mossi in D-2: quelli li ha mossi il
 * passaggio dal troncamento a ogni passo alla concatenazione.
 *
 * @param {number[]} mods  moltiplicatori in virgola fissa, nell'ordine di NCP
 * @returns {number} il moltiplicatore accumulato, sempre in virgola fissa
 */
export function chainMods(mods) {
  let M = FIXED_POINT
  for (const m of mods) {
    if (m !== FIXED_POINT) M = Math.round((M * m) / FIXED_POINT)
  }
  return M
}

/**
 * I moltiplicatori del gioco in virgola fissa, con i nomi esadecimali che
 * usa NCP così che il confronto col riferimento sia visivo.
 *
 * ATTENZIONE ai due ×1.1: `MOD_1_1` vale 4505 e `MOD_1_1_ALT` vale 4506.
 * Non è un refuso. Game Freak usa due costanti diverse per lo stesso
 * moltiplicatore nominale: Muscle Band e Wise Glasses prendono la prima,
 * il Punching Glove la seconda. Un punto di differenza che si propaga.
 */
export const MOD = {
  X0_25:     0x400,   // 1024 — Ripen sulla bacca di resistenza
  X0_5:      0x800,   // 2048
  X0_75:     0xC00,   // 3072
  NEUTRO:    0x1000,  // 4096
  X1_1:      0x1199,  // 4505 — Muscle Band, Wise Glasses
  X1_1_ALT:  0x119A,  // 4506 — Punching Glove
  X1_2:      0x1333,  // 4915 — abilità "ate", item type-boost
  X1_3_ORB:  0x14CC,  // 5324 — Life Orb
  X1_3:      0x14CD,  // 5325 — terreni, Tough Claws
  // 5448 — Aura Fatata e Aura Oscura. NON è uno dei ×1.3 qui sopra: il
  // riferimento spinge `0x1548` in `calcBPMods` punto f, e 5448/4096 fa
  // 1,33007…, mentre 0x14CD fa 1,29980…. Sono 118 punti in virgola fissa di
  // differenza, che sul danno valgono qualche punto per roll — abbastanza da
  // spostare un 2HKO. Il nome dice 1_33 e non 1_3 proprio per non farsi
  // scegliere per sbaglio al posto dell'altro.
  X1_33:     0x1548,
  X1_5:      0x1800,  // 6144
  X2:        0x2000,  // 8192
}

/**
 * Converte un moltiplicatore decimale in virgola fissa, ma SOLO se la
 * conversione è esatta.
 *
 * Serve per i pochi valori che vivono ancora come decimali nei file di dati
 * (`defMult`, `spdMult`, `atkMult`). Per 1.5 e 2 la conversione è esatta;
 * per 1.1 e 1.2 NON lo è — 1.1 × 4096 = 4505.6 — e lì il valore giusto
 * dipende dalla costante che usa il gioco, che non è deducibile.
 *
 * Meglio esplodere subito che sbagliare di un punto in silenzio: un
 * calculator che sbaglia piano è peggio di uno che si ferma. Il test
 * `modifiers.test.js` percorre tutti i dati e verifica che questo caso non
 * possa mai presentarsi a runtime.
 *
 * @param {number} mult
 * @returns {number}
 */
export function daDecimale(mult) {
  const fisso = mult * FIXED_POINT
  if (!Number.isInteger(fisso)) {
    throw new Error(
      `Moltiplicatore ${mult} non rappresentabile esattamente in virgola fissa ` +
      `(${mult} × 4096 = ${fisso}). Serve una costante esplicita presa da NCP: ` +
      `vedi MOD in src/lib/modifiers.js.`
    )
  }
  return fisso
}