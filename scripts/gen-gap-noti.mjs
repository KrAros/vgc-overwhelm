// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/gen-gap-noti.mjs
 *
 * Genera `src/data/gapNoti.json`: l'elenco delle abilità e degli strumenti che
 * il RIFERIMENTO calcola nel danno e noi no. È la lista che alimenta il badge
 * «non calcolata» nell'interfaccia, e la lista delle issue `good first issue`.
 *
 * Uso:
 *   npm run gap:gen         scrive src/data/gapNoti.json
 *   npm run gap:report      stampa e basta, con le prove
 *   npm run gap:report -- --prove     stampa anche la riga di prova per voce
 *
 * ═══ PERCHÉ NON BASTA «CERCA IL NOME NEL CODICE DI NCP» ═══════════════════
 *
 * Una prima misura, fatta a mano prima della sessione, diceva 64 abilità.
 * Era sbagliata in tre modi indipendenti, e vale la pena che restino scritti
 * perché sono tre trappole generali, non tre sviste.
 *
 *   1. LA SUPERFICIE ERA SCELTA A MANO. Erano nove funzioni elencate a
 *      giudizio. Mancava `immunityChecks`, dove NCP azzera il danno per
 *      Wonder Guard, Sap Sipper, Volt Absorb, Water Absorb, Storm Drain,
 *      Motor Drive, Lightning Rod, Earth Eater, Bulletproof, Soundproof,
 *      Wind Rider, Damp, Sturdy, Dazzling. Quindici abilità che portano il
 *      danno a zero, fuori dal conteggio.
 *      → Qui la superficie è la CHIUSURA TRANSITIVA delle chiamate a partire
 *        da un ingresso. Non c'è niente da indovinare.
 *
 *   2. NON SEGUIVA LE CHIAMATE FUORI DAI FILE DI DANNO. `getItemDualTypeBoost`
 *      vive in `item_data.js`: gli strumenti venivano cercati in un posto che
 *      non contiene i loro effetti.
 *      → Qui si indicizzano tutti i file del vendor.
 *
 *   3. ENTRAVA DA `GET_DAMAGE_SV`. L'ingresso vero è
 *      `CALCULATE_ALL_MOVES_SV`, che prima prepara i Pokémon (Intimidate,
 *      Download, Intrepid Sword, abilità paradosso) e poi calcola.
 *      → Qui si parte da lì.
 *
 * ═══ COME SI RICONOSCE UN RIFERIMENTO A UN'ABILITÀ ════════════════════════
 *
 * NCP le nomina in due modi, e servono entrambi:
 *
 *   CANALE «STR» — letterale di stringa:   attacker.ability === "Punk Rock"
 *      Preciso: elimina il problema dei nomi che sono anche parole comuni.
 *
 *   CANALE «ID» — identificatore:          field.isFriendGuard
 *      Friend Guard non compare mai come stringa: è un flag del campo. Senza
 *      questo canale sarebbe un falso negativo, cioè la direzione pericolosa.
 *
 * Due accorgimenti nel canale ID, entrambi nati da errori veri:
 *
 *   - i NOMI DI FUNZIONE sono esclusi dal pool. Senza, l'abilità «Immunity»
 *     agganciava la funzione `immunityChecks` e risultava calcolata.
 *   - la mappa dei nomi è un `Object.create(null)`. Con un oggetto normale
 *     `NOMI['toString']` è vero per ereditarietà dal prototipo, e lo script
 *     tentava di analizzare una funzione che non esiste.
 *
 * I COMMENTI VENGONO TOLTI PRIMA DI CERCARE. Non è pignoleria: in NCP
 * `//m. Metronome item` è un commento senza codice sotto. Cercando nel testo
 * grezzo, Metronome risulterebbe calcolato e prenderebbe un badge sbagliato.
 *
 * ═══ COSA RESTA FUORI, E PERCHÉ ═══════════════════════════════════════════
 *
 * La chiusura raggiunge anche funzioni che non spostano un numero che l'app
 * sappia mostrare. Sono elencate in `FUORI_SUPERFICIE` con la ragione accanto.
 * La regola che le governa è una sola:
 *
 *   Un'abilità entra nella lista se esiste una configurazione ESPRIMIBILE
 *   NELL'APP in cui NCP darebbe un numero diverso dal nostro.
 *
 * Le abilità di cambio forma sono un caso a parte: `aegislash-blade` e
 * `palafin-hero` sono voci separate del nostro dex, quindi l'utente sceglie
 * già la forma e Stance Change non ha niente da cambiare. Stanno in
 * `FORME_SCELTE_A_MANO`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ABILITY_EFFECTS, normalizeAbilityKey } from '../src/data/abilityEffects.js'
