import { calcFinalStat, STAT_NAMES } from '../../utils/statCalc'
import { NATURE_MODIFIERS } from '../../data/natures.js'

const BOOST_NUM = [2,2,2,2,2,2,1,3,4,5,6,7,8]
const BOOST_DEN = [8,7,6,5,4,3,1,2,2,2,2,2,2]

// ─── StatRow ─────────────────────────────────────────────────────────────────

export default function StatRow({ statIdx, base, sp, level, nature, boostVal, onSpChange, onBoostChange, speedWeatherActive }) {
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