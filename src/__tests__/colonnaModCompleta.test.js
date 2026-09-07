// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/colonnaModCompleta.test.js
 *
 * La colonna «Mod» mostra TUTTE le modifiche di statistica, e mostra gli
 * stessi numeri del motore.
 *
 * ─── LA REGOLA, ALLARGATA ──────────────────────────────────────────────────
 *
 * «Di un'abilità che potenzia una statistica si deve sempre poter leggere il
 * nuovo valore» era già la regola, e valeva per le abilità. Adesso vale per
 * TUTTO quello che il motore spinge in `atMods` e in `dfMods` — strumenti
 * compresi.
 *
 * Mancavano nove voci, e la Fascianodo era la più visibile di tutte: ×1.5
 * sull'Attacco, su OGNI mossa fisica, e la colonna mostrava l'Attacco nudo.
 *
 * ─── IL SECONDO ORACOLO, E PERCHE' SERVIVA UNA MODIFICA AL MOTORE ──────────
 *
 * Un test che ricalcolasse qui i moltiplicatori sarebbe la terza copia della
 * stessa assunzione: verificherebbe che due funzioni scritte dalla stessa
 * persona nello stesso pomeriggio sbagliano insieme.
 *
 * Il confronto vero è con il motore, che è già verificato contro NCP. Per
 * farlo, `calculateDamage` adesso restituisce `atkStatFinal` e `defStatFinal`
 * — i due numeri che entrano davvero nella formula. Erano già calcolati; non
 * uscivano, e finché non uscivano l'invariante «la colonna e il danno dicono
 * la stessa cosa» non si poteva misurare, solo sperare.
 *
 * ─── COSA LA COLONNA NON PUO' MOSTRARE, E NON E' UNA MANCANZA ──────────────
 *
 * Un numero solo per statistica non può dire la verità su un modificatore che
 * dipende dalla MOSSA. Erbaiuto dà ×1.5 alle sole mosse Erba: scritto nella
 * colonna sarebbe vero per una mossa e falso per le altre tre. Stessa cosa per
 * Fire Mane, Affilato, Transistor, Bolla d'Acqua, Fuocardore.
 *
 * E non può dire niente su ciò che dipende da CHI STA DI FRONTE: le quattro
 * Rovina, le abilità difensive che dimezzano l'attacco altrui, il Flower Gift
 * di un alleato. La colonna riceve un Pokémon solo — è la stessa ragione per
 * cui Intimidate si è sempre messo a mano.
 *
 * I due elenchi sono qui sotto come casi: asseriscono che quelle voci NON si
 * vedono, così il confine resta scritto invece che sottinteso.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'
import { statMostrata } from '../lib/statMostrata.js'
import { STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD } from '../lib/rules.js'
import { MOD, chainMods } from '../lib/modifiers.js'

/** Mossa neutra per lato: Normale, senza flag che accendano altro. */
const MOSSA = { fisica: 'pound', speciale: 'swift' }

/** L'avversario di comodo: nessuna abilità, nessuno strumento, niente stadi. */
const NEUTRO = {
  pokemon: 'sudowoodo', sps: [0, 0, 0, 0, 0, 0], natura: null,
}

/**
 * La statistica che il MOTORE ha davvero usato per questo Pokémon in questa
 * casella. È il secondo oracolo: non ricalcola niente, legge.
 */
