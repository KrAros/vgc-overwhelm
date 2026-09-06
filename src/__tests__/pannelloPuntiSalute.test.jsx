// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/pannelloPuntiSalute.test.jsx
 *
 * Che il pannello di dettaglio e la cella della matrice dicano la stessa cosa.
 *
 * ─── IL DIFETTO, IN DUE RIGHE ──────────────────────────────────────────────
 *
 * Amoonguss messo a 111/221 PS nell'editor, Terremoto di Garchomp addosso:
 *
 *     la cella:      KO?  13%
 *     il pannello:   2HKO  2,3%,  con la barra che parte da 221
 *
 * Il pannello usava `result.defHP` — il massimo — in tutti e trentacinque i
 * punti in cui tocca i punti salute, compresi quelli che chiedono «quanti ne
 * restano». La cella leggeva `defPS` da quando esiste il verdetto a tre stati.
 * Due letture dello stesso fatto, e una era vecchia.
 *
 * ─── PERCHÉ NESSUN TEST L'HA VISTO ─────────────────────────────────────────
 *
 * Perché non ce n'era nessuno: cambiando quei venti punti la suite è rimasta
 * verde da cima a fondo. Il pannello non aveva presidii sui numeri, solo sul
 * layout (`prestazioni`, `accessibilita`).
 *
 * ─── IL CRITERIO ───────────────────────────────────────────────────────────
 *
 * L'accordo fra i due, non un numero che ho scritto io. Se domani cambia la
 * convoluzione del KO cambiano tutt'e due insieme e questo file resta verde,
 * che è giusto; se ne cambia una sola diventa rosso, che è il suo lavoro.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { caricaLingua } from '../i18n.js'
import { MoveCard } from '../components/ReportPanel.jsx'
import { calculateDamage } from '../calcEngine.js'
import { buildAttackerInput, buildDefenderInput } from '../lib/battleState.js'
import { emptyPokemon } from '../store/useCalcStore.js'
import { verdettoKO, findBestNHKO } from '../lib/damage.js'
import { psMassimi } from '../lib/psSlot.js'

beforeAll(() => caricaLingua('it'))

const slot = (extra = {}) => ({ ...emptyPokemon(), ...extra })

/**
 * Lo scenario di Simone: una mossa che dal pieno non uccide, contro un
 * bersaglio a metà vita. Misurato — Terremoto fa 94-112 su 221 PS.
 */
const ATT = slot({ key: 'garchomp', moves: ['earthquake'] })
const DIF_MAX = psMassimi(slot({ key: 'amoonguss', sps: [32, 0, 0, 0, 32, 0] }))
const dif = (ps) => slot({ key: 'amoonguss', sps: [32, 0, 0, 0, 32, 0], ps })

function calcola(ps) {
  return calculateDamage({
    attacker: buildAttackerInput(ATT),
    defender: buildDefenderInput(dif(ps)),
    move: 'earthquake',
    field: {},
  })
}

describe('lo scenario che ha fatto nascere questo file', () => {
  it('il caso è quello giusto: dal pieno NON uccide, a metà sì', () => {
    // Il presupposto. Senza, i due test qui sotto potrebbero confrontare due
    // «no» oppure due «KO garantito» e sembrare d'accordo per caso.
    const pieno = calcola(DIF_MAX)
    const meta  = calcola(Math.floor(DIF_MAX / 2))
    expect(pieno.maxDmg, 'dal pieno non deve uccidere').toBeLessThan(DIF_MAX)
    expect(meta.maxDmg, 'a metà deve poter uccidere').toBeGreaterThan(meta.defPS)
    expect(meta.minDmg, 'ma non sempre: serve il caso «possibile»').toBeLessThan(meta.defPS)
  })

  it('la cella e il pannello contano lo stesso numero di colpi', () => {
    for (const ps of [DIF_MAX, Math.floor(DIF_MAX / 2), 30]) {
      const r = calcola(ps)
      const cella = verdettoKO(r)
      // Come lo chiama il pannello: sui punti salute CORRENTI.
      const pannello = findBestNHKO(r.rolls, r.defPS, 0, { colpiPerTurno: 1, rollsFiglio: null })

      if (cella.stato === 'certo') {
        expect(pannello?.hits, `a ${ps} PS la cella dice KO certo`).toBe(1)
        expect(pannello?.pct).toBe(100)
      } else if (cella.stato === 'possibile') {
        expect(pannello?.hits, `a ${ps} PS la cella dice KO possibile`).toBe(1)
        expect(pannello?.pct, 'e con la stessa probabilità')
          .toBe(Math.round(cella.probabilita * 1000) / 10)
      } else {
        expect(pannello?.hits, `a ${ps} PS la cella dice niente KO`).toBeGreaterThan(1)
      }
    }
  })

  it('col MASSIMO invece i due divergono — è il difetto, riprodotto', () => {
    // Il controllo negativo. Se un domani `defPS` sparisse e tutto tornasse a
    // leggere il massimo, i test qui sopra resterebbero verdi solo se anche la
    // cella tornasse indietro: questo dice che le due strade DANNO numeri
    // diversi, cioè che sceglierne una è una decisione e non un dettaglio.
    const r = calcola(Math.floor(DIF_MAX / 2))
    const colResiduo = findBestNHKO(r.rolls, r.defPS, 0, { colpiPerTurno: 1, rollsFiglio: null })
    const colMassimo = findBestNHKO(r.rolls, r.defHP, 0, { colpiPerTurno: 1, rollsFiglio: null })
    expect(colResiduo.hits).toBe(1)
    expect(colMassimo.hits).toBe(2)
  })
})

