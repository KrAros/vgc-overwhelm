import { useState, useRef } from 'react'
import TopBar from './components/TopBar'
import DamageTable from './components/DamageTable'
import TeamEditor from './components/TeamEditor'
import ReportPanel from './components/ReportPanel'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import Footer from './components/Footer'
import ControlBar from './components/ControlBar'



// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [reportSelection, setReportSelection] = useState(null)
  const reportRef = useRef(null)

  const handleCellSelect = (sel) => {
    setReportSelection(sel || null)
    if (sel) {
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

    </div>
  )
}

export default App