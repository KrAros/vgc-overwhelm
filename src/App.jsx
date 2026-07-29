import { useState, useRef } from 'react'
import useCalcStore from './store/useCalcStore'
import TopBar from './components/TopBar'
import DamageTable from './components/DamageTable'
import TeamEditor from './components/TeamEditor'
import ReportPanel from './components/ReportPanel'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import Footer from './components/Footer'
import ControlBar from './components/ControlBar'
import DebugPanel from './components/DebugPanel'
import { IS_DEBUG } from './lib/debugBus'



// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [reportSelection, setReportSelection] = useState(null)
  const reportRef = useRef(null)
  const setTeam1Focus = useCalcStore(s => s.setTeam1Focus)
  const setTeam2Focus = useCalcStore(s => s.setTeam2Focus)

  const handleCellSelect = (sel) => {
    setReportSelection(sel || null)
    if (sel) {
      // Seleziona in background i tab del TeamEditor per attaccante e difensore
      // sel è un array — prendi il primo elemento
      const first = Array.isArray(sel) ? sel[0] : sel
      if (first) {
        const t1idx = first.atkTeam === 'team1' ? first.atkIndex : first.defIndex
        const t2idx = first.atkTeam === 'team2' ? first.atkIndex : first.defIndex
        setTeam1Focus(t1idx)
        setTeam2Focus(t2idx)
      }
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    } else {
      // Deselezione: il report si smonta e il contenuto sale — riporta la tabella in vista
      setTimeout(() => {
        document.getElementById('damage-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <a href="#main-content"
        style={{ position:'absolute', width:'1px', height:'1px', padding:0, margin:'-1px', overflow:'hidden', clip:'rect(0,0,0,0)', whiteSpace:'nowrap', border:0 }}
        onFocus={e => Object.assign(e.target.style, { position:'fixed', top:'8px', left:'8px', width:'auto', height:'auto', padding:'6px 12px', margin:0, overflow:'visible', clip:'auto', whiteSpace:'normal', background:'#14b8a6', color:'#111', borderRadius:'6px', fontSize:'14px', fontWeight:600, zIndex:9999 })}
        onBlur={e => Object.assign(e.target.style, { position:'absolute', width:'1px', height:'1px', padding:0, margin:'-1px', overflow:'hidden', clip:'rect(0,0,0,0)', whiteSpace:'nowrap' })}
      >
        Skip to main content
      </a>

      {/* ── Navbar header ── */}
      <Header />

      {/* ── Contenuto principale ── */}
      <main className="flex-1 px-3 py-3 sm:p-4">
        <div className="max-w-7xl mx-auto">

          {/* ReportPanel */}
          <div ref={reportRef}>
            <ErrorBoundary>
              {reportSelection && (
                <ReportPanel
                  selection={reportSelection}
                  onClose={() => setReportSelection(null)}
                />
              )}
            </ErrorBoundary>
          </div>

          {/* TopBar */}
          <TopBar />

          {/* DamageTable */}
          <ErrorBoundary>
            <DamageTable onCellSelect={handleCellSelect} />
          </ErrorBoundary>

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

      {/* Pannello di debug: solo con ?debug=yes nell'URL */}
      {IS_DEBUG && <DebugPanel />}

    </div>
  )
}

export default App