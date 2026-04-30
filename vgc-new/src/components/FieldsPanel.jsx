const fields = [
  { label: "Grassy", color: "text-green-400 border-green-400" },
  { label: "Electric", color: "text-yellow-400 border-yellow-400" },
  { label: "Misty", color: "text-pink-300 border-pink-300" },
  { label: "Psychic", color: "text-purple-400 border-purple-400" },
  { label: "Sun", color: "text-orange-400 border-orange-400" },
  { label: "Rain", color: "text-blue-400 border-blue-400" },
  { label: "Sand", color: "text-amber-600 border-amber-600" },
  { label: "Hail", color: "text-sky-200 border-sky-200" },
]

const extras = [
  { label: "Z Move ←", color: "text-yellow-500 border-yellow-500" },
  { label: "Z Move →", color: "text-yellow-500 border-yellow-500" },
  { label: "Protect ←", color: "text-teal-400 border-teal-400" },
  { label: "Protect →", color: "text-teal-400 border-teal-400" },
  { label: "Crit ←", color: "text-red-400 border-red-400" },
  { label: "Crit →", color: "text-red-400 border-red-400" },
]

export default function FieldsPanel() {
  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest text-center mb-3">
        Fields & Weather
      </h2>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {fields.map((f) => (
          <button
            key={f.label}
            className={`text-xs py-1 px-2 rounded border ${f.color} hover:opacity-80 bg-transparent`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 text-center mb-2">Crit & Protect</p>

      <div className="grid grid-cols-2 gap-2">
        {extras.map((e) => (
          <button
            key={e.label}
            className={`text-xs py-1 px-2 rounded border ${e.color} hover:opacity-80 bg-transparent`}
          >
            {e.label}
          </button>
        ))}
      </div>
    </div>
  )
}