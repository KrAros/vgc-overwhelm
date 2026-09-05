// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import useCalcStore from '../../store/useCalcStore'
import { useState } from 'react'
import pokemonData from '../../data/pokemon.json'
import { cercaSpecie, ordinaPerRoster } from '../../utils/nomiPokemon'
import movesData   from '../../data/moves.json'
import itemsData   from '../../data/items.json'
import { TYPE_NAMES, TYPE_COLORS } from '../../data/typeChart.js'
import { ABILITA_ATE, tipoPallaClima } from '../../lib/rules.js'
import { mossaNonCalcolata } from '../../lib/gap.js'
import { SegnalinoNonCalcolata } from './BadgeNonCalcolata.jsx'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n.js'

const ALL_POKEMON = Object.keys(pokemonData).sort()
const ALL_MOVES   = Object.keys(movesData).sort()
const ALL_ITEMS   = Object.keys(itemsData).sort()

/**
 * ─── LA RICERCA BIDIREZIONALE SENZA L'IMPORT DIRETTO ───────────────────────
 * Questo file importava `it.json` per conto suo, ed era il motivo per cui il
 * locale italiano non poteva uscire dal bundle: anche togliendolo da
 * `i18n.js` sarebbe rientrato da qui.
 *
 * Ora le traduzioni si chiedono a i18next, che tiene in memoria i pacchetti
 * **caricati**. Per un utente italiano sono due — `en` (fallback, sempre nel
 * bundle) e `it` — quindi cercare "terremoto" o "earthquake" funziona
 * entrambe le volte, come prima. Per un utente inglese c'è solo `en`: la
 * ricerca in italiano non è disponibile, il che è coerente con un'interfaccia
 * che è tutta in inglese.
 *
 * Non si usa `t()` in un ciclo: sarebbero ottocento chiamate per battuta.
 * `getResourceBundle` restituisce l'oggetto e il confronto avviene su quello.
 */
function nomiTradotti(sezione) {
  const nomi = []
  for (const lingua of i18n.languages || []) {
    const pacchetto = i18n.getResourceBundle(lingua, 'translation')
    if (pacchetto?.[sezione]) nomi.push(pacchetto[sezione])
  }
  return nomi
}

/** true se `chiave` corrisponde alla query in inglese o in una lingua caricata. */
function corrisponde(chiave, query, sezione) {
  if (chiave.toLowerCase().includes(query)) return true
  for (const nomi of nomiTradotti(sezione)) {
    const tradotto = nomi[chiave]
    if (tradotto && tradotto.toLowerCase().includes(query)) return true
  }
  return false
}

// ─── PokemonSearch ────────────────────────────────────────────────────────────

