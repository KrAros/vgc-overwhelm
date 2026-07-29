/**
 * src/lib/debugBus.js
 *
 * Canale fra il motore di calcolo e il pannello di debug.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 * Prima, `calcEngine.js` disegnava il pannello di debug da solo: creava nodi
 * DOM, iniettava un tag <style> nell'head e scriveva innerHTML. Tre problemi:
 *
 *   1. impossibile testare — serviva un DOM finto per chiamare la funzione
 *   2. costo per chiamata — l'array `log` veniva costruito sempre, anche a
 *      debug spento, moltiplicato per ~576 chiamate a render della tabella
 *   3. XSS reale — innerHTML interpolava nomi che possono arrivare da ?share=
 *
 * Ora il motore non conosce il DOM. Quando (e solo quando) il debug è acceso,
 * pubblica qui l'array di stringhe; `DebugPanel.jsx` lo legge e lo disegna in
 * JSX, che fa l'escaping da solo.
 *
 * ─── ACCORPAMENTO DELLE NOTIFICHE ──────────────────────────────────────────
 * Il valore viene aggiornato subito, ma gli iscritti vengono svegliati al
 * massimo una volta per frame. Senza questo, un render della tabella
 * notificherebbe React 576 volte di fila per mostrare un pannello solo.
 */

/** Il debug si attiva con ?debug=yes nell'URL. Letto una volta all'import. */
export const IS_DEBUG =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('debug') === 'yes'

let ultimoLog = null
const iscritti = new Set()
let notificaProgrammata = false

function notifica() {
  notificaProgrammata = false
  for (const fn of iscritti) fn()
}

function programmaNotifica() {
  if (notificaProgrammata) return
  notificaProgrammata = true
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(notifica)
  else setTimeout(notifica, 0)
}

/**
 * Pubblica l'ultimo log calcolato. Chiamata dal motore solo con debug acceso.
 * @param {string[] | null} log
 */
export function publishDebugLog(log) {
  ultimoLog = log
  programmaNotifica()
}

/**
 * Iscrive un ascoltatore. Firma compatibile con useSyncExternalStore.
 * @param {() => void} fn
 * @returns {() => void} funzione di disiscrizione
 */
export function subscribeDebugLog(fn) {
  iscritti.add(fn)
  return () => iscritti.delete(fn)
}

/** @returns {string[] | null} l'ultimo log pubblicato */
export function getDebugLog() {
  return ultimoLog
}

/** Usata da useSyncExternalStore in ambiente server. */
export function getServerDebugLog() {
  return null
}