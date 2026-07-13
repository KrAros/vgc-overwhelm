import pokemonData from './data/pokemon.json'
import movesData from './data/moves.json'
import { getEffectiveness, hasSTAB, TYPES } from './data/typeChart.js'
import { NATURE_MODIFIERS } from './data/natures.js'
import { ITEM_EFFECTS } from './data/itemEffects.js'
import { ABILITY_EFFECTS } from './data/abilityEffects.js'

const POKEMON_DATA = pokemonData
const MOVE_DATA = movesData

const STAT_HP  = 0
const STAT_ATT = 1
const STAT_DEF = 2
const STAT_SPA = 3
const STAT_SPD = 4

const BOOST_NUM = [2,2,2,2,2,2,1,3,4,5,6,7,8]
const BOOST_DEN = [8,7,6,5,4,3,1,2,2,2,2,2,2]

function applyBoost(stat, boost) {
  if (!boost) return stat
  return Math.floor(stat * BOOST_NUM[6 + boost] / BOOST_DEN[6 + boost])
}

export const SPREAD_MOVES = new Set([
  'acid', 'air-cutter', 'blizzard', 'boomburst', 'brutal-swing',
  'bubble', 'bulldoze', 'captivate', 'core-enforcer', 'dark-void',
  'dazzling-gleam', 'diamond-storm', 'disarming-voice', 'discharge',
  'earthquake', 'electroweb', 'eruption', 'explosion', 'glaciate',
  'growl', 'heat-wave', 'hyper-voice', 'icy-wind', 'incinerate',
  "land's-wrath", 'lava-plume', 'leer', 'magnitude', 'muddy-water',
  'parabolic-charge', 'petal-blizzard', 'poison-gas', 'powder-snow',
  'razor-leaf', 'razor-wind', 'relic-song', 'rock-slide',
  'searing-shot', 'self-destruct', 'sludge-wave', 'snarl',
  'sparkling-aria', 'string-shot', 'struggle-bug', 'surf',
  'sweet-scent', 'swift', 'synchronise', 'tail-whip', 'teeter-dance',
  'twister', 'water-spout', 'precipice-blades', 'origin-pulse',
  'clanging-scales',
])

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
  if (boost === 0) return 10
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

function calcStat(base, sp, level = 50, nature = null, stat, weather = null, pokeTypes = []) {
  const ev = spToEv(sp)
  const iv = IV
  let result
  if (stat === STAT_HP) {
    result = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
  } else {
    const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
    result = Math.floor(raw * getNatureModifier(nature, stat) / 10)
  }

  if (weather === 'sand' && stat === STAT_SPD) {
    if (pokeTypes.includes(TYPES.ROCK) || pokeTypes.includes(TYPES.STEEL) || pokeTypes.includes(TYPES.GROUND)) {
      result = Math.floor(result * 1.5)
    }
  }

  if (weather === 'snow' && stat === STAT_DEF) {
    if (pokeTypes.includes(TYPES.ICE)) {
      result = Math.floor(result * 1.5)
    }
  }

  return result
}

function isGrounded(pokeData, ability) {
  if (pokeData.type.includes(TYPES.FLYING)) return false
  if (ability === 'levitate') return false
  return true
}

const isDebugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'yes'

