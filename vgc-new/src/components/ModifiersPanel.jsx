const modifiers = [
  { label: "Helping Hand ←", color: "text-green-400 border-green-400" },
  { label: "Helping Hand →", color: "text-green-400 border-green-400" },
  { label: "Aurora Veil ←", color: "text-blue-400 border-blue-400" },
  { label: "Aurora Veil →", color: "text-blue-400 border-blue-400" },
  { label: "Light Screen ←", color: "text-yellow-400 border-yellow-400" },
  { label: "Light Screen →", color: "text-yellow-400 border-yellow-400" },
  { label: "Reflect ←", color: "text-pink-400 border-pink-400" },
  { label: "Reflect →", color: "text-pink-400 border-pink-400" },
]

export default function ModifiersPanel() {
  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest text-center mb-3">
        Other Modifiers
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {modifiers.map((m) => (
          <button
            key={m.label}
            className={`text-xs py-1 px-2 rounded border ${m.color} hover:opacity-80 bg-transparent`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}