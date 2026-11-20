// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDesktop } from '../hooks/useDesktop'
import { SOGLIA_DESKTOP, ruoloPannello, eTastoChiusura, prossimoIndiceFocus } from '../lib/pannello'

const FOCALIZZABILI =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Guscio visivo e di accessibilità. Desktop: colonna fissa a destra, non
 * modale. Mobile: sheet a tutto schermo, modale, con trappola del Tab e
 * scroll del body bloccato. Animazione solo transform/opacity; il blocco
 * `prefers-reduced-motion` globale di index.css la azzera.
 */
export function GuscioPannello({ modale, etichetta, chiudiAria, chiudiTesto, onClose, children }) {
  const rootRef = useRef(null)
  const chiudiRef = useRef(null)
  const origineRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  const { role } = ruoloPannello(modale ? 0 : SOGLIA_DESKTOP)

  // All'apertura: ricorda dov'era il focus (la cella) e portalo al pannello;
  // alla chiusura rimettilo lì. Su desktop continua a seguire l'ultima cella
  // cliccata, così «chiudi» riporta alla cella che si stava guardando.
  useEffect(() => {
    if (!origineRef.current) origineRef.current = document.activeElement
    chiudiRef.current?.focus()
    const seguiFocus = (e) => {
      if (!rootRef.current?.contains(e.target)) origineRef.current = e.target
    }
    document.addEventListener('focusin', seguiFocus)
    return () => {
      document.removeEventListener('focusin', seguiFocus)
      const el = origineRef.current
      if (el && el.isConnected && typeof el.focus === 'function') el.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (eTastoChiusura(e)) { e.preventDefault(); onCloseRef.current?.(); return }
      if (modale && e.key === 'Tab' && rootRef.current) {
        const els = [...rootRef.current.querySelectorAll(FOCALIZZABILI)]
        const i = prossimoIndiceFocus(els.indexOf(document.activeElement), els.length, e.shiftKey)
        if (i >= 0) { e.preventDefault(); els[i].focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modale])

  useEffect(() => {
    if (!modale) return undefined
    const prima = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prima }
  }, [modale])

  return (
    <aside
      ref={rootRef}
      role={role}
      aria-modal={modale ? 'true' : undefined}
      aria-label={etichetta}
      className={`pannello-entra fixed z-40 flex flex-col bg-gray-950 border-gray-700 ${
        modale
          ? 'inset-0 border-0'
          : 'top-0 right-0 bottom-0 w-[min(480px,40vw)] border-l'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-700 px-4 py-2">
        <h2 tabIndex={-1} className="text-sm font-semibold text-white">{etichetta}</h2>
        <button
          ref={chiudiRef}
          type="button"
          onClick={onClose}
          aria-label={chiudiAria}
          className="rounded border border-gray-600 px-3 py-1 text-xs text-gray-200 hover:border-gray-400 hover:text-white"
        >
          {chiudiTesto}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{children}</div>
    </aside>
  )
}

export default function PannelloLaterale({ onClose, children }) {
  const { t } = useTranslation()
  const desktop = useDesktop()
  return (
    <GuscioPannello
      modale={!desktop}
      etichetta={t('report.pannello_titolo')}
      chiudiAria={t('report.close_aria')}
      chiudiTesto={t('ui.close')}
      onClose={onClose}
    >
      {children}
    </GuscioPannello>
  )
}
