// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * ─── L'IMMAGINE DI ANTEPRIMA, GENERATA E NON DISEGNATA A MANO ───────────────
 *
 *   npm run og:gen
 *
 * Produce `public/og-image.png`, 1200×630 — la misura che Open Graph si
 * aspetta e che Discord, X, WhatsApp e Google ritagliano senza deformare.
 *
 * ─── PERCHÉ UNO SCRIPT E NON UN FILE DISEGNATO ─────────────────────────────
 *
 * Perché lo sfondo è uno SCORCIO VERO dell'app, non un mockup: lo script
 * avvia l'anteprima, semina una squadra, fotografa la matrice e la compone
 * sotto il titolo. Se l'interfaccia cambia, l'immagine si rifà con un comando
 * invece di invecchiare in silenzio come farebbe un PNG committato a mano.
 *
 * E c'è una seconda ragione, dichiarata: lo scorcio contiene icone e nomi
 * Pokémon, quindi ricade dentro la decisione Nintendo ancora aperta. Se quella
 * decisione cambia, `SCORCIO = false` qui sotto produce la versione senza —
 * una riga, non un lavoro di grafica.
 *
 * ─── COSA NON FA ───────────────────────────────────────────────────────────
 *
 * Non verifica che l'immagine sia BELLA: quello lo copre l'occhio. Verifica
 * che esista, che misuri 1200×630 e che pesi meno del limite oltre il quale
 * alcuni client smettono di scaricarla.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORTA = 4190
const URL = `http://localhost:${PORTA}/vgc-overwhelm/`
const USCITA = path.join(RADICE, 'public/og-image.png')

/** Con `false` l'immagine esce senza lo scorcio dell'app. Vedi sopra. */
const SCORCIO = true

const FIAMMA = fs.readFileSync(path.join(RADICE, 'public/favicon.svg'), 'utf8')
  .replace(/<\?xml[^>]*\?>/, '').trim()

const slot = (k, m) => ({
  key: k, moves: m, sps: [8, 20, 4, 0, 4, 30], nature: 'jolly',
  ability: null, item: null, atkBoost: 0, defBoost: 0, spAtkBoost: 0,
  spDefBoost: 0, speBoost: 0, abilityFlags: {}, lastRespectsKOs: 0,
})
const MOSSE = ['flamethrower', 'earthquake', 'rock slide', 'protect']
const SQUADRE = {
  team1: ['charizard-mega-y', 'incineroar', 'rillaboom', 'amoonguss', 'dragonite', 'flutter-mane'].map(k => slot(k, MOSSE)),
  team2: ['gholdengo', 'chi-yu', 'kingambit', 'urshifu', 'ogerpon', 'volcarona'].map(k => slot(k, MOSSE)),
}

async function conAnteprima(fn) {
  if (!fs.existsSync(path.join(RADICE, 'dist/index.html'))) {
    console.error('dist/ assente: lancia `npm run build` prima.')
    process.exit(1)
  }
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort'],
    { cwd: RADICE, stdio: 'ignore', detached: true })
  await new Promise(r => setTimeout(r, 3500))
  try { return await fn() } finally { try { process.kill(-p.pid) } catch { /* già morto */ } }
}

const chrome = execSync('which google-chrome || which chromium || true').toString().trim()
if (!chrome) { console.error('Chrome non trovato.'); process.exit(1) }

