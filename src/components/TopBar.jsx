import useCalcStore from '../store/useCalcStore'
import { useTranslation } from 'react-i18next'

const FIELDS = [
  { label: 'Grassy',   key: 'grassy',   color: 'text-green-400  border-green-400',  active: 'bg-green-400  text-gray-900' },
  { label: 'Electric', key: 'electric', color: 'text-yellow-400 border-yellow-400', active: 'bg-yellow-400 text-gray-900' },
  { label: 'Misty',    key: 'misty',    color: 'text-pink-300   border-pink-300',   active: 'bg-pink-300   text-gray-900' },
  { label: 'Psychic',  key: 'psychic',  color: 'text-purple-400 border-purple-400', active: 'bg-purple-400 text-gray-900' },
]

const WEATHERS = [
  { label: 'Sun',  key: 'sun',  color: 'text-orange-400 border-orange-400', active: 'bg-orange-400 text-gray-900' },
  { label: 'Rain', key: 'rain', color: 'text-blue-400   border-blue-400',   active: 'bg-blue-400   text-gray-900' },
  { label: 'Sand', key: 'sand', color: 'text-amber-600  border-amber-600',  active: 'bg-amber-600  text-gray-900' },
  { label: 'Snow', key: 'snow', color: 'text-sky-200    border-sky-200',    active: 'bg-sky-200    text-gray-900' },
]

function Btn({ label, active, activeClass, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`text-xs px-3 py-1 rounded border transition-colors ${
        active ? activeClass : 'text-gray-400 border-gray-600/40 hover:bg-gray-800/60'
      }`}
    >
      {label}
    </button>
  )
}

export default function TopBar() {
  const { t } = useTranslation()
  const trickRoom    = useCalcStore(s => s.trickRoom)
  const doubleTarget = useCalcStore(s => s.doubleTarget)
  const weather      = useCalcStore(s => s.weather)
  const terrain      = useCalcStore(s => s.terrain)

  const toggleTrickRoom    = useCalcStore(s => s.toggleTrickRoom)
  const toggleDoubleTarget = useCalcStore(s => s.toggleDoubleTarget)
  const setWeather         = useCalcStore(s => s.setWeather)
  const setTerrain         = useCalcStore(s => s.setTerrain)

  return (
    <div role="group" aria-label="Battle conditions" className="bg-gray-900 rounded-xl border border-gray-700/40 px-3 py-2 mb-4">

      {/* ── DESKTOP: layout orizzontale originale ── */}
      <div className="hidden sm:flex flex-nowrap gap-3 items-center justify-between overflow-x-auto">

        {/* Options */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Options</span>
          <button
            onClick={toggleTrickRoom}
            aria-pressed={trickRoom}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              trickRoom ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'border-gray-600 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t("ui.trick_room")}
          </button>
          <button
            onClick={toggleDoubleTarget}
            aria-pressed={doubleTarget}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              doubleTarget ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'border-gray-600 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t("ui.double_target")}
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Field */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Field</span>
          <div className="flex gap-1">
            <button
              onClick={() => setTerrain(null)}
              aria-pressed={!terrain}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                !terrain ? 'bg-gray-500 text-white border-gray-500' : 'border-gray-600 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {t("ui.none")}
            </button>
            {FIELDS.map(f => (
              <Btn key={f.key} label={f.label} active={terrain === f.key} activeClass={f.active} onClick={() => setTerrain(f.key)} />
            ))}
          </div>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Weather */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Weather</span>
          <div className="flex gap-1">
            <button
              onClick={() => setWeather(null)}
              aria-pressed={!weather}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                !weather ? 'bg-gray-500 text-white border-gray-500' : 'border-gray-600 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {t("ui.none")}
            </button>
            {WEATHERS.map(w => (
              <Btn key={w.key} label={w.label} active={weather === w.key} activeClass={w.active} onClick={() => setWeather(w.key)} />
            ))}
          </div>
        </div>

      </div>

      {/* ── MOBILE: layout a griglia compatta ── */}
      <div className="sm:hidden space-y-2">

        {/* Riga 1: Level + {t("ui.trick_room")} + {t("ui.double_target")} */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleTrickRoom}
            className={`text-xs px-3 py-2.5 rounded border transition-colors ${
              trickRoom ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'border-gray-600 text-gray-400'
            }`}
          >
            TR
          </button>
          <button
            onClick={toggleDoubleTarget}
            className={`text-xs px-3 py-2.5 rounded border transition-colors ${
              doubleTarget ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'border-gray-600 text-gray-400'
            }`}
          >
            2× Target
          </button>
        </div>

        <div className="h-px bg-gray-700/60" />

        {/* Riga 2: Field + Weather come select */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider shrink-0">Field</span>
          <select
            value={terrain ?? ''}
            onChange={e => setTerrain(e.target.value || null)}
            className="flex-1 bg-gray-700 text-xs text-gray-200 rounded px-2 py-1 outline-none border border-gray-600"
          >
            <option value="">{t("ui.none")}</option>
            {FIELDS.map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>

          <span className="text-[10px] text-gray-500 uppercase tracking-wider shrink-0">Weather</span>
          <select
            value={weather ?? ''}
            onChange={e => setWeather(e.target.value || null)}
            className="flex-1 bg-gray-700 text-xs text-gray-200 rounded px-2 py-1 outline-none border border-gray-600"
          >
            <option value="">{t("ui.none")}</option>
            {WEATHERS.map(w => (
              <option key={w.key} value={w.key}>{w.label}</option>
            ))}
          </select>
        </div>

      </div>
    </div>
  )
}