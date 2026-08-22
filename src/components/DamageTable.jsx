// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useCalcStore from '../store/useCalcStore'
import movesData from '../data/moves.json'
import { formatPokeName, nomeCompleto } from '../utils/nomiPokemon'
import { spriteUrl, fallbackSpriteUrl, itemIconUrl } from '../utils/sprite'
import { costruisciMatrice } from '../lib/matrice'
import useFieldState from '../hooks/useFieldState'
import useBordiScorrimento from '../hooks/useBordiScorrimento'

const toTitleCase = s => s.replace(/(^|-)\w/g, c => c.replace('-', ' ').toUpperCase()).trim()

/**
 * Abilità che impostano il meteo entrando in campo.
 *
 * Sta fuori dal componente per due motivi: è una costante, e `handleSelect`
 * ora è in `useCallback` — una tabella ricreata a ogni render la renderebbe
 * una dipendenza instabile, cioè annullerebbe la memoizzazione delle celle.
 */
const ABILITY_WEATHER = {
  'drizzle':        'rain',
  'primordial sea': 'heavy rain',
  'drought':        'sun',
  'desolate land':  'harsh sunshine',
  'sand stream':    'sand',
  'snow warning':   'snow',
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
  return { text: 'Immune (tipo)', cls: 'text-gray-400' }
}

// ── DamageCell ────────────────────────────────────────────────────────────────


/**
 * ─── LA CELLA NON CALCOLA PIÙ NIENTE ───────────────────────────────────────
 * Prima ogni cella chiamava quattro volte il motore. Ora riceve `cella` già
 * pronta da `lib/matrice.js`, calcolata una volta sola per l'intera griglia
 * dentro un `useMemo` che non dipende dalla selezione.
 *
 * ─── PERCHÉ LE PROP SONO PRIMITIVE ─────────────────────────────────────────
 * `memo` confronta le prop per identità. Prima ne arrivavano tre che erano
 * oggetti nuovi a ogni render — `field`, `fieldReversed` e `selectionState` —
 * più `onSelect`, che era una funzione nuova ogni volta: avvolgere la cella in
 * `memo` senza toccarle non avrebbe evitato un solo render.
 *
 * Quindi la selezione arriva come due stringhe: `dirPrima` e `dirSeconda`
 * valgono 't1'/'t2' se QUESTA cella è la prima o la seconda selezionata, e
 * null altrimenti. Basta a decidere sia l'anello attorno alla cella sia quale
 * delle due metà evidenziare.
 */
