// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

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
import { slotConAbilitaValida, abilitaPerSpecie } from '../lib/abilitaSpecie.js'
import { DEFAULT_ABILITY_FLAGS } from '../data/abilityEffects.js'
import { NATURE_MODIFIERS } from '../data/natures.js'
import { MAX_SP_PER_STAT } from '../lib/rules.js'
import pokemonData from '../data/pokemon.json'
import movesData from '../data/moves.json'

/** Valori di meteo e terreno che l'interfaccia può produrre. */
const METEO_VALIDI   = ['sun', 'rain', 'sand', 'snow', 'harsh sunshine', 'heavy rain']
const TERRENI_VALIDI = ['electric', 'grassy', 'psychic', 'misty']

// ─── Struttura base di uno slot vuoto ────────────────────────────────────────
//
// Esportata perché `share.test.js` ne teneva una copia scritta a mano, e la
// copia si è scoperta vecchia due volte nella stessa sessione: prima le
// mancava `eelevateKOActive`, poi `colpiScelti`. Ogni volta i test diventavano
// rossi dicendo «c'è un campo in più del previsto» invece di «il campo nuovo
// non sopravvive al viaggio» — cioè segnalavano la copia, non il difetto.
export const emptyPokemon = () => ({
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
  lastRespectsKOs: 0,
  // Quante volte colpisce una mossa multi-colpo. `null` = «non l'ho scelto»,
  // e allora vale il massimo della mossa. Stessa forma di `lastRespectsKOs`:
  // uno stato dello slot, non dell'abilità, perché dipende dalla MOSSA.
  colpiScelti: null,
})

const emptyTeam = () => Array(6).fill(null).map(emptyPokemon)

// ─── Chiave localStorage ──────────────────────────────────────────────────────
const LS_KEY = 'vgc-overwhelm-teams'

// ─── Salvataggio su localStorage ─────────────────────────────────────────────
/**
 * ─── PERCHÉ UN RITARDO, E PERCHÉ NON È UNA MISURA DI PRESTAZIONI ───────────
 * Ogni `setSPs`, `setBoost`, `setMove` serializzava entrambi i team e faceva
 * una scrittura sincrona. Trascinando uno slider erano decine di scritture al
 * secondo, ed è la ragione per cui l'intervento era in lista.
 *
 * Misurato: il payload è 3,18 kB e `JSON.stringify` costa **8,2 µs**, contro i
 * circa 7 ms di ricalcolo della matrice che lo stesso movimento di slider
 * provoca comunque. È lo **0,1%** del lavoro. Chiamarla ottimizzazione
 * sarebbe disonesto: serve a non martellare il disco, non a far andare più
 * veloce l'interfaccia. Come per il font, il modo giusto di etichettarla è
 * igiene.
 *
 * ─── PERCHÉ NON `persist` DI ZUSTAND ───────────────────────────────────────
 * Il piano proponeva il middleware `persist`. Toglierebbe una sessantina di
 * righe, ma reidrata da solo all'avvio, e qui l'avvio ha una precedenza
 * precisa: **l'URL condiviso vince su localStorage** (vedi `statoIniziale`).
 * Riprodurla con `persist` significa `skipHydration` più idratazione manuale,
 * cioè rimettere la complessità che il middleware doveva togliere — su un
 * percorso che la sessione C ha sistemato e che è nella lista dei flussi da
 * ripercorrere a mano prima del lancio. Il guadagno misurato non giustifica
 * quel rischio, quindi si tocca solo la scrittura e il caricamento resta
 * quello di prima.
 */
const RITARDO_SALVATAGGIO = 300

let timerSalvataggio = null
let daSalvare = null

/** Scrive subito quello che è in attesa. */
function scriviSubito() {
  if (timerSalvataggio) {
    clearTimeout(timerSalvataggio)
    timerSalvataggio = null
  }
  if (!daSalvare) return
  const contenuto = daSalvare
  daSalvare = null
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(contenuto))
  } catch {
    // localStorage pieno o non disponibile (es. incognito con storage bloccato)
  }
}

