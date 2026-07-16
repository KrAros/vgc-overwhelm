import { useMemo, useState } from 'react'
import movesData from '../data/moves.json'
import pokemonData from '../data/pokemon.json'
import { calculateDamage } from '../calcEngine'
import useCalcStore from '../store/useCalcStore'
import { NATURE_MODIFIERS } from '../data/natures'

// ── Helpers generici ──────────────────────────────────────────────────────────

function calcHKO(minPct) {
  if (minPct <= 0) return null
  const hits = Math.ceil(100 / minPct)
  if (hits === 1) return 'OHKO'
  if (hits === 2) return '2HKO'
  if (hits === 3) return '3HKO'
  return `${hits}HKO`
}

function buildSmogonString(atk, def, move, result) {
  const moveData = movesData[move]
  if (!moveData) return ''

  const isSpecial = moveData.category === 1
  const atkStatIdx = isSpecial ? 3 : 1

  const atkSP = atk.sps?.[atkStatIdx] || 0
  const defSP = def.sps?.[isSpecial ? 4 : 2] || 0
  const defHP = def.sps?.[0] || 0

  const nature = atk.nature
  const mod = nature && NATURE_MODIFIERS[nature]
  const isBoost = mod && mod[0] !== 0 && mod[0] === atkStatIdx
  const isDrop  = mod && mod[0] !== 0 && mod[1] === atkStatIdx
  const natSymbol = isBoost ? '+' : isDrop ? '-' : ''

  const statName    = isSpecial ? 'SpA' : 'Atk'
  const defStatName = isSpecial ? 'SpD' : 'Def'

  const moveName = move.replace(/-/g, ' ')
  const atkBoostVal = result?.atkBoostEffective !== undefined
    ? result.atkBoostEffective
    : isSpecial ? (atk.spAtkBoost || 0) : (atk.atkBoost || 0)
  const atkBoostStr = atkBoostVal > 0 ? `+${atkBoostVal} ` : atkBoostVal < 0 ? `${atkBoostVal} ` : ''
  const atkAbilityName = atk.ability ? ` ${atk.ability.replace(/\b\w/g, c => c.toUpperCase())}` : ''
  const defBoostVal = isSpecial ? (def.spDefBoost || 0) : (def.defBoost || 0)
  const defBoostStr = defBoostVal > 0 ? `+${defBoostVal} ` : defBoostVal < 0 ? `${defBoostVal} ` : ''
  const atkItemName = atk.item ? ` ${atk.item.replace(/\b\w/g, c => c.toUpperCase())}` : ''
  const defItemName = def.item ? ` ${def.item.replace(/\b\w/g, c => c.toUpperCase())}` : ''

  return `${atkBoostStr}${atkSP}${natSymbol} ${statName}${atkAbilityName}${atkItemName} ${atk.key} ${moveName} vs. ${defHP} HP / ${defBoostStr}${defSP} ${defStatName}${defItemName} ${def.key}`
}

// ── Sprite helpers ────────────────────────────────────────────────────────────

const _resolveNum = (key) => {
  const data = pokemonData[key]
  if (!data) return null
  let num = data.num
  if (!num) {
    const baseName = key
      .replace(/-mega.*$/, '')
      .replace(/-primal$/, '')
      .replace(/-unbound$/, '')
    num = pokemonData[baseName]?.num || ''
  }
  return num?.replace('#', '').padStart(4, '0') || null
}

const spriteUrl = (key) => {
  if (!key) return null
  const data = pokemonData[key]
  if (!data) return null
  const isMegaY = key.includes('-mega-y')
  const isMegaX = key.includes('-mega-x')
  const isMega  = data.mega === 1
  const isAlola = key.includes('-alola')
  const num = _resolveNum(key)
  if (!num) return null
  const form = isMegaY ? 'f02' : (isMegaX || isMega || isAlola) ? 'f01' : 'f00'
  return `https://resource.pokemon-home.com/battledata/img/pokei128/icon${num}_${form}_s0.png`
}

// ── Sitrus Berry simulation ───────────────────────────────────────────────────

