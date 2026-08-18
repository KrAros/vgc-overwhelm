// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/gen-inventario-motore.mjs
 *
 * Genera `src/__tests__/fixtures/inventario-motore.json`: l'elenco delle
 * abilità e degli strumenti su cui il NOSTRO motore ramifica davvero.
 *
 * Uso:
 *   npm run inventario:gen      scrive la fixture
 *   npm run inventario:report   stampa e basta
 *
 * ═══ PERCHÉ ESISTE ════════════════════════════════════════════════════════
 *
 * Il badge «non calcolata» nasce da `gen-gap-noti.mjs`, che decideva «noi lo
 * calcoliamo» guardando UNA cosa sola: se la voce in `ABILITY_EFFECTS` o
 * `ITEM_EFFECTS` ha campi oltre a `desc`. È un proxy, e sbagliava in entrambe
 * le direzioni:
 *
 *   Pixilate è implementata a `calcEngine.js:200` — cambia il tipo della
 *   mossa e spinge ×1,2 sulla potenza — ma in tabella ha solo `desc`.
 *   Risultato: badge «non calcolata» su un numero corretto.
 *
 *   `focus sash` e soci dichiarano il campo `utility`, che non è meccanico
 *   ma rendeva `haEffetto` vero. Risultato: nessun badge su voci che nessuna
 *   riga applica.
 *
 * `gap.test.js` non poteva accorgersene: alla riga 37 ridefinisce lo stesso
 * `haEffetto`, quindi cercava i badge di troppo solo fra le voci che per
 * costruzione non possono averlo. Test verde, punto cieco condiviso.
 *
 * È la regola dei due oracoli indipendenti, violata: la seconda fonte non
 * deve condividere l'assunzione della prima. Questo file È la seconda fonte,
 * e non importa nessuna delle due tabelle.
 *
 * ═══ LA SUPERFICIE ════════════════════════════════════════════════════════
 *
 * Solo lo strato che produce i numeri mostrati: `calcEngine.js`, `src/lib/` e
 * `src/utils/`. Fuori restano
 *
 *   src/components/  mostra, non calcola
 *   src/data/        dichiara, non applica — ed è proprio la fonte di cui
 *                    questo inventario deve essere indipendente
 *
 * ═══ COSA PROVA UN RISCONTRO, E COSA NO ═══════════════════════════════════
 *
 * Che il motore NOMINA quella voce. NON che ne applichi l'effetto per cui il
 * riferimento la calcola: `sand force` compare in `damage.js` perché è immune
 * alla sabbia, mentre NCP la calcola per il +30% di potenza in `calcBPMods`.
 * Sono due meccaniche diverse e il badge resta corretto.
 *
 * Per questo l'inventario non decide da solo: ogni collisione fra inventario e
 * badge va classificata a mano in `scripts/classificazione-badge.mjs`, con la
 * motivazione. Una collisione senza classificazione ferma il generatore.
 * È lo stesso patto della riga di prova in `gen-gap-noti.mjs`: una lista che
 * nessuno può controllare è una lista di cui fidarsi per fede.
 *
 * I COMMENTI VENGONO TOLTI PRIMA DI CERCARE. Metà dei nomi di abilità in
 * questo repo compare in una frase di spiegazione, e `speedOrder.js` cita
 * `'sand rush'` tre volte in un commento che racconta un baco.
 *
 * ═══ FALSIFICABILITÀ, MISURATA ════════════════════════════════════════════
 *
 * Togliendo il ramo `pixilate` da `calcEngine.js:200`, le abilità inventariate
 * scendono da 17 a 16 e i badge da togliere da 6 a 5. Il rilevatore vede la
 * differenza: non è una sonda cieca.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLASSIFICAZIONE } from './classificazione-badge.mjs'

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIVI = !process.argv.includes('--report')

// ───────────────────────────────────────────────────────────────────────────
// Lettura della superficie
// ───────────────────────────────────────────────────────────────────────────

const SUPERFICIE = ['src/calcEngine.js', 'src/lib', 'src/utils']

function raccogliFile(rel) {
  const intero = path.join(RADICE, rel)
  if (fs.statSync(intero).isFile()) return [intero]
  const dentro = []
  for (const v of fs.readdirSync(intero)) {
    const p = path.join(intero, v)
    if (fs.statSync(p).isDirectory()) dentro.push(...raccogliFile(path.relative(RADICE, p)))
    else if (/\.(js|jsx)$/.test(v)) dentro.push(p)
  }
  return dentro
}

/**
 * Toglie commenti di blocco e di riga sostituendoli con spazi della stessa
 * lunghezza: così i numeri di riga restano quelli del file vero.
 */
function togliCommenti(testo) {
  return testo
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))
}

const FILE = SUPERFICIE.flatMap(raccogliFile).sort()
const SORGENTI = FILE.map(f => ({
  file: path.relative(RADICE, f),
  righe: togliCommenti(fs.readFileSync(f, 'utf8')).split('\n'),
}))

// ───────────────────────────────────────────────────────────────────────────
// Ricerca
// ───────────────────────────────────────────────────────────────────────────

const abilita = JSON.parse(fs.readFileSync(path.join(RADICE, 'src/data/abilities.json'), 'utf8'))
const strumenti = JSON.parse(fs.readFileSync(path.join(RADICE, 'src/data/items.json'), 'utf8'))

/**
 * La chiave, citata come letterale di stringa. Accetta le tre convenzioni del
 * progetto — spazi, trattini, underscore — perché `abilities.json` scrive
 * `long reach` e `calcEngine.js` scrive `long-reach`. Cercare una sola forma
 * è la disallineatura che in §1.8 aveva spento Sand Rush per mesi, ed è la
 * stessa che alla prima stesura di questo file mi aveva nascosto Long Reach.
 */
