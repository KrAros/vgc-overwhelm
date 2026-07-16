import { useState } from 'react'
import TopBar from './components/TopBar'
import DamageTable from './components/DamageTable'
import TeamEditor from './components/TeamEditor'
import ReportPanel from './components/ReportPanel'
import DebugPanel from './components/DebugPanel'
import useCalcStore, { encodeTeamsToURL } from './store/useCalcStore'
import { parseShowdownPaste, teamToShowdown } from './utils/showdownIO'

// ─── SVG icons (stessi usati in TeamEditor) ───────────────────────────────────

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

// ─── TeamGroup — gruppo bottoni per un singolo team ───────────────────────────
// Definito FUORI da TeamActionBar per rispettare le regole di React
// (componenti non possono essere creati durante il render di un altro componente)

function TeamGroup({ label, importMode, activeMode, onImportToggle, onExport, onReset }) {
  const isImportActive = activeMode === importMode

  const btnBase   = 'flex items-center justify-center gap-1 text-xs w-20 py-1 rounded border transition'
  const btnNormal = `${btnBase} bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40`
  const btnActive = `${btnBase} bg-teal-800 border-teal-600 text-teal-200`
  const btnReset  = `${btnBase} bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border-red-900/30`

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-600 uppercase tracking-wider mr-0.5">{label}</span>
      <button
        type="button"
        onClick={onImportToggle}
        className={isImportActive ? btnActive : btnNormal}
        title={`Importa ${label} da Showdown`}
      >
        <IconImport />
        <span>Importa</span>
      </button>
      <button
        type="button"
        onClick={onExport}
        className={btnNormal}
        title={`Esporta ${label} in Showdown`}
      >
        <IconExport />
        <span>Esporta</span>
      </button>
      <button
        type="button"
        onClick={onReset}
        className={btnReset}
        title={`Azzera ${label}`}
      >
        <IconReset />
        <span>Azzera</span>
      </button>
    </div>
  )
}

// ─── TeamActionBar ────────────────────────────────────────────────────────────

function TeamActionBar() {
  const team1   = useCalcStore(s => s.team1)
  const team2   = useCalcStore(s => s.team2)
  const setTeam = useCalcStore(s => s.setTeam)

  const [mode, setMode]           = useState(null)  // null | 'import1' | 'import2'
  const [pasteText, setPasteText] = useState('')
  const [warnings, setWarnings]   = useState([])
  const [feedback, setFeedback]   = useState('')

  const flash = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 2500)
  }

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
    const base    = window.location.origin + window.location.pathname
    const url     = `${base}?share=${encoded}`
    navigator.clipboard.writeText(url).then(() => flash('Link copiato!'))
  }

  const btnShare = 'flex items-center justify-center gap-1 text-xs px-3 py-1 rounded border transition bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'

  return (
    <div className="mb-3">
      {/* Barra: Team 1 | Condividi | Team 2 */}
      <div className="flex items-center justify-between">
        <TeamGroup
          teamKey="team1"
          label="Team 1"
          importMode="import1"
          activeMode={mode}
          onImportToggle={() => { setMode(mode === 'import1' ? null : 'import1'); setWarnings([]) }}
          onExport={() => handleExport('team1')}
          onReset={() => handleReset('team1')}
        />

        <div className="flex items-center gap-2">
          {feedback && <span className="text-xs text-green-400">{feedback}</span>}
          <button type="button" onClick={handleShare} className={btnShare} title="Copia link condivisibile">
            <IconShare />
            <span>Condividi</span>
          </button>
        </div>

        <TeamGroup
          teamKey="team2"
          label="Team 2"
          importMode="import2"
          activeMode={mode}
          onImportToggle={() => { setMode(mode === 'import2' ? null : 'import2'); setWarnings([]) }}
          onExport={() => handleExport('team2')}
          onReset={() => handleReset('team2')}
        />
      </div>

      {/* Pannello import — appare sotto la barra */}
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
  const [showDebug, setShowDebug] = useState(false)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold text-center text-red-500 mb-6">
        VGC Damage Calculator
      </h1>
      <div className="max-w-7xl mx-auto">
        <TopBar />
        <ReportPanel
          selection={reportSelection}
          onClose={() => setReportSelection(null)}
        />
        <DamageTable onCellSelect={setReportSelection} />

        <TeamActionBar />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <TeamEditor team="team1" />
          <TeamEditor team="team2" />
        </div>

        <div className="mt-4">
          <button
            onClick={() => setShowDebug(v => !v)}
            className="text-xs text-gray-500 hover:text-yellow-400 transition-colors"
          >
            {showDebug ? '▲ Nascondi Debug Panel' : '▼ Mostra Debug Panel'}
          </button>
          {showDebug && <DebugPanel />}
        </div>
      </div>
    </div>
  )
}

export default App