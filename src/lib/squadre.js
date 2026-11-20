// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * Soglia della matrice dei danni, separata dallo store e dai componenti:
 * è la decisione che regge la home («squadre prima, danni dopo») e così si
 * testa senza montare niente.
 */

/** Vero se almeno uno slot della squadra contiene un Pokémon. */
export function squadraHaPokemon(team) {
  return Array.isArray(team) && team.some(slot => slot?.key != null)
}

/** La matrice ha senso solo se entrambe le squadre hanno almeno un Pokémon. */
export function matriceVisibile(team1, team2) {
  return squadraHaPokemon(team1) && squadraHaPokemon(team2)
}
