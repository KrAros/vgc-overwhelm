// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/helpers/nomiAccessibili.js
 *
 * Trova i controlli interattivi senza nome accessibile dentro un markup già
 * renderizzato.
 *
 * ─── PERCHÉ È IN UN FILE A PARTE ───────────────────────────────────────────
 * Lo usano due suite, che rendono la stessa applicazione in DUE STATI diversi:
 *
 *   accessibilita.test.jsx         la pagina d'ingresso, con i team vuoti
 *   accessibilitaEditor.test.jsx   con due squadre caricate, editor pieno
 *
 * Servono due file perché lo store è un singleton letto all'import: una volta
 * seminato `localStorage`, non si torna indietro dentro lo stesso file. Vitest
 * isola i moduli per file, quindi due file danno due stati puliti.
 *
 * Ma la LOGICA di analisi deve essere una sola. Due copie della stessa
 * definizione di «senza nome» sarebbero due copie della stessa assunzione, e
 * il progetto ha già pagato per quello (`gap.test.js`, sessione F-3): un test
 * che ridefinisce ciò che verifica non verifica niente.
 *
 * ─── PERCHÉ DUE STATI, E NON SOLO UNO ──────────────────────────────────────
 * La sessione P asseriva questa proprietà solo sulla pagina d'ingresso, e ci
 * si leggeva «nessun <button> e nessun <select> senza nome». Era troppo forte:
 * con i team vuoti l'`App` renderizza DUE <select> e ZERO cursori, mentre con
 * una squadra ce ne sono dodici di cursori e molti più <select> — stadio,
 * natura, preset, abilità, strumento, mosse. Il test era cieco all'editor
 * intero e passava per questo.
 *
 * Trovato in P-2, misurando: 2 <select> visti contro i reali.
 */

const testoVisibile = (frammento) =>
  frammento.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').trim()

const attributo = (attrs, nome) =>
  new RegExp(`\\b${nome}="([^"]*)"`).exec(attrs)?.[1]

/**
 * @param {string} html  markup prodotto da `renderToStaticMarkup`
 * @returns {{bottoni: object[], tendine: object[], campi: object[], totali: object}}
 */
export function nomiAccessibili(html) {
  const etichettati = new Set(
    [...html.matchAll(/<label\b[^>]*\bfor="([^"]*)"/g)].map((m) => m[1]),
  )

  /** Un <select> o un <input> non prende il nome dal proprio contenuto: le
   *  <option> sono i valori, non l'etichetta. Serve aria-label, aria-labelledby
   *  o un <label for>. */
  const nominato = (attrs) =>
    attributo(attrs, 'aria-label') ||
    attributo(attrs, 'aria-labelledby') ||
    attributo(attrs, 'title') ||
    etichettati.has(attributo(attrs, 'id'))

  /** Per un <button> invece il testo visibile È già un nome valido. */
  const bottoni = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .filter(([, attrs, dentro]) => !testoVisibile(dentro) && !nominato(attrs))
    .map(([, attrs]) => attrs.replace(/\s+/g, ' ').trim().slice(0, 120))

  const tendine = [...html.matchAll(/<select\b([^>]*)>/g)]
    .filter(([, attrs]) => !nominato(attrs))
    .map(([, attrs]) => attrs.replace(/\s+/g, ' ').trim().slice(0, 120))

  /** `hidden` non è un controllo; i pulsanti radio/checkbox senza etichetta
   *  sarebbero un difetto, ma qui non ce ne sono e non si finge di coprirli. */
  const campi = [...html.matchAll(/<input\b([^>]*?)\/?>/g)]
    .filter(([, attrs]) => !/type="hidden"/.test(attrs) && !nominato(attrs))
    .map(([, attrs]) => attrs.replace(/\s+/g, ' ').trim().slice(0, 120))

  return {
    bottoni,
    tendine,
    campi,
    totali: {
      bottoni: (html.match(/<button\b/g) || []).length,
      tendine: (html.match(/<select\b/g) || []).length,
      campi: (html.match(/<input\b/g) || []).length,
    },
  }
}

/** Ogni ancora interna deve puntare a un id che esiste nel documento. */
export function ancoreInterne(html) {
  const ancore = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
  const identificatori = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
  return { ancore, rotte: ancore.filter((a) => !identificatori.has(a)) }
}
