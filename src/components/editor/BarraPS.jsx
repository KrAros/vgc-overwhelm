// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/components/editor/BarraPS.jsx
 *
 * I punti salute correnti del Pokémon: quanti ne restano, adesso.
 *
 * ─── COSA C'ERA PRIMA, E PERCHÉ NON BASTAVA ────────────────────────────────
 *
 * Niente. Il fatto «questo Pokémon non è a vita piena» si diceva con due
 * levette che ne descrivevano due pezzi: «Multiscale attivo» (vita piena) e
 * l'interruttore dell'abilità per le cinque a vita bassa (sotto un terzo).
 * Erano due affermazioni separate sullo stesso Pokémon e potevano
 * contraddirsi — si poteva dire insieme «è a vita piena» e «è sotto un
 * terzo». E non rispondevano alla domanda per cui il numero serve davvero:
 * quanto fa Eruption con questo Charizard a metà?
 *
 * Adesso c'è un numero, e le due levette sono sparite: il loro riquadro
 * legge questo (vedi `AbilityFlags.jsx`).
 *
 * ─── PERCHÉ UN `range` NASCOSTO SOPRA UNA BARRA DISEGNATA ──────────────────
 *
 * Il controllo vero è un `input[type=range]`: tastiera, screen reader e
 * trascinamento li porta già lui, e riscriverli con un `div` e `onPointerMove`
 * vuol dire riscriverli peggio. Sopra ci sta una barra disegnata, perché un
 * `range` nativo non si può riempire di colore fino al cursore in modo
 * portabile — è la stessa ragione per cui il gioco la disegna e non usa un
 * cursore.
 *
 * ─── PERCHÉ IL NUMERO SI PUÒ ANCHE SCRIVERE ────────────────────────────────
 *
 * Trascinare va bene per «più o meno a metà», e non va bene per «gli restano
 * 42». La casella accanto serve al secondo caso, ed è la stessa coppia
 * cursore + casella che le righe delle statistiche hanno già.
 */

import { useTranslation } from 'react-i18next'
import { colorePS } from '../../lib/psSlot.js'

export default function BarraPS({ ps, psMax, onChange }) {
  const { t } = useTranslation()
  if (!psMax) return null

  const valore = Math.min(psMax, Math.max(1, ps))
  const pct = Math.round((valore / psMax) * 100)
  const colore = colorePS(valore, psMax)

  return (
    <div className="flex items-center gap-2 w-full">
      {/* La casella e il massimo. Niente etichetta «PS»: il «/ 175» dice già
          di che numero si tratta, e l'etichetta ruberebbe la larghezza che
          serve alla barra. */}
      <input
        type="number" min="1" max={psMax} value={valore}
        aria-label={t('aria.ps_value')}
        onChange={e => onChange(Math.min(psMax, Math.max(1, parseInt(e.target.value) || 1)))}
        className="w-11 shrink-0 bg-gray-700 text-white text-xs rounded px-1 py-0.5 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-xs text-gray-400 shrink-0">/ {psMax}</span>

      {/* `h-5` e non `h-4`: «cicciotta», ha chiesto Simone, ed e' anche
          l'altezza della casella accanto — due controlli della stessa riga che
          finiscono a filo invece che uno dentro l'altro.

          Il fondo e' `bg-gray-700`, lo stesso della casella e della tendina.
          Al primo giro era `bg-gray-900`: guardato nell'app, la parte VUOTA
          della barra spariva nel fondo del pannello, e la barra sembrava
          finire dove finiva il verde — cioe' non si vedeva piu' quanto
          mancasse al massimo, che e' meta' dell'informazione. */}
      <div className="relative flex-1 min-w-0 h-5">
        <div className="absolute inset-0 rounded-full bg-gray-700 overflow-hidden">
          <div
            className="h-full transition-[width] duration-100"
            style={{ width: `${pct}%`, backgroundColor: colore }}
          />
        </div>
        {/* Il cursore vero, trasparente sopra la barra disegnata. `opacity-0`
            e non `sr-only`: deve restare cliccabile e trascinabile dove la
            barra si vede, non finire fuori schermo. */}
        <input
          type="range" min="1" max={psMax} value={valore}
          aria-label={t('aria.ps_slider')}
          onChange={e => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* La percentuale solo quando serve: a vita piena non aggiunge niente
          al «175 / 175» che sta due centimetri più in là. */}
      {pct < 100 && (
        <span className="text-xs font-medium w-9 text-right shrink-0" style={{ color: colore }}>
          {pct}%
        </span>
      )}
    </div>
  )
}
