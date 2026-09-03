// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/fineTurno.test.js
 *
 * Le cinque abilità che muovono i PS alla fine del turno: Corpogelo,
 * Copripioggia, Solarpotere, Pellearsa e Velencura.
 *
 * ─── QUI L'ORACOLO NON ARRIVA, E VA DETTO PRIMA DI TUTTO ───────────────────
 *
 * Il riferimento calcola UN colpo, e il fine turno non lo guarda affatto:
 * `Leftovers`, `Ice Body`, `Rain Dish` e `Poison Heal` non compaiono nemmeno
 * una volta nei due file del danno. `Solar Power` e `Dry Skin` ci sono, ma
 * solo per la metà che tocca il danno — il ×1,5 all'Att. Speciale e il ×1,25
 * sulle mosse Fuoco — mai per i punti salute.
 *
 * È la stessa situazione di Rock Head: una decisione, non una trascrizione.
 * Sta in `divergenzeAggiudicate.test.js` §5, e i controlli sul vendor stanno
 * lì. Qui ci sono i casi.
 *
 * ─── COSA SI PUÒ VERIFICARE LO STESSO ──────────────────────────────────────
 *
 * Tre cose, e non sono poco:
 *
 *   1. che il numero nel motore sia quello che la DESCRIZIONE promette
 *      all'utente — cioè che le due metà dell'app non si contraddicano.
 *      Quel test sta in `divergenzeAggiudicate.test.js`, dove sta la
 *      decisione;
 *   2. che le condizioni siano quelle giuste: la famiglia del meteo, lo stato,
 *      l'Utility Umbrella;
 *   3. che il numero ARRIVI FINO IN FONDO, cioè cambi davvero il conteggio dei
 *      turni al KO. Una voce di fine turno giusta che nessuno somma non serve
 *      a niente, ed è il difetto che questi test sull'HKO cercano.
 *
 * ─── COSA NON C'È, E VA DETTO ──────────────────────────────────────────────
 *
 * Il danno da stato. La bruciatura non toglie 1/16, il veleno non toglie 1/8,
 * l'iride non cresce. Quindi Velencura dà +1/8 a chi ce l'ha, e chi è
 * avvelenato senza non perde niente: la prima metà è giusta, la seconda è zero
 * al posto di un numero.
 *
 * Non è un difetto che queste cinque righe introducono — c'era già — ma da
 * oggi si vede, perché Velencura lo mette accanto. È il caso successivo, e sta
 * scritto qui e in `divergenzeAggiudicate.test.js` perché non si perda.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calcEOT, vociFineTurnoAbilita, findBestNHKO } from '../lib/damage.js'
import { buildSmogonString } from '../utils/smogonString.js'
import { calculateDamage } from '../calcEngine.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { famigliaMeteo, METEO_CANONICI } from '../lib/rules.js'

/** Un difensore da 160 PS: 1/16 = 10, 1/8 = 20. Numeri che si leggono. */
const PS = 160
const dif = (extra = {}) => ({ ability: null, item: null, status: null, ...extra })

// ═══════════════════════════════════════════════════════════════════════════
// 1. La famiglia del meteo
// ═══════════════════════════════════════════════════════════════════════════

