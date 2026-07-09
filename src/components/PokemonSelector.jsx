import { useState, useMemo } from 'react'
import pokemonData from '../data/pokemon.json'
import movesData from '../data/moves.json'
import useCalcStore from '../store/useCalcStore'
import { calcFinalStat, STAT_NAMES } from '../utils/statCalc'

const ALL_POKEMON = Object.keys(pokemonData).sort()
const ALL_MOVES = Object.keys(movesData).sort()

const NATURES = [
  'adamant','bashful','bold','brave','calm','careful','docile',
  'gentle','hardy','hasty','impish','jolly','lax','lonely',
  'mild','modest','naive','naughty','quiet','quirky',
  'rash','relaxed','sassy','serious','timid'
].sort()

const NATURE_MODIFIERS = {
  hardy:[0,0],bashful:[0,0],docile:[0,0],serious:[0,0],quirky:[0,0],
  lonely:[1,2],brave:[1,5],adamant:[1,3],naughty:[1,4],
  bold:[2,1],relaxed:[2,5],impish:[2,3],lax:[2,4],
  timid:[5,1],hasty:[5,2],jolly:[5,3],naive:[5,4],
  modest:[3,1],mild:[3,2],quiet:[3,5],rash:[3,4],
  calm:[4,1],gentle:[4,2],sassy:[4,5],careful:[4,3],
}

function StatEditor({ team, index }) {
  const pokemon = useCalcStore((s) => s[team][index])
  const level = useCalcStore((s) => s.level)
  const setSPs = useCalcStore((s) => s.setSPs)
  const setBoost = useCalcStore((s) => s.setBoost)

  const data = pokemonData[pokemon?.key]
  if (!data) return null

  const sps = pokemon.sps || [0,0,0,0,0,0]
  const nature = pokemon.nature || null
  const total = sps.reduce((a, b) => a + b, 0)
  const remaining = 66 - total

  const BOOST_NUM = [2, 2, 2, 2, 2, 2, 1, 3, 4, 5, 6, 7, 8]
  const BOOST_DEN = [8, 7, 6, 5, 4, 3, 1, 2, 2, 2, 2, 2, 2]

  // Mappa stat index → campo boost
  const boostField = [null, 'atkBoost', 'defBoost', 'spAtkBoost', 'spDefBoost', null]

  const statColor = (statIdx) => {
    const mod = nature && NATURE_MODIFIERS[nature]
    if (!mod || mod[0] === 0) return 'text-gray-200'
    if (mod[0] === statIdx) return 'text-red-400'
    if (mod[1] === statIdx) return 'text-blue-400'
    return 'text-gray-200'
  }

  const handleChange = (i, val) => {
    const newVal = Math.min(32, Math.max(0, parseInt(val) || 0))
    const newSPs = [...sps]
    const diff = newVal - sps[i]
    if (diff > remaining) return
    newSPs[i] = newVal
    setSPs(team, index, newSPs)
  }

  const boostOptions = [-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6]

  return (
    <div className="mt-2 mb-2">
      <div className="flex items-center gap-1 mb-1 text-xs text-gray-500 px-0.5">
        <span className="w-7">Stat</span>
        <span className="w-7 text-right">Base</span>
        <span className="w-8 text-center">SP</span>
        <span className="flex-1"></span>
        <span className="w-8 text-right">Tot</span>
        <span className="w-10 text-center">Boost</span>
        <span className="w-8 text-right">Mod</span>
      </div>
      {STAT_NAMES.map((s, i) => {
        const finalStat = calcFinalStat(data.stats[i], sps[i], level, nature, i)
        const bf = boostField[i]
        const boostVal = bf ? (pokemon?.[bf] || 0) : 0
        const boostedStat = bf && boostVal !== 0
          ? Math.floor(finalStat * BOOST_NUM[6 + boostVal] / BOOST_DEN[6 + boostVal])
          : null

        return (
          <div key={i} className="flex items-center gap-1 mb-1">
            <span className="text-xs text-gray-500 w-7">{s}</span>
            <span className="text-xs text-gray-400 w-7 text-right">{data.stats[i]}</span>
            <input
              type="number"
              min="0"
              max="32"
              value={sps[i]}
              onChange={e => handleChange(i, e.target.value)}
              className="w-8 bg-gray-700 text-white text-xs rounded px-1 py-0.5 outline-none text-center"
            />
            <input
              type="range"
              min="0"
              max="32"
              value={sps[i]}
              onChange={e => handleChange(i, e.target.value)}
              className="flex-1 h-1 accent-teal-400"
            />
            <span className={`text-xs font-medium w-8 text-right ${statColor(i)}`}>
              {finalStat}
            </span>
            {bf ? (
              <select
                value={boostVal}
                onChange={e => setBoost(team, index, bf, parseInt(e.target.value))}
                className={`w-10 bg-gray-700 text-xs rounded px-0.5 py-0.5 outline-none text-center ${
                  boostVal > 0 ? 'text-green-400' : boostVal < 0 ? 'text-red-400' : 'text-gray-400'
                }`}
              >
                {boostOptions.map(v => (
                  <option key={v} value={v}>{v > 0 ? `+${v}` : v}</option>
                ))}
              </select>
            ) : (
              <span className="w-10" />
            )}
            <span className={`text-xs w-8 text-right ${boostedStat ? (boostVal > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-600'}`}>
              {boostedStat ?? '—'}
            </span>
          </div>
        )
      })}
      <div className="flex justify-between text-xs mt-1 px-0.5">
        <span className="text-gray-500">SP rimanenti</span>
        <span className={remaining === 0 ? 'text-yellow-400 font-medium' : 'text-gray-400'}>
          {remaining}/66
        </span>
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

          <StatEditor team={team} index={index} />

          <div className="grid grid-cols-2 gap-1 mt-2">
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