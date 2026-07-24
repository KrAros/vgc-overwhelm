import { useState } from 'react'
import { STAT_NAMES } from '../../utils/statCalc'
import pokemonData from '../../data/pokemon.json'
import movesData   from '../../data/moves.json'
import useCalcStore from '../../store/useCalcStore'
import { NATURES, NATURE_MODIFIERS } from '../../data/natures.js'
import { TYPE_NAMES, TYPE_COLORS } from '../../data/typeChart.js'
import { spriteUrl, fallbackSpriteUrl } from '../../utils/sprite'




import PresetSelect from './PresetSelect.jsx'
import StatRow from './StatRow.jsx'
import { PokemonSearch, MoveSearch, ItemSearch, AbilitySelect } from './SearchSelects.jsx'
import AbilityFlags from './AbilityFlags.jsx'
import { slotToShowdown } from './showdownHelpers.js'
import { ImportModal, DuplicateModal } from './Modals.jsx'

// ─── PokemonPanel ─────────────────────────────────────────────────────────────

export default function PokemonPanel({ team, index, tailwindActive = false }) {
  const pokemon        = useCalcStore(s => s[team][index])
  const level          = useCalcStore(s => s.level)
  const setPokemon     = useCalcStore(s => s.setPokemon)
  const setNature      = useCalcStore(s => s.setNature)
  const setSPs         = useCalcStore(s => s.setSPs)
  const setMove        = useCalcStore(s => s.setMove)
  const setBoost       = useCalcStore(s => s.setBoost)
  const setItem        = useCalcStore(s => s.setItem)
  const setAbility     = useCalcStore(s => s.setAbility)
  const setAbilityFlag = useCalcStore(s => s.setAbilityFlag)
  const setDoubleTarget = useCalcStore(s => s.setDoubleTarget)
  const weather        = useCalcStore(s => s.weather)

  const [showImport,    setShowImport]    = useState(false)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [exportCopied,  setExportCopied]  = useState(false)

  const data         = pokemonData[pokemon?.key]
  const sps          = pokemon?.sps || [0,0,0,0,0,0]
  const nature       = pokemon?.nature || null
  const item         = pokemon?.item || null
  const ability      = pokemon?.ability || null
  const abilityFlags = pokemon?.abilityFlags || {}
  const total        = sps.reduce((a,b) => a+b, 0)
  const remaining    = 66 - total

  const opponentTeam = useCalcStore(s => s[team === 'team1' ? 'team2' : 'team1'])
  const opponentHasIntimidateActive = opponentTeam.some(
    p => p?.ability?.toLowerCase() === 'intimidate' && p?.abilityFlags?.intimidateActive
  )

  const boostFields = [null,'atkBoost','defBoost','spAtkBoost','spDefBoost','speBoost']

  const handleSp = (i, val) => {
    const newVal = Math.min(32, Math.max(0, val))
    const newSPs = [...sps]
    const diff   = newVal - sps[i]
    if (diff > remaining) return
    newSPs[i] = newVal
    setSPs(team, index, newSPs)
  }

  const handlePokemonChange = (key) => {
    setPokemon(team, index, key)
    const targetData = pokemonData[key]
    if (targetData?.abilities?.length > 0) {
      setAbility(team, index, targetData.abilities[0])
    } else {
      setAbility(team, index, '')
    }
  }

  const handleMoveChange = (mi, m) => {
    setMove(team, index, mi, m)
    const isSpread = movesData[m]?.spread === true
    setDoubleTarget(isSpread)
  }

  // ── Esporta: copia paste singolo Pokémon negli appunti
  const handleExport = () => {
    const paste = slotToShowdown(pokemon)
    if (!paste) return
    navigator.clipboard.writeText(paste).then(() => {
      setExportCopied(true)
      setTimeout(() => setExportCopied(false), 2000)
    })
  }

  // ── Importa: toggle textarea inline
  const handleImport = () => {
    setShowImport(v => !v)
    setShowDuplicate(false)
  }

  // ── Duplica: logica gestita da DuplicateModal
  const handleDuplicate = () => {
    setShowDuplicate(v => !v)
    setShowImport(false)
  }

  return (
    <div className="p-3">
      {/* Barra bottoni — sempre visibile. Duplica/Esporta/Elimina disabilitati se slot vuoto */}
      <div className="flex justify-end gap-1.5 mb-2.5 text-xs">
            <button
              type="button"
              onClick={data ? handleDuplicate : undefined}
              disabled={!data}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ${
                !data ? 'bg-gray-800/40 border-gray-700/20 text-gray-600 cursor-not-allowed'
                : showDuplicate ? 'bg-teal-800 border-teal-600 text-teal-200'
                : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'
              }`}
              title="Duplicate Pokémon"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              <span>Duplicate</span>
            </button>

            <button
              type="button"
              onClick={data ? handleExport : undefined}
              disabled={!data}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ${
                !data ? 'bg-gray-800/40 border-gray-700/20 text-gray-600 cursor-not-allowed'
                : exportCopied ? 'bg-green-800 border-green-600 text-green-200'
                : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'
              }`}
              title="Export to Showdown"
            >
              {!exportCopied && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
              <span>{exportCopied ? 'Copied' : 'Export'}</span>
            </button>

            <button
              type="button"
              onClick={handleImport}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ${
                showImport
                  ? 'bg-teal-800 border-teal-600 text-teal-200'
                  : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'
              }`}
              title="Import from Showdown"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Import</span>
            </button>

            <button
              type="button"
              onClick={data ? () => { setPokemon(team, index, ''); setAbility(team, index, '') } : undefined}
              disabled={!data}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ml-1 ${
                !data ? 'bg-gray-800/40 border-gray-700/20 text-gray-600 cursor-not-allowed'
                : 'bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border-red-900/30'
              }`}
              title="Delete Pokémon"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete</span>
            </button>
          </div>

      {/* Pannelli inline: Importa / Duplica */}
      {showImport && (
        <ImportModal team={team} index={index} onClose={() => setShowImport(false)} />
      )}
      {showDuplicate && data && (
        <DuplicateModal team={team} sourceIndex={index} onClose={() => setShowDuplicate(false)} />
      )}

      <div className="flex gap-3 mb-3">
        {data && (
          <img
            src={spriteUrl(pokemon.key)}
            alt={pokemon.key}
            className="w-16 h-16 object-contain"
            onError={e => {
              const fb = fallbackSpriteUrl(pokemon.key)
              if (fb && e.target.src !== fb) { e.target.src = fb } else { e.target.style.display = 'none' }
            }}
          />
        )}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex gap-2 items-center">
            <div className={pokemon?.key ? "w-1/3 shrink-0" : "flex-1"}>
              <PokemonSearch value={pokemon?.key} onChange={handlePokemonChange} />
            </div>
            {pokemon?.key && (
              <>
                <div className="flex-1 min-w-0">
                  <PresetSelect team={team} index={index} currentSlug={pokemon?.key} />
                </div>
                <div className="flex gap-1 flex-wrap justify-end shrink-0">
                  {data?.type?.map(typeId => {
                    const typeName = TYPE_NAMES[typeId]
                    return (
                      <span
                        key={typeId}
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shadow-sm ${
                          TYPE_COLORS[typeName] || 'bg-gray-600 text-white'
                        }`}
                      >
                        {typeName}
                      </span>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          {data && (
            <div className="flex gap-2 w-full">
              <div className="w-1/3">
                <AbilitySelect value={ability} abilities={data?.abilities} onChange={a => setAbility(team, index, a)} />
              </div>
              <div className="w-1/3">
                <select
                  className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none capitalize"
                  value={nature || ''}
                  onChange={e => setNature(team, index, e.target.value || null)}
                >
                  <option value="">Natura (neutra)</option>
                  {NATURES.map(n => {
                    const STAT_LABELS = ['','Atk','Def','SpA','SpD','Spe']
                    const mod = NATURE_MODIFIERS[n]
                    const label = mod && mod[0] !== 0
                      ? `${n.charAt(0).toUpperCase()+n.slice(1)} (+${STAT_LABELS[mod[0]]}, -${STAT_LABELS[mod[1]]})`
                      : `${n.charAt(0).toUpperCase()+n.slice(1)}`
                    return <option key={n} value={n}>{label}</option>
                  })}
                </select>
              </div>
              <div className="w-1/3">
                <ItemSearch value={item} onChange={m => setItem(team, index, m)} />
              </div>
            </div>
          )}
          {data && ability && (
            <AbilityFlags
              ability={ability}
              flags={abilityFlags}
              opponentHasIntimidateActive={opponentHasIntimidateActive}
              onFlagChange={(flag, val) => setAbilityFlag(team, index, flag, val)}
              weather={weather}
            />
          )}
        </div>
      </div>

      {data && (
        <>
          <div className="mb-2">
            <div className="flex items-center text-xs text-gray-500 mb-1 gap-2">
              <span className="w-8 text-center">Stat</span>
              <span className="w-7 text-center">Base</span>
              <div className="flex-1 flex justify-center items-center gap-1.5">
                <span>SP</span>
                <span className={`text-[10px] font-bold px-1 rounded ${
                  remaining === 0
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  ({remaining}/66)
                </span>
              </div>
              <span className="w-8 text-center">Tot</span>
              <span className="w-12 text-center">Boost</span>
              <span className="w-8 text-center">Mod</span>
            </div>
            {STAT_NAMES.map((_, i) => (
              <StatRow
                key={i}
                statIdx={i}
                base={data.stats[i]}
                sp={sps[i]}
                level={level}
                nature={nature}
                boostVal={boostFields[i] ? (pokemon?.[boostFields[i]] || 0) : 0}
                onSpChange={val => handleSp(i, val)}
                onBoostChange={val => boostFields[i] && setBoost(team, index, boostFields[i], val)}
                speedWeatherActive={(() => {
                  const SPEED_MAP = {
                    'sand-rush':   ['sand', 'sandstorm'],
                    'chlorophyll': ['sun', 'harsh sunshine'],
                    'swift-swim':  ['rain', 'heavy rain'],
                    'slush-rush':  ['snow', 'hail'],
                  }
                  const conditions = SPEED_MAP[(ability || '').toLowerCase()] || []
                  return conditions.includes((weather || '').toLowerCase())
                })()}
                tailwindActive={i === 5 && tailwindActive}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {[0,1,2,3].map(mi => (
              <MoveSearch
                key={mi}
                value={pokemon?.moves[mi]}
                placeholder={`Move ${mi+1}`}
                onChange={m => handleMoveChange(mi, m)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}