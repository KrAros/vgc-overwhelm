// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/traduzioni.test.js
 *
 * Che l'interfaccia italiana sia davvero in italiano.
 *
 * ─── IL DIFETTO ────────────────────────────────────────────────────────────
 * Segnalato guardando l'app sul telefono: il bottone diceva «Helping Hand»
 * anche in italiano. Non era una riga dimenticata, era una SECONDA COPIA:
 * cinque delle sei levette sono nomi di mosse, e `moves.*` — la fonte unica,
 * già tradotta — diceva da sempre «Altruismo», «Velaurora», «Distortozona».
 * Le copie in `ui.*` erano invecchiate, e non solo in inglese: dicevano
 * «VeloAurora» e «SchermoLuce» dove i nomi ufficiali sono «Velaurora» e
 * «Schermoluce».
 *
 * È la stessa forma di difetto del badge in F-3 e della conversione SP⇄EV in
 * L: due copie della stessa verità, e quella che nessuno guarda invecchia.
 * Chiusa togliendo le copie, non aggiornandole.
 *
 * ─── COSA GUARDA QUESTO FILE ───────────────────────────────────────────────
 * Non «le tre stringhe che abbiamo corretto», ma la proprietà: **nessuna
 * stringa di interfaccia resta identica nelle due lingue**, salvo un elenco
 * scritto per nome. Un elenco che cresce si vede; un'espressione che si
 * allarga no.
 */

import { describe, it, expect } from 'vitest'
// Il locale italiano NON si può chiamare `it`: è il nome della funzione di
// test di Vitest, e lo shadowing rompe il file prima ancora di eseguirlo.
import inglese from '../locales/en.json' with { type: 'json' }
import italiano from '../locales/it.json' with { type: 'json' }

/** Tutte le chiavi foglia in forma `sezione.chiave`. */
function foglie(oggetto, prefisso = '', acc = {}) {
  for (const [k, v] of Object.entries(oggetto)) {
    const q = prefisso ? `${prefisso}.${k}` : k
    if (v && typeof v === 'object') foglie(v, q, acc)
    else acc[q] = v
  }
  return acc
}

const EN = foglie(inglese)
const IT = foglie(italiano)

/**
 * Le sezioni che sono DATI di gioco, non interfaccia: lì moltissimi nomi
 * coincidono per davvero — le Megapietre si chiamano «Garchompite» in
 * entrambe le lingue, e Surf è Surf.
 */
const eDato = (k) => /^(items|moves|abilities|abilities_desc|abilities_desc_on|abilities_desc_off|natures|types)\./.test(k)

/**
 * Le uniche stringhe di interfaccia che possono restare uguali, e perché.
 * Aggiungerne una è una decisione, quindi si scrive qui e si vede nel diff.
 */
const IDENTICHE_AMMESSE = [
  'eot.ko_arrow',           // "→ KO" — simbolo
  'report.base',            // sigle di colonna, usate identiche in italiano
  'report.boost',
  'report.max',
  'report.min',
  'report.mod',
  'report.sp',
  'report.stat',
  'report.tot',
  'report.share_discord',   // nomi propri
  'report.share_twitter',
  'ui.import_tab_showdown',
  'ui.critShort',           // «Crit» si usa identico nel gergo italiano
  'ui.team1',               // scelta di registro: «team» non si traduce nel VGC
  'ui.team2',
]

