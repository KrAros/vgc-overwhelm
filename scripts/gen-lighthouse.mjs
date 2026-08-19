// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/gen-lighthouse.mjs
 *
 * Genera `docs/misure-lighthouse.json`: la prima fotografia Lighthouse del
 * sito pubblicato.
 *
 * Uso:
 *   npm run lighthouse:gen      misura e scrive il file
 *   npm run lighthouse:report   misura e stampa, senza scrivere
 *   ... -- --run=3              quante ripetizioni per combinazione (default 5)
 *
 * ═══ PERCHÉ QUESTO FILE NON STA IN `src/__tests__/fixtures/` ══════════════
 *
 * Le altre fixture del progetto sono RETI: un test le rilegge e diventa rosso
 * se il codice si muove. Questa no, e non deve diventarlo.
 *
 * Una misura Lighthouse dipende dalla rete, dalla CDN di GitHub Pages e dal
 * carico della macchina che la esegue. Cablarla in `npm run test:run` o nella
 * CI significherebbe una suite che diventa rossa quando la connessione è
 * lenta — cioè un test che non parla del codice. Il progetto ha già pagato
 * per fixture che dicevano cose che non sapevano (F-3, gap.test.js).
 *
 * Quindi questo è un REGISTRO, non una rete: sta in `docs/`, si rilegge con
 * l'occhio, e serve a dare un «prima» alla sessione che vorrà ottimizzare.
 *
 * ═══ IL CRITERIO CHE QUESTO FILE CHIUDE ═══════════════════════════════════
 *
 * Sessione E aveva scritto «Lighthouse mobile sopra 80 — da misurare, serve
 * il deploy». La soglia 80 era DEDOTTA: nessuno aveva mai misurato niente.
 * Poteva essere già soddisfatta o richiedere una sessione intera, e non c'era
 * modo di saperlo senza il deploy, che è arrivato con N.
 *
 * ═══ PERCHÉ SI MISURA PIÙ VOLTE ═══════════════════════════════════════════
 *
 * Un run solo non è una misura: è un campione. Se la dispersione fra run è
 * più larga del guadagno di un'ottimizzazione, quel guadagno non è
 * attribuibile — si è solo pescato un run fortunato.
 *
 * Perciò si registrano mediana, minimo e massimo. È l'AMPIEZZA che rende
 * leggibile un confronto futuro, non la mediana da sola.
 *
 * ═══ IL CONTROLLO CHE SI MUOVE ════════════════════════════════════════════
 *
 * Una misura può girare, produrre numeri e non vedere niente — per esempio se
 * l'emulazione mobile non venisse applicata, o se si misurasse un guscio
 * vuoto prima che React renderizzi.
 *
 * Il controllo è la coppia `mobile` / `desktop` sullo STESSO bersaglio: i due
 * profili differiscono solo per emulazione e throttling, quindi se i numeri
 * NON divergono lo strumento non sta vedendo il costo di caricamento e la
 * misura è da buttare. Alla prima sonda LCP era 2200 ms contro 545 ms.
 *
 * Il generatore lo verifica da sé e lo dichiara in `controllo`.
 *
 * NB: il confronto `deploy` / `locale` NON è un controllo valido. Lighthouse
 * usa il throttling SIMULATO (Lantern): misura su rete veloce e modella la
 * rete lenta a posteriori, quindi i due bersagli si assomigliano per
 * costruzione. Si registrano lo stesso, perché la loro differenza separa il
 * costo del bundle da quello della consegna — ma come informazione, non come
 * prova che lo strumento vede.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIVI = !process.argv.includes('--report')
const RIPETIZIONI = Number(process.argv.find((a) => a.startsWith('--run='))?.slice(6) ?? 5)

/** `--solo=locale` e `--profilo=mobile` restringono la misura, per il ciclo
 *  di lavoro: 13 secondi invece di cinque minuti.
 *
 *  Una selezione parziale FORZA la modalità report. Scrivere il registro con
 *  metà delle combinazioni produrrebbe un file che sembra completo e non lo è
 *  — cioè la classe di difetto che questo progetto insegue da tredici
 *  sessioni: una fonte che dice più di quello che sa. */
const SOLO = process.argv.find((a) => a.startsWith('--solo='))?.slice(7)
const PROFILO = process.argv.find((a) => a.startsWith('--profilo='))?.slice(10)
const PARZIALE = Boolean(SOLO || PROFILO)
const BERSAGLI = SOLO ? [SOLO] : ['deploy', 'locale']
const PROFILI = PROFILO ? [PROFILO] : ['mobile', 'desktop']

const DEPLOY = 'https://kraros.github.io/vgc-overwhelm/'
const PORTA = 4173
const LOCALE = `http://localhost:${PORTA}/vgc-overwhelm/`

