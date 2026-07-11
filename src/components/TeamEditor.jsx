import { useState } from 'react'
import { calcFinalStat, STAT_NAMES } from '../utils/statCalc'
import pokemonData from '../data/pokemon.json'
import movesData from '../data/moves.json'
import itemsData from '../data/items.json'
import abilitiesData from '../data/abilities.json'
import useCalcStore from '../store/useCalcStore'
import { TYPE_NAMES, TYPE_COLORS } from '../data/typeChart.js'
import { SPREAD_MOVES } from '../calcEngine'

const ALL_POKEMON = Object.keys(pokemonData).sort()
const ALL_MOVES = Object.keys(movesData).sort()
const ALL_ITEMS = Object.keys(itemsData).sort()
const ALL_ABILITIES = Object.keys(abilitiesData).sort()

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

const BOOST_NUM = [2,2,2,2,2,2,1,3,4,5,6,7,8]
const BOOST_DEN = [8,7,6,5,4,3,1,2,2,2,2,2,2]

const spriteUrl = (key) => {
  const data = pokemonData[key]
  if (!data) return null
  const isAlola = key.includes('-alola')
  const isMegaY = key.includes('-mega-y')
  const isMegaX = key.includes('-mega-x')
  const isMega  = data.mega === 1
  let num = data.num
  if (isMega) {
    const baseName = key.replace(/-mega.*$/, '')
    num = pokemonData[baseName]?.num || ''
  }
  num = num?.replace('#', '').padStart(4, '0')
  if (!num) return null
  const form = isMegaY ? 'f02' : (isMegaX || isMega || isAlola) ? 'f01' : 'f00'
  return `https://resource.pokemon-home.com/battledata/img/pokei128/icon${num}_${form}_s0.png`
}

function StatRow({ statIdx, base, sp, level, nature, boostVal, onSpChange, onBoostChange }) {
  const finalStat = calcFinalStat(base, sp, level, nature, statIdx)
  const boostedStat = boostVal !== 0
    ? Math.floor(finalStat * BOOST_NUM[6 + boostVal] / BOOST_DEN[6 + boostVal])
    : null

  const mod = nature && NATURE_MODIFIERS[nature]
  const isBoost = mod && mod[0] !== 0 && mod[0] === statIdx
  const isDrop  = mod && mod[0] !== 0 && mod[1] === statIdx

  const statColor = isBoost ? 'text-red-400' : isDrop ? 'text-blue-400' : 'text-gray-200'
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
        className="w-8 bg-gray-700 text-white text-xs rounded px-1 py-0.5 outline-none text-center"
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
          <span className={`text-xs w-8 text-center ${boostedStat ? (boostVal > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-600'}`}>
            {boostedStat ?? '—'}
          </span>
        </>
      ) : (
        <>
          <div className="w-12" aria-hidden="true" />
          <div className="w-8" aria-hidden="true" />
        </>
      )}
    </div>
  )
}

