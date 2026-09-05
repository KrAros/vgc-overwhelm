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
 *
 * ─── PERCHÉ C'È SCRITTO «PS», DOPO CHE AVEVO DECISO DI NO ──────────────────
 *
 * Avevo tolto l'etichetta ragionando che il «/ 175» dicesse già di che numero
 * si tratta. Guardato nell'app, non lo dice: dice che è una frazione di
 * qualcosa. Chi apre l'editor per la prima volta vede una barra colorata con
 * due numeri e deve indovinare. Simone: «l'utente deve sapere cosa è quella
 * barra».
 *
 * L'etichetta costa ~28 px alla larghezza del cursore, ed è il prezzo giusto.
 *
 * Attenzione al nome della chiave: `ui.psShort` esiste già e in inglese vale
 * «PS» — ma è la sigla di **Power Spot** nella barra dei modificatori. In
 * italiano quella dice «FE», quindi le due non si incontrano mai sullo
 * schermo; il rischio è nel codice, e per questo la chiave qui si chiama
 * `siglaPuntiSalute` e non `ps` qualcosa.
 *
 * ─── L'ALTEZZA ─────────────────────────────────────────────────────────────
 *
 * Misurata nell'app build, non dedotta: il menù dello stato era 25 px, questa
 * riga 20, e i due bordi superiori differivano di 1,5 px — la barra stava
 * alta e corta accanto a una tendina più grossa.
 *
 * La correzione non è un numero scritto qui: è `h-full` sui tre controlli. Il
 * contenitore è una metà di una riga `flex`, che di suo si stira all'altezza
 * della riga, e la riga la decide il menù. Così i due restano uguali anche se
 * un domani il menù cambia padding — un `h-[25px]` scritto qui sarebbe una
 * copia da tenere allineata a mano, che è il difetto che questo progetto
 * paga già altrove.
 *
 * Su telefono la riga è `flex-col` e i due si impilano: lì `h-full` non ha
 * un'altezza definita da cui prendere e vale `auto`, cioè il comportamento di
 * prima. Il `min-h-[1.5rem]` è il pavimento per quel caso.
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
    <div className="flex items-center gap-2 w-full h-full min-h-[1.5rem]">
      <span className="text-xs text-gray-400 shrink-0 font-medium">{t('ui.siglaPuntiSalute')}</span>
      <input
        type="number" min="1" max={psMax} value={valore}
        aria-label={t('aria.ps_value')}
        onChange={e => onChange(Math.min(psMax, Math.max(1, parseInt(e.target.value) || 1)))}
        className="w-11 h-full shrink-0 bg-gray-700 text-white text-xs rounded px-1 py-0.5 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-xs text-gray-400 shrink-0">/ {psMax}</span>

      {/* Il fondo e' `bg-gray-700`, lo stesso della casella e della tendina.
          Al primo giro era `bg-gray-900`: guardato nell'app, la parte VUOTA
          della barra spariva nel fondo del pannello, e la barra sembrava
          finire dove finiva il verde — cioe' non si vedeva piu' quanto
          mancasse al massimo, che e' meta' dell'informazione. */}
      <div className="relative flex-1 min-w-0 h-full">
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
