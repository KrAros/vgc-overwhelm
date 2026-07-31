import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useCalcStore, { encodeTeamsToURL } from '../store/useCalcStore'
import useFieldState from '../hooks/useFieldState'
import { parseShowdownPaste, teamToShowdown } from '../utils/showdownIO'
import { spriteUrl, fallbackSpriteUrl } from '../utils/sprite'
import pokemonData from '../data/pokemon.json'
import { PRESETS_BY_SLUG } from '../data/metaPresets'

// ── Costanti localStorage ──────────────────────────────────────────────────
const LS_SAVED_TEAMS = 'sixth_ember_saved_teams'
const MAX_SAVED_TEAMS = 20

// ── Helpers localStorage per team salvati ──────────────────────────────────

function loadSavedTeams() {
  try {
    const raw = localStorage.getItem(LS_SAVED_TEAMS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistSavedTeams(teams) {
  try {
    localStorage.setItem(LS_SAVED_TEAMS, JSON.stringify(teams))
  } catch { /* storage pieno */ }
}

// ── Normalizzazione nome Pokémon → slug ────────────────────────────────────
// Usata in Feature 3 (import da nomi)

function normalizePokeName(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/**
 * Cerca uno slug in pokemon.json a partire da un nome libero dell'utente.
 * Prova: slug esatto, poi con spazi→trattini, poi match parziale sul campo name.
 */
function findPokemonSlug(name) {
  const slug = normalizePokeName(name)
  if (pokemonData[slug]) return slug
  const spaced = slug.replace(/-/g, ' ')
  const found = Object.entries(pokemonData).find(([k, v]) =>
    v.name?.toLowerCase() === spaced || v.name?.toLowerCase() === slug || k === slug
  )
  return found ? found[0] : null
}

// ── Icons ──────────────────────────────────────────────────────────────────

const IconImport = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)
const IconExport = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
)
const IconReset = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)
const IconShare = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
)
const IconLibrary = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
)

// ── ModBtn ─────────────────────────────────────────────────────────────────

function ModBtn({ label, active, activeClass, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`text-xs px-2 py-1 rounded border transition-colors ${
        active ? activeClass : 'text-gray-400 border-gray-600/40 hover:bg-gray-800/60'
      }`}
    >
      {label}
    </button>
  )
}

// ── TeamLibraryModal ───────────────────────────────────────────────────────
/**
 * Modal overlay per la libreria team.
 *
 * ARCHITETTURA:
 * - Lo stato dei team salvati (savedTeams) è locale al modal: viene caricato
 *   da localStorage all'apertura e riscritto ad ogni modifica.
 * - Non usiamo Zustand per i team salvati perché non serve reattività
 *   cross-component: bastano localStorage + stato locale.
 * - La conferma di eliminazione è inline (deleteConfirm = id del team da
 *   eliminare). Un secondo click sul bottone elimina, un click altrove annulla.
 */
