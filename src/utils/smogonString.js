/**
 * src/utils/smogonString.js
 * Funzione pura che produce la stringa in formato Smogon/Showdown
 * da mostrare nel ReportPanel sotto ogni mossa.
 *
 * Esempio di output:
 *   252+ Atk Choice Band Garchomp Earthquake vs.
 *   252 HP / 4 Def Toxapex in Rain: 180-212 (59.2 - 69.7%)
 *
 * Non importa React, non ha side effects.
 *
 * Esporta:
 *   buildSmogonString(atk, def, move, result, field?) → string
 */

import movesData from '../data/moves.json'
import { calcEOT, calcKOChance } from '../lib/damage'

// ── Stringhe end-of-turn e Sitrus Berry (usate da ReportPanel) ───────────────
export const EOT_STRINGS = {
  sandstormDamage:   'sandstorm damage',
  leftoversRecovery: 'Leftovers recovery',
  sitrusRecovery:    'Sitrus Berry recovery',
  neutralize:        'si annullano',
  noKoIn6:           'No KO in 6 turns after',
  guaranteed:        'Guaranteed',
  chanceTo:          'chance to',
  after:             'after',
  sitrusActivates:   (healed, hp, maxHp) => `La Sitrus Berry si attiva! +${healed} HP → ${hp}/${maxHp} HP`,
  eotDelta:          (sign, delta, hp, maxHp) => `Fine turno: ${sign}${Math.abs(delta)} HP → ${hp}/${maxHp} HP`,
  turno:             (t) => `Turno ${t}:`,
  ko:                '→ KO',
}
import pokemonData from '../data/pokemon.json'
import { NATURE_MODIFIERS } from '../data/natures'
import { TYPE_NAMES, TYPES } from '../data/typeChart'
import { ABILITY_EFFECTS, normalizeAbilityKey } from '../data/abilityEffects'
import { ITEM_EFFECTS } from '../data/itemEffects'

// ─── Title Case helper ────────────────────────────────────────────────────────
// Capitalizza la prima lettera di ogni parola e dopo i trattini.
// Usata per i nomi di Pokémon, mosse, abilità e item nella stringa finale.
const _tc = s => s.replace(/(^|\s|-)\w/g, c => c.toUpperCase())

// Formatta il nome del Pokémon nello stile Smogon:
// - Forme Mega: "charizard-mega-y" → "Charizard-Mega-Y"
// - Forme con suffisso lettera singola: "basculegion-m" → "Basculegion" (Smogon omette -M/-F)
// - Tutto il resto: "tyranitar-mega" → "Tyranitar-Mega"
function _smogonName(key) {
  if (!key) return ''
  // Forme con -m o -f finale (es. basculegion-m, indeedee-f) → ometti il suffisso
  if (/-(m|f)$/.test(key)) {
    return _tc(key.replace(/-(m|f)$/, '').replace(/-/g, ' '))
  }
  // Forme Mega e altre forme speciali: mantieni i trattini
  return key.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('-')
}

// ─── Whitelist abilità attaccante ─────────────────────────────────────────────
// Costruita dinamicamente dal flag showInSmogon in abilityEffects.js.
// Per aggiungere una nuova abilità alla stringa è sufficiente mettere
// showInSmogon: true nella sua voce — niente da toccare qui.
const ATK_ABILITY_WHITELIST = new Set(
  Object.entries(ABILITY_EFFECTS)
    .filter(([, v]) => v.showInSmogon)
    .map(([k]) => k)
)

// ─── Whitelist item attaccante ────────────────────────────────────────────────
// Stesso meccanismo: showInSmogon: true in itemEffects.js.
const ATK_ITEM_WHITELIST = new Set(
  Object.entries(ITEM_EFFECTS)
    .filter(([, v]) => v.showInSmogon)
    .map(([k]) => k)
)

// ─── Whitelist item difensore ─────────────────────────────────────────────────
// Item che riducono il danno ricevuto e vengono mostrati nella stringa difensiva.
// Questa rimane hardcoded: gli item difensivi (Assault Vest, Eviolite, berry
// di resistenza) non hanno un effetto offensivo, quindi non entrano in
// itemEffects.js come showInSmogon. Se ne aggiungi, metti qui.
const DEF_ITEM_WHITELIST = new Set([
  'assault vest', 'eviolite',
  'occa berry', 'passho berry', 'wacan berry', 'rindo berry', 'yache berry',
  'chople berry', 'kebia berry', 'shuca berry', 'coba berry', 'payapa berry',
  'tanga berry', 'charti berry', 'kasib berry', 'haban berry', 'colbur berry',
  'babiri berry', 'chilan berry', 'roseli berry', 'luminous moss',
])

