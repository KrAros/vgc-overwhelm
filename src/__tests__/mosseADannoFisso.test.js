// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/mosseADannoFisso.test.js
 *
 * Le quattro mosse a danno fisso — Sonic Boom, Dragon Rage, Seismic Toss,
 * Night Shade — cioè i punti d ed e di `setDamage`
 * (`damage_MASTER.js:1256-1275`), il blocco subito sopra le mosse KO.
 *
 * ─── COS'ERA IL DIFETTO ────────────────────────────────────────────────────
 *
 * `power: 0` nei dati, e il motore usciva `null` prima di guardarle. Un `null`
 * nella matrice si disegna `~`, che è il disegno di una mossa di stato:
 * **Seismic Toss sembrava Protect**. A livello 50 fa 50 danni fissi e l'app
 * diceva «niente».
 *
 * Ed era peggio del divario delle abilità, che almeno ha il segnalino «non
 * calcolata»: `gapNoti.json` ha `abilita` e `strumenti`, non ha le mosse.
 * Nessun avviso, nessun badge — un errore silenzioso.
 *
 * ─── L'ORACOLO C'E', E RISPONDE DA UNA SESSIONE ────────────────────────────
 *
 * Fino alla sessione del fine turno l'harness trattava come colpo nullo
 * qualunque risposta che non fosse di sedici roll, e il danno fisso è di UN
 * numero: a chiedergli «Seismic Toss» rispondeva «zero». La distinzione fra
 * `[0]` e `[50]` è stata aggiunta lì per le mosse KO, e vale identica qui.
 *
 * Quindi ogni riga di questo file è una trascrizione confrontata roll per
 * roll, non un'affermazione nostra.
 *
 * ─── LA COSA CHE L'ORACOLO NON DICE ────────────────────────────────────────
 *
 * Psywave sta nella stessa famiglia e NON è qui. Il riferimento non la
 * calcola: nel suo `move_data.js` la voce è commentata (`:849`), e il punto g
 * di `setDamage` è un commento senza codice sotto. L'harness risponde «mossa
 * non presente in NCP», ed è misurato in fondo a questo file. Scriverla
 * sarebbe stata un'aggiudicazione travestita da trascrizione.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import movesData from '../data/moves.json' with { type: 'json' }
import {
  MOSSE_DANNO_FISSO, MOSSE_DANNO_DA_LIVELLO, MOSSE_SENZA_PARENTAL_BOND,
  dannoFisso, haDannoFisso,
} from '../lib/rules.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const vendorPresente = fs.existsSync(path.join(RADICE, 'vendor', 'ncp', 'damage_SV.js'))

const LE_QUATTRO = ['sonic boom', 'dragon rage', 'seismic toss', 'night shade']

