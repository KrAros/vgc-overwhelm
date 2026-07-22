import { useState } from 'react'
import useCalcStore, { encodeTeamsToURL } from '../store/useCalcStore'
import { parseShowdownPaste, teamToShowdown } from '../utils/showdownIO'

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconImport = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)
const IconExport = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
)
const IconReset = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)
const IconShare = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
)

// ── ModBtn ────────────────────────────────────────────────────────────────────

function ModBtn({ label, active, activeClass, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded border transition-colors ${
        active ? activeClass : 'text-gray-400 border-gray-600/40 hover:bg-gray-800/60'
      }`}
    >
      {label}
    </button>
  )
}

// ── ControlBar ────────────────────────────────────────────────────────────────

export default function ControlBar() {
  const helpingHand  = useCalcStore(s => s.helpingHand)
  const auroraVeil   = useCalcStore(s => s.auroraVeil)
  const lightScreen  = useCalcStore(s => s.lightScreen)
  const reflect      = useCalcStore(s => s.reflect)
  const crit         = useCalcStore(s => s.crit)
  const showKoOnly   = useCalcStore(s => s.showKoOnly)
  const team1        = useCalcStore(s => s.team1)
  const team2        = useCalcStore(s => s.team2)
  const toggleModifier   = useCalcStore(s => s.toggleModifier)
  const toggleShowKoOnly = useCalcStore(s => s.toggleShowKoOnly)
  const setTeam          = useCalcStore(s => s.setTeam)

  const [mode, setMode]           = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [warnings, setWarnings]   = useState([])
  const [feedback, setFeedback]   = useState('')

  const flash = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(''), 2500) }

  function handleImport(targetTeam) {
    const { pokemon, warnings: w } = parseShowdownPaste(pasteText)
    setWarnings(w)
    if (pokemon.length === 0) return
    const slots = Array(6).fill(null).map((_, i) => pokemon[i] || null)
    setTeam(targetTeam, slots)
    flash(`Imported ${pokemon.length} Pokémon into ${targetTeam === 'team1' ? 'Team 1' : 'Team 2'}.`)
    if (w.length === 0) setMode(null)
  }

  function handleExport(targetTeam) {
    const team = targetTeam === 'team1' ? team1 : team2
    const paste = teamToShowdown(team)
    if (!paste) return
    navigator.clipboard.writeText(paste).then(() =>
      flash(`${targetTeam === 'team1' ? 'Team 1' : 'Team 2'} copied!`)
    )
  }

  function handleReset(targetTeam) {
    setTeam(targetTeam, Array(6).fill(null))
    flash(`${targetTeam === 'team1' ? 'Team 1' : 'Team 2'} cleared.`)
  }

  function handleShare() {
    const encoded = encodeTeamsToURL(team1, team2)
    const url = window.location.origin + window.location.pathname + `?share=${encoded}`
    navigator.clipboard.writeText(url).then(() => flash('Link copied!'))
  }

  const MODS = [
    { label: 'HH',   mod: 'helpingHand', active: 'bg-green-400  text-gray-900' },
    { label: 'Veil', mod: 'auroraVeil',  active: 'bg-blue-400   text-gray-900' },
    { label: 'LS',   mod: 'lightScreen', active: 'bg-yellow-400 text-gray-900' },
    { label: 'Ref',  mod: 'reflect',     active: 'bg-pink-400   text-gray-900' },
    { label: 'Crit', mod: 'crit',        active: 'bg-red-400    text-gray-900' },
  ]

  const MODS_DESKTOP = [
    { label: 'Helping Hand', mod: 'helpingHand', active: 'bg-green-400  text-gray-900' },
    { label: 'Aurora Veil',  mod: 'auroraVeil',  active: 'bg-blue-400   text-gray-900' },
    { label: 'Light Screen', mod: 'lightScreen', active: 'bg-yellow-400 text-gray-900' },
    { label: 'Reflect',      mod: 'reflect',     active: 'bg-pink-400   text-gray-900' },
    { label: 'Crit',         mod: 'crit',        active: 'bg-red-400    text-gray-900' },
  ]

  const modVals = { helpingHand, auroraVeil, lightScreen, reflect, crit }

  const btnBase   = 'flex items-center justify-center gap-1 text-xs px-2.5 py-1 rounded border transition-colors'
  const btnNormal = `${btnBase} bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40`
  const btnActive = `${btnBase} bg-teal-800 border-teal-600 text-teal-200`
  const btnReset  = `${btnBase} bg-red-950/30 hover:bg-red-900/50 text-red-400 border-red-900/30`

  return (
    <div className="mb-3">
      <div className="bg-gray-900 rounded-xl border border-gray-700/40 px-3 pt-2 pb-1.5 space-y-1.5">

        {/* ── DESKTOP ── */}
        <div className="hidden sm:block space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold shrink-0">Team 1</span>
              <div className="flex items-center gap-1">
                {MODS_DESKTOP.map(m => (
                  <ModBtn key={m.mod} label={m.label}
                    active={modVals[m.mod].t1} activeClass={m.active}
                    onClick={() => toggleModifier(m.mod, 't1')} />
                ))}
              </div>
            </div>
            <ModBtn label="KO only" active={showKoOnly}
              activeClass="bg-red-500 text-white" onClick={toggleShowKoOnly} />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {MODS_DESKTOP.map(m => (
                  <ModBtn key={m.mod} label={m.label}
                    active={modVals[m.mod].t2} activeClass={m.active}
                    onClick={() => toggleModifier(m.mod, 't2')} />
                ))}
              </div>
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold shrink-0">Team 2</span>
            </div>
          </div>

          <div className="h-px bg-gray-700/60" />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button"
                onClick={() => { setMode(mode === 'import1' ? null : 'import1'); setWarnings([]) }}
                className={mode === 'import1' ? btnActive : btnNormal}>
                <IconImport /><span>Import</span>
              </button>
              <button type="button" onClick={() => handleExport('team1')} className={btnNormal}>
                <IconExport /><span>Export</span>
              </button>
              <button type="button" onClick={() => handleReset('team1')} className={btnReset}>
                <IconReset /><span>Clear</span>
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {feedback && <span className="text-xs text-green-400">{feedback}</span>}
              <button type="button" onClick={handleShare} className={btnNormal}>
                <IconShare /><span>Share</span>
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button type="button"
                onClick={() => { setMode(mode === 'import2' ? null : 'import2'); setWarnings([]) }}
                className={mode === 'import2' ? btnActive : btnNormal}>
                <IconImport /><span>Import</span>
              </button>
              <button type="button" onClick={() => handleExport('team2')} className={btnNormal}>
                <IconExport /><span>Export</span>
              </button>
              <button type="button" onClick={() => handleReset('team2')} className={btnReset}>
                <IconReset /><span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── MOBILE ── */}
        <div className="sm:hidden space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Team 1</span>
              <div className="flex gap-1">
                <button type="button"
                  onClick={() => { setMode(mode === 'import1' ? null : 'import1'); setWarnings([]) }}
                  className={`${mode === 'import1' ? 'text-teal-300 border-teal-600 bg-teal-900/40' : 'text-gray-400 border-gray-600 bg-gray-700/40'} text-[10px] px-3 py-2.5 rounded border`}>
                  <IconImport />
                </button>
                <button type="button" onClick={() => handleExport('team1')}
                  className="text-[10px] px-3 py-2.5 rounded border text-gray-400 border-gray-600 bg-gray-700/40">
                  <IconExport />
                </button>
                <button type="button" onClick={() => handleReset('team1')}
                  className="text-[10px] px-3 py-2.5 rounded border text-red-400 border-red-900/40 bg-red-950/20">
                  <IconReset />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {MODS.map(m => (
                <ModBtn key={m.mod} label={m.label}
                  active={modVals[m.mod].t1} activeClass={m.active}
                  onClick={() => toggleModifier(m.mod, 't1')} />
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-700/60" />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Team 2</span>
              <div className="flex gap-1">
                <button type="button"
                  onClick={() => { setMode(mode === 'import2' ? null : 'import2'); setWarnings([]) }}
                  className={`${mode === 'import2' ? 'text-teal-300 border-teal-600 bg-teal-900/40' : 'text-gray-400 border-gray-600 bg-gray-700/40'} text-[10px] px-3 py-2.5 rounded border`}>
                  <IconImport />
                </button>
                <button type="button" onClick={() => handleExport('team2')}
                  className="text-[10px] px-3 py-2.5 rounded border text-gray-400 border-gray-600 bg-gray-700/40">
                  <IconExport />
                </button>
                <button type="button" onClick={() => handleReset('team2')}
                  className="text-[10px] px-3 py-2.5 rounded border text-red-400 border-red-900/40 bg-red-950/20">
                  <IconReset />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {MODS.map(m => (
                <ModBtn key={m.mod} label={m.label}
                  active={modVals[m.mod].t2} activeClass={m.active}
                  onClick={() => toggleModifier(m.mod, 't2')} />
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-700/60" />

          <div className="flex items-center justify-between gap-2">
            <ModBtn label="KO only" active={showKoOnly}
              activeClass="bg-red-500 text-white" onClick={toggleShowKoOnly} />
            <div className="flex items-center gap-2">
              {feedback && <span className="text-xs text-green-400">{feedback}</span>}
              <button type="button" onClick={handleShare}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border bg-gray-700/60 text-gray-300 border-gray-600/40">
                <IconShare /><span>Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pannello import espandibile */}
      {(mode === 'import1' || mode === 'import2') && (
        <div className="mt-2 p-3 bg-gray-900 rounded-xl border border-gray-700/40">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">
              Import {mode === 'import1' ? 'Team 1' : 'Team 2'}
            </span>
            <button onClick={() => setMode(null)} className="text-xs text-gray-600 hover:text-gray-300">✕</button>
          </div>
          <textarea
            autoFocus
            className="w-full h-52 bg-gray-800 text-gray-200 text-xs font-mono p-2 rounded border border-gray-700 resize-y outline-none focus:border-teal-500"
            placeholder="Paste the full Showdown team here (up to 6 Pokémon, separated by blank lines)..."
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
          <div className="flex gap-2 mt-2 items-center flex-wrap">
            <button
              onClick={() => handleImport(mode === 'import1' ? 'team1' : 'team2')}
              className="text-xs px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white"
            >
              ✔ Import
            </button>
            <button
              onClick={() => setMode(null)}
              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
            >
              Cancel
            </button>
            {warnings.map((w, i) => (
              <span key={i} className="text-xs text-yellow-400">⚠ {w}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}