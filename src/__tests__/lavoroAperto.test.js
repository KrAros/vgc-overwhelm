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
import itLocale from '../locales/it.json' with { type: 'json' }
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

describe('i numeri scritti nei documenti sono quelli veri', () => {
  /**
   * ─── PERCHE' QUESTO PRESIDIO NASCE ADESSO ────────────────────────────────
   *
   * L'intestazione di questo file porta come esempio «i numeri di
   * CONTRIBUTING.md fermi a due sessioni prima». Chiudendo la sessione degli
   * strumenti si è guardato, e erano fermi ancora: CONTRIBUTING diceva 39
   * strumenti col segnalino e README ne diceva 40 — quando `gapNoti.json` ne
   * contava 34, cioè sbagliati GIA' PRIMA che la sessione cominciasse.
   *
   * Il difetto non è che qualcuno si sia distratto: è che quei due numeri non
   * li verificava nessuno. Un registro presidiato accanto a due documenti che
   * raccontano lo stesso fatto a mano è mezzo presidio — e il numero che la
   * gente legge per prima è quello del README.
   *
   * La ricerca è deliberatamente RIGIDA: cerca la frase esatta con dentro il
   * numero. Riformulare la frase rende rosso questo test, ed è voluto — chi la
   * riformula deve decidere come tenerla verificabile, non aggirare il
   * controllo.
   */
  const leggi = (nome) => fs.readFileSync(path.join(RADICE, nome), 'utf8')

  it('CONTRIBUTING.md conta gli strumenti col segnalino come `gapNoti.json`', () => {
    expect(
      leggi('CONTRIBUTING.md'),
      `CONTRIBUTING.md non dice «${gapNoti.strumenti.length} strumenti»: rigenerare il numero a mano`,
    ).toContain(`e ${gapNoti.strumenti.length} strumenti che il riferimento calcola`)
  })

  it('e il README conta tutt\'e due le liste', () => {
    expect(
      leggi('README.md'),
      `README.md non dice «${gapNoti.abilita.length} abilità e ${gapNoti.strumenti.length} strumenti»`,
    ).toContain(
      `${gapNoti.abilita.length} abilità e ${gapNoti.strumenti.length} strumenti sono dichiarati non calcolati`,
    )
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

  it.runIf(vendorPresente)('e le quattro che restano sono ancora quattro', () => {
    // Il numero che il documento scrive, misurato invece che copiato: le mosse
    // a potenza zero che il RIFERIMENTO tratta come offensive e che da noi
    // escono ancora `null`. Il giorno che qualcuno ne fa una, questo test
    // diventa rosso e il documento va aggiornato nello stesso commit.
    //
    // Gira solo col vendor presente perché la domanda «il riferimento la
    // considera offensiva?» la può rispondere solo lui. Scrivere qui i nomi a
    // mano vorrebbe dire copiare una misura invece che rifarla — ed è
    // esattamente il modo in cui l'elenco di CONTRIBUTING.md si era sfasato.
    expect(resteDaFare()).toHaveLength(4)
  })

  it('Foul Play e Acrobatics non sono più una voce aperta', () => {
    // La terza e la quarta voce del registro che si chiudono, e anche queste
    // girate invece che tolte: adesso presidiano che nessuno le rimetta come
    // erano. I casi contro l'oracolo stanno in `foulPlayAcrobatics.test.js`.
    const a = { atkPokemon: 'blissey', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
      atkAbility: null, atkItem: null, level: 50, atkBoost: 0, atkAbilityFlags: {} }
    const d = (extra = {}) => ({ defPokemon: 'garchomp', defSPs: [0, 0, 0, 0, 0, 0],
      defNature: null, defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0,
      defAtkBoost: 0, defAbilityFlags: {}, ...extra })
    const foul = (att, def) => calculateDamage({ attacker: att, defender: def, move: 'foul play', field: {} })

    expect(
      foul(a, d({ defAtkBoost: 6 })).minDmg,
      'Foul Play ha smesso di guardare l\'Attacco del bersaglio',
    ).toBeGreaterThan(foul(a, d()).minDmg)

    expect(
      calculateDamage({ attacker: a, defender: d(), move: 'acrobatics', field: {} }).effectiveBP,
      'Acrobatics è tornata a 55 a mani vuote',
    ).toBe(110)
    expect(fs.existsSync(path.join(RADICE, 'src/__tests__/foulPlayAcrobatics.test.js'))).toBe(true)
  })

  it('`gapNoti.json` adesso ha anche le mosse, e il badge le avvisa', () => {
    // La seconda voce che si chiude, e anche questa girata invece che tolta.
    // Il registro aveva due liste; ne ha tre, e la terza è quella che mancava.
    expect(Object.keys(gapNoti)).toEqual(['meta', 'abilita', 'strumenti', 'mosse'])
    expect(gapNoti.mosse.length).toBe(4)
    expect(gapNoti.meta.mosseNelGap).toBe(4)
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

  it('gli strumenti col badge sono ventisette', () => {
    // Erano trentanove e «nessuno ci aveva ancora guardato». La misura c'è, e
    // il conto è sceso così: 39 → 34 (i cinque incensi) → 33 → 32 (le due vive
    // del gruppo 4) → 31 (il Palloncino) → 27 (i tre orbi e la Gemmadanima).
    expect(gapNoti.strumenti.length).toBe(27)
  })

  it('e i ventisette sono tutti dormienti o classificati, non dimenticati', () => {
    // La forma della misura, presidiata dove conta: non il numero, ma il fatto
    // che ogni voce rimasta abbia una RAGIONE per restarci. Le tre classificate
    // stanno in `classificazione-badge.mjs`; le altre ventiquattro chiedono un
    // cambio di tipo che non modelliamo — le memorie e i drive.
    const classificate = ['iron ball', 'macho brace', 'flying gem']
    const dormienti = gapNoti.strumenti.filter(k => !classificate.includes(k))
    expect(dormienti.length, 'una voce nuova senza ragione scritta').toBe(24)
    for (const c of classificate) {
      expect(gapNoti.strumenti, `${c} è uscita: aggiornare classificazione-badge.mjs`).toContain(c)
    }
    // Le ventiquattro sono le diciassette memorie, i quattro drive e i tre
    // raddoppi di statistica su specie che Champions non ha.
    const memorie = dormienti.filter(k => k.endsWith(' memory'))
    const drive = dormienti.filter(k => k.endsWith(' drive'))
    expect(memorie.length).toBe(17)
    expect(drive.length).toBe(4)
    expect(dormienti.filter(k => !memorie.includes(k) && !drive.includes(k)).sort())
      .toEqual(['deepseascale', 'deepseatooth', 'thick club'])
  })

  it('le dodici fatte non portano più il badge, e le memorie sì', () => {
    // La forma della misura, presidiata: i cinque incensi, la Sferascintilla,
    // la Polvere Metallica, il Palloncino, i tre orbi e la Gemmadanima sono
    // usciti; le voci che chiedono un cambio di tipo sono rimaste — di
    // proposito, perché il gioco potrebbe aggiungere quelle specie.
    for (const i of ['rose incense', 'odd incense', 'sea incense', 'wave incense',
      'rock incense', 'light ball', 'metal powder', 'air balloon',
      'adamant orb', 'lustrous orb', 'griseous orb', 'soul dew']) {
      expect(gapNoti.strumenti, `${i} porta ancora il badge`).not.toContain(i)
    }
    const memorie = gapNoti.strumenti.filter(k => k.endsWith(' memory'))
    expect(memorie.length, 'le memorie di Silvally sono uscite senza che nessuno lo decidesse').toBe(17)
  })

  it('e le tre dormienti del gruppo 4 il badge ce l\'hanno ancora', () => {
    // Le altre voci dello STESSO `if` del riferimento, tenute apposta: sono di
    // Marowak e Clamperl, che in M-B non ci sono. Il giorno che Champions
    // aggiunge una di quelle specie il segnalino è già al posto giusto — ed è
    // la scelta scritta nel documento, non una dimenticanza.
    //
    // La Gemmadanima stava in questo elenco ed è uscita: non perché qualcuno
    // l'abbia scelta, ma perché è il QUARTO caso del `switch` degli orbi e i
    // tre orbi ci cadono dentro. Farla era obbligatorio per fare loro.
    for (const i of ['thick club', 'deepseatooth', 'deepseascale']) {
      expect(gapNoti.strumenti, `${i} è uscita dal divario: aggiornare docs/lavoro-aperto.md`)
        .toContain(i)
    }
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

  // ─── I PUNTI SALUTE NON SONO PIÙ QUI, ED È IL PUNTO ───────────────────
  //
  // Qui c'era `i punti salute non sono nel modello`. Le sue tre prove erano
  // ancora VERDI il giorno in cui i punti salute sono arrivati: cercava
  // `curHP` nel motore — e il motore li chiama `psAtk` e `psDif` — e leggeva
  // `power: 150` da `moves.json`, che è il dato di Eruption e non cambia
  // quando la potenza vera si calcola dai punti salute.
  //
  // Cioè: era un presidio che sorvegliava la PAROLA e non la cosa, ed è
  // esattamente il difetto contro cui l'intestazione di questo file mette in
  // guardia. Non è stato tolto perché era rosso: è stato tolto perché era
  // verde a torto, e le due sezioni che sorvegliava sono chiuse.
  //
  // Chi presidia adesso quel fatto: `puntiSaluteInterfaccia.test.jsx` tira la
  // catena dal numero nello slot fino al danno, e `levette.test.js` sorveglia
  // che le cinque a vita bassa NON tornino a leggere l'interruttore.
})

describe('le chiavi di traduzione che non rende nessuno', () => {
  // Gli strumenti col badge li presidia già `gli strumenti col badge sono
  // ancora trentanove`, qui sopra: ne avevo scritto un secondo uguale, ed è
  // stata la mutazione a mostrarmelo — fallivano tutt'e due insieme.

  it('sono ancora di traduzione mai usate sono ancora tante', () => {
    // ─── PERCHÉ UNA SOGLIA E NON IL NUMERO ESATTO ─────────────────────────
    //
    // 17 al momento della misura. Il numero esatto si muoverebbe anche solo
    // aggiungendo una stringa nuova e usandola subito — un falso rosso, e un
    // presidio che si lamenta di cose giuste lo si spegne. La soglia larga
    // diventa rossa solo quando qualcuno fa davvero la pulizia, che è quando
    // la riga del documento va tolta.
    //
    // La ricerca è grossolana di proposito: cerca la chiave in QUALUNQUE
    // forma nel sorgente, quindi sbaglia per DIFETTO — se dice che una chiave
    // è morta, è morta. `eot.ko_arrow` per esempio compare solo dentro un
    // altro test, e quello non la rende.
    const CATALOGHI = new Set(['natures', 'types', 'items', 'abilities', 'moves',
      'statuses', 'abilities_desc', 'abilities_desc_on', 'abilities_desc_off'])

    const chiavi = []
    for (const [sez, v] of Object.entries(itLocale)) {
      if (CATALOGHI.has(sez) || typeof v !== 'object') continue
      for (const k of Object.keys(v)) chiavi.push([sez, k])
    }
    expect(chiavi.length, 'l\'estrazione non trova più le chiavi').toBeGreaterThan(150)

    const sorgenti = []
    const cammina = (d) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name)
        if (f.isDirectory()) { if (f.name !== '__tests__' && f.name !== 'locales') cammina(p) }
        else if (/\.(js|jsx)$/.test(f.name)) sorgenti.push(fs.readFileSync(p, 'utf8'))
      }
    }
    cammina(path.join(RADICE, 'src'))
    const testo = sorgenti.join('\n')

    const morte = chiavi.filter(([sez, k]) =>
      !testo.includes(`${sez}.${k}`) && !testo.includes(`'${k}'`)
      && !testo.includes(`"${k}"`) && !testo.includes(`\`${k}\``) && !testo.includes(`.${k}`))

    expect(
      morte.length,
      'le chiavi morte sono state ripulite: togliere la voce da docs/lavoro-aperto.md',
    ).toBeGreaterThanOrEqual(10)
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
