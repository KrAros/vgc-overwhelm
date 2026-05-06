import useCalcStore from '../store/useCalcStore'

const fields = [
  { label: "Grassy",    key: "grassy",   type: "terrain", color: "text-green-400 border-green-400",  active: "bg-green-400 text-gray-900" },
  { label: "Electric",  key: "electric", type: "terrain", color: "text-yellow-400 border-yellow-400", active: "bg-yellow-400 text-gray-900" },
  { label: "Misty",     key: "misty",    type: "terrain", color: "text-pink-300 border-pink-300",    active: "bg-pink-300 text-gray-900" },
  { label: "Psychic",   key: "psychic",  type: "terrain", color: "text-purple-400 border-purple-400", active: "bg-purple-400 text-gray-900" },
  { label: "Sun",       key: "sun",      type: "weather", color: "text-orange-400 border-orange-400", active: "bg-orange-400 text-gray-900" },
  { label: "Rain",      key: "rain",     type: "weather", color: "text-blue-400 border-blue-400",    active: "bg-blue-400 text-gray-900" },
  { label: "Sand",      key: "sand",     type: "weather", color: "text-amber-600 border-amber-600",  active: "bg-amber-600 text-gray-900" },
  { label: "Snow",      key: "snow", type: "weather", color: "text-sky-200 border-sky-200", active: "bg-sky-200 text-gray-900" },
]

export default function FieldsPanel() {
  const weather = useCalcStore((s) => s.weather)
  const terrain = useCalcStore((s) => s.terrain)
  const setWeather = useCalcStore((s) => s.setWeather)
  const setTerrain = useCalcStore((s) => s.setTerrain)
  const crit = useCalcStore((s) => s.crit)
  const protect = useCalcStore((s) => s.protect)
  const toggleModifier = useCalcStore((s) => s.toggleModifier)

  const isActive = (f) =>
    f.type === "weather" ? weather === f.key : terrain === f.key

  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest text-center mb-3">
        Fields & Weather
      </h2>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {fields.map((f) => (
          <button
            key={f.label}
            onClick={() => f.type === "weather" ? setWeather(f.key) : setTerrain(f.key)}
            className={`text-xs py-1 px-2 rounded border transition-colors ${
              isActive(f) ? f.active : f.color + " bg-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 text-center mb-2">Crit & Protect</p>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Protect ←", mod: "protect", side: "t1", color: "text-teal-400 border-teal-400", active: "bg-teal-400 text-gray-900" },
          { label: "Protect →", mod: "protect", side: "t2", color: "text-teal-400 border-teal-400", active: "bg-teal-400 text-gray-900" },
          { label: "Crit ←",    mod: "crit",    side: "t1", color: "text-red-400 border-red-400",   active: "bg-red-400 text-gray-900" },
          { label: "Crit →",    mod: "crit",    side: "t2", color: "text-red-400 border-red-400",   active: "bg-red-400 text-gray-900" },
        ].map((b) => (
          <button
            key={b.label}
            onClick={() => toggleModifier(b.mod, b.side)}
            className={`text-xs py-1 px-2 rounded border transition-colors ${
              (b.mod === "crit" ? crit : protect)[b.side]
                ? b.active
                : b.color + " bg-transparent"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}