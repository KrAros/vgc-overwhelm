import useCalcStore from '../../store/useCalcStore'
import { useState } from 'react'
import pokemonData from '../../data/pokemon.json'
import movesData   from '../../data/moves.json'
import itemsData   from '../../data/items.json'
import { TYPE_NAMES, TYPE_COLORS } from '../../data/typeChart.js'
import { useTranslation } from 'react-i18next'

const ALL_POKEMON = Object.keys(pokemonData).sort()
const ALL_MOVES   = Object.keys(movesData).sort()
const ALL_ITEMS   = Object.keys(itemsData).sort()

// ─── PokemonSearch ────────────────────────────────────────────────────────────

export function PokemonSearch({ value, onChange }) {
  const { t } = useTranslation()
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
        placeholder={t("ui.search_pokemon")}
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

export function MoveSearch({ value, onChange, placeholder, ability }) {
  const { t } = useTranslation()
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
  // Ate abilities: Normal → Fairy (pixilate) / Flying (aerilate)
  const abilityKey = (ability || '').toLowerCase().replace(/ /g, '-')
  const ATE_MAP = { 'pixilate': 17, 'aerilate': 9 } // 17=Fairy, 9=Flying in TYPE_NAMES
  const baseType = isWeatherBall && wbTypeIdx !== null ? wbTypeIdx : moveDetails?.type
  const isNormalMove = baseType === 0 // 0 = Normal
  const ateType = isNormalMove && ATE_MAP[abilityKey] !== undefined ? ATE_MAP[abilityKey] : null
  const displayType = ateType !== null ? ateType : baseType
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
            {t(`types.${TYPE_NAMES[displayType]}`, { defaultValue: TYPE_NAMES[displayType] })}
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

export function ItemSearch({ value, onChange }) {
  const { t } = useTranslation()
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
        placeholder={t("ui.search_item")}
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

export function AbilitySelect({ value, abilities, onChange }) {
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