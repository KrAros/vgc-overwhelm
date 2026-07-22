import { useState } from 'react'
import { calcFinalStat, STAT_NAMES } from '../utils/statCalc'
import pokemonData from '../data/pokemon.json'
import movesData   from '../data/moves.json'
import itemsData   from '../data/items.json'
import abilitiesData from '../data/abilities.json'
import useCalcStore from '../store/useCalcStore'
import { NATURES, NATURE_MODIFIERS } from '../data/natures.js'
import { TYPE_NAMES, TYPE_COLORS } from '../data/typeChart.js'
import { spriteUrl, fallbackSpriteUrl } from '../utils/sprite'
import { PRESETS_BY_SLUG } from '../data/metaPresets'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'

const ALL_POKEMON = Object.keys(pokemonData).sort()
const ALL_MOVES   = Object.keys(movesData).sort()
const ALL_ITEMS   = Object.keys(itemsData).sort()

const BOOST_NUM = [2,2,2,2,2,2,1,3,4,5,6,7,8]
const BOOST_DEN = [8,7,6,5,4,3,1,2,2,2,2,2,2]

const SP_TO_EV = (sp) => sp
const STAT_NAMES_SHOWDOWN = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']
const EV_TO_SP = (ev) => Math.min(32, ev)

// ─── PresetSelect ─────────────────────────────────────────────────────────────
/**
 * Dropdown compatto che mostra i preset meta disponibili.
 * Se il Pokémon nello slot è già uno di quelli con preset, filtra la lista
 * a quei soli preset. Altrimenti mostra tutti i preset in ordine alfabetico.
 * Al cambio applica il preset e resetta il select a "— Preset —".
 */
function PresetSelect({ team, index, currentSlug }) {
  const setPokemon = useCalcStore(s => s.setPokemon)
  const setNature  = useCalcStore(s => s.setNature)
  const setItem    = useCalcStore(s => s.setItem)
  const setAbility = useCalcStore(s => s.setAbility)
  const setSPs     = useCalcStore(s => s.setSPs)
  const setMove    = useCalcStore(s => s.setMove)

  // Mappa slug → preset selezionato, così ogni Pokémon ricorda la sua scelta
  // e cambiando Pokémon si riparte automaticamente da Blank Set
  const [selectedMap, setSelectedMap] = useState({})
  const selected = selectedMap[currentSlug] ?? '__blank__'
  const setSelected = (value) => setSelectedMap(prev => ({ ...prev, [currentSlug]: value }))

  // Normalizza slug mossa: trattini → spazi (formato moves.json)
  const normalizeMove = (m) => m ? m.replace(/-/g, ' ') : null

  const dedicatedPresets = currentSlug && PRESETS_BY_SLUG[currentSlug]
    ? PRESETS_BY_SLUG[currentSlug]
    : null

  const presets = dedicatedPresets ?? []

  function applyPreset(value) {
    if (!value) return
    setSelected(value)
    if (value === '__blank__') {
      if (currentSlug) setPokemon(team, index, currentSlug)
      setNature(team, index, null)
      setItem(team, index, null)
      setAbility(team, index, null)
      setSPs(team, index, [0, 0, 0, 0, 0, 0])
      ;[0,1,2,3].forEach(mi => setMove(team, index, mi, null))
      return
    }
    const preset = presets.find(p => p.label === value)
    if (!preset) return
    setPokemon(team, index, preset.slug)
    setNature(team, index, preset.nature.toLowerCase())
    setItem(team, index, preset.item)
    setAbility(team, index, preset.ability)
    setSPs(team, index, preset.sps)
    preset.moves.forEach((m, mi) => setMove(team, index, mi, normalizeMove(m)))
  }

  return (
    <select
      value={selected}
      onChange={e => applyPreset(e.target.value)}
      className="w-full bg-gray-700 text-xs text-gray-300 rounded px-2 py-1 outline-none border border-gray-600 cursor-pointer"
      title="Carica preset meta"
    >
      <option value="__blank__">Blank Set</option>
      {presets.map(p => (
        <option key={p.label} value={p.label}>{p.label}</option>
      ))}
    </select>
  )
}

// ─── Showdown helpers (singolo Pokémon) ───────────────────────────────────────

/**
 * Converte uno slot store → blocco testo Showdown per un singolo Pokémon.
 */