function simulateSitrus(rolls, defHP) {
  const midDmg = rolls[Math.floor(rolls.length / 2)]
  const sitrusHeal = Math.floor(defHP * 0.25)
  let hp = defHP
  let sitrusUsed = false
  const healTurns = []

  for (let t = 1; t <= 6; t++) {
    hp -= midDmg
    const dmgNote = `T${t}: −${midDmg} HP`
    if (hp <= 0) {
      healTurns.push({ t, hp: 0, note: dmgNote, ko: true })
      break
    }
    healTurns.push({ t, hp, note: dmgNote, ko: false })
    if (!sitrusUsed && hp <= Math.floor(defHP / 2)) {
      const healed = Math.min(hp + sitrusHeal, defHP) - hp
      hp = Math.min(hp + sitrusHeal, defHP)
      sitrusUsed = true
      healTurns.push({ t, hp, note: `🍊 Sitrus Berry: +${healed} HP`, heal: true })
    }
  }

  const koTurn = healTurns.find(r => r.ko)
  return { healTurns, hko: koTurn ? `${koTurn.t}HKO` : 'No KO in 6T' }
}





// ── MoveCard — layout migliorato ─────────────────────────────────────────────

function MoveCard({ atk, def, move, result }) {
  const hko       = calcHKO(result.minPct)
  const smogon    = buildSmogonString(atk, def, move, result)
  const rolls     = result.rolls
  const hasSitrus = def.item === 'sitrus berry'
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

      {/* Riga 2: stringa Smogon + danni grezzi su una riga */}
      <div className="text-[11px] font-mono leading-relaxed">
        <span className="text-gray-400">{smogon}</span>
        <span className="text-gray-600 ml-1">
          → {result.minDmg}–{result.maxDmg} / {result.defHP} HP
        </span>
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
      {sitrus && (
        <div className="pt-2 border-t border-gray-700/50 space-y-1">
          <div className="text-[10px] text-orange-300 font-semibold uppercase tracking-wide">
            🍊 Sitrus Berry — simulazione (danno medio)
          </div>
          {sitrus.healTurns.map((row, i) => (
            <div key={i} className={`text-xs font-mono ${
              row.ko ? 'text-red-400' : row.heal ? 'text-orange-300' : 'text-gray-400'
            }`}>
              {row.note}
              {!row.heal && !row.ko && ` → ${row.hp}/${result.defHP} HP`}
              {row.ko && ' → KO'}
            </div>
          ))}
          <div className={`text-xs font-bold ${
            sitrus.hko === 'No KO in 6T' ? 'text-green-400' : 'text-orange-400'
          }`}>
            Risultato: {sitrus.hko}
          </div>
        </div>
      )}
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

      {active && <MoveCard atk={atk} def={def} move={active.move} result={active.result} />}
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
                      <span className="text-gray-600 ml-1">
                        → {activeSel.result.minDmg}–{activeSel.result.maxDmg} / {activeSel.result.defHP}
                      </span>
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

  if (!selection || selection.length === 0) return null

  const entry1 = selection[0]
  const { atk, def } = entry1

  return (
    <div className={`bg-gray-800 rounded-xl border p-4 mb-4 ${
      isDouble ? 'border-violet-500/50' : 'border-teal-500/50'
    }`}>
      {/* Header con sprite inline */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isDouble ? (
            <>
              <img src={spriteUrl(entry1.atk.key)} className="w-6 h-6 object-contain" onError={e => { e.target.style.display='none' }} alt="" />
              <span className="text-sm font-semibold text-teal-400 capitalize">{entry1.atk.key}</span>
              <span className="text-gray-600 mx-0.5">+</span>
              <img src={spriteUrl(selection[1].atk.key)} className="w-6 h-6 object-contain" onError={e => { e.target.style.display='none' }} alt="" />
              <span className="text-sm font-semibold text-violet-400 capitalize">{selection[1].atk.key}</span>
              <span className="text-gray-600 mx-0.5">→</span>
              <img src={spriteUrl(def.key)} className="w-6 h-6 object-contain" onError={e => { e.target.style.display='none' }} alt="" />
              <span className="text-sm font-medium text-gray-300 capitalize">{def.key}</span>
            </>
          ) : (
            <>
              <img src={spriteUrl(atk.key)} className="w-6 h-6 object-contain" onError={e => { e.target.style.display='none' }} alt="" />
              <span className="text-sm font-semibold text-teal-400 capitalize">{atk.key}</span>
              <span className="text-gray-600 mx-0.5">→</span>
              <img src={spriteUrl(def.key)} className="w-6 h-6 object-contain" onError={e => { e.target.style.display='none' }} alt="" />
              <span className="text-sm font-medium text-gray-300 capitalize">{def.key}</span>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors shrink-0 ml-2"
        >
          ✕ chiudi
        </button>
      </div>

      {/* Contenuto */}
      {isDouble
        ? <CumulativePanel entries={selection} />
        : <SinglePanel entry={entry1} />
      }
    </div>
  )
}