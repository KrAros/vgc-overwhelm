// 0=Normal 1=Fire 2=Water 3=Electric 4=Grass 5=Ice 6=Fighting
// 7=Poison 8=Ground 9=Flying 10=Psychic 11=Bug 12=Rock 13=Ghost
// 14=Dragon 15=Dark 16=Steel 17=Fairy

export const TYPE_NAMES = [
  'Normal','Fire','Water','Electric','Grass','Ice','Fighting',
  'Poison','Ground','Flying','Psychic','Bug','Rock','Ghost',
  'Dragon','Dark','Steel','Fairy',
]

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