// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/lavoroAperto.test.js
 *
 * Il presidio di `docs/lavoro-aperto.md`.
 *
 * ─── PERCHÉ UN REGISTRO VA VERIFICATO ──────────────────────────────────────
 *
 * Un elenco di «cose da fare» che nessuno controlla diventa una lapide: le
 * voci restano scritte dopo essere state fatte, e chi legge non sa più quali
 * sono vere. È già successo in questo progetto in piccolo — un verdetto di
 * `descrizioniSilenziose` che diceva «gli stati non sono modellati» quando lo
 * erano diventati, e i numeri di `CONTRIBUTING.md` fermi a due sessioni prima.
 *
 * Quindi ogni voce del documento che si possa rendere falsificabile è qui, e
 * asserisce che **è ancora aperta**. Il giorno che una viene fatta questo file
 * diventa rosso, e la riga nel documento va tolta nello stesso commit.
 *
 * ─── COSA NON PUÒ CONTROLLARE ──────────────────────────────────────────────
 *
 * Le voci della famiglia B — quelle che aspettano una decisione di Simone —
 * sono verificabili solo come «non è ancora stata presa». Che la decisione sia
 * *giusta* non lo dice nessun test, ed è il punto: sono decisioni, non
 * trascrizioni.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { vociFineTurnoDaStato } from '../lib/damage.js'
import { MOSSE_SENZA_PARENTAL_BOND } from '../lib/rules.js'
import movesData from '../data/moves.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }
import gapNoti from '../data/gapNoti.json' with { type: 'json' }
import { caricaNCP } from '../../scripts/ncp/contesto.mjs'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const DOCUMENTO = path.join(RADICE, 'docs', 'lavoro-aperto.md')

const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const att = { atkPokemon: 'garchomp', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null, atkAbility: null, atkItem: null, level: 50 }
const dif = (abilita = null, status = null) => ({
  defPokemon: 'blissey', defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: abilita, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, defStatus: status,
})

/**
 * Le mosse a potenza zero che il riferimento calcola e noi no.
 *
 * La domanda «il riferimento la considera offensiva?» si legge dai suoi dati,
 * non dal nome: `category` diversa da `Status` nel suo `move_data.js`. Le
 * mosse che lì sono commentate — Bide, Magnitude, Present, Spit Up, Psywave —
 * non ci sono affatto, e infatti non entrano nel conto: per loro non c'è un
 * oracolo da confrontare, quindi non sono lavoro di trascrizione.
 */
function resteDaFare() {
  const dati = caricaNCP().leggi('moves')
  return Object.entries(movesData)
    .filter(([, v]) => !v.power)
    .filter(([, v]) => dati[v.name]?.category && dati[v.name].category !== 'Status')
    .map(([k]) => k)
    .filter(m => calculateDamage({ attacker: att, defender: dif(), move: m, field: {} }) === null)
}

describe('il documento esiste ed è raggiungibile', () => {
  it('c\'è, e CONTRIBUTING.md ci manda', () => {
    expect(fs.existsSync(DOCUMENTO)).toBe(true)
    const contribuire = fs.readFileSync(path.join(RADICE, 'CONTRIBUTING.md'), 'utf8')
    expect(
      contribuire.includes('docs/lavoro-aperto.md'),
      'il documento c\'è ma nessuno ci arriva: rimettere il rimando',
    ).toBe(true)
  })
})

describe('A — le voci che aspettano una trascrizione sono ancora aperte', () => {
  it('le quattro mosse a danno fisso non sono più una voce aperta', () => {
    // La prima voce del registro che si chiude. Il test non è stato tolto: è
    // stato girato. Prima diceva «escono ancora `null`» e presidiava una voce
    // aperta; adesso dice «entrano», e presidia il fatto che nessuno le
    // rimetta fuori — perché il documento non le elenca più.
    for (const m of ['seismic toss', 'night shade', 'dragon rage', 'sonic boom']) {
      expect(
        calculateDamage({ attacker: att, defender: dif(), move: m, field: {} }),
        `${m} è tornata nulla: rimettere la voce in docs/lavoro-aperto.md`,
      ).not.toBeNull()
    }
    // I casi contro l'oracolo stanno in `mosseADannoFisso.test.js`.
    expect(fs.existsSync(path.join(RADICE, 'src/__tests__/mosseADannoFisso.test.js'))).toBe(true)
  })

  it.runIf(vendorPresente)('e le ventidue che restano sono ancora ventidue', () => {
    // Il numero che il documento scrive, misurato invece che copiato: le mosse
    // a potenza zero che il RIFERIMENTO tratta come offensive e che da noi
    // escono ancora `null`. Il giorno che qualcuno ne fa una, questo test
    // diventa rosso e il documento va aggiornato nello stesso commit.
    //
    // Gira solo col vendor presente perché la domanda «il riferimento la
    // considera offensiva?» la può rispondere solo lui. Scrivere qui i nomi a
    // mano vorrebbe dire copiare una misura invece che rifarla — ed è
    // esattamente il modo in cui l'elenco di CONTRIBUTING.md si era sfasato.
    expect(resteDaFare()).toHaveLength(22)
  })

  it('`gapNoti.json` adesso ha anche le mosse, e il badge le avvisa', () => {
    // La seconda voce che si chiude, e anche questa girata invece che tolta.
    // Il registro aveva due liste; ne ha tre, e la terza è quella che mancava.
    expect(Object.keys(gapNoti)).toEqual(['meta', 'abilita', 'strumenti', 'mosse'])
    expect(gapNoti.mosse.length).toBe(22)
    expect(gapNoti.meta.mosseNelGap).toBe(22)
  })

  it('e le due liste dicono la stessa cosa: nessuna mossa calcolata col badge', () => {
    // Il difetto simmetrico di quello che `gap.test.js` blocca per le abilità:
    // un badge su una mossa che invece calcoliamo direbbe all'utente di
    // diffidare di un numero giusto. Le due fonti sono `gapNoti.json` — che è
    // generato — e la riga d'ingresso del motore, che è quella vera.
    const sbagliate = gapNoti.mosse.filter(
      m => calculateDamage({ attacker: att, defender: dif(), move: m, field: {} }) !== null,
    )
    expect(
      sbagliate,
      'queste mosse le calcoliamo e mostrano comunque «non calcolata»: `npm run gap:gen`',
    ).toEqual([])
  })

  it('gli strumenti col badge sono ancora trentanove', () => {
    // Non è un numero da difendere: è il numero che nessuno ha ancora
    // guardato. Se scende, la voce nel documento va aggiornata.
    expect(gapNoti.strumenti.length).toBe(39)
  })
})

