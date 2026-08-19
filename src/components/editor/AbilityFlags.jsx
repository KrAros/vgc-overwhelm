// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { ABILITY_EFFECTS, normalizeAbilityKey } from '../../data/abilityEffects.js'
import { ABILITA_ATE, tipoPallaClima } from '../../lib/rules.js'
import { TYPES } from '../../data/typeChart.js'
import movesData from '../../data/moves.json'
import { SPEED_WEATHER_ABILITIES, speedWeatherAttiva } from '../../utils/speedOrder.js'
import { abilitaNonCalcolata } from '../../lib/gap.js'
import BadgeNonCalcolata from './BadgeNonCalcolata.jsx'
import { useTranslation } from 'react-i18next'

// ─── La tavolozza ─────────────────────────────────────────────────────────────

/**
 * ─── IL COLORE DICE LO STATO, NON COSA FA L'ABILITÀ ────────────────────────
 *
 * Prima della sessione Q convivevano tre convenzioni, e la fotografia in
 * `coloriAbilita.test.jsx` le ha misurate:
 *
 *   guidati dallo stato   chlorophyll, defiant, competitive
 *   colore FISSO          flash fire, multiscale, supreme overlord, intimidate
 *                         — stesso colore acceso e spento: la levetta si
 *                         muoveva e il riquadro no
 *   semantici             dieci abilità colorate per «cosa fanno», su 198
 *
 * E `competitive` si accendeva di ROSA nella stessa identica condizione in cui
 * `defiant` si accende di verde.
 *
 * Il problema di fondo: il colore provava a dire due cose insieme — che tipo
 * di effetto è, e se è attivo. Due assi che si contendono un canale solo.
 *
 * Un canale, un asse. E fra i due quello che serve mentre si calcola è lo
 * stato: «questo effetto sta toccando il numero che sto guardando?». Il *cosa
 * fa* è già scritto in lettere dentro il riquadro.
 *
 * ─── PERCHÉ SOLO DUE, E NON UNA SCALA ─────────────────────────────────────
 *
 * Il verde marca ciò che può CAMBIARE mentre lavori: meteo, levetta,
 * avversario, moveset. Le abilità sempre attive — Huge Power, Adaptability,
 * Levitate — restano grigie, e non per svista: dire «verde = tocca il numero»
 * anche per loro richiederebbe di classificare a mano 198 abilità, cioè
 * esattamente la tabella scritta a mano che in questo progetto è già marcita
 * tre volte (il badge prima di F-3, le etichette prima di M, gli sprite prima
 * di L). Grigio qui significa «nessuno stato che sappiamo calcolare», non
 * «inattiva» — ed è un limite dichiarato, non nascosto.
 *
 * L'ambra del badge «non calcolata» è il terzo valore e sta in
 * `BadgeNonCalcolata.jsx`: non descrive un effetto, avverte che non lo
 * calcoliamo.
 */
const SPENTO = 'bg-gray-800/60 border-gray-700/40 text-gray-500'
const ACCESO = 'bg-green-950/40 border-green-700/40 text-green-300'

/** Testo dentro un riquadro con la levetta, che ha il proprio fondo. */
const TESTO_ACCESO = 'text-green-300'
const TESTO_SPENTO = 'text-gray-500'

/** La levetta: verde accesa, grigia spenta. */
const PERNO_ACCESO = 'bg-green-500'
const PERNO_SPENTO = 'bg-gray-600'

// ─── AbilityFlags ─────────────────────────────────────────────────────────────

