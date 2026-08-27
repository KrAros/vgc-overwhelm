// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/gap-per-funzione.mjs
 *
 * Le abilità e gli strumenti che il riferimento calcola e noi no, raggruppati
 * per la FUNZIONE di NCP che li gestisce.
 *
 *   npm run gap:funzioni
 *
 * ─── PERCHE' PER FUNZIONE ──────────────────────────────────────────────────
 *
 * Perché è la funzione a dire quanto costa implementarne una, e soprattutto
 * quanto costa la SECONDA della stessa famiglia. Megalancio è stata la prima
 * di `calcBPMods`: ha richiesto un flag nuovo sulle mosse e un ramo nel
 * motore. Le altre diciassette di quel gruppo trovano il ramo già lì.
 *
 * L'elenco piatto in `gapNoti.json` dice COSA manca. Questo dice COME si
 * raggruppa, e quindi da dove conviene cominciare.
 *
 * ─── PERCHE' UN RAPPORTO E NON UN FILE ─────────────────────────────────────
 *
 * Perché il raggruppamento non è un dato nuovo: è già tutto dentro
 * `scripts/ncp/gap-rapporto.json`, che `gap:gen` produce e che porta per ogni
 * voce la funzione, il file e la riga. Scriverne una copia significherebbe
 * avere due elenchi che possono divergere — la malattia che questo repository
 * ha già curato tre volte. Qui si legge e si stampa, e basta.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAPPORTO = path.join(RADICE, 'scripts', 'ncp', 'gap-rapporto.json')

if (!fs.existsSync(RAPPORTO)) {
  console.error('\nManca scripts/ncp/gap-rapporto.json — generalo con `npm run gap:gen`.\n')
  process.exit(1)
}

const rapporto = JSON.parse(fs.readFileSync(RAPPORTO, 'utf8'))

/** Le voci di un canale, raggruppate per `prova.funzione`. */
function perFunzione(voci) {
  const gruppi = new Map()
  for (const v of voci) {
    const chiave = `${v.prova?.funzione ?? '?'}  (${v.prova?.file ?? '?'})`
    if (!gruppi.has(chiave)) gruppi.set(chiave, [])
    gruppi.get(chiave).push(v.chiave)
  }
  return [...gruppi.entries()].sort((a, b) => b[1].length - a[1].length)
}

function stampa(titolo, voci) {
  console.log(`\n═══ ${titolo}: ${voci.length} ═══\n`)
  for (const [funzione, elenco] of perFunzione(voci)) {
    console.log(`── ${funzione}  [${elenco.length}]`)
    console.log(`   ${elenco.sort().join(', ')}\n`)
  }
}

console.log(`\nRiferimento ${rapporto.meta.ncpCommit} · generato ${rapporto.meta.generatedAt}`)
stampa('Abilità che il riferimento calcola e noi no', rapporto.prove.abilita)
stampa('Strumenti che il riferimento calcola e noi no', rapporto.prove.strumenti)
console.log('L\'elenco piatto sta in src/data/gapNoti.json ed è quello che alimenta il')
console.log('segnalino «non calcolata». Rigenerare entrambi con `npm run gap:gen`.\n')
