// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * ─── QUALI SPECIE ESISTONO IN POKÉMON CHAMPIONS ─────────────────────────────
 *
 *   npm run roster:gen      sonda e scrive
 *   npm run roster:report   sonda e stampa, senza scrivere
 *
 * L'app offre 1221 specie perché l'anagrafica è quella completa. Champions ne
 * ha molte meno, e fino a oggi niente lo diceva: si potevano costruire squadre
 * che nel gioco non esistono.
 *
 * ─── PERCHÉ LA SINGOLA PAGINA E NON L'ELENCO ───────────────────────────────
 *
 * L'indice della fonte elenca 244 slug, ma è PARZIALE: `charizard-mega-y`,
 * `garchomp-mega` e `venusaur-mega` rispondono 200 con decine di build pur non
 * comparendo nell'elenco. Misurato prima di scegliere l'oracolo.
 *
 * La singola pagina invece discrimina: `floette` dà 404, `floette-mega` dà 200.
 * Quindi si sonda specie per specie, con HEAD — stesso esito del GET e senza
 * scaricare mezzo megabyte a colpo.
 *
 * ─── IL CONFINE, DICHIARATO ────────────────────────────────────────────────
 *
 * È **UNA FONTE SOLA**, e per la regola nata in R non è «la» misura ma la
 * superficie che abbiamo scelto. Un 404 qui vuol dire «questo sito non ha una
 * pagina per questa specie», che è un ottimo indizio e non una prova di
 * illegalità nel gioco. Il registro lo scrive, e chi lo usa deve trattarlo così.
 *
 * Per questo il risultato NON nasconde niente: marca. Nascondere una specie
 * che il gioco ha, per un 404 di un sito terzo, sarebbe il difetto peggiore di
 * quello che stiamo correggendo.
 *
 * ─── EDUCAZIONE VERSO IL SERVER ────────────────────────────────────────────
 *
 * Tre richieste alla volta con una pausa fra i lotti: sono ~1200 HEAD in una
 * decina di minuti, cioè il ritmo di una persona che naviga. Il registro si
 * rigenera a mano e di rado, non a ogni build.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIVI = !process.argv.includes('--report')
const USCITA = path.join(RADICE, 'src/data/rosterChampions.json')
/**
 * L'indirizzo della fonte non sta nel repository pubblico: e' una scelta, non
 * una dimenticanza. Chi rigenera lo mette qui, oppure lo passa come variabile
 * d'ambiente; senza, il generatore si ferma invece di sondare un indirizzo
 * inventato.
 *
 * Il registro prodotto continua a dichiarare METODO e DATA — cioe' quello che
 * serve per giudicare quanto vale un 404 — e da oggi la legalita' non dipende
 * piu' da questa sonda: la stabilisce `regChampions.json`, trascritto dagli
 * elenchi ufficiali delle reg. Questa resta una seconda opinione utile.
 */
const BASE = process.env.ROSTER_FONTE ?? ''
if (!BASE) {
  console.error('Manca l\'indirizzo della fonte: passalo in ROSTER_FONTE.')
  process.exit(1)
}
const UA = { 'User-Agent': 'Mozilla/5.0 (the-sixth-ember roster probe)' }

const pokemon = JSON.parse(fs.readFileSync(path.join(RADICE, 'src/data/pokemon.json'), 'utf8'))
const CHIAVI = Object.keys(pokemon)

/**
 * IL CONTROLLO. Due specie che sappiamo dentro e due che sappiamo fuori,
 * verificate a mano prima di scrivere lo script. Se la sonda non le distingue
 * — tutto 200 o tutto 404 — la corsa non vale niente e si ferma qui.
 */
const CONTROLLO = { dentro: ['garchomp', 'charizard-mega-y'], fuori: ['flutter-mane', 'iron-hands'] }

/**
 * ─── DOVE LA FONTE CHIAMA LA STESSA SPECIE IN UN ALTRO MODO ────────────────
 *
 * La prima corsa dava `basculegion-f` DENTRO e `basculegion-m` FUORI, che è
 * assurdo. La ragione non era il gioco: la fonte chiama quella specie
 * `basculegion` e basta, quindi sondando la NOSTRA chiave si prendeva un 404
 * che non voleva dire «non c'è».
 *
 * Simone ha confermato dal gioco che Basculegion M c'è. Da lì ho cercato gli
 * altri disallineamenti e li ho verificati uno per uno: sei su sette provati
 * erano falsi negativi dello stesso tipo.
 *
 * L'alias corregge la CAUSA — l'URL da chiedere — invece di rattoppare il
 * risultato. Una pezza sul risultato sarebbe sparita alla rigenerazione
 * successiva: è la regola nata in K sui generatori non idempotenti.
 *
 * `tauros-paldea-blaze` NON è qui: provato `tauros-paldea-blaze-breed` e dà
 * 404 come la nostra chiave. Le altre due razze di Tauros ci sono, questa no —
 * lasciato fuori perché è quello che la fonte dice, non perché non l'ho
 * cercato.
 */
