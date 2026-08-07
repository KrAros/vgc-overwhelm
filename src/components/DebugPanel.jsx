// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/components/DebugPanel.jsx
 *
 * Pannello di debug, visibile solo con ?debug=yes nell'URL.
 *
 * Sostituisce il blocco DOM che stava dentro calcEngine.js. Stessi colori,
 * stessa posizione, stesso contenuto — ma disegnato da React, che fa
 * l'escaping delle stringhe da solo (niente più innerHTML, niente più XSS).
 *
 * Mostra la cella selezionata. Dalla sessione C è `MoveCard` a rieseguire il
 * calcolo della mossa attiva con `debug: true` subito dopo averla disegnata,
 * quindi il log pubblicato è quello che l'utente sta effettivamente guardando
 * — e cambia quando cambia il tab della mossa.
 *
 * Finché non si clicca una cella il pannello resta in attesa: la tabella non
 * chiede mai il debug al motore, perché costruire le 15 stringhe del log per
 * ognuno dei ~576 calcoli di un render sarebbe puro spreco.
 *
 * ─── PERCHÉ STILI INLINE E NON TAILWIND ────────────────────────────────────
 * Tailwind scansiona i sorgenti e mette in bundle ogni classe che trova, anche
 * se il componente viene caricato solo in debug. Con le classi arbitrarie di
 * questo pannello il CSS cresceva di ~1 KB per tutti gli utenti. Gli stili
 * inline vivono nel chunk lazy e non pesano su chi non usa il debug.
 */

import { useSyncExternalStore } from 'react'
import { subscribeDebugLog, getDebugLog, getServerDebugLog } from '../lib/debugBus'

const stile = {
  contenitore: {
    position: 'fixed', bottom: '20px', right: '20px',
    background: '#1e1e2e', color: '#cdd6f4',
    borderRadius: '12px', padding: '16px',
    fontFamily: 'monospace', maxWidth: '420px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 9999, maxHeight: '75vh',
    overflowY: 'auto', border: '1px solid #313244',
  },
  titolo: {
    fontWeight: 'bold', borderBottom: '1px solid #313244',
    paddingBottom: '6px', marginBottom: '8px',
    color: '#f5e0dc', fontSize: '13px',
  },
  riga: {
    fontSize: '11px', marginBottom: '4px', color: '#a6adc8',
    borderBottom: '1px dashed #252538', paddingBottom: '2px',
  },
  risultato: {
    marginTop: '10px', background: '#252538', padding: '8px',
    borderRadius: '6px', borderLeft: '3px solid #fab387', fontSize: '11px',
  },
  rolls: {
    fontSize: '10px', color: '#b4befe', marginTop: '5px', wordBreak: 'break-all',
  },
}

export default function DebugPanel() {
  const log = useSyncExternalStore(subscribeDebugLog, getDebugLog, getServerDebugLog)

  if (!log || log.length === 0) {
    return (
      <div style={stile.contenitore}>
        <div style={stile.riga}>Debug attivo — in attesa del primo calcolo.</div>
      </div>
    )
  }

  // Struttura del log costruita da calcEngine:
  // [intestazione, ...dettagli, minMax, rolls]
  const intestazione = log[0]
  const rolls = log[log.length - 1]
  const minMax = log[log.length - 2]
  const dettagli = log.slice(1, -2)

  return (
    <div style={stile.contenitore}>
      <div style={stile.titolo}>{intestazione}</div>

      <div>
        {dettagli.map((riga, i) => (
          <div key={i} style={stile.riga}>{riga}</div>
        ))}
      </div>

      <div style={stile.risultato}>
        <strong>{minMax}</strong>
        <div style={stile.rolls}>{rolls}</div>
      </div>
    </div>
  )
}