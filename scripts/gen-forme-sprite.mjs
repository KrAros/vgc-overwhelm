// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/gen-forme-sprite.mjs
 *
 * Genera `src/data/formeSprite.json`: per ogni specie, il suffisso di forma
 * da usare nell'URL delle icone di Pokémon HOME.
 *
 * Uso:
 *   npm run forme:gen      scrive la tabella
 *   npm run forme:report   sonda e stampa, senza scrivere
 *
 * ═══ IL DIFETTO ═══════════════════════════════════════════════════════════
 *
 * `sprite.js` costruiva il suffisso così:
 *
 *     isMegaY ? 'f02' : (isMegaX || isMega || isAlola) ? 'f01' : 'f00'
 *
 * Solo mega e Alola avevano un suffisso proprio. Tutto il resto — Hisui,
 * Galar, Paldea, Therian, Origin, i due Rider di Calyrex, le forme di Deoxys
 * e di Wormadam, Urshifu Pluricolpo — ricadeva su `f00`, cioè sull'icona della
 * FORMA BASE.
 *
 * Misurato prima di intervenire: 152 specie si spartivano 57 file, quindi
 * almeno 95 mostravano l'immagine di un altro Pokémon. Il calcolo usava le
 * statistiche giuste; era solo l'immagine a mentire. Trovato percorrendo a
 * mano l'import di una squadra meta: `urshifu-rapid-strike` chiedeva
 * `icon0892_f00_s0.png`, che è Urshifu Singolcolpo.
 *
 * ═══ COME SI RICAVA IL SUFFISSO ═══════════════════════════════════════════
 *
 * Non si deduce: si CHIEDE AL SERVER. Le specie che condividono un numero di
 * Pokédex formano un gruppo, e dentro il gruppo l'ordine di `pokemon.json`
 * corrisponde all'indice di forma di HOME — `calyrex`, `calyrex-ice`,
 * `calyrex-shadow` stanno a `f00`, `f01`, `f02`.
 *
 * L'ordine è un'IPOTESI, e da sola non basterebbe: una posizione può esistere
 * e mostrare un'altra forma. Perciò il generatore fa due cose:
 *
 *   1. verifica che l'URL esista davvero (HEAD 200), e segnala chi non esiste
 *   2. produce un foglio di contatto — `scripts/forme-contatto.html` — con
 *      ogni icona accanto al proprio nome, da GUARDARE
 *
 * Il primo è un oracolo automatico, il secondo è l'occhio. Senza il secondo
 * la tabella sarebbe verificata solo per esistenza, non per identità.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIVI = !process.argv.includes('--report')
const BASE = 'https://resource.pokemon-home.com/battledata/img/pokei128/'

const pokemon = JSON.parse(fs.readFileSync(path.join(RADICE, 'src/data/pokemon.json'), 'utf8'))

/**
 * ═══ DOVE L'ORDINE DI `pokemon.json` NON È QUELLO DI HOME ══════════════════
 *
 * L'ipotesi «indice di forma = posizione in pokemon.json» regge per 151 gruppi
 * su 154, e NON è verificabile chiedendo al server: l'URL esiste comunque, è
 * solo la forma sbagliata. L'ha trovata l'occhio sul foglio di contatto.
 *
 * Ogni riga qui sotto dice come è stata verificata. Senza quella frase la
 * correzione sarebbe indistinguibile da un'altra ipotesi.
 */
const ORDINE_CORRETTO = {
  // Ogerpon — `pokemon.json` li elenca in ordine alfabetico, HOME in ordine di
  // gioco (Teal, Wellspring, Hearthflame, Cornerstone).
  // Visto a 56px: f01 è la maschera BLU (acqua = Wellspring), f03 la GRIGIA
  // (roccia = Cornerstone). Hearthflame, rossa, cadeva già giusta su f02.
  'ogerpon-wellspring':  'f01',
  'ogerpon-cornerstone': 'f03',

  // Tauros di Paldea — stesso schema: alfabetico da noi, ordine di gioco su
  // HOME (Combat, Blaze, Aqua). Visto a 128px: f01 è il toro nero SENZA segni
  // (Combat), f02 ha la criniera ROSSA (Blaze), f03 i segni BLU sulle zampe
  // (Aqua). Blaze cadeva già giusto.
  'tauros-paldea-combat': 'f01',
  'tauros-paldea-aqua':   'f03',

  // Pumpkaboo e Gourgeist — HOME ordina Average, Small, Large, Super, mentre
  // da noi la taglia Small viene prima della base. Visto a 128px: f01 è
  // nettamente il più piccolo dei quattro, quindi è Small, e f00 è Average.
  'pumpkaboo':       'f00',
  'pumpkaboo-small': 'f01',
  'gourgeist':       'f00',
  'gourgeist-small': 'f01',
}

/** Lo stesso `resolveNum` di `src/utils/sprite.js`, che qui non si può importare. */
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

const urlDi = (num, forma) => `${BASE}icon${num}_${forma}_s0.png`

