/**
 * useCalcStore.js
 * Store Zustand per il calcolatore VGC.
 *
 * Novità rispetto alla versione precedente:
 *  1. Persistenza localStorage: il team viene salvato automaticamente ad ogni
 *     modifica e ricaricato all'avvio (solo team1/team2, non i flag di campo).
 *  2. Due funzioni helper esportate per URL shareable:
 *       encodeTeamsToURL(team1, team2) → stringa base64
 *       decodeTeamsFromURL(encoded)    → { team1, team2 }
 *     Usate da App.jsx per leggere/scrivere il param ?share= nell'URL.
 */

import { create } from 'zustand'
import { DEFAULT_ABILITY_FLAGS } from '../data/abilityEffects.js'

// ─── Struttura base di uno slot vuoto ────────────────────────────────────────
const emptyPokemon = () => ({
  key: null,
  moves: [null, null, null, null],
  sps: [0, 0, 0, 0, 0, 0],
  nature: null,
  ability: null,
  item: null,
  atkBoost: 0,
  defBoost: 0,
  spAtkBoost: 0,
  spDefBoost: 0,
  speBoost: 0,
  abilityFlags: { ...DEFAULT_ABILITY_FLAGS },
})

const emptyTeam = () => Array(6).fill(null).map(emptyPokemon)

// ─── Chiave localStorage ──────────────────────────────────────────────────────
const LS_KEY = 'vgc-overwhelm-teams'

// ─── Salvataggio su localStorage ─────────────────────────────────────────────
function saveToLocalStorage(team1, team2) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ team1, team2 }))
  } catch {
    // localStorage pieno o non disponibile (es. incognito con storage bloccato)
  }
}

// ─── Caricamento da localStorage ─────────────────────────────────────────────
/**
 * Ricostruisce i due team da localStorage.
 * Se i dati non ci sono o sono corrotti, restituisce due team vuoti.
 * Merga con emptyPokemon() per garantire che tutti i campi siano presenti
 * anche se il formato salvato è più vecchio dello schema attuale.
 */
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const { team1, team2 } = JSON.parse(raw)
    const hydrate = (team) =>
      Array.isArray(team)
        ? team.map(slot => ({
            ...emptyPokemon(),
            ...slot,
            abilityFlags: { ...DEFAULT_ABILITY_FLAGS, ...(slot?.abilityFlags || {}) },
          }))
        : emptyTeam()
    return { team1: hydrate(team1), team2: hydrate(team2) }
  } catch {
    return null
  }
}

// ─── URL encoding/decoding ────────────────────────────────────────────────────
/**
 * Comprime i due team in una stringa base64 adatta a un parametro URL.
 *
 * Salviamo solo i campi significativi per tenere l'URL breve:
 * key, moves, sps, nature, ability, item, i boost e abilityFlags.
 * I valori default (null, 0, boost a 0) vengono omessi per ridurre la size.
 */
export function encodeTeamsToURL(team1, team2) {
  const minify = (slot) => {
    if (!slot?.key) return {}
    const s = {}
    if (slot.key)     s.k  = slot.key
    const moves = slot.moves.filter(Boolean)
    if (moves.length) s.m  = slot.moves  // manteniamo i null per preservare le posizioni
    const sps = slot.sps.filter(v => v > 0)
    if (sps.length)   s.sp = slot.sps
    if (slot.nature)  s.n  = slot.nature
    if (slot.ability) s.a  = slot.ability
    if (slot.item)    s.i  = slot.item
    if (slot.atkBoost)   s.ab  = slot.atkBoost
    if (slot.defBoost)   s.db  = slot.defBoost
    if (slot.spAtkBoost) s.sab = slot.spAtkBoost
    if (slot.spDefBoost) s.sdb = slot.spDefBoost
    if (slot.speBoost)   s.spb = slot.speBoost
    return s
  }
  const data = {
    t1: team1.map(minify),
    t2: team2.map(minify),
  }
  const json = JSON.stringify(data)
  return btoa(unescape(encodeURIComponent(json)))
}

/**
 * Ricostruisce i due team da una stringa base64.
 * Restituisce { team1, team2 } o null se la stringa è invalida.
 */
export function decodeTeamsFromURL(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)))
    const { t1, t2 } = JSON.parse(json)
    const expand = (minSlots) =>
      Array.isArray(minSlots)
        ? minSlots.map(s => ({
            ...emptyPokemon(),
            key:        s.k  || null,
            moves:      s.m  || [null, null, null, null],
            sps:        s.sp || [0, 0, 0, 0, 0, 0],
            nature:     s.n  || null,
            ability:    s.a  || null,
            item:       s.i  || null,
            atkBoost:   s.ab  || 0,
            defBoost:   s.db  || 0,
            spAtkBoost: s.sab || 0,
            spDefBoost: s.sdb || 0,
            speBoost:   s.spb || 0,
          }))
        : emptyTeam()
    return { team1: expand(t1), team2: expand(t2) }
  } catch {
    return null
  }
}

// ─── Inizializzazione: URL ha precedenza su localStorage ─────────────────────
/**
 * Ordine di priorità per l'idratazione iniziale:
 *  1. Parametro ?share= nell'URL (link condiviso)
 *  2. localStorage (sessione precedente)
 *  3. Team vuoti (primo avvio)
 */
function getInitialTeams() {
  // 1. Prova URL
  try {
    const params = new URLSearchParams(window.location.search)
    const shared = params.get('share')
    if (shared) {
      const decoded = decodeTeamsFromURL(shared)
      if (decoded) return decoded
    }
  } catch { /* noop */ }

  // 2. Prova localStorage
  const fromLS = loadFromLocalStorage()
  if (fromLS) return fromLS

  // 3. Team vuoti
  return { team1: emptyTeam(), team2: emptyTeam() }
}

