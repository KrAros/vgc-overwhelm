// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * Bottone quadrato con la sola icona e un tooltip vero.
 *
 * Il nome accessibile è `label` (aria-label), non il tooltip: i due dicono la
 * stessa cosa ma servono a lettori diversi. `title` non basta — è lento e non
 * si apre da tastiera — quindi il tooltip è un nodo suo, visibile su hover e
 * su focus da tastiera.
 *
 * Il wrapper `group` esiste perché un `<button disabled>` non riceve hover né
 * focus: il tooltip di un'azione disabilitata («Duplica» su slot vuoto) deve
 * comunque spiegare cos'è.
 *
 * Area di tocco: 44 px su telefono, 36 px da `sm` in su, dove il puntatore è
 * preciso e la barra deve restare bassa.
 */
export default function IconButton({ label, onClick, disabled = false, active = false, tone = 'neutral', children }) {
  const colori = disabled
    ? 'bg-gray-800/40 border-gray-700/20 text-gray-400 cursor-not-allowed'
    : active
      ? 'bg-teal-800 border-teal-600 text-teal-200'
      : tone === 'amber'
        ? 'bg-amber-900/30 hover:bg-amber-900/60 text-amber-300 border-amber-700/40'
        : tone === 'ok'
          ? 'bg-green-800 border-green-600 text-green-200'
          : 'bg-gray-700/60 hover:bg-gray-700 text-gray-300 border-gray-600/40'

  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active || undefined}
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        className={`inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 ${colori}`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full mt-1 z-30 whitespace-nowrap rounded bg-gray-950 border border-gray-600 px-2 py-1 text-xs text-gray-100 shadow-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
      >
        {label}
      </span>
    </span>
  )
}
