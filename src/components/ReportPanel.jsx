import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'
import { buildSmogonString } from '../utils/smogonString'
import { calcEOT, findBestNHKO } from '../lib/damage'
import { spriteUrl, fallbackSpriteUrl, itemIconUrl } from '../utils/sprite'
import { calcFinalStat } from '../utils/statCalc'
import pokemonData from '../data/pokemon.json'
import movesData from '../data/moves.json'
import { TYPE_NAMES, TYPE_COLORS, TYPE_HEX } from '../data/typeChart'

// ── Helpers generici ──────────────────────────────────────────────────────────

function calcHKO(minPct) {
  if (minPct <= 0) return null
  const hits = Math.ceil(100 / minPct)
  return hits
}

function formatHKO(hits, t) {
  if (!hits) return null
  if (hits === 1) return `${t('eot.guaranteed')} OHKO`
  return `${t('eot.guaranteed')} ${hits}HKO`
}

// ── Sitrus Berry simulation ───────────────────────────────────────────────────

function _calcSitrusProb(rolls, defHP, eot = 0, maxTurns = 6, useSitrus = true) {
  const sitrusHeal = Math.floor(defHP * 0.25)
  const halfHP     = Math.floor(defHP / 2)
  let states = new Map()
  states.set(`${defHP},0`, 1.0)
  const koAtTurn = {}
  for (let t = 1; t <= maxTurns; t++) {
    const next = new Map()
    let koThisTurn = 0
    for (const [key, prob] of states) {
      const comma = key.indexOf(',')
      const hp    = parseInt(key.slice(0, comma))
      const used  = key[comma + 1] === '1'
      for (const dmg of rolls) {
        const p     = prob / rolls.length
        const newHp = hp - dmg
        if (newHp <= 0) {
          koThisTurn += p
        } else {
          let fHp = newHp, fUsed = used
          if (useSitrus && !used && newHp <= halfHP) {
            fHp = Math.min(newHp + sitrusHeal, defHP)
            fUsed = true
          }
          fHp = fHp + eot
          if (fHp <= 0) { koThisTurn += p; continue }
          fHp = Math.min(fHp, defHP)
          const nk = `${fHp},${fUsed ? 1 : 0}`
          next.set(nk, (next.get(nk) || 0) + p)
        }
      }
    }
    koAtTurn[t] = koThisTurn
    states = next
    if (states.size === 0) break
  }
  return koAtTurn
}

