// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/sezioni-locale.mjs
 *
 * Come si taglia in due un file di traduzione: cosa deve stare nel bundle
 * d'ingresso e cosa può arrivare dopo.
 *
 * ─── PERCHÉ ESISTE QUESTO TAGLIO ───────────────────────────────────────────
 *
 * `en.json` viaggia STATICO, e non per distrazione: fa da lingua di ripiego.
 * Se una chiave mancasse in `it.json` — o se il pacchetto della lingua non
 * arrivasse — senza l'inglese a schermo comparirebbero le chiavi grezze.
 * `i18n.js` lo dichiara da tre sessioni.
 *
 * Il problema è che costava 22,7 kB gzip su un budget di 210, cioè l'undici
 * per cento del peso totale della prima apertura, e il margine sotto la soglia
 * era sceso a 0,15 kB.
 *
 * Misurato, quei 22,7 kB non sono una cosa sola:
 *
 *     guscio (ui, report, editor, eot, aria, gap, natures, types)   2,9 kB
 *     cataloghi (moves, abilities, items, e le descrizioni)        20,1 kB
 *
 * Il ripiego serve al GUSCIO. Sono le scritte dell'interfaccia — «Danno»,
 * «Nessun KO», i messaggi d'errore — quelle che senza traduzione diventano
 * `report.damage` e rendono la pagina illeggibile.
 *
 * I cataloghi no: sono ottocentodieci nomi di mosse, trecento di abilità,
 * trecentoventi di strumenti. Arrivano insieme alla lingua, prima del primo
 * disegno, e se non arrivassero il danno sarebbe un nome grezzo in una
 * tendina — brutto, non illeggibile.
 *
 * Quindi: il guscio resta statico e continua a fare da ripiego; i cataloghi
 * diventano pigri per tutt'e due le lingue.
 *
 * ─── PERCHÉ L'ELENCO STA QUI E NON DENTRO `vite.config.js` ─────────────────
 *
 * Perché lo leggono in due: il plugin che taglia, e il test che verifica che
 * il taglio sia ESAUSTIVO. Una sezione nuova nel file di traduzione che non
 * finisse in nessuna delle due metà sparirebbe dal bundle senza che niente
 * diventi rosso — ed è precisamente il genere di difetto che questo
 * repository ha già incontrato con `it.json` dentro `manualChunks`.
 */

/**
 * Le sezioni di primo livello che NON entrano nel bundle statico: arrivano
 * con la lingua, a richiesta.
 */
export const SEZIONI_CATALOGO = [
  'moves',
  'abilities',
  'items',
  'abilities_desc',
  'abilities_desc_on',
  'abilities_desc_off',
]

/** La metà che resta statica: il guscio dell'interfaccia. */
export function guscio(locale) {
  return Object.fromEntries(
    Object.entries(locale).filter(([sezione]) => !SEZIONI_CATALOGO.includes(sezione)),
  )
}

/** La metà che arriva dopo: i cataloghi di nomi e descrizioni. */
export function catalogo(locale) {
  return Object.fromEntries(
    Object.entries(locale).filter(([sezione]) => SEZIONI_CATALOGO.includes(sezione)),
  )
}