const { team1: initialTeam1, team2: initialTeam2 } = getInitialTeams()

// ─── Helper interno: aggiorna un singolo slot e salva su localStorage ─────────
// Riceve lo stato corrente, il team da modificare ('team1'/'team2'), l'indice
// dello slot e un oggetto patch (es. { nature: 'adamant' }).
// Restituisce il frammento di stato da passare a set() di Zustand.
// Non va usato per setPokemon, che azzera tutto lo slot anziché fare un merge.
function updateSlot(state, team, index, patch) {
  const t = [...state[team]]
  t[index] = { ...t[index], ...patch }
  const t1 = team === 'team1' ? t : state.team1
  const t2 = team === 'team2' ? t : state.team2
  saveToLocalStorage(t1, t2)
  return { [team]: t }
}

// ─── Store ────────────────────────────────────────────────────────────────────
const useCalcStore = create((set) => ({
  level: 50,
  trickRoom: false,
  doubleTarget: true,
  showKoOnly: false,
  weather: null,
  terrain: null,
  helpingHand: { t1: false, t2: false },
  tailwind:    { t1: false, t2: false },
  auroraVeil:  { t1: false, t2: false },
  lightScreen: { t1: false, t2: false },
  reflect:     { t1: false, t2: false },
  protect:     { t1: false, t2: false },
  crit:        { t1: false, t2: false },

  team1: initialTeam1,
  team2: initialTeam2,

  // ── Setter campo ──
  toggleTrickRoom: () => set((s) => ({ trickRoom: !s.trickRoom })),

  // Focus editor: cliccando uno sprite in DamageTable si apre il suo tab nel TeamEditor
  editorFocus: null,   // { team: 'team1'|'team2', index: 0-5, ts: number } — usato dal click sprite
  team1Focus: null,    // { index, ts } — focus diretto per team1
  team2Focus: null,    // { index, ts } — focus diretto per team2
  setEditorFocus: (team, index) => set({ editorFocus: { team, index, ts: Date.now() } }),
  setTeam1Focus: (index) => set({ team1Focus: { index, ts: Date.now() } }),
  setTeam2Focus: (index) => set({ team2Focus: { index, ts: Date.now() } }),
  toggleDoubleTarget: () => set((s) => ({ doubleTarget: !s.doubleTarget })),
  toggleShowKoOnly: () => set((s) => ({ showKoOnly: !s.showKoOnly })),
  setDoubleTarget: (val) => set({ doubleTarget: val }),
  setWeather: (w) => set((s) => ({ weather: s.weather === w ? null : w })),
  setWeatherDirect: (w) => set(() => ({ weather: w })),
  setTerrain: (t) => set((s) => ({ terrain: s.terrain === t ? null : t })),
  toggleModifier: (mod, side) =>
    set((s) => ({ [mod]: { ...s[mod], [side]: !s[mod][side] } })),

  // ── Setter team ──
  // Ogni setter che modifica i team chiama saveToLocalStorage dopo l'update.

  setPokemon: (team, index, key) =>
    set((s) => {
      const t = [...s[team]]
      t[index] = { ...emptyPokemon(), key }
      const next = { [team]: t }
      const t1 = team === 'team1' ? t : s.team1
      const t2 = team === 'team2' ? t : s.team2
      saveToLocalStorage(t1, t2)
      return next
    }),

  setMove: (team, pokeIndex, moveIndex, move) =>
    set((s) => {
      const t = [...s[team]]
      const moves = [...t[pokeIndex].moves]
      moves[moveIndex] = move
      t[pokeIndex] = { ...t[pokeIndex], moves }
      const next = { [team]: t }
      const t1 = team === 'team1' ? t : s.team1
      const t2 = team === 'team2' ? t : s.team2
      saveToLocalStorage(t1, t2)
      return next
    }),

  setNature: (team, index, nature) =>
    set((s) => updateSlot(s, team, index, { nature })),

  setSPs: (team, index, sps) =>
    set((s) => updateSlot(s, team, index, { sps })),

  // setBoost clamp il valore tra -6 e +6 prima di passarlo all'helper
  setBoost: (team, index, stat, value) =>
    set((s) => updateSlot(s, team, index, { [stat]: Math.min(6, Math.max(-6, value)) })),

  setItem: (team, index, item) =>
    set((s) => updateSlot(s, team, index, { item })),

  // setAbility azzera anche abilityFlags quando si cambia abilità
  setAbility: (team, index, ability) =>
    set((s) => updateSlot(s, team, index, { ability, abilityFlags: { ...DEFAULT_ABILITY_FLAGS } })),

  setAbilityFlag: (team, index, flagName, value) =>
    set((s) => {
      const t = [...s[team]]
      t[index] = {
        ...t[index],
        abilityFlags: { ...t[index].abilityFlags, [flagName]: value },
      }
      // I flag non vengono salvati su localStorage (sono stato effimero di battaglia)
      return { [team]: t }
    }),

  // ── Utility: carica un team intero (usato dall'import Showdown) ──
  // Questo è già gestito slot per slot tramite setPokemon/setMove/ecc.,
  // ma forniamo anche un setter bulk per comodità futura.
  setTeam: (teamKey, slots) =>
    set((s) => {
      const t = slots.map(slot => slot ? { ...emptyPokemon(), ...slot } : emptyPokemon())
      const t1 = teamKey === 'team1' ? t : s.team1
      const t2 = teamKey === 'team2' ? t : s.team2
      saveToLocalStorage(t1, t2)
      return { [teamKey]: t }
    }),
}))

export default useCalcStore