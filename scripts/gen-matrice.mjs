/**
 * scripts/gen-matrice.mjs
 *
 * Congela il comportamento dello strato che sta SOPRA il motore: la scelta
 * della mossa migliore, la prima mossa immune, l'indicatore di velocità e
 * l'orientamento del campo.
 *
 *   node scripts/gen-matrice.mjs            rigenera la fixture
 *   node scripts/gen-matrice.mjs --report   stampa un riepilogo senza scrivere
 *
 * ─── QUESTO FILE È UNA TRASCRIZIONE, NON UN IMPORT ─────────────────────────
 * Le funzioni qui sotto sono copiate **alla lettera** da `DamageTable.jsx`
 * come si trovava a `0a9e6c7`, cioè PRIMA della sessione E. Non importano
 * `src/lib/matrice.js`, e non devono mai farlo: se lo facessero, la fixture
 * si adatterebbe da sola a qualunque modifica e smetterebbe di essere una
 * fotografia del prima.
 *
 * È lo stesso motivo per cui in C il comportamento pre-modifica era stato
 * estratto con `git show HEAD:src/calcEngine.js` invece che riletto dal file
 * corrente. Qui la trascrizione è di quindici righe, quindi sta nel
 * generatore.
 *
 * ─── PERCHÉ PASSA DA VITE ──────────────────────────────────────────────────
 * Stesso motivo di `gen-snapshot.mjs`: `calcEngine.js` importa i JSON con la
 * sintassi che Vite risolve e Node no. `ssrLoadModule` fa vedere al
 * generatore esattamente il codice che gira nel browser.
 *
 * ─── QUANDO RIGENERARE ─────────────────────────────────────────────────────
 * Mai, salvo che un numero cambi per una ragione capita e voluta. Se il test
 * `matrice.test.js` diventa rosso, la domanda è "perché è cambiata questa
 * cella", non "come faccio a farlo tornare verde".
 */

import { createServer } from 'vite'
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SQUADRA_1, SQUADRA_2, SCENARI, LIVELLO } from './matrice-casi.mjs'
import { serializzaCella } from './matrice-formato.mjs'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINAZIONE = resolve(RADICE, 'src/__tests__/fixtures/matrice.json')

/** Carica attraverso Vite i moduli che servono al generatore. */
async function caricaModuli() {
  const server = await createServer({
    configFile: false,
    root: RADICE,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  })
  const motore  = await server.ssrLoadModule('/src/calcEngine.js')
  const stato   = await server.ssrLoadModule('/src/lib/battleState.js')
  const ordine  = await server.ssrLoadModule('/src/utils/speedOrder.js')
  return {
    calculateDamage:    motore.calculateDamage,
    buildAttackerInput: stato.buildAttackerInput,
    buildDefenderInput: stato.buildDefenderInput,
    buildField:         stato.buildField,
    whoGoesFirst:       ordine.whoGoesFirst,
    chiudi: () => server.close(),
  }
}

// ─── Trascrizione da DamageTable.jsx @ 0a9e6c7 ───────────────────────────────

function trascrizione(m) {
  const calcAllMoves = (atk, def, level, field) => {
    const attacker = m.buildAttackerInput(atk, level)
    const defender = m.buildDefenderInput(def)
    return (atk.moves || []).filter(Boolean).map(move => ({
      move,
      result: m.calculateDamage({ attacker, defender, move, field }),
    }))
  }

  const getBestMove = (atk, def, level, field) => {
    const all = calcAllMoves(atk, def, level, field)
    const effective = all.filter(({ result }) => result && !result.immune && result.maxPct > 0)
    if (!effective.length) return null
    return effective.reduce((best, cur) =>
      cur.result.maxPct > best.result.maxPct ? cur : best
    )
  }

  /** Il corpo di DamageCell, ridotto a ciò che produce numeri. */
  const cella = (attacker, defender, level, field, fieldReversed) => {
    if (!attacker?.key || !defender?.key) return null

    const allMovesT1 = calcAllMoves(attacker, defender, level, field)
    const allMovesT2 = calcAllMoves(defender, attacker, level, fieldReversed)

    const d1 = getBestMove(attacker, defender, level, field)
    const d2 = getBestMove(defender, attacker, level, fieldReversed)

    const firstImmuneT1 = !d1 ? allMovesT1.find(({ result }) => result?.immune) : null
    const firstImmuneT2 = !d2 ? allMovesT2.find(({ result }) => result?.immune) : null

    const twAtk = field.atkTeamSide === 't2' ? field.tailwindT2 : field.tailwindT1
    const twDef = field.atkTeamSide === 't2' ? field.tailwindT1 : field.tailwindT2
    const speedFirst = m.whoGoesFirst(
      attacker, defender, d1, d2,
      field.weather, field.trickRoom, twAtk, twDef, field.terrain,
    )

    return {
      mosseT1:   allMovesT1,
      mosseT2:   allMovesT2,
      migliore1: d1,
      migliore2: d2,
      immune1:   firstImmuneT1 || null,
      immune2:   firstImmuneT2 || null,
      primo:     speedFirst ?? null,
    }
  }

  return { cella }
}

// ─── Esecuzione ──────────────────────────────────────────────────────────────

export async function generaMatrice() {
  const m = await caricaModuli()
  try {
    const { cella } = trascrizione(m)
    const scenari = SCENARI.map(({ nome, campo }) => {
      const field         = m.buildField(campo, 't1')
      const fieldReversed = m.buildField(campo, 't2')
      const celle = SQUADRA_1.map(riga =>
        SQUADRA_2.map(colonna =>
          serializzaCella(cella(riga, colonna, LIVELLO, field, fieldReversed)),
        ),
      )
      return { nome, celle }
    })
    return scenari
  } finally {
    m.chiudi()
  }
}

function commitCorrente() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: RADICE }).toString().trim()
  } catch {
    return 'sconosciuto'
  }
}

const eseguitoDirettamente = process.argv[1] && process.argv[1].endsWith('gen-matrice.mjs')

if (eseguitoDirettamente) {
  const scenari = await generaMatrice()
  const celleTotali = scenari.reduce(
    (n, s) => n + s.celle.flat().filter(Boolean).length, 0,
  )

  if (process.argv.includes('--report')) {
    for (const s of scenari) {
      const piene = s.celle.flat().filter(Boolean)
      const conImmune = piene.filter(c => c.immune1 || c.immune2).length
      const senzaPrimo = piene.filter(c => c.primo === null).length
      console.log(
        `${s.nome.padEnd(38)} celle ${String(piene.length).padStart(3)}` +
        ` · immuni ${String(conImmune).padStart(2)}` +
        ` · pareggi di velocità ${String(senzaPrimo).padStart(2)}`,
      )
    }
    console.log(`\ntotale ${celleTotali} celle su ${scenari.length} scenari`)
  } else {
    const contenuto = {
      meta: {
        generatedAt: new Date().toISOString(),
        commit: commitCorrente(),
        celle: celleTotali,
        scenari: scenari.length,
        note: 'Caratterizzazione dello strato sopra il motore, trascritto da DamageTable.jsx @ 0a9e6c7. Congela il comportamento prima della sessione E.',
      },
      scenari,
    }
    writeFileSync(DESTINAZIONE, JSON.stringify(contenuto, null, 1) + '\n')
    console.log(`scritte ${celleTotali} celle in ${DESTINAZIONE}`)
  }
}
