// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/descrizioniSilenziose.test.js
 *
 * Il verso che mancava: **l'app descrive un effetto, non lo applica, e non lo
 * dichiara**.
 *
 * ─── PERCHÉ NON BASTAVANO I CONTROLLI CHE C'ERANO ──────────────────────────
 *
 * Ce n'erano due, e guardano altrove:
 *
 *   `anomalieListino.test.js`   effetto scritto per una voce che nessuno può
 *                               scegliere. Il motore ha un ramo morto: nessun
 *                               numero sbagliato, solo codice che aspetta.
 *
 *   `gapNoti.json` (+ `gap.test.js`)  ciò che NCP calcola e noi no. Alimenta
 *                               il segnalino «non calcolata», che è la promessa
 *                               all'utente: «di questo numero non ti fidare».
 *
 * Fra i due resta scoperto il caso peggiore dei tre: la descrizione promette
 * un effetto, il motore non lo applica, e il segnalino tace. L'utente legge
 * «potenzia del 33%», vede un numero, e non ha modo di sapere che quel 33%
 * non c'è dentro.
 *
 * ─── IL CASO CHE L'HA FATTO NASCERE ────────────────────────────────────────
 *
 * Aura Fatata. Il registro del divario non poteva vederla, e per una ragione
 * precisa: in NCP il nome è COSTRUITO a runtime — `attacker.ability ===
 * (move.type + " Aura")`, `damage_MASTER.js:1568` — quindi le stringhe "Fairy
 * Aura" e "Dark Aura" non compaiono mai nel codice raggiunto dal generatore.
 * Esistono solo in un commento, e `gen-gap-noti.mjs` i commenti li butta via
 * di proposito (la ragione sta scritta a riga 61 di quel file, ed è giusta:
 * `//m. Metronome item` è un commento senza codice sotto, e cercarlo nel testo
 * grezzo darebbe un segnalino sbagliato).
 *
 * Due difese entrambe corrette, e un varco fra loro. Questo file guarda dal
 * terzo lato — non il riferimento, ma quello che l'app DICE di sé — e lì Aura
 * Fatata si vede benissimo, perché la sua descrizione promette il 33%.
 *
 * ─── COME SI DECIDE CHE UNA DESCRIZIONE PROMETTE UN NUMERO ─────────────────
 *
 * Con un vocabolario, che è un'euristica e va misurata invece che creduta.
 * Il banco di prova sono le abilità che NCP calcola e che hanno una
 * descrizione da noi: il vocabolario deve riconoscerne almeno otto su dieci,
 * ed è asserito qui sotto. Misurato quando è stato scritto: 46 su 57. La
 * prima versione ne aveva cinque di regole e faceva 33 su 57 — le altre sei
 * sono nate da quella misura, non dall'immaginazione.
 *
 * È una SOGLIA e non i due numeri esatti, di proposito: i numeri esatti
 * scendono ogni volta che un'abilità viene implementata, perché esce dal
 * divario e si porta via la sua descrizione. Un test che diventa rosso a ogni
 * sessione che fa il suo lavoro verrebbe aggiornato senza guardarlo.
 *
 * Quelle che sfuggono sono elencate nel test, una per una, e per sottrazione:
 * parlano di priorità, di bacche, di copia dell'abilità — cose vere che però
 * non nominano nessun numero. Una NUOVA che sfugge fa fallire il file.
 *
 * ─── IL REGISTRO MARCA, NON NASCONDE ───────────────────────────────────────
 *
 * Ogni candidato deve avere un verdetto scritto qui. Un candidato nuovo senza
 * verdetto fa fallire il file — ed è il punto: la prossima volta il silenzio
 * non passa.
 *
 * `silenziosa` è l'unico verdetto che è un difetto. Alla chiusura di questa
 * sessione ne resta uno, `rock-head`, e resta scritto invece che sistemato o
 * tolto: vedi il test in fondo.
 *
 * ─── E IL PUNTO CIECO DI QUESTO PRESIDIO ───────────────────────────────────
 *
 * Ce n'è uno, e sta scritto invece che taciuto: la ricerca scarta un'abilità
 * appena ha UN campo meccanico, quindi una descrizione applicata a metà le
 * sfugge. Il registro `PARZIALI` le dichiara a mano — oggi una, `eelevate`.
 */

