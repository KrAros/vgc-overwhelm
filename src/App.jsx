import { useState } from 'react'
import TopBar from './components/TopBar'
import DamageTable from './components/DamageTable'
import TeamEditor from './components/TeamEditor'
import ReportPanel from './components/ReportPanel'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import Footer from './components/Footer'
import useCalcStore, { encodeTeamsToURL } from './store/useCalcStore'
import { parseShowdownPaste, teamToShowdown } from './utils/showdownIO'

// ─── SVG icons ────────────────────────────────────────────────────────────────

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

// ─── Modifier button ──────────────────────────────────────────────────────────

function ModBtn({ label, active, color, activeClass, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded border transition-colors ${
        active ? activeClass : color + ' bg-transparent hover:opacity-80'
      }`}
    >
      {label}
    </button>
  )
}

// ─── ControlBar ───────────────────────────────────────────────────────────────

function ControlBar() {
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
    flash(`Importati ${pokemon.length} Pokémon in ${targetTeam === 'team1' ? 'Team 1' : 'Team 2'}.`)
    if (w.length === 0) setMode(null)
  }

  function handleExport(targetTeam) {
    const team  = targetTeam === 'team1' ? team1 : team2
    const paste = teamToShowdown(team)
    if (!paste) return
    navigator.clipboard.writeText(paste).then(() =>
      flash(`${targetTeam === 'team1' ? 'Team 1' : 'Team 2'} copiato!`)
    )
  }

  function handleReset(targetTeam) {
    setTeam(targetTeam, Array(6).fill(null))
    flash(`${targetTeam === 'team1' ? 'Team 1' : 'Team 2'} azzerato.`)
  }

  function handleShare() {
    const encoded = encodeTeamsToURL(team1, team2)
    const url = window.location.origin + window.location.pathname + `?share=${encoded}`
    navigator.clipboard.writeText(url).then(() => flash('Link copiato!'))
  }

  const MODS = [
    { label: 'HH',    mod: 'helpingHand', color: 'text-green-400  border-green-400',  active: 'bg-green-400  text-gray-900', title: 'Helping Hand' },
    { label: 'Veil',  mod: 'auroraVeil',  color: 'text-blue-400   border-blue-400',   active: 'bg-blue-400   text-gray-900', title: 'Aurora Veil' },
    { label: 'LS',    mod: 'lightScreen', color: 'text-yellow-400 border-yellow-400', active: 'bg-yellow-400 text-gray-900', title: 'Light Screen' },
    { label: 'Ref',   mod: 'reflect',     color: 'text-pink-400   border-pink-400',   active: 'bg-pink-400   text-gray-900', title: 'Reflect' },
    { label: 'Crit',  mod: 'crit',        color: 'text-red-400    border-red-400',    active: 'bg-red-400    text-gray-900', title: 'Crit' },
  ]

  // Label estese per desktop
  const MODS_DESKTOP = [
    { label: 'Helping Hand', mod: 'helpingHand', color: 'text-green-400  border-green-400',  active: 'bg-green-400  text-gray-900' },
    { label: 'Aurora Veil',  mod: 'auroraVeil',  color: 'text-blue-400   border-blue-400',   active: 'bg-blue-400   text-gray-900' },
    { label: 'Light Screen', mod: 'lightScreen', color: 'text-yellow-400 border-yellow-400', active: 'bg-yellow-400 text-gray-900' },
    { label: 'Reflect',      mod: 'reflect',     color: 'text-pink-400   border-pink-400',   active: 'bg-pink-400   text-gray-900' },
    { label: 'Crit',         mod: 'crit',        color: 'text-red-400    border-red-400',    active: 'bg-red-400    text-gray-900' },
  ]

  const modVals = { helpingHand, auroraVeil, lightScreen, reflect, crit }

  const btnBase   = 'flex items-center justify-center gap-1 text-xs px-2.5 py-1 rounded border transition-colors'
  const btnNormal = `${btnBase} bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40`
  const btnActive = `${btnBase} bg-teal-800 border-teal-600 text-teal-200`
  const btnReset  = `${btnBase} bg-red-950/30 hover:bg-red-900/50 text-red-400 border-red-900/30`

  return (
    <div className="mb-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 px-3 py-3 space-y-2">

        {/* ── DESKTOP: layout simmetrico originale ── */}
        <div className="hidden sm:block space-y-2">
          {/* Riga 1 — modifier simmetrici */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium shrink-0">Team 1</span>
              <div className="flex items-center gap-1">
                {MODS_DESKTOP.map(m => (
                  <ModBtn key={m.mod} label={m.label}
                    active={modVals[m.mod].t1}
                    color={m.color} activeClass={m.active}
                    onClick={() => toggleModifier(m.mod, 't1')} />
                ))}
              </div>
            </div>

            <ModBtn
              label="Solo KO"
              active={showKoOnly}
              color="text-red-400 border-red-400"
              activeClass="bg-red-500 text-white"
              onClick={toggleShowKoOnly}
            />

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {MODS_DESKTOP.map(m => (
                  <ModBtn key={m.mod} label={m.label}
                    active={modVals[m.mod].t2}
                    color={m.color} activeClass={m.active}
                    onClick={() => toggleModifier(m.mod, 't2')} />
                ))}
              </div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium shrink-0">Team 2</span>
            </div>
          </div>

          <div className="h-px bg-gray-700/60" />

          {/* Riga 2 — azioni */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button"
                onClick={() => { setMode(mode === 'import1' ? null : 'import1'); setWarnings([]) }}
                className={mode === 'import1' ? btnActive : btnNormal}>
                <IconImport /><span>Importa</span>
              </button>
              <button type="button" onClick={() => handleExport('team1')} className={btnNormal}>
                <IconExport /><span>Esporta</span>
              </button>
              <button type="button" onClick={() => handleReset('team1')} className={btnReset}>
                <IconReset /><span>Azzera</span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {feedback && <span className="text-xs text-green-400">{feedback}</span>}
              <button type="button" onClick={handleShare} className={btnNormal}>
                <IconShare /><span>Condividi</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button type="button"
                onClick={() => { setMode(mode === 'import2' ? null : 'import2'); setWarnings([]) }}
                className={mode === 'import2' ? btnActive : btnNormal}>
                <IconImport /><span>Importa</span>
              </button>
              <button type="button" onClick={() => handleExport('team2')} className={btnNormal}>
                <IconExport /><span>Esporta</span>
              </button>
              <button type="button" onClick={() => handleReset('team2')} className={btnReset}>
                <IconReset /><span>Azzera</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── MOBILE: layout verticale compatto ── */}
        <div className="sm:hidden space-y-2.5">

          {/* Team 1 modifier */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Team 1</span>
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
                  active={modVals[m.mod].t1}
                  color={m.color} activeClass={m.active}
                  onClick={() => toggleModifier(m.mod, 't1')} />
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-700/60" />

          {/* Team 2 modifier */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Team 2</span>
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
                  active={modVals[m.mod].t2}
                  color={m.color} activeClass={m.active}
                  onClick={() => toggleModifier(m.mod, 't2')} />
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-700/60" />

          {/* Riga utility: KO filter + Share */}
          <div className="flex items-center justify-between gap-2">
            <ModBtn
              label="Solo KO"
              active={showKoOnly}
              color="text-red-400 border-red-400"
              activeClass="bg-red-500 text-white"
              onClick={toggleShowKoOnly}
            />
            <div className="flex items-center gap-2">
              {feedback && <span className="text-xs text-green-400">{feedback}</span>}
              <button type="button" onClick={handleShare}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border bg-gray-700/60 text-gray-300 border-gray-600/40">
                <IconShare /><span>Condividi</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Pannello import espandibile */}
      {(mode === 'import1' || mode === 'import2') && (
        <div className="mt-2 p-3 bg-gray-800 rounded border border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Import {mode === 'import1' ? 'Team 1' : 'Team 2'} — incolla la paste Showdown
            </span>
            <button onClick={() => setMode(null)} className="text-xs text-gray-600 hover:text-gray-300">✕</button>
          </div>
          <textarea
            autoFocus
            className="w-full h-52 bg-gray-900 text-gray-200 text-xs font-mono p-2 rounded border border-gray-700 resize-y outline-none focus:border-teal-500"
            placeholder="Incolla qui la paste Showdown completa (fino a 6 Pokémon, separati da righe vuote)..."
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
          <div className="flex gap-2 mt-2 items-center flex-wrap">
            <button
              onClick={() => handleImport(mode === 'import1' ? 'team1' : 'team2')}
              className="text-xs px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white"
            >
              ✔ Importa
            </button>
            <button
              onClick={() => setMode(null)}
              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
            >
              Annulla
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

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [reportSelection, setReportSelection] = useState(null)

  return (
    // Layout colonna intera: header fisso in alto, footer in basso
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">

      {/* ── Navbar header ── */}
      <Header />

      {/* ── Contenuto principale ── */}
      <main className="flex-1 px-3 py-3 sm:p-4">
        <div className="max-w-7xl mx-auto">

          {/* ReportPanel */}
          <ErrorBoundary>
            {reportSelection && (
              <ReportPanel
                selection={reportSelection}
                onClose={() => setReportSelection(null)}
              />
            )}
          </ErrorBoundary>

          {/* DamageTable */}
          <ErrorBoundary>
            <DamageTable onCellSelect={(sel) => setReportSelection(sel || null)} />
          </ErrorBoundary>

          {/* TopBar */}
          <TopBar />

          {/* ControlBar */}
          <ControlBar />

          {/* TeamEditor — 1 colonna su mobile, 2 su desktop */}
          <ErrorBoundary>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TeamEditor team="team1" />
              <TeamEditor team="team2" />
            </div>
          </ErrorBoundary>

        </div>
      </main>

      {/* ── Footer ── */}
      <Footer />

    </div>
  )
}

export default App