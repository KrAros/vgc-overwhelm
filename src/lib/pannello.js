// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

// Logica pura del pannello laterale, separata dal componente per poterla
// testare senza DOM.

// Stessa soglia del breakpoint `lg:` di Tailwind usato dal resto della home.
export const SOGLIA_DESKTOP = 1024

// Desktop: il pannello affianca la matrice (non modale, quindi `complementary`
// e nessuna trappola di tastiera). Sotto soglia occupa tutto lo schermo: lì
// serve un `dialog` modale, altrimenti la pagina dietro resterebbe raggiungibile.
export function ruoloPannello(larghezza) {
  return larghezza >= SOGLIA_DESKTOP
    ? { role: 'complementary', modale: false }
    : { role: 'dialog', modale: true }
}

// Un Esc già consumato da un altro widget (per esempio un menu a tendina negli
// editor) non deve chiudere anche il pannello.
export function eTastoChiusura(e) {
  return e.key === 'Escape' && !e.defaultPrevented
}

// Indice del prossimo elemento focalizzabile nella trappola del Tab. `corrente`
// è -1 se il focus è fuori dall'elenco. Senza elementi restituisce -1.
export function prossimoIndiceFocus(corrente, totale, indietro) {
  if (totale <= 0) return -1
  if (corrente < 0) return indietro ? totale - 1 : 0
  return (corrente + (indietro ? -1 : 1) + totale) % totale
}