function slotToShowdown(slot) {
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
function showdownToSlot(text) {
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

  // Se il Pokémon ha abilità di default, usala come fallback
  // Se il Pokémon ha una sola abilità possibile (es. forme Mega), forza quella
  // indipendentemente da quanto scritto nel paste — il paste Showdown riporta
  // l'abilità pre-mega che è sbagliata per il calcolo
  const pokeAbilities = pokemonData[pokemonKey]?.abilities || []
  if (pokeAbilities.length === 1) {
    abilityKey = pokeAbilities[0]
  } else if (!abilityKey) {
    if (pokeAbilities[0]) abilityKey = pokeAbilities[0]
  }

  return {
    slot: { key: pokemonKey, moves, sps, nature, ability: abilityKey, item: itemKey,
            atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
            abilityFlags: {} },
    warnings,
  }
}

// ─── StatRow ─────────────────────────────────────────────────────────────────

function StatRow({ statIdx, base, sp, level, nature, boostVal, onSpChange, onBoostChange, speedWeatherActive }) {
  const finalStat = calcFinalStat(base, sp, level, nature, statIdx)

  // Abilità meteo-velocità: raddoppiano la Spe sotto il meteo corrispondente
  const speedBase = speedWeatherActive && statIdx === 5 ? finalStat * 2 : null
  const effectiveStat = speedBase ?? finalStat

  const boostedStat = boostVal !== 0
    ? Math.floor(effectiveStat * BOOST_NUM[6 + boostVal] / BOOST_DEN[6 + boostVal])
    : speedBase  // se nessun boost ma abilità meteo attiva, mostra il valore ×2

  const mod = nature && NATURE_MODIFIERS[nature]
  const isBoost = mod && mod[0] !== 0 && mod[0] === statIdx
  const isDrop  = mod && mod[0] !== 0 && mod[1] === statIdx

  const statColor  = isBoost ? 'text-red-400' : isDrop ? 'text-blue-400' : 'text-gray-200'
  const boostColor = boostVal > 0 ? 'text-green-400' : boostVal < 0 ? 'text-red-400' : 'text-gray-500'
  const hasBoost = statIdx !== 0

  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs text-gray-500 w-8 text-center">{STAT_NAMES[statIdx]}</span>
      <span className="text-xs text-gray-400 w-7 text-center">{base}</span>
      <input
        type="range" min="0" max="32" value={sp}
        onChange={e => onSpChange(parseInt(e.target.value))}
        className="flex-1 h-1 accent-teal-400"
      />
      {(isBoost || isDrop) && (
        <span className={`text-[10px] font-bold shrink-0 ml-1 ${isBoost ? 'text-red-400' : 'text-blue-400'}`}>
          {isBoost ? '▲ +10%' : '▼ -10%'}
        </span>
      )}
      <input
        type="number" min="0" max="32" value={sp}
        onChange={e => onSpChange(Math.min(32, Math.max(0, parseInt(e.target.value) || 0)))}
        className="w-11 bg-gray-700 text-white text-xs rounded px-1 py-0.5 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className={`text-xs font-medium w-8 text-center ${statColor}`}>
        {finalStat}
      </span>
      {hasBoost ? (
        <>
          <select
            value={boostVal}
            onChange={e => onBoostChange(parseInt(e.target.value))}
            className={`w-12 bg-gray-700 text-xs rounded px-0.5 py-0.5 outline-none text-center ${boostColor}`}
          >
            {[-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6].map(v => (
              <option key={v} value={v}>{v > 0 ? `+${v}` : v}</option>
            ))}
          </select>
          <span className={`text-xs w-8 text-center ${boostedStat ? (speedBase || boostVal > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-600'}`}>
            {boostedStat ?? '—'}
          </span>
        </>
      ) : (
        <>
          <div className="w-12" aria-hidden="true" />
          <div className="w-8"  aria-hidden="true" />
        </>
      )}
    </div>
  )
}

// ─── PokemonSearch ────────────────────────────────────────────────────────────

