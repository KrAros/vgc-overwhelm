/**
 * scripts/gen-flag-dati.mjs
 *
 * Porta dentro i NOSTRI dati due flag che finora non avevamo, prendendoli da
 * `vendor/ncp`: `canEvolve` in `pokemon.json` e `isPunch` in `moves.json`.
 *
 * ─── PERCHÉ NON A MANO ─────────────────────────────────────────────────────
 * Sono 479 specie e ~30 mosse. A mano significa un pomeriggio e qualche
 * refuso; e soprattutto significa un dato che nessuno può rigenerare quando
 * Champions aggiungerà roba. Questo script è rieseguibile: cancella, rifà,
 * e stampa cosa ha cambiato. È il primo mattoncino della pipeline dati
 * versionata di cui parla §8.3 dell'analisi.
 *
 * ─── PERCHÉ SERVONO PROPRIO QUESTI DUE ─────────────────────────────────────
 *   canEvolve → Eviolite. NCP lo applica solo se il difensore può ancora
 *               evolversi (`calcDefMods`, punto f). Noi lo applicavamo a
 *               chiunque: Incineroar con l'Eviolite prendeva un +50% di
 *               Difesa che nel gioco non esiste.
 *   isPunch   → Punching Glove e Iron Fist. `moves.json` non aveva nessun
 *               flag, quindi Punching Glove era modellato come «+10% a TUTTE
 *               le mosse fisiche», che è vistosamente troppo.
 *
 * ─── COSA NON FA ───────────────────────────────────────────────────────────
 * Non tocca base stats né tipi: quelle correzioni sono della sessione I e
 * vanno guardate una per una. Qui si aggiungono solo campi nuovi, mai si
 * sovrascrive un campo esistente. Se una voce non è mappabile su NCP viene
 * lasciata stare e conteggiata nel report.
 *
 * Uso:
 *   node scripts/gen-flag-dati.mjs            scrive i file
 *   node scripts/gen-flag-dati.mjs --report   mostra soltanto cosa farebbe
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { caricaNCP } from './ncp/contesto.mjs'
import { normalizza, ECCEZIONI_POKEMON } from './ncp/mappatura.mjs'

const QUI = path.dirname(fileURLToPath(import.meta.url))
const RADICE = path.resolve(QUI, '..')
const DATI = path.join(RADICE, 'src', 'data')

const soloReport = process.argv.includes('--report')

const ncp = caricaNCP()

// ─── Indici NCP normalizzati ────────────────────────────────────────────────
// Stessa normalizzazione dell'harness: minuscolo, via punti, apostrofi, spazi
// e trattini. È già stata misurata su questi dataset e non produce collisioni.

const indice = (chiavi) => {
  const m = new Map()
  for (const k of chiavi) m.set(normalizza(k), k)
  return m
}

const iPokemon = indice(Object.keys(ncp.pokedex))
const iMosse = indice(Object.keys(ncp.mosse))

/**
 * Le stesse regole di forma della mappatura dell'harness: le Mega e le Primal
 * si riscrivono da sole, non serve elencarle.
 */
const REGOLE_FORMA = [
  { da: /^(.+)-mega-([xyz])$/, a: (m) => `Mega ${m[1]} ${m[2].toUpperCase()}` },
  { da: /^(.+)-mega$/, a: (m) => `Mega ${m[1]}` },
  { da: /^(.+)-primal$/, a: (m) => `Primal ${m[1]}` },
]

function nomeNCP(slug) {
  // Le stesse eccezioni dell'harness, importate invece che ricopiate: due
  // liste della stessa cosa sono due liste che divergeranno.
  const ecc = ECCEZIONI_POKEMON[slug]
  if (ecc) return ncp.pokedex[ecc] ? ecc : null
  const diretto = iPokemon.get(normalizza(slug))
  if (diretto) return diretto
  for (const regola of REGOLE_FORMA) {
    const m = slug.match(regola.da)
    if (!m) continue
    const cand = iPokemon.get(normalizza(regola.a(m)))
    if (cand) return cand
  }
  return null
}

// ─── pokemon.json → canEvolve ───────────────────────────────────────────────

const percorsoPokemon = path.join(DATI, 'pokemon.json')
const pokemon = JSON.parse(fs.readFileSync(percorsoPokemon, 'utf8'))

let evolvibili = 0
let nonMappati = 0
const esempiNonMappati = []

for (const [slug, voce] of Object.entries(pokemon)) {
  const nome = nomeNCP(slug)
  if (!nome) {
    nonMappati++
    if (esempiNonMappati.length < 12) esempiNonMappati.push(slug)
    // Non mappabile: lasciamo il campo assente. `false` sarebbe una bugia
    // travestita da dato — meglio che l'assenza resti visibile.
    continue
  }
  // In NCP il campo esiste solo quando è vero. `!!` normalizza l'assenza.
  const puo = !!ncp.pokedex[nome].canEvolve
  voce.canEvolve = puo
  if (puo) evolvibili++
}

// ─── moves.json → punch ─────────────────────────────────────────────────────
// Nel nostro JSON i flag esistenti si chiamano `contact` e `spread`, senza il
// prefisso `is`. Restiamo su quella convenzione e lo chiamiamo `punch`.

const percorsoMosse = path.join(DATI, 'moves.json')
const mosse = JSON.parse(fs.readFileSync(percorsoMosse, 'utf8'))

let pugni = 0
let mosseNonMappate = 0
const nomiPugni = []

for (const [slug, voce] of Object.entries(mosse)) {
  const nome = iMosse.get(normalizza(slug))
  if (!nome) { mosseNonMappate++; continue }
  if (ncp.mosse[nome].isPunch) {
    voce.punch = true
    pugni++
    nomiPugni.push(slug)
  } else if ('punch' in voce) {
    // Rieseguibilità: se NCP non la considera più un pugno, il flag sparisce.
    delete voce.punch
  }
}

// ─── Report ─────────────────────────────────────────────────────────────────

console.log('')
console.log('pokemon.json')
console.log(`  specie totali:        ${Object.keys(pokemon).length}`)
console.log(`  canEvolve = true:     ${evolvibili}`)
console.log(`  non mappabili su NCP: ${nonMappati}`)
if (esempiNonMappati.length) {
  console.log(`    es. ${esempiNonMappati.join(', ')}${nonMappati > esempiNonMappati.length ? ', …' : ''}`)
}
console.log('')
console.log('moves.json')
console.log(`  mosse totali:         ${Object.keys(mosse).length}`)
console.log(`  punch = true:         ${pugni}`)
console.log(`    ${nomiPugni.join(', ')}`)
console.log(`  non mappabili su NCP: ${mosseNonMappate}`)
console.log('')

if (soloReport) {
  console.log('--report: nessun file scritto.')
  process.exit(0)
}

fs.writeFileSync(percorsoPokemon, JSON.stringify(pokemon, null, '\t') + '\n')
fs.writeFileSync(percorsoMosse, JSON.stringify(mosse, null, '\t') + '\n')
console.log('Scritti src/data/pokemon.json e src/data/moves.json')
