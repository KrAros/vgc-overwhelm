import useCalcStore from '../store/useCalcStore'

const modifiers = [
  { label: "Helping Hand ←", mod: "helpingHand", side: "t1", color: "text-green-400 border-green-400", active: "bg-green-400 text-gray-900" },
  { label: "Helping Hand →", mod: "helpingHand", side: "t2", color: "text-green-400 border-green-400", active: "bg-green-400 text-gray-900" },
  { label: "Aurora Veil ←",  mod: "auroraVeil",  side: "t1", color: "text-blue-400 border-blue-400",   active: "bg-blue-400 text-gray-900" },
  { label: "Aurora Veil →",  mod: "auroraVeil",  side: "t2", color: "text-blue-400 border-blue-400",   active: "bg-blue-400 text-gray-900" },
  { label: "Light Screen ←", mod: "lightScreen", side: "t1", color: "text-yellow-400 border-yellow-400", active: "bg-yellow-400 text-gray-900" },
  { label: "Light Screen →", mod: "lightScreen", side: "t2", color: "text-yellow-400 border-yellow-400", active: "bg-yellow-400 text-gray-900" },
  { label: "Reflect ←",      mod: "reflect",     side: "t1", color: "text-pink-400 border-pink-400",   active: "bg-pink-400 text-gray-900" },
  { label: "Reflect →",      mod: "reflect",     side: "t2", color: "text-pink-400 border-pink-400",   active: "bg-pink-400 text-gray-900" },
]

export default function ModifiersPanel() {
  const toggleModifier = useCalcStore((s) => s.toggleModifier)
  const helpingHand = useCalcStore((s) => s.helpingHand)
  const auroraVeil  = useCalcStore((s) => s.auroraVeil)
  const lightScreen = useCalcStore((s) => s.lightScreen)
  const reflect     = useCalcStore((s) => s.reflect)

  const stateMap = { helpingHand, auroraVeil, lightScreen, reflect }

  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest text-center mb-3">
        Other Modifiers
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {modifiers.map((m) => (
          <button
            key={m.label}
            onClick={() => toggleModifier(m.mod, m.side)}
            className={`text-xs py-1 px-2 rounded border transition-colors ${
              stateMap[m.mod][m.side]
                ? m.active
                : m.color + " bg-transparent"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}