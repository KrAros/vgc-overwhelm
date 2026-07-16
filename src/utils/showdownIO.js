/**
 * src/utils/showdownIO.js
 * Funzioni pure per convertire tra il formato paste Showdown e
 * gli slot dello store. Non importano React, non hanno side effects.
 *
 * Esporta:
 *   parseShowdownPaste(text)  → { pokemon[], warnings[] }
 *   teamToShowdown(team)      → string
 */

import pokemonData   from '../data/pokemon.json'
import movesData     from '../data/moves.json'
import itemsData     from '../data/items.json'
import abilitiesData from '../data/abilities.json'
import { NATURES }   from '../data/natures.js'

const SP_TO_EV = (sp) => sp
const EV_TO_SP = (ev) => Math.min(32, ev)
const STAT_NAMES_SHOWDOWN = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']
const STAT_IDX = { HP: 0, Atk: 1, Def: 2, SpA: 3, SpD: 4, Spe: 5 }

// ─── Lookup helpers ───────────────────────────────────────────────────────────

function findPokemonKey(name) {
  const slug = name.trim().toLowerCase()
  if (pokemonData[slug]) return slug
  const dash = slug.replace(/\s+/g, '-')
  if (pokemonData[dash]) return dash
  return null
}

function findMoveKey(name) {
  const slug = name.trim().toLowerCase()
  if (movesData[slug]) return slug
  const spaced = slug.replace(/-/g, ' ')
  if (movesData[spaced]) return spaced
  return null
}

function findItemKey(name) {
  const slug = name.trim().toLowerCase()
  return itemsData[slug] ? slug : null
}

function findAbilityKey(name) {
  const slug = name.trim().toLowerCase()
  return abilitiesData[slug] ? slug : null
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parsa una paste Showdown completa (fino a 6 Pokémon separati da righe vuote).
 * Restituisce { pokemon: slot[], warnings: string[] }.
 * I slot hanno la stessa forma di emptyPokemon() nello store.
 */
export function parseShowdownPaste(paste) {
  const blocks = paste
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean)
    .slice(0, 6)

  const warnings = []
  const pokemon  = []

  for (const [blockIdx, block] of blocks.entries()) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) continue

    // Riga 1: "Nome @ Item"
    let pokeRawName = lines[0]
    let itemKey     = null

    if (lines[0].includes(' @ ')) {
      const [pokePart, itemPart] = lines[0].split(' @ ')
      pokeRawName = pokePart.trim()
      itemKey = findItemKey(itemPart.trim())
      if (!itemKey) warnings.push(`Slot ${blockIdx + 1}: item "${itemPart.trim()}" non trovato.`)
    }

    // Gestione nickname: "Nickname (NomePokémon) @ Item"
    const nicknameMatch = pokeRawName.match(/^.+\((.+)\)$/)
    if (nicknameMatch) pokeRawName = nicknameMatch[1].trim()

    const pokemonKey = findPokemonKey(pokeRawName)
    if (!pokemonKey) {
      warnings.push(`Slot ${blockIdx + 1}: Pokémon "${pokeRawName}" non trovato, saltato.`)
      continue
    }

    let abilityKey = null
    let nature     = null
    const sps      = [0, 0, 0, 0, 0, 0]
    const moves    = [null, null, null, null]
    let moveIdx    = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('Ability:')) {
        const raw = line.replace('Ability:', '').trim()
        abilityKey = findAbilityKey(raw)
        if (!abilityKey) warnings.push(`Slot ${blockIdx + 1}: abilità "${raw}" non trovata.`)

      } else if (line.startsWith('EVs:')) {
        line.replace('EVs:', '').trim().split('/').forEach(seg => {
          const m = seg.trim().match(/^(\d+)\s+(\w+)$/)
          if (m) {
            const idx = STAT_IDX[m[2]]
            if (idx !== undefined) sps[idx] = EV_TO_SP(parseInt(m[1], 10))
          }
        })

      } else if (line.endsWith(' Nature')) {
        const n = line.replace(' Nature', '').trim().toLowerCase()
        if (NATURES.includes(n)) nature = n
        else warnings.push(`Slot ${blockIdx + 1}: natura "${n}" non riconosciuta.`)

      } else if (line.startsWith('- ') && moveIdx < 4) {
        const raw     = line.slice(2).trim()
        const moveKey = findMoveKey(raw)
        if (moveKey) moves[moveIdx] = moveKey
        else warnings.push(`Slot ${blockIdx + 1}: mossa "${raw}" non trovata.`)
        moveIdx++
      }
      // IVs, Level, Shiny, Tera Type → ignorati (Champions format)
    }

    // Fallback abilità di default se non trovata nella paste
    if (!abilityKey) {
      abilityKey = pokemonData[pokemonKey]?.abilities?.[0] || null
    }

    pokemon.push({
      key: pokemonKey, moves, sps, nature,
      ability: abilityKey, item: itemKey,
      atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
      abilityFlags: {},
    })
  }

  return { pokemon, warnings }
}

// ─── Serializer ───────────────────────────────────────────────────────────────

function slotToShowdown(slot) {
  if (!slot?.key) return null
  const data = pokemonData[slot.key]
  if (!data) return null

  const displayName   = data.name || slot.key
  const itemDisplay   = slot.item
    ? (itemsData[slot.item]?.name || slot.item.replace(/\b\w/g, c => c.toUpperCase()))
    : null
  const line1 = itemDisplay ? `${displayName} @ ${itemDisplay}` : displayName

  const abilityDisplay = slot.ability
    ? (abilitiesData[slot.ability]?.name || slot.ability.replace(/\b\w/g, c => c.toUpperCase()))
    : 'None'

  const evParts = (slot.sps || [])
    .map((sp, i) => sp > 0 ? `${SP_TO_EV(sp)} ${STAT_NAMES_SHOWDOWN[i]}` : null)
    .filter(Boolean)

  const natureLine = slot.nature
    ? `${slot.nature.charAt(0).toUpperCase() + slot.nature.slice(1)} Nature`
    : null

  const moveLines = (slot.moves || [])
    .filter(Boolean)
    .map(moveKey => {
      const moveName = movesData[moveKey]?.name
        || moveKey.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return `- ${moveName}`
    })

  return [
    line1,
    `Ability: ${abilityDisplay}`,
    evParts.length ? `EVs: ${evParts.join(' / ')}` : null,
    natureLine,
    ...moveLines,
  ].filter(Boolean).join('\n')
}

/**
 * Serializza un team (array di 6 slot) in paste Showdown.
 */
export function teamToShowdown(team) {
  return team.map(slotToShowdown).filter(Boolean).join('\n\n')
}