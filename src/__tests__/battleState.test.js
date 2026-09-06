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
import fs from 'node:fs'
import path from 'node:path'
import { calculateDamage } from '../calcEngine.js'
import {
  buildAttackerInput, buildDefenderInput, buildField, buildMatchup,
} from '../lib/battleState.js'
import { LEVEL } from '../lib/rules.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')

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
    // Stessa cosa per `colpiScelti`, aggiunto con le mosse multi-colpo, per
    // `atkPS`, aggiunto con la barra dei punti salute, e per i due stadi che
    // il condotto non ha mai mandato: si dichiarano qui, e l'elenco che cresce
    // sotto gli occhi è il punto — dice quanto la costruzione si è allontanata
    // dalla fotografia del 2024.
    //
    // `atkSpDefBoost` e `atkSpeBoost` non sono una novità come gli altri: il
    // motore li accettava già nel 2024 e nessuno glieli mandava. Stanno in
    // questo elenco perché la fotografia storica riproduce il difetto, non
    // perché il difetto fosse voluto.
    expect(buildAttackerInput(houndstone, LEVEL))
      .toEqual({
        ...attaccanteTabellaStorico(houndstone, 50),
        atkDefBoost: 0, colpiScelti: null, atkPS: null,
        atkSpDefBoost: houndstone.spDefBoost || 0,
        atkSpeBoost: houndstone.speBoost || 0,
      })
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
// ─── Il presidio che mancava ────────────────────────────────────────────────

describe('ogni campo che il motore accetta, il condotto lo manda', () => {
  /**
   * ─── IL DIFETTO CHE NESSUNO GUARDAVA ──────────────────────────────────────
   *
   * `calculateDamage` accettava `atkSpDefBoost`, `atkSpeBoost`, `defAtkBoost`,
   * `defSpAtkBoost` e `defSpeBoost`, e `battleState` non gliene mandava
   * nessuno: arrivavano zero, sempre, da sempre. Cinque numeri sbagliati nella
   * matrice, in silenzio:
   *
   *   Colpo Sleale        danno 26 invece di 99   (attacca con l'Attacco altrui)
   *   Punizione           danno 38 invece di 75   (conta gli stadi altrui)
   *   Forza Ancestrale    danno 20 invece di 162  (conta i propri)
   *   Elettropalla        danno 18 invece di 34   (la propria Velocità)
   *   Vortexpalla         danno  9 invece di  3   (idem, al contrario)
   *
   * Perché nessun presidio l'ha visto:
   *
   *   - lo SNAPSHOT chiama `calculateDamage` con input scritti a mano, quindi
   *     salta questa funzione — e infatti è rimasto a zero divergenze mentre
   *     il difetto c'era e mentre veniva corretto;
   *   - la fotografia della MATRICE è stata scattata da questo stesso condotto,
   *     quindi concordava con sé stessa;
   *   - `battleState.test.js` confrontava con la costruzione del 2024, che
   *     aveva lo stesso buco.
   *
   * Tutt'e tre erano verdi. È lo schema dei quattro difetti dell'harness di
   * questa sessione: le due parti sbagliavano d'accordo.
   *
   * ─── PERCHÉ GUARDA IL SORGENTE ────────────────────────────────────────────
   *
   * Perché la domanda è una proprietà del sorgente: «il motore dichiara un
   * parametro che nessuno riempie?». Un test che provasse le mosse una per una
   * coprirebbe quelle a cui ho pensato — e queste cinque nessuno ci aveva
   * pensato per due anni. È lo stesso schema di `levette.test.js`.
   */
  const motore = fs.readFileSync(path.join(RADICE, 'src/calcEngine.js'), 'utf8')

  /** I nomi destrutturati da `attacker` e da `defender` in `calculateDamage`. */
  function parametriDi(oggetto) {
    const i = motore.indexOf(`} = ${oggetto}`)
    expect(i, `non trovo la destrutturazione di ${oggetto}`).toBeGreaterThan(-1)
    // Indietro fino alla graffa che apre.
    const apertura = motore.lastIndexOf('const {', i)
    expect(apertura).toBeGreaterThan(-1)
    return motore.slice(apertura, i)
      .split('\n')
      .map(r => r.trim().match(/^([A-Za-z_$][\w$]*)\s*(?:=|,|$)/)?.[1])
      .filter(n => n && n !== 'const')
  }

  const slotPieno = {
    key: 'garchomp', sps: [4, 4, 4, 4, 4, 4], nature: 'adamant', ability: 'Rough Skin',
    item: 'life orb', status: 'burned', ps: 100,
    atkBoost: 1, defBoost: 2, spAtkBoost: 3, spDefBoost: 4, speBoost: 5,
    abilityFlags: {}, lastRespectsKOs: 1, colpiScelti: 2,
  }

  it('l\'attaccante: nessun parametro resta senza chi lo riempie', () => {
    const attesi = parametriDi('attacker')
    // Il presupposto: se l'estrazione non trovasse niente il test sarebbe
    // verde e vuoto.
    expect(attesi.length, 'l\'estrazione dal sorgente non trova più i parametri')
      .toBeGreaterThanOrEqual(10)

    const mandati = Object.keys(buildAttackerInput(slotPieno))
    expect(
      attesi.filter(k => !mandati.includes(k)),
      'il motore li accetta e `buildAttackerInput` non glieli manda: '
      + 'arrivano al valore di riposo e nessun test se ne accorge',
    ).toEqual([])
  })

  it('il difensore: idem', () => {
    const attesi = parametriDi('defender')
    expect(attesi.length).toBeGreaterThanOrEqual(8)
    const mandati = Object.keys(buildDefenderInput(slotPieno))
    expect(
      attesi.filter(k => !mandati.includes(k)),
      'il motore li accetta e `buildDefenderInput` non glieli manda',
    ).toEqual([])
  })

  it('e i cinque stadi arrivano col valore giusto, non solo col nome', () => {
    // Il test qui sopra sarebbe verde anche con `atkSpeBoost: 0` scritto
    // fisso. Questo guarda il valore.
    const a = buildAttackerInput(slotPieno)
    expect([a.atkBoost, a.atkDefBoost, a.spAtkBoost, a.atkSpDefBoost, a.atkSpeBoost])
      .toEqual([1, 2, 3, 4, 5])
    const d = buildDefenderInput(slotPieno)
    expect([d.defAtkBoost, d.defBoost, d.defSpAtkBoost, d.spDefBoost, d.defSpeBoost])
      .toEqual([1, 2, 3, 4, 5])
  })
})

