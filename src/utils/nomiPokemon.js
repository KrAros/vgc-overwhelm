// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import pokemonData from '../data/pokemon.json'
import roster from '../data/rosterChampions.json'

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

/**
 * ─── CONFRONTO PER LA RICERCA: I SEGNI NON CONTANO ──────────────────────────
 *
 * La ricerca delle specie confrontava la query con lo SLUG e basta, con un
 * `includes` secco. Le chiavi usano il trattino, quindi scrivere uno spazio
 * dava **zero risultati**: «iron h» → 0, «flutter m» → 0, «chi y» → 0.
 * Bisognava indovinare il trattino, e sono 241 le specie con la chiave
 * composta.
 *
 * E il nome vero non veniva guardato affatto: `Mr. Mime` e `Type: Null` si
 * trovavano solo scrivendo `mr-mime` e `type-null`.
 *
 * Qui si confrontano slug e nome dopo aver tolto tutto ciò che non è lettera o
 * cifra, da entrambe le parti: una regola sola che copre spazi, trattini,
 * punti e due punti insieme.
 */
const soloLettere = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function cercaSpecie(chiave, query) {
  const q = soloLettere(query)
  if (!q) return false
  return soloLettere(chiave).includes(q) || soloLettere(pokemonData[chiave]?.name).includes(q)
}

/**
 * ─── LE SPECIE DI CHAMPIONS VENGONO PRIMA ───────────────────────────────────
 *
 * L'anagrafica ha 1221 specie perché è quella completa. Champions ne ha molte
 * meno, e la ricerca mostrava i primi 20 risultati in ordine alfabetico: chi
 * cercava «char» vedeva Charmander, Charmeleon, Charizard e le sue Mega
 * mescolati a tutto il resto, senza nessun aiuto su cosa il gioco abbia
 * davvero.
 *
 * ─── PERCHÉ ORDINA E NON FILTRA, E NEMMENO ETICHETTA ───────────────────────
 *
 * Il registro viene da **una fonte sola**, e ha falsi negativi dimostrati:
 * `basculegion-f` risulta dentro e `basculegion-m` fuori, perché quella fonte
 * la chiama `basculegion` e basta. Sono i dieci disallineamenti di nome
 * contati durante la sonda.
 *
 * Con quei falsi negativi:
 *
 *   filtrare   nasconderebbe specie che il gioco ha — il difetto peggiore di
 *              quello che stiamo correggendo
 *   etichettare direbbe «non è in Champions» di un Pokémon che c'è, cioè un
 *              valore presente e sbagliato, che questo progetto ha già pagato
 *              cinque volte
 *   ordinare   non afferma niente. Se il registro sbaglia, il risultato è che
 *              una specie compare qualche riga più in basso
 *
 * Quando la fonte sarà confermata, stringere è una riga.
 */
const NEL_ROSTER = new Set(roster.nel_roster)

export function inRosterChampions(chiave) {
  return NEL_ROSTER.has(chiave)
}

/** Ordina mettendo davanti le specie che la fonte conosce, a parità alfabetico. */
export function ordinaPerRoster(chiavi) {
  return [...chiavi].sort((a, b) => {
    const d = (NEL_ROSTER.has(b) ? 1 : 0) - (NEL_ROSTER.has(a) ? 1 : 0)
    return d !== 0 ? d : a.localeCompare(b)
  })
}
