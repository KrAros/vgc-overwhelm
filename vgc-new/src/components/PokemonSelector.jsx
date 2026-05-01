import { useState, useMemo } from 'react'
import pokemonData from '../data/pokemon.json'
import movesData from '../data/moves.json'
import useCalcStore from '../store/useCalcStore'

const ALL_POKEMON = Object.keys(pokemonData).sort()
const ALL_MOVES = Object.keys(movesData).sort()

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
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() =>
    query.length < 2 ? [] : ALL_POKEMON.filter(p => p.includes(query.toLowerCase())).slice(0, 20)
  , [query])

  return (
    <div className="bg-gray-750 border border-gray-600 rounded-lg p-2 mb-2">
      <div className="relative mb-2">
        <input
          className="w-full bg-gray-700 text-sm text-white rounded px-2 py-1 outline-none capitalize"
          placeholder={`Pokémon ${index + 1}`}
          value={query || (pokemon?.key ? pokemon.key : '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={(e) => { setQuery(''); setOpen(true) }}
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
        <div className="grid grid-cols-2 gap-1">
          {[0, 1, 2, 3].map(mi => (
            <MoveSelect key={mi} team={team} pokeIndex={index} moveIndex={mi} />
          ))}
        </div>
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