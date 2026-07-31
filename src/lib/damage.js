/**
 * src/lib/damage.js
 *
 * Libreria di base per i calcoli danno end-of-turn e KO chance.
 * Fonte di verità unica — importata da ReportPanel e smogonString.
 *
 * Nessuna dipendenza React, nessun side effect.
 */

import { TYPES } from '../data/typeChart'
import { MAX_HITS } from './rules.js'

// ── Costanti ──────────────────────────────────────────────────────────────────

/**
 * Numero massimo di colpi considerato nella ricerca dell'NHKO.
 * Era 6 quando la KO chance costava 16^n: oltre quel numero il browser si
 * bloccava. Con la programmazione dinamica nove colpi costano 0,1 ms, e nove
 * è anche il tetto che usa il calculator di Smogon.
 *
 * NOTA: la simulazione della Sitrus Berry in ReportPanel.jsx ha un tetto suo,
 * fermo a 6 turni (insieme alla chiave i18n `eot.no_ko_in_6`). Vanno allineati,
 * ma è un file fuori dallo scope di questa sessione.
 */
// Ri-esportata per compatibilità: la definizione sta in `lib/rules.js` dalla
// sessione C, insieme alle altre regole di gioco. I chiamanti storici
// (`utils/smogonString.js`, i test) continuano a importarla da qui.
export { MAX_HITS }

/**
 * Sotto questa probabilità un KO viene considerato inesistente.
 * Serve a due cose: scartare il rumore in virgola mobile e non annunciare
 * un "0,004% chance to 4HKO" che non interessa a nessuno.
 */
const SOGLIA_KO = 0.0001

/** Sopra questa probabilità un KO viene considerato garantito. */
const SOGLIA_GARANTITO = 0.9999

// ── Immunità sabbia ───────────────────────────────────────────────────────────

const SAND_IMMUNE_TYPES = new Set([TYPES.ROCK, TYPES.STEEL, TYPES.GROUND])
const SAND_IMMUNE_ABILITIES = new Set([
  'sand force', 'sand rush', 'sand veil', 'magic guard', 'overcoat',
])

/**
 * Restituisce true se il difensore è immune al danno da tempesta di sabbia.
 * @param {number[]} defTypes  — array di indici tipo dal pokemonData
 * @param {string}   ability   — abilità del difensore (slug lowercase)
 * @param {string}   item      — item del difensore (slug lowercase)
 */
export function isSandImmune(defTypes = [], ability = '', item = '') {
  return (
    defTypes.some(t => SAND_IMMUNE_TYPES.has(t)) ||
    SAND_IMMUNE_ABILITIES.has(ability.toLowerCase()) ||
    item.toLowerCase() === 'safety goggles'
  )
}

// ── EOT (End of Turn) ─────────────────────────────────────────────────────────

/**
 * Calcola tutti gli effetti fine turno rilevanti per un difensore.
 *
 * @param {object} def      — slot difensore dallo store { item, ability }
 * @param {number} defHP    — HP massimi del difensore (da result.defHP)
 * @param {string} weather  — meteo attivo (slug lowercase)
 * @param {number[]} defTypes — tipi del difensore (indici numerici)
 * @returns {{
 *   isSand: boolean,
 *   sandImmune: boolean,
 *   sandDmgHP: number,
 *   leftoversHP: number,
 *   sitrusBerryHP: number,
 *   eotNet: number,
 * }}
 */
export function calcEOT(def, defHP, weather, defTypes = []) {
  const w = (weather || '').toLowerCase()
  const isSand = w === 'sand' || w === 'sandstorm'
  const sandImmune = isSandImmune(defTypes, def.ability || '', def.item || '')
  const sandDmgHP = isSand && !sandImmune ? Math.floor(defHP / 16) : 0
  const leftoversHP = (def.item || '').toLowerCase() === 'leftovers'
    ? Math.floor(defHP / 16)
    : 0
  const sitrusBerryHP = (def.item || '').toLowerCase() === 'sitrus berry'
    ? Math.floor(defHP / 4)
    : 0
  const eotNet = leftoversHP - sandDmgHP

  return { isSand, sandImmune, sandDmgHP, leftoversHP, sitrusBerryHP, eotNet }
}

// ── KO Chance ─────────────────────────────────────────────────────────────────

