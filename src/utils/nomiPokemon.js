// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import pokemonData from '../data/pokemon.json'

/**
 * ─── IL NOME DA MOSTRARE NELLA MATRICE ──────────────────────────────────────
 *
 * Prima questa logica viveva dentro `DamageTable.jsx` e tornava
 * `key.split('-')[0]` per tutto ciò che non è una Mega. Contato
 * sull'anagrafica: **82 etichette valevano per più di una specie, e 212 specie
 * perdevano identità**.
 *
 *   «Iron»     → 10 specie   Iron Hands, Iron Bundle, Iron Moth, Iron Jugulis…
 *   «Silvally» → 18
 *   «Rotom»    → 6
 *
 * E i Tesori della Rovina diventavano parole italiane per caso: `chi-yu` →
 * «Chi», `wo-chien` → «Wo», `ting-lu` → «Ting». Nella matrice si leggeva una
 * colonna intitolata «Chi». Non è un caso di nicchia: è il meta, e una matrice
 * con tre colonne «Iron» non si legge.
 *
 * Ora il nome viene da `pokemon.json`, dove è scritto per esteso ed è
 * **univoco su tutte le 1221 specie** — verificato, zero duplicati. È la regola
 * della sessione M: se una stringa esiste già nella fonte, l'interfaccia la
 * legge da lì invece di ricostruirla.
 *
 * ─── L'UNICA COMPATTAZIONE CHE RESTA ───────────────────────────────────────
 *
 * Le Mega: `Charizard-Mega-Y` → «Charizard M·Y», più corto e già approvato
 * guardandolo. Non ne invento altre — un'abbreviazione per
 * «Urshifu-Rapid-Strike» sarebbe una seconda copia del nome, e la colonna la
 * taglia già da sé con l'ellissi. Il nome intero resta nel `title`.
 *
 * ─── DOVE STA ──────────────────────────────────────────────────────────────
 *
 * In `src/utils/` e non dentro il componente: un file di componenti che esporta
 * anche funzioni rompe il fast refresh, e `eslint` lo dice. Per giunta `utils`
 * è dentro la superficie che `gen-inventario-motore.mjs` scandaglia.
 */
export function formatPokeName(key) {
  if (!key) return ''
  if (key.endsWith('-mega') || key.endsWith('-mega-x') || key.endsWith('-mega-y')) {
    const base = key.replace(/-mega-[xy]$/, '').replace(/-mega$/, '')
    const suffix = key.includes('-mega-x') ? ' M·X' : key.includes('-mega-y') ? ' M·Y' : ' Mega'
    return base.charAt(0).toUpperCase() + base.slice(1) + suffix
  }
  return pokemonData[key]?.name ?? key.split('-')[0]
}

/** Il nome intero, per il `title` quando la colonna taglia con l'ellissi. */
export function nomeCompleto(key) {
  return pokemonData[key]?.name ?? key ?? ''
}
