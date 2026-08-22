// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { useState } from 'react'
import { STAT_NAMES } from '../../utils/statCalc'
import pokemonData from '../../data/pokemon.json'
import movesData   from '../../data/moves.json'
import useCalcStore from '../../store/useCalcStore'
import { NATURES, NATURE_MODIFIERS } from '../../data/natures.js'
import { TYPE_NAMES, TYPE_COLORS } from '../../data/typeChart.js'
import { spriteUrl, fallbackSpriteUrl } from '../../utils/sprite'
import { speedWeatherAttiva } from '../../utils/speedOrder.js'
import { MAX_SP_TOTAL, MAX_SP_PER_STAT } from '../../lib/rules.js'




import PresetSelect, { CustomSetModal } from './PresetSelect.jsx'
import StatRow from './StatRow.jsx'
import { PokemonSearch, MoveSearch, ItemSearch, AbilitySelect } from './SearchSelects.jsx'
import { useTranslation } from 'react-i18next'
import AbilityFlags from './AbilityFlags.jsx'
import BadgeNonCalcolata from './BadgeNonCalcolata.jsx'
import { strumentoNonCalcolato } from '../../lib/gap.js'
import { slotToShowdown } from './showdownHelpers.js'
import { ImportModal, DuplicateModal } from './Modals.jsx'

// ─── PokemonPanel ─────────────────────────────────────────────────────────────