function statDalMotore(slot, statIdx, contesto = {}) {
  const attaccante = statIdx === STAT_ATT || statIdx === STAT_SPA
  const move = (statIdx === STAT_ATT || statIdx === STAT_DEF)
    ? MOSSA.fisica : MOSSA.speciale

  const lato = {
    Pokemon: slot.key, SPs: slot.sps, Nature: slot.nature ?? null,
    Ability: slot.ability ?? null, Item: slot.item ?? null,
  }
  const r = calculateDamage({
    attacker: attaccante ? {
      atkPokemon: lato.Pokemon, atkSPs: lato.SPs, atkNature: lato.Nature,
      atkAbility: lato.Ability, atkItem: lato.Item, level: 50,
      atkBoost: slot.atkBoost || 0, spAtkBoost: slot.spAtkBoost || 0,
      atkAbilityFlags: slot.abilityFlags || {}, atkStatus: slot.status || null,
      atkPS: slot.ps ?? null,
    } : {
      atkPokemon: NEUTRO.pokemon, atkSPs: NEUTRO.sps, atkNature: null,
      atkAbility: null, atkItem: null, level: 50, atkAbilityFlags: {},
    },
    defender: attaccante ? {
      defPokemon: NEUTRO.pokemon, defSPs: NEUTRO.sps, defNature: null,
      defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0,
      defAbilityFlags: {},
    } : {
      defPokemon: lato.Pokemon, defSPs: lato.SPs, defNature: lato.Nature,
      defAbility: lato.Ability, defItem: lato.Item,
      defBoost: slot.defBoost || 0, spDefBoost: slot.spDefBoost || 0,
      defAbilityFlags: slot.abilityFlags || {}, defStatus: slot.status || null,
      defPS: slot.ps ?? null,
    },
    move, field: { weather: contesto.meteo ?? null, terrain: contesto.terreno ?? null },
  })
  expect(r, 'il motore non ha calcolato il caso').toBeTruthy()
  expect(r.immune, 'il caso è immune: le statistiche non escono').toBeFalsy()
  return attaccante ? r.atkStatFinal : r.defStatFinal
}

const slot = (extra) => ({
  key: 'sudowoodo', sps: [0, 0, 0, 0, 0, 0], nature: null,
  ability: null, item: null, abilityFlags: {}, ...extra,
})

/**
 * I casi. Ognuno dice quale voce copre, dove sta nel riferimento, e su quale
 * colonna deve vedersi.
 *
 * `atteso` non è il numero — quello lo dice il motore — ma la DIREZIONE: serve
 * a garantire che il caso possa muoversi. Un caso in cui la colonna e il
 * motore concordano su un valore non modificato passerebbe anche con la voce
 * non implementata, ed è esattamente l'errore che questa sessione ha già preso
 * una volta con un difensore immune.
 */
const CASI = [
  // ── Strumenti: le sei che mancavano ──────────────────────────────────────
  ['Fascianodo — ×1.5 su ogni mossa fisica (punto j)',
    { key: 'garchomp', item: 'choice band' }, STAT_ATT, 'su'],
  ['Occhialscelta — ×1.5 su ogni mossa speciale (punto j)',
    { key: 'gholdengo', item: 'choice specs' }, STAT_SPA, 'su'],
  ['Sferascintilla — ×2, e senza controllo di categoria (punto i)',
    { key: 'pikachu', item: 'light ball' }, STAT_ATT, 'su'],
  ['Sferascintilla, l\'altra metà: anche l\'Attacco Speciale',
    { key: 'pikachu', item: 'light ball' }, STAT_SPA, 'su'],
  ['Evolcondensa — ×1.5 su chi può ancora evolversi (punto f)',
    { key: 'pikachu', item: 'eviolite' }, STAT_DEF, 'su'],
  ['Evolcondensa, anche sulla Difesa Speciale',
    { key: 'pikachu', item: 'eviolite' }, STAT_SPD, 'su'],
  ['Giubbotto Imbottito — ×1.5 sulla sola Difesa Speciale (punto f)',
    { key: 'garchomp', item: 'assault vest' }, STAT_SPD, 'su'],
  ['Polvere Metallica — ×2 sulla Difesa di Ditto (punto g)',
    { key: 'ditto', item: 'metal powder' }, STAT_DEF, 'su'],

  // ── Abilità: le sei che mancavano ────────────────────────────────────────
  ['Forza Bruta — ×1.5 sull\'Attacco con qualunque stato (punto d)',
    { key: 'garchomp', ability: 'guts', status: 'burned' }, STAT_ATT, 'su'],
  ['Agguato — ×2 quando l\'interruttore è acceso (punto g)',
    { key: 'garchomp', ability: 'stakeout', abilityFlags: { interruttore: true } }, STAT_ATT, 'su'],
  ['Più — ×1.5 con l\'alleato che ha Meno (punto d)',
    { key: 'garchomp', ability: 'plus', abilityFlags: { interruttore: true } }, STAT_ATT, 'su'],
  ['Squame Miracolo — ×1.5 sulla Difesa con qualunque stato (punto c)',
    { key: 'milotic', ability: 'marvel-scale', status: 'burned' }, STAT_DEF, 'su'],

  // ── Le due che dimezzano, già presenti: restano presidiate ───────────────
  ['Partenza Lenta — ×0.5 sull\'Attacco (punto b)',
    { key: 'regigigas', ability: 'slow-start', abilityFlags: { interruttore: true } }, STAT_ATT, 'giù'],
]

