/**
 * scripts/gen-ncp-preparazione.mjs
 *
 * Genera `src/__tests__/fixtures/ncp-preparazione.json`, l'oracolo dello
 * strato di preparazione di NCP.
 *
 * ─── COS'È LO "STRATO DI PREPARAZIONE" ─────────────────────────────────────
 * NCP calcola il danno in due tempi. Prima `CALCULATE_ALL_MOVES_SV` sistema i
 * due Pokémon — Intimidate abbassa l'Attacco, Intrepid Sword lo alza, Booster
 * Energy accende Protosynthesis, Download legge le difese avversarie — e poi
 * `GET_DAMAGE_SV` calcola il danno sui Pokémon già sistemati.
 *
 * Fino a F-2 il nostro harness entrava dal secondo. I 509 golden della
 * sessione H verificano quindi la formula, ma non lo stato di partenza: erano
 * ciechi su tutto il primo tempo.
 *
 * ─── LA VERIFICA DI FALSIFICABILITÀ ────────────────────────────────────────
 * Ogni caso ha un controllo negativo, e questo script controlla che la coppia
 * produca roll DIVERSI **in NCP**. Se sono uguali, il caso non è capace di far
 * fallire niente: il meccanismo si accende ma non si vede. Viene scartato con
 * un avviso invece di entrare nella fixture come falso accordo.
 *
 * È la stessa regola del piano — «prima di scrivere un criterio, verificare
 * che esista almeno un caso capace di farlo fallire» — applicata al singolo
 * caso invece che al criterio.
 *
 * Uso:
 *   node scripts/gen-ncp-preparazione.mjs
 *   node scripts/gen-ncp-preparazione.mjs --report    (non scrive, solo stampa)
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CASI_PREPARAZIONE, COPPIE } from './ncp/casi-preparazione.mjs'
import { caricaMotore } from './gen-snapshot.mjs'
import { creaHarness } from './ncp/harness.mjs'

const QUI = dirname(fileURLToPath(import.meta.url))
const RADICE = resolve(QUI, '..')
const DESTINAZIONE = resolve(RADICE, 'src/__tests__/fixtures/ncp-preparazione.json')

const COMMIT_NCP = '7919130'

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

export async function generaPreparazione() {
  const harness = creaHarness()
  const { calculateDamage, chiudi } = await caricaMotore()

  const esiti = new Map()   // id → { ncp, nostriRolls, nostroNullo }
  const esclusi = []

  // ── Passo 1 · esecuzione ──────────────────────────────────────────────────
  for (const caso of CASI_PREPARAZIONE) {
    const ncp = harness.calcolaConPreparazione(caso.input)
    if (!ncp.ok) {
      esclusi.push({ id: caso.id, categoria: 'non mappabile', motivo: ncp.motivo })
      continue
    }
    const nostro = calculateDamage({ ...caso.input, debug: false })
    const nostriRolls = nostro && Array.isArray(nostro.rolls) ? nostro.rolls : []
    esiti.set(caso.id, {
      caso,
      ncp,
      nostriRolls,
      nostroNullo: nostriRolls.length !== 16,
    })
  }

  // ── Passo 2 · falsificabilità ─────────────────────────────────────────────
  // Un caso bersaglio i cui roll NCP coincidono col suo controllo è una sonda
  // cieca. Lo togliamo dalla fixture e lo scriviamo negli esclusi, perché un
  // caso cieco che resta dentro conta come "concorde" e gonfia il punteggio.
  const ciechi = new Set()
  const coppieViste = []
  for (const [idBersaglio, idControllo] of COPPIE) {
    const b = esiti.get(idBersaglio)
    const c = esiti.get(idControllo)
    if (!b || !c) continue
    const distinti = JSON.stringify(b.ncp.rolls) !== JSON.stringify(c.ncp.rolls)
    coppieViste.push({ bersaglio: idBersaglio, controllo: idControllo, distinti })
    if (!distinti) {
      ciechi.add(idBersaglio)
      esclusi.push({
        id: idBersaglio,
        categoria: 'sonda cieca',
        motivo: `in NCP produce gli stessi roll del suo controllo ${idControllo}: `
              + 'il meccanismo si accende ma non arriva ai numeri finali',
      })
    }
  }

  // ── Passo 3 · fixture ─────────────────────────────────────────────────────
  const cases = []
  for (const [id, e] of esiti) {
    if (ciechi.has(id)) continue

    if (e.nostroNullo && e.ncp.nullo) {
      esclusi.push({
        id,
        categoria: 'nessun danno',
        motivo: 'entrambi i motori danno colpo nullo',
      })
      continue
    }

    const concorde = !e.nostroNullo && !e.ncp.nullo
      && JSON.stringify(e.nostriRolls) === JSON.stringify(e.ncp.rolls)

    cases.push({
      id,
      nota: e.caso.nota,
      stato: concorde ? 'concorde' : 'divergente',
      fonte: 'harness-preparazione',
      format: e.ncp.format,
      attesoNullo: e.ncp.nullo === true,
      input: e.caso.input,
      rolls: e.ncp.rolls,
      defHP: e.ncp.defHP,
      boostFinali: e.ncp.boostFinali,
      ...(concorde ? {} : { nostriRolls: e.nostriRolls }),
    })
  }

  const concordi = cases.filter(c => c.stato === 'concorde').length
  const divergenti = cases.length - concordi

  const dati = {
    meta: {
      generatedAt: new Date().toISOString(),
      ncpCommit: COMMIT_NCP,
      fonte: 'harness-preparazione',
      ingresso: 'CALCULATE_ALL_MOVES_SV',
      casiTotali: CASI_PREPARAZIONE.length,
      golden: cases.length,
      concordi,
      divergenti,
      esclusi: esclusi.length,
      coppieVerificate: coppieViste.length,
      coppieCieche: coppieViste.filter(c => !c.distinti).length,
      note: 'Numeri attesi prodotti eseguendo NCP dall\'ingresso alto '
          + '(CALCULATE_ALL_MOVES_SV), che applica Intimidate, Intrepid Sword, '
          + 'Dauntless Shield, Download e le abilità paradosso prima del danno. '
          + 'I casi "divergente" girano con it.fails: sono bug nostri noti, '
          + 'li chiude la sessione J. Ogni caso ha un controllo negativo e le '
          + 'coppie che non si distinguono sono scartate come sonde cieche.',
    },
    cases,
    esclusi,
  }

  await chiudi()
  return { dati, coppie: coppieViste }
}

function stampaReport({ dati, coppie }) {
  const { meta, cases, esclusi } = dati
  console.log('')
  console.log(`Casi definiti          ${meta.casiTotali}`)
  console.log(`Nella fixture          ${meta.golden}   (concordi ${meta.concordi} · divergenti ${meta.divergenti})`)
  console.log(`Esclusi                ${meta.esclusi}`)
  console.log(`Coppie verificate      ${meta.coppieVerificate}   (cieche ${meta.coppieCieche})`)

  const cieche = coppie.filter(c => !c.distinti)
  if (cieche.length) {
    console.log('\n── Sonde cieche (scartate) ─────────────────────────────────')
    for (const c of cieche) console.log(`  ${c.bersaglio}  ≡  ${c.controllo}`)
  }

  const div = cases.filter(c => c.stato === 'divergente')
  if (div.length) {
    console.log('\n── Divergenze ──────────────────────────────────────────────')
    for (const c of div) {
      const n = c.nostriRolls
      const noi = n && n.length === 16 ? `${n[0]}-${n[15]}` : '—'
      const ncp = c.rolls?.length === 16 ? `${c.rolls[0]}-${c.rolls[15]}` : '—'
      console.log(`  ${c.id.padEnd(38)} NCP ${ncp.padEnd(10)} noi ${noi}`)
    }
  }

  const perCategoria = {}
  for (const e of esclusi) perCategoria[e.categoria] = (perCategoria[e.categoria] || 0) + 1
  if (Object.keys(perCategoria).length) {
    console.log('\n── Esclusioni ──────────────────────────────────────────────')
    for (const [k, v] of Object.entries(perCategoria)) console.log(`  ${String(v).padStart(3)}  ${k}`)
  }
  console.log('')
}

const eseguitoDirettamente = process.argv[1] && process.argv[1].endsWith('gen-ncp-preparazione.mjs')
if (eseguitoDirettamente) {
  const risultato = await generaPreparazione()
  stampaReport(risultato)
  if (!process.argv.includes('--report')) {
    mkdirSync(dirname(DESTINAZIONE), { recursive: true })
    writeFileSync(DESTINAZIONE, serializza(risultato.dati), 'utf8')
    console.log(`Scritto ${DESTINAZIONE}\n`)
  } else {
    console.log('(--report: nessun file scritto)\n')
  }
}
