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
import { calcStat } from '../lib/stats.js'
import { applyBoost, LEVEL, STAT_SPE } from '../lib/rules.js'

const SPEED_WEATHER_CONDITIONS = {
  'sand-rush':   ['sand', 'sandstorm'],
  'chlorophyll': ['sun', 'harsh sunshine'],
  'swift swim':  ['rain', 'heavy rain'],
  'slush-rush':  ['snow', 'hail'],
}

export function calcEffectiveSpe(pokemon, weather, tailwind = false) {
  if (!pokemon?.key) return 0
  const base = pokemonData[pokemon.key]?.stats?.[STAT_SPE] ?? 0
  const sp   = pokemon.sps?.[STAT_SPE] ?? 0

  // La tabella boost arriva da lib/rules dalla sessione C: prima questo file
  // ne aveva una copia propria, con 2/2 in posizione neutra invece di 1/1.
  // Davano lo stesso risultato, ma erano due tabelle.
  let spe = applyBoost(
    calcStat(base, sp, LEVEL, pokemon.nature, STAT_SPE),
    pokemon.speBoost ?? 0,
  )

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