import { describe, it, expect } from 'vitest'
import { ABILITY_EFFECTS, normalizeAbilityKey } from '../data/abilityEffects.js'
import { elencoGap } from '../lib/gap.js'
import abilities from '../data/abilities.json' with { type: 'json' }
import it_ from '../locales/it.json' with { type: 'json' }
import en from '../locales/en.json' with { type: 'json' }
// Stessa definizione che usa il generatore. Ne esistevano due copie, ed è il
// motivo per cui un punto cieco era sopravvissuto: vedi `campi-meta.mjs`.
import { haEffetto } from '../../scripts/campi-meta.mjs'
import { badgeDaTogliere } from '../../scripts/classificazione-badge.mjs'

// ───────────────────────────────────────────────────────────────────────────
// Il vocabolario
// ───────────────────────────────────────────────────────────────────────────
//
// Ogni regola porta accanto l'abilità del divario che l'ha resa necessaria:
// sono state trovate misurando, non immaginando. La prima versione aveva solo
// le prime cinque e la copertura sul divario era 33 su 57.

const VOCABOLARIO = [
  /potenz/i,                    // «Potenzia le mosse … del 33%»    fairy-aura
  /dann[oi]\b/i,                // «raddoppia il danno»             punk-rock
  /dimezz/i,                    // «dimezza il danno»               ice-scales
  /critic/i,                    // «colpi critici»                  super-luck
  /immun/i,                     // «Immunizza alle mosse Terra»     levitate
  /non ha(nno)? effetto/i,      // «Le mosse Erba non hanno effetto» sap-sipper
  /(attacco|difesa)( speciale)?\b[^.]{0,40}\b(sale|scende|raddoppia|aumenta|si dimezza|al massimo)/i,
                                // «la Difesa sale del 50%»         marvel-scale
  /(diventa|diventano) di tipo/i, // «diventano di tipo Acqua»      liquid-voice
  /(cambia tipo|il tipo cambia|tipo del pok[eé]mon cambia)/i, // forecast, protean
  /\bpeso\b/i,                  // «Raddoppia il peso»              heavy-metal
  /ignora[^.]*abilit/i,         // «ignorano l'abilità del bersaglio» mold-breaker
]

const prometteUnNumero = (descrizione) => VOCABOLARIO.some(r => r.test(descrizione))

// ───────────────────────────────────────────────────────────────────────────
// I verdetti
// ───────────────────────────────────────────────────────────────────────────
//
// Il testo sta qui una volta sola, non ripetuto voce per voce: una nota per
// riga sarebbe ventidue note che invecchiano insieme.

const VERDETTI = {
  'applicata-altrove':
    'il motore la applica per nome, fuori da ABILITY_EFFECTS. Nessun silenzio: '
    + 'il numero mostrato la contiene già.',
  'stadi':
    'promette una VARIAZIONE DI STATISTICA fra un turno e l\'altro. L\'app '
    + 'calcola un colpo solo, e lo stadio si imposta a mano nell\'editor: '
    + 'l\'effetto è esprimibile, ma non è il motore a doverlo accendere.',
  'stato':
    'promette una condizione di stato (o l\'immunità a una). Gli stati non '
    + 'sono modellati — §1.12 — e le mosse di stato hanno potenza zero.',
  'fuori-turno':
    'promette qualcosa che succede dopo il colpo calcolato: un altro turno, '
    + 'un altro bersaglio, un altro colpo.',
  'interruttore-critico':
    'promette una probabilità di brutto colpo. Nell\'app il critico è un '
    + 'interruttore che sceglie l\'utente, non una probabilità che calcoliamo.',
  'silenziosa':
    'DIFETTO. L\'app descrive un effetto su un numero che mostra, non lo '
    + 'applica, e il segnalino non lo dichiara.',
}

/**
 * Il registro. `prova` è obbligatoria solo dove il verdetto è un'affermazione
 * su codice che esiste — cioè per `applicata-altrove` e per `silenziosa`.
 */
