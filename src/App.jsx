import { useState } from 'react'
import TopBar from './components/TopBar'
import DamageTable from './components/DamageTable'
import TeamEditor from './components/TeamEditor'
import ReportPanel from './components/ReportPanel'
import DebugPanel from './components/DebugPanel'

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