function PokemonSearch({ value, onChange }) {
  const [query, setQuery]   = useState('')
  const [focused, setFocused] = useState(false)
  const [open, setOpen]     = useState(false)

  const filtered = query.length >= 2
    ? ALL_POKEMON.filter(p => p.includes(query.toLowerCase())).slice(0, 20)
    : []

  const hasValue = focused ? query.length > 0 : !!value

  const handleClear = (e) => {
    e.preventDefault()
    setQuery('')
    onChange('')
    setOpen(false)
  }

  return (
    <div className="relative flex items-center">
      <input
        className="w-full bg-gray-700 text-xs text-white rounded pl-2 pr-7 py-1 outline-none capitalize border border-gray-600"
        placeholder="Search Pokémon..."
        value={focused ? query : (value || '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setFocused(true); setQuery(''); setOpen(true) }}
        onBlur={() => {
          setTimeout(() => { setFocused(false); setOpen(false); setQuery('') }, 150)
        }}
      />
      {hasValue && (
        <button
          type="button"
          onMouseDown={handleClear}
          className="absolute right-2 text-gray-400 hover:text-white text-xs font-bold focus:outline-none"
        >
          ✕
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full top-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-48 overflow-y-auto">
          {filtered.map(p => (
            <div
              key={p}
              className="px-2 py-1 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer capitalize"
              onMouseDown={() => { onChange(p); setQuery(''); setOpen(false) }}
            >
              {p}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MoveSearch ───────────────────────────────────────────────────────────────

function MoveSearch({ value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [open, setOpen]   = useState(false)

  const weather = useCalcStore(s => s.weather)

  const filtered = query.length >= 2
    ? ALL_MOVES.filter(m => m.includes(query.toLowerCase())).slice(0, 20)
    : []

  const moveDetails = movesData[value]

  // Weather Ball: tipo e BP cambiano col meteo
  const WEATHER_BALL_TYPES = {
    rain: 2, 'heavy rain': 2,
    sun: 1,  'harsh sunshine': 1,
    sand: 12, sandstorm: 12,
    snow: 5,  hail: 5,
  }
  const isWeatherBall = value === 'weather ball'
  const wbWeatherKey = weather ? weather.toLowerCase() : null
  const wbTypeIdx = isWeatherBall && wbWeatherKey && WEATHER_BALL_TYPES[wbWeatherKey] !== undefined
    ? WEATHER_BALL_TYPES[wbWeatherKey]
    : null
  const displayType = isWeatherBall && wbTypeIdx !== null ? wbTypeIdx : moveDetails?.type
  const displayBP   = isWeatherBall && wbTypeIdx !== null ? 100 : moveDetails?.power

  const categoryTitles = { 0: 'Fisico', 1: 'Speciale', 2: 'Stato' }

  return (
    <div className="bg-gray-700/40 p-1.5 rounded border border-gray-700/60 flex items-center justify-between gap-2 h-9">
      <div className="flex-1 relative">
        <input
          className={`w-full bg-gray-700 text-xs rounded px-2 py-1 outline-none capitalize ${
            value && !focused ? 'text-white' : 'text-gray-300'
          }`}
          placeholder={focused ? placeholder : (value ? value.replace(/-/g, ' ') : placeholder)}
          value={focused ? query : (value ? value.replace(/-/g, ' ') : '')}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setFocused(true); setQuery(''); setOpen(true) }}
          onBlur={() => { setTimeout(() => { setFocused(false); setOpen(false); setQuery('') }, 150) }}
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-40 overflow-y-auto shadow-xl">
            {filtered.map(m => (
              <div
                key={m}
                className="px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer capitalize"
                onMouseDown={() => { onChange(m); setQuery(''); setOpen(false) }}
              >
                {m.replace(/-/g, ' ')}
              </div>
            ))}
          </div>
        )}
      </div>
      {moveDetails && (
        <div className="flex items-center gap-2 shrink-0 pl-1">
          <span className="text-xs font-mono font-bold text-gray-300 text-right">
            {displayBP && displayBP > 0 ? displayBP : '—'}
          </span>
          <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded-[3px] shadow-sm shrink-0 ${
            TYPE_COLORS[TYPE_NAMES[displayType]] || 'bg-gray-600 text-white'
          }`}>
            {TYPE_NAMES[displayType]}
          </span>
          <span className="flex items-center justify-center shrink-0 w-4 h-4" title={categoryTitles[moveDetails.category] || 'Status'}>
            {moveDetails.category === 1 ? (
              <img src="https://i.pokebase.app/Xa6ark97i7hjvEdKKIJjx.png" alt="Speciale" className="h-4 w-auto object-contain inline-block" />
            ) : moveDetails.category === 0 ? (
              <img src="https://i.pokebase.app/u-Uv6ZGd0yirOf1cCnovO.png" alt="Fisico" className="h-4 w-auto object-contain inline-block" />
            ) : (
              <img src="https://i.pokebase.app/4auqtYtIdMdzjIaRYEGNJ.png" alt="Stato" className="h-4 w-auto object-contain inline-block" />
            )}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── ItemSearch ───────────────────────────────────────────────────────────────

function ItemSearch({ value, onChange }) {
  const [query, setQuery]   = useState('')
  const [focused, setFocused] = useState(false)
  const [open, setOpen]     = useState(false)

  const filtered = query.length >= 2
    ? ALL_ITEMS.filter(i => i.includes(query.toLowerCase())).slice(0, 20)
    : []

  const hasValue = focused ? query.length > 0 : !!value

  const handleClear = (e) => {
    e.preventDefault()
    setQuery('')
    onChange(null)
    setOpen(false)
  }

  return (
    <div className="relative flex items-center">
      <input
        className="w-full bg-gray-700 text-xs text-white rounded pl-2 pr-7 py-1 outline-none capitalize border border-gray-600"
        placeholder="Search item..."
        value={focused ? query : (value ? value.replace(/-/g, ' ') : '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setFocused(true); setQuery(''); setOpen(true) }}
        onBlur={() => setTimeout(() => { setFocused(false); setOpen(false); setQuery('') }, 150)}
      />
      {hasValue && (
        <button
          type="button"
          onMouseDown={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold focus:outline-none"
        >
          ✕
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full top-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-40 overflow-y-auto">
          {filtered.map(i => (
            <div
              key={i}
              className="px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer capitalize"
              onMouseDown={() => { onChange(i); setQuery(''); setOpen(false) }}
            >
              {i.replace(/-/g, ' ')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── AbilitySelect ────────────────────────────────────────────────────────────

function AbilitySelect({ value, abilities, onChange }) {
  const options = abilities && abilities.length > 0 ? abilities : (value ? [value] : [])
  return (
    <select
      className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none capitalize"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(a => (
        <option key={a} value={a}>{a.replace(/-/g, ' ')}</option>
      ))}
    </select>
  )
}

// ─── AbilityFlags ─────────────────────────────────────────────────────────────

function AbilityFlags({ ability, flags, opponentHasIntimidateActive, onFlagChange, weather }) {
  const key = (ability || '').toLowerCase()

  const SPEED_WEATHER_MAP = {
    'sand-rush':   ['sand', 'sandstorm'],
    'chlorophyll': ['sun', 'harsh sunshine'],
    'swift-swim':  ['rain', 'heavy rain'],
    'slush-rush':  ['snow', 'hail'],
  }
  const speedWeatherConditions = SPEED_WEATHER_MAP[key] || []
  const speedWeatherActive = speedWeatherConditions.includes((weather || '').toLowerCase())

  if (SPEED_WEATHER_MAP[key]) {
    const fx = ABILITY_EFFECTS[key]
    return (
      <div className={`mt-1 px-1 py-1 rounded text-xs border ${
        speedWeatherActive
          ? 'bg-green-950/40 border-green-700/40 text-green-300'
          : 'bg-gray-800/60 border-gray-700/40 text-gray-500'
      }`}>
        {speedWeatherActive ? `⚡ ${fx?.descOn}` : `💡 ${fx?.descOff}`}
      </div>
    )
  }



  if (key === 'flash-fire') {
    const fx = ABILITY_EFFECTS[key]
    return (
      <div className="flex items-center gap-2 mt-1 px-1 py-1 bg-red-950/30 border border-red-800/30 rounded text-xs">
        <button
          type="button"
          onClick={() => onFlagChange('flashFireActive', !flags.flashFireActive)}
          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
            flags.flashFireActive ? 'bg-red-500' : 'bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
            flags.flashFireActive ? 'left-4' : 'left-0.5'
          }`} />
        </button>
        <span className={flags.flashFireActive ? 'text-red-300' : 'text-gray-500'}>
          {flags.flashFireActive ? fx.descOn : fx.descOff}
        </span>
      </div>
    )
  }

  if (key === 'multiscale' || key === 'shadow-shield') {
    const fx = ABILITY_EFFECTS[key]
    return (
      <div className="flex items-center gap-2 mt-1 px-1 py-1 bg-blue-950/30 border border-blue-800/30 rounded text-xs">
        <button
          type="button"
          onClick={() => onFlagChange('multiscaleActive', !flags.multiscaleActive)}
          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
            flags.multiscaleActive ? 'bg-blue-500' : 'bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
            flags.multiscaleActive ? 'left-4' : 'left-0.5'
          }`} />
        </button>
        <span className={flags.multiscaleActive ? 'text-blue-300' : 'text-gray-500'}>
          {flags.multiscaleActive ? fx.descOn : fx.descOff}
        </span>
      </div>
    )
  }

  if (key === 'supreme-overlord') {
    const kos  = flags.supremeOverlordKOs || 0
    const mult = (1 + kos * 0.1).toFixed(1)
    return (
      <div className="flex items-center gap-2 mt-1 px-1 py-1 bg-purple-950/30 border border-purple-800/30 rounded text-xs">
        <span className="text-gray-400 shrink-0">Alleati KO:</span>
        <div className="flex gap-1">
          {[0,1,2,3,4,5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onFlagChange('supremeOverlordKOs', n)}
              className={`w-5 h-5 rounded text-[10px] font-bold transition-colors ${
                kos === n ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className={kos > 0 ? 'text-purple-300' : 'text-gray-500'}>
          {kos > 0 ? `×${mult} Atk/SpAtk` : 'nessun boost'}
        </span>
      </div>
    )
  }

  if (key === 'intimidate') {
    const fx = ABILITY_EFFECTS[key]
    return (
      <div className="flex items-center gap-2 mt-1 px-1 py-1 bg-yellow-950/30 border border-yellow-800/30 rounded text-xs">
        <button
          type="button"
          onClick={() => onFlagChange('intimidateActive', !flags.intimidateActive)}
          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
            flags.intimidateActive ? 'bg-yellow-500' : 'bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
            flags.intimidateActive ? 'left-4' : 'left-0.5'
          }`} />
        </button>
        <span className={flags.intimidateActive ? 'text-yellow-300' : 'text-gray-500'}>
          {flags.intimidateActive ? fx.descOn : fx.descOff}
        </span>
      </div>
    )
  }

  if (key === 'defiant' || key === 'contrary') {
    const fx = ABILITY_EFFECTS[key]
    return (
      <div className={`mt-1 px-1 py-1 rounded text-xs border ${
        opponentHasIntimidateActive
          ? 'bg-green-950/40 border-green-700/40 text-green-300'
          : 'bg-gray-800/60 border-gray-700/40 text-gray-500'
      }`}>
        {opponentHasIntimidateActive ? `✅ ${fx.descOn}` : `💡 ${fx.descOff}`}
      </div>
    )
  }

  if (key === 'competitive') {
    const fx = ABILITY_EFFECTS[key]
    return (
      <div className={`mt-1 px-1 py-1 rounded text-xs border ${
        opponentHasIntimidateActive
          ? 'bg-pink-950/40 border-pink-700/40 text-pink-300'
          : 'bg-gray-800/60 border-gray-700/40 text-gray-500'
      }`}>
        {opponentHasIntimidateActive ? `✅ ${fx.descOn}` : `💡 ${fx.descOff}`}
      </div>
    )
  }

  // ── Box informativi statici — desc letta da abilityEffects.js ────────────
  // In futuro: sostituire la stringa con una chiave i18n (es. 'ability.hospitality.desc')
  const abilityEffect = ABILITY_EFFECTS[key]
  if (abilityEffect?.desc) {
    const COLOR_MAP = {
      'huge-power':   'bg-red-950/30 border-red-800/30 text-red-300',
      'pure-power':   'bg-red-950/30 border-red-800/30 text-red-300',
      'adaptability': 'bg-teal-950/30 border-teal-800/30 text-teal-300',
      'fire-mane':    'bg-orange-950/30 border-orange-800/30 text-orange-300',
      'tough-claws':  'bg-yellow-950/30 border-yellow-800/30 text-yellow-300',
      'thick-fat':    'bg-blue-950/30 border-blue-800/30 text-blue-300',
      'filter':       'bg-indigo-950/30 border-indigo-800/30 text-indigo-300',
      'solid-rock':   'bg-indigo-950/30 border-indigo-800/30 text-indigo-300',
      'fluffy':       'bg-pink-950/30 border-pink-800/30 text-pink-300',
      'levitate':     'bg-sky-950/30 border-sky-800/30 text-sky-300',
    }
    const colorCls = COLOR_MAP[key] || 'bg-gray-800/60 border-gray-700/40 text-gray-500'
    return (
      <div className={`mt-1 px-1 py-1 rounded text-xs border ${colorCls}`}>
        💡 {abilityEffect.desc}
      </div>
    )
  }

  return null
}

// ─── ImportModal (inline nello slot) ─────────────────────────────────────────
/**
 * Textarea inline che appare sotto i bottoni quando si clicca Importa.
 * Parsa un singolo blocco Showdown e popola lo slot corrente.
 */
function ImportModal({ team, index, onClose, alwaysOpen = false }) {
  const [text, setText] = useState('')
  const [warnings, setWarnings] = useState([])

  const setPokemon     = useCalcStore(s => s.setPokemon)
  const setSPs         = useCalcStore(s => s.setSPs)
  const setNature      = useCalcStore(s => s.setNature)
  const setAbility     = useCalcStore(s => s.setAbility)
  const setItem        = useCalcStore(s => s.setItem)
  const setMove        = useCalcStore(s => s.setMove)

  function handleImport() {
    const { slot, warnings: w } = showdownToSlot(text)
    setWarnings(w)
    if (!slot) return

    setPokemon(team, index, slot.key)
    setSPs(team, index, slot.sps)
    if (slot.nature)  setNature(team, index, slot.nature)
    if (slot.ability) setAbility(team, index, slot.ability)
    if (slot.item)    setItem(team, index, slot.item)
    slot.moves.forEach((m, mi) => { if (m) setMove(team, index, mi, m) })

    if (w.length === 0) onClose()
  }

  return (
    <div className={alwaysOpen ? '' : 'mt-2 p-2 bg-gray-900 rounded border border-gray-700'}>
      <textarea
        autoFocus={!alwaysOpen}
        className="w-full h-36 bg-gray-800 text-gray-200 text-xs font-mono p-2 rounded border border-gray-700 resize-none outline-none focus:border-teal-500"
        placeholder={"Paste the Showdown block for a single Pokémon here...\n\nExample:\nGardevoir @ Choice Specs\nAbility: Trace\nEVs: 4 HP / 32 SpA / 30 Spe\nTimid Nature\n- Moonblast\n- Psychic\n- Shadow Ball\n- Trick"}
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <div className="flex gap-2 mt-1.5 items-center flex-wrap">
        <button
          onClick={handleImport}
          className="text-xs px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors"
        >
          ✔ Import
        </button>
        {!alwaysOpen && (
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Annulla
          </button>
        )}
        {warnings.map((w, i) => (
          <span key={i} className="text-xs text-yellow-400">⚠ {w}</span>
        ))}
      </div>
    </div>
  )
}

// ─── DuplicateModal ───────────────────────────────────────────────────────────
/**
 * Mostra un selettore di slot solo quando tutti e 6 i posti del team sono occupati.
 * In caso contrario duplica direttamente nel primo slot libero dopo l'attuale.
 */
function DuplicateModal({ team, sourceIndex, onClose }) {
  const teamData   = useCalcStore(s => s[team])
  const setTeamFn  = useCalcStore(s => s.setTeam)

  // Trova il primo slot libero dopo sourceIndex
  const nextEmpty = (() => {
    for (let i = sourceIndex + 1; i < 6; i++) {
      if (!teamData[i]?.key) return i
    }
    return null
  })()

  function duplicateTo(targetIndex) {
    const source = teamData[sourceIndex]
    if (!source) return
    const newTeam = teamData.map((slot, i) =>
      i === targetIndex ? { ...source } : slot
    )
    setTeamFn(team, newTeam)
    onClose()
  }

  // Slot libero trovato → duplica subito senza mostrare UI
  if (nextEmpty !== null) {
    duplicateTo(nextEmpty)
    return null
  }

  // Tutti gli slot occupati → chiedi dove sovrascrivere
  return (
    <div className="mt-2 p-2 bg-gray-900 rounded border border-gray-700">
      <p className="text-xs text-gray-400 mb-2">Tutti gli slot sono occupati. Scegli dove sovrascrivere:</p>
      <div className="flex gap-1 flex-wrap">
        {teamData.map((slot, i) => {
          if (i === sourceIndex) return null
          const name = slot?.key ? slot.key.split('-')[0] : `P${i+1}`
          const sprite = slot?.key ? spriteUrl(slot.key) : null
          return (
            <button
              key={i}
              onClick={() => duplicateTo(i)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-colors"
            >
              {sprite && (
                <img src={sprite} alt={name} className="w-8 h-8 object-contain"
                  onError={e => { e.target.style.display = 'none' }} />
              )}
              <span className="text-[10px] text-gray-300 capitalize">{name}</span>
            </button>
          )
        })}
      </div>
      <button
        onClick={onClose}
        className="mt-2 text-xs text-gray-500 hover:text-gray-300"
      >
        Annulla
      </button>
    </div>
  )
}

// ─── PokemonPanel ─────────────────────────────────────────────────────────────

function PokemonPanel({ team, index }) {
  const pokemon        = useCalcStore(s => s[team][index])
  const level          = useCalcStore(s => s.level)
  const setPokemon     = useCalcStore(s => s.setPokemon)
  const setNature      = useCalcStore(s => s.setNature)
  const setSPs         = useCalcStore(s => s.setSPs)
  const setMove        = useCalcStore(s => s.setMove)
  const setBoost       = useCalcStore(s => s.setBoost)
  const setItem        = useCalcStore(s => s.setItem)
  const setAbility     = useCalcStore(s => s.setAbility)
  const setAbilityFlag = useCalcStore(s => s.setAbilityFlag)
  const setDoubleTarget = useCalcStore(s => s.setDoubleTarget)
  const weather        = useCalcStore(s => s.weather)

  const [showImport,    setShowImport]    = useState(false)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [exportCopied,  setExportCopied]  = useState(false)

  const data         = pokemonData[pokemon?.key]
  const sps          = pokemon?.sps || [0,0,0,0,0,0]
  const nature       = pokemon?.nature || null
  const item         = pokemon?.item || null
  const ability      = pokemon?.ability || null
  const abilityFlags = pokemon?.abilityFlags || {}
  const total        = sps.reduce((a,b) => a+b, 0)
  const remaining    = 66 - total

  const opponentTeam = useCalcStore(s => s[team === 'team1' ? 'team2' : 'team1'])
  const opponentHasIntimidateActive = opponentTeam.some(
    p => p?.ability?.toLowerCase() === 'intimidate' && p?.abilityFlags?.intimidateActive
  )

  const boostFields = [null,'atkBoost','defBoost','spAtkBoost','spDefBoost','speBoost']

  const handleSp = (i, val) => {
    const newVal = Math.min(32, Math.max(0, val))
    const newSPs = [...sps]
    const diff   = newVal - sps[i]
    if (diff > remaining) return
    newSPs[i] = newVal
    setSPs(team, index, newSPs)
  }

  const handlePokemonChange = (key) => {
    setPokemon(team, index, key)
    const targetData = pokemonData[key]
    if (targetData?.abilities?.length > 0) {
      setAbility(team, index, targetData.abilities[0])
    } else {
      setAbility(team, index, '')
    }
  }

  const handleMoveChange = (mi, m) => {
    setMove(team, index, mi, m)
    const isSpread = movesData[m]?.spread === true
    setDoubleTarget(isSpread)
  }

  // ── Esporta: copia paste singolo Pokémon negli appunti
  const handleExport = () => {
    const paste = slotToShowdown(pokemon)
    if (!paste) return
    navigator.clipboard.writeText(paste).then(() => {
      setExportCopied(true)
      setTimeout(() => setExportCopied(false), 2000)
    })
  }

  // ── Importa: toggle textarea inline
  const handleImport = () => {
    setShowImport(v => !v)
    setShowDuplicate(false)
  }

  // ── Duplica: logica gestita da DuplicateModal
  const handleDuplicate = () => {
    setShowDuplicate(v => !v)
    setShowImport(false)
  }

  return (
    <div className="p-3">
      {/* Barra bottoni — sempre visibile. Duplica/Esporta/Elimina disabilitati se slot vuoto */}
      <div className="flex justify-end gap-1.5 mb-2.5 text-xs">
            <button
              type="button"
              onClick={data ? handleDuplicate : undefined}
              disabled={!data}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ${
                !data ? 'bg-gray-800/40 border-gray-700/20 text-gray-600 cursor-not-allowed'
                : showDuplicate ? 'bg-teal-800 border-teal-600 text-teal-200'
                : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'
              }`}
              title="Duplicate Pokémon"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              <span>Duplicate</span>
            </button>

            <button
              type="button"
              onClick={data ? handleExport : undefined}
              disabled={!data}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ${
                !data ? 'bg-gray-800/40 border-gray-700/20 text-gray-600 cursor-not-allowed'
                : exportCopied ? 'bg-green-800 border-green-600 text-green-200'
                : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'
              }`}
              title="Export to Showdown"
            >
              {!exportCopied && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
              <span>{exportCopied ? 'Copied' : 'Export'}</span>
            </button>

            <button
              type="button"
              onClick={handleImport}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ${
                showImport
                  ? 'bg-teal-800 border-teal-600 text-teal-200'
                  : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'
              }`}
              title="Import from Showdown"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Import</span>
            </button>

            <button
              type="button"
              onClick={data ? () => { setPokemon(team, index, ''); setAbility(team, index, '') } : undefined}
              disabled={!data}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ml-1 ${
                !data ? 'bg-gray-800/40 border-gray-700/20 text-gray-600 cursor-not-allowed'
                : 'bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border-red-900/30'
              }`}
              title="Delete Pokémon"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete</span>
            </button>
          </div>

      {/* Pannelli inline: Importa / Duplica */}
      {showImport && (
        <ImportModal team={team} index={index} onClose={() => setShowImport(false)} />
      )}
      {showDuplicate && data && (
        <DuplicateModal team={team} sourceIndex={index} onClose={() => setShowDuplicate(false)} />
      )}

      <div className="flex gap-3 mb-3">
        {data && (
          <img
            src={spriteUrl(pokemon.key)}
            alt={pokemon.key}
            className="w-16 h-16 object-contain"
            onError={e => {
              const fb = fallbackSpriteUrl(pokemon.key)
              if (fb && e.target.src !== fb) { e.target.src = fb } else { e.target.style.display = 'none' }
            }}
          />
        )}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex gap-2 items-center">
            <div className={pokemon?.key ? "w-1/3 shrink-0" : "flex-1"}>
              <PokemonSearch value={pokemon?.key} onChange={handlePokemonChange} />
            </div>
            {pokemon?.key && (
              <>
                <div className="flex-1 min-w-0">
                  <PresetSelect team={team} index={index} currentSlug={pokemon?.key} />
                </div>
                <div className="flex gap-1 flex-wrap justify-end shrink-0">
                  {data?.type?.map(typeId => {
                    const typeName = TYPE_NAMES[typeId]
                    return (
                      <span
                        key={typeId}
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shadow-sm ${
                          TYPE_COLORS[typeName] || 'bg-gray-600 text-white'
                        }`}
                      >
                        {typeName}
                      </span>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          {data && (
            <div className="flex gap-2 w-full">
              <div className="w-1/3">
                <AbilitySelect value={ability} abilities={data?.abilities} onChange={a => setAbility(team, index, a)} />
              </div>
              <div className="w-1/3">
                <select
                  className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none capitalize"
                  value={nature || ''}
                  onChange={e => setNature(team, index, e.target.value || null)}
                >
                  <option value="">Natura (neutra)</option>
                  {NATURES.map(n => {
                    const STAT_LABELS = ['','Atk','Def','SpA','SpD','Spe']
                    const mod = NATURE_MODIFIERS[n]
                    const label = mod && mod[0] !== 0
                      ? `${n.charAt(0).toUpperCase()+n.slice(1)} (+${STAT_LABELS[mod[0]]}, -${STAT_LABELS[mod[1]]})`
                      : `${n.charAt(0).toUpperCase()+n.slice(1)}`
                    return <option key={n} value={n}>{label}</option>
                  })}
                </select>
              </div>
              <div className="w-1/3">
                <ItemSearch value={item} onChange={m => setItem(team, index, m)} />
              </div>
            </div>
          )}
          {data && ability && (
            <AbilityFlags
              ability={ability}
              flags={abilityFlags}
              opponentHasIntimidateActive={opponentHasIntimidateActive}
              onFlagChange={(flag, val) => setAbilityFlag(team, index, flag, val)}
              weather={weather}
            />
          )}
        </div>
      </div>

      {data && (
        <>
          <div className="mb-2">
            <div className="flex items-center text-xs text-gray-500 mb-1 gap-2">
              <span className="w-8 text-center">Stat</span>
              <span className="w-7 text-center">Base</span>
              <div className="flex-1 flex justify-center items-center gap-1.5">
                <span>SP</span>
                <span className={`text-[10px] font-bold px-1 rounded ${
                  remaining === 0
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  ({remaining}/66)
                </span>
              </div>
              <span className="w-8 text-center">Tot</span>
              <span className="w-12 text-center">Boost</span>
              <span className="w-8 text-center">Mod</span>
            </div>
            {STAT_NAMES.map((_, i) => (
              <StatRow
                key={i}
                statIdx={i}
                base={data.stats[i]}
                sp={sps[i]}
                level={level}
                nature={nature}
                boostVal={boostFields[i] ? (pokemon?.[boostFields[i]] || 0) : 0}
                onSpChange={val => handleSp(i, val)}
                onBoostChange={val => boostFields[i] && setBoost(team, index, boostFields[i], val)}
                speedWeatherActive={(() => {
                  const SPEED_MAP = {
                    'sand-rush':   ['sand', 'sandstorm'],
                    'chlorophyll': ['sun', 'harsh sunshine'],
                    'swift-swim':  ['rain', 'heavy rain'],
                    'slush-rush':  ['snow', 'hail'],
                  }
                  const conditions = SPEED_MAP[(ability || '').toLowerCase()] || []
                  return conditions.includes((weather || '').toLowerCase())
                })()}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {[0,1,2,3].map(mi => (
              <MoveSearch
                key={mi}
                value={pokemon?.moves[mi]}
                placeholder={`Move ${mi+1}`}
                onChange={m => handleMoveChange(mi, m)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── TeamEditor (root export) ─────────────────────────────────────────────────

export default function TeamEditor({ team }) {
  const [activeTab, setActiveTab] = useState(0)
  const teamData = useCalcStore(s => s[team])
  const editorFocus = useCalcStore(s => s.editorFocus)

  // Cliccando uno sprite in DamageTable, apri il tab corrispondente.
  // Pattern React "adjust state during render": niente useEffect, nessun render extra committato.
  const [lastFocusTs, setLastFocusTs] = useState(null)
  if (editorFocus && editorFocus.team === team && editorFocus.ts !== lastFocusTs) {
    setLastFocusTs(editorFocus.ts)
    setActiveTab(editorFocus.index)
  }

  return (
    <div id={`team-editor-${team}`} className="bg-gray-900 rounded-xl border border-gray-700/40">
      <div className="flex border-b border-gray-700">
        {teamData.map((p, i) => {
          const sprite = p?.key ? spriteUrl(p.key) : null
          return (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className="flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors border-b-2"
              style={{
                borderColor: activeTab === i ? '#2dd4bf' : 'transparent',
                color: activeTab === i ? '#2dd4bf' : '#6b7280'
              }}
            >
              {sprite ? (
                <img
                  src={sprite}
                  alt={p.key}
                  className="w-8 h-8 object-contain"
                  onError={e => {
                    const fb = fallbackSpriteUrl(p.key)
                    if (fb && e.target.src !== fb) { e.target.src = fb } else { e.target.style.display = 'none' }
                  }}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-600 text-xs">
                  {i+1}
                </div>
              )}
              <span className="capitalize truncate w-full text-center" style={{fontSize:'9px'}}>
                {p?.key ? p.key.split('-')[0] : `P${i+1}`}
              </span>
            </button>
          )
        })}
      </div>
      <PokemonPanel team={team} index={activeTab} />
    </div>
  )
}