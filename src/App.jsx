// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [reportSelection, setReportSelection] = useState(null)
  const reportRef = useRef(null)
  // Un ?share= illeggibile prima falliva in silenzio: due team vuoti e nessuna
  // spiegazione. Ora lo store lo segnala e qui lo diciamo.
  const shareError      = useCalcStore(s => s.shareError)
  const clearShareError = useCalcStore(s => s.clearShareError)
  const setTeam1Focus = useCalcStore(s => s.setTeam1Focus)
  const setTeam2Focus = useCalcStore(s => s.setTeam2Focus)

  // In useCallback perché `DamageTable` la usa dentro il proprio useCallback:
  // se cambiasse identità a ogni render di App — e App rirende a ogni
  // selezione — `handleSelect` cambierebbe con lei e il `memo` sulle celle
  // non salterebbe un solo render.
  const handleCellSelect = useCallback((sel) => {
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
  }, [setTeam1Focus, setTeam2Focus])

  return (
    <div className="min-h-screen text-white flex flex-col">
      {/* Skip link. Tre difetti corretti in P, tutti nello stesso punto:

          1. puntava a #main-content, e NESSUN elemento aveva quell'id — il
             link non portava da nessuna parte. È il difetto vero, ed è quello
             che `analisi-critica.md` §4.5 non aveva visto: descriveva il
             problema come cosmetico perché il file era stato letto, non usato.
          2. lo stato di focus era gestito con Object.assign sullo stile inline
             in onFocus/onBlur — cioè React che riscrive il DOM a mano per fare
             quello che una pseudo-classe CSS fa da sola.
          3. il testo era hardcoded in inglese in un'app bilingue.

          `sr-only` nasconde il link agli occhi lasciandolo agli screen reader;
          `focus:not-sr-only` lo rende visibile quando ci si arriva col Tab. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-9999
                   focus:rounded-md focus:bg-teal-500 focus:px-3 focus:py-1.5
                   focus:text-sm focus:font-semibold focus:text-gray-900"
      >
        {t('ui.skip_to_content')}
      </a>

      {/* ── Navbar header ── */}
      <Header />

      {/* ── Contenuto principale ── */}
      {/* id="main-content": il bersaglio dello skip link qui sopra. Prima di P
          non esisteva in tutto src/, quindi il link cadeva nel vuoto. */}
      <main id="main-content" className="flex-1 px-3 py-3 sm:p-4">
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
          {shareError && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-3 rounded-lg border border-amber-600/50 bg-amber-900/25 px-3 py-2 text-xs text-amber-200"
            >
              <span className="flex-1">{t('ui.share_error')}</span>
              <button
                type="button"
                onClick={clearShareError}
                className="shrink-0 rounded border border-amber-600/50 px-2 py-1 font-medium hover:bg-amber-800/40"
              >
                {t('ui.dismiss')}
              </button>
            </div>
          )}

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