describe('la colonna «Mod» dice lo stesso numero del motore', () => {
  for (const [nome, extra, statIdx, direzione] of CASI) {
    it(nome, () => {
      const s = slot(extra)
      const nudo = slot({ ...extra, ability: null, item: null, status: null, abilityFlags: {} })

      // 1. il caso può muoversi: senza questo il confronto non prova niente.
      const conMod = statMostrata(s, statIdx).effettiva
      const senzaMod = statMostrata(nudo, statIdx).effettiva
      if (direzione === 'su') expect(conMod, `${nome}: la colonna non sale`).toBeGreaterThan(senzaMod)
      else expect(conMod, `${nome}: la colonna non scende`).toBeLessThan(senzaMod)

      // 2. e il numero è quello del motore.
      expect(conMod, `${nome}: la colonna e il danno non dicono lo stesso numero`)
        .toBe(statDalMotore(s, statIdx))

      // 3. `modificata` deve essere vera, o la colonna non disegna niente.
      expect(statMostrata(s, statIdx).modificata, `${nome}: la colonna non si accende`).toBe(true)
    })
  }
})

describe('e i casi che hanno bisogno del contesto', () => {
  const CASI_CONTESTO = [
    ['Solar Power — ×1.5 sull\'Attacco Speciale, col sole',
      { key: 'charizard', ability: 'solar-power' }, STAT_SPA, { meteo: 'sun' }],
    ['Pulsorichalco — ×1.3333 sull\'Attacco, col sole normale',
      { key: 'garchomp', ability: 'orichalcum-pulse' }, STAT_ATT, { meteo: 'sun' }],
    ['Motore Adroneutronico — ×1.3333 sull\'Attacco Speciale, sul terreno elettrico',
      { key: 'gholdengo', ability: 'hadron-engine' }, STAT_SPA, { terreno: 'electric' }],
    ['Mantoerboso — ×1.5 sulla Difesa, sul terreno erboso',
      { key: 'gogoat', ability: 'grass-pelt' }, STAT_DEF, { terreno: 'grassy' }],
  ]

  for (const [nome, extra, statIdx, contesto] of CASI_CONTESTO) {
    it(nome, () => {
      const s = slot(extra)
      const spenta = statMostrata(s, statIdx, {}).effettiva
      const accesa = statMostrata(s, statIdx, contesto).effettiva
      expect(accesa, `${nome}: il contesto non accende niente`).toBeGreaterThan(spenta)
      expect(accesa, `${nome}: la colonna e il danno non dicono lo stesso numero`)
        .toBe(statDalMotore(s, statIdx, contesto))
    })
  }

  it('Pulsorichalco NON si accende col sole estremo, come nel motore', () => {
    // Il riferimento scrive `field.weather === "Sun"` per Pulsorichalco e
    // `indexOf("Sun")` per Solar Power. È una distinzione trascritta, e la
    // colonna la deve avere identica o direbbe un numero che il danno smentisce.
    const s = slot({ key: 'garchomp', ability: 'orichalcum-pulse' })
    expect(statMostrata(s, STAT_ATT, { meteo: 'harsh sunshine' }).modificata).toBe(false)
    expect(statMostrata(s, STAT_ATT, { meteo: 'sun' }).modificata).toBe(true)
  })

  it('Solar Power invece sì, col sole estremo', () => {
    const s = slot({ key: 'charizard', ability: 'solar-power' })
    expect(statMostrata(s, STAT_SPA, { meteo: 'harsh sunshine' }).modificata).toBe(true)
  })

  it('e l\'Ombrellut li spegne tutt\'e due', () => {
    const solar = slot({ key: 'charizard', ability: 'solar-power', item: 'utility umbrella' })
    expect(statMostrata(solar, STAT_SPA, { meteo: 'sun' }).modificata).toBe(false)
    const orich = slot({ key: 'garchomp', ability: 'orichalcum-pulse', item: 'utility umbrella' })
    expect(statMostrata(orich, STAT_ATT, { meteo: 'sun' }).modificata).toBe(false)
  })
})

