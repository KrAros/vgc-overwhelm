// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

// Solo `normalizeAbilityKey`: da T il componente NON legge più testo dal file
// di meccaniche. Le descrizioni vivono nei file di traduzione, e basta.
import { normalizeAbilityKey } from '../../data/abilityEffects.js'
import { ABILITA_ATE, tipoPallaClima } from '../../lib/rules.js'
import { TYPES } from '../../data/typeChart.js'
import movesData from '../../data/moves.json'
import { SPEED_WEATHER_ABILITIES, speedWeatherAttiva } from '../../utils/speedOrder.js'
import { abilitaNonCalcolata } from '../../lib/gap.js'
import BadgeNonCalcolata, { SegnalinoNonCalcolata } from './BadgeNonCalcolata.jsx'
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
const SPENTO = 'bg-gray-800/60 border-gray-700/40 text-gray-400'
const ACCESO = 'bg-green-950/40 border-green-700/40 text-green-300'

/** Testo dentro un riquadro con la levetta, che ha il proprio fondo. */
const TESTO_ACCESO = 'text-green-300'
const TESTO_SPENTO = 'text-gray-400'

/** La levetta: verde accesa, grigia spenta. */
const PERNO_ACCESO = 'bg-green-500'
const PERNO_SPENTO = 'bg-gray-600'

// ─── AbilityFlags ─────────────────────────────────────────────────────────────

export default function AbilityFlags({ ability, flags, opponentHasIntimidateActive, onFlagChange, weather, moves }) {
  const { t, i18n } = useTranslation()
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
          ? `⚡ ${t(`abilities_desc_on.${key}`)}`
          : `💡 ${t(`abilities_desc_off.${key}`)}`}
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
            ? t(`abilities_desc_on.${key}`)
            : t(`abilities_desc_off.${key}`)}
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
            ? t(`abilities_desc_on.${key}`)
            : t(`abilities_desc_off.${key}`)}
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
          {/* Era `'nessun boost'`, scritto in italiano dentro il JSX: un utente
              inglese lo leggeva così. `traduzioni.test.js` non poteva vederlo —
              sorveglia i file di traduzione, non le stringhe scritte nei
              componenti. È la famiglia di difetti della sessione M, trovata
              qui mentre si guardavano i colori.

              `×1,3 Atk/SpAtk` resta com'è: sono le sigle delle statistiche,
              che il progetto tiene in inglese per decisione dichiarata. */}
          {kos > 0 ? `×${mult} Atk/SpAtk` : t('editor.no_boost')}
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
            ? t(`abilities_desc_on.${key}`)
            : t(`abilities_desc_off.${key}`)}
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
          ? `✅ ${t(`abilities_desc_on.${key}`)}`
          : `💡 ${t(`abilities_desc_off.${key}`)}`}
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
          ? `✅ ${t(`abilities_desc_on.${key}`)}`
          : `💡 ${t(`abilities_desc_off.${key}`)}`}
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
        {/* Il segnalino sta DENTRO il riquadro, all'estremità destra: prima era
            un secondo blocco sotto, e aggiungeva 40 px che facevano scendere
            cursori e mosse a ogni cambio di abilità. */}
        <div className={`mt-1 px-1 py-1 rounded text-xs border flex items-start min-h-[3.625rem] min-[480px]:min-h-[2.625rem] ${attiva ? ACCESO : SPENTO}`}>
          <span className="min-w-0 flex-1">
            {attiva ? '✅ ' : '💡 '}
            {t(`abilities_desc.${key}`)}
          </span>
          {abilitaNonCalcolata(ability) && <SegnalinoNonCalcolata tipo="ability" />}
        </div>
      </>
    )
  }

  /* ─── L'ALTEZZA E' RISERVATA, COSI' IL RESTO NON BALLA ────────────────────
   *
   * Le descrizioni vanno da 20 a 173 caratteri, e il riquadro cresceva con
   * loro: cambiando abilita', cursori e mosse scendevano di colpo. E' lo
   * stesso difetto che il segnalino aveva gia' causato una volta, spostato
   * dal segnalino al testo.
   *
   * Ridurre il font non lo risolve, ed e' stato misurato prima di scartarlo:
   * per far stare la descrizione piu' lunga nell'altezza della piu' corta
   * servirebbe un terzo del corpo, da 12 px a 4. Anche solo passare da tre
   * righe a due chiede ~9,6 px e lascerebbe comunque uno scarto di una riga.
   * Il font attenua, non chiude.
   *
   * Quello che chiude e' riservare lo spazio. Le due soglie vengono da una
   * misura su tutte e 396 le descrizioni (198 per lingua), nel riquadro vero
   * dell'editor:
   *
   *   riquadro 270 px (viewport 320)   1r 12% · 2r 55% · 3r 28% · 4r 4% · 5r 0,5%
   *   riquadro 310 px (viewport 360)   1r 19% · 2r 63% · 3r 17% · 4r 1%
   *   riquadro 462 px (viewport 1024)  1r 54% · 2r 45% · 3r 1%
   *
   * Tre righe sotto i 480 px coprono il 95,5%; due sopra coprono il 99%.
   * Riservare il massimo assoluto — cinque righe — costerebbe 48 px di vuoto
   * su un telefono, dove la mediana e' due: il vuoto darebbe fastidio piu'
   * dello scostamento residuo, che riguarda 18 descrizioni su 396 e vale una
   * riga sola.
   *
   * La soglia e' 480 px e non un breakpoint di Tailwind perche' la larghezza
   * del riquadro NON cresce col viewport: misurata di 40 in 40 px, a 1040 il
   * layout passa a due colonne e il riquadro crolla da 942 a 470. Sotto i 400
   * px il riquadro sta solo fino a 440 di viewport, quindi 480 separa i due
   * regimi da entrambe le parti. */
  // ── Box informativi statici ────────────────────────────────────────────────
  /* L'interruttore era la PRESENZA di `desc` in ABILITY_EFFECTS, cioè un campo
     di testo dentro una tabella di meccaniche usato come flag. Ora è la
     presenza della chiave nel file di traduzione, che è dove il testo vive.

     `i18n.exists` ricade sull'inglese, quindi una descrizione presente solo lì
     conta comunque — ed è il comportamento giusto: meglio in inglese che
     assente. Verificato che i due insiemi coincidano prima di cambiare
     criterio: 198 e 198, zero chiavi da una parte sola. */
  if (i18n.exists(`abilities_desc.${key}`)) {
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
        {/* Il caso peggiore per la fiducia: una descrizione tradotta che
            promette un effetto, e un numero che non si muove. Il segnalino sta
            NELLA stessa riga della descrizione, non al suo posto — la
            descrizione dice cosa fa nel gioco, il segnalino dice che noi non
            la calcoliamo. */}
        <div className={`mt-1 px-1 py-1 rounded text-xs border flex items-start min-h-[3.625rem] min-[480px]:min-h-[2.625rem] ${SPENTO}`}>
          <span className="min-w-0 flex-1">💡 {t(`abilities_desc.${key}`)}</span>
          {abilitaNonCalcolata(ability) && <SegnalinoNonCalcolata tipo="ability" />}
        </div>
      </>
    )
  }

  // Nessuna descrizione per questa abilità: fino a F-2 qui l'interfaccia non diceva
  // niente. Per 228 abilità su 310 il silenzio era l'unica risposta — né una
  // descrizione, né un avviso. Adesso, se il riferimento la calcola, lo diciamo.
  if (abilitaNonCalcolata(ability)) {
    return <div className="mt-1"><BadgeNonCalcolata tipo="ability" /></div>
  }

  return null
}