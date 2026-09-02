/**
 * src/__tests__/battleState.test.js
 *
 * Sessione C — blocco 2.
 *
 * ─── PERCHÉ QUESTO TEST ESISTE E NON BASTA LO SNAPSHOT ─────────────────────
 * Il piano di risanamento diceva che `snapshot:diff` avrebbe dovuto mostrare
 * "solo Last Respects con KOs > 0". Non può: lo snapshot chiama
 * `calculateDamage` con oggetti costruiti a mano in `snapshot-cases.mjs`, non
 * passa mai dalla DamageTable né dal ReportPanel. Il bug §1.5 non stava nel
 * motore — stava in *chi preparava gli ingredienti*.
 *
 * Quindi il criterio giusto è: snapshot a zero divergenze (il motore non è
 * stato toccato) più questo file, che confronta i due percorsi fra loro.
 *
 * ─── IL METODO: L'ORACOLO È IL CODICE VECCHIO ──────────────────────────────
 * Come nelle sessioni A e B, le costruzioni pre-C sono ricopiate qui sotto
 * parola per parola. Un test che dice "adesso è giusto" senza mostrare cosa
 * faceva prima non dimostra granché.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'
import {
  buildAttackerInput, buildDefenderInput, buildField, buildMatchup,
} from '../lib/battleState.js'
import { LEVEL } from '../lib/rules.js'

// ─── ORACOLI — le costruzioni a mano prima della sessione C ────────────────

/** Copia di DamageTable.jsx → calcAllMoves. Questa passava lastRespectsKOs. */
const attaccanteTabellaStorico = (atk, level) => ({
  atkPokemon:      atk.key,
  atkSPs:          atk.sps || [0,0,0,0,0,0],
  atkNature:       atk.nature,
  atkBoost:        atk.atkBoost || 0,
  spAtkBoost:      atk.spAtkBoost || 0,
  atkItem:         atk.item || null,
  atkAbility:      atk.ability || null,
  atkAbilityFlags: atk.abilityFlags || {},
  // Aggiunto quando e' arrivato il menu' dello stato. Questa e' una copia
  // STORICA di cio' che il componente costruiva: la si aggiorna quando il
  // campo nuovo e' arrivato a tutt'e due, che e' proprio quello che il test
  // controlla.
  atkStatus:       atk.status || null,
  lastRespectsKOs: atk.lastRespectsKOs || 0,
  level,
})

/** Copia di ReportPanel.jsx → SinglePanel. Questa NON lo passava. */
const attaccantePannelloStorico = (atk) => ({
  atkPokemon:      atk.key,
  atkSPs:          atk.sps || [0,0,0,0,0,0],
  atkNature:       atk.nature,
  atkBoost:        atk.atkBoost || 0,
  spAtkBoost:      atk.spAtkBoost || 0,
  atkItem:         atk.item || null,
  atkAbility:      atk.ability || null,
  atkAbilityFlags: atk.abilityFlags || {},
  atkStatus:       atk.status || null,
  level: 50,
})

/** Copia della costruzione del campo, identica nei due file. */
const campoStorico = (st, dir) => ({
  weather: st.weather, terrain: st.terrain, doubleTarget: st.doubleTarget,
  helpingHand: dir === 't1' ? st.helpingHand.t1 : st.helpingHand.t2,
  auroraVeil:  dir === 't1' ? st.auroraVeil.t2  : st.auroraVeil.t1,
  lightScreen: dir === 't1' ? st.lightScreen.t2 : st.lightScreen.t1,
  reflect:     dir === 't1' ? st.reflect.t2     : st.reflect.t1,
  crit:        dir === 't1' ? st.crit.t1        : st.crit.t2,
})

// ─── Dati di prova ─────────────────────────────────────────────────────────

const houndstone = {
  key: 'houndstone', sps: [0,32,0,0,0,30], nature: 'adamant',
  ability: null, item: null, moves: ['last respects', 'shadow ball', null, null],
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {}, lastRespectsKOs: 3,
}

const amoonguss = {
  key: 'amoonguss', sps: [32,0,32,0,2,0], nature: 'relaxed',
  ability: null, item: null, moves: [null, null, null, null],
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {},
}

const campoPieno = {
  weather: 'sand', terrain: 'grassy', doubleTarget: true, trickRoom: true,
  helpingHand: { t1: true,  t2: false },
  tailwind:    { t1: false, t2: true  },
  auroraVeil:  { t1: true,  t2: false },
  lightScreen: { t1: false, t2: true  },
  reflect:     { t1: true,  t2: true  },
  crit:        { t1: false, t2: true  },
}

// ─── buildAttackerInput / buildDefenderInput ───────────────────────────────

