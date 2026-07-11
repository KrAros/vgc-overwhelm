// ID dei Tipi (0-17)
export const TYPES = {
  NORMAL: 0,
  FIRE: 1,
  WATER: 2,
  ELECTRIC: 3,
  GRASS: 4,
  ICE: 5,
  FIGHTING: 6,
  POISON: 7,
  GROUND: 8,
  FLYING: 9,
  PSYCHIC: 10,
  BUG: 11,
  ROCK: 12,
  GHOST: 13,
  DRAGON: 14,
  DARK: 15,
  STEEL: 16,
  FAIRY: 17
}

export const TYPE_NAMES = [
  'Normal','Fire','Water','Electric','Grass','Ice','Fighting',
  'Poison','Ground','Flying','Psychic','Bug','Rock','Ghost',
  'Dragon','Dark','Steel','Fairy',
]

export const TYPE_COLORS = {
  Normal: 'bg-gray-400 text-black',
  Fire: 'bg-orange-500 text-white',
  Water: 'bg-blue-500 text-white',
  Electric: 'bg-yellow-400 text-black',
  Grass: 'bg-green-500 text-white',
  Ice: 'bg-cyan-400 text-black',
  Fighting: 'bg-red-600 text-white',
  Poison: 'bg-purple-500 text-white',
  Ground: 'bg-amber-600 text-white',
  Flying: 'bg-indigo-400 text-white',
  Psychic: 'bg-pink-500 text-white',
  Bug: 'bg-lime-500 text-black',
  Rock: 'bg-yellow-600 text-white',
  Ghost: 'bg-violet-700 text-white',
  Dragon: 'bg-indigo-700 text-white',
  Dark: 'bg-stone-800 text-white',
  Steel: 'bg-slate-400 text-black',
  Fairy: 'bg-rose-400 text-black',
}

// TYPE_CHART[attackType][defendType]
// 2=super, 1=normal, -1=not very, 0=immune
export const TYPE_CHART = [
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,-1, 0, 1, 1,-1, 1],
  [ 1,-1,-1, 1, 2, 2, 1, 1, 1, 1, 1, 2,-1, 1,-1, 1, 2, 1],
  [ 1, 2,-1, 1,-1, 1, 1, 1, 2, 1, 1, 1, 2, 1,-1, 1, 1, 1],
  [ 1, 1, 2,-1,-1, 1, 1, 1, 0, 2, 1, 1, 1, 1,-1, 1, 1, 1],
  [ 1,-1, 2, 1,-1, 1, 1,-1, 2,-1, 1,-1, 2, 1,-1, 1,-1, 1],
  [ 1,-1,-1, 1, 2,-1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 1,-1, 1],
  [ 2, 1, 1, 1, 1, 2, 1,-1, 1,-1,-1,-1, 2, 0, 1, 2, 2,-1],
  [ 1, 1, 1, 1, 2, 1, 1,-1,-1, 1, 1, 1,-1,-1, 1, 1, 0, 2],
  [ 1, 2, 1, 2,-1, 1, 1, 2, 1, 0, 1,-1, 2, 1, 1, 1, 2, 1],
  [ 1, 1, 1,-1, 2, 1, 2, 1, 1, 1, 1, 2,-1, 1, 1, 1,-1, 1],
  [ 1, 1, 1, 1, 1, 1, 2, 2, 1, 1,-1, 1, 1, 1, 1, 0,-1, 1],
  [ 1,-1, 1, 1, 2, 1,-1,-1, 1,-1, 2, 1, 1,-1, 1, 2,-1,-1],
  [ 1, 2, 1, 1, 1, 2,-1, 1,-1, 2, 1, 2, 1, 1, 1, 1,-1, 1],
  [ 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1,-1, 1, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1,-1, 0],
  [ 1, 1, 1, 1, 1, 1,-1, 1, 1, 1, 2, 1, 1, 2, 1,-1, 1,-1],
  [ 1,-1,-1,-1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1,-1, 2],
  [ 1,-1, 1, 1, 1, 1, 2,-1, 1, 1, 1, 1, 1, 1, 2, 2,-1, 1],
]

export function getEffectiveness(moveType, defTypes) {
  let multiplier = 1
  for (const defType of defTypes) {
    const val = TYPE_CHART[moveType][defType]
    if (val === 0) return 0        // immunità
    if (val === 2) multiplier *= 2
    if (val === -1) multiplier *= 0.5
  }
  return multiplier
}

export function hasSTAB(moveType, atkTypes) {
  return atkTypes.includes(moveType)
}