await conAnteprima(async () => {
  const b = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'] })
  try {
    // ── 1. lo scorcio: la matrice, fotografata dall'app vera ──────────────
    let sfondo = null
    if (SCORCIO) {
      const p = await b.newPage()
      await p.setViewport({ width: 1500, height: 900, deviceScaleFactor: 2 })
      await p.evaluateOnNewDocument((s) => {
        localStorage.setItem('lang', 'en')
        localStorage.setItem('vgc-overwhelm-teams', JSON.stringify(s))
      }, SQUADRE)
      await p.goto(URL, { waitUntil: 'networkidle0' })
      await new Promise(r => setTimeout(r, 1500))
      const grid = await p.$('[role="grid"]')
      if (!grid) throw new Error('matrice non trovata: lo scorcio sarebbe vuoto')
      // Si ritaglia SOTTO l'intestazione: il primo scatto prendeva la riga dei
      // nomi e degli sprite, che in trasparenza diventa grigio informe. Le
      // celle colorate sono quelle che fanno capire cosa sia lo strumento.
      const box = await grid.boundingBox()
      sfondo = await p.screenshot({ encoding: 'base64', clip: {
        x: box.x + box.width * 0.34, y: box.y + 96,
        width: Math.min(box.width * 0.66, 760), height: Math.min(box.height - 96, 470),
      } })
      await p.close()
    }

    // ── 2. la composizione ────────────────────────────────────────────────
    const p = await b.newPage()
    await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
    // Si NAVIGA prima sull'origine dell'anteprima e poi si riscrive il
    // documento: così il woff2 di Inter si risolve come URL relativa e il
    // titolo esce nello stesso carattere dell'app invece che in un ripiego.
    await p.goto(URL, { waitUntil: 'networkidle0' })
    const woff = fs.readdirSync(path.join(RADICE, 'dist/assets'))
      .find(f => /^inter-latin-wght.*\.woff2$/.test(f))
    if (!woff) throw new Error('font Inter non trovato in dist/assets')

    await p.evaluate(({ fiamma, sfondo, woff }) => {
      document.head.innerHTML = `<style>
        @font-face { font-family:'InterOG'; src:url('/vgc-overwhelm/assets/${woff}') format('woff2'); font-weight:100 900; }
        *{margin:0;padding:0;box-sizing:border-box}
        body{width:1200px;height:630px;background:#0f1420;font-family:'InterOG',system-ui,sans-serif;
             overflow:hidden;position:relative;color:#fff}
        /* Lo scorcio vive nella metà destra e resta leggibile: a .18 era rumore
           grigio e non si capiva che fosse una matrice di danno. */
        .scorcio{position:absolute;top:-6%;right:-3%;width:62%;height:112%;
                 background-size:cover;background-position:center;opacity:.5;
                 transform:rotate(-1.2deg)}
        /* Sfuma da sinistra: opaco dove sta il testo, quasi trasparente a
           destra dove lo scorcio deve vedersi. */
        .velo{position:absolute;inset:0;background:
              linear-gradient(90deg,#0f1420 0%,#0f1420 40%,rgba(15,20,32,.86) 56%,rgba(15,20,32,.35) 82%,rgba(15,20,32,.55) 100%)}
        .contenuto{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;
                   padding:0 78px;gap:20px;max-width:74%}
        .riga{display:flex;align-items:center;gap:20px}
        .riga svg{width:92px;height:92px;filter:drop-shadow(0 0 26px rgba(249,115,22,.45))}
        h1{font-size:78px;font-weight:300;letter-spacing:-.02em;line-height:1}
        h1 b{font-weight:700}
        .sotto{font-size:31px;color:#cbd5e1;font-weight:400;letter-spacing:.005em}
        .chip{display:flex;gap:12px;margin-top:6px}
        .chip span{font-size:19px;color:#fdba74;border:1px solid rgba(249,115,22,.42);
                   border-radius:999px;padding:8px 20px;background:rgba(249,115,22,.09)}
        .filo{position:absolute;left:0;right:0;bottom:0;height:6px;
              background:linear-gradient(90deg,#f97316,#fb923c 42%,transparent)}
      </style>`
      document.body.innerHTML = `
        ${sfondo ? `<div class="scorcio" style="background-image:url('data:image/png;base64,${sfondo}')"></div>` : ''}
        <div class="velo"></div>
        <div class="contenuto">
          <div class="riga">${fiamma}<h1>The Sixth <b>Ember</b></h1></div>
          <div class="sotto">Pokémon Champions Damage Calculator</div>
          <div class="chip"><span>Doubles</span><span>SP system</span><span>Mega Evolution</span></div>
        </div>
        <div class="filo"></div>`
    }, { fiamma: FIAMMA, sfondo, woff })

    await p.evaluate(() => document.fonts.ready)
    await new Promise(r => setTimeout(r, 400))
    await p.screenshot({ path: USCITA })
    await p.close()
  } finally { await b.close() }
})

/**
 * ─── L'ICONA PER IL TELEFONO ────────────────────────────────────────────────
 *
 * iOS ignora la favicon SVG quando si aggiunge il sito alla schermata home:
 * vuole un PNG. Senza, mette uno screenshot sgranato della pagina. Si genera
 * dalla STESSA fiamma, cosi' non esiste una seconda copia del logo da tenere
 * allineata.
 */
await conAnteprima(async () => {
  const b = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'] })
  try {
    const p = await b.newPage()
    await p.setViewport({ width: 180, height: 180, deviceScaleFactor: 1 })
    await p.goto(URL, { waitUntil: 'networkidle0' })
    await p.evaluate((fiamma) => {
      document.head.innerHTML = `<style>*{margin:0;padding:0}
        body{width:180px;height:180px;background:#0f1420;display:flex;
             align-items:center;justify-content:center}
        svg{width:132px;height:132px}</style>`
      document.body.innerHTML = fiamma
    }, FIAMMA)
    await new Promise(r => setTimeout(r, 200))
    await p.screenshot({ path: path.join(RADICE, 'public/apple-touch-icon.png') })
    await p.close()
  } finally { await b.close() }
})

const kB = (fs.statSync(USCITA).size / 1024).toFixed(1)
const kBi = (fs.statSync(path.join(RADICE, 'public/apple-touch-icon.png')).size / 1024).toFixed(1)
console.log(`  og-image.png        ${kB} kB · scorcio ${SCORCIO ? 'sì' : 'no'}`)
console.log(`  apple-touch-icon.png ${kBi} kB · 180×180`)
