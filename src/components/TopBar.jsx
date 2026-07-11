import useCalcStore from '../store/useCalcStore'

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

function Btn({ label, active, color, activeClass, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded border transition-colors ${
        active ? activeClass : color + ' bg-transparent hover:opacity-80'
      }`}
    >
      {label}
    </button>
  )
}

export default function TopBar() {
  const level        = useCalcStore(s => s.level)
  const trickRoom    = useCalcStore(s => s.trickRoom)
  const doubleTarget = useCalcStore(s => s.doubleTarget)
  const weather      = useCalcStore(s => s.weather)
  const terrain      = useCalcStore(s => s.terrain)
  const helpingHand  = useCalcStore(s => s.helpingHand)
  const auroraVeil   = useCalcStore(s => s.auroraVeil)
  const lightScreen  = useCalcStore(s => s.lightScreen)
  const reflect      = useCalcStore(s => s.reflect)
  const protect      = useCalcStore(s => s.protect)
  const crit         = useCalcStore(s => s.crit)

  const setLevel        = useCalcStore(s => s.setLevel)
  const toggleTrickRoom = useCalcStore(s => s.toggleTrickRoom)
  const toggleDoubleTarget = useCalcStore(s => s.toggleDoubleTarget)
  const setWeather      = useCalcStore(s => s.setWeather)
  const setTerrain      = useCalcStore(s => s.setTerrain)
  const toggleModifier  = useCalcStore(s => s.toggleModifier)

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 mb-4">
      <div className="flex flex-wrap gap-4 items-center">

        {/* Options */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Options</span>
          <div className="flex gap-1">
            {[5,50,100].map(lv => (
              <button
                key={lv}
                onClick={() => setLevel(lv)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  level === lv
                    ? 'bg-teal-500 text-gray-900 border-teal-500 font-medium'
                    : 'border-gray-600 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Lv.{lv}
              </button>
            ))}
          </div>
          <button
            onClick={toggleTrickRoom}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              trickRoom ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'border-gray-600 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Trick Room
          </button>
          <button
            onClick={toggleDoubleTarget}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              doubleTarget ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'border-gray-600 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Double Target
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Field */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Field</span>
          <div className="flex gap-1">
            <button
              onClick={() => setTerrain(null)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                !terrain ? 'bg-gray-500 text-white border-gray-500' : 'border-gray-600 text-gray-400 hover:bg-gray-700'
              }`}
            >
              None
            </button>
            {FIELDS.map(f => (
              <Btn
                key={f.key}
                label={f.label}
                active={terrain === f.key}
                color={f.color}
                activeClass={f.active}
                onClick={() => setTerrain(f.key)}
              />
            ))}
          </div>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Weather */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Weather</span>
          <div className="flex gap-1">
            <button
              onClick={() => setWeather(null)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                !weather ? 'bg-gray-500 text-white border-gray-500' : 'border-gray-600 text-gray-400 hover:bg-gray-700'
              }`}
            >
              None
            </button>
            {WEATHERS.map(w => (
              <Btn
                key={w.key}
                label={w.label}
                active={weather === w.key}
                color={w.color}
                activeClass={w.active}
                onClick={() => setWeather(w.key)}
              />
            ))}
          </div>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Modifiers */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Modifiers</span>
          {[
            { label: 'HH ←',  mod: 'helpingHand', side: 't1', val: helpingHand.t1,  color: 'text-green-400 border-green-400',  active: 'bg-green-400 text-gray-900' },
            { label: 'HH →',  mod: 'helpingHand', side: 't2', val: helpingHand.t2,  color: 'text-green-400 border-green-400',  active: 'bg-green-400 text-gray-900' },
            { label: 'AV ←',  mod: 'auroraVeil',  side: 't1', val: auroraVeil.t1,   color: 'text-blue-400  border-blue-400',   active: 'bg-blue-400  text-gray-900' },
            { label: 'AV →',  mod: 'auroraVeil',  side: 't2', val: auroraVeil.t2,   color: 'text-blue-400  border-blue-400',   active: 'bg-blue-400  text-gray-900' },
            { label: 'LS ←',  mod: 'lightScreen', side: 't1', val: lightScreen.t1,  color: 'text-yellow-400 border-yellow-400', active: 'bg-yellow-400 text-gray-900' },
            { label: 'LS →',  mod: 'lightScreen', side: 't2', val: lightScreen.t2,  color: 'text-yellow-400 border-yellow-400', active: 'bg-yellow-400 text-gray-900' },
            { label: 'Ref ←', mod: 'reflect',     side: 't1', val: reflect.t1,      color: 'text-pink-400  border-pink-400',   active: 'bg-pink-400  text-gray-900' },
            { label: 'Ref →', mod: 'reflect',     side: 't2', val: reflect.t2,      color: 'text-pink-400  border-pink-400',   active: 'bg-pink-400  text-gray-900' },
            { label: 'Crit ←',mod: 'crit',        side: 't1', val: crit.t1,         color: 'text-red-400   border-red-400',    active: 'bg-red-400   text-gray-900' },
            { label: 'Crit →',mod: 'crit',        side: 't2', val: crit.t2,         color: 'text-red-400   border-red-400',    active: 'bg-red-400   text-gray-900' },
          ].map(b => (
            <Btn
              key={b.label}
              label={b.label}
              active={b.val}
              color={b.color}
              activeClass={b.active}
              onClick={() => toggleModifier(b.mod, b.side)}
            />
          ))}
        </div>

      </div>
    </div>
  )
}