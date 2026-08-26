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
 * di uno strumento, doppione della pietra di Slowbro. È rimasto lì finché non
 * l'ha cercato qualcuno.
 *
 * Questo file trasforma quell'elenco in un fatto rosso o verde: le anomalie
 * note stanno qui sotto con un verdetto, e una nuova fa fallire la suite.
 *
 * ─── PERCHÉ NON SI «SISTEMANO» E BASTA ─────────────────────────────────────
 *
 * Perché sistemarle vuol dire scrivere dati di gioco, e questo repository ha
 * una regola su questo: il riferimento si trascrive, non si deduce.
 *
 * ─── QUINDICI ANOMALIE CHE NON ERANO ANOMALIE ──────────────────────────────
 *
 * Questo file classificava quindici Megapietre come «manca-nel-listino»:
 * `items.json` incompleto, il motore che aspetta una fonte.
 *
 * Era falso, e in un modo che vale la pena scrivere. Le quindici pietre
 * stavano in `items.json` da sempre, con nome e numero d'icona veri. A non
 * combaciare era la CHIAVE con cui `ITEM_EFFECTS` le nominava: `slobronite`
 * contro `slowbronite`, `starmieite` contro `starminite`, `scolipedonite`
 * contro `scolipite`. Quindici nomi DEDOTTI dalla specie invece che
 * trascritti dal listino — cioè esattamente la regola qui sopra, infranta
 * mentre la si citava.
 *
 * Il costo non era teorico. `isStrumentoInamovibile` cerca la chiave in
 * `ITEM_EFFECTS`, non la trova, e conclude che la pietra si può togliere:
 * Knock Off prendeva il ×1.5 contro il Pokémon che si Megaevolve con quella
 * pietra. Misurato prima di correggere, Incineroar contro Mega Slowbro con la
 * Slowbronite: **110 invece di 78**. Su Mega Starmie 168 invece di 114.
 *
 * E la ricerca che aveva prodotto il verdetto sbagliato era passata di qui:
 * cercare `slobronite` in `items.json` non dà niente, e «non c'è» è stato
 * letto come «il listino è incompleto» invece che come «la nostra chiave è
 * sbagliata». Un'assenza non dice da quale lato sta l'errore.
 *
 * Quindi qui si classifica e si presidia — ma un'anomalia va prima cercata
 * dall'altro verso: la voce esiste sotto un altro nome?
 */

import { describe, it, expect } from 'vitest'
import { ABILITY_EFFECTS, normalizeAbilityKey } from '../data/abilityEffects.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import { calculateDamage } from '../calcEngine.js'
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

const ATTACCANTE = {
  atkPokemon: 'incineroar', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
  atkAbility: null, atkItem: null, level: 50,
}
const difensore = (defPokemon, defItem) => ({
  defPokemon, defSPs: [32, 0, 18, 0, 16, 0], defNature: 'careful',
  defAbility: null, defItem, defBoost: 0, spDefBoost: 0, defAbilityFlags: {},
})

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
    const noti = new Set(Object.keys(CLASSIFICAZIONE.strumenti).map(norm))
    const ignoti = strumentiAnomali.filter(k => !noti.has(k))
    expect(
      ignoti,
      'nuova anomalia: una voce scritta per uno strumento che nessuno può tenere. '
      + 'Classificala in questo file, oppure aggiungila a items.json.',
    ).toEqual([])
  })

  it('ogni Megapietra con un effetto è selezionabile e punta a una forma vera', () => {
    // I due fatti che le quindici chiavi sbagliate violavano insieme, e che
    // nessun test controllava dal verso giusto.
    const pietre = Object.entries(ITEM_EFFECTS).filter(([, v]) => v.megaStone)
    const nelRoster = new Set(roster.nel_roster)

    const introvabili = pietre
      .filter(([k]) => !strumentiSelezionabili.has(norm(k)))
      .map(([k, v]) => `${k} → ${v.megaStone}`)
    expect(
      introvabili,
      'questa pietra ha un effetto ma nessuno può sceglierla: se il nome esiste '
      + 'in items.json sotto un\'altra grafia, è la nostra chiave a essere '
      + 'sbagliata — non il listino a essere incompleto.',
    ).toEqual([])

    // Sei pietre puntano a forme che Champions non ha ancora, perché non ha la
    // BASE: Mewtwo, Salamence, Latias, Latios e Diancie non sono nel roster.
    // Sono rami dormienti, non righe da togliere — e restano elencati qui uno
    // per uno perché una SETTIMA comparsa sia una domanda, non un dettaglio.
    const DORMIENTI = new Set([
      'mewtwonite x', 'mewtwonite y', 'salamencite', 'latiasite', 'latiosite', 'diancite',
    ])
    const senzaForma = pietre
      .filter(([k, v]) => !nelRoster.has(v.megaStone) && !DORMIENTI.has(k))
      .map(([k, v]) => `${k} → ${v.megaStone}`)
    expect(
      senzaForma,
      'questa pietra punta a una forma che il roster di Champions non ha: '
      + 'o la specie è entrata nel gioco e il roster è vecchio, o la riga è da togliere.',
    ).toEqual([])

    // E le dormienti devono restare davvero dormienti: se una entra nel roster,
    // va tolta da qui invece di restare marcata per sempre.
    const svegliate = [...DORMIENTI].filter(k => nelRoster.has(ITEM_EFFECTS[k]?.megaStone))
    expect(svegliate, 'questa forma ora è nel roster: togli la pietra dalle dormienti').toEqual([])
  })

  it('la pietra di chi si Megaevolve non si può togliere', () => {
    // La conseguenza misurabile, non la forma dei dati: se la chiave torna a
    // non combaciare, `isStrumentoInamovibile` risponde `false` e Knock Off
    // prende un ×1.5 che non gli spetta.
    for (const [pietra, v] of Object.entries(ITEM_EFFECTS)) {
      if (!v.megaStone) continue
      const chiSiEvolve = v.daForma ?? v.megaStone.replace(/-mega(-[xy])?$/, '')
      expect(
        calculateDamage({
          attacker: ATTACCANTE,
          defender: difensore(chiSiEvolve, pietra),
          move: 'knock off', field: {}, debug: false,
        }).rolls,
        `Knock Off boostato contro ${chiSiEvolve} che tiene la propria ${pietra}`,
      ).toEqual(
        calculateDamage({
          attacker: ATTACCANTE,
          defender: difensore(chiSiEvolve, null),
          move: 'knock off', field: {}, debug: false,
        }).rolls,
      )
    }
  })

  it('nessuno slug di specie è usato come chiave di strumento', () => {
    // Il difetto che ha fatto nascere questo file: `'slowbro-mega'` era una
    // chiave di ITEM_EFFECTS, doppione della pietra di Slowbro. Una chiave
    // che finisce per `-mega` è uno slug di forma, non il nome di una pietra.
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
