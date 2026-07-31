import pokemonData from './data/pokemon.json'
import movesData from './data/moves.json'
import { getEffectiveness, hasSTAB, TYPES } from './data/typeChart.js'
import { ITEM_EFFECTS } from './data/itemEffects.js'
import { ABILITY_EFFECTS, normalizeAbilityKey } from './data/abilityEffects.js'
import { IS_DEBUG, publishDebugLog } from './lib/debugBus.js'
import {
  LEVEL,
  MAX_SP_TOTAL,
  applyBoost,
  totalSPs,
  STAT_HP, STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD,
} from './lib/rules.js'
import { calcStat, getBaseStat } from './lib/stats.js'

const POKEMON_DATA = pokemonData
const MOVE_DATA = movesData

// Le costanti di regola, le tabelle boost e il calcolo delle statistiche vivono
// in `lib/rules.js` e `lib/stats.js` dalla sessione C — vedi gli import in cima.

/**
 * Segnala uno spread illegale, ma solo a debug acceso.
 *
 * Il controllo sta nel percorso caldo: con 36 celle × 4 direzioni × 4 mosse
 * può sparare centinaia di righe per render. Il vincolo dei 66 SP non è
 * ancora mostrato all'utente da nessuna parte nell'interfaccia — è un punto
 * aperto della sessione F.
 */
function validateSPs(sps, debug) {
  if (!debug) return
  const total = totalSPs(sps)
  if (total > MAX_SP_TOTAL) {
    console.warn(`SP totali (${total}) superano il massimo di ${MAX_SP_TOTAL}`)
  }
}

function isGrounded(pokeData, ability) {
  if (pokeData.type.includes(TYPES.FLYING)) return false
  if (ability === 'levitate') return false
  return true
}

