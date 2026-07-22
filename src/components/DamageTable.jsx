import { useState } from 'react'
import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'
import movesData from '../data/moves.json'
import pokemonData from '../data/pokemon.json'
import { spriteUrl, fallbackSpriteUrl, itemIconUrl } from '../utils/sprite'
import { calcFinalStat } from '../utils/statCalc'

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

// Formatta il nome del Pokémon per la tabella — gestisce forme Mega
function formatPokeName(key) {
  if (!key) return ''
  if (key.endsWith('-mega') || key.endsWith('-mega-x') || key.endsWith('-mega-y')) {
    const base = key.replace(/-mega-[xy]$/, '').replace(/-mega$/, '')
    const suffix = key.includes('-mega-x') ? ' M·X' : key.includes('-mega-y') ? ' M·Y' : ' Mega'
    return base.charAt(0).toUpperCase() + base.slice(1) + suffix
  }
  return key.split('-')[0]
}
// ── Speed tier helpers ────────────────────────────────────────────────────────

const SPEED_WEATHER_CONDITIONS = {
  'sand-rush':   ['sand', 'sandstorm'],
  'chlorophyll': ['sun', 'harsh sunshine'],
  'swift swim':  ['rain', 'heavy rain'],
  'slush-rush':  ['snow', 'hail'],
}

const BOOST_NUM = [2,2,2,2,2,2,2,3,4,5,6,7,8]
const BOOST_DEN = [8,7,6,5,4,3,2,2,2,2,2,2,2]

function calcEffectiveSpe(pokemon, weather) {
  if (!pokemon?.key) return 0
  const base = pokemonData[pokemon.key]?.stats?.[5] ?? 0
  const sp   = pokemon.sps?.[5] ?? 0
  const boostVal = pokemon.speBoost ?? 0

  let spe = calcFinalStat(base, sp, 50, pokemon.nature, 5)

  // Boost stage
  if (boostVal !== 0) {
    spe = Math.floor(spe * BOOST_NUM[6 + boostVal] / BOOST_DEN[6 + boostVal])
  }

  // Abilità meteo-velocità
  const abilityKey = (pokemon.ability || '').toLowerCase()
  const conditions = SPEED_WEATHER_CONDITIONS[abilityKey] || []
  if (conditions.includes((weather || '').toLowerCase())) {
    spe = spe * 2
  }

  return spe
}

// Restituisce 't1' se T1 va prima, 't2' se T2 va prima, null se tie
function whoGoesFirst(t1, t2, bestMoveT1, bestMoveT2, weather, trickRoom) {
  const p1 = movesData[bestMoveT1?.move]?.priority ?? 0
  const p2 = movesData[bestMoveT2?.move]?.priority ?? 0

  if (p1 !== p2) return p1 > p2 ? 't1' : 't2'

  const spe1 = calcEffectiveSpe(t1, weather)
  const spe2 = calcEffectiveSpe(t2, weather)

  if (spe1 === spe2) return null  // tie
  if (trickRoom) return spe1 < spe2 ? 't1' : 't2'
  return spe1 > spe2 ? 't1' : 't2'
}

// ─────────────────────────────────────────────────────────────────────────────