/** Le cinque metriche che compongono il punteggio Performance.
 *  Si registrano in millisecondi (CLS è adimensionale): l'attribuzione di un
 *  intervento futuro si fa QUI, non sul punteggio aggregato, che è una curva
 *  non lineare sopra questi valori — tre punti di punteggio possono essere
 *  rumore mentre 200 ms di TBT in meno sono reali. */
const METRICHE = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
]

const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const riassumi = (v) => ({ mediana: +mediana(v).toFixed(3), min: Math.min(...v), max: Math.max(...v) })

/** Esegue Lighthouse una volta e ne estrae solo ciò che serve.
 *  Il rapporto completo è ~2 MB: committarlo per intero renderebbe il diff
 *  illeggibile e il file un archivio invece di un registro. */
function unRun(url, profilo) {
  const tmp = path.join(RADICE, 'node_modules/.cache/lh-run.json')
  fs.mkdirSync(path.dirname(tmp), { recursive: true })
  execSync(
    [
      'npx lighthouse', JSON.stringify(url),
      profilo === 'desktop' ? '--preset=desktop' : '',
      '--output=json', `--output-path=${JSON.stringify(tmp)}`,
      '--chrome-flags="--headless=new --no-sandbox --disable-gpu"',
      '--quiet',
    ].join(' '),
    { cwd: RADICE, stdio: ['ignore', 'ignore', 'pipe'] },
  )
  const r = JSON.parse(fs.readFileSync(tmp, 'utf8'))

  const categorie = {}
  for (const [k, v] of Object.entries(r.categories)) if (v.score !== null) categorie[k] = Math.round(v.score * 100)
  const metriche = {}
  for (const k of METRICHE) metriche[k] = +r.audits[k].numericValue.toFixed(3)

  /** Non basta il punteggio: senza sapere QUALI audit falliscono, un «84 → 92»
   *  non si attribuisce a niente. Si registrano id, peso e numero di nodi —
   *  il peso perché è quello che muove il punteggio, i nodi perché sono il
   *  lavoro da fare. */
  const falliti = {}
  for (const [cat, v] of Object.entries(r.categories)) {
    const lista = []
    for (const ref of v.auditRefs) {
      const a = r.audits[ref.id]
      if (a && a.score !== null && a.score < 1) {
        lista.push({ audit: a.id, peso: ref.weight, nodi: (a.details?.items ?? []).length })
      }
    }
    if (lista.length) falliti[cat] = lista.sort((x, y) => y.peso - x.peso || x.audit.localeCompare(y.audit))
  }

  const rete = r.audits['network-requests']?.details?.items ?? []
  return {
    categorie,
    metriche,
    falliti,
    trasferito_kB: +(rete.reduce((s, i) => s + (i.transferSize || 0), 0) / 1024).toFixed(1),
    richieste: rete.length,
    versione: r.lighthouseVersion,
  }
}

/** Ripete `unRun` e riassume. Nessuna media: la mediana regge meglio a un
 *  singolo run andato storto, che su una rete capita. */
function misura(url, profilo) {
  process.stderr.write(`  ${profilo.padEnd(8)} ${url}\n`)
  const run = []
  for (let i = 0; i < RIPETIZIONI; i++) {
    run.push(unRun(url, profilo))
    process.stderr.write(`    run ${i + 1}/${RIPETIZIONI}  performance ${run[i].categorie.performance}\n`)
  }
  const su = (f) => Object.fromEntries(Object.keys(f(run[0])).map((k) => [k, riassumi(run.map((r) => f(r)[k]))]))

  /** Gli audit falliti dovrebbero essere identici a ogni run — ma NON tutti:
   *  quelli di `performance` dipendono da soglie sui millisecondi, quindi
   *  entrano ed escono da soli. Quelli di `accessibility` no: leggono il DOM.
   *
   *  Un flag globale «qualcosa è cambiato» qui sarebbe inutilizzabile — direbbe
   *  sempre instabile per colpa di Performance, e coprirebbe proprio la
   *  categoria che si vuole usare come oracolo. Si misura PER CATEGORIA. */
  const stabile = {}
  for (const cat of new Set(run.flatMap((r) => Object.keys(r.falliti)))) {
    const impronta = (r) => JSON.stringify(r.falliti[cat] ?? [])
    stabile[cat] = run.every((r) => impronta(r) === impronta(run[0]))
  }

  return {
    profilo,
    url,
    ripetizioni: RIPETIZIONI,
    categorie: su((r) => r.categorie),
    metriche: su((r) => r.metriche),
    falliti: run[0].falliti,
    falliti_stabili: stabile,   // per categoria: vedi il commento in `misura`
    trasferito_kB: run[0].trasferito_kB,
    richieste: run[0].richieste,
  }
}

/** Avvia `vite preview`, aspetta che risponda, restituisce come spegnerlo.
 *  Serve `dist/`: se manca si esce, invece di misurare una build vecchia
 *  senza dirlo — è la classe di errore della sessione E, dove una build che
 *  passava produceva un artefatto sbagliato. */
