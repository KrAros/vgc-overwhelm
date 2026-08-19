// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { calcStat } from '../../lib/stats.js'
import { applyBoost, STAT_NAMES, MAX_SP_PER_STAT } from '../../lib/rules.js'
import { NATURE_MODIFIERS } from '../../data/natures.js'

// ─── StatRow ─────────────────────────────────────────────────────────────────

export default function StatRow({ statIdx, base, sp, level, nature, boostVal, onSpChange, onBoostChange, speedWeatherActive, tailwindActive = false }) {
  const finalStat = calcStat(base, sp, level, nature, statIdx)

  // Abilità meteo-velocità: raddoppiano la Spe sotto il meteo corrispondente
  const speedMult = statIdx === 5 ? (speedWeatherActive ? 2 : 1) * (tailwindActive ? 2 : 1) : 1
  const speedBase = speedMult > 1 ? finalStat * speedMult : null
  const effectiveStat = speedBase ?? finalStat

  const boostedStat = boostVal !== 0
    ? applyBoost(effectiveStat, boostVal)
    : speedBase  // se nessun boost ma abilità meteo attiva, mostra il valore ×2

  const mod = nature && NATURE_MODIFIERS[nature]
  const isBoost = mod && mod[0] !== 0 && mod[0] === statIdx
  const isDrop  = mod && mod[0] !== 0 && mod[1] === statIdx

  const statColor  = isBoost ? 'text-red-400' : isDrop ? 'text-blue-400' : 'text-gray-200'
  const boostColor = boostVal > 0 ? 'text-green-400' : boostVal < 0 ? 'text-red-400' : 'text-gray-500'
  const hasBoost = statIdx !== 0

  return (
    /* `flex-wrap` solo sotto `sm`: su telefono il gruppo dello stadio va a capo
       (vedi in fondo). Sopra i 640 px `sm:flex-nowrap` tiene tutto in riga,
       come è sempre stato — il desktop non cambia di un pixel. */
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mb-1">
      <span className="text-xs text-gray-500 w-8 text-center">{STAT_NAMES[statIdx]}</span>
      <span className="text-xs text-gray-400 w-7 text-center">{base}</span>
      {/* `min-w-0` non è cosmesi: senza, la riga sborda di 62 px a 360 px.
          Un elemento flex non scende sotto la propria dimensione minima di
          contenuto, e un input[type=range] in Chrome ne ha una intrinseca di
          circa 129 px. Con i sei figli a larghezza fissa (216 px) più gli
          spazi (56 px) si arriva a 401, e la PAGINA INTERA scorre lateralmente
          — non solo questa riga. `flex-1` da solo non basta mai in questo caso. */}
      <input
        type="range" min="0" max={MAX_SP_PER_STAT} value={sp}
        onChange={e => onSpChange(parseInt(e.target.value))}
        className="flex-1 min-w-0 h-1 accent-teal-400"
      />
      {(isBoost || isDrop) && (
        <span className={`text-[10px] font-bold shrink-0 ml-1 ${isBoost ? 'text-red-400' : 'text-blue-400'}`}>
          {isBoost ? '▲ +10%' : '▼ -10%'}
        </span>
      )}
      <input
        type="number" min="0" max={MAX_SP_PER_STAT} value={sp}
        onChange={e => onSpChange(Math.min(MAX_SP_PER_STAT, Math.max(0, parseInt(e.target.value) || 0)))}
        className="w-11 bg-gray-700 text-white text-xs rounded px-1 py-0.5 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className={`text-xs font-medium w-8 text-center ${statColor}`}>
        {finalStat}
      </span>
      {/* Lo stadio (-6…+6) e il valore che ne risulta.

          Su telefono vanno A CAPO: `w-full` dentro un contenitore `flex-wrap`
          non entra accanto agli altri e passa alla riga sotto. Da `sm` in su
          `sm:w-auto` li rimette in linea, e il desktop resta identico.

          Perché: a 360 px la riga ha 310 px utili e i sei figli a larghezza
          fissa ne mangiano 272, lasciando 46 px al cursore per un intervallo
          di 253 valori. Mandando a capo questi due si liberano 96 px e il
          cursore arriva a ~142. `min-w-0` sul cursore serve comunque, ma da
          solo trasformava uno sbordamento in un cursore inutilizzabile —
          cioè metteva a posto la misura peggiorando l'uso. */}
      {hasBoost ? (
        <div className="w-full sm:w-auto flex items-center justify-end gap-2">
          <select
            value={boostVal}
            onChange={e => onBoostChange(parseInt(e.target.value))}
            className={`w-12 bg-gray-700 text-xs rounded px-0.5 py-0.5 outline-none text-center ${boostColor}`}
          >
            {[-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6].map(v => (
              <option key={v} value={v}>{v > 0 ? `+${v}` : v}</option>
            ))}
          </select>
          <span className={`text-xs w-8 text-center ${boostedStat ? (speedBase || boostVal > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-600'}`}>
            {boostedStat ?? '—'}
          </span>
        </div>
      ) : (
        /* Segnaposto: servono solo ad allineare le colonne sul desktop, quindi
           su telefono non devono esistere — altrimenti occuperebbero una riga
           vuota tutta loro. */
        <div className="hidden sm:flex items-center gap-2" aria-hidden="true">
          <div className="w-12" />
          <div className="w-8" />
        </div>
      )}
    </div>
  )
}