export function PokemonSearch({ value, onChange }) {
  const { t } = useTranslation()
  const [query, setQuery]   = useState('')
  const [focused, setFocused] = useState(false)
  const [open, setOpen]     = useState(false)

  /**
   * ─── LA RICERCA IGNORA I SEGNI, E GUARDA ANCHE IL NOME ───────────────────
   *
   * Prima confrontava la query con lo SLUG e basta, con un `includes` secco.
   * Le chiavi usano il trattino, quindi scrivere uno spazio dava **zero
   * risultati**: «iron h» → 0, «flutter m» → 0, «chi y» → 0. Bisognava
   * indovinare il trattino, e sono 241 le specie con la chiave composta.
   *
   * E il nome vero non lo guardava affatto: `Mr. Mime` e `Type: Null` si
   * trovano solo scrivendo `mr-mime` e `type-null`.
   *
   * Ora si confrontano slug e nome dopo aver tolto tutto ciò che non è lettera
   * o cifra, da entrambe le parti: una regola sola che copre spazi, trattini,
   * punti e due punti insieme.
   */
  const filtered = query.length >= 2
    // Le specie che Champions ha vengono prima: la lista si ferma a 20, e
    // senza ordinamento quei venti erano i primi in alfabeto — spesso tutti di
    // fuori. Ordina e basta: non nasconde e non etichetta, perché il registro
    // ha falsi negativi noti (vedi `ordinaPerRoster`).
    ? ordinaPerRoster(ALL_POKEMON.filter(p => cercaSpecie(p, query))).slice(0, 20)
    : []

  const hasValue = focused ? query.length > 0 : !!value

  const handleClear = (e) => {
    e.preventDefault()
    setQuery('')
    onChange('')
    setOpen(false)
  }

  return (
    <div className="relative flex items-center">
      <input
        className="w-full bg-gray-700 text-xs text-white rounded pl-2 pr-7 py-1 outline-none capitalize border border-gray-600"
        aria-label={t("ui.search_pokemon")}
        placeholder={t("ui.search_pokemon")}
        value={focused ? query : (value || '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setFocused(true); setQuery(''); setOpen(true) }}
        onBlur={() => {
          setTimeout(() => { setFocused(false); setOpen(false); setQuery('') }, 150)
        }}
      />
      {hasValue && (
        <button
          type="button"
          aria-label={t('aria.clear_pokemon')}
          onMouseDown={handleClear}
          /* 24×24 è il minimo di WCAG 2.5.8: il bersaglio misurava 10×16 e
             stava a distanza ZERO dal campo di testo, quindi col pollice si
             centrava l'uno per l'altro. Il glifo resta della stessa dimensione
             — cresce solo l'area toccabile. `top-1/2 -translate-y-1/2` allinea
             questa copia all'altra (riga ~237), che già lo faceva. */
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white text-xs font-bold focus:outline-none"
        >
          ✕
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full top-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-48 overflow-y-auto">
          {filtered.map(p => (
            <div
              key={p}
              className="px-2 py-1 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer capitalize"
              onMouseDown={() => { onChange(p); setQuery(''); setOpen(false) }}
            >
              {p}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MoveSearch ───────────────────────────────────────────────────────────────

export function MoveSearch({ value, onChange, placeholder, ability }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [open, setOpen]   = useState(false)

  const weather = useCalcStore(s => s.weather)

  const filtered = query.length >= 2
    ? ALL_MOVES.filter(m => corrisponde(m, query.toLowerCase(), 'moves')).slice(0, 20)
    : []

  const moveDetails = movesData[value]

  // Palla Clima: tipo e BP cambiano col meteo. La tabella sta in
  // `lib/rules.js` dalla sessione Q — qui ce n'era una copia con due chiavi in
  // più, `sandstorm` e `hail`, che erano una normalizzazione riscritta a mano
  // dentro il componente. Ora la fa `normalizzaMeteo`, che è la stessa
  // funzione da cui passa il motore, e che gestisce anche il maiuscolo.
  const isWeatherBall = value === 'weather ball'
  const wbTypeIdx = tipoPallaClima(value, weather)
  // Abilità «-ate»: la tabella sta in `data/typeChart.js` dalla sessione Q.
  // Qui c'era una copia scritta con gli indici numerici, mentre il motore usava
  // le costanti TYPES.*: due rappresentazioni diverse della stessa cosa, che
  // concordavano senza che niente lo garantisse.
  const abilityKey = (ability || '').toLowerCase().replace(/ /g, '-')
  const baseType = isWeatherBall && wbTypeIdx !== null ? wbTypeIdx : moveDetails?.type
  const isNormalMove = baseType === 0 // 0 = Normal
  const ateType = isNormalMove && ABILITA_ATE[abilityKey] !== undefined ? ABILITA_ATE[abilityKey] : null
  const displayType = ateType !== null ? ateType : baseType
  const displayBP   = isWeatherBall && wbTypeIdx !== null ? 100 : moveDetails?.power

  const categoryTitles = { 0: 'Fisico', 1: 'Speciale', 2: 'Stato' }

  return (
    <div className="bg-gray-700/40 p-1.5 rounded border border-gray-700/60 flex items-center justify-between gap-2 h-9">
      <div className="flex-1 relative">
        <input
          className={`w-full bg-gray-700 text-xs rounded pl-2 py-1 outline-none capitalize ${
            value ? 'pr-7' : 'pr-2'
          } ${value && !focused ? 'text-white' : 'text-gray-300'}`}
          aria-label={t('aria.search_move')}
          placeholder={focused ? placeholder : (value ? t(`moves.${value}`, { defaultValue: value.replace(/-/g, ' ') }) : placeholder)}
          value={focused ? query : (value ? t(`moves.${value}`, { defaultValue: value.replace(/-/g, ' ') }) : '')}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setFocused(true); setQuery(''); setOpen(true) }}
          onBlur={() => { setTimeout(() => { setFocused(false); setOpen(false); setQuery('') }, 150) }}
        />
        {/* ─── SVUOTA LA MOSSA ───────────────────────────────────────────
            Stessa affordance delle altre due copie in questo file, stessa
            geometria: 24×24, il minimo di WCAG 2.5.8.

            `onMouseDown` e non `onClick`: l'input chiude la tendina con un
            `onBlur` ritardato di 150 ms, e un `onClick` arriverebbe dopo. È
            la ragione per cui le altre due fanno lo stesso.

            Svuota con `null`, non con stringa vuota: `null` è il valore
            canonico di «nessuna mossa» — lo scrivono lo stato iniziale e
            l'import Showdown. Una stringa vuota sarebbe un secondo modo di
            dire la stessa cosa, e il tipo di doppione che questo progetto
            paga da sei sessioni. */}
        {value && (
          <button
            type="button"
            aria-label={t('aria.clear_move')}
            onMouseDown={(e) => { e.preventDefault(); setQuery(''); onChange(null); setOpen(false) }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white text-xs font-bold focus:outline-none"
          >
            ✕
          </button>
        )}
        {open && filtered.length > 0 && (
          <div className="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-40 overflow-y-auto shadow-xl">
            {filtered.map(m => (
              <div
                key={m}
                className="px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer capitalize"
                onMouseDown={() => { onChange(m); setQuery(''); setOpen(false) }}
              >
                {t(`moves.${m}`, { defaultValue: m.replace(/-/g, ' ') })}
              </div>
            ))}
          </div>
        )}
      </div>
      {moveDetails && (
        <div className="flex items-center gap-2 shrink-0 pl-1">
          {/* ─── «NON CALCOLATA», SULLE MOSSE ────────────────────────────
              Sta PRIMA della potenza perché è la potenza che mente: le
              ventidue mosse nel divario mostrano `—` al posto di un numero,
              esattamente come una mossa di stato, e il segnalino è la cosa
              che distingue «non ne ha» da «non la sappiamo calcolare».

              Il segnalino e non il riquadro, per la stessa ragione delle
              abilità: la riga è alta 9 (`h-9`) e un riquadro la farebbe
              crescere, facendo saltare le altre tre mosse ogni volta che se ne
              cambia una. Qui il costo di quel compromesso è lo stesso già
              dichiarato in `BadgeNonCalcolata.jsx` — chi tocca vede l'avviso
              ambra e non la ragione, che resta nel `title` e nell'`aria-label`. */}
          {mossaNonCalcolata(value) && <SegnalinoNonCalcolata tipo="move" />}
          <span className="text-xs font-mono font-bold text-gray-300 text-right">
            {displayBP && displayBP > 0 ? displayBP : '—'}
          </span>
          <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded-[3px] shadow-sm shrink-0 ${
            TYPE_COLORS[TYPE_NAMES[displayType]] || 'bg-gray-600 text-white'
          }`}>
            {t(`types.${TYPE_NAMES[displayType]}`, { defaultValue: TYPE_NAMES[displayType] })}
          </span>
          <span className="flex items-center justify-center shrink-0 w-4 h-4" title={categoryTitles[moveDetails.category] || 'Status'}>
            {moveDetails.category === 1 ? (
              <img src="https://i.pokebase.app/Xa6ark97i7hjvEdKKIJjx.png" alt="Speciale" className="h-4 w-auto object-contain inline-block" />
            ) : moveDetails.category === 0 ? (
              <img src="https://i.pokebase.app/u-Uv6ZGd0yirOf1cCnovO.png" alt="Fisico" className="h-4 w-auto object-contain inline-block" />
            ) : (
              <img src="https://i.pokebase.app/4auqtYtIdMdzjIaRYEGNJ.png" alt="Stato" className="h-4 w-auto object-contain inline-block" />
            )}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── ItemSearch ───────────────────────────────────────────────────────────────

export function ItemSearch({ value, onChange }) {
  const { t } = useTranslation()
  const [query, setQuery]   = useState('')
  const [focused, setFocused] = useState(false)
  const [open, setOpen]     = useState(false)

  const filtered = query.length >= 2
    ? ALL_ITEMS.filter(i => corrisponde(i, query.toLowerCase(), 'items')).slice(0, 20)
    : []

  const hasValue = focused ? query.length > 0 : !!value

  const handleClear = (e) => {
    e.preventDefault()
    setQuery('')
    onChange(null)
    setOpen(false)
  }

  return (
    <div className="relative flex items-center">
      <input
        className="w-full bg-gray-700 text-xs text-white rounded pl-2 pr-7 py-1 outline-none capitalize border border-gray-600"
        aria-label={t("ui.search_item")}
        placeholder={t("ui.search_item")}
        value={focused ? query : (value ? t(`items.${value}`, { defaultValue: value.replace(/-/g, ' ') }) : '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setFocused(true); setQuery(''); setOpen(true) }}
        onBlur={() => setTimeout(() => { setFocused(false); setOpen(false); setQuery('') }, 150)}
      />
      {hasValue && (
        <button
          type="button"
          aria-label={t('aria.clear_item')}
          onMouseDown={handleClear}
          /* Stessa correzione della copia sopra: 24×24, minimo di WCAG 2.5.8. */
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white text-xs font-bold focus:outline-none"
        >
          ✕
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full top-full bg-gray-800 border border-gray-600 rounded mt-1 max-h-40 overflow-y-auto">
          {filtered.map(i => (
            <div
              key={i}
              className="px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer capitalize"
              onMouseDown={() => { onChange(i); setQuery(''); setOpen(false) }}
            >
              {t(`items.${i}`, { defaultValue: i.replace(/-/g, ' ') })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── AbilitySelect ────────────────────────────────────────────────────────────

export function AbilitySelect({ value, abilities, onChange }) {
  const { t } = useTranslation()
  const options = abilities && abilities.length > 0 ? abilities : (value ? [value] : [])
  return (
    <select
      className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none capitalize"
      aria-label={t('aria.ability')}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(a => {
        const key = a.toLowerCase().replace(/ /g, '-')
        const displayName = t(`abilities.${key}`, { defaultValue: a.replace(/-/g, ' ') })
        return <option key={a} value={a}>{displayName}</option>
      })}
    </select>
  )
}