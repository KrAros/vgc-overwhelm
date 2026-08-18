// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/campi-meta.mjs
 *
 * Quali campi di `ABILITY_EFFECTS` / `ITEM_EFFECTS` NON sono meccanica.
 *
 * ─── PERCHÉ UN POSTO SOLO ──────────────────────────────────────────────────
 * Perché ne esistevano due copie identiche — in `gen-gap-noti.mjs` e in
 * `gap.test.js` — e sono state la ragione per cui il punto cieco è
 * sopravvissuto: il test controllava il generatore usando la definizione del
 * generatore. Due copie della stessa assunzione non sono due verifiche.
 *
 * ─── `utility` È META, NON MECCANICA ───────────────────────────────────────
 * Lo dice il commento che la introduce, in `itemEffects.js:30`:
 *
 *     utility:  flag per item che non impattano i rolls (solo dropdown)
 *
 * Il campo dichiara «non tocco il danno», e `haEffetto` lo contava come
 * effetto. Risultato: sei strumenti — `sitrus berry`, `leftovers`,
 * `lum berry`, `white herb`, `mental herb`, `focus sash` — risultavano
 * calcolati e non potevano ricevere il badge, qualunque cosa facesse il
 * riferimento. Era la direzione pericolosa: nessun badge su voci che l'app
 * non applica, cioè l'utente che si fida di un numero incompleto.
 *
 * Tolto `utility` dai campi meccanici, ognuno dei sei viene giudicato dal
 * confronto con NCP come tutti gli altri. Chi di loro il motore applica
 * davvero per nome — `sitrus berry` e `leftovers`, in `damage.js` — lo
 * ripesca `classificazione-badge.mjs`.
 */

/** Campi descrittivi o di sola interfaccia: non promettono niente sul danno. */
export const SOLO_META = new Set([
  'desc',
  'descOn',
  'descOff',
  'showInSmogon',
  'name',
  'utility',
])

/** Vero se la voce dichiara almeno un campo che tocca il calcolo. */
export function haEffetto(voce) {
  return Object.keys(voce).some(k => !SOLO_META.has(k))
}