describe('battleState — costruzione di attaccante e difensore', () => {
  it('l\'attaccante coincide con quello che costruiva la DamageTable', () => {
    // L'oracolo storico fotografa la costruzione di PRIMA della sessione C, e
    // resta quella: non va aggiornato a ogni cambiamento, altrimenti smette
    // di essere un oracolo. La sessione D ha però aggiunto un campo che nel
    // 2024 non esisteva proprio — `atkDefBoost`, il boost di Difesa che serve
    // a Body Press — quindi lo dichiariamo qui, esplicitamente, invece di
    // riscrivere la copia storica.
    //
    // Stessa cosa per `colpiScelti`, aggiunto con le mosse multi-colpo: si
    // dichiara qui, e l'elenco che cresce sotto gli occhi è il punto — dice
    // quanto la costruzione si è allontanata dalla fotografia del 2024.
    expect(buildAttackerInput(houndstone, LEVEL))
      .toEqual({ ...attaccanteTabellaStorico(houndstone, 50), atkDefBoost: 0, colpiScelti: null })
  })

  it('l\'attaccante porta lastRespectsKOs — è il campo che il pannello perdeva', () => {
    expect(buildAttackerInput(houndstone).lastRespectsKOs).toBe(3)
    expect(attaccantePannelloStorico(houndstone).lastRespectsKOs).toBeUndefined()
  })

  it('uno slot vuoto o nullo non fa esplodere niente', () => {
    for (const vuoto of [null, undefined, {}]) {
      const a = buildAttackerInput(vuoto)
      expect(a.atkPokemon).toBeNull()
      expect(a.atkSPs).toEqual([0,0,0,0,0,0])
      expect(a.lastRespectsKOs).toBe(0)
      expect(a.level).toBe(LEVEL)

      const d = buildDefenderInput(vuoto)
      expect(d.defPokemon).toBeNull()
      expect(d.defBoost).toBe(0)
    }
  })

  it('il difensore non porta con sé campi dell\'attaccante', () => {
    const d = buildDefenderInput(houndstone)
    expect(d).not.toHaveProperty('lastRespectsKOs')
    expect(d).not.toHaveProperty('level')
    expect(d.defSPs).toEqual(houndstone.sps)
  })
})

// ─── Il bug §1.5, con i numeri ─────────────────────────────────────────────

describe('battleState — la divergenza Last Respects è chiusa', () => {
  const defender = buildDefenderInput(amoonguss)
  const field    = buildField({ doubleTarget: true }, 't1')
  const move     = 'last respects'

  const conNuovo = (kos) => calculateDamage({
    attacker: buildAttackerInput({ ...houndstone, lastRespectsKOs: kos }),
    defender, move, field,
  })

  const conPannelloStorico = (kos) => calculateDamage({
    attacker: attaccantePannelloStorico({ ...houndstone, lastRespectsKOs: kos }),
    defender, move, field,
  })

  const conTabellaStorica = (kos) => calculateDamage({
    attacker: attaccanteTabellaStorico({ ...houndstone, lastRespectsKOs: kos }, 50),
    defender, move, field,
  })

  it('la potenza sale di 50 per ogni alleato esanime', () => {
    expect(conNuovo(0).effectiveBP).toBe(50)
    expect(conNuovo(1).effectiveBP).toBe(100)
    expect(conNuovo(2).effectiveBP).toBe(150)
    expect(conNuovo(3).effectiveBP).toBe(200)
  })

  it('il vecchio pannello rispondeva sempre 50 — ecco il fattore 4', () => {
    for (const kos of [0, 1, 2, 3]) {
      expect(conPannelloStorico(kos).effectiveBP).toBe(50)
    }
    // Con 3 alleati KO la cella diceva una cosa e il pannello un'altra.
    expect(conTabellaStorica(3).maxPct).toBeGreaterThan(conPannelloStorico(3).maxPct * 3)
  })

  it('adesso i due percorsi danno lo stesso identico risultato', () => {
    for (const kos of [0, 1, 2, 3]) {
      expect(conNuovo(kos).rolls).toEqual(conTabellaStorica(kos).rolls)
      expect(conNuovo(kos).maxPct).toBe(conTabellaStorica(kos).maxPct)
    }
  })

  it('per una mossa qualsiasi il contatore non cambia nulla', () => {
    const a = calculateDamage({ attacker: buildAttackerInput({ ...houndstone, lastRespectsKOs: 0 }), defender, move: 'shadow ball', field })
    const b = calculateDamage({ attacker: buildAttackerInput({ ...houndstone, lastRespectsKOs: 3 }), defender, move: 'shadow ball', field })
    expect(a.rolls).toEqual(b.rolls)
  })
})

// ─── buildField ────────────────────────────────────────────────────────────

