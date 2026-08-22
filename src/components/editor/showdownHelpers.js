// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import pokemonData from '../../data/pokemon.json'
import movesData   from '../../data/moves.json'
import itemsData   from '../../data/items.json'
import abilitiesData from '../../data/abilities.json'
import { NATURES } from '../../data/natures.js'
import { abilitaPerSpecie } from '../../lib/abilitaSpecie.js'

const STAT_NAMES_SHOWDOWN = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']
const SP_TO_EV = (sp) => sp
const EV_TO_SP = (ev) => Math.min(32, ev)

// ─── Showdown helpers (singolo Pokémon) ───────────────────────────────────────

/**
 * Converte uno slot store → blocco testo Showdown per un singolo Pokémon.
 */
export function slotToShowdown(slot) {
  if (!slot?.key) return null
  const data = pokemonData[slot.key]
  if (!data) return null

  const displayName = data.name || slot.key

  const itemDisplay = slot.item
    ? (itemsData[slot.item]?.name || slot.item.replace(/\b\w/g, c => c.toUpperCase()))
    : null
  const line1 = itemDisplay ? `${displayName} @ ${itemDisplay}` : displayName

  const abilityDisplay = slot.ability
    ? (abilitiesData[slot.ability]?.name || slot.ability.replace(/\b\w/g, c => c.toUpperCase()))
    : 'None'
  const abilityLine = `Ability: ${abilityDisplay}`

  const evParts = (slot.sps || [])
    .map((sp, i) => sp > 0 ? `${SP_TO_EV(sp)} ${STAT_NAMES_SHOWDOWN[i]}` : null)
    .filter(Boolean)
  const evsLine = evParts.length > 0 ? `EVs: ${evParts.join(' / ')}` : null

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

  return [line1, abilityLine, evsLine, natureLine, ...moveLines]
    .filter(Boolean)
    .join('\n')
}

/**
 * Parsa un blocco Showdown di un singolo Pokémon → oggetto slot store.
 * Restituisce { slot, warnings }.
 */
export function showdownToSlot(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return { slot: null, warnings: ['Empty text.'] }

  const warnings = []
  const STAT_IDX = { HP: 0, Atk: 1, Def: 2, SpA: 3, SpD: 4, Spe: 5 }

  // Riga 1: nome @ item
  let pokeRawName = lines[0]
  let itemKey = null
  if (lines[0].includes(' @ ')) {
    const [pokePart, itemPart] = lines[0].split(' @ ')
    pokeRawName = pokePart.trim()
    const itemSlug = itemPart.trim().toLowerCase()
    itemKey = itemsData[itemSlug] ? itemSlug : null
    if (!itemKey) warnings.push(`Item "${itemPart.trim()}" not found, skipped.`)
  }

  // Gestione nickname "(Venusaur)"
  const nicknameMatch = pokeRawName.match(/^.+\((.+)\)$/)
  if (nicknameMatch) pokeRawName = nicknameMatch[1].trim()

  const pokeSlug = pokeRawName.toLowerCase()
  const pokeDashSlug = pokeSlug.replace(/\s+/g, '-')
  let pokemonKey = pokemonData[pokeSlug] ? pokeSlug
    : pokemonData[pokeDashSlug] ? pokeDashSlug
    : null
  if (!pokemonKey) {
    if (pokeDashSlug.endsWith('-f')) {
      const withF = pokeDashSlug.slice(0, -2) + 'f'
      if (pokemonData[withF]) pokemonKey = withF
    } else if (pokeDashSlug.endsWith('-m')) {
      const withoutM = pokeDashSlug.slice(0, -2)
      if (pokemonData[withoutM]) pokemonKey = withoutM
    }
  }

  if (!pokemonKey) {
    return { slot: null, warnings: [`Pokémon "${pokeRawName}" not found.`] }
  }

  let abilityKey = null
  let nature = null
  const sps = [0, 0, 0, 0, 0, 0]
  const moves = [null, null, null, null]
  let moveIdx = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('Ability:')) {
      const rawAbility = line.replace('Ability:', '').trim().toLowerCase()
      abilityKey = abilitiesData[rawAbility] ? rawAbility : null
      if (!abilityKey) warnings.push(`Abilità "${rawAbility}" non trovata, ignorata.`)

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
      else warnings.push(`Nature "${n}" not recognized.`)

    } else if (line.startsWith('- ') && moveIdx < 4) {
      const rawMove = line.slice(2).trim().toLowerCase()
      const moveSpaced = rawMove.replace(/-/g, ' ')
      const moveKey = movesData[rawMove] ? rawMove
        : movesData[moveSpaced] ? moveSpaced
        : null
      if (moveKey) moves[moveIdx] = moveKey
      else warnings.push(`Mossa "${line.slice(2).trim()}" non trovata, ignorata.`)
      moveIdx++
    }
    // IVs, Level, Shiny, Tera Type → ignorati (Champions format)
  }

  // La regola sta in `lib/abilitaSpecie.js`, una sola per tutta l'app.
  //
  // Qui ce n'era una PIÙ STRETTA: forzava la prima abilità solo quando la
  // specie ne aveva esattamente una. Le Mega erano coperte, ma una specie con
  // due abilità accettava anche una terza, impossibile. Funzionava dove serviva
  // di più e taceva altrove.
  abilityKey = abilitaPerSpecie(pokemonKey, abilityKey)

  return {
    slot: { key: pokemonKey, moves, sps, nature, ability: abilityKey, item: itemKey,
            atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
            abilityFlags: {} },
    warnings,
  }
}