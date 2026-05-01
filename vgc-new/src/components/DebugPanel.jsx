import { useState } from 'react'
import { calculateDamage } from '../calcEngine'
import pokemonData from '../data/pokemon.json'

const STAT_NAMES = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']

function calcFinalStat(base, sp, level, nature, statIdx) {
  const ev = (sp ?? 0) * 8
  const iv = 31
  if (statIdx === 0) {
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
  }
  const NATURE_MODIFIERS = {
    hardy:[10,10],bashful:[10,10],docile:[10,10],serious:[10,10],quirky:[10,10],
    lonely:[11,12],brave:[11,15],adamant:[11,13],naughty:[11,14],
    bold:[12,11],relaxed:[12,15],impish:[12,13],lax:[12,14],
    timid:[15,11],hasty:[15,12],jolly:[15,13],naive:[15,14],
    modest:[13,11],mild:[13,12],quiet:[13,15],rash:[13,14],
    calm:[14,11],gentle:[14,12],sassy:[14,15],careful:[14,13],
  }
  const mod = nature && NATURE_MODIFIERS[nature]
    ? (NATURE_MODIFIERS[nature][0] === statIdx ? 11 : NATURE_MODIFIERS[nature][1] === statIdx ? 9 : 10)
    : 10
  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
  return Math.floor(raw * mod / 10)
}

export default function DebugPanel() {
  const [atkPokemon, setAtkPokemon] = useState('garchomp')
  const [defPokemon, setDefPokemon] = useState('landorus-therian')
  const [move, setMove] = useState('earthquake')
  const [atkSPs, setAtkSPs] = useState([0,0,0,0,0,0])
  const [defSPs, setDefSPs] = useState([0,0,0,0,0,0])
  const [atkNature, setAtkNature] = useState('')
  const [defNature, setDefNature] = useState('')
  const [level, setLevel] = useState(50)
  const [result, setResult] = useState(null)

  const atkData = pokemonData[atkPokemon]
  const defData = pokemonData[defPokemon]

  const run = () => {
    const r = calculateDamage({
      attacker: { atkPokemon, atkSPs, atkNature: atkNature || null, level },
      defender: { defPokemon, defSPs, defNature: defNature || null },
      move,
      field: {},
    })
    setResult(r)
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-yellow-600 mb-4">
      <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-4">
        🐛 Debug Panel
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Attaccante</label>
          <input className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1"
            value={atkPokemon} onChange={e => setAtkPokemon(e.target.value)} />
          <div className="mt-2 grid grid-cols-3 gap-1">
            {STAT_NAMES.map((s, i) => (
              <div key={i}>
                <label className="text-xs text-gray-500">{s} SP</label>
                <input type="number" min="0" max="32"
                  className="w-full bg-gray-700 text-white text-xs rounded px-1 py-0.5"
                  value={atkSPs[i]}
                  onChange={e => {
                    const n = [...atkSPs]
                    n[i] = parseInt(e.target.value) || 0
                    setAtkSPs(n)
                  }} />
              </div>
            ))}
          </div>
          <input className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 mt-2"
            placeholder="Natura (es. adamant)" value={atkNature}
            onChange={e => setAtkNature(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Mossa</label>
          <input className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1"
            value={move} onChange={e => setMove(e.target.value)} />
          <label className="text-xs text-gray-400 block mt-2 mb-1">Livello</label>
          <input type="number" className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1"
            value={level} onChange={e => setLevel(parseInt(e.target.value) || 50)} />
          <button onClick={run}
            className="w-full mt-4 bg-yellow-500 text-gray-900 font-bold text-sm rounded py-2 hover:bg-yellow-400">
            Calcola
          </button>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Difensore</label>
          <input className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1"
            value={defPokemon} onChange={e => setDefPokemon(e.target.value)} />
          <div className="mt-2 grid grid-cols-3 gap-1">
            {STAT_NAMES.map((s, i) => (
              <div key={i}>
                <label className="text-xs text-gray-500">{s} SP</label>
                <input type="number" min="0" max="32"
                  className="w-full bg-gray-700 text-white text-xs rounded px-1 py-0.5"
                  value={defSPs[i]}
                  onChange={e => {
                    const n = [...defSPs]
                    n[i] = parseInt(e.target.value) || 0
                    setDefSPs(n)
                  }} />
              </div>
            ))}
          </div>
          <input className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 mt-2"
            placeholder="Natura (es. impish)" value={defNature}
            onChange={e => setDefNature(e.target.value)} />
        </div>
      </div>

      {result && (
        <div className="border-t border-gray-700 pt-4">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-xs text-gray-400 mb-1">Stat base {atkPokemon}</div>
              <div className="grid grid-cols-6 gap-1">
                {STAT_NAMES.map((s, i) => (
                  <div key={i} className="text-center">
                    <div className="text-xs text-gray-500">{s}</div>
                    <div className="text-xs text-white">{atkData?.stats[i] ?? '?'}</div>
                    <div className="text-xs text-teal-400">
                      {atkData ? calcFinalStat(atkData.stats[i], atkSPs[i], level, atkNature || null, i) : '?'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Stat base {defPokemon}</div>
              <div className="grid grid-cols-6 gap-1">
                {STAT_NAMES.map((s, i) => (
                  <div key={i} className="text-center">
                    <div className="text-xs text-gray-500">{s}</div>
                    <div className="text-xs text-white">{defData?.stats[i] ?? '?'}</div>
                    <div className="text-xs text-teal-400">
                      {defData ? calcFinalStat(defData.stats[i], defSPs[i], level, defNature || null, i) : '?'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded p-3">
            <div className={`text-sm font-bold mb-3 ${result.immune ? 'text-gray-400' : 'text-yellow-400'}`}>
              {result.immune
                ? '🚫 IMMUNE — danno 0'
                : `${result.minPct}% – ${result.maxPct}% (${result.minDmg}–${result.maxDmg} / ${result.defHP} HP)`
              }
            </div>
            {result.log && (
              <div className="space-y-1 mb-3">
                {result.log.map((line, i) => (
                  <div key={i} className="text-xs text-gray-300 font-mono">{line}</div>
                ))}
              </div>
            )}
            {!result.immune && (
              <div className="text-xs text-gray-500 font-mono border-t border-gray-700 pt-2">
                Rolls: {result.rolls.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}