describe('battleState — buildField', () => {
  it('riproduce esattamente il campo che costruivano i componenti', () => {
    for (const dir of ['t1', 't2']) {
      const nuovo = buildField(campoPieno, dir)
      const vecchio = campoStorico(campoPieno, dir)
      for (const chiave of Object.keys(vecchio)) {
        expect(nuovo[chiave]).toBe(vecchio[chiave])
      }
    }
  })

  it('Helping Hand e critico si leggono dal lato di chi attacca', () => {
    expect(buildField(campoPieno, 't1').helpingHand).toBe(true)   // hh.t1
    expect(buildField(campoPieno, 't2').helpingHand).toBe(false)  // hh.t2
    expect(buildField(campoPieno, 't1').crit).toBe(false)         // crit.t1
    expect(buildField(campoPieno, 't2').crit).toBe(true)          // crit.t2
  })

  it('gli schermi si leggono dal lato di chi difende', () => {
    // auroraVeil è acceso su t1: protegge t1, quindi conta quando attacca t2.
    expect(buildField(campoPieno, 't1').auroraVeil).toBe(false)
    expect(buildField(campoPieno, 't2').auroraVeil).toBe(true)
    // lightScreen è acceso su t2: conta quando attacca t1.
    expect(buildField(campoPieno, 't1').lightScreen).toBe(true)
    expect(buildField(campoPieno, 't2').lightScreen).toBe(false)
  })

  it('i valori comuni a entrambe le squadre non si invertono', () => {
    const a = buildField(campoPieno, 't1')
    const b = buildField(campoPieno, 't2')
    expect(a.weather).toBe(b.weather)
    expect(a.terrain).toBe(b.terrain)
    expect(a.trickRoom).toBe(b.trickRoom)
    expect(a.doubleTarget).toBe(b.doubleTarget)
    expect(a.tailwindT1).toBe(b.tailwindT1)
    expect(a.tailwindT2).toBe(b.tailwindT2)
  })

  it('atkTeamSide segue chi attacca', () => {
    expect(buildField(campoPieno, 't1').atkTeamSide).toBe('t1')
    expect(buildField(campoPieno, 't2').atkTeamSide).toBe('t2')
    expect(buildField(campoPieno).atkTeamSide).toBe('t1')          // default
    expect(buildField(campoPieno, 'boh').atkTeamSide).toBe('t1')   // valore assurdo
  })

  it('porta trickRoom e tailwind, che il ReportPanel non aveva mai avuto', () => {
    const f = buildField(campoPieno, 't1')
    expect(f.trickRoom).toBe(true)
    expect(f.tailwindT2).toBe(true)
    expect(campoStorico(campoPieno, 't1').trickRoom).toBeUndefined()
  })

  it('un campo vuoto produce tutto spento, senza default inventati', () => {
    // L'asserzione è sulla FORMA ESATTA, non su qualche chiave: un campo nuovo
    // che nascesse `true`, o che comparisse senza che nessuno lo abbia voluto,
    // fa diventare rosso questo test. Va quindi allungato di proposito ogni
    // volta che il campo di battaglia cresce — è successo con le cinque
    // caselle dell'alleato, ed è il modo in cui doveva funzionare.
    const f = buildField()
    expect(f).toEqual({
      weather: null, terrain: null, doubleTarget: false,
      helpingHand: false, crit: false,
      battery: false, powerSpot: false, steelySpiritAlleato: false,
      auroraVeil: false, lightScreen: false, reflect: false,
      friendGuard: false,
      protect: false,
      flowerGiftAtk: false, flowerGiftSpD: false,
      trickRoom: false, tailwindT1: false, tailwindT2: false,
      atkTeamSide: 't1',
    })
  })
})

describe('battleState — buildMatchup', () => {
  it('è la somma delle tre funzioni', () => {
    const m = buildMatchup(houndstone, amoonguss, campoPieno, 't2', LEVEL)
    expect(m.attacker).toEqual(buildAttackerInput(houndstone, LEVEL))
    expect(m.defender).toEqual(buildDefenderInput(amoonguss))
    expect(m.field).toEqual(buildField(campoPieno, 't2'))
  })

  it('il risultato del motore è identico a quello dei componenti storici', () => {
    for (const dir of ['t1', 't2']) {
      const m = buildMatchup(houndstone, amoonguss, campoPieno, dir)
      const nuovo = calculateDamage({ ...m, move: 'shadow ball' })
      const vecchio = calculateDamage({
        attacker: attaccanteTabellaStorico(houndstone, 50),
        defender: buildDefenderInput(amoonguss),
        move: 'shadow ball',
        field: campoStorico(campoPieno, dir),
      })
      expect(nuovo.rolls).toEqual(vecchio.rolls)
    }
  })
})