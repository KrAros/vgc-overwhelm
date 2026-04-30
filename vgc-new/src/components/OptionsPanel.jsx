export default function OptionsPanel() {
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
        {["Lv. 5", "Lv. 50", "Lv. 100"].map((lv) => (
          <button
            key={lv}
            className={`text-xs px-3 py-1 rounded border ${
              lv === "Lv. 50"
                ? "bg-teal-500 text-gray-900 border-teal-500 font-medium"
                : "border-gray-600 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {lv}
          </button>
        ))}
      </div>

      <div className="flex gap-2 justify-center">
        <button className="text-xs px-3 py-1 rounded border border-gray-600 text-gray-400 hover:bg-gray-700">
          Trick Room
        </button>
        <button className="text-xs px-3 py-1 rounded border border-gray-600 text-gray-400 hover:bg-gray-700">
          Double Target
        </button>
      </div>
    </div>
  )
}