export function calculateDamage({ attacker, defender, move, field = {}, debug = isDebugMode }) {
  const {
    atkPokemon,
    atkSPs = [0,0,0,0,0,0],
    atkNature = null,
    atkAbility = null,
    atkItem = null,
    atkBoost = 0,
    spAtkBoost = 0,
    level = 50,
  } = attacker

  const {
    defPokemon,
    defSPs = [0,0,0,0,0,0],
    defNature = null,
    defAbility = null,
    defItem = null,
    defBoost = 0,
    spDefBoost = 0,
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

  const effectiveness = getEffectiveness(moveType, defTypes)
  const isSpecial = moveData.category === 1
  const atkStatIdx = isSpecial ? STAT_SPA : STAT_ATT
  const defStatIdx = isSpecial ? STAT_SPD : STAT_DEF

  // Ability effects
  const atkAbilKey = (atkAbility || '').toLowerCase()
  const defAbilKey = (defAbility || '').toLowerCase()
  const atkAbilEffect = ABILITY_EFFECTS[atkAbilKey] || null
  const defAbilEffect = ABILITY_EFFECTS[defAbilKey] || null

  // Immunità
  const isLevitating  = defAbility === 'levitate' && moveType === TYPES.GROUND
  const isFlashFire   = defAbilEffect?.flashFire && moveType === TYPES.FIRE

  if (effectiveness === 0 || isLevitating || isFlashFire) {
    return { immune: true, rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }

  const atkBase = getBaseStat(atkPokemon, atkStatIdx)
  const defBase = getBaseStat(defPokemon, defStatIdx)
  const atkStat = calcStat(atkBase, atkSPs[atkStatIdx], level, atkNature, atkStatIdx, field.weather, atkTypes)
  const defStat = calcStat(defBase, defSPs[defStatIdx], level, defNature, defStatIdx, field.weather, defTypes)
  const defHP   = calcStat(getBaseStat(defPokemon, STAT_HP), defSPs[STAT_HP], level, null, STAT_HP, null, [])

  // Boost di stat
  const atkBoostVal = isSpecial ? spAtkBoost : atkBoost
  const defBoostVal = isSpecial ? spDefBoost : defBoost
  let atkStatFinal = applyBoost(atkStat, atkBoostVal)
  let defStatFinal = applyBoost(defStat, defBoostVal)

  // Item effects
  const atkItemKey = (atkItem || '').toLowerCase()
  const defItemKey = (defItem || '').toLowerCase()
  const atkItemEffect = ITEM_EFFECTS[atkItemKey] || null
  const defItemEffect = ITEM_EFFECTS[defItemKey] || null

  if (atkItemEffect?.atkMult) {
    const isCorrectType = !atkItemEffect.statType
      || (atkItemEffect.statType === 'physical' && !isSpecial)
      || (atkItemEffect.statType === 'special'  &&  isSpecial)
    if (isCorrectType) atkStatFinal = Math.floor(atkStatFinal * atkItemEffect.atkMult)
  }
  if (atkItemEffect?.typBoost !== undefined && atkItemEffect.typBoost === moveType) {
    atkStatFinal = Math.floor(atkStatFinal * atkItemEffect.typMult)
  }
  if (defItemEffect?.defMult && !isSpecial) defStatFinal = Math.floor(defStatFinal * defItemEffect.defMult)
  if (defItemEffect?.spdMult &&  isSpecial) defStatFinal = Math.floor(defStatFinal * defItemEffect.spdMult)

  // Ability effects attaccante su stat
  if (atkAbilEffect?.atkMult) {
    const isCorrectType = !atkAbilEffect.statType
      || (atkAbilEffect.statType === 'physical' && !isSpecial)
    if (isCorrectType) atkStatFinal = Math.floor(atkStatFinal * atkAbilEffect.atkMult)
  }

  // STAB — Adaptability porta a ×2
  const stab = hasSTAB(moveType, atkTypes)
    ? (atkAbilEffect?.adaptability ? 2.0 : 1.5)
    : 1

  const bp = moveData.power
  const defGrounded = isGrounded(defPokeData, defAbility)
  const atkGrounded = isGrounded(atkPokeData, atkAbility)

  let terrainBP = bp
  if (field.terrain === 'electric' && moveType === TYPES.ELECTRIC && atkGrounded) {
    terrainBP = Math.floor(terrainBP * 1.3)
  }
  if (field.terrain === 'grassy' && moveType === TYPES.GRASS && atkGrounded) {
    terrainBP = Math.floor(terrainBP * 1.3)
  }
  if (field.terrain === 'psychic' && moveType === TYPES.PSYCHIC && atkGrounded) {
    terrainBP = Math.floor(terrainBP * 1.3)
  }
  if (field.terrain === 'misty' && moveType === TYPES.DRAGON && defGrounded) {
    terrainBP = Math.floor(terrainBP * 0.5)
  }
  if (field.terrain === 'grassy' && ['earthquake', 'bulldoze', 'magnitude'].includes(move)) {
    terrainBP = Math.floor(terrainBP * 0.5)
  }

  const moveKey = move.replace(/ /g, '-')
  const rolls = []

  for (let r = 85; r <= 100; r++) {
    let damage = Math.floor(
      Math.floor(
        Math.floor((2 * level) / 5 + 2) * terrainBP * atkStatFinal / defStatFinal
      ) / 50
    ) + 2

    // Spread: ×0.75 solo in double target
    if (SPREAD_MOVES.has(moveKey) && field.doubleTarget) {
      damage = Math.floor(damage * 0.75)
    }

    if (field.weather === 'sun'  && moveType === TYPES.FIRE)  damage = Math.floor(damage * 1.5)
    if (field.weather === 'sun'  && moveType === TYPES.WATER) damage = Math.floor(damage * 0.5)
    if (field.weather === 'rain' && moveType === TYPES.WATER) damage = Math.floor(damage * 1.5)
    if (field.weather === 'rain' && moveType === TYPES.FIRE)  damage = Math.floor(damage * 0.5)

    if (field.crit) damage = Math.floor(damage * 1.5)

    damage = Math.floor(damage * r / 100)

    if (stab > 1) damage = Math.floor(damage * stab)

    damage = Math.floor(damage * effectiveness)

    // Resist berry difensore: ×0.5 se il tipo della mossa corrisponde
    if (defItemEffect?.resistBerry !== undefined && defItemEffect.resistBerry === moveType &&
    effectiveness > 1) {
      damage = Math.floor(damage * 0.5)
    }

    // Filter / Solid Rock: ×0.75 su danno superefficace
    if (defAbilEffect?.filter && effectiveness > 1) {
      damage = Math.floor(damage * 0.75)
    }

    // Thick Fat: ×0.5 danno da Fuoco e Ghiaccio
    if (defAbilEffect?.thickFat) {
      if (moveType === TYPES.FIRE || moveType === TYPES.ICE) {
        damage = Math.floor(damage * 0.5)
      }
    }

    if (field.reflect     && !isSpecial) damage = Math.floor(damage * 0.5)
    if (field.lightScreen &&  isSpecial) damage = Math.floor(damage * 0.5)
    if (field.auroraVeil)               damage = Math.floor(damage * 0.5)

    if (field.helpingHand) damage = Math.floor(damage * 1.5)

    rolls.push(damage)
  }

  const minDmg = rolls[0]
  const maxDmg = rolls[rolls.length - 1]
  const minPct = Math.floor(minDmg / defHP * 1000) / 10
  const maxPct = Math.floor(maxDmg / defHP * 1000) / 10

  const terrainLabel = {
    electric: '⚡ Electric Terrain',
    grassy: '🌿 Grassy Terrain',
    misty: '🌫️ Misty Terrain',
    psychic: '🔮 Psychic Terrain',
  }

  const log = [
    `📊 ${atkPokemon} → ${move} → ${defPokemon}`,
    `⚔️  Stat attacco: ${atkStatFinal} (base ${atkBase}, SP ${atkSPs[atkStatIdx]}, boost ${atkBoostVal > 0 ? '+' : ''}${atkBoostVal}, natura ${atkNature || 'neutra'})`,
    `🛡️  Stat difesa: ${defStatFinal} (base ${defBase}, SP ${defSPs[defStatIdx]}, boost ${defBoostVal > 0 ? '+' : ''}${defBoostVal}, natura ${defNature || 'neutra'})`,
    `❤️  HP difensore: ${defHP} (base ${getBaseStat(defPokemon, STAT_HP)}, SP ${defSPs[STAT_HP]})`,
    `💥 Potenza mossa: ${bp}${terrainBP !== bp ? ` → ${terrainBP} (terreno)` : ''}`,
    `🌍 Spread: ${SPREAD_MOVES.has(moveKey) ? (field.doubleTarget ? '×0.75 ✅' : 'mossa spread, ma single target ⚠️') : '❌'}`,
    `🎯 STAB: ${stab > 1 ? `×${stab} ✅` : '×1 ❌'}`,
    `🔥 Efficacia: ×${effectiveness}${effectiveness === 2 ? ' 🔥' : effectiveness === 4 ? ' 🔥🔥' : effectiveness === 0.5 ? ' ❄️' : ''}`,
    atkAbility ? `⚡ Abilità atk: ${atkAbility}` : null,
    defAbility ? `🛡️ Abilità def: ${defAbility}` : null,
    field.terrain ? `🌱 Terreno: ${terrainLabel[field.terrain] || field.terrain}` : null,
    field.weather ? `☀️ Meteo: ${field.weather}` : null,
    `🎲 Danno min: ${minDmg} (${minPct}%) | max: ${maxDmg} (${maxPct}%)`,
    `🎲 Rolls: ${rolls.join(', ')}`,
  ].filter(Boolean)

  if (typeof document !== 'undefined') {
    let debugContainer = document.getElementById('pokemon-debug-logger')

    if (debug) {
      if (!debugContainer) {
        debugContainer = document.createElement('div')
        debugContainer.id = 'pokemon-debug-logger'
        document.body.appendChild(debugContainer)

        const style = document.createElement('style')
        style.textContent = `
          #pokemon-debug-logger {
            position: fixed; bottom: 20px; right: 20px;
            background: #1e1e2e; color: #cdd6f4;
            border-radius: 12px; padding: 16px;
            font-family: monospace; max-width: 420px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            z-index: 9999; max-height: 75vh;
            overflow-y: auto; border: 1px solid #313244;
          }
          .db-title { font-weight: bold; border-bottom: 1px solid #313244; padding-bottom: 6px; margin-bottom: 8px; color: #f5e0dc; font-size: 13px; }
          .db-item { font-size: 11px; margin-bottom: 4px; color: #a6adc8; border-bottom: 1px dashed #252538; padding-bottom: 2px; }
          .db-res { margin-top: 10px; background: #252538; padding: 8px; border-radius: 6px; border-left: 3px solid #fab387; font-size: 11px; }
        `
        document.head.appendChild(style)
      }

      const headerText = log[0]
      const rollsText = log[log.length - 1]
      const minMaxText = log[log.length - 2]
      const details = log.slice(1, -2)

      debugContainer.innerHTML = `
        <div class="db-title">${headerText}</div>
        <div>
          ${details.map(d => `<div class="db-item">${d}</div>`).join('')}
        </div>
        <div class="db-res">
          <strong>${minMaxText}</strong>
          <div style="font-size: 10px; color: #b4befe; margin-top: 5px; word-break: break-all;">${rollsText}</div>
        </div>
      `
    } else if (debugContainer) {
      debugContainer.remove()
    }
  }

  return { rolls, minDmg, maxDmg, minPct, maxPct, defHP, effectiveness, stab, log }
}