import { badgeDaTogliere } from './classificazione-badge.mjs'
import { haEffetto } from './campi-meta.mjs'
import { ITEM_EFFECTS } from '../src/data/itemEffects.js'

const QUI = path.dirname(fileURLToPath(import.meta.url))
const RADICE = path.resolve(QUI, '..')
const VENDOR = path.join(RADICE, 'vendor', 'ncp')
// Due file, e la ragione è il peso del bundle.
//
// L'applicazione ha bisogno solo delle CHIAVI: «questa voce porta il badge,
// sì o no». Le righe di prova — file, riga, funzione del vendor — servono a
// chi verifica la lista a mano e a chi scrive le issue, cioè a nessuno in
// produzione. Tenerle in `src/data/` costava 25 kB di bundle misurati, su un
// chunk che la sessione E deve portare sotto i 700.
const DESTINAZIONE = path.join(RADICE, 'src', 'data', 'gapNoti.json')
const RAPPORTO = path.join(RADICE, 'scripts', 'ncp', 'gap-rapporto.json')

const COMMIT_NCP = '7919130'
const INGRESSO = 'CALCULATE_ALL_MOVES_SV'

// ───────────────────────────────────────────────────────────────────────────
// Esclusioni dichiarate
// ───────────────────────────────────────────────────────────────────────────

/** Funzioni raggiunte dalla chiusura che però non spostano un numero nostro. */
const FUORI_SUPERFICIE = {
  buildDescription:           'costruisce la stringa descrittiva, non il danno',
  appendIfSet:                'formattazione della descrizione',
  toSmogonStat:               'formattazione della descrizione',
  addLevelDesc:               'formattazione della descrizione',
  numericSort:                'ordinamento, nessun effetto',
  getHPInfo:                  'formattazione della descrizione',
  GET_DAMAGE_HANDLER:         'smistatore di generazione',
  checkConditionalPriority:   'priorità di mossa: non è un numero che mostriamo',
  canBeBurned:                'richiede lo status, che non modelliamo (§1.12)',
  checkAddCalcQualifications: 'calcoli dei turni successivi: funzione assente da noi',
  additionalDamageCalcs:      'calcoli dei turni successivi: funzione assente da noi',
  ZMoves:                     'Z-mosse: fuori scope dichiarato',
  MaxMoves:                   'Dynamax: fuori scope dichiarato',
  getSignatureZMove:          'Z-mosse: fuori scope dichiarato',
  checkMeFirst:               'Me First non è modellata',
  statusMoves:                'mosse di stato: potenza zero, nessun danno',
  NaturePower:                'Nature Power non è modellata',
  NaturalGift:                'Natural Gift non è modellata',
  getNaturalGift:             'Natural Gift non è modellata',
  cantFlingItem:              'Fling non è modellata',
  getFlingPower:              'Fling non è modellata',
  cantRemoveItem:             'rimozione strumento: non modellata',
  canMega:                    'Megaevoluzioni: fuori scope',
  getFinalSpeed:              'velocità, non danno — la copre il punto 4 della sessione',
  getMoveCooldown:            'ricarica delle mosse: non modellata',
}

/**
 * Abilità di cambio forma. Il nostro dex ha le forme come voci separate
 * (`aegislash-blade`, `palafin-hero`, `darmanitan-zen`…), quindi l'utente
 * sceglie già la forma e il badge non avrebbe niente da dichiarare.
 */