function saveToLocalStorage(team1, team2) {
  daSalvare = { team1, team2 }
  if (timerSalvataggio) clearTimeout(timerSalvataggio)
  timerSalvataggio = setTimeout(scriviSubito, RITARDO_SALVATAGGIO)
}

/**
 * Se la pagina se ne va prima dello scadere del ritardo, l'ultima modifica
 * andrebbe persa. `pagehide` copre chiusura, ricarica e navigazione indietro;
 * `visibilitychange` copre il passaggio ad un'altra app su telefono, dove il
 * sistema può chiudere la scheda senza altro preavviso.
 */
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  window.addEventListener('pagehide', scriviSubito)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') scriviSubito()
  })
}

/** Esposta per i test: forza la scrittura senza aspettare il ritardo. */
export { scriviSubito as salvaSubito, RITARDO_SALVATAGGIO }

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
    /**
     * ─── LE SQUADRE SALVATE VANNO GUARITE, NON SOLO CARICATE ───────────────
     *
     * Correggere l'import non basta: una squadra messa in `localStorage` PRIMA
     * di quella correzione se la porta dietro per sempre, e l'utente non ha
     * modo di accorgersene — la tendina mostra l'abilità giusta perché un
     * `<select>` senza l'opzione corrispondente disegna la prima.
     *
     * È quello che Simone ha visto su Raichu-Mega-Y: misurato che ENTRAMBI i
     * parser producono `no-guard`, quindi il valore sbagliato non poteva che
     * venire da qui.
     *
     * La regola è quella di `lib/abilitaSpecie.js`, la stessa dei due parser:
     * tre copie che non concordavano sono diventate una.
     */
    const hydrate = (team) =>
      Array.isArray(team)
        ? team.map(slot => slotConAbilitaValida({
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

// ─── URL condiviso ───────────────────────────────────────────────────────────
/**
 * ─── PERCHÉ base64url E NON base64 ─────────────────────────────────────────
 * L'alfabeto base64 standard contiene `+` e `/`. In una query string il `+`
 * viene interpretato come spazio da `URLSearchParams.get()`, quindi un link
 * che ne contenesse uno tornerebbe indietro corrotto e il team arriverebbe
 * vuoto, senza spiegazioni.
 *
 * Va detto con onestà: con i dati attuali quel caso **non si presenta**. Su
 * testo ASCII i primi tre gruppi da 6 bit di ogni blocco non raggiungono mai
 * i valori 62 e 63, e il quarto ci arriva solo se il byte è `>`, `?` o `~` —
 * caratteri che non compaiono in nessuna chiave di pokemon/moves/items. Non è
 * quindi la correzione di un bug vivo: è togliere di mezzo una mina prima di
 * ampliare il payload, cosa che questa sessione sta facendo.
 *
 * L'altro motivo è che `escape`/`unescape`, usate prima per l'UTF-8, sono
 * deprecate da vent'anni. `TextEncoder`/`TextDecoder` fanno la stessa cosa e
 * sono la strada supportata.
 *
 * ─── I VECCHI LINK CONTINUANO A FUNZIONARE ─────────────────────────────────
 * `fromBase64Url` rimette `+` e `/` al posto di `-` e `_` e ricostruisce il
 * padding. Un link in base64 classico non contiene né `-` né `_`, quindi
 * attraversa la conversione immutato e si decodifica come prima.
 */

function toBase64Url(testo) {
  const bytes = new TextEncoder().encode(testo)
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(codificato) {
  const b64 = codificato.replace(/-/g, '+').replace(/_/g, '/')
  const padding = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const binario = atob(b64 + padding)
  const bytes = Uint8Array.from(binario, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// ─── Validazione dello schema ────────────────────────────────────────────────
/**
 * Un link condiviso è testo che arriva da fuori: va trattato come tale.
 * Prima, `decodeTeamsFromURL` faceva `JSON.parse` e spalmava i campi nello
 * store senza controlli, quindi un payload costruito ad arte poteva
 * infilare qualunque cosa dentro lo stato dell'applicazione.
 *
 * Queste funzioni non "riparano" un payload malformato: scartano ciò che non
 * riconoscono e lasciano il valore neutro. Meglio uno slot vuoto che uno slot
 * con dentro un oggetto arbitrario.
 */

const intero = (v, min, max, def = 0) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

const testoValido = (v, vocabolario) =>
  (typeof v === 'string' && Object.prototype.hasOwnProperty.call(vocabolario, v)) ? v : null

const spsValidi = (v) =>
  Array.isArray(v) && v.length === 6
    ? v.map(n => intero(n, 0, MAX_SP_PER_STAT, 0))
    : [0, 0, 0, 0, 0, 0]

const mosseValide = (v) =>
  Array.isArray(v)
    ? [0, 1, 2, 3].map(i => testoValido(v[i], movesData))
    : [null, null, null, null]

// ─── Codifica ────────────────────────────────────────────────────────────────
/**
 * Comprime i due team e lo stato di campo in una stringa per l'URL.
 *
 * Si scrivono solo i valori diversi dal default, per tenere il link corto.
 * Le coppie di lato (Reflect, Tailwind…) diventano un numero da 0 a 3:
 * bit 0 = squadra 1, bit 1 = squadra 2.
 *
 * ─── COSA È CAMBIATO NELLA SESSIONE C ──────────────────────────────────────
 * Prima il link portava solo i due team. Meteo, terreno, Trick Room, Tailwind,
 * schermi, Helping Hand e critico restavano indietro, e con loro
 * `abilityFlags` e `lastRespectsKOs`. In uno strumento per doubles il contesto
 * *è* il calcolo: "quanto fa male questo attacco" senza "sotto Trick Room, con
 * Reflect su" è una domanda diversa. Un link che perde il campo condivide un
 * calcolo che non è quello che avevi davanti.
 *
 * @param {Array} team1
 * @param {Array} team2
 * @param {object} [campo] — stato di campo (vedi hooks/useFieldState)
 * @returns {string} stringa base64url adatta a `?share=`
 */
export function encodeTeamsToURL(team1, team2, campo = null) {
  const lato = (coppia) => (coppia?.t1 ? 1 : 0) | (coppia?.t2 ? 2 : 0)

  const minify = (slot) => {
    if (!slot?.key) return {}
    const s = {}
    s.k = slot.key
    if (slot.moves?.some(Boolean)) s.m  = slot.moves
    if (slot.sps?.some(v => v > 0)) s.sp = slot.sps
    if (slot.nature)  s.n  = slot.nature
    if (slot.ability) s.a  = slot.ability
    if (slot.item)    s.i  = slot.item
    if (slot.atkBoost)   s.ab  = slot.atkBoost
    if (slot.defBoost)   s.db  = slot.defBoost
    if (slot.spAtkBoost) s.sab = slot.spAtkBoost
    if (slot.spDefBoost) s.sdb = slot.spDefBoost
    if (slot.speBoost)   s.spb = slot.speBoost
    if (slot.lastRespectsKOs) s.lr = slot.lastRespectsKOs
    // `!= null` e non `if (slot.colpiScelti)`: zero non è un valore legale, ma
    // se un giorno lo diventasse un `if` semplice lo butterebbe via in
    // silenzio. È lo stesso errore che `multiscaleActive` evita qui sopra.
    if (slot.colpiScelti != null) s.cs = slot.colpiScelti

    // I flag abilità: si scrive solo ciò che differisce dal default. Nota che
    // `multiscaleActive` è `true` di default, quindi qui si registra quando è
    // spento — al contrario degli altri.
    const f = slot.abilityFlags || {}
    const af = {}
    if (f.intimidateActive)   af.i  = 1
    if (f.flashFireActive)    af.ff = 1
    if (f.multiscaleActive === false) af.ms = 0
    if (f.supremeOverlordKOs) af.so = f.supremeOverlordKOs
    if (f.eelevateKOActive)   af.ee = 1
    if (f.assorbimentoAttivo) af.as = 1
    if (f.interruttore)       af.io = 1
    if (Object.keys(af).length) s.af = af

    return s
  }

  const data = { t1: team1.map(minify), t2: team2.map(minify) }

  if (campo) {
    const f = {}
    if (campo.weather)  f.w  = campo.weather
    if (campo.terrain)  f.t  = campo.terrain
    if (campo.trickRoom) f.tr = 1
    if (campo.doubleTarget === false) f.dt = 0   // il default è acceso
    const coppie = {
      hh: campo.helpingHand, tw: campo.tailwind, av: campo.auroraVeil,
      bt: campo.battery, ps: campo.powerSpot, ss: campo.steelySpirit,
      fg: campo.friendGuard, fw: campo.flowerGift,
      pt: campo.protect,
      ls: campo.lightScreen, rf: campo.reflect,  cr: campo.crit,
    }
    for (const [chiave, valore] of Object.entries(coppie)) {
      const n = lato(valore)
      if (n) f[chiave] = n
    }
    if (Object.keys(f).length) data.f = f
  }

  return toBase64Url(JSON.stringify(data))
}

// ─── Decodifica ──────────────────────────────────────────────────────────────
/**
 * Ricostruisce team e campo da una stringa condivisa.
 *
 * @param {string} encoded
 * @returns {{team1: Array, team2: Array, field: object|null}|null} null se illeggibile
 */
export function decodeTeamsFromURL(encoded) {
  try {
    const { t1, t2, f } = JSON.parse(fromBase64Url(encoded))

    const expand = (minSlots) =>
      Array.isArray(minSlots)
        ? minSlots.slice(0, 6).map(s => {
            const grezzo = (s && typeof s === 'object') ? s : {}
            const chiave = testoValido(grezzo.k, pokemonData)
            if (!chiave) return emptyPokemon()

            const af = (grezzo.af && typeof grezzo.af === 'object') ? grezzo.af : {}
            return {
              ...emptyPokemon(),
              key:        chiave,
              moves:      mosseValide(grezzo.m),
              sps:        spsValidi(grezzo.sp),
              nature:     testoValido(grezzo.n, NATURE_MODIFIERS),
              // Stessa guarigione del caricamento da localStorage: un link
              // condiviso prima della correzione porta l'abilità sbagliata nel
              // payload, e chi lo apre non ha modo di accorgersene.
              ability:    abilitaPerSpecie(chiave, typeof grezzo.a === 'string' ? grezzo.a : null),
              item:       typeof grezzo.i === 'string' ? grezzo.i : null,
              atkBoost:   intero(grezzo.ab,  -6, 6),
              defBoost:   intero(grezzo.db,  -6, 6),
              spAtkBoost: intero(grezzo.sab, -6, 6),
              spDefBoost: intero(grezzo.sdb, -6, 6),
              speBoost:   intero(grezzo.spb, -6, 6),
              lastRespectsKOs: intero(grezzo.lr, 0, 3),
              // Il limite superiore è quello della mossa più generosa
              // (Infestazione, dieci): il motore poi taglia sull'intervallo
              // della mossa vera, quindi un valore fuori posto non produce un
              // numero sbagliato.
              colpiScelti: typeof grezzo.cs === 'number' ? intero(grezzo.cs, 1, 10) : null,
              abilityFlags: {
                ...DEFAULT_ABILITY_FLAGS,
                intimidateActive:   af.i  === 1,
                flashFireActive:    af.ff === 1,
                multiscaleActive:   af.ms !== 0,
                supremeOverlordKOs: intero(af.so, 0, 5),
                eelevateKOActive:   af.ee === 1,
                assorbimentoAttivo: af.as === 1,
                interruttore:       af.io === 1,
              },
            }
          })
        : emptyTeam()

    // I team si normalizzano sempre a sei slot: un payload più corto o più
    // lungo non deve produrre una griglia di dimensione strana.
    const seiSlot = (t) => {
      const e = expand(t)
      while (e.length < 6) e.push(emptyPokemon())
      return e
    }

    let field = null
    if (f && typeof f === 'object') {
      const coppia = (n) => ({ t1: (intero(n, 0, 3) & 1) === 1, t2: (intero(n, 0, 3) & 2) === 2 })
      field = {
        weather:      METEO_VALIDI.includes(f.w) ? f.w : null,
        terrain:      TERRENI_VALIDI.includes(f.t) ? f.t : null,
        trickRoom:    f.tr === 1,
        doubleTarget: f.dt !== 0,
        helpingHand:  coppia(f.hh),
        tailwind:     coppia(f.tw),
        auroraVeil:   coppia(f.av),
        lightScreen:  coppia(f.ls),
        reflect:      coppia(f.rf),
        crit:         coppia(f.cr),
        battery:      coppia(f.bt),
        powerSpot:    coppia(f.ps),
        steelySpirit: coppia(f.ss),
        friendGuard:  coppia(f.fg),
        flowerGift:   coppia(f.fw),
        protect:      coppia(f.pt),
      }
    }

    return { team1: seiSlot(t1), team2: seiSlot(t2), field }
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
 *
 * `shareError` vale `true` se c'era un `?share=` ma non si è riusciti a
 * leggerlo. Serve a dirlo all'utente invece di mostrargli due team vuoti
 * senza spiegazione, che è ciò che succedeva prima.
 */
function getInitialState() {
  let shareError = false

  try {
    const shared = new URLSearchParams(window.location.search).get('share')
    if (shared) {
      const decoded = decodeTeamsFromURL(shared)
      if (decoded) {
        return { team1: decoded.team1, team2: decoded.team2, field: decoded.field, shareError: false }
      }
      shareError = true
    }
  } catch { /* window assente o query illeggibile: si prosegue */ }

  const fromLS = loadFromLocalStorage()
  if (fromLS) return { ...fromLS, field: null, shareError }

  return { team1: emptyTeam(), team2: emptyTeam(), field: null, shareError }
}

const statoIniziale = getInitialState()
const initialTeam1 = statoIniziale.team1
const initialTeam2 = statoIniziale.team2

/** Valori di campo iniziali: quelli del link condiviso, o i default. */
const campoIniziale = {
  weather: null,
  terrain: null,
  trickRoom: false,
  doubleTarget: true,
  helpingHand: { t1: false, t2: false },
  tailwind:    { t1: false, t2: false },
  auroraVeil:  { t1: false, t2: false },
  lightScreen: { t1: false, t2: false },
  reflect:     { t1: false, t2: false },
  crit:        { t1: false, t2: false },
  // ── Le cinque caselle dell'ALLEATO ────────────────────────────────────────
  // Nel riferimento non sono abilita' lette dal Pokemon ma campi del terreno
  // (`field.isBattery`, `field.isPowerSpot`, `field.isSteelySpirit`,
  // `field.isFriendGuard`, `field.isFlowerGiftAtk`/`SpD`): chi le possiede e'
  // il compagno accanto, non chi attacca o subisce.
  //
  // `flowerGift` e' UNO solo per lato anche se il riferimento ne ha due: la
  // sua interfaccia ha due caselle separate, ma dicono la stessa cosa da due
  // versi — l'alleato ce l'ha, quindi ti alza l'Attacco quando attacchi e la
  // Difesa Speciale quando difendi. La proiezione per direzione la fa
  // `buildField`.
  battery:      { t1: false, t2: false },
  powerSpot:    { t1: false, t2: false },
  steelySpirit: { t1: false, t2: false },
  friendGuard:  { t1: false, t2: false },
  flowerGift:   { t1: false, t2: false },
  ...(statoIniziale.field || {}),
}

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
  showKoOnly: false,
  protect: { t1: false, t2: false },

  // Stato di campo: dal link condiviso se c'è, altrimenti i default.
  ...campoIniziale,

  /** true se l'URL conteneva un ?share= illeggibile. Mostrato da App.jsx. */
  shareError: statoIniziale.shareError,
  clearShareError: () => set({ shareError: false }),

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

  setLastRespectsKOs: (team, index, kos) =>
    set((s) => updateSlot(s, team, index, { lastRespectsKOs: Math.min(3, Math.max(0, kos)) })),

  setColpiScelti: (team, index, colpi) =>
    set((s) => updateSlot(s, team, index, {
      colpiScelti: colpi == null ? null : Math.min(10, Math.max(1, colpi)),
    })),

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