describe('i cancelli degli strumenti valgono anche nella colonna', () => {
  /**
   * ─── QUESTO BLOCCO ESISTE PERCHE' UNA MUTAZIONE E' PASSATA ───────────────
   *
   * Togliendo il cancello `soloSpecie` dal lato DIFENSIVO della colonna, i
   * quattordici casi qui sopra restavano tutti verdi: c'era solo il caso in
   * cui la Polvere Metallica DEVE accendersi, e nessuno in cui non deve. Un
   * cancello si prova da tutt'e due i lati, o non è provato.
   */
  it('la Polvere Metallica non alza la Difesa di chi non è Ditto', () => {
    const s = slot({ key: 'garchomp', item: 'metal powder' })
    expect(statMostrata(s, STAT_DEF).modificata, 'la Polvere si accende su Garchomp').toBe(false)
    expect(statMostrata(s, STAT_DEF).effettiva).toBe(statDalMotore(s, STAT_DEF))
  })

  it('la Sferascintilla non alza l\'Attacco di chi non è Pikachu', () => {
    const s = slot({ key: 'raichu', item: 'light ball' })
    expect(statMostrata(s, STAT_ATT).modificata, 'la Sferascintilla si accende su Raichu').toBe(false)
    expect(statMostrata(s, STAT_ATT).effettiva).toBe(statDalMotore(s, STAT_ATT))
  })

  it('l\'Evolcondensa non alza la Difesa di chi non può più evolversi', () => {
    const s = slot({ key: 'garchomp', item: 'eviolite' })
    expect(statMostrata(s, STAT_DEF).modificata, 'l\'Evolcondensa si accende su Garchomp').toBe(false)
    expect(statMostrata(s, STAT_DEF).effettiva).toBe(statDalMotore(s, STAT_DEF))
  })

  it('e la Fascianodo non tocca l\'Attacco Speciale', () => {
    // Il cancello della CATEGORIA, dall'altro lato: `statType: 'physical'`.
    const s = slot({ key: 'garchomp', item: 'choice band' })
    expect(statMostrata(s, STAT_SPA).modificata).toBe(false)
    expect(statMostrata(s, STAT_SPA).effettiva).toBe(statDalMotore(s, STAT_SPA))
  })

  it('né il Giubbotto Imbottito la Difesa fisica', () => {
    const s = slot({ key: 'garchomp', item: 'assault vest' })
    expect(statMostrata(s, STAT_DEF).modificata).toBe(false)
    expect(statMostrata(s, STAT_DEF).effettiva).toBe(statDalMotore(s, STAT_DEF))
  })
})