export default function PokemonPanel({ team, index, tailwindActive = false }) {
  const { t } = useTranslation()
  const pokemon        = useCalcStore(s => s[team][index])
  const level          = useCalcStore(s => s.level)
  const setPokemon     = useCalcStore(s => s.setPokemon)
  const setNature      = useCalcStore(s => s.setNature)
  const setSPs         = useCalcStore(s => s.setSPs)
  const setMove        = useCalcStore(s => s.setMove)
  const setBoost       = useCalcStore(s => s.setBoost)
  const setItem        = useCalcStore(s => s.setItem)
  const setAbility     = useCalcStore(s => s.setAbility)
  const setAbilityFlag       = useCalcStore(s => s.setAbilityFlag)
  const setLastRespectsKOs   = useCalcStore(s => s.setLastRespectsKOs)
  const setDoubleTarget = useCalcStore(s => s.setDoubleTarget)
  const weather        = useCalcStore(s => s.weather)

  const [showImport,     setShowImport]     = useState(false)
  const [showDuplicate,  setShowDuplicate]  = useState(false)
  const [exportCopied,   setExportCopied]   = useState(false)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customRev,      setCustomRev]      = useState(0)

  const data         = pokemonData[pokemon?.key]
  const sps          = pokemon?.sps || [0,0,0,0,0,0]
  const nature       = pokemon?.nature || null
  const item         = pokemon?.item || null
  const ability      = pokemon?.ability || null
  const abilityFlags     = pokemon?.abilityFlags || {}
  const lastRespectsKOs  = pokemon?.lastRespectsKOs ?? 0
  const hasLastRespects  = pokemon?.moves?.some(m => m === 'last respects')
  const total        = sps.reduce((a,b) => a+b, 0)
  const remaining    = MAX_SP_TOTAL - total

  const opponentTeam = useCalcStore(s => s[team === 'team1' ? 'team2' : 'team1'])
  const opponentHasIntimidateActive = opponentTeam.some(
    p => p?.ability?.toLowerCase() === 'intimidate' && p?.abilityFlags?.intimidateActive
  )

  const boostFields = [null,'atkBoost','defBoost','spAtkBoost','spDefBoost','speBoost']

  const handleSp = (i, val) => {
    const newVal = Math.min(MAX_SP_PER_STAT, Math.max(0, val))
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
    // Svuotare una mossa NON tocca il numero di nemici in campo. Scegliere una
    // mossa singola lo fa apposta — dice «questa colpisce uno solo» — ma
    // toglierla non dice niente sull'area, e cambiare una condizione di campo
    // premendo una X sarebbe un effetto invisibile a chi la preme.
    if (!m) return
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
      {/* `gap-2.5` invece di `gap-1.5`: da 6 a 10 px fra i bottoni.
          Segnalato guardando l'app — «Duplica ed Esporta si toccano». Non è
          un difetto misurabile: passano WCAG 2.5.8, perché la norma chiede
          se si riesce a colpirli e non se sembrano stretti. Le due domande
          sono diverse, e per la seconda l'unico strumento è l'occhio. */}
      <div className="flex justify-end gap-2.5 mb-2.5 text-xs">

            {/* Salva Custom Set — visibile solo se c'è un Pokémon nello slot */}
            {data && (
              <button
                type="button"
                onClick={() => setShowCustomModal(true)}
                className="flex items-center justify-center gap-1 px-2.5 py-1 rounded border transition bg-amber-900/30 hover:bg-amber-900/60 text-amber-300 border-amber-700/40"
                title={t('editor.manage_custom_sets')}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>{t('editor.manage_custom_sets')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={data ? handleDuplicate : undefined}
              disabled={!data}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ${
                !data ? 'bg-gray-800/40 border-gray-700/20 text-gray-400 cursor-not-allowed'
                : showDuplicate ? 'bg-teal-800 border-teal-600 text-teal-200'
                : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'
              }`}
              title={t("editor.duplicate_pokemon")}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              <span>{t("editor.duplicate")}</span>
            </button>

            <button
              type="button"
              onClick={data ? handleExport : undefined}
              disabled={!data}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ${
                !data ? 'bg-gray-800/40 border-gray-700/20 text-gray-400 cursor-not-allowed'
                : exportCopied ? 'bg-green-800 border-green-600 text-green-200'
                : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'
              }`}
              title={t("editor.export_showdown")}
            >
              {!exportCopied && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
              <span>{exportCopied ? t('ui.copied') : t('ui.export')}</span>
            </button>

            <button
              type="button"
              onClick={handleImport}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ${
                showImport
                  ? 'bg-teal-800 border-teal-600 text-teal-200'
                  : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'
              }`}
              title={t("editor.import_showdown")}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{t("ui.import")}</span>
            </button>

            <button
              type="button"
              onClick={data ? () => { setPokemon(team, index, ''); setAbility(team, index, '') } : undefined}
              disabled={!data}
              className={`flex items-center justify-center gap-1 w-20 py-1 rounded border transition ${
                !data ? 'bg-gray-800/40 border-gray-700/20 text-gray-400 cursor-not-allowed'
                : 'bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border-red-900/30'
              }`}
              title={t("editor.delete_pokemon")}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{t("ui.delete")}</span>
            </button>
          </div>

      {/* Pannelli inline: Importa / Duplica */}
      {showImport && (
        <ImportModal team={team} index={index} onClose={() => setShowImport(false)} />
      )}
      {showDuplicate && data && (
        <DuplicateModal team={team} sourceIndex={index} onClose={() => setShowDuplicate(false)} />
      )}
      {showCustomModal && data && pokemon?.key && (
        <CustomSetModal
          slug={pokemon.key}
          currentSlot={pokemon}
          onClose={() => setShowCustomModal(false)}
          onChanged={() => setCustomRev(r => r + 1)}
        />
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
          {/* `flex-wrap` solo sotto `sm`: la tendina del set va a capo, i badge
              dei tipi restano accanto alla ricerca. `order-last` serve a questo
              — senza, sarebbero i badge a finire sulla terza riga.

              A 360 px questa riga stringeva il set a 3-23 px di testo, cioè
              «Set v» delle foto. La ricerca prende un terzo e i badge dei tipi
              non si comprimono: quello che restava era tutto per la tendina. */}
          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
            {/* Su telefono metà riga invece di un terzo: a 360 px un terzo vale
                78 px e «flutter-mane» ne chiede 98 — è il «Charizard·» delle
                foto. Lo spazio c'è perché in P-2/5 la tendina del set è andata
                a capo, lasciando la prima riga alla ricerca e ai badge. */}
            <div className={pokemon?.key ? "w-1/2 sm:w-1/3 shrink-0" : "flex-1"}>
              <PokemonSearch value={pokemon?.key} onChange={handlePokemonChange} />
            </div>
            {pokemon?.key && (
              <>
                <div className="w-full order-last sm:order-0 sm:w-auto sm:flex-1 min-w-0">
                  <PresetSelect team={team} index={index} currentSlug={pokemon?.key} currentSlot={pokemon} externalRev={customRev} />
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
                        {t(`types.${typeName}`, { defaultValue: typeName })}
                      </span>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          {data && (
            /* Su telefono i tre controlli si impilano invece di dividersi la
               riga in tre. A 360 px un terzo vale ~93 px, che meno il padding e
               la freccia lascia 53 px di testo: «Decisa (+Atk, -SpA)» ne chiede
               152 e «Corpo Aureo» 96. Tre colonne non possono funzionare a
               questa larghezza con nessuna dimensione di carattere leggibile —
               misurato su tutte le nature e le abilità, non stimato.

               Una tendina troppo stretta NON si vede col criterio del testo
               tagliato: il browser clippa da sé l'opzione scelta e scrollWidth
               resta uguale a clientWidth. Serve la misura aggiunta in P-2/4. */
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <div className="w-full sm:w-1/3">
                <AbilitySelect value={ability} abilities={data?.abilities} onChange={a => setAbility(team, index, a)} />
              </div>
              <div className="w-full sm:w-1/3">
                <select
                  className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none capitalize"
                  aria-label={t('aria.nature')}
                  value={nature || ''}
                  onChange={e => setNature(team, index, e.target.value || null)}
                >
                  <option value="">{t('ui.nature_neutral')}</option>
                  {NATURES.map(n => {
                    const STAT_LABELS = ['','Atk','Def','SpA','SpD','Spe']
                    const mod = NATURE_MODIFIERS[n]
                    const displayName = t(`natures.${n}`, { defaultValue: n.charAt(0).toUpperCase()+n.slice(1) })
                    const label = mod && mod[0] !== 0
                      ? `${displayName} (+${STAT_LABELS[mod[0]]}, -${STAT_LABELS[mod[1]]})`
                      : displayName
                    return <option key={n} value={n}>{label}</option>
                  })}
                </select>
              </div>
              <div className="w-full sm:w-1/3">
                <ItemSearch value={item} onChange={m => setItem(team, index, m)} />
                {/* Gli strumenti non hanno un pannello descrittivo come le
                    abilità: il badge va attaccato direttamente alla tendina. */}
                {strumentoNonCalcolato(item) && (
                  <div className="mt-1"><BadgeNonCalcolata tipo="item" /></div>
                )}
              </div>
            </div>
          )}
          {data && ability && (
            <AbilityFlags
              ability={ability}
              moves={pokemon?.moves}
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
            <div className="flex items-center text-xs text-gray-400 mb-1 gap-2">
              <span className="w-8 text-center">{t("report.stat")}</span>
              <span className="w-7 text-center">{t("report.base")}</span>
              <div className="flex-1 flex justify-center items-center gap-1.5">
                <span>SP</span>
                <span className={`text-[10px] font-bold px-1 rounded ${
                  remaining === 0
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {/* Mostrava `remaining`: «(0/66)» voleva dire set COMPLETO,
                      non set vuoto. È l'unico numero dell'app che andava letto
                      al contrario, e nessuno legge «57/66» come «57 rimasti».
                      Ora dice gli SP USATI, che è la lettura naturale. */}
                  ({total}/{MAX_SP_TOTAL})
                </span>
              </div>
              <span className="w-8 text-center">{t("report.tot")}</span>
              <span className="w-12 text-center">{t("report.boost")}</span>
              <span className="w-8 text-center">{t("report.mod")}</span>
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
                speedWeatherActive={speedWeatherAttiva(ability, weather)}
                tailwindActive={i === 5 && tailwindActive}
              />
            ))}
          </div>

          {/* Una colonna su telefono. Misurato: con due colonne ogni cella è
              larga 152 px, ma gli altri elementi (badge del tipo, potenza) ne
              consumano circa 126 e al campo di testo restano 26-50 px — cioè
              «Lanciafia» delle foto. A colonna singola la cella vale 310 px e
              il campo ne prende ~184, che basta a «Lanciafiamme» (95 px).

              Costa altezza: quattro righe invece di due. È lo stesso scambio
              accettato per StatRow e per le celle della matrice — non
              nascondere l'informazione si paga in verticale. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
            {[0,1,2,3].map(mi => (
              <MoveSearch
                key={mi}
                value={pokemon?.moves[mi]}
                placeholder={`${t('editor.move_slot')} ${mi+1}`}
                onChange={m => handleMoveChange(mi, m)}
                ability={ability}
              />
            ))}
          </div>

          {/* Last Respects: contatore alleati KO */}
          {hasLastRespects && (
            <div className="flex items-center gap-2 mt-1.5 px-1 py-1 bg-purple-950/30 border border-purple-800/30 rounded text-xs">
              <span className="text-gray-400 shrink-0">{t("editor.last_respects_allies")}</span>
              <div className="flex gap-1">
                {[0,1,2,3].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLastRespectsKOs(team, index, n)}
                    className={`w-5 h-5 rounded text-[10px] font-bold transition-colors ${
                      lastRespectsKOs === n ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className={lastRespectsKOs > 0 ? 'text-purple-300' : 'text-gray-400'}>
                {50 + lastRespectsKOs * 50} BP
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}