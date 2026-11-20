// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

// Logica pura del pannello laterale, separata dal componente per poterla
// testare senza DOM.

// Soglia misurata con Playwright, non il `lg:` (1024) di Tailwind. Con il
// pannello aperto (colonna 360 px + gap 12) la matrice a 6 colonne ha bisogno
// di 680 px (80 + 6×100, larghezze minime fisse): a 1024 ne ha 620 e l'ultima
// colonna resta tagliata, a 1100 ne ha 696. 1100 lascia 16 px di margine anche
// con la barra di scorrimento classica (15 px).
export const SOGLIA_DESKTOP = 1100

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