describe('B — le decisioni non sono ancora state prese', () => {
  it('Merciless non accende il critico da sola', () => {
    expect(ABILITY_EFFECTS['merciless'], 'Merciless è stata implementata').toBeUndefined()
  })

  it('il menù dello stato non è ristretto dalle abilità che immunizzano', () => {
    // Un difensore con Immunity può essere dichiarato avvelenato, e prende il
    // danno da veleno. È la scelta presa — lo stato è un'asserzione di chi usa
    // l'app — e questo test la tiene visibile invece che sottintesa.
    const conImmunity = vociFineTurnoDaStato('poisoned', 'immunity', 200)
    expect(conImmunity).toHaveLength(1)
    expect(conImmunity[0].hp).toBe(-25)
  })

  it('Parental Bond sul danno fisso segue ancora il riferimento', () => {
    // Nata chiudendo la voce delle quattro mosse a danno fisso, ed è una
    // decisione perché le due fonti non dicono la stessa cosa: il riferimento
    // raddoppia il numero (`[100]` invece di `[50]`), la wiki dice che nel
    // gioco Parental Bond su queste mosse non fa niente.
    //
    // Finché nessuno sceglie si segue l'oracolo, che è la regola del progetto.
    // La levetta esiste già ed è questa lista: quattro nomi lì dentro e il
    // motore smette di raddoppiare senza che si tocchi una riga di codice.
    for (const m of ['seismic toss', 'night shade', 'dragon rage', 'sonic boom']) {
      expect(
        MOSSE_SENZA_PARENTAL_BOND.has(m),
        `${m}: la decisione è stata presa, aggiornare docs/lavoro-aperto.md`,
      ).toBe(false)
    }
  })

  it('Sturdy ha ancora una metà sola', () => {
    expect(Object.keys(ABILITY_EFFECTS['sturdy']).sort()).toEqual(['showInSmogon', 'sturdy'])
  })

  it('i punti salute non sono nel modello', () => {
    // Tre prove che l'assunzione «vita piena» è ancora ovunque: nessuno slot
    // porta i PS correnti, Eruption usa la potenza piena, e una mossa KO
    // toglie tutti i PS massimi.
    // Solo il CODICE: `curHP` compare nei commenti del punto f, dove si
    // spiega che il riferimento legge i PS correnti e noi assumiamo la vita
    // piena. La prima stesura di questa riga guardava tutto il file ed è
    // diventata rossa su quel commento — cercava la parola, non la cosa.
    const motore = fs.readFileSync(path.join(RADICE, 'src/calcEngine.js'), 'utf8')
      .split('\n').filter(r => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n')
    expect(/\bcurHP\b/.test(motore), 'i PS correnti sono entrati nel motore').toBe(false)
    expect(movesData['eruption'].power).toBe(150)
  })
})

describe('C — il dato che manca, manca ancora', () => {
  it('Rivalry è l\'unica abilità nel divario', () => {
    expect(gapNoti.abilita).toEqual(['rivalry'])
  })

  it('e il sesso è nullo su quasi ottocento specie', () => {
    // 986 su 1225 quando il documento è stato scritto. La soglia è larga di
    // proposito: un audit parziale non deve far fallire il test, ma un audit
    // vero — che porterebbe il numero vicino a zero — sì.
    const senza = Object.values(pokemonData).filter(v => v.gender == null).length
    expect(
      senza,
      'il dato sul sesso è arrivato: Rivalry si può fare, aggiornare docs/lavoro-aperto.md',
    ).toBeGreaterThan(500)
  })
})

describe('e le due mezze abilità trovate a mano restano intere', () => {
  it('Magic Guard e Heatproof hanno tutt\'e due le metà', () => {
    // Sono l'esempio che il documento porta per spiegare la forma. Se una
    // delle due tornasse a metà, l'esempio sarebbe ancora vero — ma per il
    // motivo sbagliato.
    expect(ABILITY_EFFECTS['magic-guard'].annullaContraccolpo).toBe(true)
    expect(ABILITY_EFFECTS['magic-guard'].annullaDannoDaStato).toBe(true)
    expect(ABILITY_EFFECTS['heatproof'].heatproof).toBe(true)
    expect(ABILITY_EFFECTS['heatproof'].dimezzaBruciatura).toBe(true)
  })
})