const REGISTRO = {
  // ── Il motore le applica davvero, ma non da ABILITY_EFFECTS ─────────────
  'magic-guard': {
    verdetto: 'applicata-altrove',
    prova: 'lib/damage.js — SAND_IMMUNE_ABILITIES: toglie il danno da sabbia '
         + 'dal calcolo di fine turno, che il pannello mostra.',
  },
  'overcoat': {
    verdetto: 'applicata-altrove',
    prova: 'lib/damage.js — SAND_IMMUNE_ABILITIES, come magic-guard.',
  },

  // ── Variazioni di statistica fra turni ──────────────────────────────────
  'anger-point': { verdetto: 'stadi' },
  'berserk':     { verdetto: 'stadi' },
  'justified':   { verdetto: 'stadi' },
  'moxie':       { verdetto: 'stadi' },
  'stamina':     { verdetto: 'stadi' },
  'weak-armor':  { verdetto: 'stadi' },

  // ── Stati, e immunità agli stati ────────────────────────────────────────
  'corrosion':    { verdetto: 'stato' },
  'cursed-body':  { verdetto: 'stato' },
  'flower-veil':  { verdetto: 'stato' },
  'good-as-gold': { verdetto: 'stato' },
  'leaf-guard':   { verdetto: 'stato' },
  'shield-dust':  { verdetto: 'stato' },
  'spicy-spray':  { verdetto: 'stato' },
  'toxic-debris': { verdetto: 'stato' },

  // ── Dopo il colpo, o su un altro bersaglio ──────────────────────────────
  'innards-out': { verdetto: 'fuori-turno' },
  'stalwart':    { verdetto: 'fuori-turno' },

  // ── Il critico ──────────────────────────────────────────────────────────
  'merciless':  { verdetto: 'interruttore-critico' },
  'super-luck': { verdetto: 'interruttore-critico' },

  // ── Il difetto che resta aperto ─────────────────────────────────────────
  //
  // (`fairy-aura` stava qui, con verdetto `silenziosa`: è il caso per cui
  //  questo presidio è stato scritto. È uscita nel commit che ha implementato
  //  le due aure — adesso ha una voce in ABILITY_EFFECTS e non è più un
  //  candidato — e toglierla è stata parte di quel commit, non una pulizia
  //  successiva.)
  //
  // Trovato da questo presidio la prima volta che è stato eseguito, e NON è
  // il caso per cui era stato scritto. Vale la pena scriverlo per intero,
  // perché è la prova che il controllo serve.
  //
  // `ReportPanel.jsx:299` calcola e mostra il contraccolpo — «(rinculo 33.4 -
  // 39.1%)» — leggendo `recoil` da moves.json e nient'altro. Testa di Roccia
  // lo azzera, e il pannello non lo sa: mostra la percentuale piena.
  //
  // Non è teorico. `metaPresets.js` ha un set che si chiama «Rock Head
  // Attacker»: Arcanine di Hisui con Fuococarica e Insaccata, cioè DUE mosse
  // con contraccolpo, ed è esattamente il Pokémon che quel contraccolpo non
  // lo subisce.
  //
  // Resta qui invece di essere sistemato: il contraccolpo non è la catena del
  // danno, e questa sessione lavora su quella. Il registro marca, non nasconde.
  'rock-head': {
    verdetto: 'silenziosa',
    prova: 'ReportPanel.jsx:299 mostra il contraccolpo senza guardare '
         + 'l\'abilità; metaPresets.js ha «Rock Head Attacker» con due mosse '
         + 'che ne hanno uno.',
  },
}

// ───────────────────────────────────────────────────────────────────────────
// Le parziali: il punto cieco di QUESTO presidio
// ───────────────────────────────────────────────────────────────────────────
//
// La ricerca qui sotto scarta un'abilità appena `ABILITY_EFFECTS` le dà UN
// campo meccanico. Basta un campo: quindi una descrizione che promette due
// cose e ne vede applicata una sola esce dal setaccio ed è di nuovo silenziosa
// a metà — che è il difetto di partenza, in piccolo.
//
// Non è automatizzabile senza leggere le descrizioni molto meglio di come le
// legge un vocabolario di undici espressioni: «Immunizza alle mosse Terra.
// Aumenta la statistica più alta di 1 grado quando mette KO un avversario.»
// sono due frasi, e sapere che la seconda non è implementata vuol dire capire
// la seconda frase, non trovarci una parola.
//
// Quindi si dichiara a mano. Le due cose che il test può ancora controllare, e
// controlla, sono che la voce esista davvero e che sia davvero parziale
// rispetto a ciò che il registro qui sotto le riconosce.

