import { useMemo } from 'react'
import movesData from '../data/moves.json'
import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'
import { NATURE_MODIFIERS } from '../data/natures'

function calcHKO(minPct) {
  if (minPct <= 0) return null
  const hits = Math.ceil(100 / minPct)
  if (hits === 1) return 'guaranteed OHKO'
  if (hits === 2) return 'guaranteed 2HKO'
  if (hits === 3) return 'guaranteed 3HKO'
  return `guaranteed ${hits}HKO`
}

function buildSmogonString(atk, def, move) {
  const moveData = movesData[move]
  if (!moveData) return ''

  const isSpecial = moveData.category === 1
  const atkStatIdx = isSpecial ? 3 : 1
  const defStatIdx = isSpecial ? 4 : 2

  const atkSP = atk.sps?.[atkStatIdx] || 0
  const defSP = def.sps?.[defStatIdx] || 0
  const defHP = def.sps?.[0] || 0

  const nature = atk.nature
  const mod = nature && NATURE_MODIFIERS[nature]
  const isBoost = mod && mod[0] !== 0 && mod[0] === atkStatIdx
  const isDrop  = mod && mod[0] !== 0 && mod[1] === atkStatIdx
  const natSymbol = isBoost ? '+' : isDrop ? '-' : ''

  const statName = isSpecial ? 'SpA' : 'Atk'
  const defStatName = isSpecial ? 'SpD' : 'Def'

  const moveName = move.replace(/-/g, ' ')
  const atkAbilityName = atk.ability ? ` ${atk.ability.replace(/\b\w/g, c => c.toUpperCase())}` : ''
  const atkItemName = atk.item ? ` ${atk.item.replace(/\b\w/g, c => c.toUpperCase())}` : ''
  const defItemName = def.item ? ` ${def.item.replace(/\b\w/g, c => c.toUpperCase())}` : ''

return `${atkSP}${natSymbol} ${statName}${atkAbilityName}${atkItemName} ${atk.key} ${moveName} vs. ${defHP} HP / ${defSP} ${defStatName}${defItemName} ${def.key}`
}

export default function ReportPanel({ selection, onClose }) {
  const doubleTarget = useCalcStore(s => s.doubleTarget)
  const weather      = useCalcStore(s => s.weather)
  const terrain      = useCalcStore(s => s.terrain)
  const helpingHand  = useCalcStore(s => s.helpingHand)
  const auroraVeil   = useCalcStore(s => s.auroraVeil)
  const lightScreen  = useCalcStore(s => s.lightScreen)
  const reflect      = useCalcStore(s => s.reflect)
  const crit         = useCalcStore(s => s.crit)

  const allMoves = useMemo(() => {
    if (!selection) return []
    const { atk, def, dir } = selection

    const field = {
      weather, terrain, doubleTarget,
      helpingHand: dir === 't1' ? helpingHand.t1 : helpingHand.t2,
      auroraVeil:  dir === 't1' ? auroraVeil.t2  : auroraVeil.t1,
      lightScreen: dir === 't1' ? lightScreen.t2  : lightScreen.t1,
      reflect:     dir === 't1' ? reflect.t2      : reflect.t1,
      crit:        dir === 't1' ? crit.t1         : crit.t2,
    }

    return (atk.moves || []).filter(Boolean).map(move => {
      const result = calculateDamage({
        attacker: {
          atkPokemon: atk.key,
          atkSPs: atk.sps || [0,0,0,0,0,0],
          atkNature: atk.nature,
          atkBoost: atk.atkBoost || 0,
          spAtkBoost: atk.spAtkBoost || 0,
          atkItem: atk.item || null,
          atkAbility: atk.ability || null,
          level: 50,
        },
        defender: {
          defPokemon: def.key,
          defSPs: def.sps || [0,0,0,0,0,0],
          defNature: def.nature,
          defBoost: def.defBoost || 0,
          spDefBoost: def.spDefBoost || 0,
          defItem: def.item || null,
          defAbility: def.ability || null,
        },
        move,
        field,
      })
      return { move, result }
    }).filter(({ result }) => result && !result.immune && result.maxPct > 0)
  }, [selection, doubleTarget, weather, terrain, helpingHand, auroraVeil, lightScreen, reflect, crit])

  if (!selection) return null
  const { atk, def } = selection

  return (
    <div className="bg-gray-800 rounded-xl border border-teal-500/50 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-teal-400 capitalize">{atk.key}</span>
          <span className="text-gray-500">→</span>
          <span className="text-sm font-medium text-gray-300 capitalize">{def.key}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors"
        >
          ✕ chiudi
        </button>
      </div>

      {allMoves.length === 0 ? (
        <div className="text-gray-500 text-xs">Nessuna mossa offensiva disponibile.</div>
      ) : (
        <div className="space-y-3">
          {allMoves.map(({ move, result }) => {
            const hko = calcHKO(result.minPct)
            const smogon = buildSmogonString(atk, def, move)
            const rolls = result.rolls

            const hkoColor = result.minPct >= 100 ? 'text-red-400' :
                             result.minPct >= 50  ? 'text-orange-400' :
                             result.minPct >= 25  ? 'text-teal-300' : 'text-green-400'

            return (
              <div key={move} className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white capitalize">
                    {move.replace(/-/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${hkoColor}`}>
                      {result.minPct}–{result.maxPct}%
                    </span>
                    {hko && (
                      <span className={`text-xs px-2 py-0.5 rounded border ${
                        result.minPct >= 100
                          ? 'border-red-500/50 text-red-400 bg-red-900/20'
                          : 'border-gray-600 text-gray-400'
                      }`}>
                        {hko}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-2 font-mono">
                  {smogon}: {result.minDmg}–{result.maxDmg} / {result.defHP} HP
                </div>

                <div className="flex flex-wrap gap-1">
                  {rolls.map((r, i) => (
                    <span
                      key={i}
                      className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                        r >= result.defHP
                          ? 'bg-red-900/40 text-red-300'
                          : 'bg-gray-700/60 text-gray-400'
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}