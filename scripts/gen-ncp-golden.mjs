/**
 * scripts/gen-ncp-golden.mjs
 *
 * Genera i casi golden facendo eseguire a NCP le stesse configurazioni del
 * nostro snapshot, e scrive il risultato in
 * `src/__tests__/fixtures/ncp-golden.json`.
 *
 *   npm run ncp:gen        genera la fixture e stampa il riepilogo
 *   npm run ncp:report     stampa solo il report, senza scrivere niente
 *
 * ─── COSA VIENE PRODOTTO ───────────────────────────────────────────────────
 * Per ogni caso, i sedici roll che NCP dà. Non i nostri: i loro. Poi eseguiamo
 * anche il nostro motore, solo per etichettare il caso:
 *
 *   stato 'concorde'    i due motori danno gli stessi sedici numeri
 *   stato 'divergente'  no — e questo è un bug nostro da chiudere in D
 *
 * Entrambi finiscono nella fixture. I concordi diventano test verdi che
 * bloccano le regressioni; i divergenti diventano `it.fails`, cioè test che
 * si *aspettano* di fallire: restano verdi finché il bug c'è e diventano rossi
 * quando viene corretto, ricordandoti di promuoverli. Sono il termometro della
 * sessione D: quando una catena di modificatori viene sistemata, un gruppo
 * intero si rovescia in una volta e ti dice esattamente cosa hai chiuso.
 *
 * ─── IL CANCELLO SULL'ANAGRAFICA ───────────────────────────────────────────
 * Prima di generare un golden, i dati di partenza delle entità coinvolte
 * vengono confrontati fra i due mondi. Se già quelli divergono — Aegislash ha
 * 150 di Difesa da noi e 140 in NCP — il caso NON diventa golden: finisce nel
 * report sotto "anagrafica" con il dettaglio della differenza.
 *
 * Senza questo cancello, quel caso entrerebbe come test rosso e passeresti un
 * pomeriggio a cercare nella formula un errore che sta in `pokemon.json`.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CASI } from './snapshot-cases.mjs'
import { caricaMotore } from './gen-snapshot.mjs'
import { creaHarness } from './ncp/harness.mjs'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINAZIONE = resolve(RADICE, 'src/__tests__/fixtures/ncp-golden.json')

/** Il commit NCP vendorizzato. Va tenuto allineato a `vendor/ncp/README.md`. */
const COMMIT_NCP = '7919130'

/** Serializza un caso per riga, così `git diff` resta leggibile. */
function serializza(dati) {
  const riga = (x) => '    ' + JSON.stringify(x)
  return [
    '{',
    '  "meta": ' + JSON.stringify(dati.meta, null, 2).replace(/\n/g, '\n  ') + ',',
    '  "cases": [',
    dati.cases.map(riga).join(',\n'),
    '  ],',
    '  "esclusi": [',
    dati.esclusi.map(riga).join(',\n'),
    '  ]',
    '}',
    '',
  ].join('\n')
}

export async function generaGolden() {
  const harness = creaHarness()
  const { calculateDamage, chiudi } = await caricaMotore()

  const cases = []
  const esclusi = []
  const anagrafica = new Map()   // chiave leggibile → dettaglio, deduplicato

  for (const caso of CASI) {
    const { attacker: a, defender: d, move } = caso.input

    // ── Cancello 1: i dati di partenza coincidono? ─────────────────────────
    const differenze = harness.verificaAnagrafica({
      pokemon: [a.atkPokemon, d.defPokemon],
      mosse: [move],
    })
    if (differenze.length > 0) {
      for (const diff of differenze) {
        anagrafica.set(`${diff.entita}·${diff.tipo}`, diff)
      }
      esclusi.push({
        id: caso.id,
        categoria: 'anagrafica',
        motivo: differenze.map(x => `${x.entita}: ${x.tipo} diverso`).join('; '),
      })
      continue
    }

    // ── Cancello 2: NCP sa esprimere questa configurazione? ────────────────
    const ncp = harness.calcola(caso.input)
    if (!ncp.ok) {
      esclusi.push({ id: caso.id, categoria: 'non mappabile', motivo: ncp.motivo })
      continue
    }

    // ── Il nostro motore, solo per etichettare ────────────────────────────
    const nostro = calculateDamage({ ...caso.input, debug: false })
    const nostriRolls = nostro && Array.isArray(nostro.rolls) ? nostro.rolls : []
    const nostroNullo = nostriRolls.length !== 16

    // Quattro combinazioni, e tre di queste sono informative:
    //
    //   entrambi zero    → nulla da confrontare, si esclude
    //   entrambi 16 roll → si confrontano i sedici numeri
    //   noi zero, NCP no → divergenza: consideriamo immune qualcosa che colpisce
    //   NCP zero, noi no → divergenza: calcoliamo un danno che nel gioco non c'è
    if (nostroNullo && ncp.nullo) {
      esclusi.push({
        id: caso.id,
        categoria: 'nessun danno',
        motivo: 'entrambi i motori danno colpo nullo (immunità o mossa senza potenza)',
      })
      continue
    }

    const concorde = !nostroNullo && !ncp.nullo
      && JSON.stringify(nostriRolls) === JSON.stringify(ncp.rolls)

    cases.push({
      id: caso.id,
      tags: caso.tags,
      stato: concorde ? 'concorde' : 'divergente',
      fonte: 'harness',
      format: ncp.format,
      // `attesoNullo` significa: NCP dice che questo colpo non fa danno.
      // Il test verifica che anche noi lo diciamo.
      attesoNullo: ncp.nullo === true,
      input: caso.input,
      rolls: ncp.rolls,
      defHP: ncp.defHP,
      ...(concorde ? {} : { nostriRolls }),
    })
  }

  const concordi = cases.filter(c => c.stato === 'concorde').length
  const divergenti = cases.length - concordi

  const dati = {
    meta: {
      generatedAt: new Date().toISOString(),
      ncpCommit: COMMIT_NCP,
      fonte: 'harness',
      casiTotali: CASI.length,
      golden: cases.length,
      concordi,
      divergenti,
      esclusi: esclusi.length,
      note: 'Numeri attesi prodotti eseguendo il motore NCP (vendor/ncp) sulle stesse '
          + 'configurazioni dello snapshot. I casi "divergente" girano con it.fails: '
          + 'sono bug nostri noti, e diventano rossi quando vengono corretti. '
          + 'Tutti raccolti col formato Doubles, salvo le mosse ad area su bersaglio singolo.',
    },
    cases,
    esclusi,
  }

  await chiudi()
  return { dati, anagrafica: [...anagrafica.values()] }
}

