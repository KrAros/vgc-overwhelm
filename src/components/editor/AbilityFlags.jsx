import { ABILITY_EFFECTS, normalizeAbilityKey } from '../../data/abilityEffects.js'
import { SPEED_WEATHER_ABILITIES, speedWeatherAttiva } from '../../utils/speedOrder.js'
import { abilitaNonCalcolata } from '../../lib/gap.js'
import BadgeNonCalcolata from './BadgeNonCalcolata.jsx'
import { useTranslation } from 'react-i18next'

// ─── AbilityFlags ─────────────────────────────────────────────────────────────

export default function AbilityFlags({ ability, flags, opponentHasIntimidateActive, onFlagChange, weather }) {
  const { t } = useTranslation()
  const key = normalizeAbilityKey(ability)

  // La tabella sta in `utils/speedOrder.js` dalla sessione F-1. Qui c'era una
  // copia, in `SlotEditor.jsx` una terza, e le tre non davano la stessa
  // risposta sulla stessa abilità.
  const speedWeatherActive = speedWeatherAttiva(ability, weather)

  if (SPEED_WEATHER_ABILITIES[key]) {
    return (
      <div className={`mt-1 px-1 py-1 rounded text-xs border ${
        speedWeatherActive
          ? 'bg-green-950/40 border-green-700/40 text-green-300'
          : 'bg-gray-800/60 border-gray-700/40 text-gray-500'
      }`}>
        {speedWeatherActive
          ? `⚡ ${t(`abilities_desc_on.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOn })}`
          : `💡 ${t(`abilities_desc_off.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOff })}`}
      </div>
    )
  }

  if (key === 'flash-fire') {
    return (
      <div className="flex items-center gap-2 mt-1 px-1 py-1 bg-red-950/30 border border-red-800/30 rounded text-xs">
        <button
          type="button"
          onClick={() => onFlagChange('flashFireActive', !flags.flashFireActive)}
          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
            flags.flashFireActive ? 'bg-red-500' : 'bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
            flags.flashFireActive ? 'left-4' : 'left-0.5'
          }`} />
        </button>
        <span className={flags.flashFireActive ? 'text-red-300' : 'text-gray-500'}>
          {flags.flashFireActive
            ? t(`abilities_desc_on.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOn })
            : t(`abilities_desc_off.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOff })}
        </span>
      </div>
    )
  }

  if (key === 'multiscale' || key === 'shadow-shield') {
    return (
      <div className="flex items-center gap-2 mt-1 px-1 py-1 bg-blue-950/30 border border-blue-800/30 rounded text-xs">
        <button
          type="button"
          onClick={() => onFlagChange('multiscaleActive', !flags.multiscaleActive)}
          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
            flags.multiscaleActive ? 'bg-blue-500' : 'bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
            flags.multiscaleActive ? 'left-4' : 'left-0.5'
          }`} />
        </button>
        <span className={flags.multiscaleActive ? 'text-blue-300' : 'text-gray-500'}>
          {flags.multiscaleActive
            ? t(`abilities_desc_on.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOn })
            : t(`abilities_desc_off.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOff })}
        </span>
      </div>
    )
  }

  if (key === 'supreme-overlord') {
    const kos  = flags.supremeOverlordKOs || 0
    const mult = (1 + kos * 0.1).toFixed(1)
    return (
      <div className="flex items-center gap-2 mt-1 px-1 py-1 bg-purple-950/30 border border-purple-800/30 rounded text-xs">
        <span className="text-gray-400 shrink-0">{t('editor.allies_ko')}</span>
        <div className="flex gap-1">
          {[0,1,2,3,4,5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onFlagChange('supremeOverlordKOs', n)}
              className={`w-5 h-5 rounded text-[10px] font-bold transition-colors ${
                kos === n ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className={kos > 0 ? 'text-purple-300' : 'text-gray-500'}>
          {kos > 0 ? `×${mult} Atk/SpAtk` : 'nessun boost'}
        </span>
      </div>
    )
  }

  if (key === 'intimidate') {
    return (
      <div className="flex items-center gap-2 mt-1 px-1 py-1 bg-yellow-950/30 border border-yellow-800/30 rounded text-xs">
        <button
          type="button"
          onClick={() => onFlagChange('intimidateActive', !flags.intimidateActive)}
          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
            flags.intimidateActive ? 'bg-yellow-500' : 'bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
            flags.intimidateActive ? 'left-4' : 'left-0.5'
          }`} />
        </button>
        <span className={flags.intimidateActive ? 'text-yellow-300' : 'text-gray-500'}>
          {flags.intimidateActive
            ? t(`abilities_desc_on.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOn })
            : t(`abilities_desc_off.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOff })}
        </span>
      </div>
    )
  }

  if (key === 'defiant' || key === 'contrary') {
    return (
      <div className={`mt-1 px-1 py-1 rounded text-xs border ${
        opponentHasIntimidateActive
          ? 'bg-green-950/40 border-green-700/40 text-green-300'
          : 'bg-gray-800/60 border-gray-700/40 text-gray-500'
      }`}>
        {opponentHasIntimidateActive
          ? `✅ ${t(`abilities_desc_on.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOn })}`
          : `💡 ${t(`abilities_desc_off.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOff })}`}
      </div>
    )
  }

  if (key === 'competitive') {
    return (
      <div className={`mt-1 px-1 py-1 rounded text-xs border ${
        opponentHasIntimidateActive
          ? 'bg-pink-950/40 border-pink-700/40 text-pink-300'
          : 'bg-gray-800/60 border-gray-700/40 text-gray-500'
      }`}>
        {opponentHasIntimidateActive
          ? `✅ ${t(`abilities_desc_on.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOn })}`
          : `💡 ${t(`abilities_desc_off.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOff })}`}
      </div>
    )
  }

  // ── Box informativi statici ────────────────────────────────────────────────
  const abilityEffect = ABILITY_EFFECTS[key]
  if (abilityEffect?.desc) {
    const COLOR_MAP = {
      'huge-power':   'bg-red-950/30 border-red-800/30 text-red-300',
      'pure-power':   'bg-red-950/30 border-red-800/30 text-red-300',
      'adaptability': 'bg-teal-950/30 border-teal-800/30 text-teal-300',
      'fire-mane':    'bg-orange-950/30 border-orange-800/30 text-orange-300',
      'tough-claws':  'bg-yellow-950/30 border-yellow-800/30 text-yellow-300',
      'thick-fat':    'bg-blue-950/30 border-blue-800/30 text-blue-300',
      'filter':       'bg-indigo-950/30 border-indigo-800/30 text-indigo-300',
      'solid-rock':   'bg-indigo-950/30 border-indigo-800/30 text-indigo-300',
      'fluffy':       'bg-pink-950/30 border-pink-800/30 text-pink-300',
      'levitate':     'bg-sky-950/30 border-sky-800/30 text-sky-300',
    }
    const colorCls = COLOR_MAP[key] || 'bg-gray-800/60 border-gray-700/40 text-gray-500'
    return (
      <>
        <div className={`mt-1 px-1 py-1 rounded text-xs border ${colorCls}`}>
          💡 {t(`abilities_desc.${key}`, { defaultValue: abilityEffect.desc })}
        </div>
        {/* Il caso peggiore per la fiducia: una descrizione tradotta che
            promette un effetto, e un numero che non si muove. Il badge sta
            sotto la descrizione, non al suo posto — la descrizione dice cosa
            fa nel gioco, il badge dice che noi non la calcoliamo. */}
        {abilitaNonCalcolata(ability) && <div className="mt-1"><BadgeNonCalcolata tipo="ability" /></div>}
      </>
    )
  }

  // Nessuna voce in ABILITY_EFFECTS: fino a F-2 qui l'interfaccia non diceva
  // niente. Per 228 abilità su 310 il silenzio era l'unica risposta — né una
  // descrizione, né un avviso. Adesso, se il riferimento la calcola, lo diciamo.
  if (abilitaNonCalcolata(ability)) {
    return <div className="mt-1"><BadgeNonCalcolata tipo="ability" /></div>
  }

  return null
}