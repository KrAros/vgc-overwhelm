/**
 * scripts/gen-snapshot.mjs
 *
 * Genera lo snapshot di caratterizzazione: esegue il motore così com'è su
 * tutti i casi di `snapshot-cases.mjs` e scrive input + output in
 * `src/__tests__/fixtures/snapshot.json`.
 *
 *   node scripts/gen-snapshot.mjs
 *
 * ─── PERCHÉ PASSA DA VITE ──────────────────────────────────────────────────
 * `src/calcEngine.js` importa `pokemon.json` e `moves.json` con la sintassi
 *   import pokemonData from './data/pokemon.json'
 * che Vite risolve ma Node 22 rifiuta (vuole `with { type: 'json' }`).
 * Invece di modificare il sorgente di produzione per far contento il tooling,
 * lo script apre un server Vite in middleware mode e carica il modulo con
 * `ssrLoadModule`. Vantaggio: il generatore vede ESATTAMENTE lo stesso codice
 * che gira nel browser, non una copia adattata.
 *
 * ─── QUANDO RIGENERARE ─────────────────────────────────────────────────────
 * Quasi mai. Lo snapshot è la fotografia del comportamento da cui si parte.
 * Se un test fallisce, la domanda giusta è "perché è cambiato questo numero",
 * non "come faccio a far passare il test". Rigenerare è corretto solo DOPO
 * aver capito e giustificato ogni singola differenza — tipicamente alla fine
 * della sessione D, quando le divergenze sono correzioni volute.
 *
 * Prima di rigenerare, guarda cosa cambia:
 *   node scripts/diff-snapshot.mjs
 */

import { createServer } from 'vite'
import { writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CASI } from './snapshot-cases.mjs'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINAZIONE = resolve(RADICE, 'src/__tests__/fixtures/snapshot.json')

/**
 * Carica il motore attraverso Vite.
 * @returns {Promise<{ calculateDamage: Function, chiudi: Function }>}
 */
export async function caricaMotore() {
  const server = await createServer({
    configFile: false,
    root: RADICE,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  })
  const mod = await server.ssrLoadModule('/src/calcEngine.js')
  return { calculateDamage: mod.calculateDamage, chiudi: () => server.close() }
}

/**
 * Esegue un caso e restituisce l'output normalizzato.
 *
 * `log` viene escluso di proposito: con debug:false è null, e comunque è
 * testo per gli umani, non un risultato del calcolo. Le chiavi vengono
 * ordinate alfabeticamente perché il confronto avviene su JSON serializzato.
 */
export function eseguiCaso(calculateDamage, input) {
  const risultato = calculateDamage({ ...input, debug: false })
  if (!risultato) return null

  // `log` viene escluso: a debug spento è null, e comunque è testo per gli
  // umani, non un risultato del calcolo. Le chiavi vengono ordinate perché il
  // confronto avviene su oggetti serializzati.
  const ordinato = {}
  for (const chiave of Object.keys(risultato).sort()) {
    if (chiave === 'log') continue
    ordinato[chiave] = risultato[chiave] === undefined ? null : risultato[chiave]
  }
  return ordinato
}

/** Serializza mettendo un caso per riga, così `git diff` resta leggibile. */
function serializza(dati) {
  const righe = dati.cases.map(c => '    ' + JSON.stringify(c))
  return [
    '{',
    '  "meta": ' + JSON.stringify(dati.meta, null, 2).replace(/\n/g, '\n  ') + ',',
    '  "cases": [',
    righe.join(',\n'),
    '  ]',
    '}',
    '',
  ].join('\n')
}

async function main() {
  const { calculateDamage, chiudi } = await caricaMotore()

  let commit = 'sconosciuto'
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: RADICE }).toString().trim()
  } catch { /* repo non disponibile: non è un errore bloccante */ }

  const sorgenteMotore = readFileSync(resolve(RADICE, 'src/calcEngine.js'), 'utf8')
  const hashMotore = createHash('sha256').update(sorgenteMotore).digest('hex').slice(0, 16)

  const casiGenerati = []
  let nulli = 0
  let immuni = 0

  for (const caso of CASI) {
    const output = eseguiCaso(calculateDamage, caso.input)
    if (output === null) nulli++
    else if (output.immune) immuni++
    casiGenerati.push({ id: caso.id, tags: caso.tags, input: caso.input, output })
  }

  const dati = {
    meta: {
      generatedAt: new Date().toISOString(),
      commit,
      engineSha256: hashMotore,
      caseCount: casiGenerati.length,
      note: 'Snapshot di caratterizzazione. Congela il comportamento attuale, bug inclusi. Non è un oracolo di correttezza: quelli sono i casi golden da NCP.',
    },
    cases: casiGenerati,
  }

  mkdirSync(dirname(DESTINAZIONE), { recursive: true })
  writeFileSync(DESTINAZIONE, serializza(dati))

  console.log(`Snapshot scritto in ${DESTINAZIONE}`)
  console.log(`  casi:      ${casiGenerati.length}`)
  console.log(`  immuni:    ${immuni}`)
  console.log(`  null:      ${nulli}`)
  console.log(`  commit:    ${commit}`)
  console.log(`  motore:    sha256:${hashMotore}`)

  await chiudi()
}

// Eseguito direttamente (non importato)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}