function simulateSitrus(rolls, defHP, eot = 0, condParts = [], useSitrus = true) {
  const midDmg     = rolls[Math.floor(rolls.length / 2)]
  const sitrusHeal = Math.floor(defHP * 0.25)
  let hp = defHP, sitrusUsed = false
  const healTurns = []
  for (let t = 1; t <= 6; t++) {
    hp -= midDmg
    if (hp <= 0) { healTurns.push({ t, hp: 0, ko: true }); break }
    healTurns.push({ t, hp, ko: false })
    if (useSitrus && !sitrusUsed && hp <= Math.floor(defHP / 2)) {
      const healed = Math.min(hp + sitrusHeal, defHP) - hp
      hp = Math.min(hp + sitrusHeal, defHP)
      sitrusUsed = true
      healTurns.push({ t, hp, heal: true, healed })
    }
    if (eot !== 0) {
      const hpBefore = hp
      hp = Math.min(Math.max(hp + eot, 1), defHP)
      if (hp !== hpBefore) healTurns.push({ t, hp, eotDelta: hp - hpBefore, eot: true })
    }
  }
  const koTurn = healTurns.find(r => r.ko)
  const hko    = koTurn ? `${koTurn.t}HKO` : 'No KO in 6T'
  const koAtTurn = _calcSitrusProb(rolls, defHP, eot, 6, useSitrus)
  const bestTurn = Object.entries(koAtTurn).filter(([, p]) => p > 0.0001).sort((a, b) => Number(a[0]) - Number(b[0]))[0]
  const totalKoProb = Object.values(koAtTurn).reduce((a, b) => a + b, 0)
  const activeTurns = Object.values(koAtTurn).filter(p => p > 0.0001).length
  const allParts = useSitrus ? [...condParts, 'sitrus'] : [...condParts]
  let summary
  if (!bestTurn || totalKoProb < 0.0001) {
    summary = { type: 'noKo', condParts: allParts }
  } else if (totalKoProb > 0.9999 && activeTurns === 1) {
    summary = { type: 'guaranteed', turn: bestTurn[0], condParts: allParts, color: 'text-orange-400' }
  } else {
    const pct = Math.round(bestTurn[1] * 1000) / 10
    summary = { type: 'chance', pct, turn: bestTurn[0], condParts: allParts, color: pct >= 50 ? 'text-orange-400' : 'text-yellow-400' }
  }
  return { healTurns, midDmg, hko, summary }
}

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ typeIdx }) {
  const { t } = useTranslation()
  const name = TYPE_NAMES[typeIdx] || ''
  const cls  = TYPE_COLORS[name] || 'bg-gray-600 text-white'
  const displayName = t(`types.${name}`, { defaultValue: name })
  return <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded ${cls}`}>{displayName.toUpperCase()}</span>
}

// ── HpStep — step HP intermedio nel Damage Breakdown ─────────────────────────

function HpStep({ range, defKey }) {
  const { t } = useTranslation()
  return (
    <>
      <span className="text-gray-600 shrink-0 mb-8">→</span>
      <div className="flex flex-col items-center shrink-0 w-17">
        <div className="h-10 flex items-center justify-center mb-2">
          <div className="relative inline-block">
            <img
              src={spriteUrl(defKey)}
              alt={defKey}
              className="w-10 h-10 object-contain"
              onError={e => { const fb = fallbackSpriteUrl(defKey); if (fb && e.target.src !== fb) e.target.src = fb; else e.target.style.display='none' }}
            />
            <span className="absolute bottom-0 right-0 text-[10px] leading-none">❤️</span>
          </div>
        </div>
        <div className="text-[9px] text-gray-500 uppercase tracking-wide leading-tight">{t("report.hp")}</div>
        <div className="text-xs font-bold text-gray-200 mt-1 whitespace-nowrap">
          {range[0] === range[1] ? range[0] : `${range[0]}–${range[1]}`}
        </div>
      </div>
    </>
  )
}

// ── Turn narrative bar ────────────────────────────────────────────────────────

function TurnNarrative({ def: defender, isSand, isSandImmune, sandDmgHP, leftoversHP, sitrus, sitrusText, endOfTurnInfo, activeMove, defHP }) {
  const { t } = useTranslation()
  const steps = []

  // 1. Mossa (avviene per prima nel turno)
  steps.push(
    <span key="move" className="flex items-center gap-1.5 text-gray-300 text-xs font-medium">
      ⚔️ <span className="capitalize">{activeMove?.replace(/-/g, ' ')}</span>
    </span>
  )

  // 2. Sitrus Berry (si attiva subito dopo il colpo se HP ≤ 50%)
  if (sitrus) {
    steps.push(
      <span key="sitrus" className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
        <img src={itemIconUrl('sitrus berry')} alt="" className="w-4 h-4 object-contain" onError={e => { e.target.style.display = 'none' }} />
        <span>{t("eot.sitrus_recovery")}</span>
      </span>
    )
  }

  // 3. Fine turno: sand damage
  if (isSand && !isSandImmune && sandDmgHP > 0) {
    const pct = Math.floor(sandDmgHP / defHP * 1000) / 10
    steps.push(
      <span key="sand" className="flex items-center gap-1.5 text-xs font-medium">
        <span className="text-[#c2a139]">🌪</span>
        <span className="text-red-400 capitalize">{defender.key.split('-')[0].charAt(0).toUpperCase() + defender.key.split('-')[0].slice(1)} {t('eot.takes_pct')} {pct}%</span>
      </span>
    )
  }

  // 4. Fine turno: Leftovers
  if (leftoversHP > 0) {
    const pct = Math.floor(leftoversHP / defHP * 1000) / 10
    steps.push(
      <span key="leftovers" className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
        <img src={itemIconUrl('leftovers')} alt="" className="w-4 h-4 object-contain" onError={e => { e.target.style.display = 'none' }} />
        <span>{t("report.leftovers")} +{pct}%</span>
      </span>
    )
  }

  // 5. Risultato
  const resultText = sitrus ? sitrusText : endOfTurnInfo?.text
  if (resultText) {
    steps.push(
      <span key="result" className="flex items-center gap-1.5 font-bold text-orange-400 text-xs">
        🎯 <span>{resultText}</span>
      </span>
    )
  }

  if (steps.length <= 1) return null

  return (
    <div className="flex items-center gap-3 flex-wrap px-5 py-3 bg-black/30 border-b border-gray-700/20">
      {steps.map((step, i) => (
        <span key={i} className="flex items-center gap-3">
          {step}
          {i < steps.length - 1 && <span className="text-gray-600 text-base font-light">›</span>}
        </span>
      ))}
    </div>
  )
}

// ── CopyCalcButton ────────────────────────────────────────────────────────────

function CopyCalcButton({ smogon }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(smogon).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
      aria-label={t("report.copy_calc_aria")}
      className={`text-gray-500 hover:text-white text-[11px] px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${
        copied ? 'border-teal-600/50 text-teal-300' : 'border-gray-700/50 hover:border-gray-500'
      }`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
      </svg>
      {copied ? 'Copied' : t('report.copy_calc')}
    </button>
  )
}

// ── MoveCard NCP style ────────────────────────────────────────────────────────

function MoveCard({ atk, def, move, result, field = {}, computedMoves, activeMoveKey, onMoveSelect, onClose }) {
  const { t } = useTranslation()
  const hko    = formatHKO(calcHKO(result.minPct), t)
  const smogon = buildSmogonString(atk, def, move, result, field)
  const rolls  = result.rolls
  const hasSitrus = def.item === 'sitrus berry' && result.minPct < 100

  const defHP = result.defHP
  const defTypes = pokemonData[def.key]?.type || []
  const { isSand, sandImmune: isSandImmune, sandDmgHP, leftoversHP, eotNet: eot } = calcEOT(def, defHP, field.weather, defTypes)
  const eotParts = []
  if (isSand && !isSandImmune) eotParts.push('sand')
  if (leftoversHP > 0)         eotParts.push('left')
  const sitrus = hasSitrus ? simulateSitrus(rolls, defHP, eot, eotParts) : null



  const formatSummary = (s) => {
    if (!s) return ''
    const partLabels = (s.condParts || []).map(p =>
      p === 'sitrus' ? t('eot.sitrus_recovery') :
      p === 'sand'   ? t('eot.sandstorm_damage') :
      p === 'left'   ? t('eot.leftovers_recovery') : p
    )
    const condStr = partLabels.join(` ${t('eot.and')} `)
    if (s.type === 'noKo')       return `${t('eot.no_ko_in_6')} ${condStr}`
    if (s.type === 'guaranteed') return `${t('eot.guaranteed')} ${s.turn}HKO ${t('eot.after')} ${condStr}`
    if (s.type === 'chance')     return `${s.pct}% ${t('eot.chance_to')} ${s.turn}HKO ${t('eot.after')} ${condStr}`
    return condStr
  }

  const endOfTurnInfo = (() => {
    if (result.minPct >= 100) return null

    const best = findBestNHKO(rolls, defHP, eot)
    if (!best || best.hits === 1) return null

    const label = `${best.hits}HKO`

    if (leftoversHP === 0 && sandDmgHP === 0) {
      // Nessun EOT — solo badge, nessun breadcrumb
      return best.guaranteed
        ? { hkoSuffix: label, guaranteed: true }
        : { hkoSuffix: label, pct: best.pct }
    }

    const parts = []
    if (isSand && !isSandImmune) parts.push('sand')
    if (leftoversHP > 0)         parts.push('left')
    const partLabels = parts.map(p => p === 'sand' ? t('eot.sandstorm_damage') : t('eot.leftovers_recovery'))
    const condStr = partLabels.join(` ${t('eot.and')} `)

    if (eot === 0) return { text: `${condStr} ${t('eot.neutralize')}`, hkoSuffix: null }

    if (best.guaranteed) {
      return { text: `${t('eot.guaranteed')} ${label} ${t('eot.after')} ${condStr}`, hkoSuffix: label, guaranteed: true }
    }
    return { text: `${best.pct}% ${t('eot.chance_to')} ${label} ${t('eot.after')} ${condStr}`, hkoSuffix: label, pct: best.pct }
  })()

  const moveRecoil = movesData[move]?.recoil || null
  let recoilInfo = null
  if (moveRecoil) {
    const atkPokeData = pokemonData[atk.key]
    const atkHPBase = atkPokeData?.stats?.[0] ?? 0
    const atkHP = calcFinalStat(atkHPBase, atk.sps?.[0] ?? 0, 50, null, 0)
    const [rNum, rDen] = moveRecoil.fraction
    if (moveRecoil.type === 'damage') {
      const minRoll = Math.min(rolls[0], defHP)
      const maxRoll = Math.min(rolls[rolls.length - 1], defHP)
      const minRecoilHP = Math.floor(minRoll * rNum / rDen)
      const maxRecoilHP = Math.floor(maxRoll * rNum / rDen)
      const minPct = Math.round(minRecoilHP * 1000 / atkHP) / 10
      const maxPct = Math.round(maxRecoilHP * 1000 / atkHP) / 10
      recoilInfo = `${minPct} - ${maxPct}% recoil damage`
    } else {
      recoilInfo = `${Math.floor(rNum / rDen * 1000) / 10}% recoil damage`
    }
  }

  const isOHKO = result.minPct >= 100
  const hasOHKOChance = !isOHKO && result.maxPct >= 100
  const moveData = movesData[move]
  const isSpread = moveData?.spread === true
  // % chance OHKO reale
  const ohkoChanceRolls = rolls.filter(r => r >= defHP).length
  const ohkoPct = Math.round(ohkoChanceRolls / rolls.length * 1000) / 10

  const atkPokeData = pokemonData[atk.key]
  const defPokeData = pokemonData[def.key]
  const atkTypes2 = atkPokeData?.type || []
  const defTypes2 = defPokeData?.type || []

  // Roll KO count per la barra segmentata
  const segColors = rolls.map(r => r >= defHP)

  return (
    <div>
      {/* ═══ CARD 1: MATCHUP ═══ */}
      <div className="bg-gray-900 rounded-xl border border-gray-700/40 overflow-hidden mb-3">
        {/* Label + Copy + Close — prima riga della card, ha accesso a smogon e onClose */}
        <div className="flex items-center justify-between px-4 pt-2.5 pb-2 border-b border-gray-700/20">
          <span className="text-[9px] tracking-[0.2em] text-gray-600 uppercase font-bold">{t("report.selected_matchup")}</span>
          <div className="flex items-center gap-1.5">
            <CopyCalcButton smogon={smogon} />
            <button onClick={onClose} aria-label={t("report.close_aria")}
              className="text-gray-500 hover:text-white text-[11px] px-2.5 py-1 rounded border border-gray-700/50 hover:border-gray-500 transition-colors">
              {t("ui.close")}
            </button>
          </div>
        </div>

        {/* Header: [atk] ⚡→ [def] | [move info] | [buttons] — stacked su mobile */}
        <div className="flex flex-col lg:flex-row lg:items-center px-4 lg:px-5 py-4 gap-4 lg:gap-0">

          {/* Attaccante */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-18 h-18 lg:w-26 lg:h-26 bg-gray-800/60 rounded-full flex items-center justify-center border-2 shrink-0 overflow-hidden" style={{borderColor: TYPE_HEX[TYPE_NAMES[atkTypes2[0]]] || '#4b5563'}}>
              <img
                src={spriteUrl(atk.key)}
                alt={atk.key}
                className="w-16 h-16 lg:w-24 lg:h-24 object-contain"
                onError={e => { const fb = fallbackSpriteUrl(atk.key); if (fb && e.target.src !== fb) e.target.src = fb; else e.target.style.display='none' }}
              />
            </div>
            <div>
              <div className="text-base font-bold text-white uppercase tracking-wide leading-tight mb-1.5">
                {atk.key.replace(/-/g, ' ').toUpperCase()}
              </div>
              <div className="flex gap-1">
                {atkTypes2.map(t => <TypeBadge key={t} typeIdx={t} />)}
              </div>
            </div>
          </div>

          {/* Freccia ⚡ → */}
          <div className="flex items-center px-2 lg:px-6 shrink-0">
            <svg width="64" height="14" viewBox="0 0 64 14" fill="none" className="w-10 lg:w-16">
              <path d="M0 7 H58 M52 1 L60 7 L52 13" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Difensore */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-18 h-18 lg:w-26 lg:h-26 bg-gray-800/60 rounded-full flex items-center justify-center border-2 shrink-0 overflow-hidden" style={{borderColor: TYPE_HEX[TYPE_NAMES[defTypes2[0]]] || '#4b5563'}}>
              <img
                src={spriteUrl(def.key)}
                alt={def.key}
                className="w-16 h-16 lg:w-24 lg:h-24 object-contain"
                onError={e => { const fb = fallbackSpriteUrl(def.key); if (fb && e.target.src !== fb) e.target.src = fb; else e.target.style.display='none' }}
              />
            </div>
            <div>
              <div className="text-base font-bold text-white uppercase tracking-wide leading-tight mb-1.5">
                {def.key.replace(/-/g, ' ').toUpperCase()}
              </div>
              <div className="flex gap-1">
                {defTypes2.map(t => <TypeBadge key={t} typeIdx={t} />)}
              </div>
            </div>
          </div>

          {/* Separatore verticale */}
          <div className="hidden lg:block w-px bg-gray-700/40 mx-6 self-stretch" />

          {/* Mossa selezionata */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-gray-500 uppercase tracking-[0.12em] font-semibold mb-1">{t("report.selected_move")}</div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <div className="text-lg font-bold text-white uppercase tracking-wide leading-tight">
                {move.replace(/-/g, ' ')}
                {recoilInfo && <span className="text-orange-400 text-[11px] font-normal ml-2 normal-case tracking-normal">({recoilInfo})</span>}
              </div>
              {isSpread && (
                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest border border-purple-700/40 rounded px-1.5 py-0.5">🌀 Spread</span>
              )}
            </div>
            <div className="text-3xl font-bold text-white leading-tight tracking-tight mt-1">{result.minPct} – {result.maxPct}%</div>
            <div className="text-xs text-gray-500 mt-1">{result.minDmg} – {result.maxDmg} HP</div>
          </div>

          {/* Colonna destra: badge KO — dimensioni uniformi, centrato */}
          <div className="shrink-0 flex flex-col items-end justify-center lg:self-center">
            {isOHKO ? (
              <div className="border-2 border-red-500/70 rounded-xl px-5 py-4 text-center bg-red-950/30 w-36">
                <div className="text-3xl font-black text-red-400 leading-tight">100%</div>
                <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mt-1">1HKO {t('eot.guaranteed')}</div>
              </div>
            ) : hasOHKOChance ? (
              <div className="border-2 border-orange-500/60 rounded-xl px-5 py-4 text-center bg-orange-950/20 w-36">
                <div className="text-3xl font-black text-orange-400 leading-tight">{ohkoPct}%</div>
                <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-1">1HKO Chance</div>
              </div>
            ) : endOfTurnInfo ? (
              <div className="border-2 border-yellow-600/40 rounded-xl px-5 py-4 text-center bg-yellow-950/10 w-36">
                <div className="text-2xl font-black text-yellow-300 leading-tight">
                  {endOfTurnInfo.pct ? `${endOfTurnInfo.pct}%` : '100%'}
                </div>
                <div className="text-[10px] font-semibold text-yellow-400 leading-tight mt-1 px-1">
                  {endOfTurnInfo.guaranteed && !endOfTurnInfo.text
                    ? `${t('eot.guaranteed')} ${endOfTurnInfo.hkoSuffix}`
                    : endOfTurnInfo.text
                    ? endOfTurnInfo.text.replace(/^[\d.]+%\s+\S+\s+/, '').replace(/^Guaranteed\s+/, '')
                    : endOfTurnInfo.hkoSuffix}
                </div>
              </div>
            ) : (
              <div className="border-2 border-gray-600/30 rounded-xl px-5 py-4 text-center bg-gray-800/30 w-36">
                <div className="text-2xl font-black text-gray-500 leading-tight">{hko ?? '—'}</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{t('report.no_ko')}</div>
              </div>
            )}
          </div>
        </div>

        {/* Barra narrativa turno */}
        <TurnNarrative
          def={def}
          isSand={isSand}
          isSandImmune={isSandImmune}
          sandDmgHP={sandDmgHP}
          leftoversHP={leftoversHP}
          sitrus={sitrus}
          sitrusText={sitrus ? formatSummary(sitrus.summary) : null}
          endOfTurnInfo={endOfTurnInfo}
          activeMove={move}
          defHP={defHP}
        />

        {/* 4 bottoni mossa */}
        {computedMoves && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 px-4 py-3 border-t border-gray-700/20">
            {computedMoves.map(({ move: mv, result: res }) => {
              const isActive = mv === activeMoveKey
              const mData = movesData[mv]
              const effectiveTypeIdx = res.effectiveMoveType ?? ((mv === 'weather ball' && res.weatherBallType != null) ? res.weatherBallType : mData?.type)
              const moveTypeName = TYPE_NAMES[effectiveTypeIdx] || 'Normal'
              const typeColor = TYPE_HEX[moveTypeName] || '#6b7280'
              const hasKO = res.maxPct >= 100
              const isHigh = res.maxPct >= 50
              const pctColor = hasKO ? '#f87171' : isHigh ? '#fb923c' : 'var(--text-primary)'
              const isStatus = mData?.category === 2
              return (
                <button
                  key={mv}
                  type="button"
                  onClick={() => onMoveSelect(mv)}
                  style={{ borderLeftColor: typeColor }}
                  className={`text-left rounded-lg border border-gray-700/40 border-l-[3px] bg-gray-800/30 px-3 py-2 transition-all ${isActive ? 'ring-1 ring-teal-400 bg-teal-950/20' : 'hover:bg-gray-800/60'}`}
                >
                  <div className="text-[20px] text-gray-300 capitalize truncate mb-1">{mv.replace(/-/g, ' ')}</div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="text-[13px] font-semibold" style={{ color: isStatus ? 'var(--text-muted)' : pctColor }}>
                      {isStatus ? '—' : `${res.minPct}–${res.maxPct}%`}
                    </div>
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded shrink-0"
                      style={{ background: typeColor + '33', color: typeColor }}
                    >
                      {t(`types.${moveTypeName}`, { defaultValue: moveTypeName }).toUpperCase()}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══ CARD 2 + 3: BREAKDOWN | ROLLS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3">

        {/* CARD 2: Breakdown Turno — logica differenziata per KO/EOT/no-EOT */}
        {(() => {
          const sitrusHeal = Math.floor(defHP * 0.25)
          let hpMin = Math.max(0, defHP - result.maxDmg)
          let hpMax = Math.max(0, defHP - result.minDmg)
          const hpAfterMove = [hpMin, hpMax]
          if (sitrus) { hpMin = Math.min(hpMin + sitrusHeal, defHP); hpMax = Math.min(hpMax + sitrusHeal, defHP) }
          const hpAfterSitrus = [hpMin, hpMax]
          if (isSand && !isSandImmune) { hpMin = Math.max(0, hpMin - sandDmgHP); hpMax = Math.max(0, hpMax - sandDmgHP) }
          const hpAfterSand = [hpMin, hpMax]
          if (leftoversHP > 0) { hpMin = Math.min(hpMin + leftoversHP, defHP); hpMax = Math.min(hpMax + leftoversHP, defHP) }
          const hpAfterLefto = [hpMin, hpMax]

          // Caso 1: KO garantito — catena corta, no EOT, centrata verticalmente
          if (isOHKO) {
            return (
              <div id="damage-breakdown-card" className="bg-gray-900 rounded-xl border border-gray-700/40 px-5 py-4 flex flex-col">
                <div className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold mb-4">{t("report.turn_breakdown")}</div>
                <div className="flex-1 flex items-center justify-center gap-3">
                  <div className="flex flex-col items-center shrink-0 w-20">
                    <span className="text-3xl mb-2">❤️</span>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide">{t("report.start")}</div>
                    <div className="text-[10px] text-gray-400 capitalize truncate w-full text-center">{def.key.split('-')[0]}</div>
                    <div className="text-xs font-bold text-white mt-1">{defHP} HP</div>
                  </div>
                  <span className="text-gray-600 mb-4">→</span>
                  <div className="flex flex-col items-center shrink-0 w-23">
                    <span className="text-3xl mb-2">⚔️</span>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide text-center w-full">{move.replace(/-/g, ' ')}</div>
                    <div className="text-xs font-bold text-red-300 mt-1 whitespace-nowrap">−{result.minDmg}–{result.maxDmg}</div>
                  </div>
                  <span className="text-gray-600 mb-4">→</span>
                  <div className="flex flex-col items-center shrink-0 w-20 text-center">
                    <span className="text-3xl mb-2">💀</span>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide">KO</div>
                    <div className="text-xs font-bold text-red-400 mt-1">0 HP</div>
                  </div>
                </div>
              </div>
            )
          }

          // Caso 2: KO chance o no KO — titolo sempre "Breakdown Turno"
          const cardTitle = t("report.turn_breakdown")

          return (
            <div id="damage-breakdown-card" className="bg-gray-900 rounded-xl border border-gray-700/40 px-5 py-4">
              <div className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold mb-4">{cardTitle}</div>
              <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>

                {/* Start */}
                <div className="flex flex-col items-center shrink-0 w-20">
                  <div className="h-10 flex items-center justify-center mb-2">
                    <span className="text-3xl">❤️</span>
                  </div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wide leading-tight">{t("report.start")}</div>
                  <div className="text-[10px] text-gray-400 capitalize leading-tight truncate w-full text-center">{def.key.split('-')[0]}</div>
                  <div className="text-xs font-bold text-white mt-1">{defHP} HP</div>
                </div>

                {/* 1. Mossa */}
                <span className="text-gray-600 shrink-0 mb-8">→</span>
                <div className="flex flex-col items-center shrink-0 w-23">
                  <div className="h-10 flex items-center justify-center mb-2">
                    <span className="text-3xl">⚔️</span>
                  </div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wide leading-tight text-center w-full">{move.replace(/-/g, ' ')}</div>
                  <div className="text-xs font-bold text-red-300 mt-1 whitespace-nowrap">−{result.minDmg}–{result.maxDmg}</div>
                </div>

                <HpStep range={hpAfterMove} defKey={def.key} />

                {/* EOT visibili solo se rilevanti (no KO diretto) */}

                {/* 2. Sitrus Berry */}
                {sitrus && <>
                  <span className="text-gray-600 shrink-0 mb-8">→</span>
                  <div className="flex flex-col items-center shrink-0 w-20">
                    <div className="h-10 flex items-center justify-center mb-2">
                      <img src={itemIconUrl('sitrus berry')} alt="" className="w-8 h-8 object-contain" onError={e => { e.target.style.display = 'none' }} />
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide leading-tight text-center">{t("report.sitrus_berry")}</div>
                    <div className="text-xs font-bold text-green-400 mt-1">+{sitrusHeal} HP</div>
                  </div>
                  <HpStep range={hpAfterSitrus} defKey={def.key} />
                </>}

                {/* 3. Sandstorm */}
                {(isSand && !isSandImmune) && <>
                  <span className="text-gray-600 shrink-0 mb-8">→</span>
                  <div className="flex flex-col items-center shrink-0 w-20">
                    <div className="h-10 flex items-center justify-center mb-2">
                      <span className="text-3xl text-[#C2a193]">🌪</span>
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide leading-tight text-center">{t("report.sandstorm")}</div>
                    <div className="text-xs font-bold text-red-400 mt-1">−{sandDmgHP} HP</div>
                  </div>
                  <HpStep range={hpAfterSand} defKey={def.key} />
                </>}

                {/* 4. Leftovers */}
                {leftoversHP > 0 && <>
                  <span className="text-gray-600 shrink-0 mb-8">→</span>
                  <div className="flex flex-col items-center shrink-0 w-20">
                    <div className="h-10 flex items-center justify-center mb-2">
                      <img src={itemIconUrl('leftovers')} alt="" className="w-8 h-8 object-contain" onError={e => { e.target.style.display = 'none' }} />
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide leading-tight text-center">{t("report.leftovers")}</div>
                    <div className="text-xs font-bold text-green-400 mt-1">+{leftoversHP} HP</div>
                  </div>
                  <HpStep range={hpAfterLefto} defKey={def.key} />
                </>}

                {/* 5. Result */}
                <span className="text-gray-600 shrink-0 mb-8">→</span>
                <div className="flex flex-col items-center justify-start shrink-0 w-22 text-center">
                  <div className="h-10 flex items-center justify-center mb-2">
                    <span className="text-3xl">🎯</span>
                  </div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wide leading-tight">{t("report.result")}</div>
                  {(() => {
                    if (hasOHKOChance) return (
                      <div className="text-sm font-black mt-1 whitespace-nowrap text-orange-400">{ohkoPct}%</div>
                    )
                    // Mostra % danno finale (dopo tutto l'EOT)
                    const finalRange = leftoversHP > 0 ? hpAfterLefto : (isSand && !isSandImmune) ? hpAfterSand : sitrus ? hpAfterSitrus : hpAfterMove
                    const minFinalPct = Math.round(Math.max(0, defHP - finalRange[1]) / defHP * 1000) / 10
                    const maxFinalPct = Math.round(Math.max(0, defHP - finalRange[0]) / defHP * 1000) / 10
                    return (
                      <div className="text-sm font-black mt-1 whitespace-nowrap text-gray-200">
                        {minFinalPct}–{maxFinalPct}%
                      </div>
                    )
                  })()}
                  {hasOHKOChance && <div className="text-[9px] text-orange-400 leading-tight whitespace-nowrap">1HKO chance</div>}
                </div>
              </div>
            </div>
          )
        })()}

        {/* CARD 3: Damage Rolls */}
        <div id="damage-rolls-card" className="bg-gray-900 rounded-xl border border-gray-700/40 px-5 py-4">
          <div className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold mb-3">{t("report.damage_rolls")}</div>

          {/* Roll chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {rolls.map((r, i) => (
              <span
                key={i}
                className={`text-xs px-2.5 py-1 rounded font-mono font-semibold ${
                  r >= defHP
                    ? 'bg-red-950/60 text-red-300 border border-red-700/40'
                    : 'bg-gray-800 text-gray-300 border border-gray-700/40'
                }`}
              >
                {r}
              </span>
            ))}
          </div>

          {/* Barra segmentata MIN/MAX */}
          <div className="flex items-center gap-3">
            <div className="text-left shrink-0">
              <div className="text-[10px] text-gray-500 uppercase">{t("report.min")}</div>
              <div className="text-sm font-bold text-gray-200">{result.minDmg}</div>
            </div>
            <div className="flex-1 flex gap-0.75">
              {segColors.map((isKO, i) => (
                <div
                  key={i}
                  className={`h-2.5 flex-1 rounded-sm ${isKO ? 'bg-purple-500' : 'bg-gray-700/70'}`}
                />
              ))}
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-gray-500 uppercase">{t("report.max")}</div>
              <div className="text-sm font-bold text-gray-200">{result.maxDmg}</div>
            </div>
          </div>
          <div className="text-center mt-2">
            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-[0.08em]">{t('report.ko_threshold')}: ≥ {defHP} HP</span>
          </div>
        </div>
      </div>

    </div>
  )
}

// ── SinglePanel ───────────────────────────────────────────────────────────────

function SinglePanel({ entry, onClose }) {
  const { t } = useTranslation()
  const { atk, def, dir } = entry
  const doubleTarget = useCalcStore(s => s.doubleTarget)
  const weather      = useCalcStore(s => s.weather)
  const terrain      = useCalcStore(s => s.terrain)
  const helpingHand  = useCalcStore(s => s.helpingHand)
  const auroraVeil   = useCalcStore(s => s.auroraVeil)
  const lightScreen  = useCalcStore(s => s.lightScreen)
  const reflect      = useCalcStore(s => s.reflect)
  const crit         = useCalcStore(s => s.crit)

  const computedMoves = useMemo(() => {
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
        attacker: { atkPokemon: atk.key, atkSPs: atk.sps || [0,0,0,0,0,0], atkNature: atk.nature, atkBoost: atk.atkBoost || 0, spAtkBoost: atk.spAtkBoost || 0, atkItem: atk.item || null, atkAbility: atk.ability || null, atkAbilityFlags: atk.abilityFlags || {}, level: 50 },
        defender: { defPokemon: def.key, defSPs: def.sps || [0,0,0,0,0,0], defNature: def.nature, defBoost: def.defBoost || 0, spDefBoost: def.spDefBoost || 0, defItem: def.item || null, defAbility: def.ability || null, defAbilityFlags: def.abilityFlags || {} },
        move, field,
      })
      return { move, result }
    }).filter(({ result }) => result && !result.immune && result.maxPct > 0)
  }, [atk, def, dir, doubleTarget, weather, terrain, helpingHand, auroraVeil, lightScreen, reflect, crit])

  const [selectedMove, setSelectedMove] = useState(null)
  const defaultMove = computedMoves.length > 0 ? computedMoves.reduce((a, b) => b.result.maxPct > a.result.maxPct ? b : a) : null
  const activeMoveKey = selectedMove || defaultMove?.move
  const active = computedMoves.find(m => m.move === activeMoveKey) || defaultMove

  if (computedMoves.length === 0) return <div className="text-gray-500 text-xs p-4">{t("ui.no_offensive_moves")}</div>

  const field = {
    weather, terrain, doubleTarget,
    helpingHand: dir === 't1' ? helpingHand.t1 : helpingHand.t2,
    auroraVeil:  dir === 't1' ? auroraVeil.t2  : auroraVeil.t1,
    lightScreen: dir === 't1' ? lightScreen.t2  : lightScreen.t1,
    reflect:     dir === 't1' ? reflect.t2      : reflect.t1,
    crit:        dir === 't1' ? crit.t1         : crit.t2,
  }

  return active ? (
    <MoveCard
      atk={atk}
      def={def}
      move={active.move}
      result={active.result}
      field={field}
      computedMoves={computedMoves}
      activeMoveKey={activeMoveKey}
      onMoveSelect={setSelectedMove}
      onClose={onClose}
    />
  ) : null
}

// ── CumulativePanel ───────────────────────────────────────────────────────────

function CumulativePanel({ entries }) {
  const { t } = useTranslation()
  const [entry1, entry2] = entries
  const def = entry1.def
  const doubleTarget = useCalcStore(s => s.doubleTarget)
  const weather      = useCalcStore(s => s.weather)
  const terrain      = useCalcStore(s => s.terrain)
  const helpingHand  = useCalcStore(s => s.helpingHand)
  const auroraVeil   = useCalcStore(s => s.auroraVeil)
  const lightScreen  = useCalcStore(s => s.lightScreen)
  const reflect      = useCalcStore(s => s.reflect)
  const crit         = useCalcStore(s => s.crit)

  const buildMoves = (atk, dir) => {
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
        attacker: { atkPokemon: atk.key, atkSPs: atk.sps || [0,0,0,0,0,0], atkNature: atk.nature, atkBoost: atk.atkBoost || 0, spAtkBoost: atk.spAtkBoost || 0, atkItem: atk.item || null, atkAbility: atk.ability || null, atkAbilityFlags: atk.abilityFlags || {}, level: 50 },
        defender: { defPokemon: def.key, defSPs: def.sps || [0,0,0,0,0,0], defNature: def.nature, defBoost: def.defBoost || 0, spDefBoost: def.spDefBoost || 0, defItem: def.item || null, defAbility: def.ability || null, defAbilityFlags: def.abilityFlags || {} },
        move, field,
      })
      return { move, result }
    }).filter(({ result }) => result && !result.immune && result.maxPct > 0)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const moves1 = useMemo(() => buildMoves(entry1.atk, entry1.dir), [entry1.atk, entry1.dir, def, doubleTarget, weather, terrain, helpingHand, auroraVeil, lightScreen, reflect, crit])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const moves2 = useMemo(() => buildMoves(entry2.atk, entry2.dir), [entry2.atk, entry2.dir, def, doubleTarget, weather, terrain, helpingHand, auroraVeil, lightScreen, reflect, crit])

  const [sel1, setSel1] = useState(null)
  const [sel2, setSel2] = useState(null)
  const default1 = moves1.length > 0 ? moves1.reduce((a, b) => b.result.maxPct > a.result.maxPct ? b : a) : null
  const default2 = moves2.length > 0 ? moves2.reduce((a, b) => b.result.maxPct > a.result.maxPct ? b : a) : null
  const active1  = moves1.find(m => m.move === (sel1 || default1?.move)) || default1
  const active2  = moves2.find(m => m.move === (sel2 || default2?.move)) || default2

  const cumulative = useMemo(() => {
    if (!active1 || !active2) return null
    const r1 = active1.result, r2 = active2.result
    const defHP = r1.defHP
    const rolls1 = r1.rolls, rolls2 = r2.rolls
    let koCount = 0
    for (const a of rolls1) for (const b of rolls2) if (a + b >= defHP) koCount++
    const totalCombos = rolls1.length * rolls2.length
    const minSum = rolls1[0] + rolls2[0]
    const maxSum = rolls1[rolls1.length - 1] + rolls2[rolls2.length - 1]
    const minPct = Math.floor(minSum / defHP * 1000) / 10
    const maxPct = Math.floor(maxSum / defHP * 1000) / 10
    const koOf16 = Math.round(koCount / (totalCombos / 16))
    return { minPct, maxPct, defHP, minSum, maxSum, koCount, totalCombos, koOf16, rolls1, rolls2 }
  }, [active1, active2])

  const badge = !cumulative ? null :
    cumulative.minPct >= 100 ? { text: t('eot.guaranteed') + ' KO', cls: 'bg-green-900/40 border-green-500/50 text-green-300' } :
    cumulative.koOf16 > 0    ? { text: `Likely KO (${cumulative.koOf16}/16)`, cls: 'bg-yellow-900/40 border-yellow-500/50 text-yellow-300' } :
                               { text: t('report.no_ko'), cls: 'bg-gray-800 border-gray-600 text-gray-500' }

  return (
    <div>
      {/* SELECTED MATCHUP label */}
      <div className="mb-2">
        <span className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold">{t("report.selected_matchup")}</span>
      </div>

      {/* Card principale: due attaccanti affiancati → difensore */}
      <div className="bg-gray-900 rounded-xl border border-gray-700/40 overflow-hidden mb-3">

        {/* Header: [atk1] + [atk2] → [def] */}
        <div className="flex flex-col lg:flex-row lg:items-center px-5 py-4 gap-4 border-b border-gray-700/20">

          {/* Attaccanti */}
          <div className="flex items-center gap-4 flex-wrap">
            {[entry1, entry2].map((entry, idx) => {
              const atkTypes = pokemonData[entry.atk.key]?.type || []
              const borderColor = TYPE_HEX[TYPE_NAMES[atkTypes[0]]] || '#4b5563'
              const accentCls = idx === 0 ? 'text-teal-300' : 'text-violet-300'
              return (
                <div key={idx} className="flex items-center gap-3 shrink-0">
                  <div className="w-18 h-18 lg:w-20 lg:h-20 bg-gray-800/60 rounded-full flex items-center justify-center border-2 shrink-0 overflow-hidden"
                    style={{ borderColor }}>
                    <img src={spriteUrl(entry.atk.key)} alt={entry.atk.key}
                      className="w-16 h-16 lg:w-18 lg:h-18 object-contain"
                      onError={e => { const fb = fallbackSpriteUrl(entry.atk.key); if (fb && e.target.src !== fb) e.target.src = fb; else e.target.style.display='none' }} />
                  </div>
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${accentCls}`}>
                      {idx === 0 ? t('report.attacker_n', { n: 1 }) : t('report.attacker_n', { n: 2 })}
                    </div>
                    <div className="text-sm font-bold text-white uppercase tracking-wide leading-tight mb-1.5">
                      {entry.atk.key.replace(/-/g, ' ').toUpperCase()}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {atkTypes.map(t => <TypeBadge key={t} typeIdx={t} />)}
                    </div>
                  </div>
                  {idx === 0 && (
                    <div className="flex items-center px-3 shrink-0 text-gray-500 text-xl font-light">+</div>
                  )}
                </div>
              )
            })}

          </div>

          {/* Separatore */}
          <div className="hidden lg:block w-px bg-gray-700/30 mx-4 self-stretch" />

          {/* Difensore */}
          {(() => {
            const defTypes = pokemonData[def.key]?.type || []
            const borderColor = TYPE_HEX[TYPE_NAMES[defTypes[0]]] || '#4b5563'
            return (
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-18 h-18 lg:w-20 lg:h-20 bg-gray-800/60 rounded-full flex items-center justify-center border-2 shrink-0 overflow-hidden"
                  style={{ borderColor }}>
                  <img src={spriteUrl(def.key)} alt={def.key}
                    className="w-16 h-16 lg:w-18 lg:h-18 object-contain"
                    onError={e => { const fb = fallbackSpriteUrl(def.key); if (fb && e.target.src !== fb) e.target.src = fb; else e.target.style.display='none' }} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("report.defender")}</div>
                  <div className="text-sm font-bold text-white uppercase tracking-wide leading-tight mb-1.5">
                    {def.key.replace(/-/g, ' ').toUpperCase()}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {defTypes.map(t => <TypeBadge key={t} typeIdx={t} />)}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Separatore */}
          <div className="hidden lg:block w-px bg-gray-700/30 mx-4 self-stretch" />

          {/* Badge danno cumulativo */}
          {cumulative && (
            <div className="shrink-0 text-right ml-auto">
              <div className="text-[9px] text-gray-600 uppercase tracking-[0.15em] font-semibold mb-1">{t("report.combined_damage")}</div>
              <div className="text-3xl font-bold text-white tracking-tight">{cumulative.minPct} – {cumulative.maxPct}%</div>
              <div className="text-xs text-gray-500 mt-0.5">{cumulative.minSum} – {cumulative.maxSum} HP / {cumulative.defHP} HP</div>
              <div className="mt-2">
                <span className={`inline-block text-xs font-bold px-3 py-1 rounded border ${badge.cls}`}>
                  {cumulative.minPct >= 100 ? '✓ ' + t('eot.guaranteed') + ' KO' : cumulative.koOf16 > 0 ? `⚡ ${t('report.likely_ko')} (${cumulative.koOf16}/16)` : '✗ ' + t('report.no_ko')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottoni mossa per ogni attaccante */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-700/30 border-b border-gray-700/20">
          {[entry1, entry2].map((entry, idx) => {
            const moves = idx === 0 ? moves1 : moves2
            const sel = idx === 0 ? sel1 : sel2
            const setSel = idx === 0 ? setSel1 : setSel2
            const deflt = idx === 0 ? default1 : default2
            const ringCls = idx === 0 ? 'ring-teal-400' : 'ring-violet-400'
            const labelCls = idx === 0 ? 'text-teal-400' : 'text-violet-400'
            return (
              <div key={idx} className="px-4 py-3 space-y-2">
                <div className={`text-[9px] uppercase tracking-[0.15em] font-semibold ${labelCls}`}>
                  {entry.atk.key.split('-')[0].toUpperCase()} {t('report.moves')}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {moves.map(({ move: mv, result: res }) => {
                    const isSel = mv === (sel || deflt?.move)
                    const mData = movesData[mv]
                    const effectiveTypeIdx = res.effectiveMoveType ?? ((mv === 'weather ball' && res.weatherBallType != null) ? res.weatherBallType : mData?.type)
                    const moveTypeName = TYPE_NAMES[effectiveTypeIdx] || 'Normal'
                    const typeColor = TYPE_HEX[moveTypeName] || '#6b7280'
                    const hasKO = res.maxPct >= 100
                    const isHigh = res.maxPct >= 50
                    const pctColor = hasKO ? '#f87171' : isHigh ? '#fb923c' : 'var(--text-primary)'
                    const isStatus = mData?.category === 2
                    return (
                      <button key={mv} type="button" onClick={() => setSel(mv)}
                        style={{ borderLeftColor: typeColor }}
                        className={`text-left rounded-lg border border-gray-700/40 border-l-[3px] bg-gray-800/30 px-3 py-2 transition-all ${isSel ? `ring-1 ${ringCls} bg-teal-950/20` : 'hover:bg-gray-800/60'}`}>
                        <div className="text-[20px] text-gray-300 capitalize truncate mb-1">{mv.replace(/-/g, ' ')}</div>
                        <div className="flex items-center justify-between gap-1">
                          <div className="text-[13px] font-semibold" style={{ color: isStatus ? 'var(--text-muted)' : pctColor }}>
                            {isStatus ? '—' : `${res.minPct}–${res.maxPct}%`}
                          </div>
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded shrink-0"
                            style={{ background: typeColor + '33', color: typeColor }}>
                            {t(`types.${moveTypeName}`, { defaultValue: moveTypeName }).toUpperCase()}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Barra segmentata combinata — stile uguale al singolo */}
        {cumulative && (() => {
          // 16 step uniformi da minSum a maxSum
          const { minSum, maxSum, defHP, koOf16 } = cumulative
          const step = (maxSum - minSum) / 15
          const sums = Array.from({ length: 16 }, (_, i) => Math.round(minSum + i * step))
          // segmenti KO sono quelli in fondo (valori più alti >= defHP)
          const segColors = Array.from({ length: 16 }, (_, i) => i >= 16 - koOf16)
          return (
            <div className="px-5 py-4 border-b border-gray-700/20">
              <div className="text-[11px] tracking-[0.15em] text-gray-400 uppercase font-semibold mb-3">{t('report.combined_damage')}</div>

              {/* Chip somme */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {sums.map((s, i) => (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded font-mono font-semibold ${
                    s >= defHP
                      ? 'bg-red-950/60 text-red-300 border border-red-700/40'
                      : 'bg-gray-800 text-gray-300 border border-gray-700/40'
                  }`}>
                    {s}
                  </span>
                ))}
              </div>

              {/* Barra MIN/MAX */}
              <div className="flex items-center gap-3">
                <div className="text-left shrink-0">
                  <div className="text-[10px] text-gray-500 uppercase">{t('report.min')}</div>
                  <div className="text-sm font-bold text-gray-200">{minSum}</div>
                </div>
                <div className="flex-1 flex gap-0.75">
                  {segColors.map((isKO, i) => (
                    <div key={i} className={`h-2.5 flex-1 rounded-sm ${isKO ? 'bg-purple-500' : 'bg-gray-700/70'}`} />
                  ))}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-gray-500 uppercase">{t('report.max')}</div>
                  <div className="text-sm font-bold text-gray-200">{maxSum}</div>
                </div>
              </div>
              <div className="text-center mt-2">
                <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-[0.08em]">
                  {t('report.ko_threshold')}: ≥ {defHP} HP
                </span>
              </div>
            </div>
          )

        })()}
      </div>

      {/* Stringhe Smogon */}
      <div className="bg-gray-900 rounded-xl border border-gray-700/40 px-5 py-3 space-y-2">
        {[entry1, entry2].map((entry, idx) => {
          const activeSel = idx === 0 ? active1 : active2
          if (!activeSel) return null
          return (
            <div key={idx} className="text-[11px] font-mono text-gray-500 leading-relaxed">
              {buildSmogonString(entry.atk, def, activeSel.move, activeSel.result)}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── ReportPanel root ──────────────────────────────────────────────────────────

export default function ReportPanel({ selection, onClose }) {
  const { t } = useTranslation()
  const isDouble = Array.isArray(selection) && selection.length === 2
  const team1 = useCalcStore(s => s.team1)
  const team2 = useCalcStore(s => s.team2)
  if (!selection || selection.length === 0) return null
  const getSlot = (teamKey, index) => (teamKey === 'team1' ? team1 : team2)[index]
  const liveEntry = (entry) => ({ ...entry, atk: getSlot(entry.atkTeam, entry.atkIndex) || entry.atk, def: getSlot(entry.defTeam, entry.defIndex) || entry.def })
  const entry1 = liveEntry(selection[0])
  const entry2 = isDouble ? liveEntry(selection[1]) : null
  const liveSelection = isDouble ? [entry1, entry2] : [entry1]

  return (
    <section aria-label={t("report.damage_report_aria")} className="mb-4">
      {/* Pulsante chiudi fuori dal pannello */}

      {isDouble
        ? <CumulativePanel entries={liveSelection} />
        : <SinglePanel entry={entry1} onClose={onClose} />
      }
    </section>
  )
}