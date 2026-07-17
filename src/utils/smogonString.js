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
import { NATURE_MODIFIERS } from '../data/natures'
import { TYPE_NAMES } from '../data/typeChart'
import { ABILITY_EFFECTS, normalizeAbilityKey } from '../data/abilityEffects'
import { ITEM_EFFECTS } from '../data/itemEffects'

// ─── Title Case helper ────────────────────────────────────────────────────────
// Capitalizza la prima lettera di ogni parola e dopo i trattini.
// Usata per i nomi di Pokémon, mosse, abilità e item nella stringa finale.
const _tc = s => s.replace(/(^|\s|-)\w/g, c => c.toUpperCase())

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
  const atkName  = _tc(atk.key.replace(/-/g, ' '))
  const defName  = _tc(def.key.replace(/-/g, ' '))
  const moveName = _tc(move.replace(/-/g, ' '))

  // Condizioni di campo in coda alla stringa
  const fieldParts = []

  if (field.weather && field.weather !== 'none') {
    const moveType = (TYPE_NAMES[moveData.type] || '').toLowerCase()
    const w = field.weather.toLowerCase()
    // Mostriamo il meteo solo quando influenza effettivamente la mossa:
    // Rain: boost Water, nerf Fire — Sun: boost Fire, nerf Water
    const weatherRelevant =
      (w === 'rain' || w === 'heavy rain')     && (moveType === 'water' || moveType === 'fire') ||
      (w === 'sun'  || w === 'harsh sunshine') && (moveType === 'fire'  || moveType === 'water')
    if (weatherRelevant) {
      const weatherMap = {
        sun: 'Sun', rain: 'Rain',
        'harsh sunshine': 'Harsh Sunshine', 'heavy rain': 'Heavy Rain',
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

  return (
    `${atkBoostStr}${atkSP}${natSymbol} ${statName}${atkAbilityStr}${atkItemStr} ` +
    `${atkName}${hhStr} ${moveName} vs. ` +
    `${defHPsp} HP / ${defBoostStr}${defSP} ${defStatName}${defItemStr} ${defName}${fieldStr}: ` +
    `${dmgStr}`
  )
}