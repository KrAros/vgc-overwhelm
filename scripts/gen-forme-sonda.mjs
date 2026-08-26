// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * ─── SONDA SOLO LE FORME IN ATTESA, E NE FA UN FOGLIO DI CONTATTO ───────────
 *
 *   npm run forme:sonda
 *
 * ─── PERCHE' NON BASTA `forme:gen` ─────────────────────────────────────────
 *
 * Per due ragioni, e la seconda e' quella che conta.
 *
 * La prima e' il costo: `forme:gen` risonda tutte e 351 le posizioni, circa
 * dieci minuti, per aggiungerne sei.
 *
 * La seconda e' il rischio. `formeSprite.json` contiene correzioni fatte a
 * OCCHIO che il generatore non sa riprodurre: `floette-mega` sta a f05 mentre
 * la regola posizionale darebbe f01, ed e' scritto in `sprite.test.js` perche'
 * su HOME quell'indice e' un Floette di un altro colore, non la Mega. Una
 * rigenerazione cieca la perderebbe. In piu' i gruppi 0080, 0199, 0618 e 0670
 * hanno guadagnato una forma, quindi l'indice posizionale delle voci
 * successive si sposta: `slowbro-mega` oggi e' f01 e diventerebbe f02.
 *
 * ─── PERCHE' UN FOGLIO DI CONTATTO E NON UN VERDETTO ───────────────────────
 *
 * Perche' l'esistenza dell'URL non prova l'identita' della forma, ed e' il
 * limite che questo repository ha gia' pagato: HOME risponde 200 a indici che
 * contengono un ALTRO Pokemon. Il caso peggiore e' proprio Floette, che sui
 * giochi principali ha cinque colori di fiore piu' l'Eterno: l'ipotesi
 * posizionale per `floette-eternal` e' f01, e f01 quasi certamente esiste ed
 * e' un fiore di un altro colore.
 *
 * Quindi questo strumento NON decide. Prova un intervallo di indici su
 * entrambe le fonti, scrive un foglio con le sole immagini candidate, e
 * lascia il verdetto a chi guarda. Le voci scelte si scrivono poi in
 * `formeSprite.json` e, se contraddicono la posizione, in `ORDINE_CORRETTO`
 * dentro `gen-forme-sprite.mjs`, cosi' una rigenerazione futura non le perde.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const TABELLA = path.join(RADICE, 'src/data/formeSprite.json')
const USCITA = path.join(RADICE, 'scripts/forme-sonda.html')

/** Stessi indirizzi di `gen-forme-sprite.mjs`. Se cambiano la', cambiano qui. */
const BASE = 'https://resource.pokemon-home.com/battledata/img/pokei128/'
const ZONE = 'https://assets.pokemon-zone.com/champions-assets/uicontents/scriptableobject/mdicon02/mdiconpersonal02/standard02/'
export const urlHome = (num, forma) => `${BASE}icon${num}_${forma}_s0.png`
export const urlZone = (num, forma) => `${ZONE}ui_PokeIcon_02_${num}_${forma.slice(1)}_0.webp`

/** Quanti indici provare. Dieci coprono Floette, che sui giochi ne ha sei. */
const INDICI = 10

const pokemon = JSON.parse(fs.readFileSync(path.join(RADICE, 'src/data/pokemon.json'), 'utf8'))
const tabella = JSON.parse(fs.readFileSync(TABELLA, 'utf8'))

const LANCIATO = import.meta.filename === process.argv[1]

const daSondare = LANCIATO ? (tabella.meta?.daSondare ?? []) : []
if (LANCIATO && !daSondare.length) {
  console.log('\nNiente da sondare: `meta.daSondare` e vuoto.')
  console.log('E il caso normale — vuol dire che ogni forma ha gia una fonte verificata.\n')
  process.exit(0)
}

/** Lo stesso `resolveNum` di `sprite.js` e di `gen-forme-sprite.mjs`. */
function numeroDi(chiave) {
  const d = pokemon[chiave]
  if (!d) return null
  let n = d.num
  if (!n) {
    const base = chiave.replace(/-mega.*$/, '').replace(/-primal$/, '').replace(/-unbound$/, '')
    n = pokemon[base]?.num || ''
  }
  return n?.replace('#', '').padStart(4, '0') || null
}