const att = (extra = {}) => ({
  atkPokemon: 'garchomp', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null,
  atkAbility: null, atkItem: null, level: 50, ...extra,
})
const dif = (specie, extra = {}) => ({
  defPokemon: specie, defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const nostro = (a, d, move, field = {}) => calculateDamage({ attacker: a, defender: d, move, field })

// ═══════════════════════════════════════════════════════════════════════════
// 1. Le quattro entrano, e prima non entravano
// ═══════════════════════════════════════════════════════════════════════════

describe('le quattro superano la riga d\'ingresso', () => {
  it('hanno potenza zero nei dati, e passano lo stesso', () => {
    // È la terza famiglia che passa da quella riga dopo le mosse a peso e le
    // mosse KO. Se qualcuno la stringesse, tornerebbero `null` e la matrice
    // tornerebbe a disegnarle come `~`.
    for (const m of LE_QUATTRO) {
      expect(movesData[m].power, `${m} ha una potenza`).toBe(0)
      expect(nostro(att(), dif('blissey'), m), `${m} esce null`).not.toBeNull()
    }
  })

  it('e una mossa di stato continua a uscire `null`', () => {
    // Il controllo negativo della riga d'ingresso: senza, «passano tutte»
    // supererebbe il test qui sopra.
    expect(nostro(att(), dif('blissey'), 'protect')).toBeNull()
    expect(nostro(att(), dif('blissey'), 'swords dance')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. I numeri, e da dove vengono
// ═══════════════════════════════════════════════════════════════════════════

describe('due blocchi del riferimento, due strutture', () => {
  it('il punto d ha il numero scritto dentro: 20 e 40', () => {
    expect(MOSSE_DANNO_FISSO).toEqual({ 'sonic boom': 20, 'dragon rage': 40 })
  })

  it('il punto e non ha un numero: legge il livello di chi attacca', () => {
    expect([...MOSSE_DANNO_DA_LIVELLO].sort()).toEqual(['night shade', 'seismic toss'])
    // La ragione per cui le due strutture restano due. A livello 50 il valore
    // coincide col 50 di un'ipotetica costante; a livello 100 no.
    expect(dannoFisso('seismic toss', 50)).toBe(50)
    expect(dannoFisso('seismic toss', 100)).toBe(100)
    expect(dannoFisso('sonic boom', 100)).toBe(20)
    expect(dannoFisso('earthquake', 50)).toBeNull()
    expect(haDannoFisso('earthquake')).toBe(false)
  })

  it('e il motore li mette in tabella', () => {
    expect(nostro(att(), dif('blissey'), 'sonic boom').rolls).toEqual([20])
    expect(nostro(att(), dif('blissey'), 'dragon rage').rolls).toEqual([40])
    expect(nostro(att(), dif('blissey'), 'seismic toss').rolls).toEqual([50])
    expect(nostro(att(), dif('garchomp'), 'night shade').rolls).toEqual([50])
  })

  it('il livello passa dall\'argomento, non dalla costante', () => {
    // Se qualcuno scrivesse `LEVEL` invece di `level`, a 50 non si vedrebbe.
    const r = nostro(att({ level: 100 }), dif('blissey'), 'seismic toss')
    expect(r.rolls).toEqual([100])
    expect(nostro(att({ level: 100 }), dif('blissey'), 'sonic boom').rolls).toEqual([20])
  })
})

describe('un numero solo, e senza variazione', () => {
  it('un roll, non sedici', () => {
    const r = nostro(att(), dif('blissey'), 'seismic toss')
    expect(r.rolls).toHaveLength(1)
    expect(r.minDmg).toBe(50)
    expect(r.maxDmg).toBe(50)
    expect(r.colpi).toBe(1)
    expect(r.rollsFiglio).toBeNull()
  })

  it('la percentuale cambia perché cambia il bersaglio, non il danno', () => {
    // La differenza con le mosse KO: lì il numero È i punti salute del
    // bersaglio, qui il numero non lo guarda affatto.
    const grosso = nostro(att(), dif('blissey'), 'seismic toss')
    const piccolo = nostro(att(), dif('walrein'), 'seismic toss')
    expect(grosso.rolls).toEqual(piccolo.rolls)
    expect(grosso.defHP).toBeGreaterThan(piccolo.defHP)
    expect(grosso.minPct).toBeLessThan(piccolo.minPct)
    expect(grosso.minPct).toBe(Math.floor(50 / grosso.defHP * 1000) / 10)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Cosa NON le tocca
// ═══════════════════════════════════════════════════════════════════════════

describe('la catena del danno non le sfiora', () => {
  it('stadi, natura, strumenti, schermi, meteo, bersaglio doppio', () => {
    // Il confronto è col caso nudo calcolato QUI dentro e non in cima al
    // `describe`: una chiamata al motore nel corpo del blocco gira alla
    // raccolta, e se torna `null` il file intero non arriva a eseguire un
    // solo test. Un difetto vero uscirebbe come «nessun test», che è il modo
    // peggiore di segnalarlo.
    const base = nostro(att(), dif('blissey'), 'seismic toss').rolls
    const carico = nostro(
      att({ atkBoost: 6, atkNature: 'adamant', atkItem: 'choice-band', atkAbility: 'huge-power' }),
      dif('blissey', { defBoost: 6, defNature: 'bold', defItem: 'assault-vest' }),
      'seismic toss',
      { reflect: true, lightScreen: true, doubleTarget: true, weather: 'sun', helpingHand: true },
    )
    expect(carico.rolls).toEqual(base)
  })

  it('né la resistenza, né la debolezza, né lo STAB', () => {
    // Toxapex resiste a Lotta; Gengar prende doppio da Spettro; un Night Shade
    // lanciato da un Gengar avrebbe lo STAB.
    expect(nostro(att(), dif('toxapex'), 'seismic toss').rolls).toEqual([50])
    expect(nostro(att(), dif('gengar'), 'night shade').rolls).toEqual([50])
    expect(nostro(att({ atkPokemon: 'gengar' }), dif('garchomp'), 'night shade').rolls).toEqual([50])
  })

  it('e `stab` esce 1 anche quando il tipo coinciderebbe', () => {
    // Non è cosmetico: chi legge il risultato lo usa per scrivere la riga di
    // spiegazione. Dire «×1,5 STAB» accanto a un numero che lo STAB non ha
    // toccato sarebbe una bugia sul perché.
    expect(nostro(att({ atkPokemon: 'gengar' }), dif('garchomp'), 'night shade').stab).toBe(1)
    expect(nostro(att(), dif('blissey'), 'seismic toss').effectiveBP).toBe(0)
  })
})

describe('l\'immunità di tipo viene prima, e vince', () => {
  it('Seismic Toss su uno Spettro, Night Shade su un Normale', () => {
    // Nel riferimento `immunityChecks` gira PRIMA di `setDamage`
    // (`damage_SV.js:136-142`), e da noi la stessa cosa: queste due escono
    // zero senza passare dal blocco del danno fisso.
    expect(nostro(att(), dif('gengar'), 'seismic toss').immune).toBe(true)
    expect(nostro(att(), dif('gengar'), 'seismic toss').reason).toBe('type')
    expect(nostro(att(), dif('blissey'), 'night shade').immune).toBe(true)
  })

  it('Sonic Boom su uno Spettro, Dragon Rage su un Folletto', () => {
    expect(nostro(att(), dif('gengar'), 'sonic boom').immune).toBe(true)
    expect(nostro(att(), dif('flutter-mane'), 'dragon rage').immune).toBe(true)
  })
})

describe('Sturdy non le ferma', () => {
  it('perché nel riferimento Sturdy guarda `move.isOHKO`, e queste non lo sono', () => {
    // `damage_MASTER.js:1144`. Il ramo di Sturdy nel motore legge `koSecco`:
    // se qualcuno lo allargasse alle mosse a potenza zero, questo test lo
    // direbbe.
    const r = nostro(att(), dif('blissey', { defAbility: 'sturdy' }), 'seismic toss')
    expect(r.immune ?? false).toBe(false)
    expect(r.rolls).toEqual([50])
    expect(movesData['seismic toss'].koSecco).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Parental Bond — dove il riferimento e il gioco non dicono la stessa cosa
// ═══════════════════════════════════════════════════════════════════════════

describe('Parental Bond raddoppia il numero, e non aggiunge un colpo', () => {
  const pb = (move) => nostro(
    att({ atkPokemon: 'kangaskhan', atkAbility: 'parental-bond' }), dif('blissey'), move,
  )

  it('20→40, 40→80, il livello →100', () => {
    expect(pb('sonic boom').rolls).toEqual([40])
    expect(pb('dragon rage').rolls).toEqual([80])
    expect(pb('seismic toss').rolls).toEqual([100])
  })

  it('resta UN colpo: il riferimento torna `[100]`, non `[50, 50]`', () => {
    const r = pb('seismic toss')
    expect(r.colpi).toBe(1)
    expect(r.rollsFiglio).toBeNull()
    expect(r.minDmg).toBe(100)
  })

  it('e la decisione che spegnerebbe tutto questo non è stata presa', () => {
    // La wiki dice che nel gioco Parental Bond su una mossa a danno fisso non
    // fa niente; il riferimento la raddoppia. Finché nessuno sceglie si segue
    // l'oracolo, e la levetta esiste già: quattro nomi in questa lista e il
    // motore smette di raddoppiare senza cambiare una riga.
    for (const m of LE_QUATTRO) expect(MOSSE_SENZA_PARENTAL_BOND.has(m)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Contro l'oracolo
// ═══════════════════════════════════════════════════════════════════════════

describe('contro il riferimento eseguito', () => {
  let harness

  beforeAll(async () => {
    if (!vendorPresente) return
    harness = (await import('../../scripts/ncp/harness.mjs')).creaHarness()
  })

  it.runIf(!vendorPresente)('vendor/ncp assente — non verificabile', () => {
    expect(vendorPresente).toBe(false)
  })

  const CARICO = [
    att({ atkBoost: 6, spAtkBoost: 6, atkNature: 'adamant', atkItem: 'choice-band' }),
    dif('walrein', { defBoost: 6, spDefBoost: 6 }),
    { reflect: true, lightScreen: true, doubleTarget: true, weather: 'sun' },
  ]

  const CASI = [
    ['Sonic Boom su Blissey',                'sonic boom',   att(), dif('blissey'), {}],
    ['Dragon Rage su Blissey',               'dragon rage',  att(), dif('blissey'), {}],
    ['Seismic Toss su Blissey',              'seismic toss', att(), dif('blissey'), {}],
    ['Seismic Toss su Walrein — altri PS',   'seismic toss', att(), dif('walrein'), {}],
    ['Night Shade su Garchomp',              'night shade',  att(), dif('garchomp'), {}],
    ['Seismic Toss su uno Spettro',          'seismic toss', att(), dif('gengar'), {}],
    ['Night Shade su un Normale',            'night shade',  att(), dif('blissey'), {}],
    ['Dragon Rage su un Folletto',           'dragon rage',  att(), dif('flutter-mane'), {}],
    ['Seismic Toss su chi resiste',          'seismic toss', att(), dif('toxapex'), {}],
    ['Night Shade su chi è debole',          'night shade',  att(), dif('gengar'), {}],
    ['Night Shade con lo STAB',              'night shade',  att({ atkPokemon: 'gengar' }), dif('garchomp'), {}],
    ['Seismic Toss contro Sturdy',           'seismic toss', att(), dif('blissey', { defAbility: 'sturdy' }), {}],
    ['Seismic Toss contro Multiscale',       'seismic toss', att(), dif('dragonite', { defAbility: 'multiscale' }), {}],
    ['Seismic Toss con tutto acceso',        'seismic toss', ...CARICO],
    ['Sonic Boom con Parental Bond',         'sonic boom',   att({ atkPokemon: 'kangaskhan', atkAbility: 'parental-bond' }), dif('blissey'), {}],
    ['Dragon Rage con Parental Bond',        'dragon rage',  att({ atkPokemon: 'kangaskhan', atkAbility: 'parental-bond' }), dif('blissey'), {}],
    ['Seismic Toss con Parental Bond',       'seismic toss', att({ atkPokemon: 'kangaskhan', atkAbility: 'parental-bond' }), dif('blissey'), {}],
    ['Terremoto — il controllo negativo',    'earthquake',   att(), dif('blissey'), {}],
  ]

  for (const [nome, move, a, d, field] of CASI) {
    it.runIf(vendorPresente)(`${nome} ≡ NCP`, () => {
      const rif = harness.calcola({ attacker: a, defender: d, move, field })
      expect(rif.motivo ?? null).toBeNull()
      expect(rif.ok).toBe(true)
      const r = nostro(a, d, move, field)
      expect(r.immune ? [] : r.rolls).toEqual(rif.rolls)
    })
  }

  it.runIf(vendorPresente)('e l\'oracolo risponde `fisso`, non `nullo`', () => {
    // Il controllo che rende vere le righe qui sopra. Se l'harness tornasse a
    // confondere un danno fisso con un colpo nullo, quei confronti
    // paragonerebbero `[]` con `[]` e passerebbero senza provare niente.
    const r = harness.calcola({ attacker: att(), defender: dif('blissey'), move: 'seismic toss', field: {} })
    expect(r.fisso).toBe(true)
    expect(r.nullo).toBe(false)
    expect(r.rolls).toEqual([50])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. Psywave: perché non è qui
// ═══════════════════════════════════════════════════════════════════════════

describe('Psywave resta fuori, e il motivo è misurato', () => {
  it('il riferimento non ce l\'ha: la voce è commentata nei suoi dati', () => {
    const dati = fs.readFileSync(path.join(RADICE, 'vendor', 'ncp', 'move_data.js'), 'utf8')
    expect(dati.includes("//'Psywave': {")).toBe(true)
    // E il punto g di `setDamage` è un commento senza codice sotto.
    const motore = fs.readFileSync(path.join(RADICE, 'vendor', 'ncp', 'damage_MASTER.js'), 'utf8')
    expect(motore.includes('//g. Psywave')).toBe(true)
  })

  it('quindi da noi resta `null`, e non è una dimenticanza', () => {
    expect(haDannoFisso('psywave')).toBe(false)
    expect(nostro(att(), dif('blissey'), 'psywave')).toBeNull()
  })

  it.runIf(vendorPresente)('e l\'harness lo dice a voce', async () => {
    const h = (await import('../../scripts/ncp/harness.mjs')).creaHarness()
    const r = h.calcola({ attacker: att(), defender: dif('blissey'), move: 'psywave', field: {} })
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('non presente in NCP')
  })
})
