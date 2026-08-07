// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { useState, useEffect } from 'react'
import useCalcStore from '../../store/useCalcStore'
import { spriteUrl, fallbackSpriteUrl } from '../../utils/sprite'
import PokemonPanel from './SlotEditor.jsx'

// ─── TeamEditor (root export) ─────────────────────────────────────────────────

export default function TeamEditor({ team }) {
  const [activeTab, setActiveTab] = useState(0)
  const teamData = useCalcStore(s => s[team])
  const editorFocus  = useCalcStore(s => s.editorFocus)
  const tailwind     = useCalcStore(s => s.tailwind)
  const team1Focus   = useCalcStore(s => s.team1Focus)
  const team2Focus   = useCalcStore(s => s.team2Focus)
  const directFocus  = team === 'team1' ? team1Focus : team2Focus

  // Focus da click sprite (editorFocus) — per team specifico
  const [lastFocusTs, setLastFocusTs] = useState(null)
  if (editorFocus && editorFocus.team === team && editorFocus.ts !== lastFocusTs) {
    setLastFocusTs(editorFocus.ts)
    setActiveTab(editorFocus.index)
  }
  // Focus da click cella (directFocus) — useEffect per evitare problemi di ordine
  // Focus da click cella — setTimeout evita cascading renders
  useEffect(() => {
    if (!directFocus) return
    const t = setTimeout(() => setActiveTab(directFocus.index), 0)
    return () => clearTimeout(t)
  }, [directFocus])

  return (
    <div id={`team-editor-${team}`} className="bg-gray-900 rounded-xl border border-gray-700/40">
      <div className="flex border-b border-gray-700">
        {teamData.map((p, i) => {
          const sprite = p?.key ? spriteUrl(p.key) : null
          return (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className="flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors border-b-2"
              style={{
                borderColor: activeTab === i ? '#2dd4bf' : 'transparent',
                color: activeTab === i ? '#2dd4bf' : '#6b7280'
              }}
            >
              {sprite ? (
                <img
                  src={sprite}
                  alt={p.key}
                  className="w-8 h-8 object-contain"
                  onError={e => {
                    const fb = fallbackSpriteUrl(p.key)
                    if (fb && e.target.src !== fb) { e.target.src = fb } else { e.target.style.display = 'none' }
                  }}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-600 text-xs">
                  {i+1}
                </div>
              )}
              <span className="capitalize truncate w-full text-center" style={{fontSize:'9px'}}>
                {p?.key ? p.key.split('-')[0] : `P${i+1}`}
              </span>
            </button>
          )
        })}
      </div>
      <PokemonPanel team={team} index={activeTab} tailwindActive={team === 'team1' ? tailwind.t1 : tailwind.t2} />
    </div>
  )
}