describe('e il pannello lo scrive davvero', () => {
  const rendi = (ps) => renderToStaticMarkup(
    <MoveCard
      atk={ATT} def={dif(ps)} move="earthquake" result={calcola(ps)}
      field={{}} computedMoves={[]} activeMoveKey="earthquake"
      onMoveSelect={() => {}} onClose={() => {}}
    />)

  it('la soglia di KO è quella dei punti salute correnti', () => {
    const meta = Math.floor(DIF_MAX / 2)
    expect(rendi(meta)).toContain(`≥ ${meta} HP`)
    expect(rendi(DIF_MAX)).toContain(`≥ ${DIF_MAX} HP`)
  })

  it('il nodo di partenza dice da dove si parte, e solo se serve', () => {
    // A vita piena il nodo torna com'era: «221 HP», niente frazione.
    const pieno = rendi(DIF_MAX)
    expect(pieno).toContain(`${DIF_MAX} HP`)
    expect(pieno).not.toContain(`/ ${DIF_MAX} HP`)

    // Ferito, dice tutt'e due i numeri.
    const meta = Math.floor(DIF_MAX / 2)
    expect(rendi(meta)).toContain(`${meta} / ${DIF_MAX} HP`)
  })

  it('il VERDETTO scritto nel pannello è quello della cella', () => {
    // ─── PERCHÉ QUESTO CASO ESISTE ────────────────────────────────────────
    //
    // Perché i due qui sopra non bastavano. Provando a rimettere il difetto
    // — `findBestNHKO` di nuovo sul massimo — restavano VERDI: chiamavano
    // `findBestNHKO` per conto loro invece di leggere quello che il pannello
    // rende. Verificavano la funzione, non il componente.
    //
    // Questo legge il markup. E provandolo ha trovato un difetto peggiore di
    // quello che stavo correggendo: a metà vita il pannello non mostrava NÉ
    // «2HKO» né «1HKO chance» — il riquadro del verdetto restava vuoto,
    // perché `isOHKO` chiedeva ancora `minPct >= 100`, cioè il 100% del
    // massimo.
    const testo = (html) => [...html.matchAll(/>([^<>]{1,40})</g)].map(m => m[1].trim())

    // Dal pieno: due colpi, e lo dice.
    expect(testo(rendi(DIF_MAX)).join(' | ')).toMatch(/\b2HKO\b/)

    // A metà: un colpo, con la sua probabilità. Il pannello lo scrive come
    // percentuale di 1HKO, la cella come «KO?» — stesso fatto, due forme.
    const meta = Math.floor(DIF_MAX / 2)
    const r = calcola(meta)
    const atteso = Math.round(verdettoKO(r).probabilita * 1000) / 10
    const righe = testo(rendi(meta))
    expect(righe).toContain(`${atteso}%`)
    expect(righe.join(' | '), 'a metà vita non deve più dire che ne servono due')
      .not.toMatch(/\b2HKO\b/)
  })

  it('e quando i colpi restano più di uno, il CONTEGGIO cambia lo stesso', () => {
    // ─── IL CASO CHE MANCAVA, TROVATO CON UNA MUTAZIONE ───────────────────
    //
    // Rimettendo `findBestNHKO` sul massimo, i casi qui sopra restavano
    // verdi: con Terremoto a metà vita il pannello prende la strada del
    // «1HKO chance» e il badge nHKO non lo rende affatto, quindi
    // `not.toContain('2HKO')` era soddisfatto per il motivo sbagliato.
    //
    // Serve una mossa che NON uccida in un colpo nemmeno a metà, così il
    // badge c'è in tutt'e due i casi e i numeri si possono confrontare.
    // Sismisasso fa 58-69: dal pieno servono quattro colpi, a metà due.
    const testo = (html) => [...html.matchAll(/>([^<>]{1,40})</g)].map(m => m[1].trim())
    const conBulldoze = (ps) => {
      const atk = slot({ key: 'garchomp', moves: ['bulldoze'] })
      const r = calculateDamage({
        attacker: buildAttackerInput(atk), defender: buildDefenderInput(dif(ps)),
        move: 'bulldoze', field: {},
      })
      return testo(renderToStaticMarkup(
        <MoveCard atk={atk} def={dif(ps)} move="bulldoze" result={r} field={{}}
          computedMoves={[]} activeMoveKey="bulldoze"
          onMoveSelect={() => {}} onClose={() => {}} />))
    }
    // Il badge si legge «Garantito 4HKO» in un nodo solo, quindi si cerca
    // dentro il testo unito e non fra i nodi esatti.
    expect(conBulldoze(DIF_MAX).join(' | ')).toMatch(/\b4HKO\b/)
    expect(conBulldoze(Math.floor(DIF_MAX / 2)).join(' | ')).toMatch(/\b2HKO\b/)
  })

  it('e su un bersaglio quasi morto dice «garantito», non una probabilità', () => {
    // L'altro caso che una mutazione ha scoperto: `isOHKO` chiedeva
    // `minPct >= 100`, cioè il 100% del MASSIMO. A 30 PS anche il tiro
    // peggiore (94) uccide, ma è il 42% del massimo — quindi il pannello
    // rispondeva «100% di probabilità» invece di «garantito». Vero nei
    // numeri, sbagliato nella forma: il KO certo e il KO possibile si
    // distinguono per FORMA, non per un 100% che si potrebbe leggere come
    // arrotondamento. È la stessa regola del verdetto a tre stati.
    const righe = [...rendi(30).matchAll(/>([^<>]{1,40})</g)].map(m => m[1].trim())
    expect(righe.some(r => /1HKO/i.test(r) && /garant/i.test(r)), righe.join(' | '))
      .toBe(true)
  })

  it('e i punti salute DOPO il colpo si contano da dove si partiva', () => {
    // L'ultima mutazione sopravvissuta: `hpMin = defHP - maxDmg` invece di
    // `psIniziali - maxDmg`. La catena del turno — «parte da qui, il colpo
    // toglie tanto, resta questo» — ripartiva dal massimo, quindi mostrava un
    // Pokémon più sano di quanto fosse, subito sotto un nodo che diceva
    // «110 / 221».
    const meta = Math.floor(DIF_MAX / 2)
    const r = calcola(meta)
    const dopoMin = Math.max(0, meta - r.maxDmg)
    const dopoMax = Math.max(0, meta - r.minDmg)
    const righe = [...rendi(meta).matchAll(/>([^<>]{1,40})</g)].map(m => m[1].trim())

    expect(righe, `dopo il colpo devono restare ${dopoMin}–${dopoMax} PS`)
      .toContain(`${dopoMin}–${dopoMax}`)
    // E il presupposto: col massimo verrebbe un numero diverso, altrimenti il
    // caso non distingue le due strade.
    expect(`${Math.max(0, DIF_MAX - r.maxDmg)}–${Math.max(0, DIF_MAX - r.minDmg)}`)
      .not.toBe(`${dopoMin}–${dopoMax}`)
  })

  it('e i segmenti che segnano il KO sono quelli che uccidono davvero', () => {
    // La barra dei tiri colora di viola i roll che ammazzano. Contava quelli
    // sopra il MASSIMO: su un bersaglio a metà ne segnava uno invece di tre.
    // Il conteggio è ristretto ai SEGMENTI, non a `bg-purple-500` in tutto il
    // markup: la prima stesura contava anche il riquadro del tipo VELENO di
    // Amoonguss, che è viola pure lui. Sbagliava di uno esattamente, e da
    // «3 invece di 2» sembrava un difetto del codice invece che del test.
    const viola = (html) => (html.match(/h-2\.5 flex-1 rounded-sm bg-purple-500/g) || []).length

    const meta = Math.floor(DIF_MAX / 2)
    const rMeta = calcola(meta)
    const attesi = rMeta.rolls.filter(x => x >= rMeta.defPS).length
    expect(attesi, 'il caso non distingue niente se sono tutti o nessuno')
      .toBeGreaterThan(0)
    expect(attesi).toBeLessThan(rMeta.rolls.length)
    expect(viola(rendi(meta))).toBe(attesi)

    // Dal pieno non ne uccide nessuno, e infatti non ne colora nessuno.
    const rPieno = calcola(DIF_MAX)
    expect(rPieno.rolls.filter(x => x >= DIF_MAX).length).toBe(0)
    expect(viola(rendi(DIF_MAX))).toBe(0)
  })

  it('e disegna la parte già persa, col colore della barra dell\'editor', () => {
    // Scelta di Simone fra tre: si VEDE il vuoto invece di leggere una frase.
    // La barra c'è solo quando manca qualcosa.
    const meta = Math.floor(DIF_MAX / 2)
    const html = rendi(meta)
    expect(html).toContain(`width:${(meta / DIF_MAX) * 100}%`)
    expect(rendi(DIF_MAX)).not.toContain('width:100%')
  })
})