const PARZIALI = {
  'eelevate': {
    applicato: 'l\'immunità alle mosse Terra (`levitate: true`), verificata '
             + 'contro NCP in rapidascesa.test.js.',
    mancante: '«Aumenta la statistica più alta di 1 grado quando mette KO un '
            + 'avversario»: è uno stato che l\'utente imposta a mano, come per '
            + 'Aegislash, Morpeko e Palafin, e l\'interruttore non esiste. '
            + 'Nemmeno NCP calcola quella metà.',
  },
}

// ───────────────────────────────────────────────────────────────────────────
// La ricerca
// ───────────────────────────────────────────────────────────────────────────

const conEffetto = new Set(
  Object.entries(ABILITY_EFFECTS).filter(([, v]) => haEffetto(v)).map(([k]) => normalizeAbilityKey(k)),
)
const nelGap = new Set(elencoGap.abilita.map(normalizeAbilityKey))
// La seconda fonte del generatore: le voci su cui il motore ramifica per nome
// e a cui il segnalino è stato TOLTO per questo. Se il motore la applica, la
// descrizione non è muta.
const applicataPerNome = new Set(badgeDaTogliere().abilita.map(normalizeAbilityKey))

const selezionabili = Object.keys(abilities).map(normalizeAbilityKey)

const candidati = selezionabili.filter((chiave) => {
  const descrizione = it_.abilities_desc[chiave]
  if (!descrizione) return false
  if (conEffetto.has(chiave)) return false
  if (nelGap.has(chiave)) return false
  if (applicataPerNome.has(chiave)) return false
  return prometteUnNumero(descrizione)
})

describe('descrizioni che promettono un numero', () => {
  it('ogni candidato ha un verdetto scritto', () => {
    const senzaVerdetto = candidati.filter(k => !REGISTRO[k])
    expect(
      senzaVerdetto,
      'questa abilità descrive un effetto, il motore non lo applica e il '
      + 'segnalino non lo dichiara. Classificala in questo file — oppure '
      + 'implementala, oppure fa\' in modo che gapNoti la dichiari.',
    ).toEqual([])
  })

  it('nessun verdetto è scaduto', () => {
    // Il verso opposto: una voce implementata resta nel registro per sempre e
    // il registro diventa una lapide. Toglierla è parte del commit che la
    // implementa.
    const insieme = new Set(candidati)
    const scaduti = Object.keys(REGISTRO).filter(k => !insieme.has(k))
    expect(scaduti, 'questa voce non è più un candidato: togli la riga dal registro').toEqual([])
  })

  it('ogni verdetto usato esiste, e quelli che affermano codice portano una prova', () => {
    for (const [chiave, voce] of Object.entries(REGISTRO)) {
      expect(Object.keys(VERDETTI), `verdetto ignoto su ${chiave}`).toContain(voce.verdetto)
      if (voce.verdetto === 'applicata-altrove' || voce.verdetto === 'silenziosa') {
        expect(voce.prova, `${chiave}: questo verdetto afferma qualcosa sul codice, serve la riga`)
          .toBeTruthy()
      }
    }
  })

  it('le silenziose sono esattamente quelle note', () => {
    // Elenco esatto, non «al massimo N»: se ne compare una nuova il file è
    // rosso, e quando una viene sistemata va tolta di qui nello stesso commit.
    const silenziose = Object.entries(REGISTRO)
      .filter(([, v]) => v.verdetto === 'silenziosa').map(([k]) => k).sort()
    expect(silenziose).toEqual(['rock-head'])
  })
})

describe('le parziali sono dichiarate a mano, e restano vere', () => {
  it('ogni parziale è un\'abilità che si può scegliere e che è descritta', () => {
    for (const chiave of Object.keys(PARZIALI)) {
      expect(selezionabili, `${chiave} non è nel listino`).toContain(chiave)
      expect(it_.abilities_desc[chiave], `${chiave} non ha descrizione`).toBeTruthy()
    }
  })

  it('ogni parziale ha davvero un effetto — se no non sarebbe parziale, sarebbe muta', () => {
    // Il verso che rende la dichiarazione falsificabile: se qualcuno togliesse
    // la voce da ABILITY_EFFECTS, l'abilità tornerebbe candidata e andrebbe
    // classificata di là, non di qua.
    for (const chiave of Object.keys(PARZIALI)) {
      expect(conEffetto.has(chiave), `${chiave} non ha nessun effetto`).toBe(true)
      expect(candidati, `${chiave} è candidato: va nel REGISTRO, non nelle PARZIALI`)
        .not.toContain(chiave)
    }
  })

  it('ogni parziale dice cosa c\'è e cosa manca', () => {
    for (const [chiave, v] of Object.entries(PARZIALI)) {
      expect(v.applicato, `${chiave}: manca cosa è stato applicato`).toBeTruthy()
      expect(v.mancante, `${chiave}: manca cosa non è stato applicato`).toBeTruthy()
    }
  })
})

