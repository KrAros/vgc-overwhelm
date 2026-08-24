/**
 * src/__tests__/anomalieListino.test.js
 *
 * Gli effetti scritti per voci che nessuno può selezionare.
 *
 * ─── COS'È UN'ANOMALIA DI LISTINO ──────────────────────────────────────────
 *
 * `ABILITY_EFFECTS` e `ITEM_EFFECTS` dicono cosa fa una voce. `abilities.json`
 * e `items.json` dicono cosa si può scegliere nelle tendine. Quando la prima
 * coppia nomina qualcosa che la seconda non offre, il motore porta un ramo che
 * nessun utente può accendere.
 *
 * `npm run gap:report` le elencava già, in fondo, sotto «Anomalie». Ma un
 * elenco stampato non ferma niente: erano diciannove, nessuno le guardava, e
 * fra loro c'era `'slowbro-mega'` — lo slug di una SPECIE finito come chiave
 * di uno strumento, doppione di `slobronite`. È rimasto lì finché non l'ha
 * cercato qualcuno.
 *
 * Questo file trasforma quell'elenco in un fatto rosso o verde: le anomalie
 * note stanno qui sotto con un verdetto, e una nuova fa fallire la suite.
 *
 * ─── PERCHÉ NON SI «SISTEMANO» E BASTA ─────────────────────────────────────
 *
 * Perché sistemarle vuol dire scrivere dati di gioco, e questo repository ha
 * una regola su questo: il riferimento si trascrive, non si deduce. Le quindici
 * Megapietre servirebbero di un nome visualizzato e di un numero d'icona —
 * `sprite.js` costruisce l'URL dal numero — e inventarli darebbe voci con
 * l'icona sbagliata, che è peggio di una voce assente.
 *
 * Quindi qui si classifica e si presidia. Riempire il listino è una sessione a
 * parte, che comincia da una fonte.
 */

import { describe, it, expect } from 'vitest'
import { ABILITY_EFFECTS, normalizeAbilityKey } from '../data/abilityEffects.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import abilities from '../data/abilities.json' with { type: 'json' }
import items from '../data/items.json' with { type: 'json' }
import roster from '../data/rosterChampions.json' with { type: 'json' }