export default function AbilityFlags({ ability, flags, opponentHasIntimidateActive, onFlagChange, weather, moves }) {
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
          ? ACCESO
          : SPENTO
      }`}>
        {speedWeatherActive
          ? `⚡ ${t(`abilities_desc_on.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOn })}`
          : `💡 ${t(`abilities_desc_off.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOff })}`}
      </div>
    )
  }

  if (key === 'flash-fire') {
    return (
      <div className={`flex items-center gap-2 mt-1 px-1 py-1 rounded text-xs border ${flags.flashFireActive ? ACCESO : SPENTO}`}>
        <button
          type="button"
          onClick={() => onFlagChange('flashFireActive', !flags.flashFireActive)}
          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
            flags.flashFireActive ? PERNO_ACCESO : PERNO_SPENTO
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
            flags.flashFireActive ? 'left-4' : 'left-0.5'
          }`} />
        </button>
        <span className={flags.flashFireActive ? TESTO_ACCESO : TESTO_SPENTO}>
          {flags.flashFireActive
            ? t(`abilities_desc_on.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOn })
            : t(`abilities_desc_off.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOff })}
        </span>
      </div>
    )
  }

  if (key === 'multiscale' || key === 'shadow-shield') {
    return (
      <div className={`flex items-center gap-2 mt-1 px-1 py-1 rounded text-xs border ${flags.multiscaleActive ? ACCESO : SPENTO}`}>
        <button
          type="button"
          onClick={() => onFlagChange('multiscaleActive', !flags.multiscaleActive)}
          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
            flags.multiscaleActive ? PERNO_ACCESO : PERNO_SPENTO
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
            flags.multiscaleActive ? 'left-4' : 'left-0.5'
          }`} />
        </button>
        <span className={flags.multiscaleActive ? TESTO_ACCESO : TESTO_SPENTO}>
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
      <div className={`flex items-center gap-2 mt-1 px-1 py-1 rounded text-xs border ${kos > 0 ? ACCESO : SPENTO}`}>
        <span className="text-gray-400 shrink-0">{t('editor.allies_ko')}</span>
        <div className="flex gap-1">
          {[0,1,2,3,4,5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onFlagChange('supremeOverlordKOs', n)}
              className={`w-5 h-5 rounded text-[10px] font-bold transition-colors ${
                kos === n ? `${PERNO_ACCESO} text-white` : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className={kos > 0 ? TESTO_ACCESO : TESTO_SPENTO}>
          {kos > 0 ? `×${mult} Atk/SpAtk` : 'nessun boost'}
        </span>
      </div>
    )
  }

  if (key === 'intimidate') {
    return (
      <div className={`flex items-center gap-2 mt-1 px-1 py-1 rounded text-xs border ${flags.intimidateActive ? ACCESO : SPENTO}`}>
        <button
          type="button"
          onClick={() => onFlagChange('intimidateActive', !flags.intimidateActive)}
          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${
            flags.intimidateActive ? PERNO_ACCESO : PERNO_SPENTO
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
            flags.intimidateActive ? 'left-4' : 'left-0.5'
          }`} />
        </button>
        <span className={flags.intimidateActive ? TESTO_ACCESO : TESTO_SPENTO}>
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
          ? ACCESO
          : SPENTO
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
          ? ACCESO
          : SPENTO
      }`}>
        {opponentHasIntimidateActive
          ? `✅ ${t(`abilities_desc_on.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOn })}`
          : `💡 ${t(`abilities_desc_off.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.descOff })}`}
      </div>
    )
  }

  /**
   * ─── LE ABILITÀ «-ATE» ───────────────────────────────────────────────────
   *
   * Pixilate, Aerilate, Refrigerate e Dragonize trasformano le mosse Normali.
   * Il loro stato non dipende dal campo né da una levetta: dipende dal
   * MOVESET. Se il set non ha nessuna mossa Normale, l'abilità è del tutto
   * inerte — e prima di Q quell'errore di costruzione era invisibile, perché
   * il riquadro era grigio esattamente come quando lavorava.
   *
   * Palla Clima va chiesta a `tipoPallaClima`, non al tipo scritto nei dati:
   * sotto il sole è Fuoco, e il motore applica le -ate solo se il tipo È
   * ancora Normale dopo la conversione del meteo (`calcEngine.js`, in
   * quest'ordine). Guardare il tipo base direbbe «verde» su un set in cui
   * l'abilità non tocca niente.
   */
  if (ABILITA_ATE[key] !== undefined) {
    const attiva = (moves || []).some((m) => {
      if (!m) return false
      // Le mosse di stato sono escluse. Protect è di tipo Normale e
      // categoria 2: l'abilità gliene cambierebbe il tipo, ma Protect non fa
      // danno, quindi nessun numero si muove. Il verde di questa tavolozza
      // significa «sta toccando il numero che stai guardando», e su una mossa
      // di stato sarebbe una promessa che non si mantiene.
      if (movesData[m]?.category === 2) return false
      const tipo = tipoPallaClima(m, weather) ?? movesData[m]?.type
      return tipo === TYPES.NORMAL
    })
    return (
      <>
        <div className={`mt-1 px-1 py-1 rounded text-xs border ${attiva ? ACCESO : SPENTO}`}>
          {attiva ? '✅ ' : '💡 '}
          {t(`abilities_desc.${key}`, { defaultValue: ABILITY_EFFECTS[key]?.desc })}
          {!attiva && <> — {t('ui.ate_inerte')}</>}
        </div>
        {abilitaNonCalcolata(ability) && <div className="mt-1"><BadgeNonCalcolata tipo="ability" /></div>}
      </>
    )
  }

  // ── Box informativi statici ────────────────────────────────────────────────
  const abilityEffect = ABILITY_EFFECTS[key]
  if (abilityEffect?.desc) {
    /* Qui c'era una COLOR_MAP con dieci voci: dieci abilità colorate per «cosa
       fanno» — rosso chi moltiplica l'Attacco, blu e indaco chi riduce il danno
       — e le altre 188 grigie per esclusione.
    
       Il colore era quindi l'ECCEZIONE, non la regola: dieci su centonovantotto.
       E collideva con l'altro asse — il giallo era sia Tough Claws, che
       descrive, sia Intimidate, che ha una levetta.
    
       Un riquadro statico non ha uno stato da mostrare, quindi non ha un colore
       da usare. */
    return (
      <>
        <div className={`mt-1 px-1 py-1 rounded text-xs border ${SPENTO}`}>
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