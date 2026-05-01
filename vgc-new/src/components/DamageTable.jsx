import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'

const spriteUrl = (key) =>
  `https://play.pokemonshowdown.com/sprites/gen5/${key}.png`

function DamageCell({ attacker, defender, level, field }) {
  if (!attacker?.key || !defender?.key) {
    return (
      <td className="p-1 text-center border-l border-gray-700 text-gray-600 text-xs">
        —
      </td>
    )
  }

  const moves1 = (attacker.moves || []).filter(Boolean)
  const moves2 = (defender.moves || []).filter(Boolean)

  const bestMove = (atk, def, moves) => {
    let best = null
    for (const move of moves) {
      const result = calculateDamage({
        attacker: { atkPokemon: atk.key, atkSPs: atk.sps, atkNature: atk.nature, level },
        defender: { defPokemon: def.key, defSPs: def.sps, defNature: def.nature },
        move,
        field,
      })
      if (!result || result.immune) continue
      if (!best || result.maxPct > best.maxPct) best = { ...result, move }
    }
    return best
  }

  const d1 = moves1.length > 0 ? bestMove(attacker, defender, moves1) : null
  const d2 = moves2.length > 0 ? bestMove(defender, attacker, moves2) : null

  const colorClass = (pct) => {
    if (!pct) return 'text-teal-300'
    if (pct >= 100) return 'text-red-400'
    if (pct >= 50) return 'text-orange-400'
    if (pct <= 25) return 'text-green-400'
    return 'text-teal-300'
  }

  const bgClass = (pct) => {
    if (!pct) return ''
    if (pct >= 100) return 'bg-red-900/30'
    if (pct <= 25) return 'bg-green-900/20'
    return ''
  }

  return (
    <td className={`p-1 text-center border-l border-gray-700 ${d1 ? bgClass(d1.maxPct) : ''}`}>
      <div className="mb-1 pb-1 border-b border-gray-700/50">
        {d1 ? (
          <>
            <div className="text-gray-400 text-xs truncate">▶ {d1.move}</div>
            <div className={`font-medium text-xs ${colorClass(d1.maxPct)}`}>
              {d1.minPct}–{d1.maxPct}%
            </div>
          </>
        ) : (
          <div className="text-gray-600 text-xs">▶ —</div>
        )}
      </div>
      <div>
        {d2 ? (
          <>
            <div className="text-gray-400 text-xs truncate">◀ {d2.move}</div>
            <div className={`font-medium text-xs ${colorClass(d2.maxPct)}`}>
              {d2.minPct}–{d2.maxPct}%
            </div>
          </>
        ) : (
          <div className="text-gray-600 text-xs">◀ —</div>
        )}
      </div>
    </td>
  )
}

export default function DamageTable() {
  const team1 = useCalcStore((s) => s.team1)
  const team2 = useCalcStore((s) => s.team2)
  const level = useCalcStore((s) => s.level)
  const weather = useCalcStore((s) => s.weather)
  const terrain = useCalcStore((s) => s.terrain)
  const helpingHand = useCalcStore((s) => s.helpingHand)
  const auroraVeil = useCalcStore((s) => s.auroraVeil)
  const lightScreen = useCalcStore((s) => s.lightScreen)
  const reflect = useCalcStore((s) => s.reflect)
  const crit = useCalcStore((s) => s.crit)
  const doubleTarget = useCalcStore((s) => s.doubleTarget)

  const field = {
    weather, terrain,
    helpingHand: helpingHand.t1,
    auroraVeil: auroraVeil.t1,
    lightScreen: lightScreen.t1,
    reflect: reflect.t1,
    crit: crit.t1,
    doubleTarget,
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700 mt-4">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="bg-gray-900 p-2 text-gray-500 font-medium text-center w-20">
              T1 \ T2
            </th>
            {team2.map((p, i) => (
              <th key={i} className="bg-gray-900 p-2 text-center font-medium min-w-24">
                {p?.key ? (
                  <>
                    <img
                      src={spriteUrl(p.key)}
                      alt={p.key}
                      className="w-12 h-12 object-contain mx-auto"
                      onError={e => e.target.style.display = 'none'}
                    />
                    <div className="text-gray-300 text-xs capitalize mt-1">{p.key}</div>
                  </>
                ) : (
                  <div className="text-gray-600">— T2 {i + 1} —</div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {team1.map((row, ri) => (
            <tr key={ri} className="border-t border-gray-700">
              <td className="bg-gray-900 p-2 text-center">
                {row?.key ? (
                  <>
                    <img
                      src={spriteUrl(row.key)}
                      alt={row.key}
                      className="w-12 h-12 object-contain mx-auto"
                      onError={e => e.target.style.display = 'none'}
                    />
                    <div className="text-gray-300 text-xs capitalize mt-1">{row.key}</div>
                  </>
                ) : (
                  <div className="text-gray-600">— T1 {ri + 1} —</div>
                )}
              </td>
              {team2.map((col, ci) => (
                <DamageCell
                  key={ci}
                  attacker={row}
                  defender={col}
                  level={level}
                  field={field}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}