// ─── buildSmogonString ────────────────────────────────────────────────────────
/**
 * Produce la stringa in formato Smogon per una singola mossa.
 *
 * @param {object} atk      - Slot attaccante dallo store
 * @param {object} def      - Slot difensore dallo store
 * @param {string} move     - Slug della mossa (es. 'earthquake', 'body-press')
 * @param {object} result   - Output di calculateDamage()
 * @param {object} [field]  - Condizioni di campo (weather, terrain, screens…)
 * @returns {string}
 */
export function buildSmogonString(atk, def, move, result, field = {}) {
  const moveData = movesData[move]
  if (!moveData) return ''

  const isSpecial   = moveData.category === 1
  // Body Press usa la Def dell'attaccante come stat d'attacco
  const isBodyPress = moveData.useDefAsStat === true
  const atkStatIdx  = isSpecial ? 3 : (isBodyPress ? 2 : 1)
  const defStatIdx  = isSpecial ? 4 : 2

  // SP dell'attaccante sulla stat rilevante, SP HP e difensivi del difensore
  const atkSP   = atk.sps?.[atkStatIdx] || 0
  const defSP   = def.sps?.[defStatIdx]  || 0
  const defHPsp = def.sps?.[0] || 0

  // Simbolo natura attaccante (+/-) sulla stat d'attacco
  const nature    = atk.nature
  const mod       = nature && NATURE_MODIFIERS[nature]
  const isBoost   = mod && mod[0] !== 0 && mod[0] === atkStatIdx
  const isDrop    = mod && mod[0] !== 0 && mod[1] === atkStatIdx
  const natSymbol = isBoost ? '+' : isDrop ? '-' : ''

  // Nomi delle stat (per leggibilità nella stringa)
  const statName    = isSpecial ? 'SpA' : (isBodyPress ? 'Def' : 'Atk')
  const defStatName = isSpecial ? 'SpD' : 'Def'

  // Boost attaccante — usa il valore effettivo post-Defiant/Contrary se disponibile
  const atkBoostVal = result?.atkBoostEffective !== undefined
    ? result.atkBoostEffective
    : isSpecial ? (atk.spAtkBoost || 0) : (atk.atkBoost || 0)
  const atkBoostStr = atkBoostVal > 0 ? `+${atkBoostVal} ` : atkBoostVal < 0 ? `${atkBoostVal} ` : ''

  // Boost difensore
  const defBoostVal = isSpecial ? (def.spDefBoost || 0) : (def.defBoost || 0)
  const defBoostStr = defBoostVal > 0 ? `+${defBoostVal} ` : defBoostVal < 0 ? `${defBoostVal} ` : ''

  // Abilità attaccante — mostrata solo se in whitelist
  // Flash Fire richiede anche che il flag sia attivo (toggle manuale)
  const atkAbilityKey = normalizeAbilityKey(atk.ability)
  const showAtkAbility = atkAbilityKey && ATK_ABILITY_WHITELIST.has(atkAbilityKey) &&
    (atkAbilityKey !== 'flash-fire' || atk.abilityFlags?.flashFireActive)
  const atkAbilityStr = showAtkAbility ? ` ${_tc(atk.ability)}` : ''

  // Item attaccante — mostrato solo se in whitelist
  const atkItemKey = atk.item?.toLowerCase()
  const showAtkItem = atkItemKey && ATK_ITEM_WHITELIST.has(atkItemKey)
  const atkItemStr = showAtkItem ? ` ${_tc(atk.item)}` : ''

  // Item difensore — mostrato solo se riduce il danno
  const defItemKey = def.item?.toLowerCase()
  const showDefItem = defItemKey && DEF_ITEM_WHITELIST.has(defItemKey)
  const defItemStr = showDefItem ? ` ${_tc(def.item)}` : ''

  // Helping Hand
  const hhStr = field.helpingHand ? ' Helping Hand' : ''

  // Nomi Pokémon e mossa in Title Case
  const atkName  = _smogonName(atk.key)
  const defName  = _smogonName(def.key)

  // Weather Ball: nome con BP e tipo espliciti
  // result.weatherBallType è l'indice tipo se il meteo è attivo, null altrimenti
  let moveName = _tc(move.replace(/-/g, ' '))
  if (move === 'weather ball') {
    const wbTypeName = result.weatherBallType !== null && result.weatherBallType !== undefined
      ? (TYPE_NAMES[result.weatherBallType] || 'Normal')
      : 'Normal'
    const wbBP = result.effectiveBP ?? 50
    moveName = `Weather Ball (${wbBP} BP ${wbTypeName})`
  }
  if (move === 'last respects' && result.effectiveBP) {
    moveName = `Last Respects (${result.effectiveBP} BP)`
  }

  // Condizioni di campo in coda alla stringa
  const fieldParts = []

  if (field.weather && field.weather !== 'none') {
    // Usa il tipo effettivo della mossa (Weather Ball cambia tipo con il meteo)
    const effectiveType = result.weatherBallType !== null && result.weatherBallType !== undefined
      ? result.weatherBallType
      : moveData.type
    const moveType = (TYPE_NAMES[effectiveType] || '').toLowerCase()
    const w = field.weather.toLowerCase()

    // Tipi del difensore letti dal pokemonData (array di indici numerici)
    const defPokeTypes = pokemonData[def.key]?.type || []

    // Offensivo: Rain booста Water/nerf Fire, Sun booста Fire/nerf Water
    const offensiveRelevant =
      (w === 'rain' || w === 'heavy rain')     && (moveType === 'water' || moveType === 'fire') ||
      (w === 'sun'  || w === 'harsh sunshine') && (moveType === 'fire'  || moveType === 'water')

    // Difensivo: Sand booста SpD di Rock/Steel/Ground — mostrato se la mossa è speciale
    // (allineato a calcEngine.js che applica il bonus a questi tre tipi)
    const sandDefRelevant =
      (w === 'sand' || w === 'sandstorm') &&
      defPokeTypes.includes(TYPES.ROCK) &&
      moveData.category === 1

    const weatherRelevant = offensiveRelevant || sandDefRelevant

    if (weatherRelevant) {
      const weatherMap = {
        sun: 'Sun', rain: 'Rain', sand: 'Sand', sandstorm: 'Sand',
        'harsh sunshine': 'Harsh Sunshine', 'heavy rain': 'Heavy Rain', snow: 'Snow',
      }
      fieldParts.push(`in ${weatherMap[w] || _tc(field.weather)}`)
    }
  }

  if (field.terrain && field.terrain !== 'none') {
    const terrainMap = {
      electric: 'Electric Terrain', grassy: 'Grassy Terrain',
      misty: 'Misty Terrain', psychic: 'Psychic Terrain',
    }
    fieldParts.push(`in ${terrainMap[field.terrain] || _tc(field.terrain)}`)
  }

  const screenParts = []
  if (field.reflect)     screenParts.push('Reflect')
  if (field.lightScreen) screenParts.push('Light Screen')
  if (field.auroraVeil)  screenParts.push('Aurora Veil')
  if (screenParts.length) fieldParts.push(`through ${screenParts.join(' and ')}`)

  const fieldStr = fieldParts.length ? ` ${fieldParts.join(' ')}` : ''

  // Range danni grezzi
  const dmgStr = `${result.minDmg}-${result.maxDmg} (${result.minPct} - ${result.maxPct}%)`

  // Crit
  const critStr = field.crit ? ' on a critical hit' : ''

  // EOT suffix — sandstorm damage e/o leftovers recovery (formato standard Smogon)
  const defPokeData2 = pokemonData[def.key]
  const defTypes2 = defPokeData2?.type || []
  const defHP2 = result.defHP
  const rolls2 = result.rolls
  const { sandDmgHP: sandDmg2, leftoversHP: leftHP2, eotNet } = calcEOT(def, defHP2, field.weather, defTypes2)

  let eotSuffix = ''
  if (result.minPct < 100) {
    if (eotNet !== 0) {
      const eotParts = []
      if (sandDmg2 > 0) eotParts.push('sandstorm damage')
      if (leftHP2 > 0)  eotParts.push('Leftovers recovery')
      const condStr2 = eotParts.join(' and ')
      for (let hits = 2; hits <= 6; hits++) {
        const prob = calcKOChance(rolls2, defHP2, eotNet, hits)
        if (prob > 0.0001) {
          const pct = Math.round(prob * 1000) / 10
          if (prob >= 0.9999) eotSuffix = ` -- guaranteed ${hits}HKO after ${condStr2}`
          else eotSuffix = ` -- ${pct}% chance to ${hits}HKO after ${condStr2}`
          break
        }
      }
      if (!eotSuffix && condStr2) eotSuffix = ` -- after ${condStr2}`
    } else {
      for (let hits = 2; hits <= 6; hits++) {
        const prob = calcKOChance(rolls2, defHP2, 0, hits)
        if (prob > 0.0001) {
          const pct = Math.round(prob * 1000) / 10
          if (prob >= 0.9999) eotSuffix = ` -- guaranteed ${hits}HKO`
          else eotSuffix = ` -- ${pct}% chance to ${hits}HKO`
          break
        }
      }
    }
  }

  return (
    `${atkBoostStr}${atkSP}${natSymbol} ${statName}${atkAbilityStr}${atkItemStr} ` +
    `${atkName}${hhStr} ${moveName} vs. ` +
    `${defHPsp} HP / ${defBoostStr}${defSP} ${defStatName}${defItemStr} ${defName}${fieldStr}${critStr}: ` +
    `${dmgStr}${eotSuffix}`
  )
}