function DamageCell({ attacker, defender, level, field, fieldReversed, onSelect, ri, ci, selectionState, showKoOnly, isOnAxis, hasSelection, selDir }) {
  // Oscura le celle non sull'asse del difensore
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

  // Speed tier: chi va prima?
  const speedFirst = whoGoesFirst(attacker, defender, d1, d2, field.weather, field.trickRoom)
  const goesFirstT1 = speedFirst === 't1'
  const goesFirstT2 = speedFirst === 't2'

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

  const renderHalf = (d, immune, prefix, dir, dim = false, goesFirst = false) => {
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
              {goesFirst && (
                <span className="text-yellow-400 text-[9px] font-bold ml-0.5" title="Va per primo">⚡</span>
              )}
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
    <td className={`border-l border-gray-700 ${cellRing} relative transition-opacity w-[100px] min-w-[100px] max-w-[100px] ${dimCell && !isFirst && !isSecond ? 'opacity-30' : ''}`}>
      {renderHalf(d1, firstImmuneT1, '▶', 't1', koFilterDimT1 || (hasSelection && !dimCell && selDir === 't2'), goesFirstT1)}
      {renderHalf(d2, firstImmuneT2, '◀', 't2', koFilterDimT2 || (hasSelection && !dimCell && selDir === 't1'), goesFirstT2)}
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
  const trickRoom    = useCalcStore(s => s.trickRoom)
  const setEditorFocus = useCalcStore(s => s.setEditorFocus)

  // Click sprite → apri tab nel TeamEditor e scrolla
  const focusEditor = (team, index) => {
    setEditorFocus(team, index)
    setTimeout(() => {
      document.getElementById(`team-editor-${team}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const field = {
    weather, terrain,
    helpingHand: helpingHand.t1,
    auroraVeil:  auroraVeil.t2,
    lightScreen: lightScreen.t2,
    reflect:     reflect.t2,
    crit:        crit.t1,
    doubleTarget,
    trickRoom,
  }

  const fieldReversed = {
    weather, terrain,
    helpingHand: helpingHand.t2,
    auroraVeil:  auroraVeil.t1,
    lightScreen: lightScreen.t1,
    reflect:     reflect.t1,
    crit:        crit.t2,
    doubleTarget,
    trickRoom,
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
    if (autoWeather) setTimeout(() => setWeatherDirect(autoWeather), 0)
    // allMoves per il pannello: le mosse dell'attaccante corrente
    const allMoves = dir === 't1' ? allMovesT1 : allMovesT2

    const atkTeam  = dir === 't1' ? 'team1' : 'team2'
    const defTeam  = dir === 't1' ? 'team2' : 'team1'
    const atkIndex = dir === 't1' ? ri : ci
    const defIndex = dir === 't1' ? ci : ri

    const entry = { ri, ci, dir, atk, def, field: f, allMoves, atkTeam, atkIndex, defTeam, defIndex }

    let nextSel = null
    setSelectionState(prev => {
      const { first, second } = prev

      if (first && first.ri === ri && first.ci === ci && first.dir === dir) {
        nextSel = null
        return { first: null, second: null }
      }
      if (second && second.ri === ri && second.ci === ci && second.dir === dir) {
        nextSel = [first]
        return { first, second: null }
      }
      if (!first) {
        nextSel = [entry]
        return { first: entry, second: null }
      }
      const sameDefender = first.dir === dir && (
        dir === 't1' ? (first.ci === ci && first.ri !== ri) :
                       (first.ri === ri && first.ci !== ci)
      )
      if (sameDefender) {
        nextSel = [first, entry]
        return { first, second: entry }
      }
      nextSel = [entry]
      return { first: entry, second: null }
    })
    // Chiama onCellSelect dopo il ciclo di render
    setTimeout(() => onCellSelect?.(nextSel), 0)
  }

  // Riga e colonna selezionate (per highlight)
  const selRi    = selectionState.first?.ri  ?? null
  const selCi    = selectionState.first?.ci  ?? null
  const selDir   = selectionState.first?.dir ?? null

  // Logica oscuramento: tieni visibile solo l'asse del DIFENSORE
  // dir='t2' (T2 attacca T1): difensore è T1 → tieni riga selRi, oscura tutto il resto
  // dir='t1' (T1 attacca T2): difensore è T2 → tieni colonna selCi, oscura tutto il resto
  const getIsOnDefenderAxis = (ri, ci) => {
    if (selRi === null) return true
    if (selDir === 't2') return ri === selRi   // T2 attacca T1: riga del difensore T1
    if (selDir === 't1') return ci === selCi   // T1 attacca T2: colonna del difensore T2
    return ri === selRi || ci === selCi
  }

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
                <th key={i} className={`sticky top-0 z-10 p-2 text-center font-medium w-[100px] min-w-[100px] max-w-[100px] overflow-hidden transition-all ${
                  selRi !== null && selDir === 't1' && selCi === i
                    ? 'bg-teal-900/40'                          // difensore T2 (dir=t1)
                    : selRi !== null && selDir === 't2' && selCi === i
                    ? 'bg-orange-900/40'                        // attaccante T2 (dir=t2)
                    : selRi !== null && selDir === 't2' && selCi !== i
                    ? 'bg-gray-900 opacity-30'                  // altri T2 oscurati
                    : selRi !== null && selDir === 't1' && selCi !== i
                    ? 'bg-gray-900 opacity-30'                  // altri T2 oscurati
                    : 'bg-gray-900'
                }`}>
                  {p?.key ? (
                    <>
                      <div
                        className="relative inline-block cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => focusEditor('team2', i)}
                        title="Apri nel Team Editor"
                      >
                        <img
                          src={spriteUrl(p.key)}
                          alt={p.key}
                          className="w-8 h-8 sm:w-12 sm:h-12 object-contain mx-auto"
                          onError={e => {
                            const fb = fallbackSpriteUrl(p.key)
                            if (fb && e.target.src !== fb) { e.target.src = fb } else { e.target.style.display = 'none' }
                          }}
                        />
                        {p.item && (
                          <img
                            src={itemIconUrl(p.item)}
                            alt={p.item}
                            className="absolute bottom-0 right-0 w-4 h-4 object-contain"
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        )}
                      </div>
                      <div className="text-gray-300 text-[10px] sm:text-xs capitalize mt-0.5 sm:mt-1 truncate max-w-[4rem] sm:max-w-none mx-auto">{formatPokeName(p.key)}</div>
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
              <tr key={ri} className={`border-t border-gray-700 transition-colors ${
                selRi === ri && selDir === 't2' ? 'bg-teal-900/20' : ''
              }`}>
                {/* Prima colonna sticky */}
                <td className={`sticky left-0 z-10 p-2 text-center border-r border-gray-700/50 w-[80px] min-w-[80px] max-w-[80px] h-14 overflow-hidden transition-all ${
                  selRi === ri && selDir === 't2'
                    ? 'bg-teal-900/40'                          // difensore T1 (dir=t2)
                    : selRi === ri && selDir === 't1'
                    ? 'bg-orange-900/40'                        // attaccante T1 (dir=t1)
                    : selRi !== null && selDir === 't1'
                    ? 'bg-gray-900 opacity-30'                  // altri T1 oscurati
                    : 'bg-gray-900'
                }`}>
                  {row?.key ? (
                    <>
                      <div
                        className="relative inline-block cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => focusEditor('team1', ri)}
                        title="Apri nel Team Editor"
                      >
                        <img
                          src={spriteUrl(row.key)}
                          alt={row.key}
                          className="w-8 h-8 sm:w-12 sm:h-12 object-contain mx-auto"
                          onError={e => {
                            const fb = fallbackSpriteUrl(row.key)
                            if (fb && e.target.src !== fb) { e.target.src = fb } else { e.target.style.display = 'none' }
                          }}
                        />
                        {row.item && (
                          <img
                            src={itemIconUrl(row.item)}
                            alt={row.item}
                            className="absolute bottom-0 right-0 w-4 h-4 object-contain"
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        )}
                      </div>
                      <div className="text-gray-300 text-[10px] sm:text-xs capitalize mt-0.5 sm:mt-1 truncate max-w-[3.5rem] sm:max-w-none mx-auto">{formatPokeName(row.key)}</div>
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
                    isOnAxis={getIsOnDefenderAxis(ri, ci)}
                    hasSelection={selRi !== null}
                    selDir={selDir}
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