/**
 * Probabilità cumulativa di KO, colpo per colpo.
 *
 * ─── COME FUNZIONA ────────────────────────────────────────────────────────
 * L'implementazione precedente era una ricorsione che apriva un ramo per ogni
 * roll a ogni colpo: 16^n percorsi. Con sei colpi sono 16,7 milioni di rami,
 * 253 ms di main thread bloccato; con sette, quattro secondi e mezzo.
 *
 * Il punto è che quei milioni di percorsi arrivano su pochissimi stati diversi:
 * quello che conta di un percorso non è la sequenza dei roll ma solo gli HP
 * rimasti alla fine. Quindi invece di seguire i percorsi teniamo una mappa
 * `HP rimasti → probabilità di trovarsi lì`, e a ogni colpo la trasformiamo
 * nella mappa del colpo successivo. Gli stati possibili sono al massimo quanti
 * gli HP del difensore (~200-400), quindi il costo diventa
 * `colpi × stati × roll` ≈ 30 mila operazioni invece di 16,7 milioni.
 *
 * È la stessa tecnica già usata da `_calcSitrusProb` in ReportPanel.jsx.
 *
 * ─── SEMANTICA DEL TURNO ──────────────────────────────────────────────────
 * Per ogni colpo, in quest'ordine:
 *   1. sottrai il roll → se gli HP scendono a 0 o sotto è KO, e il turno finisce lì
 *   2. applica l'EOT (Leftovers positivo, sabbia negativo) → se gli HP
 *      scendono a 0 o sotto è KO (la sabbia può chiudere il conto a fine turno)
 *   3. limita gli HP al massimo del difensore
 *
 * I punti 1 e 3 sono le due correzioni di questa sessione. Prima il KO veniva
 * controllato solo dopo l'ultimo colpo, quindi una sequenza che uccideva al
 * secondo colpo e poi "risaliva" con i Leftovers veniva contata come non-KO;
 * e la cura poteva portare gli HP sopra il massimo, rendendo il KO sempre più
 * difficile turno dopo turno.
 *
 * Con `eotNet ≤ 0` (nessun EOT, oppure sabbia) i risultati sono identici alla
 * vecchia implementazione: gli HP scendono e basta, quindi controllare il KO
 * in mezzo o solo alla fine è la stessa cosa. I numeri cambiano solo quando i
 * Leftovers superano l'eventuale danno da sabbia.
 *
 * @param {number[]} rolls   — array dei 16 roll di danno
 * @param {number}   defHP   — HP del difensore all'inizio del calcolo
 * @param {number}   eotNet  — delta EOT per turno (+cura, -danno)
 * @param {number}   maxHits — quanti colpi calcolare
 * @returns {number[]} array lungo `maxHits`: l'elemento in posizione `h - 1`
 *                     è la probabilità di aver fatto KO **entro** `h` colpi.
 */
export function koChanceCumulative(rolls, defHP, eotNet = 0, maxHits = MAX_HITS) {
  const cumulativa = new Array(Math.max(maxHits, 0)).fill(0)
  if (!rolls || rolls.length === 0 || maxHits < 1) return cumulativa

  const n = rolls.length
  const quotaRoll = 1 / n

  // stati: HP rimasti → probabilità di trovarsi con quegli HP.
  // All'inizio siamo con certezza agli HP pieni.
  let stati = new Map([[defHP, 1]])
  let koTotale = 0

  for (let h = 0; h < maxHits; h++) {
    const prossimi = new Map()

    for (const [hp, prob] of stati) {
      // Ogni roll è equiprobabile: la probabilità dello stato si divide in 16.
      const quota = prob * quotaRoll

      for (const roll of rolls) {
        let nuoviHP = hp - roll
        if (nuoviHP <= 0) { koTotale += quota; continue }   // KO dal colpo

        nuoviHP += eotNet
        if (nuoviHP <= 0) { koTotale += quota; continue }   // KO dall'EOT

        if (nuoviHP > defHP) nuoviHP = defHP                // la cura non supera il massimo

        prossimi.set(nuoviHP, (prossimi.get(nuoviHP) || 0) + quota)
      }
    }

    cumulativa[h] = koTotale
    stati = prossimi

    // Nessuno stato sopravvissuto: il KO è certo, i colpi successivi non
    // cambiano più niente. Riempio il resto e esco.
    if (stati.size === 0) {
      for (let k = h + 1; k < maxHits; k++) cumulativa[k] = koTotale
      break
    }
  }

  return cumulativa
}

/**
 * Probabilità di fare KO entro `hits` colpi.
 *
 * Wrapper su `koChanceCumulative` per i casi in cui serve un numero solo.
 * Se ti servono più valori di `hits`, chiama direttamente `koChanceCumulative`
 * una volta sola invece di questa funzione in un ciclo: la DP calcola tutti i
 * colpi nella stessa passata.
 *
 * @param {number[]} rolls
 * @param {number}   defHP
 * @param {number}   eotNet
 * @param {number}   hits
 * @returns {number} probabilità in [0, 1]
 */
export function calcKOChance(rolls, defHP, eotNet, hits) {
  if (hits < 1) return 0
  return koChanceCumulative(rolls, defHP, eotNet, hits)[hits - 1]
}

// ── Best NHKO ─────────────────────────────────────────────────────────────────

/**
 * Trova il miglior NHKO possibile con EOT: il primo numero di colpi la cui
 * probabilità di KO supera la soglia.
 *
 * Una sola passata di DP copre tutti i valori di `hits`, quindi non c'è più
 * il ciclo di chiamate che c'era prima.
 *
 * @param {number[]} rolls
 * @param {number}   defHP
 * @param {number}   eotNet
 * @param {object}   [opzioni]
 * @param {number}   [opzioni.minHits=1]        — da quanti colpi iniziare a
 *   guardare. La stringa Smogon passa 2 perché la chance di OHKO è mostrata
 *   altrove nel pannello.
 * @param {number}   [opzioni.maxHits=MAX_HITS] — tetto della ricerca.
 * @returns {{
 *   hits: number,
 *   chance: number,
 *   pct: number,
 *   guaranteed: boolean,
 * } | null}
 */
export function findBestNHKO(rolls, defHP, eotNet, { minHits = 1, maxHits = MAX_HITS } = {}) {
  const cumulativa = koChanceCumulative(rolls, defHP, eotNet, maxHits)

  for (let hits = Math.max(minHits, 1); hits <= maxHits; hits++) {
    const chance = cumulativa[hits - 1]
    if (chance > SOGLIA_KO) {
      return {
        hits,
        chance,
        pct: Math.round(chance * 1000) / 10,
        guaranteed: chance >= SOGLIA_GARANTITO,
      }
    }
  }
  return null
}