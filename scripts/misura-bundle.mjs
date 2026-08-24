#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/misura-bundle.mjs
 *
 * Il peso che un visitatore scarica alla prima apertura, misurato su `dist/`.
 *
 *   npm run bundle:report    stampa e basta
 *   npm run bundle:check     stampa e FALLISCE se si sfora
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * Il criterio «JS gzip sotto 210 kB» è della sessione E, dove fu chiuso a
 * 209,27. Nessuno però lo presidiava, e il README arrivò a dichiarare 211,86
 * — cioè un numero già sopra la soglia — senza che niente diventasse rosso.
 * Era l'unico criterio del progetto senza una rete sotto, ed è esattamente il
 * criterio che è stato sforato.
 *
 * ─── IL METODO, CHE È LA PARTE CHE MANCAVA ─────────────────────────────────
 *
 * Il README notava, giustamente, che «un criterio numerico senza il metodo di
 * misura non ha un verdetto»: due strumenti davano 206,54 e 211,86, e la
 * soglia cadeva in mezzo. Quindi qui il metodo è dichiarato per intero, ed è
 * questo:
 *
 *   COSA        i file JavaScript che `dist/index.html` chiede al browser di
 *               scaricare subito — il modulo d'ingresso più i suoi
 *               `modulepreload`. Niente CSS, niente font, niente chunk
 *               caricati su richiesta.
 *   COME        `zlib.gzipSync` di Node, livello predefinito, un file per
 *               volta, e i risultati sommati.
 *   UNITÀ       kB da 1000 byte.
 *
 * Ogni scelta qui sopra sposta il numero di qualche centinaio di byte:
 * comprimere la concatenazione invece dei singoli file, o usare il livello 9,
 * dà fino a un kB in meno; la riga che Vite stampa in console ne dà circa uno
 * in più. Per questo la soglia tiene un margine ben più largo di quel kB —
 * così il verdetto è lo stesso qualunque strumento si usi, che è ciò che alla
 * sessione E mancava.
 *
 * ─── PERCHÉ SI LEGGE `index.html` E NON UN ELENCO DI NOMI ──────────────────
 *
 * Perché l'elenco scritto a mano sarebbe una seconda copia della strategia di
 * `manualChunks`, da tenere allineata. Leggendo `index.html` invece la misura
 * segue il build: il giorno in cui i dati diventassero pigri smetterebbero da
 * soli di contare, e — soprattutto — il giorno in cui il locale italiano
 * tornasse eager, comparirebbe qui. È il trabocchetto che `vite.config.js`
 * documenta in cima a `manualChunks`, ed è costato 23 kB senza che nessun
 * numero della build sembrasse sbagliato.
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const RADICE = path.resolve(import.meta.dirname, '..')
const DIST = path.join(RADICE, 'dist')

/** La soglia, in kB da 1000 byte. Criterio della sessione E, presidiato da L. */
export const SOGLIA_KB = 210

/**
 * I file JS che `index.html` fa scaricare subito: il modulo d'ingresso e i
 * suoi `modulepreload`. Sono le richieste che parlano prima che l'utente
 * tocchi qualcosa.
 */
export function fileIniziali(dist = DIST) {
  const indice = path.join(dist, 'index.html')
  if (!fs.existsSync(indice)) {
    throw new Error(`manca ${path.relative(RADICE, indice)} — lancia prima \`npm run build\``)
  }
  const html = fs.readFileSync(indice, 'utf8')

  const riferimenti = [
    ...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
    ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
  ].map(m => m[1])

  return [...new Set(riferimenti)]
    // Da `/vgc-overwhelm/assets/x.js` al file su disco. `base` può cambiare,
    // il nome del file no.
    .map(url => path.join(dist, 'assets', path.basename(url)))
    .filter(f => fs.existsSync(f))
    .sort()
}

/** Misura i file iniziali. Restituisce i byte, per file e in totale. */
export function misura(dist = DIST) {
  const file = fileIniziali(dist)
  const voci = file.map(f => ({
    nome: path.basename(f),
    grezzo: fs.statSync(f).size,
    gzip: zlib.gzipSync(fs.readFileSync(f)).length,
  }))
  return {
    voci,
    grezzo: voci.reduce((n, v) => n + v.grezzo, 0),
    gzip: voci.reduce((n, v) => n + v.gzip, 0),
  }
}

const kB = (byte) => (byte / 1000).toFixed(2)

function principale() {
  const controlla = process.argv.includes('--check')
  const r = misura()

  console.log('\nJavaScript scaricato alla prima apertura')
  console.log('  (modulo d\'ingresso + modulepreload di dist/index.html)\n')
  for (const v of r.voci) {
    console.log(`  ${v.nome.padEnd(32)} ${kB(v.grezzo).padStart(8)} kB   gzip ${kB(v.gzip).padStart(7)} kB`)
  }
  console.log(`  ${''.padEnd(32)} ${''.padStart(8)}        ${''.padStart(7)}`)
  console.log(`  ${'TOTALE'.padEnd(32)} ${kB(r.grezzo).padStart(8)} kB   gzip ${kB(r.gzip).padStart(7)} kB`)

  const soglia = SOGLIA_KB * 1000
  const margine = soglia - r.gzip
  console.log(`\n  Soglia ${SOGLIA_KB} kB · margine ${kB(margine)} kB\n`)

  if (!controlla) {
    console.log('(--report: nessun verdetto, solo la misura)\n')
    return
  }

  if (r.gzip > soglia) {
    console.error(
      `SFORATO: ${kB(r.gzip)} kB gzip contro una soglia di ${SOGLIA_KB} kB.\n`
      + 'Il criterio è della sessione E. Se la soglia va alzata è una decisione,\n'
      + 'e va scritta come tale: non si alza per far tornare verde.\n',
    )
    process.exit(1)
  }
  console.log(`Sotto la soglia di ${kB(margine)} kB.\n`)
}

if (import.meta.filename === process.argv[1]) principale()