describe('traduzioni — l\'interfaccia italiana è in italiano', () => {
  it('le due lingue hanno esattamente le stesse chiavi', () => {
    // Una chiave presente in una sola lingua è una stringa che in quell'altra
    // ricade sul testo inglese senza che nessuno se ne accorga.
    const soloEn = Object.keys(EN).filter(k => !(k in IT))
    const soloIt = Object.keys(IT).filter(k => !(k in EN))
    expect(soloEn, 'chiavi presenti solo in inglese').toEqual([])
    expect(soloIt, 'chiavi presenti solo in italiano').toEqual([])
  })

  it('nessuna stringa di interfaccia resta in inglese, salvo quelle ammesse', () => {
    const identiche = Object.keys(EN)
      .filter(k => !eDato(k) && IT[k] === EN[k])
      .sort()
    expect(identiche, 'se una è nuova, o va tradotta o va motivata nell\'elenco')
      .toEqual([...IDENTICHE_AMMESSE].sort())
  })

  it('le levette che sono mosse non hanno più una copia in `ui`', () => {
    // Le copie tolte. Se qualcuno le rimette, l'etichetta ricomincia a
    // divergere dal nome della mossa senza che nulla diventi rosso — ed è
    // esattamente com'era prima.
    for (const k of ['helpingHand', 'auroraVeil', 'lightScreen', 'reflect', 'tailwind', 'trick_room', 'aurora_veil']) {
      expect(`ui.${k}` in EN, `ui.${k} è tornata: l'etichetta va presa da moves.*`).toBe(false)
      expect(`ui.${k}` in IT, `ui.${k} è tornata: l'etichetta va presa da moves.*`).toBe(false)
    }
  })

  it('i nomi da cui le levette prendono l\'etichetta sono tradotti', () => {
    // Il controllo che si muove: se `moves.*` non fosse tradotto, puntarci
    // non avrebbe risolto niente e questo test sarebbe verde a vuoto.
    const attese = {
      'helping hand': 'Altruismo',
      'aurora veil': 'Velaurora',
      'light screen': 'Schermoluce',
      'reflect': 'Riflesso',
      'tailwind': 'Ventoincoda',
      'trick room': 'Distortozona',
    }
    for (const [chiave, atteso] of Object.entries(attese)) {
      expect(IT.moves?.[chiave] ?? italiano.moves[chiave], chiave).toBe(atteso)
      expect(italiano.moves[chiave]).not.toBe(inglese.moves[chiave])
    }
  })

  /**
   * ─── I NOMI DELLE ABILITÀ DENTRO LE DESCRIZIONI ──────────────────────────
   *
   * `abilities_desc_on.defiant` diceva «Intimidazione attiva → Sfida», e
   * `abilities_desc.contrary` «L'Intimidazione diventa +1 Attacco». Erano
   * traduzioni LETTERALI dei nomi inglesi, scritte a mano dentro le frasi,
   * mentre i nomi ufficiali italiani stavano già in `abilities.*`:
   * Prepotenza, Agonismo, Inversione, Tenacia.
   *
   * Tredici stringhe su due lingue. È la regola nata in M — se una stringa
   * esiste già in `abilities`, l'interfaccia la legge da lì — applicata
   * dentro le frasi con l'annidamento `$t(abilities.X)` di i18next.
   *
   * Questo test asserisce la PROPRIETÀ, non le tredici stringhe: una
   * descrizione che nomina un'abilità deve nominarla come la nomina
   * `abilities.*`. Chi riscrivesse «Sfida» a mano lo farebbe diventare rosso.
   */
  it('le descrizioni nominano le abilità col nome ufficiale della lingua', () => {
    const sbagliate = []
    for (const [nome, dizionario] of [['en', inglese], ['it', italiano]]) {
      for (const sezione of ['abilities_desc', 'abilities_desc_on', 'abilities_desc_off']) {
        for (const [chiave, testo] of Object.entries(dizionario[sezione] || {})) {
          // Le abilità che le descrizioni citano davvero per nome.
          for (const citata of ['intimidate', 'defiant', 'contrary', 'competitive']) {
            const ufficiale = dizionario.abilities[citata]
            const inglese_ = inglese.abilities[citata]
            // Cita il nome INGLESE dentro il testo italiano, oppure un nome che
            // non è quello ufficiale: in entrambi i casi è una copia a mano.
            const citaInglese = nome === 'it' && new RegExp(`\\b${inglese_}\\b`).test(testo)
            const annidato = testo.includes(`$t(abilities.${citata})`)
            if (citaInglese && !annidato) sbagliate.push(`${nome} ${sezione}.${chiave} nomina «${inglese_}» invece di «${ufficiale}»`)
          }
        }
      }
    }
    expect(sbagliate).toEqual([])
  })

  it('nessuna stringa italiana contiene una parola inglese rimasta a metà', () => {
    // Le stringhe mezze tradotte non le prende il test qui sopra: «Breakdown
    // turno» è DIVERSO da «Turn breakdown», quindi non risulta identico —
    // eppure la parola inglese è lì in mezzo, e sul telefono si legge.
    //
    // L'elenco è corto e nominato di proposito: sono le parole che in questo
    // progetto hanno un equivalente italiano già in uso altrove. «Team»,
    // «preset», «matchup», «spread» e «boost» NON sono qui: sono gergo che la
    // community italiana usa identico, ed è una scelta di registro presa.
    const parole = ['custom', 'breakdown', 'veil', 'screen', 'tailwind', 'helping']
    const sporche = Object.keys(IT)
      .filter(k => !eDato(k))
      .filter(k => parole.some(w => new RegExp(`\\b${w}`, 'i').test(String(IT[k]))))
      .map(k => `${k} = ${JSON.stringify(IT[k])}`)

    expect(sporche, 'stringhe italiane con una parola inglese dentro').toEqual([])
  })
})