const ALIAS_FONTE = {
  'basculegion-m':        'basculegion',
  'arcanine-hisui':       'arcanine-hisuian',
  'typhlosion-hisui':     'typhlosion-hisuian',
  'tauros-paldea-aqua':   'tauros-paldea-aqua-breed',
  'tauros-paldea-combat': 'tauros-paldea-combat-breed',
  'lycanroc-midday':      'lycanroc',
  'lycanroc-dusk':        'lycanroc',
}

async function stato(slug) {
  const chiesto = ALIAS_FONTE[slug] ?? slug
  for (let tent = 0; tent < 3; tent++) {
    try {
      const r = await fetch(BASE + chiesto, { method: 'HEAD', headers: UA })
      if (r.status === 200 || r.status === 404) return r.status
      await new Promise(r => setTimeout(r, 800 * (tent + 1)))
    } catch { await new Promise(r => setTimeout(r, 800 * (tent + 1))) }
  }
  return null            // né 200 né 404 dopo tre tentativi: non lo sappiamo
}

async function aLotti(chiavi, quanti, pausa) {
  const esito = {}
  for (let i = 0; i < chiavi.length; i += quanti) {
    const lotto = chiavi.slice(i, i + quanti)
    const st = await Promise.all(lotto.map(stato))
    lotto.forEach((k, j) => { esito[k] = st[j] })
    if (i % 120 === 0) process.stdout.write(`\r  sondate ${i + lotto.length}/${chiavi.length}`)
    await new Promise(r => setTimeout(r, pausa))
  }
  process.stdout.write('\n')
  return esito
}

console.log(`  sonda ${CHIAVI.length} specie su ${BASE}`)
const esito = await aLotti(CHIAVI, 3, 150)

// ─── il controllo, prima di scrivere qualunque cosa ─────────────────────────
const dentroOk = CONTROLLO.dentro.every(k => esito[k] === 200)
const fuoriOk = CONTROLLO.fuori.every(k => esito[k] === 404)
if (!dentroOk || !fuoriOk) {
  console.error('\n  CONTROLLO FALLITO — la sonda non distingue dentro da fuori.')
  console.error('  dentro:', CONTROLLO.dentro.map(k => `${k}=${esito[k]}`).join(' '))
  console.error('  fuori: ', CONTROLLO.fuori.map(k => `${k}=${esito[k]}`).join(' '))
  process.exit(1)
}

const dentro = CHIAVI.filter(k => esito[k] === 200).sort()
const fuori = CHIAVI.filter(k => esito[k] === 404)
const ignoti = CHIAVI.filter(k => esito[k] === null)

console.log(`\n  nel roster   ${String(dentro.length).padStart(5)}`)
console.log(`  fuori        ${String(fuori.length).padStart(5)}`)
console.log(`  non decisi   ${String(ignoti.length).padStart(5)}${ignoti.length ? '  ' + ignoti.slice(0, 6).join(' ') : ''}`)
console.log(`  controllo    dentro ${CONTROLLO.dentro.join('/')} = 200 · fuori ${CONTROLLO.fuori.join('/')} = 404 → distingue`)

if (SCRIVI) {
  fs.writeFileSync(USCITA, JSON.stringify({
    condizioni: {
      sondato: new Date().toISOString().slice(0, 10),
      fonte: 'registro pubblico di build competitive di Champions, una pagina per specie',
      metodo: 'HEAD per specie; 200 = la fonte ha una pagina, 404 = non ce l\'ha',
      nota: 'UNA FONTE SOLA: un 404 e\' un indizio forte, non una prova di illegalita\' nel gioco. Il registro marca, non nasconde.',
      controllo: CONTROLLO,
      specie_sondate: CHIAVI.length,
    },
    // Scritto nel registro perché chi lo legge sappia quali voci sono entrate
    // con un nome diverso da quello che la fonte espone.
    alias_fonte: ALIAS_FONTE,
    nel_roster: dentro,
    non_decise: ignoti,
  }, null, 1) + '\n')
  console.log(`\n  scritto src/data/rosterChampions.json`)
}
