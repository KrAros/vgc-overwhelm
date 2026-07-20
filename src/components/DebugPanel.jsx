import { useState } from 'react'
import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'
import pokemonData from '../data/pokemon.json'
import { calcFinalStat, STAT_NAMES } from '../utils/statCalc'

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

  // Legge weather, terrain e modificatori dallo store
  const weather      = useCalcStore((s) => s.weather)
  const terrain      = useCalcStore((s) => s.terrain)
  const helpingHand  = useCalcStore((s) => s.helpingHand)
  const auroraVeil   = useCalcStore((s) => s.auroraVeil)
  const lightScreen  = useCalcStore((s) => s.lightScreen)
  const reflect      = useCalcStore((s) => s.reflect)
  const crit         = useCalcStore((s) => s.crit)
  const doubleTarget = useCalcStore((s) => s.doubleTarget)

  const atkData = pokemonData[atkPokemon]
  const defData = pokemonData[defPokemon]

  const run = () => {
    const field = {
      weather,
      terrain,
      helpingHand: helpingHand.t1,
      auroraVeil:  auroraVeil.t1,
      lightScreen: lightScreen.t1,
      reflect:     reflect.t1,
      crit:        crit.t1,
      doubleTarget,
    }

    const r = calculateDamage({
      attacker: { atkPokemon, atkSPs, atkNature: atkNature || null, level },
      defender: { defPokemon, defSPs, defNature: defNature || null },
      move,
      field,
    })
    setResult(r)
  }

  const weatherLabel = {
    sun: '☀️ Sole', rain: '🌧️ Pioggia',
    sand: '🏜️ Sabbia', snow: '❄️ Snow',
  }
  const terrainLabel = {
    electric: '⚡ Electric', grassy: '🌿 Grassy',
    misty: '🌫️ Misty', psychic: '🔮 Psychic',
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-yellow-600 mb-4">
      <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-2">
        🐛 Debug Panel
      </h2>

      {/* Stato campo attivo dallo store */}
      <div className="flex gap-2 flex-wrap mb-4 text-xs">
        {weather && (
          <span className="px-2 py-0.5 rounded bg-orange-900/40 text-orange-300 border border-orange-700">
            {weatherLabel[weather] || weather}
          </span>
        )}
        {terrain && (
          <span className="px-2 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-700">
            {terrainLabel[terrain] || terrain}
          </span>
        )}
        {helpingHand.t1 && <span className="px-2 py-0.5 rounded bg-teal-900/40 text-teal-300 border border-teal-700">Helping Hand ←</span>}
        {helpingHand.t2 && <span className="px-2 py-0.5 rounded bg-teal-900/40 text-teal-300 border border-teal-700">Helping Hand →</span>}
        {reflect.t1 && <span className="px-2 py-0.5 rounded bg-yellow-900/40 text-yellow-300 border border-yellow-700">Reflect ←</span>}
        {lightScreen.t1 && <span className="px-2 py-0.5 rounded bg-yellow-900/40 text-yellow-300 border border-yellow-700">Light Screen ←</span>}
        {auroraVeil.t1 && <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700">Aurora Veil ←</span>}
        {crit.t1 && <span className="px-2 py-0.5 rounded bg-red-900/40 text-red-300 border border-red-700">Crit ←</span>}
        {!weather && !terrain && !helpingHand.t1 && !reflect.t1 && !lightScreen.t1 && !auroraVeil.t1 && !crit.t1 && (
          <span className="text-gray-600">Nessun modificatore attivo</span>
        )}
      </div>

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
              <div className="text-xs text-gray-400 mb-1">Stat {atkPokemon}</div>
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
              <div className="text-xs text-gray-400 mb-1">Stat {defPokemon}</div>
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