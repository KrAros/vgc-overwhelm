import { describe, it, expect } from 'vitest'
import { chainMods, pokeRound, daDecimale, MOD, FIXED_POINT } from '../lib/modifiers.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'

/**
 * Test dell'aritmetica in virgola fissa introdotta in D-2.
 *
 * Verificano REGOLE, non numeri di danno: restano validi anche se domani
 * cambiano le stat base o si aggiunge un'abilità. I numeri di danno sono
 * coperti altrove (snapshot e golden NCP).
 */

describe('pokeRound — l\'arrotondamento di Game Freak', () => {
  it('a esattamente 0.5 arrotonda verso il BASSO, al contrario di Math.round', () => {
    expect(pokeRound(45.5)).toBe(45)
    expect(Math.round(45.5)).toBe(46)   // la differenza è questa
  })

  it('sopra 0.5 arrotonda verso l\'alto', () => {
    expect(pokeRound(45.6)).toBe(46)
    expect(pokeRound(45.51)).toBe(46)
  })

  it('sotto 0.5 arrotonda verso il basso', () => {
    expect(pokeRound(45.49)).toBe(45)
    expect(pokeRound(45)).toBe(45)
  })
})

describe('chainMods — concatenazione dei modificatori', () => {
  it('senza modificatori restituisce il neutro', () => {
    expect(chainMods([])).toBe(FIXED_POINT)
  })

  it('con un solo modificatore restituisce quel modificatore', () => {
    expect(chainMods([MOD.X1_5])).toBe(MOD.X1_5)
    expect(chainMods([MOD.X0_5])).toBe(MOD.X0_5)
    expect(chainMods([MOD.X2])).toBe(MOD.X2)
  })

  it('salta i modificatori neutri invece di moltiplicarli', () => {
    // Moltiplicare per 4096/4096 sembra innocuo ma introduce un
    // arrotondamento in più. NCP li salta, e noi con lui.
    expect(chainMods([MOD.NEUTRO, MOD.X1_3, MOD.NEUTRO])).toBe(chainMods([MOD.X1_3]))
  })

  it('×2 seguito da ×1.5 dà esattamente ×3', () => {
    // È la catena di difesa: Fur Coat + Eviolite.
    expect(chainMods([MOD.X2, MOD.X1_5])).toBe(3 * FIXED_POINT)
  })

  it('×1.5 seguito da ×0.5 dà esattamente ×0.75', () => {
    expect(chainMods([MOD.X1_5, MOD.X0_5])).toBe(MOD.X0_75)
  })

  it('con DUE modificatori l\'ordine non conta MAI', () => {
    // Misurato su tutte le 81 coppie costruibili con le costanti di MOD:
    // zero sensibili all'ordine. Non è un caso fortunato, è una proprietà
    // dell'arrotondamento su M quando i passi sono due.
    const vals = Object.values(MOD).filter(v => v !== FIXED_POINT)
    const sensibili = []
    for (const a of vals) for (const b of vals) {
      if (chainMods([a, b]) !== chainMods([b, a])) sensibili.push([a, b])
    }
    expect(sensibili).toEqual([])
  })

  it('da TRE modificatori in su l\'ordine può contare', () => {
    // Qui invece succede: 279 terne su 729 danno risultati diversi a
    // seconda dell'ordine (sempre di una unità su M).
    //
    // ─── CORREZIONE AL PIANO ─────────────────────────────────────────────
    // Il piano di D-2 dava l'ordine dei push per «vincolante» dentro ogni
    // catena. È vero solo da tre modificatori in su, e NESSUNA delle terne
    // che il motore sa produrre oggi è sensibile all'ordine — verificato su
    // schermo+Multiscale+Life Orb, Multiscale+Fluffy+Life Orb,
    // Filter+Life Orb+bacca, ate+Tough Claws+Helping Hand.
    //
    // L'ordine copiato da NCP resta comunque quello giusto da tenere: serve
    // quando arriveranno Expert Belt, Friend Guard, Punk Rock e Neuroforce,
    // che allargano le catene oltre i tre elementi.
    expect(chainMods([MOD.X0_5, MOD.X0_5, MOD.X1_1]))
      .not.toBe(chainMods([MOD.X0_5, MOD.X1_1, MOD.X0_5]))
  })
})