describe('il vocabolario è misurato, non creduto', () => {
  // Le abilità che NCP calcola e che hanno una descrizione da noi sono il
  // banco di prova naturale: promettono tutte qualcosa che il danno lo tocca.
  const conDescrizione = [...nelGap].filter(k => it_.abilities_desc[k])
  const viste = conDescrizione.filter(k => prometteUnNumero(it_.abilities_desc[k]))

  it('ne riconosce almeno otto su dieci', () => {
    // Una SOGLIA e non i due numeri esatti, e la ragione è che i numeri esatti
    // scendono ogni volta che un'abilità viene implementata — esce dal divario
    // e si porta via la sua descrizione. Un test che diventa rosso a ogni
    // sessione che fa il suo lavoro verrebbe aggiornato senza guardarlo, cioè
    // smetterebbe di essere un controllo.
    //
    // La soglia invece scende solo se il vocabolario si indebolisce, che è
    // quello che deve sorvegliare. Misurata quando è stata scritta: 46 su 57,
    // cioè 0,807.
    expect(conDescrizione.length, 'il banco di prova si è svuotato').toBeGreaterThan(40)
    expect(viste.length / conDescrizione.length).toBeGreaterThanOrEqual(0.8)
  })

  it('ogni descrizione che sfugge è una che non nomina un numero', () => {
    // Elenco per sottrazione, non per uguaglianza: una che esce dal divario
    // perché l'abbiamo implementata sparisce di qui da sola, mentre una NUOVA
    // che sfugge va guardata e aggiunta a mano — o è il segno che al
    // vocabolario manca una regola.
    const NOTE = new Set([
      'armor-tail',        // priorità delle mosse avversarie
      'cloud-nine',        // «annulla gli effetti del meteo»
      'damp',              // impedisce le mosse esplosive
      'imposter',          // si trasforma
      'mega-sol',          // «usa le mosse come se ci fosse sole»
      'queenly-majesty',   // priorità, come armor-tail
      'receiver',          // copia l'abilità di un alleato
      'ripen',             // raddoppia gli effetti delle bacche
      'supersweet-syrup',  // abbassa la schivata
      'trace',             // copia l'abilità di un avversario
      'unnerve',           // impedisce di mangiare le bacche
    ])
    const nuove = conDescrizione
      .filter(k => !prometteUnNumero(it_.abilities_desc[k]) && !NOTE.has(k))
      .map(k => `${k} :: ${it_.abilities_desc[k]}`)
    expect(
      nuove,
      'questa descrizione parla di un\'abilità che il riferimento CALCOLA, e il '
      + 'vocabolario non ci vede niente: o è giusto così (aggiungila all\'elenco) '
      + 'o al vocabolario manca una regola.',
    ).toEqual([])
  })

  it('controllo negativo: il vocabolario non risponde di sì a tutto', () => {
    // Senza, una regola scritta male — poniamo /./ — renderebbe verdi i test
    // qui sopra facendo entrare tutto il listino.
    expect(prometteUnNumero('All\'entrata in campo, rivela gli oggetti tenuti dagli avversari.')).toBe(false)
    expect(prometteUnNumero('La Velocità sale di 1 grado alla fine di ogni turno.')).toBe(false)
    expect(prometteUnNumero('Potenzia le mosse di tipo Folletto di tutti i Pokémon in campo del 33%.')).toBe(true)
  })
})

describe('le due lingue descrivono le stesse abilità', () => {
  it('nessuna descrizione esiste in una lingua sola', () => {
    // Il presidio legge l'italiano. Se una descrizione esistesse solo in
    // inglese, l'abilità non verrebbe nemmeno presa in esame — e sarebbe un
    // silenzio invisibile al controllo che dovrebbe trovarlo.
    const soloIt = Object.keys(it_.abilities_desc).filter(k => !en.abilities_desc[k])
    const soloEn = Object.keys(en.abilities_desc).filter(k => !it_.abilities_desc[k])
    expect({ soloIt, soloEn }).toEqual({ soloIt: [], soloEn: [] })
  })
})