function PokemonSearch({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)

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
        className="w-full bg-gray-700 text-sm text-white rounded pl-2 pr-7 py-1 outline-none capitalize"
        placeholder="Cerca Pokémon..."
        value={focused ? query : (value || '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setFocused(true); setQuery(''); setOpen(true) }}
        onBlur={() => {
          setTimeout(() => {
            setFocused(false)
            setOpen(false)
            setQuery('')
          }, 150)
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

function MoveSearch({ value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = query.length >= 2
    ? ALL_MOVES.filter(m => m.includes(query.toLowerCase())).slice(0, 20)
    : []

  const moveDetails = movesData[value]

  const categoryTitles = {
    0: 'Fisico',
    1: 'Speciale',
    2: 'Stato'
  }

  return (
    <div className="bg-gray-700/40 p-1.5 rounded border border-gray-700/60 flex items-center justify-between gap-2 h-9">
      <div className="flex-1 relative">
        <input
          className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none capitalize"
          placeholder={value ? value.replace(/-/g, ' ') : placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
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
            {moveDetails.power && moveDetails.power > 0 ? moveDetails.power : '—'}
          </span>
          <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded-[3px] shadow-sm shrink-0 ${
            TYPE_COLORS[TYPE_NAMES[moveDetails.type]] || 'bg-gray-600 text-white'
          }`}>
            {TYPE_NAMES[moveDetails.type]}
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

function ItemSearch({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = query.length >= 2
    ? ALL_ITEMS.filter(i => i.includes(query.toLowerCase())).slice(0, 20)
    : []

  return (
    <div className="relative">
      <input
        className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none capitalize"
        placeholder="Cerca Strumento..."
        value={query || (value ? value.replace(/-/g, ' ') : '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-40 overflow-y-auto">
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

function AbilitySearch({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = query.length >= 2
    ? ALL_ABILITIES.filter(a => a.includes(query.toLowerCase())).slice(0, 20)
    : []

  const displayValue = query !== '' ? query : (value ? value.replace(/-/g, ' ') : '')

  return (
    <div className="relative">
      <input
        className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none capitalize"
        placeholder="Abilità..."
        value={displayValue}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onBlur={() => setTimeout(() => { setOpen(false); setQuery('') }, 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-40 overflow-y-auto shadow-xl">
          {filtered.map(a => (
            <div
              key={a}
              className="px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer capitalize"
              onMouseDown={() => { onChange(a); setQuery(''); setOpen(false) }}
            >
              {a.replace(/-/g, ' ')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PokemonPanel({ team, index }) {
  const pokemon = useCalcStore(s => s[team][index])
  const level   = useCalcStore(s => s.level)
  const setPokemon    = useCalcStore(s => s.setPokemon)
  const setNature     = useCalcStore(s => s.setNature)
  const setSPs        = useCalcStore(s => s.setSPs)
  const setMove       = useCalcStore(s => s.setMove)
  const setBoost      = useCalcStore(s => s.setBoost)
  const setItem       = useCalcStore(s => s.setItem)
  const setAbility    = useCalcStore(s => s.setAbility)
  const setDoubleTarget = useCalcStore(s => s.setDoubleTarget)

  const data = pokemonData[pokemon?.key]
  const sps  = pokemon?.sps || [0,0,0,0,0,0]
  const nature = pokemon?.nature || null
  const item   = pokemon?.item || null
  const ability = pokemon?.ability || null
  const total = sps.reduce((a,b) => a+b, 0)
  const remaining = 66 - total

  const boostFields = [null,'atkBoost','defBoost','spAtkBoost','spDefBoost','speBoost']

  const handleSp = (i, val) => {
    const newVal = Math.min(32, Math.max(0, val))
    const newSPs = [...sps]
    const diff = newVal - sps[i]
    if (diff > remaining) return
    newSPs[i] = newVal
    setSPs(team, index, newSPs)
  }

  const handlePokemonChange = (key) => {
    setPokemon(team, index, key)
    const targetData = pokemonData[key]
    if (targetData && targetData.abilities && targetData.abilities.length > 0) {
      setAbility(team, index, targetData.abilities[0])
    } else {
      setAbility(team, index, '')
    }
  }

  const handleMoveChange = (mi, m) => {
    setMove(team, index, mi, m)
    // Auto-selezione doubleTarget in base alla mossa scelta
    const isSpread = SPREAD_MOVES.has(m.replace(/ /g, '-'))
    setDoubleTarget(isSpread)
  }

  const handleDuplicate = () => { console.log('Duplica slot:', index) }
  const handleExport = () => { console.log('Esporta slot:', index) }
  const handleImport = () => { console.log('Importa nello slot:', index) }

  return (
    <div className="p-3">
      {data && (
        <div className="flex justify-end gap-1.5 mb-2.5 text-xs">
          <button
            type="button"
            onClick={handleDuplicate}
            className="flex items-center justify-center gap-1 bg-gray-700/60 hover:bg-gray-700 text-gray-300 w-20 py-1 rounded border border-gray-600/40 transition"
            title="Duplica Pokémon"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            <span>Duplica</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center justify-center gap-1 bg-gray-700/60 hover:bg-gray-700 text-gray-300 w-20 py-1 rounded border border-gray-600/40 transition"
            title="Esporta in Showdown"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>Esporta</span>
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="flex items-center justify-center gap-1 bg-gray-700/60 hover:bg-gray-700 text-gray-300 w-20 py-1 rounded border border-gray-600/40 transition"
            title="Importa da Showdown"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Importa</span>
          </button>
          <button
            type="button"
            onClick={() => { setPokemon(team, index, ''); setAbility(team, index, '') }}
            className="flex items-center justify-center gap-1 bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 w-20 py-1 rounded border border-red-900/30 transition ml-1"
            title="Elimina Pokémon"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Elimina</span>
          </button>
        </div>
      )}

      <div className="flex gap-3 mb-3">
        {data && (
          <img
            src={spriteUrl(pokemon.key)}
            alt={pokemon.key}
            className="w-16 h-16 object-contain"
            onError={e => e.target.style.display='none'}
          />
        )}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <PokemonSearch value={pokemon?.key} onChange={handlePokemonChange} />
            </div>
            {data && data.type && (
              <div className="flex gap-1 shrink-0">
                {data.type.map(typeId => {
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
            )}
          </div>
          {data && (
            <div className="flex gap-2 w-full">
              <div className="w-1/3">
                <AbilitySearch value={ability} onChange={a => setAbility(team, index, a)} />
              </div>
              <div className="w-1/3">
                <select
                  className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none capitalize"
                  value={nature || ''}
                  onChange={e => setNature(team, index, e.target.value || null)}
                >
                  <option value="">Natura (neutra)</option>
                  {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="w-1/3">
                <ItemSearch value={item} onChange={m => setItem(team, index, m)} />
              </div>
            </div>
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
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {[0,1,2,3].map(mi => (
              <MoveSearch
                key={mi}
                value={pokemon?.moves[mi]}
                placeholder={`Mossa ${mi+1}`}
                onChange={m => handleMoveChange(mi, m)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function TeamEditor({ team }) {
  const [activeTab, setActiveTab] = useState(0)
  const teamData = useCalcStore(s => s[team])

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700">
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
                  onError={e => e.target.style.display='none'}
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