const DamageCell = memo(function DamageCell({ cella, attacker, defender, onSelect, ri, ci, dirPrima, dirSeconda, showKoOnly, isOnAxis, hasSelection, selDir }) {
  const { t } = useTranslation()
  const dimCell = hasSelection && !isOnAxis
  if (!cella) {
    if (showKoOnly) return <td className="border-l border-gray-700 opacity-0 pointer-events-none"><div className="p-1 h-8" /></td>
    return (
      <td className="p-1 text-center border-l border-gray-700 text-gray-400 text-xs">—</td>
    )
  }

  const {
    mosseT1: allMovesT1,
    mosseT2: allMovesT2,
    migliore1: d1,
    migliore2: d2,
    immune1: firstImmuneT1,
    immune2: firstImmuneT2,
    primo,
  } = cella

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

  const goesFirstT1 = primo === 't1'
  const goesFirstT2 = primo === 't2'

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

  const isFirst  = dirPrima   !== null
  const isSecond = dirSeconda !== null

  const cellRing = isFirst
    ? 'ring-2 ring-teal-400 ring-inset shadow-[0_0_16px_rgba(45,212,191,0.25)]'
    : isSecond
    ? 'ring-2 ring-violet-400 ring-inset shadow-[0_0_16px_rgba(167,139,250,0.25)]'
    : ''

  const renderHalf = (d, immune, prefix, dir, dim = false, goesFirst = false, pokeName = '') => {
    const label = immune ? immuneLabel(immune.result) : null

    const halfSelected =
      dirPrima   === dir ? 'bg-teal-900/40'   :
      dirSeconda === dir ? 'bg-violet-900/40' :
      d ? bgClass(d.result.maxPct) : ''

    // Fix 3: tooltip del fulmine con nome Pokémon + testo i18n
    const goesFirstTitle = pokeName
      ? `${pokeName} — ${t('ui.goes_first')}`
      : t('ui.goes_first')

    return (
      <div
        onClick={() => { const [a,d,m] = dir === 't1' ? [attacker, defender, allMovesT1] : [defender, attacker, allMovesT2]; onSelect(ri, ci, dir, a, d, m) }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const [a,d,m] = dir === 't1' ? [attacker, defender, allMovesT1] : [defender, attacker, allMovesT2]; onSelect(ri, ci, dir, a, d, m) } }}
        aria-label={d ? `${dir === 't1' ? attacker?.key : defender?.key} uses ${d.move}, ${d.result.minPct}–${d.result.maxPct}% damage` : `${dir === 't1' ? '▶' : '◀'} no move`}
        className={`p-1 text-center cursor-pointer hover:bg-gray-700/40 transition-colors ${
          dir === 't1' ? 'border-b border-gray-700/50' : ''
        } ${halfSelected} ${dim ? 'opacity-20 pointer-events-none' : ''}`}
      >
        {d ? (
          <>
            {/* Niente `truncate`: nasconde il nome della mossa, che è
                l'informazione della cella.

                Misurato a 360 px: 38 mezze celle su 72 sbordavano, di 2-12 px
                su 91 disponibili. Allargare la cella di 12 px o rimpicciolire
                il carattere avrebbe azzerato il conteggio di oggi e lasciato in
                piedi la classe — «Adesso Faccio sul Serio» chiede ~190 px, e
                nessuna larghezza di cella in una griglia 6×6 lo regge.

                Andare a capo vale per ogni nome. `flex-wrap` serve perché il
                contenitore è flex: senza, il ⚡ resterebbe incollato alla riga
                e la spingerebbe fuori lo stesso. */}
            <div className={`text-xs flex flex-wrap items-center justify-center gap-x-1 wrap-break-word ${goesFirst ? 'text-yellow-200' : 'text-gray-400'}`}>
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
            <div className="text-gray-400 text-xs truncate">
              {prefix} {t(`moves.${immune.move}`, { defaultValue: toTitleCase(immune.move) })}
            </div>
            <div className={`text-[10px] font-medium ${label.cls}`}>
              {label.text}
            </div>
          </>
        ) : (
          <div className="text-gray-400 text-xs">{prefix} —</div>
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
})

/**
 * La direzione selezionata per questa cella, o null.
 *
 * Serve a passare alla cella una stringa invece dell'oggetto `selectionState`,
 * che sarebbe una prop nuova a ogni render e vanificherebbe `memo`.
 */
function dirSelezionata(voce, ri, ci) {
  return voce && voce.ri === ri && voce.ci === ci ? voce.dir : null
}

// ── DamageTable ───────────────────────────────────────────────────────────────

export default function DamageTable({ onCellSelect }) {
  // Il riferimento al contenitore che scorre, e i due bordi che ne derivano.
  const contenitore = useRef(null)
  const bordi = useBordiScorrimento(contenitore)
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

  // ─── IL CALCOLO STA QUI, UNA VOLTA SOLA ──────────────────────────────────
  // `costruisciMatrice` costruisce da sé i due orientamenti del campo (era
  // `field` e `fieldReversed`, scritti a mano; vedi lib/battleState.js) e
  // restituisce le 36 celle già risolte.
  //
  // Le dipendenze sono quattro, e sono tutte quelle da cui i numeri
  // dipendono: i due team, lo stato di campo e il livello. La selezione NON
  // ne fa parte, ed è il punto: cliccare una cella faceva rirendere
  // DamageTable e ricalcolare l'intera griglia — 576 chiamate al motore per
  // aprire un pannello che quei numeri se li porta già dietro. Ora quel click
  // costa zero chiamate.
  //
  // `campo` arriva già memoizzato da `useFieldState`, quindi il confronto per
  // identità funziona: senza quello, questo useMemo non salterebbe mai.
  const matrice = useMemo(
    () => costruisciMatrice(team1, team2, campo, level),
    [team1, team2, campo, level],
  )

  const setWeatherDirect = useCalcStore(s => s.setWeatherDirect)

  const handleSelect = useCallback((ri, ci, dir, atk, def, allMoves) => {
    const atkAbility = (atk?.ability || '').toLowerCase()
    const defAbility = (def?.ability || '').toLowerCase()
    const autoWeather = ABILITY_WEATHER[atkAbility] || ABILITY_WEATHER[defAbility] || null
    if (autoWeather) setTimeout(() => setWeatherDirect(autoWeather), 0)

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
  }, [onCellSelect, setWeatherDirect])

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
      {/* ─── LA MATRICE DICHIARA DI SCORRERE ─────────────────────────────
          Difetto 3 delle foto: a 360 px si vedono tre colonne su sei e niente
          segnala che ce ne siano altre. La barra di scorrimento su telefono
          non c'è, e `justify-center` non aiuta.

          Due sfumature, una per lato, ACCESE SOLO QUANDO si può ancora
          scorrere in quella direzione — una sfumatura fissa direbbe «c'è
          dell'altro» anche in fondo, cioè mentirebbe proprio quando l'utente
          cerca conferma di aver visto tutto.

          Il wrapper `relative` sta FUORI dal contenitore che scorre: dentro,
          le sfumature scorrerebbero col contenuto invece di restare ai bordi.
          `pointer-events-none` perché non devono intercettare il dito, e
          `aria-hidden` perché non aggiungono informazione a chi non vede: per
          quello c'è già `role="grid"`. */}
      <div className="relative xl:flex-1 xl:min-w-0">
      {bordi.inizio && (
        <div aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-8 z-30 rounded-l-xl
                     bg-gradient-to-r from-gray-900 to-transparent" />
      )}
      {bordi.fine && (
        <div aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 z-30 rounded-r-xl
                     bg-gradient-to-l from-gray-900 to-transparent" />
      )}
      <div ref={contenitore} className="overflow-x-auto rounded-xl border border-gray-700/40">
        <table className="w-full border-separate border-spacing-0 text-xs" role="grid" aria-label={t("ui.damage_matrix")}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-gray-900 p-2 text-gray-400 font-medium text-center w-20 min-w-20 max-w-20 border-r border-b border-gray-700/50">
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
                        {/* `itemIconUrl` restituisce null per gli strumenti senza indice
                            sprite: i primi sono arrivati in J (Booster Energy, Clear
                            Amulet, Adrenaline Orb). Senza questa guardia si
                            renderizzerebbe un <img> senza sorgente, che a seconda del
                            browser non emette nemmeno l'evento di errore da cui
                            dipende il `display: none` qui sotto. */}
                        {p.item && itemIconUrl(p.item) && (
                          <img
                            src={itemIconUrl(p.item)}
                            alt={p.item}
                            className="absolute bottom-0 right-0 w-4 h-4 object-contain"
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        )}
                      </div>
                      <div title={nomeCompleto(p.key)} className="text-gray-300 text-[10px] sm:text-xs mt-0.5 sm:mt-1 leading-tight line-clamp-2 sm:line-clamp-none sm:truncate max-w-16 sm:max-w-none mx-auto">{formatPokeName(p.key)}</div>
                    </>
                  ) : (
                    <div className="text-gray-400 text-[10px]">T2·{i+1}</div>
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
                        {/* `itemIconUrl` restituisce null per gli strumenti senza indice
                            sprite: i primi sono arrivati in J (Booster Energy, Clear
                            Amulet, Adrenaline Orb). Senza questa guardia si
                            renderizzerebbe un <img> senza sorgente, che a seconda del
                            browser non emette nemmeno l'evento di errore da cui
                            dipende il `display: none` qui sotto. */}
                        {row.item && itemIconUrl(row.item) && (
                          <img
                            src={itemIconUrl(row.item)}
                            alt={row.item}
                            className="absolute bottom-0 right-0 w-4 h-4 object-contain"
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        )}
                      </div>
                      <div title={nomeCompleto(row.key)} className="text-gray-300 text-[10px] sm:text-xs mt-0.5 sm:mt-1 leading-tight line-clamp-2 sm:line-clamp-none sm:truncate max-w-14 sm:max-w-none mx-auto">{formatPokeName(row.key)}</div>
                    </>
                  ) : (
                    <div className="text-gray-400 text-[10px]">T1·{ri+1}</div>
                  )}
                </td>
                {team2.map((col, ci) => (
                  <DamageCell
                    key={ci}
                    cella={matrice[ri]?.[ci] ?? null}
                    attacker={row}
                    defender={col}
                    ri={ri}
                    ci={ci}
                    dirPrima={dirSelezionata(selectionState.first, ri, ci)}
                    dirSeconda={dirSelezionata(selectionState.second, ri, ci)}
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

      {/* ── Legend sidebar (desktop largo) ── */}
      <aside className="hidden xl:block w-47.5 shrink-0 bg-gray-900 rounded-xl border border-gray-700/40 px-4 py-4 self-stretch">
        <div className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold mb-3">{t("report.legend")}</div>
        <div className="space-y-2 text-xs text-gray-300">
          <div className="flex items-center gap-2"><span className="text-teal-400">▶</span> {t("report.attacks")}</div>
          <div className="flex items-center gap-2"><span className="text-red-400">◀</span> {t("report.attacked_by")}</div>
          <div className="flex items-center gap-2"><span className="text-yellow-400">⚡</span> {t("ui.moves_first")}</div>
          <div className="flex items-center gap-2"><span className="text-yellow-400 inline-flex"><SpreadIcon /></span> {t("report.spread_move")}</div>
        </div>
        <div className="text-[11px] text-gray-400 mt-4 mb-2">{t("report.damage")}</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> <span className="text-green-400">0 – 25%</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-300 inline-block" /> <span className="text-teal-300">25 – 50%</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> <span className="text-orange-400">50 – 100%</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> <span className="text-red-400">100%+</span></div>
        </div>
        <div className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold mt-5 mb-2">{t("report.quick_info")}</div>
        <div className="space-y-1.5 text-[11px] text-gray-400 leading-relaxed">
          <div className="flex items-start gap-1.5"><span className="text-gray-400 mt-0.5">›</span>{t("report.how_to_1")}</div>
          <div className="flex items-start gap-1.5"><span className="text-gray-400 mt-0.5">›</span>{t("report.how_to_2")}</div>
          <div className="flex items-start gap-1.5"><span className="text-violet-500 mt-0.5">›</span>{t("report.how_to_3")}</div>
        </div>
      </aside>
      </div>

      {/* ── Legend riga compatta (schermi sotto xl) ── */}
      <div className="xl:hidden flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2 py-2 mt-2 text-[11px] text-gray-400">
        <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-gray-400">{t("report.legend")}</span>
        <span className="flex items-center gap-1"><span className="text-gray-400">▶</span> {t("report.attacks")}</span>
        <span className="flex items-center gap-1"><span className="text-gray-400">◀</span> {t("report.attacked_by")}</span>
        <span className="flex items-center gap-1"><span className="text-yellow-400">⚡</span> {t("ui.moves_first")}</span>
        <span className="flex items-center gap-1"><span className="text-yellow-400 inline-flex"><SpreadIcon /></span> {t("report.spread_move")}</span>
        <span className="text-gray-400">|</span>
        <span className="text-green-400">0–25%</span>
        <span className="text-teal-300">25–50%</span>
        <span className="text-orange-400">50–100%</span>
        <span className="text-red-400">100%+ KO</span>
        <span className="text-gray-400">|</span>
        <span className="text-violet-400">{t("ui.cumulative_short")}</span>
      </div>
    </div>
  )
}