// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * PresetSelect.jsx
 *
 * Dropdown preset meta + set custom, con modal unificato per gestione custom.
 *
 * ARCHITETTURA:
 * - <select> nativo con due gruppi:
 *     1. Meta preset (dall'archivio metaPresets.js)
 *     2. <optgroup "★ Custom"> con i set salvati dall'utente in localStorage
 * - Il valore delle <option> custom usa il prefisso "custom:" + id per
 *   distinguerle dai meta preset nell'onChange.
 * - Modal "Custom set" (aperto dal bottone in SlotEditor):
 *     - Sezione SALVA: anteprima Showdown dello slot corrente + input nome
 *     - Sezione LISTA: ogni set custom con nome e bottone Elimina
 * - I custom set sono tenuti in stato React (useState) e sincronizzati
 *   con localStorage via useMemo su [currentSlug, externalRev].
 *
 * CHIAVE localStorage: 'sixth_ember_custom_sets'
 * STRUTTURA: { [slug]: [ { id, label, nature, item, ability, sps, moves } ] }
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useCalcStore from '../../store/useCalcStore'
import { PRESETS_BY_SLUG } from '../../data/metaPresets'
import useStagione, { TUTTE } from '../../store/useStagione.js'
import pokemonData from '../../data/pokemon.json'

// ── Costante localStorage ──────────────────────────────────────────────────
const LS_CUSTOM_SETS = 'sixth_ember_custom_sets'

// ── Helpers localStorage ───────────────────────────────────────────────────

function loadCustomSets() {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_SETS)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveCustomSets(all) {
  try {
    localStorage.setItem(LS_CUSTOM_SETS, JSON.stringify(all))
  } catch { /* storage pieno */ }
}

// ── Helpers formato anteprima ──────────────────────────────────────────────

const STAT_SHOWDOWN = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']
const cap = s => s ? s.replace(/\b\w/g, c => c.toUpperCase()) : ''

function buildPreviewLines(slug, slot) {
  if (!slot) return []
  const displayName = pokemonData[slug]?.name || slug
  const lines = []
  const itemName = slot.item ? cap(slot.item) : null
  lines.push(itemName ? `${displayName} @ ${itemName}` : displayName)
  if (slot.ability) lines.push(`Ability: ${cap(slot.ability.replace(/-/g, ' '))}`)
  const sps = slot.sps || [0,0,0,0,0,0]
  const spParts = sps.map((v, i) => v > 0 ? `${v} ${STAT_SHOWDOWN[i]}` : null).filter(Boolean)
  if (spParts.length) lines.push(`SP: ${spParts.join(' / ')}`)
  if (slot.nature) lines.push(`${cap(slot.nature)} Nature`)
  ;(slot.moves || []).filter(Boolean).forEach(m => lines.push(`- ${cap(m)}`))
  return lines
}

// ── CustomSetModal ─────────────────────────────────────────────────────────
/**
 * Modal unificato per salvare e gestire i custom set di un Pokémon.
 *
 * Props:
 *   slug         — slug del Pokémon corrente
 *   currentSlot  — oggetto slot completo (per l'anteprima e il salvataggio)
 *   onClose      — callback chiusura
 *   onChanged    — callback chiamata dopo ogni salvataggio o eliminazione,
 *                  usata dal parent per ricaricare la lista
 */
export function CustomSetModal({ slug, currentSlot, onClose, onChanged }) {
  const { t } = useTranslation()

  // Stato salvataggio
  const [saveName, setSaveName]   = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveFeedback, setSaveFeedback] = useState(false)

  // Lista set corrente (locale al modal, ricaricata da localStorage)
  const [sets, setSets] = useState(() => {
    const all = loadCustomSets()
    return (slug && all[slug]) || []
  })

  // Conferma eliminazione: id del set in attesa
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const previewLines = buildPreviewLines(slug, currentSlot)

  function handleSave() {
    const trimmed = saveName.trim()
    if (!trimmed) { setSaveError(t('ui.custom_set_name_empty')); return }
    setSaveError('')
    const all = loadCustomSets()
    const entry = {
      id: Date.now().toString(),
      label: trimmed,
      nature:  currentSlot?.nature  ?? null,
      item:    currentSlot?.item    ?? null,
      ability: currentSlot?.ability ?? null,
      sps:     currentSlot?.sps     ?? [0,0,0,0,0,0],
      moves:   currentSlot?.moves   ?? [null,null,null,null],
    }
    all[slug] = [...(all[slug] || []), entry]
    saveCustomSets(all)
    const updated = all[slug]
    setSets(updated)
    setSaveName('')
    setSaveFeedback(true)
    setTimeout(() => setSaveFeedback(false), 1500)
    onChanged(updated)
  }

  function handleDelete(id) {
    if (deleteConfirm === id) {
      const all = loadCustomSets()
      all[slug] = (all[slug] || []).filter(s => s.id !== id)
      saveCustomSets(all)
      const updated = all[slug] || []
      setSets(updated)
      setDeleteConfirm(null)
      onChanged(updated)
    } else {
      setDeleteConfirm(id)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-3 max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-700/60 shrink-0">
          <span className="text-sm font-semibold text-gray-200">
            ⚙ {t('ui.custom_set_manage')}
            {slug && (
              <span className="ml-2 text-xs font-normal text-amber-400">
                {pokemonData[slug]?.name || slug}
              </span>
            )}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-lg leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">

          {/* ── SEZIONE SALVA ─────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-[0.15em] font-semibold">
              {t('ui.custom_set_save_current')}
            </p>

            {/* Anteprima slot corrente in formato Showdown */}
            {previewLines.length > 0 && (
              <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                {previewLines.map((line, i) => (
                  <p key={i} className={`text-[11px] font-mono leading-relaxed ${
                    i === 0 ? 'text-gray-200 font-semibold' : 'text-gray-400'
                  }`}>
                    {line}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                className="flex-1 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 outline-none focus:border-teal-500 placeholder-gray-500"
                placeholder={t('ui.custom_set_name')}
                value={saveName}
                onChange={e => { setSaveName(e.target.value); setSaveError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              />
              <button
                onClick={handleSave}
                className={`shrink-0 text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                  saveFeedback
                    ? 'bg-green-800 border-green-600 text-green-200'
                    : 'bg-teal-700 hover:bg-teal-600 border-teal-600 text-white'
                }`}
              >
                {saveFeedback ? '✓' : t('ui.team_library_save')}
              </button>
            </div>
            {saveError && <p className="text-xs text-red-400">{saveError}</p>}
          </div>

          {/* ── SEZIONE LISTA ─────────────────────────────────────── */}
          {sets.length > 0 && (
            <>
              <div className="h-px bg-gray-700/60" />
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-[0.15em] font-semibold">
                  {t('ui.custom_set_manage')}
                </p>
                {sets.map(preset => (
                  <div
                    key={preset.id}
                    className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1.5 border border-gray-700/40"
                    onClick={() => { if (deleteConfirm === preset.id) setDeleteConfirm(null) }}
                  >
                    <span className="flex-1 text-xs text-amber-300 truncate" title={preset.label}>
                      ★ {preset.label}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(preset.id) }}
                      className={`shrink-0 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        deleteConfirm === preset.id
                          ? 'bg-red-700 border-red-500 text-white'
                          : 'bg-gray-700 hover:bg-red-900/50 border-gray-600 text-red-400'
                      }`}
                    >
                      {deleteConfirm === preset.id ? t('ui.team_library_delete_confirm') : t('ui.team_library_delete')}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {sets.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">{t('ui.team_library_empty')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PresetSelect ───────────────────────────────────────────────────────────

export default function PresetSelect({ team, index, currentSlug, currentSlot, externalRev = 0 }) {
  const { t } = useTranslation()
  const setPokemon = useCalcStore(s => s.setPokemon)
  const setNature  = useCalcStore(s => s.setNature)
  const setItem    = useCalcStore(s => s.setItem)
  const setAbility = useCalcStore(s => s.setAbility)
  const setSPs     = useCalcStore(s => s.setSPs)
  const setMove    = useCalcStore(s => s.setMove)

  // selected è derivato dallo slot corrente confrontandolo con i preset
  // disponibili. Questo garantisce che il dropdown rifletta sempre lo stato
  // reale dello store, anche dopo import da nomi o caricamento da URL.
  //
  // PRIORITÀ: meta preset > custom set > '__blank__'
  // Il confronto usa item + ability + nature come firma del set (le mosse
  // possono avere ordine diverso, ma item+ability+nature sono sufficienti
  // per distinguere i preset meta comuni).
  const [manualSelected, setManualSelected] = useState({})

  const normalizeMove = m => m ? m.replace(/-/g, ' ') : null

  /**
   * ─── LA CHIAVE DI UN SET META ────────────────────────────────────────────
   *
   * Era l'ETICHETTA, e ci finiva dentro il `value` dell'`<option>`. Reggeva
   * finche' i set venivano da una stagione sola; con piu' stagioni lo stesso
   * Incineroar avra' plausibilmente un «Sitrus Support» in M-4 e uno in M-6,
   * e `find` avrebbe preso il primo lasciando il secondo IRRAGGIUNGIBILE —
   * senza errori, senza avvisi, semplicemente non selezionabile.
   *
   * `stagione|etichetta` basta perche' la tendina e' gia' filtrata per
   * specie: lo slug e' implicito. `metaPresets.test.js` presidia la chiave
   * completa `slug + stagione + etichetta`.
   */
  const chiaveMeta = (p) => `${p.stagione}|${p.label}`

  const stagioneScelta = useStagione(s => s.stagione)

  // Meta preset per questo slug, filtrati per la stagione scelta.
  const metaPresets = useMemo(() => {
    const tutti = (currentSlug && PRESETS_BY_SLUG[currentSlug]) || []
    return stagioneScelta === TUTTE ? tutti : tutti.filter(p => p.stagione === stagioneScelta)
  }, [currentSlug, stagioneScelta])

  // useMemo rilega customPresets ogni volta che slug o externalRev cambia.
  // externalRev è incrementato da SlotEditor dopo ogni apertura/chiusura del
  // modal custom set, garantendo che il dropdown si aggiorni senza setState
  // dentro un effect.
  const customPresets = useMemo(() => {
    const all = loadCustomSets()
    return (currentSlug && all[currentSlug]) || []
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlug, externalRev])

  // Deriva il valore selected dal confronto slot corrente vs preset
  const selected = useMemo(() => {
    // 1. Controlla se l'utente ha selezionato manualmente qualcosa
    if (manualSelected[currentSlug] !== undefined) return manualSelected[currentSlug]
    if (!currentSlot || !currentSlug) return '__blank__'
    // 2. Controlla meta preset
    const metaMatch = metaPresets.find(p =>
      p.item === currentSlot.item &&
      p.ability === currentSlot.ability &&
      p.nature?.toLowerCase() === currentSlot.nature?.toLowerCase()
    )
    if (metaMatch) return chiaveMeta(metaMatch)
    // 3. Controlla custom preset
    const customMatch = customPresets.find(p =>
      p.item === currentSlot.item &&
      p.ability === currentSlot.ability &&
      p.nature?.toLowerCase() === currentSlot.nature?.toLowerCase()
    )
    if (customMatch) return `custom:${customMatch.id}`
    return '__blank__'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlug, currentSlot?.item, currentSlot?.ability, currentSlot?.nature,
      metaPresets, customPresets, manualSelected])

  // Quando l'utente sceglie esplicitamente dal select, registriamo la scelta
  // manuale così da non sovrascriverla con la derivazione automatica.
  // Resettiamo il manualSelected quando cambia Pokémon.
  const setSelected = v => setManualSelected(prev => ({ ...prev, [currentSlug]: v }))

    // ── Applica preset ───────────────────────────────────────────────────────

  function applyPreset(preset, isCustom = false) {
    if (!isCustom) {
      // Meta preset: il Pokémon può cambiare (es. forma mega)
      setPokemon(team, index, preset.slug)
      setNature(team, index, preset.nature.toLowerCase())
    } else {
      // Custom preset: il Pokémon rimane lo stesso
      if (preset.nature) setNature(team, index, preset.nature)
    }
    if (preset.item)    setItem(team, index, preset.item)
    if (preset.ability) setAbility(team, index, preset.ability)
    setSPs(team, index, preset.sps || [0,0,0,0,0,0])
    ;(preset.moves || [null,null,null,null]).forEach((m, mi) =>
      setMove(team, index, mi, normalizeMove(m))
    )
  }

  function handleChange(e) {
    const value = e.target.value
    setSelected(value)

    if (value === '__blank__') {
      if (currentSlug) setPokemon(team, index, currentSlug)
      setNature(team, index, null)
      setItem(team, index, null)
      setAbility(team, index, null)
      setSPs(team, index, [0,0,0,0,0,0])
      ;[0,1,2,3].forEach(mi => setMove(team, index, mi, null))
      return
    }

    if (value.startsWith('custom:')) {
      // Valore custom: "custom:<id>"
      const id = value.slice(7)
      const preset = customPresets.find(p => p.id === id)
      if (preset) applyPreset(preset, true)
      return
    }

    // Meta preset
    const preset = metaPresets.find(p => chiaveMeta(p) === value)
    if (preset) applyPreset(preset, false)
  }



  return (
    <select
      value={selected}
      onChange={handleChange}
      className="w-full bg-gray-700 text-xs text-gray-300 rounded px-2 py-1 outline-none border border-gray-600 cursor-pointer"
      title={t('ui.load_meta_preset')}
    >
      <option value="__blank__">{t('ui.blank_set')}</option>

      {metaPresets.length > 0 && metaPresets.map(p => (
        <option key={chiaveMeta(p)} value={chiaveMeta(p)}>
          {/* La stagione si mostra solo quando non si sta filtrando su una
              sola: altrimenti sarebbe la stessa sigla ripetuta su ogni riga. */}
          {stagioneScelta === TUTTE ? `${p.label} · ${p.stagione}` : p.label}
        </option>
      ))}

      {customPresets.length > 0 && (
        <optgroup label="★ Custom">
          {customPresets.map(p => (
            <option key={p.id} value={`custom:${p.id}`}>★ {p.label}</option>
          ))}
        </optgroup>
      )}
    </select>
  )
}