export function calculateDamage({ attacker, defender, move, field = {}, debug = IS_DEBUG }) {
  const {
    atkPokemon,
    atkSPs = [0,0,0,0,0,0],
    atkNature = null,
    atkAbility = null,
    atkItem = null,
    atkBoost = 0,
    spAtkBoost = 0,
    atkAbilityFlags = {},
    lastRespectsKOs = 0,
    level = LEVEL,
  } = attacker

  const {
    defPokemon,
    defSPs = [0,0,0,0,0,0],
    defNature = null,
    defAbility = null,
    defItem = null,
    defBoost = 0,
    spDefBoost = 0,
    defAbilityFlags = {},
  } = defender

  validateSPs(atkSPs, debug)
  validateSPs(defSPs, debug)

  const moveData = MOVE_DATA[move]
  if (!moveData || !moveData.power) return null

  const atkPokeData = POKEMON_DATA[atkPokemon]
  const defPokeData = POKEMON_DATA[defPokemon]
  if (!atkPokeData || !defPokeData) return null

  // ── Weather Ball: tipo e BP cambiano in base al meteo ────────────────────
  // Senza meteo: Normal BP 50 — Con meteo: tipo corrispondente BP 100
  const WEATHER_BALL_TYPE = {
    rain:             TYPES.WATER,
    'heavy rain':     TYPES.WATER,
    sun:              TYPES.FIRE,
    'harsh sunshine': TYPES.FIRE,
    sand:             TYPES.ROCK,
    sandstorm:        TYPES.ROCK,
    snow:             TYPES.ICE,
    hail:             TYPES.ICE,
  }
  const isWeatherBall = move === 'weather ball'
  const weatherBallType = isWeatherBall && field.weather
    ? WEATHER_BALL_TYPE[(field.weather || '').toLowerCase()] ?? null
    : null
  let moveType = weatherBallType !== null ? weatherBallType : moveData.type
  const isLastRespects = move === 'last respects'
  const lastRespectsBP = isLastRespects ? 50 + (Math.min(3, Math.max(0, lastRespectsKOs)) * 50) : null
  const effectiveBP    = isLastRespects ? lastRespectsBP
    : isWeatherBall && weatherBallType !== null ? 100
    : moveData.power
  const atkTypes = atkPokeData.type
  const defTypes = defPokeData.type
  const isContact = moveData.contact === true
  const isSpread  = moveData.spread === true

  const isSpecial = moveData.category === 1
  // Body Press: mossa fisica che usa la Def dell'attaccante invece dell'Atk
  const isBodyPress = moveData.useDefAsStat === true
  const atkStatIdx = isSpecial ? STAT_SPA : (isBodyPress ? STAT_DEF : STAT_ATT)
  const defStatIdx = isSpecial ? STAT_SPD : STAT_DEF

  // ── Chiavi abilità normalizzate ──────────────────────────────────────────
  const atkAbilKey = normalizeAbilityKey(atkAbility)
  const defAbilKey = normalizeAbilityKey(defAbility)
  const atkAbilEffect = ABILITY_EFFECTS[atkAbilKey] || null
  const defAbilEffect = ABILITY_EFFECTS[defAbilKey] || null

  // Ate abilities: Normal -> altro tipo + x1.2 BP
  let ateBoost = false
  if (moveType === TYPES.NORMAL) {
    if (atkAbilKey === 'pixilate')    { moveType = TYPES.FAIRY;  ateBoost = true }
    if (atkAbilKey === 'aerilate')    { moveType = TYPES.FLYING; ateBoost = true }
    if (atkAbilKey === 'refrigerate') { moveType = TYPES.ICE;    ateBoost = true }
    if (atkAbilKey === 'dragonize')   { moveType = TYPES.DRAGON; ateBoost = true }
  }

  // effectiveness calcolata DOPO la conversione ate
  const effectiveness = getEffectiveness(moveType, defTypes)

  // ── Immunità ─────────────────────────────────────────────────────────────
  // Levitate: immune a mosse Ground
  const isLevitating = defAbilKey === 'levitate' && moveType === TYPES.GROUND
  // Flash Fire: sempre immune a Fire in difesa (indipendentemente dal toggle offensivo)
  const isFlashFire  = defAbilEffect?.flashFireImmune && moveType === TYPES.FIRE

  if (isLevitating) {
    return { immune: true, reason: 'ability', abilityName: 'Levitate', rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
  if (isFlashFire) {
    return { immune: true, reason: 'ability', abilityName: 'Flash Fire', rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
  if (effectiveness === 0) {
    return { immune: true, reason: 'type', rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }

  const atkBase = getBaseStat(atkPokemon, atkStatIdx)
  const defBase = getBaseStat(defPokemon, defStatIdx)
  const atkStat = calcStat(atkBase, atkSPs[atkStatIdx], level, atkNature, atkStatIdx, field.weather, atkTypes)
  const defStat = calcStat(defBase, defSPs[defStatIdx], level, defNature, defStatIdx, field.weather, defTypes)
  const defHP   = calcStat(getBaseStat(defPokemon, STAT_HP), defSPs[STAT_HP], level, null, STAT_HP, null, [])

  // ── Boost di stat base ───────────────────────────────────────────────────
  let atkBoostVal = isSpecial ? spAtkBoost : atkBoost
  const defBoostVal = isSpecial ? spDefBoost : defBoost

  // ── Intimidate → Defiant / Contrary (automatico, nessun toggle extra) ───
  // Il difensore ha Intimidate attivo: applica -1 Atk all'attaccante,
  // MA se l'attaccante ha Defiant o Contrary, il risultato cambia.
  //   - Normale:  atkBoostVal -= 1
  //   - Defiant:  -1 + 2 = +1 netto (drop avviene, poi +2 per ogni drop)
  //   - Contrary: -1 invertito = +1 (il drop diventa aumento)
  //   - Competitive: -1 Atk (normale) + 2 SpAtk separato
  if (defAbilEffect?.intimidate && defAbilityFlags.intimidateActive) {
    if (!isSpecial) {
      // Atk drop — Defiant e Contrary lo invertono/compensano
      if (atkAbilEffect?.defiant)        atkBoostVal += 1  // -1 + 2 = +1
      else if (atkAbilEffect?.contrary)  atkBoostVal += 1  // invertito
      else                               atkBoostVal -= 1  // drop normale
    }
    // Competitive: +2 SpAtk indipendentemente dalla stat attaccata
    if (atkAbilEffect?.competitive && isSpecial) {
      atkBoostVal += 2
    }
  }

  const atkBoostEffective = Math.min(6, Math.max(-6, atkBoostVal))
  let atkStatFinal = applyBoost(atkStat, atkBoostEffective)
  let defStatFinal = applyBoost(defStat, defBoostVal)

  // ── Item effects ─────────────────────────────────────────────────────────
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

  // ── Ability effects su stat attaccante ───────────────────────────────────

  // Huge Power / Pure Power: ×2 Atk fisico
  if (atkAbilEffect?.atkMult) {
    const isCorrectType = !atkAbilEffect.statType
      || (atkAbilEffect.statType === 'physical' && !isSpecial)
    if (isCorrectType) atkStatFinal = Math.floor(atkStatFinal * atkAbilEffect.atkMult)
  }

  // Supreme Overlord (Kingambit): ×(1 + KOs×0.1) su Atk e SpAtk
  // Es: 1 alleato KO = ×1.1, 5 alleati KO = ×1.5
  if (atkAbilEffect?.supremeOverlord) {
    const kos = Math.min(5, Math.max(0, atkAbilityFlags.supremeOverlordKOs || 0))
    if (kos > 0) {
      atkStatFinal = Math.floor(atkStatFinal * (1 + kos * 0.1))
    }
  }
  
  // ── STAB ─────────────────────────────────────────────────────────────────
  const stab = hasSTAB(moveType, atkTypes)
    ? (atkAbilEffect?.adaptability ? 2.0 : 1.5)
    : 1

  const bp = effectiveBP
  const defGrounded = isGrounded(defPokeData, defAbility)
  const atkGrounded = isGrounded(atkPokeData, atkAbility)

  // ── Terrain boost potenza ─────────────────────────────────────────────────
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
  // Tough Claws: ×1.3 BP su mosse contatto (Mega Metagross, Mega Barbaracle)
  if (atkAbilEffect?.toughClaws && isContact) {
    terrainBP = Math.floor(terrainBP * 1.3)
  }

  // Fire Mane: ×1.5 BP su mosse Fire (Mega Pyroar)
  if (atkAbilEffect?.fireMane && moveType === TYPES.FIRE) {
    terrainBP = Math.floor(terrainBP * 1.5)
  }

  // Ate abilities: ×1.2 BP (pixilate, aerilate, refrigerate)
  if (ateBoost) {
    terrainBP = Math.floor(terrainBP * 1.2)
  }

  // Knock Off: ×1.5 BP se il difensore tiene un item rimovibile
  // Le Mega Stone non possono essere rimosse
  if (move === 'knock off' && defItemKey) {
    const isMegaStone = !!(ITEM_EFFECTS[defItemKey]?.megaStone)
    if (!isMegaStone) {
      terrainBP = Math.floor(terrainBP * 1.5)
    }
  }

  // ── Calcolo rolls (r = 85..100) ───────────────────────────────────────────
  const rolls = []

  // Base damage (fuori dal loop — identico per tutti i 16 roll)
  let baseDmg = Math.floor(
    Math.floor(
      Math.floor((2 * level) / 5 + 2) * terrainBP * atkStatFinal / defStatFinal
    ) / 50
  ) + 2

  // Spread: ×0.75 con pokeRound (half-up) come da formula Game Freak/Smogon
  // pokeRound(n * 3072 / 4096) = floor se fraz ≤ 0.5, ceil se fraz > 0.5
  if (isSpread && field.doubleTarget) {
    const raw = baseDmg * 3072 / 4096
    baseDmg = raw % 1 > 0.5 ? Math.ceil(raw) : Math.floor(raw)
  }

  for (let r = 85; r <= 100; r++) {
    let damage = baseDmg

    // Meteo
    if (field.weather === 'sun'  && moveType === TYPES.FIRE)  damage = Math.floor(damage * 1.5)
    if (field.weather === 'sun'  && moveType === TYPES.WATER) damage = Math.floor(damage * 0.5)
    if (field.weather === 'rain' && moveType === TYPES.WATER) damage = Math.floor(damage * 1.5)
    if (field.weather === 'rain' && moveType === TYPES.FIRE)  damage = Math.floor(damage * 0.5)

    // Critico
    if (field.crit) damage = Math.floor(damage * 1.5)

    // Roll random (85-100%)
    damage = Math.floor(damage * r / 100)

    // STAB
    if (stab > 1) damage = Math.floor(damage * stab)

    // Efficacia tipo
    damage = Math.floor(damage * effectiveness)

    // dmgMult: moltiplicatori di danno finale (es. Life Orb)
    // Applicato DOPO efficacia tipo — ordine Smogon
    // pokeRound: ceil se fraz > 0.5, floor altrimenti (identico a Smogon)
    if (atkItemEffect?.dmgMult) {
      const { num, den } = atkItemEffect.dmgMult
      const raw = damage * num / den
      damage = raw % 1 > 0.5 ? Math.ceil(raw) : Math.floor(raw)
    }

    // ── Moltiplicatori abilità difensore (post-efficacia, come da formula Gen6+) ─

    // Resist berry: ×0.5 se il tipo corrisponde e la mossa è SE
    if (defItemEffect?.resistBerry !== undefined && defItemEffect.resistBerry === moveType && effectiveness > 1) {
      damage = Math.floor(damage * 0.5)
    }

    // Filter / Solid Rock: ×0.75 su super effective
    if (defAbilEffect?.filter && effectiveness > 1) {
      damage = Math.floor(damage * 0.75)
    }

    // Thick Fat: ×0.5 da Fire e Ice
    if (defAbilEffect?.thickFat) {
      if (moveType === TYPES.FIRE || moveType === TYPES.ICE) {
        damage = Math.floor(damage * 0.5)
      }
    }

    // Fluffy: ×0.5 da contatto, ×2 da Fire (si moltiplicano: Fire+contatto = ×1.0 netto)
    if (defAbilEffect?.fluffy) {
      if (isContact)              damage = Math.floor(damage * 0.5)
      if (moveType === TYPES.FIRE) damage = Math.floor(damage * 2.0)
    }

    // Multiscale / Shadow Shield: ×0.5 danno ricevuto se HP pieni
    // Il toggle parte true di default — l'utente lo disattiva se il Pokémon è già danneggiato
    if (defAbilEffect?.multiscale && defAbilityFlags.multiscaleActive !== false) {
      damage = Math.floor(damage * 0.5)
    }

    // Flash Fire attaccante: ×1.5 Fire se il toggle è attivo
    // (l'immunità difensiva è già gestita sopra, prima del calcolo)
    if (atkAbilEffect?.flashFireImmune && atkAbilityFlags.flashFireActive && moveType === TYPES.FIRE) {
      damage = Math.floor(damage * 1.5)
    }

    // Schermi difensivi
    if (field.reflect     && !isSpecial) damage = Math.floor(damage * 0.5)
    if (field.lightScreen &&  isSpecial) damage = Math.floor(damage * 0.5)
    if (field.auroraVeil)               damage = Math.floor(damage * 0.5)

    // Helping Hand
    if (field.helpingHand) damage = Math.floor(damage * 1.5)

    rolls.push(damage)
  }

  const minDmg = rolls[0]
  const maxDmg = rolls[rolls.length - 1]
  const minPct = Math.floor(minDmg / defHP * 1000) / 10
  const maxPct = Math.floor(maxDmg / defHP * 1000) / 10

  // ── Log di debug ──────────────────────────────────────────────────────────
  // Costruito SOLO a debug acceso: le 15 stringhe interpolate costavano il
  // 52% del tempo di ogni chiamata (misurato), moltiplicato per ~576 chiamate
  // a render della tabella. A debug spento `log` resta null.
  //
  // Il disegno del pannello non è più qui: il motore pubblica il log sul bus
  // e DebugPanel.jsx lo renderizza in JSX. Nessun accesso al DOM da questo file.
  let log = null

  if (debug) {
    const terrainLabel = {
      electric: '⚡ Electric Terrain',
      grassy: '🌿 Grassy Terrain',
      misty: '🌫️ Misty Terrain',
      psychic: '🔮 Psychic Terrain',
    }

    log = [
      `📊 ${atkPokemon} → ${move} → ${defPokemon}`,
      `⚔️  Stat attacco: ${atkStatFinal} (base ${atkBase}, SP ${atkSPs[atkStatIdx]}, boost ${atkBoostVal > 0 ? '+' : ''}${atkBoostVal}, natura ${atkNature || 'neutra'})`,
      `🛡️  Stat difesa: ${defStatFinal} (base ${defBase}, SP ${defSPs[defStatIdx]}, boost ${defBoostVal > 0 ? '+' : ''}${defBoostVal}, natura ${defNature || 'neutra'})`,
      `❤️  HP difensore: ${defHP} (base ${getBaseStat(defPokemon, STAT_HP)}, SP ${defSPs[STAT_HP]})`,
      `💥 Potenza mossa: ${bp}${terrainBP !== bp ? ` → ${terrainBP} (terreno)` : ''}`,
      `🌍 Spread: ${isSpread ? (field.doubleTarget ? '×0.75 ✅' : 'mossa spread, ma single target ⚠️') : '❌'}`,
      `🎯 STAB: ${stab > 1 ? `×${stab} ✅` : '×1 ❌'}`,
      `🔥 Efficacia: ×${effectiveness}${effectiveness === 2 ? ' 🔥' : effectiveness === 4 ? ' 🔥🔥' : effectiveness === 0.5 ? ' ❄️' : ''}`,
      isContact ? `👊 Contatto: sì` : null,
      atkAbility ? `⚡ Abilità atk: ${atkAbility}` : null,
      defAbility ? `🛡️ Abilità def: ${defAbility}` : null,
      field.terrain ? `🌱 Terreno: ${terrainLabel[field.terrain] || field.terrain}` : null,
      field.weather ? `☀️ Meteo: ${field.weather}` : null,
      `🎲 Danno min: ${minDmg} (${minPct}%) | max: ${maxDmg} (${maxPct}%)`,
      `🎲 Rolls: ${rolls.join(', ')}`,
    ].filter(Boolean)

    publishDebugLog(log)
  }

  return { rolls, minDmg, maxDmg, minPct, maxPct, defHP, effectiveness, stab, log, atkBoostEffective, weatherBallType, effectiveBP, effectiveMoveType: moveType }
}