// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/potatura-dati.mjs
 *
 * I campi dei dati di gioco che **il bundle non deve portare**, perché nessuna
 * riga di `src/` li legge.
 *
 * ─── PERCHÉ POTARE, E PERCHÉ SOLO NEL BUNDLE ───────────────────────────────
 *
 * `src/data/*.json` serve due padroni con bisogni diversi:
 *
 *   l'applicazione   legge un sottoinsieme dei campi, e ogni byte che scarica
 *                    è un byte pagato da chi apre il sito
 *   gli script       leggono i file interi: `gen-flag-dati.mjs` aggiudica i
 *                    pesi contro il riferimento, e senza `weight` non
 *                    potrebbe farlo
 *
 * Cancellare i campi dal file sorgente servirebbe il primo e romperebbe il
 * secondo. La potatura sta quindi **nel build**, non nel dato: su disco il
 * file resta intero, nel bundle entra magro.
 *
 * ─── IL RISCHIO, E LA RETE ─────────────────────────────────────────────────
 *
 * Una potatura che gira solo in produzione (`apply: 'build'`) è muta per
 * costruzione: sviluppo e test vedono i file interi, quindi il giorno in cui
 * qualcuno scrivesse `data.weight` in un componente, la suite resterebbe
 * verde e la pagina pubblicata mostrerebbe `undefined`. È esattamente la
 * cecità osservativa di CONTRIBUTING.md, spostata dal numero al campo.
 *
 * La rete è `potaturaDati.test.js`, che rilegge `src/` cercando ognuno dei
 * campi elencati qui. Non è un test di comportamento — è un test statico, ed
 * è l'unica forma che può fallire prima del deploy invece che dopo.
 *
 * Aggiungere un campo qui è quindi un'affermazione forte: «nessuno lo legge».
 * Il test la verifica; se un giorno smette di essere vera, va tolto da qui,
 * non silenziato là.
 */

/**
 * Per ogni file, i campi da togliere a ogni voce del dizionario.
 * `_radice` toglie invece una chiave di primo livello, non una per voce.
 */
export const CAMPI_POTATI = {
  'pokemon.json': {
    voci: [
      // Aggiudicato in `gen-flag-dati.mjs`, che dichiara a chiare lettere
      // «`weight` non è letto da src/». Le mosse che lo userebbero (Grass
      // Knot, Heavy Slam) sono nel gap dichiarato.
      'weight',
      // Nessun calcolo dei doppi guarda il genere: Rivalry e Attract non
      // sono nel motore, e il formato non li espone.
      'gender',
      // La forma Mega si decide dallo slug della specie e da
      // `ITEM_EFFECTS[x].megaStone` (calcEngine:78), mai da questo campo.
      'mega',
    ],
  },
  'moves.json': {
    // Le icone delle mosse sono tre, per categoria, e non passano dal numero:
    // `sprite.js` usa `.num` per Pokémon e strumenti, e non importa questo
    // file. Nessuno dei dieci che lo importano legge `.num`.
    voci: ['num'],
  },
  'formeSprite.json': {
    // `sprite.js` — l'unico che lo importa — legge `.forme` e `.fonte`. `meta`
    // è la nota del generatore: dice come rigenerare il file, e serve a chi lo
    // apre, non al browser.
    //
    // Da notare: `sprite.test.js:183` legge `meta.fonti` per verificare che la
    // tabella dichiari la propria provenienza. Non è un problema, ed è la
    // ragione per cui la potatura è `apply: 'build'`: i test vedono sempre il
    // file intero. Provato — aliasando il file potato dentro la suite, quel
    // test è l'UNICO dei 1969 a cadere, e cade su un campo che nel browser non
    // arriva comunque.
    radice: ['meta'],
  },
}

/**
 * ─── PERCHÉ LA RETE GUARDA SOLO CHI IMPORTA ────────────────────────────────
 *
 * `potaturaDati.test.js` cerca il campo per NOME — `.num`, `['num']`, la
 * destrutturazione — ma **solo nei file che importano quel file di dati**.
 * Le due metà della regola rispondono a due errori diversi, e servono
 * entrambe:
 *
 *   cercare per nome        perché l'accesso può essere indiretto. In
 *                           `sprite.js` c'è `let num = data.num`, dove `data`
 *                           è un parametro: nessuna analisi lega quel `.num`
 *                           al file d'origine senza seguire il flusso. Il
 *                           nome, invece, si vede sempre.
 *
 *   solo in chi importa     perché `num` sta in tre file di dati e `meta` in
 *                           due. Cercandolo in tutto `src/`, il `.num` di
 *                           `itemsData` vieterebbe di potare quello di
 *                           `moves.json` — un divieto che non protegge niente
 *                           e costa 2424 byte a ogni visitatore.
 *
 * Un file che non importa `moves.json` non può leggerne un campo, nemmeno per
 * sbaglio: è l'unico confine che regge senza seguire il flusso dei dati.
 */

/** Applica la potatura a un oggetto già deserializzato. Non muta l'ingresso. */
export function pota(nomeFile, dati) {
  const regole = CAMPI_POTATI[nomeFile]
  if (!regole) return dati

  let out = dati
  if (regole.radice?.length) {
    out = { ...out }
    for (const chiave of regole.radice) delete out[chiave]
  }
  if (regole.voci?.length) {
    const potato = {}
    for (const [chiave, valore] of Object.entries(out)) {
      if (!valore || typeof valore !== 'object' || Array.isArray(valore)) {
        potato[chiave] = valore
        continue
      }
      const voce = { ...valore }
      for (const campo of regole.voci) delete voce[campo]
      potato[chiave] = voce
    }
    out = potato
  }
  return out
}

/** Tutti i campi potati, appiattiti — è l'elenco che il test va a cercare in `src/`. */
export function campiPotati() {
  return Object.entries(CAMPI_POTATI).flatMap(([file, regole]) => [
    ...(regole.voci ?? []).map(campo => ({ file, campo, dove: 'voci' })),
    ...(regole.radice ?? []).map(campo => ({ file, campo, dove: 'radice' })),
  ])
}
