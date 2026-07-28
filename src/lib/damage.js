/**
 * src/lib/damage.js
 *
 * Libreria di base per i calcoli danno end-of-turn e KO chance.
 * Fonte di verità unica — importata da ReportPanel e smogonString.
 *
 * Nessuna dipendenza React, nessun side effect.
 */

import { TYPES } from '../data/typeChart'

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
 * Calcola ricorsivamente la probabilità di fare NHKO in `hits` colpi,
 * considerando un delta EOT fisso tra un colpo e l'altro.
 *
 * Questa è la funzione canonica — identica alla logica in smogonString.js
 * (calcP interna), che produce gli stessi risultati della stringa Smogon copiata.
 *
 * @param {number[]} rolls   — array dei 16 roll di danno
 * @param {number}   defHP   — HP del difensore all'inizio del calcolo
 * @param {number}   eotNet  — delta EOT per turno (+heal, -damage)
 * @param {number}   hits    — numero di colpi da considerare
 * @returns {number}         — probabilità in [0, 1]
 */
export function calcKOChance(rolls, defHP, eotNet, hits) {
  const n = rolls.length
  const calcP = (hp, h) => {
    if (h === 0) return hp <= 0 ? 1 : 0
    let s = 0
    for (const r of rolls) s += calcP(hp - r + eotNet, h - 1)
    return s / n
  }
  return calcP(defHP, hits)
}

// ── Best NHKO ─────────────────────────────────────────────────────────────────

/**
 * Trova il miglior NHKO possibile (da 1 a maxHits colpi) con EOT.
 * Restituisce il primo hit count con probabilità > 0.
 *
 * @param {number[]} rolls
 * @param {number}   defHP
 * @param {number}   eotNet
 * @param {number}   [maxHits=6]
 * @returns {{
 *   hits: number,
 *   chance: number,
 *   pct: number,
 *   guaranteed: boolean,
 * } | null}
 */
export function findBestNHKO(rolls, defHP, eotNet, maxHits = 6) {
  for (let hits = 1; hits <= maxHits; hits++) {
    const chance = calcKOChance(rolls, defHP, eotNet, hits)
    if (chance > 0.0001) {
      const pct = Math.round(chance * 1000) / 10
      return {
        hits,
        chance,
        pct,
        guaranteed: chance >= 0.9999,
      }
    }
  }
  return null
}