// La stessa normalizzazione del generatore (`gen-gap-noti.mjs:251`), e non una
// più debole: `ITEM_EFFECTS` porta di proposito gli alias di scrittura —
// `never-melt-ice` accanto a `never-melt ice` — e con un semplice `toLowerCase`
// diventerebbero cinque anomalie inventate dal test.
const norm = (s) => String(s).toLowerCase().replace(/[.'’:]/g, '').replace(/[\s\-_]+/g, '')

/**
 * Le anomalie note, ciascuna con un verdetto. I due verdetti dicono cose
 * diverse su chi deve muoversi:
 *
 *   manca-nel-listino   la voce è legale in Champions e lo prova una fonte
 *                       del repository. È `items.json` a essere incompleto:
 *                       il ramo del motore è giusto e sta aspettando.
 *
 *   da-aggiudicare      nessuna fonte qui dentro dice se la voce esista in
 *                       Champions. Il registro marca, non nasconde: finché
 *                       non c'è una fonte, non si decide.
 */
const CLASSIFICAZIONE = {
  abilita: {
    'fire-mane': {
      verdetto: 'da-aggiudicare',
      nota: 'calcEngine:392 la ramifica sulle mosse di Fuoco. Il roster in '
          + 'rosterChampions.json elenca specie, non abilità, quindi qui dentro '
          + 'non c\'è niente che dica se esista.',
    },
  },
  strumenti: {
    'punching glove': {
      verdetto: 'da-aggiudicare',
      nota: 'porta un effetto vero — bpMod 1,1 sui pugni, calcEngine:500 — che '
          + 'oggi nessuno può accendere. Serve una fonte sul listino strumenti.',
    },
    'throat spray': { verdetto: 'da-aggiudicare', nota: 'solo showInSmogon: nessun effetto sul danno.' },
    'legend plate': { verdetto: 'da-aggiudicare', nota: 'solo showInSmogon: nessun effetto sul danno.' },
  },
}

/** Le Megapietre delle forme che il roster di Champions conferma. */
const MEGAPIETRE_ATTESE = {
  slobronite: 'slowbro-mega',
  feraligatrite: 'feraligatr-mega',
  dragonitite: 'dragonite-mega',
  greninjaite: 'greninja-mega',
  excadrillite: 'excadrill-mega',
  golurknite: 'golurk-mega',
  drampite: 'drampa-mega',
  froslasite: 'froslass-mega',
  hawluchite: 'hawlucha-mega',
  starmieite: 'starmie-mega',
  glimmorite: 'glimmora-mega',
  meowstite: 'meowstic-mega',
  barbaraclite: 'barbaracle-mega',
  scraftite: 'scrafty-mega',
  scolipedonite: 'scolipede-mega',
}

const abilitaSelezionabili = new Set(Object.keys(abilities).map(normalizeAbilityKey))
const strumentiSelezionabili = new Set(Object.keys(items).map(norm))

const abilitaAnomale = [...new Set(Object.keys(ABILITY_EFFECTS).map(normalizeAbilityKey))]
  .filter(k => !abilitaSelezionabili.has(k))
const strumentiAnomali = Object.keys(ITEM_EFFECTS).map(norm)
  .filter(k => !strumentiSelezionabili.has(k))

describe('anomalie di listino', () => {
  it('ogni abilità con effetto ma non selezionabile è classificata', () => {
    const note = new Set(Object.keys(CLASSIFICAZIONE.abilita).map(normalizeAbilityKey))
    const ignote = abilitaAnomale.filter(k => !note.has(k))
    expect(
      ignote,
      'nuova anomalia: un effetto scritto per un\'abilità che nessuno può scegliere. '
      + 'Classificala in questo file, oppure aggiungila ad abilities.json.',
    ).toEqual([])
  })

  it('ogni strumento con voce ma non selezionabile è classificato', () => {
    const noti = new Set([
      ...Object.keys(CLASSIFICAZIONE.strumenti).map(norm),
      ...Object.keys(MEGAPIETRE_ATTESE).map(norm),
    ])
    const ignoti = strumentiAnomali.filter(k => !noti.has(k))
    expect(
      ignoti,
      'nuova anomalia: una voce scritta per uno strumento che nessuno può tenere. '
      + 'Classificala in questo file, oppure aggiungila a items.json.',
    ).toEqual([])
  })

  it('le Megapietre non selezionabili sono tutte di forme che il roster conferma', () => {
    // È ciò che distingue «listino incompleto» da «riga inventata»: la forma
    // Mega esiste in Champions secondo rosterChampions.json, quindi la pietra
    // manca, non avanza.
    const nelRoster = new Set(roster.nel_roster)
    const senzaForma = Object.entries(MEGAPIETRE_ATTESE)
      .filter(([, forma]) => !nelRoster.has(forma))
      .map(([pietra, forma]) => `${pietra} → ${forma}`)

    expect(
      senzaForma,
      'questa pietra punta a una forma che il roster di Champions non ha: '
      + 'non è un listino incompleto, è una riga da togliere.',
    ).toEqual([])
  })

  it('ogni Megapietra attesa punta davvero alla forma dichiarata', () => {
    for (const [pietra, forma] of Object.entries(MEGAPIETRE_ATTESE)) {
      expect(ITEM_EFFECTS[pietra]?.megaStone, `${pietra} non mappa più su ${forma}`)
        .toBe(forma)
    }
  })

  it('nessuno slug di specie è usato come chiave di strumento', () => {
    // Il difetto che ha fatto nascere questo file: `'slowbro-mega'` era una
    // chiave di ITEM_EFFECTS, doppione di `slobronite`. Una chiave che finisce
    // per `-mega` è uno slug di forma, non il nome di una pietra.
    // Sulla chiave GREZZA: `norm` toglie i trattini, e `slowbromega` non si
    // distinguerebbe più da un nome di pietra scritto tutto attaccato.
    const sospette = Object.keys(ITEM_EFFECTS)
      .filter(k => /-mega(-[xy])?$/.test(k.toLowerCase().trim()))
    expect(
      sospette,
      'questa chiave è lo slug di una FORMA, non il nome di uno strumento: '
      + 'nessun Pokémon può tenerla, e il ramo che la nomina è morto.',
    ).toEqual([])
  })

  it('controllo negativo: la ricerca vede le voci selezionabili', () => {
    // Senza, i test sopra passerebbero anche con gli insiemi vuoti — per un
    // import rotto o un normalizzatore che risponde sempre di sì.
    expect(abilitaSelezionabili.has('intimidate')).toBe(true)
    expect(strumentiSelezionabili.has(norm('assault vest'))).toBe(true)
    expect(abilitaAnomale.length + strumentiAnomali.length).toBeGreaterThan(0)
  })
})