function TeamLibraryModal({ onClose, team1, team2, setTeam }) {
  const { t } = useTranslation()

  const [savedTeams, setSavedTeams]       = useState(() => loadSavedTeams())
  const [nameT1, setNameT1]               = useState('')
  const [nameT2, setNameT2]               = useState('')
  const [errorT1, setErrorT1]             = useState('')
  const [errorT2, setErrorT2]             = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null) // id team in attesa conferma
  const [feedback, setFeedback]           = useState('')

  const flash = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(''), 1800) }

  function saveTeam(slots, name, setName, setError) {
    const trimmed = name.trim()
    if (!trimmed) { setError(t('ui.team_library_name_empty')); return }
    if (trimmed.length > 40) { setError(t('ui.team_library_name_too_long')); return }
    if (savedTeams.length >= MAX_SAVED_TEAMS) { setError(t('ui.team_library_limit')); return }
    setError('')
    const entry = {
      id: Date.now().toString(),
      name: trimmed,
      slots,
      savedAt: new Date().toISOString(),
    }
    const updated = [...savedTeams, entry]
    setSavedTeams(updated)
    persistSavedTeams(updated)
    setName('')
    flash(t('ui.team_library_saved'))
  }

  function deleteTeam(id) {
    if (deleteConfirm === id) {
      const updated = savedTeams.filter(t => t.id !== id)
      setSavedTeams(updated)
      persistSavedTeams(updated)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(id)
    }
  }

  function loadTeam(entry, target) {
    setTeam(target, entry.slots)
    flash(t('ui.team_library_loaded'))
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' })
    } catch { return '' }
  }

  // Componente sprite mini (24px) con fallback
  function MiniSprite({ slotKey }) {
    const [err, setErr] = useState(false)
    if (!slotKey) return <div className="w-6 h-6 rounded bg-gray-700/50" />
    const src = err ? fallbackSpriteUrl(slotKey) : spriteUrl(slotKey)
    return (
      <img
        src={src}
        alt={slotKey}
        onError={() => setErr(true)}
        className="w-6 h-6 object-contain"
      />
    )
  }

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg mx-3 max-h-[85vh] flex flex-col">

        {/* Header modal */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-700/60 shrink-0">
          <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <IconLibrary />
            {t('ui.team_library')}
          </span>
          {feedback && <span className="text-xs text-green-400">{feedback}</span>}
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-lg leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">

          {/* ── SEZIONE SALVA ─────────────────────────────────────── */}
          <div className="space-y-2">
            {/* Salva Team 1 */}
            <div className="flex gap-2 items-start">
              <input
                className="flex-1 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 outline-none focus:border-teal-500 placeholder-gray-500"
                placeholder={t('ui.team_library_name')}
                maxLength={40}
                value={nameT1}
                onChange={e => { setNameT1(e.target.value); setErrorT1('') }}
              />
              <button
                onClick={() => saveTeam(team1, nameT1, setNameT1, setErrorT1)}
                className="text-xs px-2.5 py-1.5 rounded bg-teal-800 hover:bg-teal-700 border border-teal-600 text-teal-200 whitespace-nowrap shrink-0"
              >
                {t('ui.team_library_save_t1')}
              </button>
            </div>
            {errorT1 && <p className="text-xs text-red-400">{errorT1}</p>}

            {/* Salva Team 2 */}
            <div className="flex gap-2 items-start">
              <input
                className="flex-1 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 outline-none focus:border-teal-500 placeholder-gray-500"
                placeholder={t('ui.team_library_name')}
                maxLength={40}
                value={nameT2}
                onChange={e => { setNameT2(e.target.value); setErrorT2('') }}
              />
              <button
                onClick={() => saveTeam(team2, nameT2, setNameT2, setErrorT2)}
                className="text-xs px-2.5 py-1.5 rounded bg-teal-800 hover:bg-teal-700 border border-teal-600 text-teal-200 whitespace-nowrap shrink-0"
              >
                {t('ui.team_library_save_t2')}
              </button>
            </div>
            {errorT2 && <p className="text-xs text-red-400">{errorT2}</p>}
          </div>

          <div className="h-px bg-gray-700/60" />

          {/* ── SEZIONE CARICA ─────────────────────────────────────── */}
          {savedTeams.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">{t('ui.team_library_empty')}</p>
          ) : (
            <div className="space-y-2">
              {savedTeams.map(entry => (
                <div
                  key={entry.id}
                  className="bg-gray-800/60 rounded-lg border border-gray-700/40 px-3 py-2"
                  onClick={() => { if (deleteConfirm === entry.id) setDeleteConfirm(null) }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div>
                      <span className="text-xs font-medium text-gray-200">{entry.name}</span>
                      <span className="text-[10px] text-gray-500 ml-2">{formatDate(entry.savedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); loadTeam(entry, 'team1') }}
                        className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-teal-900/60 border border-gray-600 text-teal-300 whitespace-nowrap"
                      >
                        {t('ui.team_library_load_t1')}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); loadTeam(entry, 'team2') }}
                        className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-teal-900/60 border border-gray-600 text-teal-300 whitespace-nowrap"
                      >
                        {t('ui.team_library_load_t2')}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteTeam(entry.id) }}
                        className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                          deleteConfirm === entry.id
                            ? 'bg-red-700 border-red-500 text-white'
                            : 'bg-gray-700 hover:bg-red-900/50 border-gray-600 text-red-400'
                        }`}
                      >
                        {deleteConfirm === entry.id
                          ? t('ui.team_library_delete_confirm')
                          : t('ui.team_library_delete')}
                      </button>
                    </div>
                  </div>
                  {/* 6 sprite mini */}
                  <div className="flex gap-1">
                    {(entry.slots || []).map((slot, i) => (
                      <MiniSprite key={i} slotKey={slot?.key} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ControlBar ─────────────────────────────────────────────────────────────

export default function ControlBar() {
  const { t } = useTranslation()
  const campo        = useFieldState()
  const helpingHand  = useCalcStore(s => s.helpingHand)
  const auroraVeil   = useCalcStore(s => s.auroraVeil)
  const lightScreen  = useCalcStore(s => s.lightScreen)
  const reflect      = useCalcStore(s => s.reflect)
  const crit         = useCalcStore(s => s.crit)
  const showKoOnly   = useCalcStore(s => s.showKoOnly)
  const tailwind     = useCalcStore(s => s.tailwind)
  const team1        = useCalcStore(s => s.team1)
  const team2        = useCalcStore(s => s.team2)
  const toggleModifier   = useCalcStore(s => s.toggleModifier)
  const toggleShowKoOnly = useCalcStore(s => s.toggleShowKoOnly)
  const setTeam          = useCalcStore(s => s.setTeam)

  // mode: null | 'import1' | 'import2' — controlla quale pannello import è aperto
  const [mode, setMode]             = useState(null)
  const [pasteText, setPasteText]   = useState('')
  const [warnings, setWarnings]     = useState([])
  const [feedback, setFeedback]     = useState('')
  const [showLibrary, setShowLibrary] = useState(false)

  // Tab dentro il pannello import: 'showdown' | 'names'
  const [importTab, setImportTab]   = useState('showdown')
  // Testo area "Solo nomi"
  const [namesText, setNamesText]   = useState('')
  // Risultati lookup per il tab nomi
  const [namesResults, setNamesResults] = useState([])

  const flash = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(''), 2500) }

  // ── Import Showdown ──────────────────────────────────────────────────────
  function handleImport(targetTeam) {
    const { pokemon, warnings: w } = parseShowdownPaste(pasteText)
    setWarnings(w)
    if (pokemon.length === 0) return
    const slots = Array(6).fill(null).map((_, i) => pokemon[i] || null)
    setTeam(targetTeam, slots)
    flash(t('ui.team_imported', { count: pokemon.length, n: targetTeam === 'team1' ? 1 : 2 }))
    if (w.length === 0) setMode(null)
  }

  // ── Import da nomi ───────────────────────────────────────────────────────
  /**
   * Parsa il testo libero dell'utente in una lista di nomi, poi per ogni nome:
   * 1. Cerca lo slug in pokemon.json (findPokemonSlug)
   * 2. Se trovato e ha un preset → carica il primo preset disponibile
   * 3. Se trovato senza preset → slot con solo key (stat disponibili, sps a 0)
   * 4. Se non trovato → risultato ❌
   *
   * Nota: emptyPokemon non è esportato dallo store; costruiamo lo slot
   * manualmente con gli stessi campi di default usati nello store.
   */
  function buildEmptySlot(key) {
    return {
      key,
      moves: [null, null, null, null],
      sps: [0, 0, 0, 0, 0, 0],
      nature: null,
      ability: null,
      item: null,
      atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
      abilityFlags: {},
      lastRespectsKOs: 0,
    }
  }

  function normalizeMove(m) { return m ? m.replace(/-/g, ' ') : null }

  function handleImportNames(targetTeam) {
    // Separa per newline, virgola, slash
    const rawNames = namesText
      .split(/[\n,/]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 6)

    const results = []
    const slots = Array(6).fill(null)

    rawNames.forEach((name, i) => {
      const slug = findPokemonSlug(name)
      if (!slug) {
        results.push({ name, status: 'notfound', label: '' })
        return
      }

      const presets = PRESETS_BY_SLUG[slug]
      if (presets && presets.length > 0) {
        const p = presets[0]
        slots[i] = {
          ...buildEmptySlot(p.slug),
          nature: p.nature.toLowerCase(),
          item: p.item,
          ability: p.ability,
          sps: p.sps,
          moves: p.moves.map(normalizeMove),
        }
        results.push({ name, status: 'preset', label: p.label, total: presets.length })
      } else {
        slots[i] = buildEmptySlot(slug)
        results.push({ name, status: 'stat', label: slug })
      }
    })

    setNamesResults(results)
    setTeam(targetTeam, slots)
  }

  // ── Export / Reset / Share ───────────────────────────────────────────────
  function handleExport(targetTeam) {
    const team = targetTeam === 'team1' ? team1 : team2
    const paste = teamToShowdown(team)
    if (!paste) return
    navigator.clipboard.writeText(paste).then(() =>
      flash(t('ui.team_copied', { n: targetTeam === 'team1' ? 1 : 2 }))
    )
  }

  function handleReset(targetTeam) {
    setTeam(targetTeam, Array(6).fill(null))
    flash(t('ui.team_cleared', { n: targetTeam === 'team1' ? 1 : 2 }))
  }

  function handleShare() {
    // Il campo entra nel link dalla sessione C: senza, "questo attacco sotto
    // Trick Room con Reflect" arrivava all'altro come un attacco qualsiasi.
    const encoded = encodeTeamsToURL(team1, team2, campo)
    const url = window.location.origin + window.location.pathname + `?share=${encoded}`
    navigator.clipboard.writeText(url).then(() => flash(t('ui.link_copied')))
  }

  function openImport(newMode) {
    setMode(mode === newMode ? null : newMode)
    setWarnings([])
    setNamesResults([])
    setImportTab('showdown')
  }

  const MODS = [
    { label: t('ui.hhShort'),   mod: 'helpingHand', active: 'bg-green-400  text-gray-900' },
    { label: t('ui.veilShort'), mod: 'auroraVeil',  active: 'bg-blue-400   text-gray-900' },
    { label: t('ui.lsShort'),   mod: 'lightScreen', active: 'bg-yellow-400 text-gray-900' },
    { label: t('ui.refShort'),  mod: 'reflect',     active: 'bg-pink-400   text-gray-900' },
    { label: t('ui.critShort'), mod: 'crit',        active: 'bg-red-400    text-gray-900' },
    { label: t('ui.twShort'),   mod: 'tailwind',    active: 'bg-cyan-400   text-gray-900' },
  ]

  const MODS_DESKTOP = [
    { label: t('ui.helpingHand'), mod: 'helpingHand', active: 'bg-green-400  text-gray-900' },
    { label: t('ui.auroraVeil'),  mod: 'auroraVeil',  active: 'bg-blue-400   text-gray-900' },
    { label: t('ui.lightScreen'), mod: 'lightScreen', active: 'bg-yellow-400 text-gray-900' },
    { label: t('ui.reflect'),     mod: 'reflect',     active: 'bg-pink-400   text-gray-900' },
    { label: t('ui.crit'),        mod: 'crit',        active: 'bg-red-400    text-gray-900' },
    { label: t('ui.tailwind'),    mod: 'tailwind',    active: 'bg-cyan-400   text-gray-900' },
  ]

  const modVals = { helpingHand, auroraVeil, lightScreen, reflect, crit, tailwind }

  const btnBase   = 'flex items-center justify-center gap-1 text-xs px-2.5 py-1 rounded border transition-colors'
  const btnNormal = `${btnBase} bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40`
  const btnActive = `${btnBase} bg-teal-800 border-teal-600 text-teal-200`
  const btnReset  = `${btnBase} bg-red-950/30 hover:bg-red-900/50 text-red-400 border-red-900/30`
  const btnLib    = `${btnBase} bg-gray-700/60 hover:bg-gray-700 text-amber-300 border-amber-700/40`

  // ── Pannello import espandibile ──────────────────────────────────────────
  const targetTeam = mode === 'import1' ? 'team1' : 'team2'

  return (
    <div className="mb-3">
      <div role="group" aria-label={t('aria.team_modifiers')} className="bg-gray-900 rounded-xl border border-gray-700/40 px-3 pt-2 pb-1.5 space-y-1.5">

        {/* ── DESKTOP ── */}
        <div className="hidden sm:block space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold shrink-0">Team 1</span>
              <div className="flex items-center gap-1">
                {MODS_DESKTOP.map(m => (
                  <ModBtn key={m.mod} label={m.label}
                    active={modVals[m.mod].t1} activeClass={m.active}
                    onClick={() => toggleModifier(m.mod, 't1')} />
                ))}
              </div>
            </div>
            <ModBtn label={t('ui.ko_only')} active={showKoOnly}
              activeClass="bg-red-500 text-white" onClick={toggleShowKoOnly} />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {MODS_DESKTOP.map(m => (
                  <ModBtn key={m.mod} label={m.label}
                    active={modVals[m.mod].t2} activeClass={m.active}
                    onClick={() => toggleModifier(m.mod, 't2')} />
                ))}
              </div>
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold shrink-0">Team 2</span>
            </div>
          </div>

          <div className="h-px bg-gray-700/60" />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button"
                onClick={() => openImport('import1')}
                className={mode === 'import1' ? btnActive : btnNormal}>
                <IconImport /><span>{t('ui.import')}</span>
              </button>
              <button type="button" onClick={() => handleExport('team1')} className={btnNormal}>
                <IconExport /><span>{t('ui.export')}</span>
              </button>
              <button type="button" onClick={() => handleReset('team1')} className={btnReset}>
                <IconReset /><span>{t('ui.clear')}</span>
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {feedback && <span className="text-xs text-green-400">{feedback}</span>}
              {/* Bottone Team Library — centrale, visibile da entrambi i team */}
              <button type="button" onClick={() => setShowLibrary(true)} className={btnLib}>
                <IconLibrary /><span>{t('ui.team_library')}</span>
              </button>
              <button type="button" onClick={handleShare} className={btnNormal}>
                <IconShare /><span>{t('ui.share')}</span>
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button type="button"
                onClick={() => openImport('import2')}
                className={mode === 'import2' ? btnActive : btnNormal}>
                <IconImport /><span>{t('ui.import')}</span>
              </button>
              <button type="button" onClick={() => handleExport('team2')} className={btnNormal}>
                <IconExport /><span>{t('ui.export')}</span>
              </button>
              <button type="button" onClick={() => handleReset('team2')} className={btnReset}>
                <IconReset /><span>{t('ui.clear')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── MOBILE ── */}
        <div className="sm:hidden space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Team 1</span>
              <div className="flex gap-1">
                <button type="button"
                  onClick={() => openImport('import1')}
                  className={`${mode === 'import1' ? 'text-teal-300 border-teal-600 bg-teal-900/40' : 'text-gray-400 border-gray-600 bg-gray-700/40'} text-[10px] px-3 py-2.5 rounded border`}>
                  <IconImport />
                </button>
                <button type="button" onClick={() => handleExport('team1')}
                  className="text-[10px] px-3 py-2.5 rounded border text-gray-400 border-gray-600 bg-gray-700/40">
                  <IconExport />
                </button>
                <button type="button" onClick={() => handleReset('team1')}
                  className="text-[10px] px-3 py-2.5 rounded border text-red-400 border-red-900/40 bg-red-950/20">
                  <IconReset />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {MODS.map(m => (
                <ModBtn key={m.mod} label={m.label}
                  active={modVals[m.mod].t1} activeClass={m.active}
                  onClick={() => toggleModifier(m.mod, 't1')} />
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-700/60" />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Team 2</span>
              <div className="flex gap-1">
                <button type="button"
                  onClick={() => openImport('import2')}
                  className={`${mode === 'import2' ? 'text-teal-300 border-teal-600 bg-teal-900/40' : 'text-gray-400 border-gray-600 bg-gray-700/40'} text-[10px] px-3 py-2.5 rounded border`}>
                  <IconImport />
                </button>
                <button type="button" onClick={() => handleExport('team2')}
                  className="text-[10px] px-3 py-2.5 rounded border text-gray-400 border-gray-600 bg-gray-700/40">
                  <IconExport />
                </button>
                <button type="button" onClick={() => handleReset('team2')}
                  className="text-[10px] px-3 py-2.5 rounded border text-red-400 border-red-900/40 bg-red-950/20">
                  <IconReset />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {MODS.map(m => (
                <ModBtn key={m.mod} label={m.label}
                  active={modVals[m.mod].t2} activeClass={m.active}
                  onClick={() => toggleModifier(m.mod, 't2')} />
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-700/60" />

          <div className="flex items-center justify-between gap-2">
            <ModBtn label={t('ui.ko_only')} active={showKoOnly}
              activeClass="bg-red-500 text-white" onClick={toggleShowKoOnly} />
            <div className="flex items-center gap-2">
              {feedback && <span className="text-xs text-green-400">{feedback}</span>}
              <button type="button" onClick={() => setShowLibrary(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border bg-gray-700/60 text-amber-300 border-amber-700/40">
                <IconLibrary />
              </button>
              <button type="button" onClick={handleShare}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border bg-gray-700/60 text-gray-300 border-gray-600/40">
                <IconShare /><span>{t('ui.share')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pannello import espandibile ── */}
      {(mode === 'import1' || mode === 'import2') && (
        <div className="mt-2 p-3 bg-gray-900 rounded-xl border border-gray-700/40">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">
              {t('ui.import_panel_title', { n: mode === 'import1' ? 1 : 2 })}
            </span>
            <button onClick={() => setMode(null)} className="text-xs text-gray-600 hover:text-gray-300">✕</button>
          </div>

          {/* Tab Showdown / Solo nomi */}
          <div className="flex gap-1 mb-2">
            {['showdown', 'names'].map(tab => (
              <button
                key={tab}
                onClick={() => { setImportTab(tab); setNamesResults([]) }}
                className={`text-xs px-3 py-1 rounded border transition-colors ${
                  importTab === tab
                    ? 'bg-teal-800 border-teal-600 text-teal-200'
                    : 'text-gray-400 border-gray-700 hover:bg-gray-800'
                }`}
              >
                {tab === 'showdown' ? t('ui.import_tab_showdown') : t('ui.import_tab_names')}
              </button>
            ))}
          </div>

          {/* ── Tab: Showdown paste ── */}
          {importTab === 'showdown' && (
            <>
              <textarea
                autoFocus
                className="w-full h-52 bg-gray-800 text-gray-200 text-xs font-mono p-2 rounded border border-gray-700 resize-y outline-none focus:border-teal-500"
                placeholder={t('ui.import_paste')}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <div className="flex gap-2 mt-2 items-center flex-wrap">
                <button
                  onClick={() => handleImport(targetTeam)}
                  className="text-xs px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white"
                >
                  ✔ Import
                </button>
                <button
                  onClick={() => setMode(null)}
                  className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  {t('ui.cancel')}
                </button>
                {warnings.map((w, i) => (
                  <span key={i} className="text-xs text-yellow-400">⚠ {w}</span>
                ))}
              </div>
            </>
          )}

          {/* ── Tab: Solo nomi ── */}
          {importTab === 'names' && (
            <>
              <textarea
                autoFocus
                className="w-full h-36 bg-gray-800 text-gray-200 text-xs font-mono p-2 rounded border border-gray-700 resize-y outline-none focus:border-teal-500"
                placeholder={t('ui.import_names_placeholder')}
                value={namesText}
                onChange={e => { setNamesText(e.target.value); setNamesResults([]) }}
              />
              <div className="flex gap-2 mt-2 items-center flex-wrap">
                <button
                  onClick={() => handleImportNames(targetTeam)}
                  className="text-xs px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white"
                >
                  {t('ui.import_names_do')}
                </button>
                <button
                  onClick={() => setMode(null)}
                  className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  {t('ui.cancel')}
                </button>
              </div>

              {/* Riepilogo risultati lookup */}
              {namesResults.length > 0 && (
                <div className="mt-3 space-y-1">
                  {namesResults.map((r, i) => {
                    const icon =
                      r.status === 'preset'   ? '✅' :
                      r.status === 'stat'     ? '⚠️' : '❌'
                    const desc =
                      r.status === 'preset'   ? `${r.label} — ${t('ui.import_names_result_preset')}${r.total > 1 ? ` (1 ${t('ui.import_names_of')} ${r.total})` : ''}` :
                      r.status === 'stat'     ? `${r.label} — ${t('ui.import_names_result_stat')}` :
                                                t('ui.import_names_result_notfound')
                    return (
                      <div key={i} className="text-[11px] font-mono text-gray-300">
                        {icon} <span className="text-gray-400">{r.name}</span>{' '}
                        <span className={
                          r.status === 'preset' ? 'text-green-400' :
                          r.status === 'stat'   ? 'text-yellow-400' : 'text-red-400'
                        }>{desc}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modal Team Library ── */}
      {showLibrary && (
        <TeamLibraryModal
          onClose={() => setShowLibrary(false)}
          team1={team1}
          team2={team2}
          setTeam={setTeam}
        />
      )}
    </div>
  )
}