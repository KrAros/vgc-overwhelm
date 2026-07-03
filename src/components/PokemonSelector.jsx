import { useState, useMemo } from 'react'
import pokemonData from '../data/pokemon.json'
import movesData from '../data/moves.json'
import useCalcStore from '../store/useCalcStore'

const ALL_POKEMON = Object.keys(pokemonData).sort()
const ALL_MOVES = Object.keys(movesData).sort()

const NATURES = [
  'adamant','bashful','bold','brave','calm','careful','docile',
  'gentle','hardy','hasty','impish','jolly','lax','lonely',
  'mild','modest','naive','naughty','quiet','quirky',
  'rash','relaxed','sassy','serious','timid'
].sort()

const STAT_NAMES = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']

function SPEditor({ team, index }) {
  const pokemon = useCalcStore((s) => s[team][index])
  const setSPs = useCalcStore((s) => s.setSPs)

  const sps = pokemon?.sps || [0,0,0,0,0,0]
  const total = sps.reduce((a, b) => a + b, 0)
  const remaining = 66 - total

  const handleChange = (i, val) => {
    const newVal = Math.min(32, Math.max(0, parseInt(val) || 0))
    const newSPs = [...sps]
    const diff = newVal - sps[i]
    if (diff > remaining) return
    newSPs[i] = newVal
    setSPs(team, index, newSPs)
  }

  return (
    <div className="mt-2 mb-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Stat Points</span>
        <span className={total >= 66 ? 'text-yellow-400' : 'text-gray-400'}>
          {total}/66
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {STAT_NAMES.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-xs text-gray-500 w-7">{s}</span>
            <input
              type="number"
              min="0"
              max="32"
              value={sps[i]}
              onChange={e => handleChange(i, e.target.value)}
              className="w-full bg-gray-700 text-white text-xs rounded px-1 py-0.5 outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function MoveSelect({ team, pokeIndex, moveIndex }) {
  const move = useCalcStore((s) => s[team][pokeIndex].moves[moveIndex])
  const setMove = useCalcStore((s) => s.setMove)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() =>
    query.length < 2 ? [] : ALL_MOVES.filter(m => m.includes(query.toLowerCase())).slice(0, 20)
  , [query])

  return (
    <div className="relative">
      <input
        className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none"
        placeholder={move || `Mossa ${moveIndex + 1}`}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-40 overflow-y-auto">
          {filtered.map(m => (
            <div
              key={m}
              className="px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer capitalize"
              onMouseDown={() => {
                setMove(team, pokeIndex, moveIndex, m)
                setQuery('')
                setOpen(false)
              }}
            >
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PokemonSlot({ team, index }) {
  const pokemon = useCalcStore((s) => s[team][index])
  const setPokemon = useCalcStore((s) => s.setPokemon)
  const setNature = useCalcStore((s) => s.setNature)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() =>
    query.length < 2 ? [] : ALL_POKEMON.filter(p => p.includes(query.toLowerCase())).slice(0, 20)
  , [query])

  return (
    <div className="border border-gray-600 rounded-lg p-2 mb-2">
      <div className="relative mb-2">
        <input
          className="w-full bg-gray-700 text-sm text-white rounded px-2 py-1 outline-none capitalize"
          placeholder={`Pokémon ${index + 1}`}
          value={query || (pokemon?.key ? pokemon.key : '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-48 overflow-y-auto">
            {filtered.map(p => (
              <div
                key={p}
                className="px-2 py-1 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer capitalize"
                onMouseDown={() => {
                  setPokemon(team, index, p)
                  setQuery('')
                  setOpen(false)
                }}
              >
                {p}
              </div>
            ))}
          </div>
        )}
      </div>

      {pokemon?.key && (
        <>
          <select
            className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 mb-2 outline-none capitalize"
            value={pokemon.nature || ''}
            onChange={(e) => setNature(team, index, e.target.value || null)}
          >
            <option value="">Natura (neutra)</option>
            {NATURES.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <SPEditor team={team} index={index} />

          <div className="grid grid-cols-2 gap-1">
            {[0, 1, 2, 3].map(mi => (
              <MoveSelect key={mi} team={team} pokeIndex={index} moveIndex={mi} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function PokemonSelector() {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest text-center mb-3">
          Team 1
        </h2>
        {[0,1,2,3,4,5].map(i => (
          <PokemonSlot key={i} team="team1" index={i} />
        ))}
      </div>
      <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest text-center mb-3">
          Team 2
        </h2>
        {[0,1,2,3,4,5].map(i => (
          <PokemonSlot key={i} team="team2" index={i} />
        ))}
      </div>
    </div>
  )
}