describe('chainMods contro il vecchio troncamento sequenziale', () => {
  // Il cuore di D-2: le due formule NON sono equivalenti.
  const sequenziale = (v, mults) => mults.reduce((x, m) => Math.floor(x * m), v)
  const concatenato = (v, mods) => pokeRound(v * chainMods(mods) / FIXED_POINT)

  it('con UN modificatore le due formule coincidono quasi sempre', () => {
    let diverse = 0
    for (let v = 50; v <= 250; v++) {
      if (sequenziale(v, [1.5]) !== concatenato(v, [MOD.X1_5])) diverse++
    }
    expect(diverse).toBe(0)
  })

  it('con DUE modificatori divergono, ed è il motivo per cui esiste questa sessione', () => {
    let diverse = 0
    for (let v = 50; v <= 250; v++) {
      if (sequenziale(v, [1.5, 0.5]) !== concatenato(v, [MOD.X0_5, MOD.X1_5])) diverse++
    }
    expect(diverse).toBeGreaterThan(0)
  })

  it('il ×1.3 diverge anche da solo, sulle potenze che finiscono per 5', () => {
    // Il piano prevedeva che solo i casi a >=2 modificatori cambiassero.
    // Non è vero: floor e pokeRound si separano quando il prodotto cade
    // esattamente su .5, cioè per potenza 45, 55, 65, 75, 85, 95…
    expect(Math.floor(75 * 1.3)).toBe(97)
    expect(concatenato(75, [MOD.X1_3])).toBe(98)
  })
})

describe('daDecimale — conversione sicura dei moltiplicatori decimali', () => {
  it('converte i valori esattamente rappresentabili', () => {
    expect(daDecimale(1.5)).toBe(MOD.X1_5)
    expect(daDecimale(2)).toBe(MOD.X2)
    expect(daDecimale(0.5)).toBe(MOD.X0_5)
  })

  it('esplode sui valori NON rappresentabili invece di sbagliare in silenzio', () => {
    // 1.1 × 4096 = 4505.6. Il valore giusto dipende dalla costante che usa
    // il gioco (4505 per Muscle Band, 4506 per Punching Glove) e non è
    // deducibile dal decimale.
    expect(() => daDecimale(1.1)).toThrow(/non rappresentabile/)
    expect(() => daDecimale(1.2)).toThrow(/non rappresentabile/)
  })
})

describe('guardie sui dati — daDecimale non deve mai esplodere a runtime', () => {
  // `daDecimale` è chiamata dentro il percorso caldo del motore. Se qualcuno
  // aggiungesse `atkMult: 1.15` a un item, l'app crasherebbe sulla tabella
  // danni. Questi test spostano quell'errore da runtime a CI.

  it('ogni moltiplicatore decimale negli item è esattamente rappresentabile', () => {
    const colpevoli = []
    for (const [nome, e] of Object.entries(ITEM_EFFECTS)) {
      for (const campo of ['atkMult', 'defMult', 'spdMult']) {
        if (e[campo] === undefined) continue
        if (!Number.isInteger(e[campo] * FIXED_POINT)) colpevoli.push(`${nome}.${campo} = ${e[campo]}`)
      }
    }
    expect(colpevoli).toEqual([])
  })

  it('ogni moltiplicatore decimale nelle abilità è esattamente rappresentabile', () => {
    const colpevoli = []
    for (const [nome, e] of Object.entries(ABILITY_EFFECTS)) {
      if (e.atkMult === undefined) continue
      if (!Number.isInteger(e.atkMult * FIXED_POINT)) colpevoli.push(`${nome}.atkMult = ${e.atkMult}`)
    }
    expect(colpevoli).toEqual([])
  })

  it('ogni bpMod e finalMod è un intero in virgola fissa plausibile', () => {
    const colpevoli = []
    for (const [nome, e] of Object.entries(ITEM_EFFECTS)) {
      for (const campo of ['bpMod', 'finalMod']) {
        const v = e[campo]
        if (v === undefined) continue
        if (!Number.isInteger(v) || v < 0x400 || v > 0x4000) colpevoli.push(`${nome}.${campo} = ${v}`)
      }
    }
    expect(colpevoli).toEqual([])
  })

  it('gli item type-boost hanno sia il tipo che il modificatore', () => {
    // Un `typBoost` senza `bpMod` sarebbe un item che non fa niente pur
    // sembrando configurato. È esattamente il genere di gap che la
    // sessione F andrà a marcare nell'interfaccia.
    const colpevoli = []
    for (const [nome, e] of Object.entries(ITEM_EFFECTS)) {
      if (e.typBoost !== undefined && e.bpMod === undefined) colpevoli.push(nome)
    }
    expect(colpevoli).toEqual([])
  })

  it('Muscle Band e Punching Glove usano costanti DIVERSE', () => {
    // Stesso ×1.1 nominale, due costanti nel gioco. Se qualcuno le
    // "uniformasse" per pulizia, questo test lo ferma.
    expect(ITEM_EFFECTS['muscle band'].bpMod).toBe(0x1199)
    expect(ITEM_EFFECTS['punching glove'].bpMod).toBe(0x119A)
    expect(ITEM_EFFECTS['muscle band'].bpMod).not.toBe(ITEM_EFFECTS['punching glove'].bpMod)
  })

  it('il Life Orb è 0x14CC, non ×1.3', () => {
    expect(ITEM_EFFECTS['life orb'].finalMod).toBe(0x14CC)
    expect(ITEM_EFFECTS['life orb'].finalMod).not.toBe(Math.round(1.3 * FIXED_POINT))
  })
})
