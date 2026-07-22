import { spriteUrl } from '../../utils/sprite'
import { showdownToSlot } from './showdownHelpers.js'
import { useState } from 'react'
import useCalcStore from '../../store/useCalcStore'

// ─── ImportModal (inline nello slot) ─────────────────────────────────────────
/**
 * Textarea inline che appare sotto i bottoni quando si clicca Importa.
 * Parsa un singolo blocco Showdown e popola lo slot corrente.
 */
export function ImportModal({ team, index, onClose, alwaysOpen = false }) {
  const [text, setText] = useState('')
  const [warnings, setWarnings] = useState([])

  const setPokemon     = useCalcStore(s => s.setPokemon)
  const setSPs         = useCalcStore(s => s.setSPs)
  const setNature      = useCalcStore(s => s.setNature)
  const setAbility     = useCalcStore(s => s.setAbility)
  const setItem        = useCalcStore(s => s.setItem)
  const setMove        = useCalcStore(s => s.setMove)

  function handleImport() {
    const { slot, warnings: w } = showdownToSlot(text)
    setWarnings(w)
    if (!slot) return

    setPokemon(team, index, slot.key)
    setSPs(team, index, slot.sps)
    if (slot.nature)  setNature(team, index, slot.nature)
    if (slot.ability) setAbility(team, index, slot.ability)
    if (slot.item)    setItem(team, index, slot.item)
    slot.moves.forEach((m, mi) => { if (m) setMove(team, index, mi, m) })

    if (w.length === 0) onClose()
  }

  return (
    <div className={alwaysOpen ? '' : 'mt-2 p-2 bg-gray-900 rounded border border-gray-700'}>
      <textarea
        autoFocus={!alwaysOpen}
        className="w-full h-36 bg-gray-800 text-gray-200 text-xs font-mono p-2 rounded border border-gray-700 resize-none outline-none focus:border-teal-500"
        placeholder={"Paste the Showdown block for a single Pokémon here...\n\nExample:\nGardevoir @ Choice Specs\nAbility: Trace\nEVs: 4 HP / 32 SpA / 30 Spe\nTimid Nature\n- Moonblast\n- Psychic\n- Shadow Ball\n- Trick"}
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <div className="flex gap-2 mt-1.5 items-center flex-wrap">
        <button
          onClick={handleImport}
          className="text-xs px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors"
        >
          ✔ Import
        </button>
        {!alwaysOpen && (
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Annulla
          </button>
        )}
        {warnings.map((w, i) => (
          <span key={i} className="text-xs text-yellow-400">⚠ {w}</span>
        ))}
      </div>
    </div>
  )
}

// ─── DuplicateModal ───────────────────────────────────────────────────────────
/**
 * Mostra un selettore di slot solo quando tutti e 6 i posti del team sono occupati.
 * In caso contrario duplica direttamente nel primo slot libero dopo l'attuale.
 */
export function DuplicateModal({ team, sourceIndex, onClose }) {
  const teamData   = useCalcStore(s => s[team])
  const setTeamFn  = useCalcStore(s => s.setTeam)

  // Trova il primo slot libero dopo sourceIndex
  const nextEmpty = (() => {
    for (let i = sourceIndex + 1; i < 6; i++) {
      if (!teamData[i]?.key) return i
    }
    return null
  })()

  function duplicateTo(targetIndex) {
    const source = teamData[sourceIndex]
    if (!source) return
    const newTeam = teamData.map((slot, i) =>
      i === targetIndex ? { ...source } : slot
    )
    setTeamFn(team, newTeam)
    onClose()
  }

  // Slot libero trovato → duplica subito senza mostrare UI
  if (nextEmpty !== null) {
    duplicateTo(nextEmpty)
    return null
  }

  // Tutti gli slot occupati → chiedi dove sovrascrivere
  return (
    <div className="mt-2 p-2 bg-gray-900 rounded border border-gray-700">
      <p className="text-xs text-gray-400 mb-2">Tutti gli slot sono occupati. Scegli dove sovrascrivere:</p>
      <div className="flex gap-1 flex-wrap">
        {teamData.map((slot, i) => {
          if (i === sourceIndex) return null
          const name = slot?.key ? slot.key.split('-')[0] : `P${i+1}`
          const sprite = slot?.key ? spriteUrl(slot.key) : null
          return (
            <button
              key={i}
              onClick={() => duplicateTo(i)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-colors"
            >
              {sprite && (
                <img src={sprite} alt={name} className="w-8 h-8 object-contain"
                  onError={e => { e.target.style.display = 'none' }} />
              )}
              <span className="text-[10px] text-gray-300 capitalize">{name}</span>
            </button>
          )
        })}
      </div>
      <button
        onClick={onClose}
        className="mt-2 text-xs text-gray-500 hover:text-gray-300"
      >
        Annulla
      </button>
    </div>
  )
}