/** Esiste? Una sola richiesta HEAD, senza scaricare l'immagine. */
async function esiste(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' })
    return r.status === 200
  } catch {
    return false
  }
}

/** Esegue `lavori` con al più `n` richieste in volo insieme. */
async function inCoda(lavori, n = 8) {
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

// ── raggruppa per numero, conservando l'ordine di pokemon.json ─────────────
const gruppi = new Map()
for (const chiave of Object.keys(pokemon)) {
  const n = numeroDi(chiave)
  if (!n) continue
  if (!gruppi.has(n)) gruppi.set(n, [])
  gruppi.get(n).push(chiave)
}

const daSondare = [...gruppi.entries()].filter(([, ks]) => ks.length > 1)
console.log(`Numeri con più forme   ${daSondare.length}`)
console.log(`Specie coinvolte       ${daSondare.reduce((a, [, k]) => a + k.length, 0)}`)
console.log('\nSondaggio in corso…')

const tabella = {}
const mancanti = []
const lavori = []

for (const [num, chiavi] of daSondare) {
  chiavi.forEach((chiave, i) => {
    // La posizione è l'ipotesi; l'eccezione scritta a mano ha la precedenza.
    const forma = ORDINE_CORRETTO[chiave] ?? `f${String(i).padStart(2, '0')}`
    lavori.push(async () => {
      const ok = await esiste(urlDi(num, forma))
      if (ok) tabella[chiave] = forma
      else mancanti.push({ chiave, num, forma })
      return ok
    })
  })
}

const esiti = await inCoda(lavori, 8)
const trovati = esiti.filter(Boolean).length

console.log(`\nPosizioni provate      ${esiti.length}`)
console.log(`Esistono               ${trovati}`)
console.log(`Non esistono           ${mancanti.length}`)

if (mancanti.length) {
  console.log('\n── posizioni che il server non ha ─────────────────────────')
  mancanti.slice(0, 25).forEach(m => console.log(`  ${m.chiave.padEnd(28)} ${m.num}_${m.forma}`))
  if (mancanti.length > 25) console.log(`  … e altre ${mancanti.length - 25}`)
  console.log('\nQueste specie restano senza suffisso: `sprite.js` ricade su f00,')
  console.log('cioè sul comportamento di prima. Meglio di un URL rotto.')
}

if (SCRIVI) {
  const dove = path.join(RADICE, 'src/data/formeSprite.json')
  const ordinata = Object.fromEntries(Object.keys(tabella).sort().map(k => [k, tabella[k]]))
  fs.writeFileSync(dove, JSON.stringify({
    meta: {
      generatedAt: new Date().toISOString(),
      fonte: BASE,
      metodo: 'HEAD 200 su ogni posizione, indice = ordine in pokemon.json',
      specieConForma: Object.keys(ordinata).length,
      posizioniAssenti: mancanti.length,
      note: 'Suffisso di forma per le icone di Pokémon HOME. Chi non è qui usa f00. '
          + 'Rigenerare con `npm run forme:gen`, e RIGUARDARE il foglio di contatto: '
          + 'l\'esistenza dell\'URL non prova che l\'icona sia la forma giusta.',
    },
    forme: ordinata,
  }, null, 2) + '\n')
  console.log(`\nScritto ${path.relative(RADICE, dove)}`)

  // ── foglio di contatto, per la verifica a occhio ────────────────────────
  const righe = daSondare.map(([num, chiavi]) => `
    <div class="gruppo">
      <div class="num">#${num}</div>
      ${chiavi.map((k) => {
        const forma = tabella[k]
        return `<figure class="${forma ? '' : 'assente'}">
          ${forma ? `<img src="${urlDi(num, forma)}" alt="${k}">` : '<div class="vuoto">—</div>'}
          <figcaption>${k}<br><small>${forma || 'nessuna'}</small></figcaption>
        </figure>`
      }).join('')}
    </div>`).join('')

  const html = `<!doctype html><meta charset="utf-8"><title>Forme sprite — foglio di contatto</title>
<style>
  body { background:#111; color:#ddd; font:13px system-ui; padding:16px }
  .gruppo { display:flex; align-items:center; gap:10px; border-bottom:1px solid #222; padding:4px 0 }
  .num { width:56px; color:#888; font-variant-numeric:tabular-nums }
  figure { margin:0; text-align:center; width:112px }
  img { width:64px; height:64px; image-rendering:pixelated }
  figcaption { font-size:10px; color:#aaa; line-height:1.25 }
  small { color:#666 }
  .assente .vuoto { width:64px; height:64px; border:1px dashed #444; margin:0 auto }
</style>
<h1>Forme sprite — ${Object.keys(tabella).length} specie</h1>
<p>Ogni riga è un numero di Pokédex. Guardare che l'icona corrisponda al nome sotto.</p>
${righe}`
  const dovehtml = path.join(RADICE, 'scripts/forme-contatto.html')
  fs.writeFileSync(dovehtml, html)
  console.log(`Scritto ${path.relative(RADICE, dovehtml)} — da GUARDARE, non solo generare`)
}

if (!SCRIVI) console.log('\n(--report: nessun file scritto)')
