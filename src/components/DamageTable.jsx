import { useState } from 'react'
import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'
import pokemonData from '../data/pokemon.json'
import movesData from '../data/moves.json'

const spriteUrl = (key) => {
  const data = pokemonData[key]
  if (!data) return null
  const isMegaX = key.includes('-mega-x')
  const isMegaY = key.includes('-mega-y')
  const isMega  = data.mega === 1
  let num = data.num
  if (isMega) {
    const baseName = key.replace(/-mega.*$/, '')
    num = pokemonData[baseName]?.num || ''
  }
  num = num?.replace('#', '').padStart(4, '0')
  if (!num) return null
  const form = isMegaY ? 'f02' : isMegaX ? 'f01' : isMega ? 'f01' : 'f00'
  return `https://resource.pokemon-home.com/battledata/img/pokei128/icon${num}_${form}_s0.png`
}

const SpreadIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="5" y1="9" x2="5" y2="5" />
    <line x1="5" y1="5" x2="2" y2="1" />
    <line x1="5" y1="5" x2="8" y2="1" />
    <polygon points="2,1 0,3 4,3" fill="currentColor" stroke="none" />
    <polygon points="8,1 6,3 10,3" fill="currentColor" stroke="none" />
  </svg>
)

// Testo e stile per il badge immune — distingue tipo vs abilità specifica
function immuneLabel(result) {
  if (!result?.immune) return null
  if (result.reason === 'ability') {
    return { text: `Immune (${result.abilityName})`, cls: 'text-purple-400' }
  }
  return { text: 'Immune (tipo)', cls: 'text-gray-500' }
}

function calcAllMoves(atk, def, level, field) {
  return (atk.moves || []).filter(Boolean).map(move => {
    const result = calculateDamage({
      attacker: {
        atkPokemon:      atk.key,
        atkSPs:          atk.sps || [0,0,0,0,0,0],
        atkNature:       atk.nature,
        atkBoost:        atk.atkBoost || 0,
        spAtkBoost:      atk.spAtkBoost || 0,
        atkItem:         atk.item || null,
        atkAbility:      atk.ability || null,
        atkAbilityFlags: atk.abilityFlags || {},
        level,
      },
      defender: {
        defPokemon:      def.key,
        defSPs:          def.sps || [0,0,0,0,0,0],
        defNature:       def.nature,
        defBoost:        def.defBoost || 0,
        spDefBoost:      def.spDefBoost || 0,
        defItem:         def.item || null,
        defAbility:      def.ability || null,
        defAbilityFlags: def.abilityFlags || {},
      },
      move,
      field,
    })
    return { move, result }
  })
  // Nota: NON filtriamo le immune qui — le teniamo per mostrarle nelle celle dettaglio.
  // Il filtro avviene in getBestMove per scegliere la mossa migliore.
}

function getBestMove(atk, def, level, field) {
  const all = calcAllMoves(atk, def, level, field)
  // Per il "best move" consideriamo solo mosse che effettivamente danneggiano
  const effective = all.filter(({ result }) => result && !result.immune && result.maxPct > 0)
  if (!effective.length) return null
  return effective.reduce((best, cur) =>
    cur.result.maxPct > best.result.maxPct ? cur : best
  )
}

