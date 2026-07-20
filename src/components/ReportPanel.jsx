import { useMemo, useState } from 'react'
import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'
import { buildSmogonString } from '../utils/smogonString'
import { spriteUrl } from '../utils/sprite'

// ── Helpers generici ──────────────────────────────────────────────────────────

function calcHKO(minPct) {
  if (minPct <= 0) return null
  const hits = Math.ceil(100 / minPct)
  if (hits === 1) return 'Guaranteed OHKO'
  if (hits === 2) return 'Guaranteed 2HKO'
  if (hits === 3) return 'Guaranteed 3HKO'
  return `Guaranteed ${hits}HKO`
}

// ── Sitrus Berry simulation ───────────────────────────────────────────────────

// Calcolo esatto probabilità Sitrus Berry
// DP su stati (hp, sitrusUsed) — i roll con duplicati hanno peso 1/16 ciascuno
function _calcSitrusProb(rolls, defHP, maxTurns = 6) {
  const sitrusHeal = Math.floor(defHP * 0.25)
  const halfHP     = Math.floor(defHP / 2)

  let states = new Map()
  states.set(`${defHP},0`, 1.0)
  const koAtTurn = {}

  for (let t = 1; t <= maxTurns; t++) {
    const next = new Map()
    let koThisTurn = 0

    for (const [key, prob] of states) {
      const comma  = key.indexOf(',')
      const hp     = parseInt(key.slice(0, comma))
      const used   = key[comma + 1] === '1'

      for (const dmg of rolls) {
        const p     = prob / rolls.length
        const newHp = hp - dmg

        if (newHp <= 0) {
          koThisTurn += p
        } else {
          let fHp   = newHp
          let fUsed = used
          if (!used && newHp <= halfHP) {
            fHp   = Math.min(newHp + sitrusHeal, defHP)
            fUsed = true
          }
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

function simulateSitrus(rolls, defHP) {
  // ── Simulazione visiva con danno medio ──
  const midDmg     = rolls[Math.floor(rolls.length / 2)]
  const sitrusHeal = Math.floor(defHP * 0.25)
  let hp = defHP, sitrusUsed = false
  const healTurns = []

  for (let t = 1; t <= 6; t++) {
    hp -= midDmg
    if (hp <= 0) {
      healTurns.push({ t, hp: 0, ko: true })
      break
    }
    healTurns.push({ t, hp, ko: false })
    if (!sitrusUsed && hp <= Math.floor(defHP / 2)) {
      const healed = Math.min(hp + sitrusHeal, defHP) - hp
      hp = Math.min(hp + sitrusHeal, defHP)
      sitrusUsed = true
      healTurns.push({ t, hp, heal: true, healed })
    }
  }

  const koTurn = healTurns.find(r => r.ko)
  const hko    = koTurn ? `${koTurn.t}HKO` : 'No KO in 6T'

  // ── Calcolo probabilistico esatto ──
  const koAtTurn = _calcSitrusProb(rolls, defHP)

  const bestTurn = Object.entries(koAtTurn)
    .filter(([, p]) => p > 0.0001)
    .sort((a, b) => Number(a[0]) - Number(b[0]))[0]

  const totalKoProb = Object.values(koAtTurn).reduce((a, b) => a + b, 0)
  const activeTurns = Object.values(koAtTurn).filter(p => p > 0.0001).length

  let summary
  if (!bestTurn || totalKoProb < 0.0001) {
    summary = { text: 'No KO in 6 turns after Sitrus Berry recovery', color: 'text-green-400' }
  } else if (totalKoProb > 0.9999 && activeTurns === 1) {
    summary = {
      text: `Guaranteed ${bestTurn[0]}HKO after Sitrus Berry recovery`,
      color: 'text-orange-400'
    }
  } else {
    const pct = Math.round(bestTurn[1] * 1000) / 10
    summary = {
      text: `${pct}% chance to ${bestTurn[0]}HKO after Sitrus Berry recovery`,
      color: pct >= 50 ? 'text-orange-400' : 'text-yellow-400'
    }
  }

  return { healTurns, midDmg, hko, summary }
}



// ── SitrusSection ────────────────────────────────────────────────────────────

function SitrusSection({ sitrus, defHP }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="pt-2 border-t border-gray-700/50 space-y-1.5">

      {/* Frase sintetica sempre visibile */}
      <div className="flex items-center gap-1.5">
        <img src="https://www.serebii.net/itemdex/sprites/sitrusberry.png" alt="Sitrus Berry" className="w-4 h-4 object-contain shrink-0" />
        <span className={`text-xs font-semibold ${sitrus.summary.color}`}>
          {sitrus.summary.text}
        </span>
      </div>

      {/* Toggle dettaglio turni */}
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>{open ? 'Nascondi simulazione' : 'Mostra simulazione turno per turno'}</span>
      </button>

      {/* Dettaglio turni — collassabile */}
      {open && (
        <div className="space-y-1 pl-1 pt-1">
          {sitrus.healTurns.map((row, i) => {
            // Separatore visivo per l'evento bacca
            if (row.heal) {
              return (
                <div key={i} className="flex items-center gap-2 my-1.5 py-1.5 px-2 rounded-md bg-orange-900/20 border border-orange-700/30">
                  <img src="https://www.serebii.net/itemdex/sprites/sitrusberry.png" alt="" className="w-4 h-4 object-contain shrink-0" />
                  <span className="text-xs text-orange-300 font-semibold">
                    La Sitrus Berry si attiva! +{row.healed} HP → {row.hp}/{defHP} HP
                  </span>
                </div>
              )
            }
            return (
              <div key={i} className={`text-xs font-mono ${row.ko ? 'text-red-400' : 'text-gray-400'}`}>
                <span className="text-gray-600 mr-1">Turno {row.t}:</span>
                −{sitrus.midDmg} HP
                {!row.ko && <span className="text-gray-500"> → {row.hp}/{defHP} HP</span>}
                {row.ko && <span className="text-red-400"> → KO</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── MoveCard — layout migliorato ─────────────────────────────────────────────

function MoveCard({ atk, def, move, result, field = {} }) {
  const hko       = calcHKO(result.minPct)
  const smogon    = buildSmogonString(atk, def, move, result, field)
  const rolls     = result.rolls
  const hasSitrus = def.item === 'sitrus berry' && result.minPct < 100
  const sitrus    = hasSitrus ? simulateSitrus(rolls, result.defHP) : null

  const pctColor = result.minPct >= 100 ? 'text-red-400' :
                   result.maxPct >= 100  ? 'text-orange-400' :
                   result.minPct >= 50   ? 'text-orange-300' :
                   result.minPct >= 25   ? 'text-teal-300' : 'text-green-400'

  const hkoBadge = result.minPct >= 100
    ? 'border-red-500/50 text-red-400 bg-red-900/20'
    : result.maxPct >= 100
    ? 'border-orange-500/50 text-orange-400 bg-orange-900/20'
    : 'border-gray-600/60 text-gray-400 bg-gray-800/60'

  return (
    <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50 space-y-2.5">

      {/* Riga 1: nome mossa grande + % + badge HKO */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold text-white capitalize tracking-wide">
          {move.replace(/-/g, ' ')}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-base font-bold ${pctColor}`}>
            {result.minPct}–{result.maxPct}%
          </span>
          {hko && (
            <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${hkoBadge}`}>
              {hko}
            </span>
          )}
        </div>
      </div>

      {/* Riga 2: stringa Smogon stile Showdown */}
      <div className="text-[11px] font-mono leading-relaxed text-gray-400">
        {smogon}
      </div>

      {/* Roll grid */}
      <div className="flex flex-wrap gap-1">
        {rolls.map((r, i) => (
          <span
            key={i}
            className={`text-xs px-1.5 py-0.5 rounded font-mono ${
              r >= result.defHP ? 'bg-red-900/40 text-red-300' : 'bg-gray-700/60 text-gray-400'
            }`}
          >
            {r}
          </span>
        ))}
      </div>

      {/* Simulazione Sitrus Berry */}
      {sitrus && <SitrusSection sitrus={sitrus} defHP={result.defHP} />}
    </div>
  )
}

// ── SinglePanel ───────────────────────────────────────────────────────────────

function SinglePanel({ entry }) {
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
        attacker: {
          atkPokemon: atk.key, atkSPs: atk.sps || [0,0,0,0,0,0],
          atkNature: atk.nature, atkBoost: atk.atkBoost || 0,
          spAtkBoost: atk.spAtkBoost || 0, atkItem: atk.item || null,
          atkAbility: atk.ability || null, atkAbilityFlags: atk.abilityFlags || {},
          level: 50,
        },
        defender: {
          defPokemon: def.key, defSPs: def.sps || [0,0,0,0,0,0],
          defNature: def.nature, defBoost: def.defBoost || 0,
          spDefBoost: def.spDefBoost || 0, defItem: def.item || null,
          defAbility: def.ability || null, defAbilityFlags: def.abilityFlags || {},
        },
        move, field,
      })
      return { move, result }
    }).filter(({ result }) => result && !result.immune && result.maxPct > 0)
  }, [atk, def, dir, doubleTarget, weather, terrain, helpingHand, auroraVeil, lightScreen, reflect, crit])

  const [selectedMove, setSelectedMove] = useState(null)

  const defaultMove = computedMoves.length > 0
    ? computedMoves.reduce((a, b) => b.result.maxPct > a.result.maxPct ? b : a)
    : null
  const activeMoveKey = selectedMove || defaultMove?.move
  const active = computedMoves.find(m => m.move === activeMoveKey) || defaultMove

  if (computedMoves.length === 0) {
    return <div className="text-gray-500 text-xs">Nessuna mossa offensiva disponibile.</div>
  }

  return (
    <div className="space-y-3">
      {/* Dropdown con % inline */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Mossa:</span>
        <select
          value={activeMoveKey}
          onChange={e => setSelectedMove(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-teal-500"
        >
          {computedMoves.map(({ move, result }) => (
            <option key={move} value={move}>
              {move.replace(/-/g, ' ')} — {result.minPct}–{result.maxPct}%
            </option>
          ))}
        </select>
      </div>

      {active && (() => {
        const field = {
          weather, terrain, doubleTarget,
          helpingHand: dir === 't1' ? helpingHand.t1 : helpingHand.t2,
          auroraVeil:  dir === 't1' ? auroraVeil.t2  : auroraVeil.t1,
          lightScreen: dir === 't1' ? lightScreen.t2  : lightScreen.t1,
          reflect:     dir === 't1' ? reflect.t2      : reflect.t1,
        }
        return <MoveCard atk={atk} def={def} move={active.move} result={active.result} field={field} />
      })()}
    </div>
  )
}

// ── CumulativePanel ───────────────────────────────────────────────────────────

function CumulativePanel({ entries }) {
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
        attacker: {
          atkPokemon: atk.key, atkSPs: atk.sps || [0,0,0,0,0,0],
          atkNature: atk.nature, atkBoost: atk.atkBoost || 0,
          spAtkBoost: atk.spAtkBoost || 0, atkItem: atk.item || null,
          atkAbility: atk.ability || null, atkAbilityFlags: atk.abilityFlags || {},
          level: 50,
        },
        defender: {
          defPokemon: def.key, defSPs: def.sps || [0,0,0,0,0,0],
          defNature: def.nature, defBoost: def.defBoost || 0,
          spDefBoost: def.spDefBoost || 0, defItem: def.item || null,
          defAbility: def.ability || null, defAbilityFlags: def.abilityFlags || {},
        },
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
    const r1 = active1.result
    const r2 = active2.result
    const defHP = r1.defHP
    const rolls1 = r1.rolls
    const rolls2 = r2.rolls

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
    cumulative.minPct >= 100 ? { text: 'KO garantito', cls: 'bg-green-900/40 border-green-500/50 text-green-300' } :
    cumulative.koOf16 > 0    ? { text: `KO probabile (${cumulative.koOf16}/16)`, cls: 'bg-yellow-900/40 border-yellow-500/50 text-yellow-300' } :
                               { text: 'No KO', cls: 'bg-gray-800 border-gray-600 text-gray-500' }

  return (
    <div className="space-y-4">

      {/* Box attaccanti affiancati */}
      <div className="grid grid-cols-2 gap-3">
        {[entry1, entry2].map((entry, idx) => {
          const moves     = idx === 0 ? moves1  : moves2
          const sel       = idx === 0 ? sel1    : sel2
          const setSel    = idx === 0 ? setSel1 : setSel2
          const deflt     = idx === 0 ? default1 : default2
          const activeSel = idx === 0 ? active1  : active2
          const color     = idx === 0 ? 'text-teal-400'      : 'text-violet-400'
          const ring      = idx === 0 ? 'border-teal-500/40' : 'border-violet-500/40'

          return (
            <div key={idx} className={`bg-gray-900/60 rounded-lg p-3 border ${ring} space-y-2`}>
              {/* Sprite + nome */}
              <div className="flex items-center gap-2">
                <img
                  src={spriteUrl(entry.atk.key)}
                  alt={entry.atk.key}
                  className="w-9 h-9 object-contain"
                  onError={e => { e.target.style.display = 'none' }}
                />
                <span className={`text-sm font-semibold capitalize ${color}`}>
                  {entry.atk.key}
                </span>
              </div>

              {/* Dropdown mosse con % */}
              {moves.length > 0 ? (
                <>
                  <select
                    value={sel || deflt?.move || ''}
                    onChange={e => setSel(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-teal-500"
                  >
                    {moves.map(({ move, result }) => (
                      <option key={move} value={move}>
                        {move.replace(/-/g, ' ')} — {result.minPct}–{result.maxPct}%
                      </option>
                    ))}
                  </select>

                  {/* Stringa Smogon compatta */}
                  {activeSel && (
                    <div className="text-[10px] text-gray-500 font-mono leading-relaxed">
                      {buildSmogonString(entry.atk, def, activeSel.move, activeSel.result)}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-600">Nessuna mossa offensiva</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Riga difensore */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>vs.</span>
        <img
          src={spriteUrl(def.key)}
          alt={def.key}
          className="w-6 h-6 object-contain"
          onError={e => { e.target.style.display = 'none' }}
        />
        <span className="capitalize text-gray-300 font-medium">{def.key}</span>
        {cumulative && <span className="text-gray-600">— {cumulative.defHP} HP</span>}
      </div>

      {/* Box danno totale */}
      {cumulative && (() => {
        const sums = cumulative.rolls1.map((r, i) => r + cumulative.rolls2[i])
        const midSum = sums[Math.floor(sums.length / 2)]
        const koPct  = Math.round(cumulative.koCount / cumulative.totalCombos * 100)

        return (
          <div className="bg-gray-900/80 rounded-lg p-4 border border-gray-700 space-y-3">

            {/* Riga narrativa — testo più grande */}
            <div className="text-sm text-gray-400 leading-relaxed">
              <span className="text-teal-400 font-semibold capitalize">{entry1.atk.key}</span>
              {active1 && <span className="text-gray-500"> usa <span className="text-gray-200 capitalize">{active1.move.replace(/-/g, ' ')}</span></span>}
              <span className="text-gray-600"> + </span>
              <span className="text-violet-400 font-semibold capitalize">{entry2.atk.key}</span>
              {active2 && <span className="text-gray-500"> usa <span className="text-gray-200 capitalize">{active2.move.replace(/-/g, ' ')}</span></span>}
              <span className="text-gray-600"> → </span>
              <span className="text-gray-200 font-semibold capitalize">{def.key}</span>
              <span className="text-gray-600"> ({cumulative.defHP} HP)</span>
            </div>

            {/* Danno % + badge KO sulla stessa riga */}
            <div className="flex items-center justify-between gap-3">
              <span className={`text-lg font-bold shrink-0 ${
                cumulative.minPct >= 100 ? 'text-red-400' :
                cumulative.maxPct >= 100 ? 'text-orange-400' : 'text-teal-300'
              }`}>
                {cumulative.minPct}–{cumulative.maxPct}%
              </span>
              <div className={`px-3 py-1.5 rounded-lg border font-bold text-sm tracking-wide text-center ${badge.cls}`}>
                {cumulative.minPct >= 100 ? '✓ KO garantito' :
                 cumulative.koOf16 > 0   ? `⚡ KO probabile (${cumulative.koOf16}/16)` :
                                           '✗ No KO'}
              </div>
            </div>

            {/* Triade min · mid · max */}
            <div className="text-[11px] text-gray-500 font-mono">
              min {cumulative.minSum} · mid {midSum} · max {cumulative.maxSum}
              <span className="text-gray-600"> / {cumulative.defHP} HP</span>
            </div>

            {/* Conteggio combinazioni — tiny, grigio */}
            <div className="text-[10px] text-gray-600 font-mono">
              {cumulative.koCount}/{cumulative.totalCombos} combinazioni KO ({koPct}%)
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── ReportPanel root ──────────────────────────────────────────────────────────

export default function ReportPanel({ selection, onClose }) {
  const isDouble = Array.isArray(selection) && selection.length === 2
  const team1 = useCalcStore(s => s.team1)
  const team2 = useCalcStore(s => s.team2)

  if (!selection || selection.length === 0) return null

  const getSlot = (teamKey, index) => (teamKey === 'team1' ? team1 : team2)[index]

  // Ricostruisce l'entry con atk/def live dallo store
  const liveEntry = (entry) => ({
    ...entry,
    atk: getSlot(entry.atkTeam, entry.atkIndex) || entry.atk,
    def: getSlot(entry.defTeam, entry.defIndex) || entry.def,
  })

  const entry1 = liveEntry(selection[0])
  const entry2 = isDouble ? liveEntry(selection[1]) : null
  const { atk, def } = entry1
  const liveSelection = isDouble ? [entry1, entry2] : [entry1]

  return (
    <div className={`bg-gray-800 rounded-xl border p-4 mb-4 ${
      isDouble ? 'border-violet-500/50' : 'border-teal-500/50'
    }`}>
      {/* Header con sprite — atk→def centrato, chiudi in absolute a destra */}
      <div className="relative flex items-center justify-center mb-3 min-h-[2.5rem]">
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {isDouble ? (
            <>
              <img src={spriteUrl(entry1.atk.key)} className="w-6 h-6 object-contain" onError={e => { e.target.style.display='none' }} alt="" />
              <span className="text-sm font-semibold text-teal-400 capitalize">{entry1.atk.key}</span>
              <span className="text-gray-600 mx-0.5">+</span>
              <img src={spriteUrl(entry2.atk.key)} className="w-6 h-6 object-contain" onError={e => { e.target.style.display='none' }} alt="" />
              <span className="text-sm font-semibold text-violet-400 capitalize">{entry2.atk.key}</span>
              <span className="text-gray-600 mx-0.5">→</span>
              <img src={spriteUrl(def.key)} className="w-6 h-6 object-contain" onError={e => { e.target.style.display='none' }} alt="" />
              <span className="text-sm font-medium text-gray-300 capitalize">{def.key}</span>
            </>
          ) : (
            <>
              <img src={spriteUrl(atk.key)} className="w-8 h-8 object-contain" onError={e => { e.target.style.display='none' }} alt="" />
              <span className="text-base font-bold text-teal-400 capitalize">{atk.key}</span>
              <span className="text-gray-400 mx-2 text-xs font-bold px-2 py-0.5 rounded-full bg-gray-900 border border-gray-700">vs.</span>
              <img src={spriteUrl(def.key)} className="w-8 h-8 object-contain" onError={e => { e.target.style.display='none' }} alt="" />
              <span className="text-base font-semibold text-gray-200 capitalize">{def.key}</span>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs px-2 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors"
        >
          ✕ chiudi
        </button>
      </div>

      {/* Contenuto */}
      {isDouble
        ? <CumulativePanel entries={liveSelection} />
        : <SinglePanel entry={entry1} />
      }
    </div>
  )
}