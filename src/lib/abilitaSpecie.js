// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import pokemonData from '../data/pokemon.json'
import { normalizeAbilityKey } from '../data/abilityEffects.js'

/**
 * ─── UNA SOLA REGOLA SU QUALE ABILITÀ PUÒ AVERE UNO SLOT ────────────────────
 *
 * Prima della sessione Z ce n'erano TRE, e non concordavano:
 *
 *   showdownIO.parseShowdownPaste   dalla sessione Y: se l'abilità non è fra
 *                                   quelle della specie, usa la prima
 *   editor/showdownHelpers.js       più vecchia e più stretta: forza la prima
 *                                   solo se la specie ne ha ESATTAMENTE UNA,
 *                                   altrimenti tiene qualunque cosa dica il
 *                                   paste — anche un'abilità impossibile
 *   store/loadFromLocalStorage      nessuna regola: riversa il valore salvato
 *
 * Il terzo caso è quello che Simone ha visto su Raichu-Mega-Y. Correggere
 * l'import non basta: una squadra salvata PRIMA della correzione se la tiene
 * per sempre, e lo stesso vale per un link condiviso.
 *
 * ─── PERCHÉ IL SINTOMO INGANNA ─────────────────────────────────────────────
 *
 * Un `<select>` il cui `value` non corrisponde a nessuna `<option>` disegna la
 * PRIMA opzione. Quindi la tendina mostra l'abilità giusta mentre lo store ne
 * tiene un'altra, e l'unico componente che dice il vero — il riquadro della
 * descrizione — sembra l'unico sbagliato.
 *
 * E non è cosmetico: il danno si calcola sull'abilità dello store.
 *
 * ─── DOVE STA ──────────────────────────────────────────────────────────────
 *
 * In `src/lib/` e non in `src/data/`: `gen-inventario-motore.mjs` scandaglia
 * `calcEngine.js`, `src/lib` e `src/utils`, e non `src/data`. È la lezione
 * della sessione Q — prima di scegliere dove sta una costante, guardare chi la
 * sorveglia.
 */
export function abilitaPerSpecie(chiaveSpecie, abilita) {
  const consentite = pokemonData[chiaveSpecie]?.abilities ?? []
  if (consentite.length === 0) return abilita ?? null
  const norm = abilita ? normalizeAbilityKey(abilita) : null
  return consentite.includes(norm) ? norm : consentite[0]
}

/**
 * Applica la regola a uno slot intero, lasciando intatto uno slot vuoto.
 * Uno slot senza specie non ha abilità da validare: forzargliene una
 * inventerebbe uno stato che l'utente non ha scelto.
 */
export function slotConAbilitaValida(slot) {
  if (!slot?.key) return slot
  const valida = abilitaPerSpecie(slot.key, slot.ability)
  return valida === slot.ability ? slot : { ...slot, ability: valida }
}
