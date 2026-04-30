import useCalcStore from '../store/useCalcStore'

export default function OptionsPanel() {
  const level = useCalcStore((s) => s.level)
  const trickRoom = useCalcStore((s) => s.trickRoom)
  const doubleTarget = useCalcStore((s) => s.doubleTarget)
  const setLevel = useCalcStore((s) => s.setLevel)
  const toggleTrickRoom = useCalcStore((s) => s.toggleTrickRoom)
  const toggleDoubleTarget = useCalcStore((s) => s.toggleDoubleTarget)

  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest text-center mb-3">
        Options
      </h2>

      <div className="flex justify-between mb-2">
        <button className="text-xs px-2 py-1 rounded border border-gray-600 text-teal-400 hover:bg-gray-700">
          ↙ Import
        </button>
        <button className="text-xs px-2 py-1 rounded border border-gray-600 text-red-400 hover:bg-gray-700">
          Switch
        </button>
        <button className="text-xs px-2 py-1 rounded border border-gray-600 text-teal-400 hover:bg-gray-700">
          Import ↘
        </button>
      </div>

      <div className="flex justify-between mb-3">
        <button className="text-xs px-2 py-1 rounded border border-gray-600 text-teal-400 hover:bg-gray-700">
          ↩ Reset
        </button>
        <button className="text-xs px-2 py-1 rounded border border-gray-600 text-red-400 hover:bg-gray-700">
          Reset All
        </button>
        <button className="text-xs px-2 py-1 rounded border border-gray-600 text-teal-400 hover:bg-gray-700">
          Reset ↪
        </button>
      </div>

      <div className="flex gap-2 justify-center mb-3">
        {[5, 50, 100].map((lv) => (
          <button
            key={lv}
            onClick={() => setLevel(lv)}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              level === lv
                ? "bg-teal-500 text-gray-900 border-teal-500 font-medium"
                : "border-gray-600 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Lv. {lv}
          </button>
        ))}
      </div>

      <div className="flex gap-2 justify-center">
        <button
          onClick={toggleTrickRoom}
          className={`text-xs px-3 py-1 rounded border transition-colors ${
            trickRoom
              ? "bg-yellow-500 text-gray-900 border-yellow-500 font-medium"
              : "border-gray-600 text-gray-400 hover:bg-gray-700"
          }`}
        >
          Trick Room
        </button>
        <button
          onClick={toggleDoubleTarget}
          className={`text-xs px-3 py-1 rounded border transition-colors ${
            doubleTarget
              ? "bg-yellow-500 text-gray-900 border-yellow-500 font-medium"
              : "border-gray-600 text-gray-400 hover:bg-gray-700"
          }`}
        >
          Double Target
        </button>
      </div>
    </div>
  )
}