import { useState } from 'react'
import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'
import movesData from '../data/moves.json'
import { spriteUrl, fallbackSpriteUrl, itemIconUrl } from '../utils/sprite'
import { whoGoesFirst } from '../utils/speedOrder'

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
    ? 'ring-2 ring-teal-400 ring-inset shadow-[0_0_16px_rgba(45,212,191,0.25)]'
    : isSecond
    ? 'ring-2 ring-violet-400 ring-inset shadow-[0_0_16px_rgba(167,139,250,0.25)]'
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
                <span className="text-yellow-400 text-[9px] font-bold ml-0.5" title="Moves first">⚡</span>
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
    <td className={`border-l border-t border-gray-700 ${cellRing} relative transition-all hover:brightness-125 w-[100px] min-w-[100px] max-w-[100px] ${dimCell && !isFirst && !isSecond ? 'opacity-30' : ''}`}>
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

  // Selezione attiva (per highlight e dimming) — lettura diretta, nessuna derivata intermedia
  const sel      = selectionState.first
  const selRi    = sel ? sel.ri  : null
  const selCi    = sel ? sel.ci  : null
  const selDir   = sel ? sel.dir : null

  // Logica oscuramento: tieni visibile solo l'asse del DIFENSORE
  // dir='t2' (T2 attacca T1): difensore è il Pokémon T1 → tieni la riga sel.ri
  // dir='t1' (T1 attacca T2): difensore è il Pokémon T2 → tieni la colonna sel.ci
  const getIsOnDefenderAxis = (ri, ci) => {
    if (!sel) return true
    return sel.dir === 't2' ? ri === sel.ri : ci === sel.ci
  }

  return (
    <div id="damage-table" className="mb-4">
      {/* Indicatore modalità cumulativa */}
      {selectionState.second && (
        <div className="mb-2 px-1">
          <span className="text-xs text-violet-400">
            📌 Cumulative mode active — see report above
          </span>
        </div>
      )}

      <div className="xl:flex xl:gap-3 xl:items-start">
      <div className="overflow-x-auto rounded-xl border border-gray-700/40 xl:flex-1 xl:min-w-0">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              {/* Intestazione angolo — sticky su mobile */}
              <th className="sticky left-0 top-0 z-20 bg-gray-900 p-2 text-gray-500 font-medium text-center w-[80px] min-w-[80px] max-w-[80px] border-r border-b border-gray-700/50">
                T1 \ T2
              </th>
              {team2.map((p, i) => (
                <th key={i} className={`sticky top-0 z-10 p-2 text-center font-medium w-[100px] min-w-[100px] max-w-[100px] overflow-hidden transition-all ${
                  selRi !== null && selDir === 't1' && selCi === i
                    ? 'bg-teal-900/40 border-b border-gray-700'
                    : selRi !== null && selDir === 't2' && selCi === i
                    ? 'bg-orange-900/40 border-b border-gray-700'
                    : selRi !== null
                    ? 'bg-gray-900 opacity-30 border-b border-gray-700'
                    : 'bg-gray-900 border-b border-gray-700'
                }`}>
                  {p?.key ? (
                    <>
                      <div
                        className="relative inline-block cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => focusEditor('team2', i)}
                        title="Open in Team Editor"
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
              <tr key={ri} className="transition-colors">
                {/* Prima colonna sticky */}
                <td className={`sticky left-0 z-10 p-2 text-center border-r border-t border-gray-700/50 w-[80px] min-w-[80px] max-w-[80px] h-14 overflow-hidden transition-all ${
                  selRi === ri && selDir === 't2'
                    ? 'bg-teal-900/40'                          // difensore T1 (dir=t2)
                    : selRi === ri && selDir === 't1'
                    ? 'bg-orange-900/40'                        // attaccante T1 (dir=t1)
                    : selRi !== null
                    ? 'bg-gray-900 opacity-30'                  // altri T1 oscurati
                    : 'bg-gray-900'
                }`}>
                  {row?.key ? (
                    <>
                      <div
                        className="relative inline-block cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => focusEditor('team1', ri)}
                        title="Open in Team Editor"
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

      {/* ── Legend sidebar (desktop largo) ── */}
      <aside className="hidden xl:block w-[190px] shrink-0 bg-gray-900 rounded-xl border border-gray-700/40 px-4 py-4 self-stretch">
        <div className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold mb-3">Legend</div>
        <div className="space-y-2 text-xs text-gray-300">
          <div className="flex items-center gap-2"><span className="text-teal-400">▶</span> Attacks</div>
          <div className="flex items-center gap-2"><span className="text-red-400">◀</span> Attacked by</div>
          <div className="flex items-center gap-2"><span className="text-yellow-400">⚡</span> Moves first</div>
          <div className="flex items-center gap-2"><span className="text-yellow-400 inline-flex"><SpreadIcon /></span> Spread move</div>
        </div>
        <div className="text-[11px] text-gray-500 mt-4 mb-2">Damage</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> <span className="text-green-400">0 – 25%</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-300 inline-block" /> <span className="text-teal-300">25 – 50%</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> <span className="text-orange-400">50 – 100%</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> <span className="text-red-400">100%+</span></div>
        </div>
        <div className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold mt-5 mb-2">Quick Info</div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Select a cell to see detailed damage analysis and KO chance. Click a sprite to open it in the Team Editor.
        </p>
      </aside>
      </div>

      {/* ── Legend riga compatta (schermi sotto xl) ── */}
      <div className="xl:hidden flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2 py-2 mt-2 text-[11px] text-gray-500">
        <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-gray-500">Legend</span>
        <span className="flex items-center gap-1"><span className="text-gray-400">▶</span> attacks</span>
        <span className="flex items-center gap-1"><span className="text-gray-400">◀</span> attacked by</span>
        <span className="flex items-center gap-1"><span className="text-yellow-400">⚡</span> moves first</span>
        <span className="flex items-center gap-1"><span className="text-yellow-400 inline-flex"><SpreadIcon /></span> spread move</span>
        <span className="text-gray-600">|</span>
        <span className="text-green-400">0–25%</span>
        <span className="text-teal-300">25–50%</span>
        <span className="text-orange-400">50–100%</span>
        <span className="text-red-400">100%+ KO</span>
      </div>
    </div>
  )
}