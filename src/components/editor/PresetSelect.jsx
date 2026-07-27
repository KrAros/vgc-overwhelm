import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useCalcStore from '../../store/useCalcStore'
import { PRESETS_BY_SLUG } from '../../data/metaPresets'





// ─── PresetSelect ─────────────────────────────────────────────────────────────
/**
 * Dropdown compatto che mostra i preset meta disponibili.
 * Se il Pokémon nello slot è già uno di quelli con preset, filtra la lista
 * a quei soli preset. Altrimenti mostra tutti i preset in ordine alfabetico.
 * Al cambio applica il preset e resetta il select a "— Preset —".
 */
export default function PresetSelect({ team, index, currentSlug }) {
  const { t } = useTranslation()
  const setPokemon = useCalcStore(s => s.setPokemon)
  const setNature  = useCalcStore(s => s.setNature)
  const setItem    = useCalcStore(s => s.setItem)
  const setAbility = useCalcStore(s => s.setAbility)
  const setSPs     = useCalcStore(s => s.setSPs)
  const setMove    = useCalcStore(s => s.setMove)

  // Mappa slug → preset selezionato, così ogni Pokémon ricorda la sua scelta
  // e cambiando Pokémon si riparte automaticamente da Blank Set
  const [selectedMap, setSelectedMap] = useState({})
  const selected = selectedMap[currentSlug] ?? '__blank__'
  const setSelected = (value) => setSelectedMap(prev => ({ ...prev, [currentSlug]: value }))

  // Normalizza slug mossa: trattini → spazi (formato moves.json)
  const normalizeMove = (m) => m ? m.replace(/-/g, ' ') : null

  const dedicatedPresets = currentSlug && PRESETS_BY_SLUG[currentSlug]
    ? PRESETS_BY_SLUG[currentSlug]
    : null

  const presets = dedicatedPresets ?? []

  function applyPreset(value) {
    if (!value) return
    setSelected(value)
    if (value === '__blank__') {
      if (currentSlug) setPokemon(team, index, currentSlug)
      setNature(team, index, null)
      setItem(team, index, null)
      setAbility(team, index, null)
      setSPs(team, index, [0, 0, 0, 0, 0, 0])
      ;[0,1,2,3].forEach(mi => setMove(team, index, mi, null))
      return
    }
    const preset = presets.find(p => p.label === value)
    if (!preset) return
    setPokemon(team, index, preset.slug)
    setNature(team, index, preset.nature.toLowerCase())
    setItem(team, index, preset.item)
    setAbility(team, index, preset.ability)
    setSPs(team, index, preset.sps)
    preset.moves.forEach((m, mi) => setMove(team, index, mi, normalizeMove(m)))
  }

  return (
    <select
      value={selected}
      onChange={e => applyPreset(e.target.value)}
      className="w-full bg-gray-700 text-xs text-gray-300 rounded px-2 py-1 outline-none border border-gray-600 cursor-pointer"
      title={t("ui.load_meta_preset")}
    >
      <option value="__blank__">{t("ui.blank_set")}</option>
      {presets.map(p => (
        <option key={p.label} value={p.label}>{p.label}</option>
      ))}
    </select>
  )
}