const FORME_SCELTE_A_MANO = new Set([
  'stance change', 'zen mode', 'schooling', 'shields down', 'zero to hero',
  'power construct', 'tera shift', 'multitype', 'rks system',
])

// ───────────────────────────────────────────────────────────────────────────
// Lettura del vendor
// ───────────────────────────────────────────────────────────────────────────

const sorgenti = Object.fromEntries(
  fs.readdirSync(VENDOR)
    .filter(f => f.endsWith('.js'))
    .map(f => [f, fs.readFileSync(path.join(VENDOR, f), 'utf8')]),
)

/**
 * Estrae il corpo di una funzione contando le graffe.
 *
 * Cammina sul testo ORIGINALE tenendo lo stato «sono dentro una stringa» o
 * «sono dentro un commento», perché una graffa dentro una stringa non conta.
 * (Un primo tentativo camminava sul testo ripulito usando indici del testo
 * originale: i due non coincidono, e il corpo usciva troncato.)
 */
function corpoFunzione(testo, nome) {
  const inizio = new RegExp(`function\\s+${nome}\\s*\\(`).exec(testo)
  if (!inizio) return null
  const apertura = testo.indexOf('{', inizio.index)
  let profondita = 0
  let stringa = null
  let commento = null
  for (let i = apertura; i < testo.length; i++) {
    const c = testo[i]
    const succ = testo[i + 1]
    if (commento === 'riga') { if (c === '\n') commento = null; continue }
    if (commento === 'blocco') { if (c === '*' && succ === '/') { commento = null; i++ } continue }
    if (stringa) { if (c === '\\') { i++; continue } if (c === stringa) stringa = null; continue }
    if (c === '/' && succ === '/') { commento = 'riga'; i++; continue }
    if (c === '/' && succ === '*') { commento = 'blocco'; i++; continue }
    if (c === '"' || c === "'" || c === '`') { stringa = c; continue }
    if (c === '{') profondita++
    else if (c === '}' && --profondita === 0) {
      return { grezzo: testo.slice(apertura, i + 1), rigaInizio: testo.slice(0, apertura).split('\n').length }
    }
  }
  return null
}

/** Separa codice e letterali di stringa, buttando via i commenti. */
function scandisci(testo, rigaBase) {
  let codice = ''
  let riga = rigaBase
  const letterali = []
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i]
    const succ = testo[i + 1]
    if (c === '\n') { riga++; codice += '\n'; continue }
    if (c === '/' && succ === '/') { while (i < testo.length && testo[i] !== '\n') i++; i--; continue }
    if (c === '/' && succ === '*') {
      i += 2
      while (i < testo.length && !(testo[i] === '*' && testo[i + 1] === '/')) { if (testo[i] === '\n') riga++; i++ }
      i++
      continue
    }
    if (c === '"' || c === "'") {
      let valore = ''
      const apice = c
      i++
      while (i < testo.length && testo[i] !== apice) { if (testo[i] === '\\') i++; valore += testo[i]; i++ }
      letterali.push({ testo: valore, riga })
      codice += ' _STR_ '
      continue
    }
    codice += c
  }
  return { codice, letterali }
}

// `Object.create(null)`: senza, `NOMI['toString']` sarebbe vero per
// ereditarietà e la chiusura tenterebbe di analizzare una funzione inesistente.
const NOMI = Object.create(null)
for (const [file, testo] of Object.entries(sorgenti)) {
  for (const m of testo.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)) NOMI[m[1]] = file
}

