// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { useTranslation } from 'react-i18next'
import { calcStat } from '../../lib/stats.js'
import { applyBoost, STAT_NAMES, MAX_SP_PER_STAT } from '../../lib/rules.js'
import { NATURE_MODIFIERS } from '../../data/natures.js'

// ─── StatRow ─────────────────────────────────────────────────────────────────

export default function StatRow({ statIdx, base, sp, level, nature, boostVal, onSpChange, onBoostChange, speedWeatherActive, tailwindActive = false }) {
  const { t } = useTranslation()
  const finalStat = calcStat(base, sp, level, nature, statIdx)

  /* I tre controlli di questa riga avevano ZERO nome accessibile, e con sei
     statistiche per due squadre fanno trentasei nodi su cinquanta. Il nome
     porta dentro la sigla della statistica, altrimenti uno screen reader legge
     dodici cursori identici. La sigla resta in inglese: è una decisione
     dichiarata del progetto. */
  const nome = (chiave) => t(`aria.${chiave}`, { stat: STAT_NAMES[statIdx] })

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
  const boostColor = boostVal > 0 ? 'text-green-400' : boostVal < 0 ? 'text-red-400' : 'text-gray-400'
  const hasBoost = statIdx !== 0

  return (
    /* Tutto su UNA riga, anche su telefono.

       In P-2/2 avevo mandato a capo lo stadio per dare al cursore 142 px invece
       di 46. Simone ha guardato il risultato sul telefono e la scelta era
       sbagliata: lo stadio finiva sotto, allineato a destra, e non si capiva
       più a quale statistica appartenesse. Un controllo largo di cui non sai
       cosa comanda vale meno di un controllo stretto che si capisce.

       Lo spazio si recupera da `gap-1` invece di `gap-2` — sei spazi, 24 px —
       e dal badge della natura, che su telefono mostra solo la freccia. Il
       desktop resta identico: `sm:gap-2` e il testo completo. */
    <div className="flex items-center gap-1 sm:gap-2 mb-1">
      <span className="text-xs text-gray-400 w-8 text-center">{STAT_NAMES[statIdx]}</span>
      <span className="text-xs text-gray-400 w-7 text-center">{base}</span>
      {/* `min-w-0` non è cosmesi: senza, la riga sborda di 62 px a 360 px.
          Un elemento flex non scende sotto la propria dimensione minima di
          contenuto, e un input[type=range] in Chrome ne ha una intrinseca di
          circa 129 px. Con i sei figli a larghezza fissa (216 px) più gli
          spazi (56 px) si arriva a 401, e la PAGINA INTERA scorre lateralmente
          — non solo questa riga. `flex-1` da solo non basta mai in questo caso. */}
      <input
        type="range" min="0" max={MAX_SP_PER_STAT} value={sp}
        aria-label={nome('sp_slider')}
        onChange={e => onSpChange(parseInt(e.target.value))}
        className="flex-1 min-w-0 h-1 accent-teal-400"
      />
      {(isBoost || isDrop) && (
        /* Su telefono solo la freccia: «+10%» e «-10%» sono gli unici due
           valori possibili, quindi la freccia da sola dice già tutto e libera
           una quarantina di pixel per il cursore. Il desktop mostra il testo
           intero. */
        <span className={`text-[10px] font-bold shrink-0 sm:ml-1 ${isBoost ? 'text-red-400' : 'text-blue-400'}`}>
          {isBoost ? '▲' : '▼'}<span className="hidden sm:inline">{isBoost ? ' +10%' : ' -10%'}</span>
        </span>
      )}
      <input
        type="number" min="0" max={MAX_SP_PER_STAT} value={sp}
        aria-label={nome('sp_value')}
        onChange={e => onSpChange(Math.min(MAX_SP_PER_STAT, Math.max(0, parseInt(e.target.value) || 0)))}
        className="w-11 bg-gray-700 text-white text-xs rounded px-1 py-0.5 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className={`text-xs font-medium w-8 text-center ${statColor}`}>
        {finalStat}
      </span>
      {/* Lo stadio (-6…+6) e il valore che ne risulta, sulla STESSA riga della
          statistica a cui appartengono.

          In P-2/2 li avevo mandati a capo su telefono per allargare il cursore.
          Guardato sul telefono, non funzionava: finivano su una riga propria
          allineata a destra, e non si capiva più a quale statistica si
          riferissero. Un controllo largo di cui non sai cosa comanda vale meno
          di un controllo stretto che si capisce. Correzione rifatta. */}
      {hasBoost ? (
        <div className="flex items-center gap-1 sm:gap-2">
          <select
            value={boostVal}
            aria-label={nome('stage')}
            onChange={e => onBoostChange(parseInt(e.target.value))}
            className={`w-12 bg-gray-700 text-xs rounded px-0.5 py-0.5 outline-none text-center ${boostColor}`}
          >
            {[-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6].map(v => (
              <option key={v} value={v}>{v > 0 ? `+${v}` : v}</option>
            ))}
          </select>
          <span className={`text-xs w-8 text-center ${boostedStat ? (speedBase || boostVal > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}`}>
            {boostedStat ?? '—'}
          </span>
        </div>
      ) : (
        /* Segnaposto per la riga HP, che non ha stadio. Servono su ENTRAMBI i
           formati: ora che tutto sta su una riga sola, senza di questi il
           cursore degli HP sarebbe più lungo di quello delle altre statistiche
           e le colonne non si allineerebbero più — cioè si ricreerebbe, in
           altra forma, il problema di leggibilità appena corretto. */
        <div className="flex items-center gap-1 sm:gap-2" aria-hidden="true">
          <div className="w-12" />
          <div className="w-8" />
        </div>
      )}
    </div>
  )
}