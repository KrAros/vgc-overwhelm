import { useState } from 'react'
import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'
import movesData from '../data/moves.json'
import { spriteUrl, fallbackSpriteUrl } from '../utils/sprite'

const SpreadIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="5" y1="9" x2="5" y2="5" />
    <line x1="5" y1="5" x2="2" y2="1" />
    <line x1="5" y1="5" x2="8" y2="1" />
    <polygon points="2,1 0,3 4,3" fill="currentColor" stroke="none" />
    <polygon points="8,1 6,3 10,3" fill="currentColor" stroke="none" />
  </svg>
)

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
}

function getBestMove(atk, def, level, field) {
  const all = calcAllMoves(atk, def, level, field)
  const effective = all.filter(({ result }) => result && !result.immune && result.maxPct > 0)
  if (!effective.length) return null
  return effective.reduce((best, cur) =>
    cur.result.maxPct > best.result.maxPct ? cur : best
  )
}

// ── DamageCell ────────────────────────────────────────────────────────────────
// selectionState: { first: {ri,ci,dir} | null, second: {ri,ci,dir} | null }
// onSelect: (ri, ci, dir, atk, def, field) => void

function DamageCell({ attacker, defender, level, field, fieldReversed, onSelect, ri, ci, selectionState, showKoOnly, selRi, selCi }) {
  // Oscura le celle non sulla riga/colonna selezionata
  const hasSelection = selRi !== null && selCi !== null
  const isOnAxis = ri === selRi || ci === selCi
  const dimCell = hasSelection && !isOnAxis
  if (!attacker?.key || !defender?.key) {
    if (showKoOnly) return <td className="border-l border-gray-700 opacity-0 pointer-events-none"><div className="p-1 h-8" /></td>
    return (
      <td className="p-1 text-center border-l border-gray-700 text-gray-600 text-xs">—</td>
    )
  }

  const allMovesT1 = calcAllMoves(attacker, defender, level, field)
  const allMovesT2 = calcAllMoves(defender, attacker, level, fieldReversed)

  const d1 = getBestMove(attacker, defender, level, field)
  const d2 = getBestMove(defender, attacker, level, fieldReversed)

  const firstImmuneT1 = !d1 ? allMovesT1.find(({ result }) => result?.immune) : null
  const firstImmuneT2 = !d2 ? allMovesT2.find(({ result }) => result?.immune) : null

  // KO filter: nascondi cella se né t1 né t2 raggiunge il 100%
  if (showKoOnly) {
    const t1Ko = d1 && d1.result.maxPct >= 100
    const t2Ko = d2 && d2.result.maxPct >= 100
    if (!t1Ko && !t2Ko) {
      return (
        <td className="border-l border-gray-700 opacity-0 pointer-events-none"><div className="p-1 h-8" /></td>
      )
    }
  }

  // Quando showKoOnly è attivo, la metà che non fa KO viene silenziata visivamente
  const koFilterDimT1 = showKoOnly && !(d1 && d1.result.maxPct >= 100)
  const koFilterDimT2 = showKoOnly && !(d2 && d2.result.maxPct >= 100)

  const colorClass = (pct) => {
    if (!pct) return 'text-teal-300'
    if (pct >= 100) return 'text-red-400'
    if (pct >= 50)  return 'text-orange-400'
    if (pct <= 25)  return 'text-green-400'
    return 'text-teal-300'
  }

  const bgClass = (pct) => {
    if (!pct) return ''
    if (pct >= 100) return 'bg-red-900/30'
    if (pct <= 25)  return 'bg-green-900/20'
    return ''
  }

  // Determina lo stato visivo di questa cella
  const { first, second } = selectionState
  const isFirst  = first  && first.ri  === ri && first.ci  === ci
  const isSecond = second && second.ri === ri && second.ci === ci

  // Ring attorno alla td intera
  const cellRing = isFirst
    ? 'ring-2 ring-teal-400 ring-inset'
    : isSecond
    ? 'ring-2 ring-violet-400 ring-inset'
    : ''

  const renderHalf = (d, immune, prefix, dir, dim = false) => {
    const label = immune ? immuneLabel(immune.result) : null

    // Sfondo della singola metà (sopra/sotto) quando è quella selezionata
    const halfSelected =
      (isFirst  && first.dir  === dir) ? 'bg-teal-900/40'   :
      (isSecond && second.dir === dir) ? 'bg-violet-900/40' :
      d ? bgClass(d.result.maxPct) : ''

    return (
      <div
        onClick={() => { const [a,d,m] = dir === 't1' ? [attacker, defender, allMovesT1] : [defender, attacker, allMovesT2]; onSelect(ri, ci, dir, a, d, field, m, m) }}
        className={`p-1 text-center cursor-pointer hover:bg-gray-700/40 transition-colors ${
          dir === 't1' ? 'border-b border-gray-700/50' : ''
        } ${halfSelected} ${dim ? 'opacity-20 pointer-events-none' : ''}`}
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
    <td className={`border-l border-gray-700 ${cellRing} relative transition-opacity ${dimCell ? 'opacity-30' : ''}`}>
      {renderHalf(d1, firstImmuneT1, '▶', 't1', koFilterDimT1)}
      {renderHalf(d2, firstImmuneT2, '◀', 't2', koFilterDimT2)}
    </td>
  )
}

// ── DamageTable ───────────────────────────────────────────────────────────────

export default function DamageTable({ onCellSelect }) {
  // Doppia selezione: { first, second }
  // Ogni entry: { ri, ci, dir, atk, def, field, allMoves } | null
  const [selectionState, setSelectionState] = useState({ first: null, second: null })
  const showKoOnly = useCalcStore(s => s.showKoOnly)

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

  const setWeatherDirect = useCalcStore(s => s.setWeatherDirect)

  // Mappa abilità → meteo automatico al click cella
  const ABILITY_WEATHER = {
    'drizzle':        'rain',
    'primordial sea': 'heavy rain',
    'drought':        'sun',
    'desolate land':  'harsh sunshine',
    'sand stream':    'sand',
    'snow warning':   'snow',
  }

  const handleSelect = (ri, ci, dir, atk, def, f, allMovesT1, allMovesT2) => {
    // Auto-weather: attaccante ha priorità sul difensore
    const atkAbility = (atk?.ability || '').toLowerCase()
    const defAbility = (def?.ability || '').toLowerCase()
    const autoWeather = ABILITY_WEATHER[atkAbility] || ABILITY_WEATHER[defAbility] || null
    if (autoWeather) setWeatherDirect(autoWeather)
    // allMoves per il pannello: le mosse dell'attaccante corrente
    const allMoves = dir === 't1' ? allMovesT1 : allMovesT2

    const atkTeam  = dir === 't1' ? 'team1' : 'team2'
    const defTeam  = dir === 't1' ? 'team2' : 'team1'
    const atkIndex = dir === 't1' ? ri : ci
    const defIndex = dir === 't1' ? ci : ri

    const entry = { ri, ci, dir, atk, def, field: f, allMoves, atkTeam, atkIndex, defTeam, defIndex }

    setSelectionState(prev => {
      const { first, second } = prev

      // Click sulla stessa cella+dir già selezionata come prima → deseleziona tutto
      if (first && first.ri === ri && first.ci === ci && first.dir === dir) {
        onCellSelect?.(null)
        return { first: null, second: null }
      }

      // Click sulla stessa cella+dir già selezionata come seconda → deseleziona la seconda
      if (second && second.ri === ri && second.ci === ci && second.dir === dir) {
        onCellSelect?.([first])
        return { first, second: null }
      }

      // Nessuna prima selezione → prima selezione
      if (!first) {
        onCellSelect?.([entry])
        return { first: entry, second: null }
      }

      // C'è una prima selezione.
      // t1 attacca T2: stesso difensore = stessa colonna (ci), riga diversa
      // t2 attacca T1: stesso difensore = stessa riga (ri), colonna diversa
      const sameDefender = first.dir === dir && (
        dir === 't1' ? (first.ci === ci && first.ri !== ri) :
                       (first.ri === ri && first.ci !== ci)
      )
      if (sameDefender) {
        const newState = { first, second: entry }
        onCellSelect?.([first, entry])
        return newState
      }

      // Tutto il resto → nuova prima selezione (reset)
      onCellSelect?.([entry])
      return { first: entry, second: null }
    })
  }

  // Riga e colonna selezionate (per highlight)
  const selRi = selectionState.first?.ri ?? null
  const selCi = selectionState.first?.ci ?? null

  return (
    <div className="mb-4">
      {/* Indicatore modalità cumulativa */}
      {selectionState.second && (
        <div className="mb-2 px-1">
          <span className="text-xs text-violet-400">
            📌 Modalità cumulativa attiva — vedi ReportPanel
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {/* Intestazione angolo — sticky su mobile */}
              <th className="sticky left-0 top-0 z-20 bg-gray-900 p-2 text-gray-500 font-medium text-center w-[80px] min-w-[80px] max-w-[80px] border-r border-gray-700/50">
                T1 \ T2
              </th>
              {team2.map((p, i) => (
                <th key={i} className={`sticky top-0 z-10 p-2 text-center font-medium w-[100px] min-w-[100px] max-w-[100px] overflow-hidden transition-colors ${
                  selCi === i ? 'bg-teal-900/40' : 'bg-gray-900'
                }`}>
                  {p?.key ? (
                    <>
                      <img
                        src={spriteUrl(p.key)}
                        alt={p.key}
                        className="w-8 h-8 sm:w-12 sm:h-12 object-contain mx-auto"
                        onError={e => {
                          const fb = fallbackSpriteUrl(p.key)
                          if (fb && e.target.src !== fb) { e.target.src = fb } else { e.target.style.display = 'none' }
                        }}
                      />
                      <div className="text-gray-300 text-[10px] sm:text-xs capitalize mt-0.5 sm:mt-1 truncate max-w-[4rem] sm:max-w-none mx-auto">{p.key.split('-')[0]}</div>
                    </>
                  ) : (
                    <div className="text-gray-600 text-[10px]">T2·{i+1}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team1.map((row, ri) => (
              <tr key={ri} className={`border-t border-gray-700 transition-colors ${selRi === ri ? 'bg-teal-900/20' : ''}`}>
                {/* Prima colonna sticky — rimane visibile durante lo scroll orizzontale */}
                <td className={`sticky left-0 z-10 p-2 text-center border-r border-gray-700/50 w-[80px] min-w-[80px] max-w-[80px] h-14 overflow-hidden transition-colors ${
                  selRi === ri ? 'bg-teal-900/40' : 'bg-gray-900'
                }`}>
                  {row?.key ? (
                    <>
                      <img
                        src={spriteUrl(row.key)}
                        alt={row.key}
                        className="w-8 h-8 sm:w-12 sm:h-12 object-contain mx-auto"
                        onError={e => {
                          const fb = fallbackSpriteUrl(row.key)
                          if (fb && e.target.src !== fb) { e.target.src = fb } else { e.target.style.display = 'none' }
                        }}
                      />
                      <div className="text-gray-300 text-[10px] sm:text-xs capitalize mt-0.5 sm:mt-1 truncate max-w-[3.5rem] sm:max-w-none mx-auto">{row.key.split('-')[0]}</div>
                    </>
                  ) : (
                    <div className="text-gray-600 text-[10px]">T1·{ri+1}</div>
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
                    ri={ri}
                    ci={ci}
                    selectionState={selectionState}
                    onSelect={handleSelect}
                    showKoOnly={showKoOnly}
                    selRi={selRi}
                    selCi={selCi}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}