// ─── E le cinque mosse, dal capo opposto ────────────────────────────────────

describe('i cinque numeri che erano sbagliati nella matrice', () => {
  /**
   * Il presidio qui sopra guarda il SORGENTE: «esiste un parametro che nessuno
   * riempie?». Questo guarda il DANNO, ed è la stessa domanda dall'altro capo.
   *
   * Servono tutt'e due. Quello strutturale trova anche il parametro a cui
   * nessuno ha pensato — ed è il caso di questi cinque, rimasti fuori per due
   * anni. Questo qui dice che il numero è cambiato davvero, e in che verso:
   * senza, il primo sarebbe verde anche mandando la chiave giusta con dentro
   * il valore sbagliato.
   *
   * I numeri NON sono riscritti a mano: si confronta lo slot con lo stadio
   * contro lo stesso slot senza. Un valore atteso scritto qui sarebbe una
   * terza copia della formula.
   */
  const slot = (extra) => ({
    key: 'garchomp', sps: [0, 0, 0, 0, 0, 0], nature: null, ability: null,
    item: null, status: null, abilityFlags: {},
    atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
    ...extra,
  })

  const danno = (atk, def, move) => calculateDamage({
    attacker: buildAttackerInput(atk),
    defender: buildDefenderInput(def),
    move, field: {},
  })

  const NEUTRO = slot({ key: 'amoonguss' })

  it.each([
    // [mossa, chi ha lo stadio, quale stadio, verso atteso]
    ['stored power', 'attaccante', { speBoost: 6 },  'su'],
    ['stored power', 'attaccante', { spDefBoost: 4 }, 'su'],
    ['electro ball', 'attaccante', { speBoost: 6 },  'su'],
    // Vortexpalla è più forte quando sei LENTO: alzare la Velocità la
    // indebolisce. Il verso opposto è il caso che distingue «arriva il numero»
    // da «arriva un numero qualunque».
    ['gyro ball',    'attaccante', { speBoost: 6 },  'giu'],
    ['foul play',    'difensore',  { atkBoost: 6 },  'su'],
    ['punishment',   'difensore',  { spAtkBoost: 6 }, 'su'],
  ])('%s reagisce allo stadio di %s (%o)', (move, lato, stadio, verso) => {
    const atkFermo = slot({ moves: [move] })
    const conStadio = lato === 'attaccante'
      ? [slot({ ...stadio }), NEUTRO]
      : [atkFermo, slot({ key: 'amoonguss', ...stadio })]
    const senza = lato === 'attaccante'
      ? [slot({}), NEUTRO]
      : [atkFermo, NEUTRO]

    const a = danno(senza[0], senza[1], move)
    const b = danno(conStadio[0], conStadio[1], move)
    expect(a, `il motore non calcola ${move}`).not.toBeNull()
    expect(a.maxDmg, 'il caso neutro non fa danno: non distingue niente')
      .toBeGreaterThan(0)

    if (verso === 'su') expect(b.maxDmg).toBeGreaterThan(a.maxDmg)
    else expect(b.maxDmg).toBeLessThan(a.maxDmg)
  })
})
