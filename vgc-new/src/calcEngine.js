import pokemonData from './data/pokemon.json'
import movesData from './data/moves.json'
import itemsData from './data/items.json'
import abilitiesData from './data/abilities.json'
import { getEffectiveness, hasSTAB } from './data/typeChart.js'

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
  hardy:[10,10],bashful:[10,10],docile:[10,10],serious:[10,10],quirky:[10,10],
  lonely:[11,12],brave:[11,15],adamant:[11,13],naughty:[11,14],
  bold:[12,11],relaxed:[12,15],impish:[12,13],lax:[12,14],
  timid:[15,11],hasty:[15,12],jolly:[15,13],naive:[15,14],
  modest:[13,11],mild:[13,12],quiet:[13,15],rash:[13,14],
  calm:[14,11],gentle:[14,12],sassy:[14,15],careful:[14,13],
}

const MAX_SP_PER_STAT = 32
const MAX_SP_TOTAL = 66
const IV = 31

function spToEv(sp) {
  return Math.min(sp ?? 0, MAX_SP_PER_STAT) * 8
}

function validateSPs(sps) {
  const total = sps.reduce((a, b) => a + b, 0)
  if (total > MAX_SP_TOTAL) {
    console.warn(`SP totali (${total}) superano il massimo di ${MAX_SP_TOTAL}`)
  }
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

function calcStat(base, sp, level = 50, nature = null, stat) {
  const ev = spToEv(sp)
  const iv = IV
  if (stat === STAT_HP) {
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
  }
  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
  return Math.floor(raw * getNatureModifier(nature, stat) / 10)
}

export function calculateDamage({ attacker, defender, move, field = {} }) {
  const {
    atkPokemon,
    atkSPs = [0,0,0,0,0,0],
    atkNature = null,
    level = 50,
  } = attacker

  const {
    defPokemon,
    defSPs = [0,0,0,0,0,0],
    defNature = null,
  } = defender

  validateSPs(atkSPs)
  validateSPs(defSPs)

  const moveData = MOVE_DATA[move]
  if (!moveData || !moveData.power) return null

  const atkPokeData = POKEMON_DATA[atkPokemon]
  const defPokeData = POKEMON_DATA[defPokemon]
  if (!atkPokeData || !defPokeData) return null

  const moveType = moveData.type
  const atkTypes = atkPokeData.type
  const defTypes = defPokeData.type

  // Efficacia tipo — immunità, debolezze, resistenze
  const effectiveness = getEffectiveness(moveType, defTypes)
  if (effectiveness === 0) return { immune: true, rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }

  // STAB
  const stab = hasSTAB(moveType, atkTypes) ? 1.5 : 1

  const isSpecial = moveData.category === 1
  const atkStatIdx = isSpecial ? STAT_SPA : STAT_ATT
  const defStatIdx = isSpecial ? STAT_SPD : STAT_DEF

  const atkBase = getBaseStat(atkPokemon, atkStatIdx)
  const defBase = getBaseStat(defPokemon, defStatIdx)

  const atkStat = calcStat(atkBase, atkSPs[atkStatIdx], level, atkNature, atkStatIdx)
  const defStat = calcStat(defBase, defSPs[defStatIdx], level, defNature, defStatIdx)

  const defHP = calcStat(
    getBaseStat(defPokemon, STAT_HP),
    defSPs[STAT_HP], level, null, STAT_HP
  )

  const bp = moveData.power

const rolls = []
  for (let r = 85; r <= 100; r++) {
    let dmg = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * bp * atkStat / defStat) / 50) + 2
    dmg = Math.floor(dmg * r / 100)

    // STAB con floor separato
    if (stab === 1.5) dmg = Math.floor(dmg * 4096 * 1.5 / 4096)

    // Efficacia con floor separato  
    if (effectiveness === 2)   dmg = dmg * 2
    if (effectiveness === 4)   dmg = dmg * 4
    if (effectiveness === 0.5) dmg = Math.floor(dmg * 0.5)
    if (effectiveness === 0.25) dmg = Math.floor(dmg * 0.25)

    // Modificatori campo
    if (field.weather === 'sun'  && moveType === 1)  dmg = Math.floor(dmg * 1.5)
    if (field.weather === 'sun'  && moveType === 2)  dmg = Math.floor(dmg * 0.5)
    if (field.weather === 'rain' && moveType === 2)  dmg = Math.floor(dmg * 1.5)
    if (field.weather === 'rain' && moveType === 1)  dmg = Math.floor(dmg * 0.5)
    if (field.helpingHand)               dmg = Math.floor(dmg * 1.5)
    if (field.doubleTarget)              dmg = Math.floor(dmg * 0.75)
    if (field.crit)                      dmg = Math.floor(dmg * 1.5)
    if (field.reflect    && !isSpecial)  dmg = Math.floor(dmg * 0.5)
    if (field.lightScreen &&  isSpecial) dmg = Math.floor(dmg * 0.5)
    if (field.auroraVeil)                dmg = Math.floor(dmg * 0.5)

    rolls.push(dmg)
  }

const minDmg = rolls[0]
  const maxDmg = rolls[rolls.length - 1]
  const minPct = Math.floor(minDmg / defHP * 1000) / 10
  const maxPct = Math.floor(maxDmg / defHP * 1000) / 10

  const log = [
    `📊 ${atkPokemon} → ${move} → ${defPokemon}`,
    `⚔️  Stat attacco: ${atkStat} (base ${atkBase}, SP ${atkSPs[atkStatIdx]}, natura ${atkNature || 'neutra'})`,
    `🛡️  Stat difesa: ${defStat} (base ${defBase}, SP ${defSPs[defStatIdx]}, natura ${defNature || 'neutra'})`,
    `❤️  HP difensore: ${defHP} (base ${getBaseStat(defPokemon, STAT_HP)}, SP ${defSPs[STAT_HP]})`,
    `💥 Potenza mossa: ${bp}`,
    `🎯 STAB: ${stab === 1.5 ? '×1.5 ✅' : '×1 ❌'}`,
    `🔥 Efficacia: ×${effectiveness}${effectiveness === 0 ? ' (IMMUNE)' : effectiveness === 2 ? ' 🔥' : effectiveness === 4 ? ' 🔥🔥' : effectiveness === 0.5 ? ' ❄️' : ''}`,
    `🎲 Danno min: ${minDmg} (${minPct}%) | max: ${maxDmg} (${maxPct}%)`,
    `🎲 Rolls: ${rolls.join(', ')}`,
  ]

  return { rolls, minDmg, maxDmg, minPct, maxPct, defHP, effectiveness, stab, log }
}