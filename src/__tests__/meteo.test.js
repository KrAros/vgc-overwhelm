/**
 * src/__tests__/meteo.test.js
 *
 * Sessione D — il meteo estremo.
 *
 * ─── PERCHÉ SERVE UN FILE A PARTE ──────────────────────────────────────────
 * I due casi di annullamento (Acqua sotto Sole Estremo, Fuoco sotto Pioggia
 * Intensa) NON sono più coperti dai golden, e non per una svista: appena il
 * motore ha smesso di sbagliare, i due casi sono usciti dalla fixture ed è
 * entrati fra gli "esclusi", nella categoria «entrambi i motori danno colpo
 * nullo — niente da confrontare».
 *
 * È corretto come regola di generazione — confrontare zero con zero non
 * dimostra niente — ma lascia scoperta proprio la correzione appena fatta:
 * se domani togliessimo l'immunità, nessun golden diventerebbe rosso, perché
 * il caso non è più un golden. Questi test riempiono quel buco verificando
 * la REGOLA («la mossa fallisce e il motivo è il meteo») invece del NUMERO.
 *
 * Il boost del ×1.5 invece resta coperto dai golden 021/022/026/027 e dai
 * due Weather Ball, che dopo questa sessione sono tornati concordi.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'

// Charizard e Blastoise: uno porta Fuoco, l'altro Acqua, nessuno dei due è
// immune all'altro per tipo. Così un risultato `immune` può venire solo dal
// meteo, mai da una coincidenza di tipi.
const CHARIZARD = {
  atkPokemon: 'charizard', atkSPs: [0, 0, 0, 32, 0, 0], atkNature: 'hardy',
  atkAbility: null, atkItem: null, level: 50,
}
const BLASTOISE = {
  atkPokemon: 'blastoise', atkSPs: [0, 0, 0, 32, 0, 0], atkNature: 'hardy',
  atkAbility: null, atkItem: null, level: 50,
}
const DIF_CHARIZARD = {
  defPokemon: 'charizard', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy',
  defAbility: null, defItem: null,
}
const DIF_BLASTOISE = {
  defPokemon: 'blastoise', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy',
  defAbility: null, defItem: null,
}

const calcola = (attacker, defender, move, weather) =>
  calculateDamage({ attacker, defender, move, field: { weather }, debug: false })

describe('meteo estremo — annullamento', () => {
  it('la Pioggia Intensa annulla le mosse Fuoco', () => {
    const r = calcola(CHARIZARD, DIF_BLASTOISE, 'flamethrower', 'heavy rain')
    expect(r.immune).toBe(true)
    expect(r.reason).toBe('weather')
    expect(r.maxDmg).toBe(0)
  })

  it('il Sole Estremo annulla le mosse Acqua', () => {
    const r = calcola(BLASTOISE, DIF_CHARIZARD, 'surf', 'harsh sunshine')
    expect(r.immune).toBe(true)
    expect(r.reason).toBe('weather')
    expect(r.maxDmg).toBe(0)
  })

  it('annulla solo il tipo opposto: sotto Pioggia Intensa l\'Acqua passa', () => {
    const r = calcola(BLASTOISE, DIF_CHARIZARD, 'surf', 'heavy rain')
    expect(r.immune).toBeUndefined()
    expect(r.maxDmg).toBeGreaterThan(0)
  })

  it('annulla solo il tipo opposto: sotto Sole Estremo il Fuoco passa', () => {
    const r = calcola(CHARIZARD, DIF_BLASTOISE, 'flamethrower', 'harsh sunshine')
    expect(r.immune).toBeUndefined()
    expect(r.maxDmg).toBeGreaterThan(0)
  })

  it('il meteo normale dimezza e NON annulla', () => {
    const pioggia = calcola(CHARIZARD, DIF_BLASTOISE, 'flamethrower', 'rain')
    const asciutto = calcola(CHARIZARD, DIF_BLASTOISE, 'flamethrower', null)
    expect(pioggia.immune).toBeUndefined()
    expect(pioggia.maxDmg).toBeGreaterThan(0)
    expect(pioggia.maxDmg).toBeLessThan(asciutto.maxDmg)
  })
})

describe('meteo estremo — potenziamento', () => {
  it('la Pioggia Intensa potenzia l\'Acqua come la pioggia normale', () => {
    const estrema = calcola(BLASTOISE, DIF_CHARIZARD, 'surf', 'heavy rain')
    const normale = calcola(BLASTOISE, DIF_CHARIZARD, 'surf', 'rain')
    expect(estrema.rolls).toEqual(normale.rolls)
  })

  it('il Sole Estremo potenzia il Fuoco come il sole normale', () => {
    const estremo = calcola(CHARIZARD, DIF_BLASTOISE, 'flamethrower', 'harsh sunshine')
    const normale = calcola(CHARIZARD, DIF_BLASTOISE, 'flamethrower', 'sun')
    expect(estremo.rolls).toEqual(normale.rolls)
  })

  it('il potenziamento è un aumento vero rispetto al meteo assente', () => {
    const conSole = calcola(CHARIZARD, DIF_BLASTOISE, 'flamethrower', 'harsh sunshine')
    const senza   = calcola(CHARIZARD, DIF_BLASTOISE, 'flamethrower', null)
    expect(conSole.minDmg).toBeGreaterThan(senza.minDmg)
  })
})

describe('meteo estremo — Weather Ball', () => {
  it('sotto Pioggia Intensa diventa Acqua e riceve il ×1.5', () => {
    const estrema = calcola(CHARIZARD, DIF_CHARIZARD, 'weather ball', 'heavy rain')
    const normale = calcola(CHARIZARD, DIF_CHARIZARD, 'weather ball', 'rain')
    expect(estrema.rolls).toEqual(normale.rolls)
  })

  it('sotto Sole Estremo diventa Fuoco: non è mai annullata dal proprio meteo', () => {
    const r = calcola(CHARIZARD, DIF_BLASTOISE, 'weather ball', 'harsh sunshine')
    expect(r.immune).toBeUndefined()
    expect(r.maxDmg).toBeGreaterThan(0)
  })
})