function DamageCell({ attacker, defender, level, field, fieldReversed, onSelect, selectedDir, isSelected }) {
  if (!attacker?.key || !defender?.key) {
    return (
      <td className="p-1 text-center border-l border-gray-700 text-gray-600 text-xs">—</td>
    )
  }

  // Calcola tutte le mosse (incluse le immune) per entrambe le direzioni
  const allMovesT1 = calcAllMoves(attacker, defender, level, field)
  const allMovesT2 = calcAllMoves(defender, attacker, level, fieldReversed)

  const d1 = getBestMove(attacker, defender, level, field)
  const d2 = getBestMove(defender, attacker, level, fieldReversed)

  // Se non c'è un best move, verifica se ci sono solo mosse immune da mostrare
  const firstImmuneT1 = !d1
    ? allMovesT1.find(({ result }) => result?.immune)
    : null
  const firstImmuneT2 = !d2
    ? allMovesT2.find(({ result }) => result?.immune)
    : null

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

  const cellBorder = isSelected ? 'ring-2 ring-teal-400 ring-inset' : ''

  const renderHalf = (d, immune, prefix, dir, atk, def, f) => {
    const label = immune ? immuneLabel(immune.result) : null
    return (
      <div
        onClick={() => onSelect(dir, atk, def, f)}
        className={`p-1 text-center cursor-pointer hover:bg-gray-700/40 transition-colors ${
          dir === 't1' ? 'border-b border-gray-700/50' : ''
        } ${isSelected && selectedDir === dir ? 'bg-teal-900/30' : d ? bgClass(d.result.maxPct) : ''}`}
      >
        {d ? (
          <>
            <div className="text-gray-400 text-xs truncate flex items-center justify-center gap-1">
              {prefix} {d.move}
              {movesData[d.move]?.spread === true && (
                <span title="Spread move — colpisce entrambi gli avversari" className="text-yellow-400 inline-flex items-center">
                  <SpreadIcon />
                </span>
              )}
            </div>
            <div className={`font-medium text-xs ${colorClass(d.result.maxPct)}`}>
              {d.result.minPct}–{d.result.maxPct}%
            </div>
          </>
        ) : label ? (
          // Mostra il badge immune con il nome della mossa se disponibile
          <>
            <div className="text-gray-500 text-xs truncate">
              {prefix} {immune.move}
            </div>
            <div className={`text-[10px] font-medium ${label.cls}`}>
              {label.text}
            </div>
          </>
        ) : (
          <div className="text-gray-600 text-xs">{prefix} —</div>
        )}
      </div>
    )
  }

  return (
    <td className={`border-l border-gray-700 ${cellBorder} relative`}>
      {renderHalf(d1, firstImmuneT1, '▶', 't1', attacker, defender, field)}
      {renderHalf(d2, firstImmuneT2, '◀', 't2', defender, attacker, fieldReversed)}
    </td>
  )
}

export default function DamageTable({ onCellSelect }) {
  const [selected, setSelected] = useState(null)

  const team1 = useCalcStore(s => s.team1)
  const team2 = useCalcStore(s => s.team2)
  const level = useCalcStore(s => s.level)
  const weather = useCalcStore(s => s.weather)
  const terrain = useCalcStore(s => s.terrain)
  const helpingHand = useCalcStore(s => s.helpingHand)
  const auroraVeil  = useCalcStore(s => s.auroraVeil)
  const lightScreen = useCalcStore(s => s.lightScreen)
  const reflect     = useCalcStore(s => s.reflect)
  const crit        = useCalcStore(s => s.crit)
  const doubleTarget = useCalcStore(s => s.doubleTarget)

  const field = {
    weather, terrain,
    helpingHand: helpingHand.t1,
    auroraVeil:  auroraVeil.t2,
    lightScreen: lightScreen.t2,
    reflect:     reflect.t2,
    crit:        crit.t1,
    doubleTarget,
  }

  const fieldReversed = {
    weather, terrain,
    helpingHand: helpingHand.t2,
    auroraVeil:  auroraVeil.t1,
    lightScreen: lightScreen.t1,
    reflect:     reflect.t1,
    crit:        crit.t2,
    doubleTarget,
  }

  const handleSelect = (ri, ci, dir, atk, def, f) => {
    const key = `${ri}-${ci}-${dir}`
    // Per il pannello dettaglio passiamo tutte le mosse incluse le immune
    const allMoves = calcAllMoves(atk, def, level, f)
    const newSelected = { key, ri, ci, dir, atk, def, field: f, allMoves }
    setSelected(newSelected)
    onCellSelect?.(newSelected)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700 mb-4">
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
                      onError={e => e.target.style.display='none'}
                    />
                    <div className="text-gray-300 text-xs capitalize mt-1">{p.key}</div>
                  </>
                ) : (
                  <div className="text-gray-600">— T2 {i+1} —</div>
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
                      onError={e => e.target.style.display='none'}
                    />
                    <div className="text-gray-300 text-xs capitalize mt-1">{row.key}</div>
                  </>
                ) : (
                  <div className="text-gray-600">— T1 {ri+1} —</div>
                )}
              </td>
              {team2.map((col, ci) => (
                <DamageCell
                  key={ci}
                  attacker={row}
                  defender={col}
                  level={level}
                  field={field}
                  fieldReversed={fieldReversed}
                  isSelected={selected?.ri === ri && selected?.ci === ci}
                  selectedDir={selected?.ri === ri && selected?.ci === ci ? selected.dir : null}
                  onSelect={(dir, atk, def, f) => handleSelect(ri, ci, dir, atk, def, f)}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}