async function conAnteprima(fn) {
  if (!fs.existsSync(path.join(RADICE, 'dist/index.html'))) {
    console.error("dist/ assente o incompleta: lancia `npm run build` prima.")
    process.exit(1)
  }
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort'], {
    cwd: RADICE, stdio: 'ignore', detached: true,
  })
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(LOCALE)).ok) break
      } catch { /* non ancora in ascolto */ }
      await new Promise((r) => setTimeout(r, 250))
    }
    return await fn()
  } finally {
    try { process.kill(-p.pid) } catch { /* già morto */ }
  }
}

const misure = []
if (BERSAGLI.includes('deploy')) {
  console.error('Deploy pubblico:')
  for (const profilo of PROFILI) misure.push({ bersaglio: 'deploy', ...misura(DEPLOY, profilo) })
}
if (BERSAGLI.includes('locale')) {
  console.error('Anteprima locale:')
  await conAnteprima(async () => {
    for (const profilo of PROFILI) misure.push({ bersaglio: 'locale', ...misura(LOCALE, profilo) })
  })
}

/** Il controllo dichiarato: mobile e desktop sullo STESSO bersaglio devono
 *  divergere. Con una selezione parziale può mancare uno dei due profili: in
 *  quel caso si dichiara «non calcolabile», non si finge che sia passato.
 *  Un controllo che si auto-assolve quando non può girare è peggio di nessun
 *  controllo. */
function calcolaControllo() {
  for (const b of ['deploy', 'locale']) {
    const m = misure.find((x) => x.bersaglio === b && x.profilo === 'mobile')
    const d = misure.find((x) => x.bersaglio === b && x.profilo === 'desktop')
    if (!m || !d) continue
    const rapporto = m.metriche['largest-contentful-paint'].mediana / d.metriche['largest-contentful-paint'].mediana
    return {
      descrizione: 'LCP mobile / LCP desktop sullo stesso bersaglio: se ~1 lo strumento non vede il throttling',
      bersaglio: b,
      lcp_mobile_ms: m.metriche['largest-contentful-paint'].mediana,
      lcp_desktop_ms: d.metriche['largest-contentful-paint'].mediana,
      rapporto: +rapporto.toFixed(2),
      esito: rapporto > 1.5 ? 'si muove' : 'CIECO — misura da buttare',
    }
  }
  return { descrizione: 'serve la coppia mobile+desktop sullo stesso bersaglio', esito: 'non calcolabile (selezione parziale)' }
}
const controllo = calcolaControllo()

const uscita = {
  condizioni: {
    misurato: new Date().toISOString().slice(0, 10),
    commit: execSync('git rev-parse --short HEAD', { cwd: RADICE }).toString().trim(),
    lighthouse: JSON.parse(fs.readFileSync(path.join(RADICE, 'package.json'), 'utf8')).devDependencies.lighthouse,
    chrome: execSync('google-chrome --version').toString().trim(),
    nota: 'Punteggi Lighthouse NON confrontabili fra versioni maggiori: le curve cambiano.',
  },
  controllo,
  misure,
}

if (controllo.esito !== 'si muove') console.error(`\n!! CONTROLLO CIECO: rapporto LCP ${controllo.rapporto}\n`)

for (const x of misure) {
  console.log(`\n── ${x.bersaglio} · ${x.profilo} · ${x.ripetizioni} run`)
  for (const [k, v] of Object.entries(x.categorie))
    console.log(`   ${k.padEnd(18)} ${String(v.mediana).padStart(5)}   (${v.min}–${v.max})`)
  for (const [k, v] of Object.entries(x.metriche))
    console.log(`   ${k.padEnd(28)} ${String(v.mediana).padStart(8)}   (${v.min}–${v.max})`)
  console.log(`   ${'trasferito'.padEnd(18)} ${x.trasferito_kB} kB in ${x.richieste} richieste`)
  for (const [cat, lista] of Object.entries(x.falliti)) {
    const nota = x.falliti_stabili[cat] ? '' : '   !! CAMBIA fra run'
    console.log(`   ── audit falliti · ${cat}${nota}`)
    for (const a of lista) console.log(`      peso ${String(a.peso).padStart(2)} · ${String(a.nodi).padStart(2)} nodi · ${a.audit}`)
  }
}
console.log(`\ncontrollo: ${controllo.rapporto ? `LCP mobile/desktop = ${controllo.rapporto}× → ` : ''}${controllo.esito}`)

if (SCRIVI && PARZIALE) {
  console.log('\n(selezione parziale: registro NON scritto — sarebbe incompleto e non lo direbbe)')
} else if (SCRIVI) {
  const dest = path.join(RADICE, 'docs/misure-lighthouse.json')
  fs.writeFileSync(dest, JSON.stringify(uscita, null, 2) + '\n')
  console.log(`\nscritto ${path.relative(RADICE, dest)}`)
} else {
  console.log('\n(--report: niente scritto)')
}