describe('l\'ordine della catena: quanto è osservabile, misurato', () => {
  /**
   * ─── PERCHE' QUESTO BLOCCO ESISTE ────────────────────────────────────────
   *
   * `moltiplicatori` spinge i suoi `push` nell'ordine delle due catene del
   * motore, e la ragione scritta accanto è che `chainMods` arrotonda a ogni
   * passo. Provando a INVERTIRE quell'ordine, però, nessun caso qui sopra
   * diventa rosso — e una precauzione che nessun test può falsificare è una
   * precauzione di cui non si sa se serve.
   *
   * E la misura c'era già, scritta in `lib/modifiers.js` sopra `chainMods`:
   * con DUE modificatori l'ordine non cambia mai il risultato — `chainMods`
   * parte da 4096, il primo passo è esatto, resta un solo arrotondamento e la
   * moltiplicazione è commutativa. Da TRE in su gli arrotondamenti diventano
   * due e l'ordine conta, in poco meno di metà delle terne.
   *
   * I casi qui sotto la RIFANNO invece di citarla, perché una misura scritta
   * in un commento invecchia in silenzio: se un giorno `chainMods` smettesse
   * di arrotondare per strada, la ragione per copiare l'ordine dal motore
   * cadrebbe e nessuno lo saprebbe.
   *
   * E la colonna oggi ne può avere al massimo DUE: il campo abilità è uno — i
   * punti d, e, f del motore sono un `if / else if`, e le altre due voci
   * (Agguato, Grancasa) sono altre abilità ancora — e il campo strumento è
   * uno. Quindi al più un moltiplicatore da ciascuno.
   *
   * Cioè: l'ordine è GIUSTO e oggi non è osservabile. Resta scritto com'è
   * perché il giorno che una terza fonte entra — una casella di campo, un
   * alleato — comincia a contare, e a quel punto è già a posto. Questo test
   * dice perché nessun altro test lo prende.
   */
  it('con due modificatori l\'ordine non cambia mai il risultato', () => {
    // Tutte le coppie costruibili con le costanti di `MOD`, non un campione.
    const valori = Object.entries(MOD).filter(([k]) => k !== 'NEUTRO').map(([, v]) => v)
    expect(valori.length).toBeGreaterThan(10)
    for (const a of valori) {
      for (const b of valori) {
        expect(chainMods([a, b]), `${a} e ${b} scambiati danno numeri diversi`)
          .toBe(chainMods([b, a]))
      }
    }
  })

  it('con tre invece sì, e per questo l\'ordine resta quello del motore', () => {
    // La prova che la precauzione non è teorica: se questo diventasse verde
    // vorrebbe dire che `chainMods` ha smesso di arrotondare per strada, e la
    // ragione per copiare l'ordine dal motore cadrebbe.
    // 614 contro 615: un punto in virgola fissa, che sul danno vale qualche
    // punto — abbastanza da spostare un 2HKO.
    expect(chainMods([MOD.X0_25, MOD.X0_5, MOD.X1_2])).toBe(614)
    expect(chainMods([MOD.X1_2, MOD.X0_5, MOD.X0_25])).toBe(615)
  })
})

describe('i due confini, scritti come casi invece che come commenti', () => {
  it('quello che dipende dalla MOSSA non si vede', () => {
    // Erbaiuto e sorelle, Fire Mane, Affilato, Transistor, Bolla d'Acqua: un
    // numero solo sarebbe vero per una mossa e falso per le altre tre.
    const CHE_DIPENDONO_DALLA_MOSSA = [
      ['overgrow',  STAT_ATT], ['overgrow',  STAT_SPA],
      ['transistor', STAT_SPA],
      ['water-bubble', STAT_SPA],
      ['sharpness', STAT_ATT],
    ]
    for (const [abilita, statIdx] of CHE_DIPENDONO_DALLA_MOSSA) {
      const s = slot({ key: 'garchomp', ability: abilita, ps: 1 })
      expect(
        statMostrata(s, statIdx).modificata,
        `${abilita} è entrata nella colonna: dipende dalla mossa, il numero sarebbe falso per le altre tre`,
      ).toBe(false)
    }
  })

  it('e quello che dipende dall\'AVVERSARIO nemmeno', () => {
    // Le quattro Rovina abbassano la statistica di chi sta di fronte: la
    // colonna riceve un Pokémon solo. Stessa ragione di Intimidate.
    for (const [abilita, statIdx] of [['tablets-of-ruin', STAT_ATT], ['sword-of-ruin', STAT_DEF]]) {
      const s = slot({ key: 'garchomp', ability: abilita })
      expect(
        statMostrata(s, statIdx).modificata,
        `${abilita} è entrata nella colonna: descrive l'avversario, non chi la porta`,
      ).toBe(false)
    }
  })
})