function stampaReport({ dati, anagrafica }) {
  const { meta, cases, esclusi } = dati
  console.log('')
  console.log(`Casi nello snapshot   ${meta.casiTotali}`)
  console.log(`Golden generati       ${meta.golden}   (concordi ${meta.concordi} · divergenti ${meta.divergenti})`)
  console.log(`Esclusi               ${meta.esclusi}`)

  const perCategoria = {}
  for (const e of esclusi) perCategoria[e.categoria] = (perCategoria[e.categoria] || 0) + 1
  console.log('\n── Esclusioni ──────────────────────────────────────────────')
  for (const [cat, n] of Object.entries(perCategoria).sort((x, y) => y[1] - x[1])) {
    console.log(`  ${String(n).padStart(4)}  ${cat}`)
  }
  const motivi = {}
  for (const e of esclusi) motivi[e.motivo] = (motivi[e.motivo] || 0) + 1
  for (const [m, n] of Object.entries(motivi).sort((x, y) => y[1] - x[1])) {
    console.log(`        ${String(n).padStart(3)} × ${m.length > 92 ? m.slice(0, 92) + '…' : m}`)
  }

  if (anagrafica.length > 0) {
    console.log('\n── Divergenze di ANAGRAFICA (dati, non formula) ────────────')
    console.log('   Questi non sono bug del motore: uno dei due JSON ha il dato sbagliato.')
    console.log('   Vanno sistemati nei dati, non in calcEngine.\n')
    for (const d of anagrafica) {
      const nostro = JSON.stringify(d.nostro ?? '—')
      const loro = JSON.stringify(d.ncp ?? '—')
      console.log(`  ${d.entita.padEnd(22)} ${d.tipo.padEnd(14)} noi ${nostro}  ·  NCP ${loro}`)
    }
  }

  const divergenti = cases.filter(c => c.stato === 'divergente')
  if (divergenti.length > 0) {
    console.log('\n── Divergenze di FORMULA (bug del motore, per D) ───────────')
    const perTag = {}
    for (const c of divergenti) for (const t of c.tags) perTag[t] = (perTag[t] || 0) + 1
    for (const [t, n] of Object.entries(perTag).sort((x, y) => y[1] - x[1])) {
      console.log(`  ${String(n).padStart(4)}  ${t}`)
    }
    console.log('')
    for (const c of divergenti) {
      const { attacker: a, defender: d, move, field } = c.input
      const campo = Object.entries(field || {}).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(' ')
      console.log(`  ${c.id}  [${c.tags.join(',')}]`)
      console.log(`     ${a.atkPokemon}${a.atkAbility ? '/' + a.atkAbility : ''}${a.atkItem ? '@' + a.atkItem : ''}`
                + ` → ${move} → ${d.defPokemon}${d.defAbility ? '/' + d.defAbility : ''}${d.defItem ? '@' + d.defItem : ''}`
                + (campo ? `   ${campo}` : ''))
      const mostra = (r) => (r.length === 16 ? `${r[0]}–${r[15]}` : 'nessun danno')
      console.log(`     noi  ${mostra(c.nostriRolls)}   NCP  ${mostra(c.rolls)}`)
    }
  }
  console.log('')
}

async function main() {
  const soloReport = process.argv.includes('--report')
  const risultato = await generaGolden()
  stampaReport(risultato)

  if (soloReport) {
    console.log('(--report: nessun file scritto)')
    return
  }
  mkdirSync(dirname(DESTINAZIONE), { recursive: true })
  writeFileSync(DESTINAZIONE, serializza(risultato.dati))
  console.log(`Fixture scritta in ${DESTINAZIONE}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1) })
}
