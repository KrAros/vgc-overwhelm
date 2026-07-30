/**
 * scripts/diff-snapshot.mjs
 *
 * Confronta il motore attuale con lo snapshot salvato e stampa un rapporto
 * leggibile: quali casi sono cambiati, di quanti HP, e raggruppati per tag.
 *
 *   node scripts/diff-snapshot.mjs
 *   node scripts/diff-snapshot.mjs --tutti     mostra anche i casi invariati
 *
 * ─── A COSA SERVE ──────────────────────────────────────────────────────────
 * Il test di Vitest dice SE qualcosa è cambiato. Questo script dice COSA e
 * QUANTO, ed è lo strumento pensato per la sessione D, dove il criterio di
 * accettazione è "cambiano solo i casi con ≥2 modificatori finali".
 * Con il raggruppamento per tag quel controllo è una lettura di dieci righe
 * invece di un confronto a mano di 318 casi.
 *
 * Uscita: 0 se non è cambiato nulla, 1 se ci sono divergenze.
 * Così si può usare anche in CI o in un hook.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { caricaMotore, eseguiCaso } from './gen-snapshot.mjs'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = resolve(RADICE, 'src/__tests__/fixtures/snapshot.json')

const MOSTRA_TUTTI = process.argv.includes('--tutti')

/** Differenza fra due array di roll: null se identici. */
function deltaRolls(vecchi, nuovi) {
  if (!Array.isArray(vecchi) || !Array.isArray(nuovi)) return null
  if (vecchi.length !== nuovi.length) return { min: NaN, max: NaN }
  let min = Infinity
  let max = -Infinity
  let cambiato = false
  for (let i = 0; i < vecchi.length; i++) {
    const d = nuovi[i] - vecchi[i]
    if (d !== 0) cambiato = true
    if (d < min) min = d
    if (d > max) max = d
  }
  return cambiato ? { min, max } : null
}

/** Elenca i campi scalari che differiscono, escluso `rolls`. */
function campiDiversi(vecchio, nuovo) {
  const diversi = []
  const chiavi = new Set([...Object.keys(vecchio || {}), ...Object.keys(nuovo || {})])
  for (const k of chiavi) {
    if (k === 'rolls') continue
    const a = JSON.stringify(vecchio?.[k])
    const b = JSON.stringify(nuovo?.[k])
    if (a !== b) diversi.push(`${k}: ${a} → ${b}`)
  }
  return diversi
}

async function main() {
  const snapshot = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  const { calculateDamage, chiudi } = await caricaMotore()

  const divergenti = []

  for (const caso of snapshot.cases) {
    const atteso = caso.output
    const ottenuto = eseguiCaso(calculateDamage, caso.input)

    const delta = deltaRolls(atteso?.rolls, ottenuto?.rolls)
    const scalari = campiDiversi(atteso, ottenuto)

    if (delta || scalari.length) {
      divergenti.push({ caso, delta, scalari })
    }
  }

  await chiudi()

  console.log('')
  console.log(`Snapshot: ${snapshot.meta.caseCount} casi (commit ${snapshot.meta.commit}, motore sha256:${snapshot.meta.engineSha256})`)
  console.log(`Divergenti: ${divergenti.length}`)
  console.log('')

  if (divergenti.length === 0) {
    console.log('  Nessuna differenza. Il motore produce numeri identici allo snapshot.')
    console.log('')
    return 0
  }

  // ── Raggruppamento per tag ───────────────────────────────────────────────
  const perTag = new Map()
  for (const d of divergenti) {
    for (const tag of d.caso.tags) {
      if (!perTag.has(tag)) perTag.set(tag, [])
      perTag.get(tag).push(d)
    }
  }
  const totalePerTag = new Map()
  for (const c of snapshot.cases) {
    for (const tag of c.tags) totalePerTag.set(tag, (totalePerTag.get(tag) || 0) + 1)
  }

  console.log('── Per tag ──────────────────────────────────────────────────')
  const righe = [...perTag.entries()]
    .map(([tag, lista]) => ({ tag, cambiati: lista.length, totale: totalePerTag.get(tag) || 0 }))
    .sort((a, b) => b.cambiati - a.cambiati)
  for (const r of righe) {
    const barra = r.cambiati === r.totale ? ' ← tutti' : ''
    console.log(`  ${r.tag.padEnd(28)} ${String(r.cambiati).padStart(4)} / ${String(r.totale).padEnd(4)}${barra}`)
  }
  console.log('')

  // ── Dettaglio caso per caso ──────────────────────────────────────────────
  console.log('── Casi ─────────────────────────────────────────────────────')
  const daMostrare = MOSTRA_TUTTI ? divergenti : divergenti.slice(0, 60)
  for (const { caso, delta, scalari } of daMostrare) {
    const dettaglio = delta
      ? (delta.min === delta.max ? `rolls ${delta.min >= 0 ? '+' : ''}${delta.min} HP` : `rolls da ${delta.min} a ${delta.max > 0 ? '+' : ''}${delta.max} HP`)
      : 'rolls invariati'
    console.log(`  ${caso.id.padEnd(34)} ${dettaglio}`)
    if (scalari.length) console.log(`  ${' '.repeat(34)} ${scalari.join(', ')}`)
  }
  if (!MOSTRA_TUTTI && divergenti.length > 60) {
    console.log(`  … e altri ${divergenti.length - 60}. Rilancia con --tutti per l'elenco completo.`)
  }
  console.log('')

  return 1
}

main()
  .then(codice => process.exit(codice))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })