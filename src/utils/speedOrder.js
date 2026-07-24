/**
 * src/utils/speedOrder.js
 *
 * Logica di turn order: chi attacca per primo?
 * Considera: priority della mossa, Spe finale, boost, abilità meteo, Trick Room.
 *
 * Esporta:
 *   calcEffectiveSpe(pokemon, weather) → number
 *   whoGoesFirst(t1, t2, bestMoveT1, bestMoveT2, weather, trickRoom) → 't1' | 't2' | null
 */

import pokemonData from '../data/pokemon.json'
import movesData   from '../data/moves.json'
import { calcFinalStat } from './statCalc'

const SPEED_WEATHER_CONDITIONS = {
  'sand-rush':   ['sand', 'sandstorm'],
  'chlorophyll': ['sun', 'harsh sunshine'],
  'swift swim':  ['rain', 'heavy rain'],
  'slush-rush':  ['snow', 'hail'],
}

const BOOST_NUM = [2,2,2,2,2,2,2,3,4,5,6,7,8]
const BOOST_DEN = [8,7,6,5,4,3,2,2,2,2,2,2,2]

export function calcEffectiveSpe(pokemon, weather, tailwind = false) {
  if (!pokemon?.key) return 0
  const base = pokemonData[pokemon.key]?.stats?.[5] ?? 0
  const sp   = pokemon.sps?.[5] ?? 0
  const boostVal = pokemon.speBoost ?? 0

  let spe = calcFinalStat(base, sp, 50, pokemon.nature, 5)

  if (boostVal !== 0) {
    spe = Math.floor(spe * BOOST_NUM[6 + boostVal] / BOOST_DEN[6 + boostVal])
  }

  // Tailwind raddoppia la Spe (si moltiplica con l'abilità meteo)
  if (tailwind) spe = spe * 2

  const abilityKey = (pokemon.ability || '').toLowerCase()
  const conditions = SPEED_WEATHER_CONDITIONS[abilityKey] || []
  if (conditions.includes((weather || '').toLowerCase())) {
    spe = spe * 2
  }

  return spe
}

/**
 * Restituisce 't1' se T1 va prima, 't2' se T2 va prima, null se tie.
 */
export function whoGoesFirst(t1, t2, bestMoveT1, bestMoveT2, weather, trickRoom, tailwindT1 = false, tailwindT2 = false) {
  const p1 = movesData[bestMoveT1?.move]?.priority ?? 0
  const p2 = movesData[bestMoveT2?.move]?.priority ?? 0

  if (p1 !== p2) return p1 > p2 ? 't1' : 't2'

  const spe1 = calcEffectiveSpe(t1, weather, tailwindT1)
  const spe2 = calcEffectiveSpe(t2, weather, tailwindT2)

  if (spe1 === spe2) return null
  if (trickRoom) return spe1 < spe2 ? 't1' : 't2'
  return spe1 > spe2 ? 't1' : 't2'
}