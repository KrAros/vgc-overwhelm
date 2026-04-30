import pokemonData from './data/pokemon.json'
import movesData from './data/moves.json'
import itemsData from './data/items.json'
import abilitiesData from './data/abilities.json'

const POKEMON_DATA = pokemonData
const MOVE_DATA = movesData
const ITEMS = itemsData
const ABILITIES = abilitiesData

const STAT_HP  = 0
const STAT_ATT = 1
const STAT_DEF = 2
const STAT_SPA = 3
const STAT_SPD = 4
const STAT_SPE = 5

const NATURE_MODIFIERS = {
  hardy:   [10, 10], bashful: [10, 10], docile:  [10, 10],
  serious: [10, 10], quirky:  [10, 10],
  lonely:  [11, 12], brave: [11, 15], adamant: [11, 13], naughty: [11, 14],
  bold:    [12, 11], relaxed: [12, 15], impish:  [12, 13], lax:     [12, 14],
  timid:   [15, 11], hasty:   [15, 12], jolly:   [15, 13], naive:   [15, 14],
  modest:  [13, 11], mild:    [13, 12], quiet:   [13, 15], rash:    [13, 14],
  calm:    [14, 11], gentle:  [14, 12], sassy:   [14, 15], careful: [14, 13],
}

function getNatureModifier(nature, stat) {
  if (!nature || !NATURE_MODIFIERS[nature]) return 10
  const [boost, drop] = NATURE_MODIFIERS[nature]
  if (stat === boost) return 11
  if (stat === drop) return 9
  return 10
}

function getBaseStat(pokemon, stat) {
  if (!pokemon || !POKEMON_DATA[pokemon]) return 0
  if (pokemon === 'aegislash' && stat === STAT_ATT) return 150
  if (pokemon === 'aegislash' && stat === STAT_SPA) return 150
  return POKEMON_DATA[pokemon].stats[stat]
}

function calcStat(base, ev, iv = 31, level = 50, nature = null, stat) {
  if (stat === STAT_HP) {
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
  }
  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
  return Math.floor(raw * getNatureModifier(nature, stat) / 10)
}

function chainMultipleModifiers(...mods) {
  return mods.reduce((acc, m) => Math.floor(acc * m / 0x1000) , 0x1000)
}

export function calculateDamage({ attacker, defender, move, field = {} }) {
  const {
    atkPokemon, defPokemon,
    atkEVs = [0,0,0,0,0,0], defEVs = [0,0,0,0,0,0],
    atkIVs = [31,31,31,31,31,31], defIVs = [31,31,31,31,31,31],
    atkNature = null, defNature = null,
    atkBoosts = 0, defBoosts = 0,
    atkAbility = null, defAbility = null,
    atkItem = null, defItem = null,
    level = 50,
  } = { ...attacker, ...defender }

  const moveData = MOVE_DATA[move]
  if (!moveData || !moveData.power) return null

  const isSpecial = moveData.category === 1
  const atkStatIdx = isSpecial ? STAT_SPA : STAT_ATT
  const defStatIdx = isSpecial ? STAT_SPD : STAT_DEF

  const atkBase = getBaseStat(atkPokemon, atkStatIdx)
  const defBase = getBaseStat(defPokemon, defStatIdx)

  const atkStat = calcStat(atkBase, atkEVs[atkStatIdx], atkIVs[atkStatIdx], level, atkNature, atkStatIdx)
  const defStat = calcStat(defBase, defEVs[defStatIdx], defIVs[defStatIdx], level, defNature, defStatIdx)

  const defHP = calcStat(
    getBaseStat(defPokemon, STAT_HP),
    defEVs[STAT_HP], defIVs[STAT_HP], level, null, STAT_HP
  )

  const bp = moveData.power

  const rolls = []
  for (let r = 85; r <= 100; r++) {
    let dmg = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * bp * atkStat / defStat) / 50) + 2
    dmg = Math.floor(dmg * r / 100)

    if (field.weather === 'sun' && moveData.type === 10) dmg = Math.floor(dmg * 1.5)
    if (field.weather === 'sun' && moveData.type === 11) dmg = Math.floor(dmg * 0.5)
    if (field.weather === 'rain' && moveData.type === 11) dmg = Math.floor(dmg * 1.5)
    if (field.weather === 'rain' && moveData.type === 10) dmg = Math.floor(dmg * 0.5)
    if (field.helpingHand) dmg = Math.floor(dmg * 1.5)
    if (field.doubleTarget) dmg = Math.floor(dmg * 0.75)
    if (field.crit) dmg = Math.floor(dmg * 1.5)
    if (field.reflect && !isSpecial) dmg = Math.floor(dmg * 0.5)
    if (field.lightScreen && isSpecial) dmg = Math.floor(dmg * 0.5)
    if (field.auroraVeil) dmg = Math.floor(dmg * 0.5)

    rolls.push(dmg)
  }

  const minDmg = rolls[0]
  const maxDmg = rolls[rolls.length - 1]
  const minPct = Math.floor(minDmg / defHP * 1000) / 10
  const maxPct = Math.floor(maxDmg / defHP * 1000) / 10

  return { rolls, minDmg, maxDmg, minPct, maxPct, defHP }
}