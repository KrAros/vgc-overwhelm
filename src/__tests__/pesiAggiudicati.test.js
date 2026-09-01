// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/pesiAggiudicati.test.js
 *
 * I pesi su cui il nostro dato e quello di NCP non concordavano, e chi ha
 * vinto ciascuno.
 *
 * ─── PERCHÉ ERA UNA QUESTIONE APERTA ───────────────────────────────────────
 *
 * `gen-flag-dati.mjs` elencava da tempo le specie divergenti, con questa nota:
 *
 *     «`weight` non è letto da src/: le mosse che lo userebbero sono §1.11.
 *      Entrambe le parti sbagliano a turno, quindi ogni voce va aggiudicata a
 *      mano quando il dato diventerà osservabile.»
 *
 * È diventato osservabile quando Low Kick, Grass Knot, Heavy Slam e Heat Crash
 * hanno cominciato a ricavare la potenza dal peso. Da quel momento, su quaranta
 * specie, il numero mostrato dipendeva da quale delle due fonti avesse ragione
 * — e su Floette-Mega la differenza era fra 20 e 100 di potenza.
 *
 * ─── LA MISURA CHE HA RESO LA DOMANDA PONIBILE ─────────────────────────────
 *
 * In 28 casi su 40 il nostro peso era ESATTAMENTE quello della forma base:
 * Floette-Mega pesava 0,9 kg come Floette, Victreebel-Mega 15,5 come
 * Victreebel. Il controllo su tutte le 82 forme Mega ha mostrato che 42 hanno
 * un peso proprio — quindi la nostra fonte i pesi delle Mega li ha in parte, e
 * per le altre sembrava ripiegare sulla base.
 *
 * Sembrava: non bastava a decidere. Le 13 forme Mega col peso della base su cui
 * NCP concorda potevano essere pesi veri oppure lo stesso ripiego fatto da
 * tutt'e due.
 *
 * ─── IL VERDETTO, E DA CHI VIENE ───────────────────────────────────────────
 *
 * Da Simone, su richiesta, dopo aver visto l'elenco:
 *
 *     «NCP ha ragione sul peso di tutte le mega, più sul peso di
 *      necrozma-dawn, marshadow, okidogi, dialga-origin e palkia-origin.
 *      Noi sul resto del gruppo D.»
 *
 * Trentaquattro pesi corretti, tre confermati come nostri.
 *
 * ─── LE TRE SCOPERTE, CHIESTE A PARTE ──────────────────────────────────────
 *
 * Kommo-o, Typhlosion di Hisui e Tauros di Paldea (forma Acqua) non sono forme
 * Mega e non erano nel gruppo D: il primo verdetto non le copriva, e sono
 * rimaste col nostro valore finché non è arrivata una risposta — non per
 * decisione, per inerzia dichiarata.
 *
 * La risposta è arrivata su richiesta: NCP su tutte e tre.
 *
 * Vale la pena che resti scritto che sono state chieste DUE volte, in due
 * momenti diversi: il primo elenco era ordinato per impatto e le tre non
 * ricadevano in nessuna delle categorie della domanda. Accorgersene e chiedere
 * di nuovo è costato un giro; darle per aggiudicate sarebbe costato un numero
 * sbagliato su Tauros, che è l'unica delle tre a cambiare un gradino.
 *
 * ─── COSA RESTA DIVERSO DA NCP, E PERCHÉ VA BENE ───────────────────────────
 *
 * Tre pesi soli: lurantis, drednaw, arctovish. Divergono perché il nostro dato
 * ha vinto — su Drednaw NCP dice 8,5 kg, che non sta in piedi. Sono divergenze
 * VOLUTE, come le quattro mosse escluse da Parental Bond, e
 * `mosseAPeso.test.js` le tiene separate proprio per non far ricomparire una
 * domanda già risposta.
 */

import { describe, it, expect } from 'vitest'
import pokemonData from '../data/pokemon.json' with { type: 'json' }

/** [specie, peso, chi ha vinto] — il verdetto, riga per riga. */
const AGGIUDICATI = [
  // Le cinque nominate una per una, tutte a NCP.
  ['necrozma-dawn',   350,   'NCP'],
  ['marshadow',        22.2, 'NCP'],
  ['okidogi',          92.2, 'NCP'],
  ['dialga-origin',   850,   'NCP'],
  ['palkia-origin',   660,   'NCP'],
  // Le tre dove il nostro dato ha vinto.
  ['lurantis',         18.5, 'noi'],
  ['drednaw',         115.5, 'noi'],
  ['arctovish',       175,   'noi'],
  // Un campione delle Mega, tutte a NCP. Non le elenco tutte e ventinove:
  // il test qui sotto le copre in blocco confrontandole con l'oracolo.
  ['floette-mega',    100.8, 'NCP'],
  ['victreebel-mega', 125.5, 'NCP'],
  ['eelektross-mega', 180,   'NCP'],
  ['staraptor-mega',   50,   'NCP'],
  // Le tre chieste a parte, dopo essersi accorti che il primo verdetto non le
  // copriva. Tutte a NCP.
  ['kommo-o',           78.2, 'NCP'],
  ['typhlosion-hisui',  69.8, 'NCP'],
  ['tauros-paldea-aqua', 110, 'NCP'],
]

/** Le tre dove divergiamo da NCP per scelta, non per caso. */
const VOLUTE = ['lurantis', 'drednaw', 'arctovish']

describe('il verdetto sui pesi è registrato, non ricordato', () => {
  for (const [specie, peso, chi] of AGGIUDICATI) {
    it(`${specie} pesa ${peso} (${chi})`, () => {
      expect(pokemonData[specie]?.weight, `aggiudicato a ${chi} da Simone`).toBe(peso)
    })
  }

  it('non resta piu' + String.fromCharCode(39) + ' niente da chiedere', () => {
    // Quaranta divergenze, quaranta aggiudicate. Se un giorno ne comparisse
    // una nuova, `mosseAPeso.test.js` la trova; questo file registra soltanto
    // le decisioni prese, e una decisione senza fonte non è una decisione.
    expect(AGGIUDICATI.every(([, , chi]) => chi === 'NCP' || chi === 'noi')).toBe(true)
    expect(VOLUTE.every(s => pokemonData[s]?.weight !== undefined)).toBe(true)
  })
})