function regexPer(chiave) {
  const varianti = chiave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s\-_]+/g, '[\\s\\-_]+')
  return new RegExp(`['"\`]${varianti}['"\`]`, 'i')
}

function cerca(chiave) {
  const re = regexPer(chiave)
  for (const { file, righe } of SORGENTI) {
    for (let i = 0; i < righe.length; i++) {
      if (re.test(righe[i])) return { file, riga: i + 1, testo: righe[i].trim().slice(0, 120) }
    }
  }
  return null
}

function inventaria(elenco) {
  const trovate = []
  for (const chiave of Object.keys(elenco)) {
    const prova = cerca(chiave)
    if (prova) trovate.push({ chiave, prova })
  }
  return trovate
}

// ───────────────────────────────────────────────────────────────────────────
// Generazione
// ───────────────────────────────────────────────────────────────────────────

const gapNoti = JSON.parse(fs.readFileSync(path.join(RADICE, 'src/data/gapNoti.json'), 'utf8'))
const nelGap = {
  abilita: new Set(gapNoti.abilita),
  strumenti: new Set(gapNoti.strumenti),
}

const inventario = {
  abilita: inventaria(abilita),
  strumenti: inventaria(strumenti),
}

const problemi = []

/**
 * Le voci classificate, con la prova ripescata dall'inventario.
 *
 * Sta nella fixture INDIPENDENTEMENTE dal fatto che oggi portino ancora il
 * badge, ed è voluto: dopo la correzione le collisioni spariscono, e se il
 * test guardasse solo quelle diventerebbe vuoto. Guardando le classificate,
 * invece, resta capace di fallire per sempre — basta che qualcuno rigeneri
 * `gapNoti.json` senza la sottrazione.
 */
const classificate = []
for (const tipo of ['abilita', 'strumenti']) {
  for (const [chiave, c] of Object.entries(CLASSIFICAZIONE[tipo])) {
    const voce = inventario[tipo].find(v => v.chiave === chiave)
    if (!voce) {
      problemi.push(`${tipo}: «${chiave}» è classificata ma il motore non la nomina più — la riga in classificazione-badge.mjs è scaduta`)
      continue
    }
    classificate.push({ chiave, tipo, verdetto: c.verdetto, nota: c.nota, prova: voce.prova })
  }
}

const collisioni = {
  abilita: inventario.abilita.filter(v => nelGap.abilita.has(v.chiave)),
  strumenti: inventario.strumenti.filter(v => nelGap.strumenti.has(v.chiave)),
}

// Una collisione senza classificazione ferma tutto: è il punto in cui il
// generatore si rifiuta di produrre una lista di cui non si può rispondere.
for (const tipo of ['abilita', 'strumenti']) {
  for (const v of collisioni[tipo]) {
    if (!CLASSIFICAZIONE[tipo][v.chiave]) {
      problemi.push(`${tipo}: «${v.chiave}» porta il badge e il motore la nomina (${v.prova.file}:${v.prova.riga}) — non classificata`)
    }
  }
}

if (problemi.length) {
  console.error('\nL\'inventario non torna:\n')
  problemi.forEach(r => console.error(`  ${r}`))
  console.error('\nSi sistema in scripts/classificazione-badge.mjs.')
  console.error('Un badge su una voce che il motore nomina o è sbagliato, o ha una ragione scritta.\n')
  process.exit(1)
}

const daTogliere = classificate.filter(v => v.verdetto === 'badge-sbagliato')

const fixture = {
  meta: {
    generatedAt: new Date().toISOString(),
    superficie: SUPERFICIE,
    fileEsaminati: SORGENTI.length,
    abilitaNelMotore: inventario.abilita.length,
    strumentiNelMotore: inventario.strumenti.length,
    classificate: classificate.length,
    badgeDaTogliere: daTogliere.length,
    collisioniResidue: collisioni.abilita.length + collisioni.strumenti.length,
    note: 'Voci su cui il motore ramifica, cercate come letterali nello strato che calcola, commenti esclusi. Indipendente da ABILITY_EFFECTS e ITEM_EFFECTS di proposito: serve a scoprire i badge sbagliati, e quelle due tabelle sono la fonte che li produceva.',
  },
  classificate,
  inventario,
}

if (SCRIVI) {
  const dove = path.join(RADICE, 'src/__tests__/fixtures/inventario-motore.json')
  fs.writeFileSync(dove, JSON.stringify(fixture, null, 2) + '\n')
  console.log(`\nScritto ${path.relative(RADICE, dove)}`)
}

console.log(`\nSuperficie              ${SORGENTI.length} file`)
console.log(`Abilità nel motore      ${inventario.abilita.length}`)
console.log(`Strumenti nel motore    ${inventario.strumenti.length}`)
console.log('\n── Voci classificate ───────────────────────────────────────')
for (const v of classificate) {
  const segno = v.verdetto === 'badge-sbagliato' ? '✗' : '·'
  const badge = (v.tipo === 'abilita' ? nelGap.abilita : nelGap.strumenti).has(v.chiave)
  console.log(`  ${segno} ${v.chiave.padEnd(16)} ${v.verdetto.padEnd(22)} badge:${badge ? 'SÌ' : 'no '}  ${v.prova.file}:${v.prova.riga}`)
}
console.log(`\nBadge da togliere: ${daTogliere.length} · collisioni ancora aperte: ${fixture.meta.collisioniResidue}`)
if (!SCRIVI) console.log('(--report: nessun file scritto)')
