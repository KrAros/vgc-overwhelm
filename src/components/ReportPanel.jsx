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
  if (hits === 1) return 'guaranteed OHKO'
  if (hits === 2) return 'guaranteed 2HKO'
  if (hits === 3) return 'guaranteed 3HKO'
  return `guaranteed ${hits}HKO`
}

function buildSmogonString(atk, def, move, result) {
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

// ── Sitrus Berry simulation ────────────────────────────────────────────────────
// Simula fino a 6 turni di danno con una Sitrus Berry che heala il 25% HP
// una sola volta (quando si attiva, cioè HP scende sotto 50%).
// Restituisce un array di oggetti turno + XHKO finale.

function simulateSitrus(rolls, defHP) {
  // Usiamo danno medio (mediana dei roll) per la simulazione
  const midDmg = rolls[Math.floor(rolls.length / 2)]
  const sitrusHeal = Math.floor(defHP * 0.25)

  let hp = defHP
  let sitrusUsed = false
  const turns = []

  for (let t = 1; t <= 6; t++) {
    hp -= midDmg
    const dmgNote = `T${t}: −${midDmg} HP`

    if (hp <= 0) {
      turns.push({ t, hp: 0, note: dmgNote, ko: true })
      break
    }

    turns.push({ t, hp, note: dmgNote, ko: false })

    // Sitrus si attiva se HP ≤ 50% e non ancora usata
    if (!sitrusUsed && hp <= Math.floor(defHP / 2)) {
      const healed = Math.min(hp + sitrusHeal, defHP) - hp
      hp = Math.min(hp + sitrusHeal, defHP)
      sitrusUsed = true
      turns.push({ t, hp, note: `  🍊 Sitrus Berry: +${healed} HP`, heal: true })
    }
  }

  // Calcola XHKO
  const koTurn = turns.find(r => r.ko)
  const hko = koTurn ? `${koTurn.t}HKO` : 'No KO in 6T'

  return { turns: turns.filter(r => !r.heal || r.heal), healTurns: turns, hko }
}

// ── Scheda singola mossa ───────────────────────────────────────────────────────

function MoveCard({ atk, def, move, result }) {
  const hko    = calcHKO(result.minPct)
  const smogon = buildSmogonString(atk, def, move, result)
  const rolls  = result.rolls
  const hasSitrus = def.item === 'sitrus berry'

  const sitrus = hasSitrus ? simulateSitrus(rolls, result.defHP) : null

  const hkoColor = result.minPct >= 100 ? 'text-red-400' :
                   result.minPct >= 50  ? 'text-orange-400' :
                   result.minPct >= 25  ? 'text-teal-300' : 'text-green-400'

  return (
    <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50 space-y-2">
      {/* Header mossa */}
      <div className="flex items-center justify-between">
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

      {/* Stringa Smogon */}
      <div className="text-xs text-gray-500 font-mono">
        {smogon}: {result.minDmg}–{result.maxDmg} / {result.defHP} HP
      </div>

      {/* Roll grid */}
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

      {/* Simulazione Sitrus Berry */}
      {sitrus && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <div className="text-[10px] text-orange-300 font-semibold mb-1 uppercase tracking-wide">
            🍊 Simulazione Sitrus Berry (danno medio)
          </div>
          <div className="space-y-0.5">
            {sitrus.healTurns.map((row, i) => (
              <div key={i} className={`text-xs font-mono ${
                row.ko   ? 'text-red-400' :
                row.heal ? 'text-orange-300' :
                           'text-gray-400'
              }`}>
                {row.note}
                {!row.heal && !row.ko && ` → ${row.hp}/${result.defHP} HP`}
                {row.ko && ' → KO'}
              </div>
            ))}
          </div>
          <div className={`mt-1 text-xs font-bold ${
            sitrus.hko === 'No KO in 6T' ? 'text-green-400' : 'text-orange-400'
          }`}>
            Risultato: {sitrus.hko}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Singola ───────────────────────────────────────────────────────────────

function SinglePanel({ entry, fieldOverride }) {
  const { atk, def, dir, allMoves } = entry

  // Ricostruiamo i risultati live dallo store
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
          atkPokemon: atk.key,
          atkSPs: atk.sps || [0,0,0,0,0,0],
          atkNature: atk.nature,
          atkBoost: atk.atkBoost || 0,
          spAtkBoost: atk.spAtkBoost || 0,
          atkItem: atk.item || null,
          atkAbility: atk.ability || null,
          atkAbilityFlags: atk.abilityFlags || {},
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
          defAbilityFlags: def.abilityFlags || {},
        },
        move,
        field,
      })
      return { move, result }
    }).filter(({ result }) => result && !result.immune && result.maxPct > 0)
  }, [atk, def, dir, doubleTarget, weather, terrain, helpingHand, auroraVeil, lightScreen, reflect, crit])

  const [selectedMove, setSelectedMove] = useState(null)

  // Seleziona la mossa con maxPct più alto come default
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
      {/* Dropdown scelta mossa */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Mossa:</span>
        <select
          value={activeMoveKey}
          onChange={e => setSelectedMove(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-teal-500"
        >
          {computedMoves.map(({ move }) => (
            <option key={move} value={move}>{move.replace(/-/g, ' ')}</option>
          ))}
        </select>
      </div>

      {active && (
        <MoveCard atk={atk} def={def} move={active.move} result={active.result} />
      )}
    </div>
  )
}

// ── Tab Cumulativo ────────────────────────────────────────────────────────────

function CumulativePanel({ entries }) {
  const [entry1, entry2] = entries
  // entry1 e entry2 hanno lo stesso difensore (stessa colonna)
  const def = entry1.def

  const doubleTarget = useCalcStore(s => s.doubleTarget)
  const weather      = useCalcStore(s => s.weather)
  const terrain      = useCalcStore(s => s.terrain)
  const helpingHand  = useCalcStore(s => s.helpingHand)
  const auroraVeil   = useCalcStore(s => s.auroraVeil)
  const lightScreen  = useCalcStore(s => s.lightScreen)
  const reflect      = useCalcStore(s => s.reflect)
  const crit         = useCalcStore(s => s.crit)

  // Calcolo mosse per i due attaccanti — due useMemo separati (hooks regola: no hooks in funzioni annidate)
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
          atkPokemon: atk.key,
          atkSPs: atk.sps || [0,0,0,0,0,0],
          atkNature: atk.nature,
          atkBoost: atk.atkBoost || 0,
          spAtkBoost: atk.spAtkBoost || 0,
          atkItem: atk.item || null,
          atkAbility: atk.ability || null,
          atkAbilityFlags: atk.abilityFlags || {},
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
          defAbilityFlags: def.abilityFlags || {},
        },
        move,
        field,
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

  const active1 = moves1.find(m => m.move === (sel1 || default1?.move)) || default1
  const active2 = moves2.find(m => m.move === (sel2 || default2?.move)) || default2

  // Calcolo cumulativo
  const cumulative = useMemo(() => {
    if (!active1 || !active2) return null
    const r1 = active1.result
    const r2 = active2.result
    const defHP = r1.defHP

    const rolls1 = r1.rolls  // 16 valori
    const rolls2 = r2.rolls  // 16 valori

    // Conta le combinazioni (16×16=256) in cui la somma ≥ defHP
    let koCount = 0
    for (const a of rolls1) {
      for (const b of rolls2) {
        if (a + b >= defHP) koCount++
      }
    }

    const totalCombos = rolls1.length * rolls2.length  // 256
    const minSum = rolls1[0] + rolls2[0]
    const maxSum = rolls1[rolls1.length - 1] + rolls2[rolls2.length - 1]
    const minPct = Math.floor(minSum / defHP * 1000) / 10
    const maxPct = Math.floor(maxSum / defHP * 1000) / 10

    // Esprimiamo il risultato come "X/16 roll" semplificato:
    // proiettiamo le 256 combinazioni su 16 "slot" proporzionali
    // (semplificazione accettata: usiamo il conteggio grezzo / 16)
    const koOf16 = Math.round(koCount / (totalCombos / 16))

    return { minPct, maxPct, defHP, minSum, maxSum, koCount, totalCombos, koOf16 }
  }, [active1, active2])

  const badge = !cumulative ? null :
    cumulative.minPct >= 100 ? { text: 'KO garantito', cls: 'bg-green-900/40 border-green-500/50 text-green-400' } :
    cumulative.koOf16 > 0    ? { text: `KO probabile (${cumulative.koOf16}/16)`, cls: 'bg-yellow-900/40 border-yellow-500/50 text-yellow-400' } :
                               { text: 'No KO', cls: 'bg-gray-800 border-gray-600 text-gray-400' }

  const atkColor1 = 'text-teal-400'
  const atkColor2 = 'text-violet-400'

  return (
    <div className="space-y-4">
      {/* Riga attaccanti */}
      <div className="grid grid-cols-2 gap-3">
        {[entry1, entry2].map((entry, idx) => {
          const moves     = idx === 0 ? moves1 : moves2
          const sel       = idx === 0 ? sel1   : sel2
          const setSel    = idx === 0 ? setSel1 : setSel2
          const deflt     = idx === 0 ? default1 : default2
          const color     = idx === 0 ? atkColor1 : atkColor2
          const ringColor = idx === 0 ? 'border-teal-500/50' : 'border-violet-500/50'
          const activeSel = idx === 0 ? active1 : active2

          return (
            <div key={idx} className={`bg-gray-900/60 rounded-lg p-3 border ${ringColor}`}>
              {/* Header attaccante con sprite */}
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={spriteUrl(entry.atk.key)}
                  alt={entry.atk.key}
                  className="w-8 h-8 object-contain"
                  onError={e => { e.target.style.display = 'none' }}
                />
                <span className={`text-sm font-semibold capitalize ${color}`}>
                  {entry.atk.key}
                </span>
              </div>

              {/* Dropdown mossa */}
              {moves.length > 0 ? (
                <>
                  <select
                    value={sel || deflt?.move || ''}
                    onChange={e => setSel(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-teal-500 mb-2"
                  >
                    {moves.map(({ move }) => (
                      <option key={move} value={move}>{move.replace(/-/g, ' ')}</option>
                    ))}
                  </select>
                  {activeSel && (
                    <div className="text-xs text-gray-400 font-mono">
                      {activeSel.result.minPct}–{activeSel.result.maxPct}%
                      <span className="text-gray-600 ml-1">
                        ({activeSel.result.minDmg}–{activeSel.result.maxDmg} / {activeSel.result.defHP})
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

      {/* Riepilogo difensore */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>vs.</span>
        <img
          src={spriteUrl(def.key)}
          alt={def.key}
          className="w-6 h-6 object-contain"
          onError={e => { e.target.style.display = 'none' }}
        />
        <span className="capitalize text-gray-300">{def.key}</span>
        {cumulative && <span>({cumulative.defHP} HP)</span>}
      </div>

      {/* Risultato cumulativo */}
      {cumulative && (
        <div className="bg-gray-900/80 rounded-lg p-3 border border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Danno totale</span>
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold ${cumulative.minPct >= 100 ? 'text-red-400' : cumulative.maxPct >= 100 ? 'text-orange-400' : 'text-teal-300'}`}>
                {cumulative.minPct}–{cumulative.maxPct}%
              </span>
              <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${badge.cls}`}>
                {badge.text}
              </span>
            </div>
          </div>

          <div className="text-xs text-gray-500 font-mono">
            min: {cumulative.minSum} + max: {cumulative.maxSum} su {cumulative.defHP} HP
          </div>

          {/* Barra KO probability */}
          <div>
            <div className="text-[10px] text-gray-600 mb-1">
              Combinazioni KO: {cumulative.koCount}/{cumulative.totalCombos} ({cumulative.koOf16}/16 roll equivalenti)
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  cumulative.koCount === cumulative.totalCombos ? 'bg-green-500' :
                  cumulative.koCount > 0 ? 'bg-yellow-500' : 'bg-gray-600'
                }`}
                style={{ width: `${(cumulative.koCount / cumulative.totalCombos) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ReportPanel root ──────────────────────────────────────────────────────────
// selection: null | CellEntry[] (1 = singola, 2 = cumulativa)

export default function ReportPanel({ selection, onClose }) {
  // Tab attiva: 'single' | 'cumulative'
  // Auto-switch a 'cumulative' quando arrivano 2 entries
  const isDouble = Array.isArray(selection) && selection.length === 2
  const [activeTab, setActiveTab] = useState('single')

  // Quando cambia la selezione: se doppia, vai su cumulativo; se singola, torna a singolo
  const tab = isDouble ? (activeTab === 'cumulative' ? 'cumulative' : 'cumulative') : 'single'

  if (!selection || selection.length === 0) return null

  const entry1 = selection[0]
  const { atk, def } = entry1

  return (
    <div className={`bg-gray-800 rounded-xl border p-4 mb-4 ${
      isDouble ? 'border-violet-500/50' : 'border-teal-500/50'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isDouble ? (
            <>
              <span className="text-sm font-medium text-teal-400 capitalize">{entry1.atk.key}</span>
              <span className="text-gray-500">+</span>
              <span className="text-sm font-medium text-violet-400 capitalize">{selection[1].atk.key}</span>
              <span className="text-gray-500">→</span>
              <span className="text-sm font-medium text-gray-300 capitalize">{def.key}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-violet-900/40 border border-violet-500/40 text-violet-300">
                Cumulativo
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-teal-400 capitalize">{atk.key}</span>
              <span className="text-gray-500">→</span>
              <span className="text-sm font-medium text-gray-300 capitalize">{def.key}</span>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors"
        >
          ✕ chiudi
        </button>
      </div>

      {/* Tab bar — mostrata solo in modalità singola (la doppia ha solo cumulativo) */}
      {!isDouble && (
        <div className="flex gap-1 mb-3 border-b border-gray-700 pb-2">
          <button
            onClick={() => setActiveTab('single')}
            className={`text-xs px-3 py-1 rounded-t transition-colors ${
              activeTab === 'single'
                ? 'bg-teal-900/60 border border-teal-500/50 text-teal-300'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Singola
          </button>
        </div>
      )}

      {/* Contenuto */}
      {isDouble ? (
        <CumulativePanel entries={selection} />
      ) : (
        <SinglePanel entry={entry1} />
      )}
    </div>
  )
}