/** Chiusura transitiva delle chiamate a partire da una radice. */
function chiusura(radice) {
  const visti = new Set()
  const coda = [radice]
  const corpi = Object.create(null)
  while (coda.length) {
    const f = coda.shift()
    if (visti.has(f) || !NOMI[f]) continue
    visti.add(f)
    const c = corpoFunzione(sorgenti[NOMI[f]], f)
    if (!c) continue
    const s = scandisci(c.grezzo, c.rigaInizio)
    corpi[f] = { ...c, ...s, file: NOMI[f] }
    for (const m of s.codice.matchAll(/([A-Za-z0-9_$]+)\s*\(/g)) {
      if (NOMI[m[1]] && !visti.has(m[1])) coda.push(m[1])
    }
  }
  return { visti, corpi }
}

// ───────────────────────────────────────────────────────────────────────────
// Ricerca
// ───────────────────────────────────────────────────────────────────────────

/** Toglie spazi, trattini, punti e apostrofi: «Punk Rock» e «punk-rock» coincidono. */
const norm = (s) => String(s).toLowerCase().replace(/[.'’:]/g, '').replace(/[\s\-_]+/g, '')

// `haEffetto` e l'elenco dei campi meta stanno in `campi-meta.mjs`: ne
// esistevano due copie, una qui e una in `gap.test.js`, ed è il motivo per cui
// il punto cieco è sopravvissuto. Due copie della stessa assunzione non sono
// due verifiche.

function costruisciIndice(corpi, funzioni) {
  const perLetterale = new Map()
  const perIdentificatore = new Map()
  const nomiFunzione = new Set(Object.keys(NOMI).map(n => n.toLowerCase()))

  for (const f of funzioni) {
    const c = corpi[f]
    if (!c) continue
    for (const l of c.letterali) {
      const n = norm(l.testo)
      if (!perLetterale.has(n)) perLetterale.set(n, [])
      perLetterale.get(n).push({ funzione: f, file: c.file, riga: l.riga })
    }
    c.codice.split('\n').forEach((testoRiga, i) => {
      for (const m of testoRiga.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
        const n = m[0].toLowerCase()
        if (nomiFunzione.has(n)) continue   // vedi nota su «Immunity»
        if (!perIdentificatore.has(n)) perIdentificatore.set(n, [])
        perIdentificatore.get(n).push({ funzione: f, file: c.file, riga: c.rigaInizio + i })
      }
    })
  }
  return { perLetterale, perIdentificatore, identificatori: [...perIdentificatore.keys()] }
}

function cerca(voci, indice) {
  const trovate = []
  for (const { chiave, nome } of voci) {
    const n = norm(nome)
    if (indice.perLetterale.has(n)) {
      trovate.push({ chiave, nome, canale: 'STR', prova: indice.perLetterale.get(n)[0] })
      continue
    }
    // Il canale ID richiede almeno quattro caratteri: sotto, la probabilità
    // che un nome corto compaia dentro un identificatore per caso è alta.
    const id = indice.identificatori.find(i => i.includes(n) && n.length >= 4)
    if (id) trovate.push({ chiave, nome, canale: 'ID', identificatore: id, prova: indice.perIdentificatore.get(id)[0] })
  }
  return trovate
}

// ───────────────────────────────────────────────────────────────────────────
// Generazione
// ───────────────────────────────────────────────────────────────────────────

export function generaGap() {
  const abilita = JSON.parse(fs.readFileSync(path.join(RADICE, 'src/data/abilities.json'), 'utf8'))
  const strumenti = JSON.parse(fs.readFileSync(path.join(RADICE, 'src/data/items.json'), 'utf8'))

  const abConEffetto = new Set(
    Object.entries(ABILITY_EFFECTS).filter(([, v]) => haEffetto(v)).map(([k]) => k),
  )
  const itConEffetto = new Set(
    Object.entries(ITEM_EFFECTS).filter(([, v]) => haEffetto(v)).map(([k]) => norm(k)),
  )

  const abSenzaEffetto = Object.keys(abilita)
    .filter(k => !abConEffetto.has(normalizeAbilityKey(k)))
    .map(k => ({ chiave: k, nome: abilita[k].name }))
  const itSenzaEffetto = Object.keys(strumenti)
    .filter(k => !itConEffetto.has(norm(k)))
    .map(k => ({ chiave: k, nome: strumenti[k].name }))

  const { visti, corpi } = chiusura(INGRESSO)
  const rilevanti = [...visti].filter(f => !(f in FUORI_SUPERFICIE))
  const indice = costruisciIndice(corpi, rilevanti)

  // ── La seconda fonte ─────────────────────────────────────────────────────
  // `haEffetto` qui sopra guarda SOLO le tabelle, e le tabelle non sanno che
  // il motore implementa Pixilate per nome a `calcEngine.js:200`. Risultato:
  // badge «non calcolata» su un numero corretto, per sei voci.
  //
  // `classificazione-badge.mjs` elenca le voci su cui il motore ramifica
  // davvero, classificate a mano. Quelle marcate `badge-sbagliato` escono di
  // qui. Le altre restano: `sand force` la nominiamo per l'immunità alla
  // sabbia, mentre NCP la calcola per il +30% di potenza — meccanica diversa,
  // badge corretto.
  //
  // Chi le scopre è `npm run inventario:gen`, che si rifiuta di scrivere se
  // una collisione non è classificata.
  const togli = badgeDaTogliere()
  const abTrovate = cerca(abSenzaEffetto, indice)
    .filter(a => !FORME_SCELTE_A_MANO.has(a.chiave))
    .filter(a => !togli.abilita.includes(a.chiave))
  const itTrovati = cerca(itSenzaEffetto, indice)
    .filter(a => !togli.strumenti.includes(a.chiave))

  // Anomalie: effetti scritti per voci che nessuno può selezionare.
  const abSelezionabili = new Set(Object.keys(abilita).map(normalizeAbilityKey))
  const itSelezionabili = new Set(Object.keys(strumenti).map(norm))
  const anomalie = {
    abilitaConEffettoNonSelezionabili: [...abConEffetto].filter(k => !abSelezionabili.has(k)),
    strumentiConVoceNonSelezionabili: Object.keys(ITEM_EFFECTS).filter(k => !itSelezionabili.has(norm(k))),
    // Nomi che nella tendina si vedono così come sono scritti qui. Trovato in
    // F-2: `receiver` era minuscolo mentre tutte le altre 309 sono capitalizzate.
    nomiNonCapitalizzati: [
      ...Object.entries(abilita).filter(([, v]) => v.name && /^[a-z]/.test(v.name)).map(([k]) => `abilità: ${k}`),
      ...Object.entries(strumenti).filter(([, v]) => v.name && /^[a-z]/.test(v.name)).map(([k]) => `strumento: ${k}`),
    ],
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      ncpCommit: COMMIT_NCP,
      ingresso: INGRESSO,
      funzioniRaggiunte: visti.size,
      funzioniConsiderate: rilevanti.length,
      abilitaSelezionabili: Object.keys(abilita).length,
      abilitaSenzaEffetto: abSenzaEffetto.length,
      abilitaNelGap: abTrovate.length,
      strumentiSelezionabili: Object.keys(strumenti).length,
      strumentiSenzaEffetto: itSenzaEffetto.length,
      strumentiNelGap: itTrovati.length,
      badgeToltiDallaSecondaFonte: togli.abilita.length + togli.strumenti.length,
      note: 'Voci che il riferimento NCP calcola nel danno e il nostro motore no. '
          + 'Alimenta il badge «non calcolata». Rigenerare con `npm run gap:gen` '
          + 'dopo ogni sessione che aggiunge effetti.',
    },
    // Solo le chiavi: è tutto ciò che serve per decidere se disegnare il badge.
    abilita: abTrovate.map(a => a.chiave).sort(),
    strumenti: itTrovati.map(a => a.chiave).sort(),
    // Le prove vanno nel rapporto, non qui.
    prove: {
      abilita: abTrovate.map(a => ({ chiave: a.chiave, nome: a.nome, canale: a.canale, prova: a.prova })),
      strumenti: itTrovati.map(a => ({ chiave: a.chiave, nome: a.nome, canale: a.canale, prova: a.prova })),
    },
    esclusioni: {
      funzioni: FUORI_SUPERFICIE,
      formeScelteAMano: [...FORME_SCELTE_A_MANO],
    },
    anomalie,
  }
}

/** Il file leggero, importato dall'applicazione. */
function serializzaDati(dati) {
  const riga = (x) => '    ' + JSON.stringify(x)
  return [
    '{',
    '  "meta": ' + JSON.stringify({
      generatedAt: dati.meta.generatedAt,
      ncpCommit: dati.meta.ncpCommit,
      ingresso: dati.meta.ingresso,
      abilitaNelGap: dati.meta.abilitaNelGap,
      strumentiNelGap: dati.meta.strumentiNelGap,
      note: 'Chiavi che il riferimento calcola nel danno e noi no. Le prove '
          + 'stanno in scripts/ncp/gap-rapporto.json. Rigenerare: npm run gap:gen',
    }, null, 2).replace(/\n/g, '\n  ') + ',',
    '  "abilita": [',
    dati.abilita.map(riga).join(',\n'),
    '  ],',
    '  "strumenti": [',
    dati.strumenti.map(riga).join(',\n'),
    '  ]',
    '}',
    '',
  ].join('\n')
}

/** Il rapporto completo: prove, esclusioni, anomalie. Non entra nel bundle. */
function serializzaRapporto(dati) {
  return JSON.stringify({
    meta: dati.meta,
    prove: dati.prove,
    esclusioni: dati.esclusioni,
    anomalie: dati.anomalie,
  }, null, 2) + '\n'
}

const eseguitoDirettamente = process.argv[1] && process.argv[1].endsWith('gen-gap-noti.mjs')
if (eseguitoDirettamente) {
  const dati = generaGap()
  const m = dati.meta
  console.log('')
  console.log(`Ingresso                 ${m.ingresso}`)
  console.log(`Funzioni raggiunte       ${m.funzioniRaggiunte}  (considerate ${m.funzioniConsiderate})`)
  console.log('')
  console.log(`Abilità selezionabili    ${m.abilitaSelezionabili}`)
  console.log(`  senza effetto da noi   ${m.abilitaSenzaEffetto}`)
  console.log(`  di cui NCP calcola     ${m.abilitaNelGap}   ← badge`)
  console.log('')
  console.log(`Strumenti selezionabili  ${m.strumentiSelezionabili}`)
  console.log(`  senza effetto da noi   ${m.strumentiSenzaEffetto}`)
  console.log(`  di cui NCP calcola     ${m.strumentiNelGap}   ← badge`)

  if (process.argv.includes('--prove')) {
    console.log('\n── Abilità, con la riga di prova ───────────────────────────')
    for (const a of [...dati.prove.abilita].sort((x, y) => x.nome.localeCompare(y.nome))) {
      console.log(`  ${a.nome.padEnd(24)} ${a.canale}  ${a.prova.file}:${a.prova.riga}  (${a.prova.funzione})`)
    }
    console.log('\n── Strumenti ───────────────────────────────────────────────')
    for (const a of [...dati.prove.strumenti].sort((x, y) => x.nome.localeCompare(y.nome))) {
      console.log(`  ${a.nome.padEnd(24)} ${a.canale}  ${a.prova.file}:${a.prova.riga}  (${a.prova.funzione})`)
    }
  }

  const an = dati.anomalie
  if (an.abilitaConEffettoNonSelezionabili.length || an.strumentiConVoceNonSelezionabili.length) {
    console.log('\n── Anomalie: effetti scritti per voci non selezionabili ─────')
    if (an.abilitaConEffettoNonSelezionabili.length) {
      console.log('  abilità:   ' + an.abilitaConEffettoNonSelezionabili.join(', '))
    }
    if (an.strumentiConVoceNonSelezionabili.length) {
      console.log('  strumenti: ' + an.strumentiConVoceNonSelezionabili.join(', '))
    }
  }

  if (!process.argv.includes('--report')) {
    fs.writeFileSync(DESTINAZIONE, serializzaDati(dati), 'utf8')
    fs.writeFileSync(RAPPORTO, serializzaRapporto(dati), 'utf8')
    console.log(`\nScritto ${DESTINAZIONE}`)
    console.log(`Scritto ${RAPPORTO}\n`)
  } else {
    console.log('\n(--report: nessun file scritto)\n')
  }
}
