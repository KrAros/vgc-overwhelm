import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'
import movesData from '../data/moves.json'
import { spriteUrl, fallbackSpriteUrl, itemIconUrl } from '../utils/sprite'
import { whoGoesFirst } from '../utils/speedOrder'
import { buildAttackerInput, buildDefenderInput, buildField } from '../lib/battleState'
import useFieldState from '../hooks/useFieldState'

const toTitleCase = s => s.replace(/(^|-)\w/g, c => c.replace('-', ' ').toUpperCase()).trim()

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
  // Meteo estremo: la mossa non viene ridotta, fallisce. Il colore è quello
  // del meteo perché la causa è di campo, non del difensore.
  if (result.reason === 'weather') {
    const nome = result.weatherName === 'heavy rain' ? 'Heavy Rain' : 'Harsh Sunshine'
    return { text: `Fails (${nome})`, cls: 'text-sky-400' }
  }
  return { text: 'Immune (tipo)', cls: 'text-gray-500' }
}

function calcAllMoves(atk, def, level, field) {
  const attacker = buildAttackerInput(atk, level)
  const defender = buildDefenderInput(def)
  return (atk.moves || []).filter(Boolean).map(move => ({
    move,
    result: calculateDamage({ attacker, defender, move, field }),
  }))
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
  const { t } = useTranslation()
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

  if (showKoOnly) {
    const t1Ko = d1 && d1.result.maxPct >= 100
    const t2Ko = d2 && d2.result.maxPct >= 100
    if (!t1Ko && !t2Ko) {
      return (
        <td className="border-l border-gray-700 opacity-0 pointer-events-none"><div className="p-1 h-8" /></td>
      )
    }
  }

  const koFilterDimT1 = showKoOnly && !(d1 && d1.result.maxPct >= 100)
  const koFilterDimT2 = showKoOnly && !(d2 && d2.result.maxPct >= 100)

  const twAtk = field.atkTeamSide === 't2' ? field.tailwindT2 : field.tailwindT1
  const twDef = field.atkTeamSide === 't2' ? field.tailwindT1 : field.tailwindT2
  const speedFirst = whoGoesFirst(attacker, defender, d1, d2, field.weather, field.trickRoom, twAtk, twDef, field.terrain)
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

  const { first, second } = selectionState
  const isFirst  = first  && first.ri  === ri && first.ci  === ci
  const isSecond = second && second.ri === ri && second.ci === ci

  const cellRing = isFirst
    ? 'ring-2 ring-teal-400 ring-inset shadow-[0_0_16px_rgba(45,212,191,0.25)]'
    : isSecond
    ? 'ring-2 ring-violet-400 ring-inset shadow-[0_0_16px_rgba(167,139,250,0.25)]'
    : ''

  const renderHalf = (d, immune, prefix, dir, dim = false, goesFirst = false, pokeName = '') => {
    const label = immune ? immuneLabel(immune.result) : null

    const halfSelected =
      (isFirst  && first.dir  === dir) ? 'bg-teal-900/40'   :
      (isSecond && second.dir === dir) ? 'bg-violet-900/40' :
      d ? bgClass(d.result.maxPct) : ''

    // Fix 3: tooltip del fulmine con nome Pokémon + testo i18n
    const goesFirstTitle = pokeName
      ? `${pokeName} — ${t('ui.goes_first')}`
      : t('ui.goes_first')

    return (
      <div
        onClick={() => { const [a,d,m] = dir === 't1' ? [attacker, defender, allMovesT1] : [defender, attacker, allMovesT2]; onSelect(ri, ci, dir, a, d, m, m) }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const [a,d,m] = dir === 't1' ? [attacker, defender, allMovesT1] : [defender, attacker, allMovesT2]; onSelect(ri, ci, dir, a, d, m, m) } }}
        aria-label={d ? `${dir === 't1' ? attacker?.key : defender?.key} uses ${d.move}, ${d.result.minPct}–${d.result.maxPct}% damage` : `${dir === 't1' ? '▶' : '◀'} no move`}
        className={`p-1 text-center cursor-pointer hover:bg-gray-700/40 transition-colors ${
          dir === 't1' ? 'border-b border-gray-700/50' : ''
        } ${halfSelected} ${dim ? 'opacity-20 pointer-events-none' : ''}`}
      >
        {d ? (
          <>
            <div className={`text-xs truncate flex items-center justify-center gap-1 ${goesFirst ? 'text-yellow-200' : 'text-gray-400'}`}>
              {prefix} {t(`moves.${d.move}`, { defaultValue: toTitleCase(d.move) })}
              {goesFirst && (
                // Fix 3: testo più grande (text-xs invece di text-[9px]), tooltip con nome Pokémon
                <span
                  className="text-yellow-400 text-xs font-bold ml-0.5"
                  title={goesFirstTitle}
                >⚡</span>
              )}
              {movesData[d.move]?.spread === true && (
                <span title={t("ui.spread_move")} className="text-yellow-400 inline-flex items-center">
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
              {prefix} {t(`moves.${immune.move}`, { defaultValue: toTitleCase(immune.move) })}
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
    <td className={`border-l border-t border-gray-700 ${cellRing} relative transition-all hover:brightness-125 w-25 min-w-25 max-w-25 ${dimCell && !isFirst && !isSecond ? 'opacity-30' : ''}`}>
      {renderHalf(d1, firstImmuneT1, '▶', 't1', koFilterDimT1 || (hasSelection && !dimCell && selDir === 't2'), goesFirstT1, attacker?.key)}
      {renderHalf(d2, firstImmuneT2, '◀', 't2', koFilterDimT2 || (hasSelection && !dimCell && selDir === 't1'), goesFirstT2, defender?.key)}
    </td>
  )
}

// ── DamageTable ───────────────────────────────────────────────────────────────

export default function DamageTable({ onCellSelect }) {
  const { t } = useTranslation()
  const [selectionState, setSelectionState] = useState({ first: null, second: null })
  const showKoOnly = useCalcStore(s => s.showKoOnly)

  const team1 = useCalcStore(s => s.team1)
  const team2 = useCalcStore(s => s.team2)
  const level = useCalcStore(s => s.level)
  const campo = useFieldState()
  const setEditorFocus = useCalcStore(s => s.setEditorFocus)

  const focusEditor = (team, index) => {
    setEditorFocus(team, index)
    setTimeout(() => {
      document.getElementById(`team-editor-${team}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  // Un solo stato di campo, due punti di vista. Prima erano due oggetti
  // scritti a mano, con la corrispondenza lato/modificatore ricopiata due
  // volte — vedi lib/battleState.js.
  const field         = buildField(campo, 't1')
  const fieldReversed = buildField(campo, 't2')

  const setWeatherDirect = useCalcStore(s => s.setWeatherDirect)

  const ABILITY_WEATHER = {
    'drizzle':        'rain',
    'primordial sea': 'heavy rain',
    'drought':        'sun',
    'desolate land':  'harsh sunshine',
    'sand stream':    'sand',
    'snow warning':   'snow',
  }

  const handleSelect = (ri, ci, dir, atk, def, allMovesT1, allMovesT2) => {
    const atkAbility = (atk?.ability || '').toLowerCase()
    const defAbility = (def?.ability || '').toLowerCase()
    const autoWeather = ABILITY_WEATHER[atkAbility] || ABILITY_WEATHER[defAbility] || null
    if (autoWeather) setTimeout(() => setWeatherDirect(autoWeather), 0)
    const allMoves = dir === 't1' ? allMovesT1 : allMovesT2

    const atkTeam  = dir === 't1' ? 'team1' : 'team2'
    const defTeam  = dir === 't1' ? 'team2' : 'team1'
    const atkIndex = dir === 't1' ? ri : ci
    const defIndex = dir === 't1' ? ci : ri

    // `field` non entra nell'entry: il ReportPanel lo ricostruisce dallo store
    // a ogni render, così cambiare meteo col pannello aperto lo aggiorna.
    // Portarselo dietro qui vorrebbe dire portarsi dietro un valore congelato.
    const entry = { ri, ci, dir, atk, def, allMoves, atkTeam, atkIndex, defTeam, defIndex }

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
    setTimeout(() => onCellSelect?.(nextSel), 0)
  }

  const sel      = selectionState.first
  const selRi    = sel ? sel.ri  : null
  const selCi    = sel ? sel.ci  : null
  const selDir   = sel ? sel.dir : null

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
            {t('ui.cumulative_active')}
          </span>
        </div>
      )}

      <div className="xl:flex xl:gap-3 xl:items-start">
      <div className="overflow-x-auto rounded-xl border border-gray-700/40 xl:flex-1 xl:min-w-0">
        <table className="w-full border-separate border-spacing-0 text-xs" role="grid" aria-label={t("ui.damage_matrix")}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-gray-900 p-2 text-gray-500 font-medium text-center w-20 min-w-20 max-w-20 border-r border-b border-gray-700/50">
                T1 \ T2
              </th>
              {team2.map((p, i) => (
                <th key={i} className={`sticky top-0 z-10 p-2 text-center font-medium w-25 min-w-25 max-w-25 overflow-hidden transition-all ${
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
                        title={t("ui.open_in_team_editor")}
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
                      <div className="text-gray-300 text-[10px] sm:text-xs capitalize mt-0.5 sm:mt-1 truncate max-w-16 sm:max-w-none mx-auto">{formatPokeName(p.key)}</div>
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
                <td className={`sticky left-0 z-10 p-2 text-center border-r border-t border-gray-700/50 w-20 min-w-20 max-w-20 h-14 overflow-hidden transition-all ${
                  selRi === ri && selDir === 't2'
                    ? 'bg-teal-900/40'
                    : selRi === ri && selDir === 't1'
                    ? 'bg-orange-900/40'
                    : selRi !== null
                    ? 'bg-gray-900 opacity-30'
                    : 'bg-gray-900'
                }`}>
                  {row?.key ? (
                    <>
                      <div
                        className="relative inline-block cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => focusEditor('team1', ri)}
                        title={t("ui.open_in_team_editor")}
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
                      <div className="text-gray-300 text-[10px] sm:text-xs capitalize mt-0.5 sm:mt-1 truncate max-w-14 sm:max-w-none mx-auto">{formatPokeName(row.key)}</div>
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
      <aside className="hidden xl:block w-47.5 shrink-0 bg-gray-900 rounded-xl border border-gray-700/40 px-4 py-4 self-stretch">
        <div className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold mb-3">{t("report.legend")}</div>
        <div className="space-y-2 text-xs text-gray-300">
          <div className="flex items-center gap-2"><span className="text-teal-400">▶</span> {t("report.attacks")}</div>
          <div className="flex items-center gap-2"><span className="text-red-400">◀</span> {t("report.attacked_by")}</div>
          <div className="flex items-center gap-2"><span className="text-yellow-400">⚡</span> {t("ui.moves_first")}</div>
          <div className="flex items-center gap-2"><span className="text-yellow-400 inline-flex"><SpreadIcon /></span> {t("report.spread_move")}</div>
        </div>
        <div className="text-[11px] text-gray-500 mt-4 mb-2">{t("report.damage")}</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> <span className="text-green-400">0 – 25%</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-300 inline-block" /> <span className="text-teal-300">25 – 50%</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> <span className="text-orange-400">50 – 100%</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> <span className="text-red-400">100%+</span></div>
        </div>
        <div className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold mt-5 mb-2">{t("report.quick_info")}</div>
        <div className="space-y-1.5 text-[11px] text-gray-500 leading-relaxed">
          <div className="flex items-start gap-1.5"><span className="text-gray-600 mt-0.5">›</span>{t("report.how_to_1")}</div>
          <div className="flex items-start gap-1.5"><span className="text-gray-600 mt-0.5">›</span>{t("report.how_to_2")}</div>
          <div className="flex items-start gap-1.5"><span className="text-violet-500 mt-0.5">›</span>{t("report.how_to_3")}</div>
        </div>
      </aside>
      </div>

      {/* ── Legend riga compatta (schermi sotto xl) ── */}
      <div className="xl:hidden flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2 py-2 mt-2 text-[11px] text-gray-500">
        <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-gray-500">{t("report.legend")}</span>
        <span className="flex items-center gap-1"><span className="text-gray-400">▶</span> {t("report.attacks")}</span>
        <span className="flex items-center gap-1"><span className="text-gray-400">◀</span> {t("report.attacked_by")}</span>
        <span className="flex items-center gap-1"><span className="text-yellow-400">⚡</span> {t("ui.moves_first")}</span>
        <span className="flex items-center gap-1"><span className="text-yellow-400 inline-flex"><SpreadIcon /></span> {t("report.spread_move")}</span>
        <span className="text-gray-600">|</span>
        <span className="text-green-400">0–25%</span>
        <span className="text-teal-300">25–50%</span>
        <span className="text-orange-400">50–100%</span>
        <span className="text-red-400">100%+ KO</span>
        <span className="text-gray-600">|</span>
        <span className="text-violet-400">{t("ui.cumulative_short")}</span>
      </div>
    </div>
  )
}