describe('famigliaMeteo — sei nomi, quattro famiglie', () => {
  it('il Sole Estremo è sole e la Pioggia Intensa è pioggia', () => {
    expect(famigliaMeteo('harsh sunshine')).toBe('sun')
    expect(famigliaMeteo('heavy rain')).toBe('rain')
    expect(famigliaMeteo('sun')).toBe('sun')
    expect(famigliaMeteo('rain')).toBe('rain')
  })

  it('sabbia e neve stanno da sole', () => {
    expect(famigliaMeteo('sand')).toBe('sand')
    expect(famigliaMeteo('snow')).toBe('snow')
  })

  it('passa dalla normalizzazione, quindi conosce i nomi morti', () => {
    // `hail` e `sandstorm` sono i due sinonimi che `normalizzaMeteo` traduce.
    expect(famigliaMeteo('hail')).toBe('snow')
    expect(famigliaMeteo('sandstorm')).toBe('sand')
  })

  it('ogni meteo canonico ha una famiglia, e nient\'altro ce l\'ha', () => {
    // Se domani si aggiunge un settimo meteo e nessuno tocca la tabella, la
    // sua famiglia sarebbe `null` in silenzio e le cinque abilità non si
    // accenderebbero mai: questo test lo fa vedere subito.
    for (const m of METEO_CANONICI) expect(famigliaMeteo(m), m).toBeTruthy()
    expect(famigliaMeteo('fog')).toBe(null)
    expect(famigliaMeteo(null)).toBe(null)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Le cinque, una per una
// ═══════════════════════════════════════════════════════════════════════════

describe('le cinque abilità, e quando si accendono', () => {
  const casi = [
    // abilità        meteo               stato       PS attesi
    ['ice-body',     'snow',              null,        +10],
    ['ice-body',     'rain',              null,          0],
    ['rain-dish',    'rain',              null,        +10],
    ['rain-dish',    'heavy rain',        null,        +10],
    ['rain-dish',    'sun',               null,          0],
    ['solar-power',  'sun',               null,        -20],
    ['solar-power',  'harsh sunshine',    null,        -20],
    ['solar-power',  'snow',              null,          0],
    ['dry-skin',     'rain',              null,        +20],
    ['dry-skin',     'sun',               null,        -20],
    ['dry-skin',     'sand',              null,          0],
    ['poison-heal',  null,                'poisoned',  +20],
    ['poison-heal',  null,                'badly-poisoned', +20],
    ['poison-heal',  null,                'burned',      0],
    ['poison-heal',  null,                null,          0],
  ]

  for (const [abilita, meteo, stato, atteso] of casi) {
    it(`${abilita} con «${meteo ?? 'niente'}»${stato ? ` e ${stato}` : ''}: ${atteso} PS`, () => {
      const voci = vociFineTurnoAbilita(abilita, null, PS, meteo, stato)
      expect(voci.reduce((s, v) => s + v.hp, 0)).toBe(atteso)
    })
  }

  it('Pellearsa è l\'unica con due voci dichiarate', () => {
    // È la ragione per cui `fineTurno` è una lista e non un oggetto: trattarla
    // come caso a parte sarebbe stato il modo di non vederla.
    const conDue = Object.entries(ABILITY_EFFECTS)
      .filter(([, v]) => (v.fineTurno?.length ?? 0) > 1).map(([k]) => k)
    expect(conDue).toEqual(['dry-skin'])
  })

  it('e le due non possono essere vere insieme', () => {
    // Sole e pioggia si escludono: qualunque meteo, al massimo una voce.
    for (const m of METEO_CANONICI) {
      expect(vociFineTurnoAbilita('dry-skin', null, PS, m, null).length, m)
        .toBeLessThanOrEqual(1)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. L'Utility Umbrella
// ═══════════════════════════════════════════════════════════════════════════

describe('l\'Utility Umbrella ripara da sole e pioggia, non dalla neve', () => {
  const conOmbrello = (abilita, meteo) =>
    vociFineTurnoAbilita(abilita, 'utility umbrella', PS, meteo, null)

  it('spegne Copripioggia, Solarpotere e tutt\'e due le metà di Pellearsa', () => {
    expect(conOmbrello('rain-dish', 'rain')).toEqual([])
    expect(conOmbrello('solar-power', 'sun')).toEqual([])
    expect(conOmbrello('dry-skin', 'rain')).toEqual([])
    expect(conOmbrello('dry-skin', 'sun')).toEqual([])
  })

  it('e vale anche sotto i due meteo estremi', () => {
    expect(conOmbrello('rain-dish', 'heavy rain')).toEqual([])
    expect(conOmbrello('solar-power', 'harsh sunshine')).toEqual([])
  })

  it('NON spegne Corpogelo: la neve non è né sole né pioggia', () => {
    expect(conOmbrello('ice-body', 'snow')).toHaveLength(1)
    expect(conOmbrello('ice-body', 'snow')[0].hp).toBe(10)
  })

  it('né Velencura, che non guarda il meteo', () => {
    expect(vociFineTurnoAbilita('poison-heal', 'utility umbrella', PS, 'sun', 'poisoned'))
      .toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Che nessuna voce dichiarata resti spenta in silenzio
// ═══════════════════════════════════════════════════════════════════════════

describe('ogni voce dichiarata usa una chiave che la funzione conosce', () => {
  it('e cioè: una famiglia di meteo, oppure lo stato «veleno»', () => {
    // Il rischio è preciso: una voce che nominasse `hail` o `toxic` verrebbe
    // filtrata via senza un errore, e l'abilità non si accenderebbe mai. Nessun
    // altro test lo vedrebbe, perché il numero atteso sarebbe zero ovunque.
    const famiglie = new Set(METEO_CANONICI.map(famigliaMeteo))
    for (const [chiave, voce] of Object.entries(ABILITY_EFFECTS)) {
      for (const v of voce.fineTurno ?? []) {
        expect(
          v.meteo ? famiglie.has(v.meteo) : v.stato === 'veleno',
          `${chiave}: «${v.meteo ?? v.stato}» non è una chiave che vociFineTurnoAbilita capisce`,
        ).toBe(true)
        expect(v.segno, `${chiave}: segno`).toBeOneOf([1, -1])
        expect(v.frazione, `${chiave}: frazione`).toBeGreaterThan(0)
      }
    }
  })

  it('e ce ne sono cinque, non di più', () => {
    // Elenco esatto: una sesta è una decisione nuova e va scritta prima in
    // `divergenzeAggiudicate.test.js`, dove sta il perché.
    const conFineTurno = Object.entries(ABILITY_EFFECTS)
      .filter(([, v]) => v.fineTurno).map(([k]) => k).sort()
    expect(conFineTurno).toEqual(
      ['dry-skin', 'ice-body', 'poison-heal', 'rain-dish', 'solar-power'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. calcEOT: la somma, e l'ordine
// ═══════════════════════════════════════════════════════════════════════════

describe('calcEOT mette insieme sabbia, abilità, strumento e stato', () => {
  it('eotNet è la somma delle voci, sempre', () => {
    // La proprietà che tiene insieme il pannello: il numero che conta i turni
    // e l'elenco che li spiega vengono dalla stessa lista.
    const casi = [
      [dif({ ability: 'ice-body', item: 'leftovers' }), 'snow'],
      [dif({ ability: 'solar-power' }), 'sun'],
      [dif({ ability: 'dry-skin', item: 'leftovers' }), 'sand'],
      [dif({ ability: 'poison-heal', status: 'poisoned', item: 'leftovers' }), 'sand'],
      [dif({}), 'sand'],
    ]
    for (const [d, meteo] of casi) {
      const eot = calcEOT(d, PS, meteo, [])
      expect(eot.eotNet, `${d.ability ?? '—'} / ${meteo}`)
        .toBe(eot.voci.reduce((s, v) => s + v.hp, 0))
    }
  })

  it('l\'ordine è meteo, strumento, stato', () => {
    // È l'ordine del turno nel gioco, ed è anche l'ordine in cui il pannello
    // disegna la catena dei PS: la sabbia e le abilità che il meteo accende
    // nello stesso passo, gli Avanzi dopo, il veleno dopo ancora.
    const eot = calcEOT(
      dif({ ability: 'dry-skin', item: 'leftovers' }), PS, 'sand', [])
    expect(eot.voci.map(v => v.chiave)).toEqual(['sand', 'leftovers'])

    const conVeleno = calcEOT(
      dif({ ability: 'poison-heal', item: 'leftovers', status: 'poisoned' }),
      PS, 'sand', [])
    expect(conVeleno.voci.map(v => v.chiave))
      .toEqual(['sand', 'leftovers', 'poison-heal'])
  })

  it('Magicscudo toglie la sabbia, e quindi non lascia nemmeno la voce', () => {
    const eot = calcEOT(dif({ ability: 'magic-guard' }), PS, 'sand', [])
    expect(eot.sandImmune).toBe(true)
    expect(eot.voci).toEqual([])
    expect(eot.eotNet).toBe(0)
  })

  it('un difensore senza niente non ha voci', () => {
    expect(calcEOT(dif({}), PS, 'sun', []).voci).toEqual([])
  })

  it('Solarpotere sotto il sole: la voce c\'è, ed è negativa', () => {
    const eot = calcEOT(dif({ ability: 'solar-power' }), PS, 'sun', [])
    expect(eot.voci).toEqual([
      { chiave: 'solar-power', hp: -20, tipo: 'meteo', meteo: 'sun', abilita: true },
    ])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. Che il numero arrivi fino in fondo
// ═══════════════════════════════════════════════════════════════════════════

describe('il fine turno cambia davvero il conteggio dei turni al KO', () => {
  // Un colpo secco da 40 su 160 PS: quattro turni netti senza fine turno.
  const colpo = new Array(16).fill(40)

  it('senza abilità: 4HKO', () => {
    expect(findBestNHKO(colpo, PS, calcEOT(dif({}), PS, 'snow', []).eotNet).hits).toBe(4)
  })

  it('con Corpogelo sotto la neve (+10 a turno): un turno in più', () => {
    // 40 di danno e 10 di recupero fanno 30 netti: 160/30 = sei turni.
    const eot = calcEOT(dif({ ability: 'ice-body' }), PS, 'snow', []).eotNet
    expect(eot).toBe(10)
    expect(findBestNHKO(colpo, PS, eot).hits).toBeGreaterThan(4)
  })

  it('con Solarpotere sotto il sole (−20 a turno): un turno in meno', () => {
    const eot = calcEOT(dif({ ability: 'solar-power' }), PS, 'sun', []).eotNet
    expect(eot).toBe(-20)
    expect(findBestNHKO(colpo, PS, eot).hits).toBeLessThan(4)
  })

  it('e senza il sole Solarpotere non cambia niente', () => {
    // Il controllo negativo: senza, i due test sopra passerebbero anche se
    // l'abilità fosse sempre accesa.
    const eot = calcEOT(dif({ ability: 'solar-power' }), PS, 'snow', []).eotNet
    expect(eot).toBe(0)
    expect(findBestNHKO(colpo, PS, eot).hits).toBe(4)
  })

  it('Velencura sull\'avvelenato: +20, e il KO si allontana', () => {
    const eot = calcEOT(
      dif({ ability: 'poison-heal', status: 'badly-poisoned' }), PS, null, []).eotNet
    expect(eot).toBe(20)
    expect(findBestNHKO(colpo, PS, eot).hits).toBeGreaterThan(4)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. La stringa Smogon, e le tre copie che non ci sono più
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Prima di questa sessione l'elenco delle voci di fine turno era scritto a
 * mano in TRE posti: la barra narrativa del pannello, la catena dei PS, e
 * questa stringa. Ognuno ne conosceva due — sabbia e Avanzi — e le cinque
 * abilità sarebbero entrate in uno solo dei tre.
 *
 * È la stessa forma di difetto che il progetto ha già chiuso sui sinonimi del
 * meteo (`normalizzaMeteo`) e sui nomi delle levette (`traduzioni.test.js`):
 * due copie della stessa verità, e quella che nessuno guarda invecchia.
 *
 * Adesso la lista è una sola — `voci`, da `calcEOT` — e questi test la seguono
 * fin dentro la stringa che l'utente incolla in chat.
 */
describe('la stringa Smogon nomina le voci nuove', () => {
  const slotAtk = { key: 'garchomp', sps: [0, 32, 0, 0, 0, 0], nature: 'hardy', ability: 'sand veil', item: null }
  const slotDef = { key: 'venusaur', sps: [32, 0, 32, 0, 0, 0], nature: 'hardy', ability: 'chlorophyll', item: null }
  const risultato = calculateDamage({
    attacker: {
      atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0],
      atkNature: 'hardy', atkAbility: 'sand veil', atkItem: null, level: 50,
    },
    defender: {
      defPokemon: 'venusaur', defSPs: [32, 0, 32, 0, 0, 0],
      defNature: 'hardy', defAbility: 'chlorophyll', defItem: null,
    },
    move: 'crunch', field: {}, debug: false,
  })

  it('«after Ice Body recovery», col nome scritto come lo scrive Smogon', () => {
    const s = buildSmogonString(
      slotAtk, { ...slotDef, ability: 'ice-body' }, 'crunch', risultato, { weather: 'snow' })
    expect(s).toContain('after Ice Body recovery')
  })

  it('«after Solar Power damage», perché il segno cambia la parola', () => {
    const s = buildSmogonString(
      slotAtk, { ...slotDef, ability: 'solar-power' }, 'crunch', risultato, { weather: 'sun' })
    expect(s).toContain('after Solar Power damage')
  })

  it('e le nomina insieme alle vecchie, nell\'ordine del turno', () => {
    const s = buildSmogonString(
      slotAtk, { ...slotDef, ability: 'ice-body', item: 'leftovers' },
      'crunch', risultato, { weather: 'snow' })
    expect(s).toContain('after Ice Body recovery and Leftovers recovery')
  })

  it('la stringa resta in inglese: è fatta per essere incollata', () => {
    // È l'unica parte del progetto che NON passa da i18n, e il motivo è
    // scritto lì: la si incolla in una chat dove la leggono tutti.
    const s = buildSmogonString(
      slotAtk, { ...slotDef, ability: 'rain-dish' }, 'crunch', risultato, { weather: 'rain' })
    expect(s).toContain('Rain Dish recovery')
    expect(s).not.toContain('Copripioggia')
  })
})

describe('nessuno dei tre posti ricostruisce la lista a mano', () => {
  // Un presidio di TESTO, come `levette.test.js` e `listeDiSoliNomi.test.js`:
  // non prova che il disegno sia giusto — quello non c'è modo di provarlo
  // senza montare il pannello — ma che nessuno abbia rimesso un `if` per la
  // sabbia accanto a uno per gli Avanzi. È esattamente da lì che la terza
  // copia rinascerebbe.
  const RADICE = path.resolve(import.meta.dirname, '..', '..')

  for (const file of ['src/components/ReportPanel.jsx', 'src/utils/smogonString.js']) {
    it(`${file} non nomina più sandDmgHP né leftoversHP`, () => {
      const src = fs.readFileSync(path.join(RADICE, file), 'utf8')
      // Solo nel codice: i commenti raccontano la storia e devono poterlo fare.
      const codice = src.split('\n').filter(r => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n')
      for (const nome of ['sandDmgHP', 'leftoversHP', 'hpAfterSand', 'hpAfterLefto']) {
        expect(codice.includes(nome), `${file} nomina ancora ${nome}`).toBe(false)
      }
    })
  }
})