async function esiste(url) {
  try {
    return (await fetch(url, { method: 'HEAD' })).status === 200
  } catch {
    return false
  }
}

async function inCoda(lavori, n = 6) {
  const esiti = []
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < lavori.length) {
      const mio = i++
      esiti[mio] = await lavori[mio]()
    }
  }))
  return esiti
}

if (!LANCIATO) {
  // Importato da un test: si espongono i costruttori di URL e basta.
} else {

console.log(`\nForme in attesa: ${daSondare.length}`)
console.log(`Indici provati:  f00…f${String(INDICI - 1).padStart(2, '0')} su entrambe le fonti`)
console.log(`Richieste:       ${daSondare.length * INDICI * 2}\n`)

const lavori = []
const trovate = {}
for (const chiave of daSondare) {
  const num = numeroDi(chiave)
  if (!num) { console.log(`  ${chiave}: nessun numero, salto`); continue }
  trovate[chiave] = { num, candidate: [] }
  for (let i = 0; i < INDICI; i++) {
    const forma = `f${String(i).padStart(2, '0')}`
    lavori.push(async () => {
      const [h, z] = await Promise.all([esiste(urlHome(num, forma)), esiste(urlZone(num, forma))])
      if (h) trovate[chiave].candidate.push({ forma, fonte: 'home', url: urlHome(num, forma) })
      if (z) trovate[chiave].candidate.push({ forma, fonte: 'zone', url: urlZone(num, forma) })
    })
  }
}

await inCoda(lavori)

for (const [chiave, v] of Object.entries(trovate)) {
  v.candidate.sort((a, b) => a.forma.localeCompare(b.forma) || a.fonte.localeCompare(b.fonte))
  const attuale = tabella.forme[chiave]
  console.log(`  ${chiave.padEnd(18)} ${v.num}  in tabella: ${attuale} (${tabella.fonte[chiave]})  ·  candidate: ${
    v.candidate.length ? v.candidate.map(c => `${c.forma}/${c.fonte}`).join(' ') : 'NESSUNA'}`)
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>Sonda delle forme in attesa</title>
<style>
 body{background:#1f2937;color:#e5e7eb;font:14px system-ui;padding:24px}
 h1{font-size:18px} h2{font-size:15px;margin:28px 0 8px;color:#fff}
 .nota{color:#9ca3af;max-width:60em;line-height:1.5}
 .riga{display:flex;flex-wrap:wrap;gap:14px}
 .c{background:#111827;border:1px solid #374151;border-radius:6px;padding:8px;text-align:center;width:110px}
 .c img{width:64px;height:64px;object-fit:contain;image-rendering:pixelated;background:#0b1220;border-radius:4px}
 .c div{margin-top:6px;font-size:12px;color:#9ca3af}
 .vuoto{color:#f87171}
</style>
<h1>Forme in attesa di verifica</h1>
<p class="nota">Ogni riquadro è un indice che il server ha davvero (HEAD 200). <b>L'esistenza dell'URL non prova
che l'immagine sia la forma giusta</b> — è il motivo per cui questo foglio esiste. Guarda l'immagine, decidi
quale indice è la forma cercata, e riporta la coppia <code>indice/fonte</code>.</p>
${Object.entries(trovate).map(([chiave, v]) => `
<h2>${chiave} <span style="color:#9ca3af;font-weight:400">· ${v.num} · in tabella ${tabella.forme[chiave]} (${tabella.fonte[chiave]})</span></h2>
${v.candidate.length ? `<div class="riga">${v.candidate.map(c => `
  <div class="c"><img src="${c.url}" alt="${chiave} ${c.forma} ${c.fonte}" loading="lazy">
  <div>${c.forma} · ${c.fonte}</div></div>`).join('')}</div>`
  : '<p class="vuoto">Nessun indice esiste su nessuna delle due fonti: la voce resta senza icona.</p>'}`).join('')}
`

fs.writeFileSync(USCITA, html)
console.log(`\nScritto ${path.relative(RADICE, USCITA)} — aprilo e guarda le immagini.`)
console.log('Poi riporta la coppia indice/fonte per ogni forma: si scrive in')
console.log('formeSprite.json, e se contraddice la posizione anche in ORDINE_CORRETTO.\n')

}
