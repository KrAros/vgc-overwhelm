// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/verdettoKO.test.js
 *
 * Il verdetto di KO, in tre stati invece di due.
 *
 * ─── IL DIFETTO C'ERA GIÀ, E A VITA PIENA ──────────────────────────────────
 *
 * La matrice colorava una cella «KO» con `maxPct >= 100`, cioè «il tiro
 * MIGLIORE uccide». Una mossa che fa 40–105% e una che ne fa 100–120% avevano
 * lo stesso colore: la prima uccide in un caso su sedici, la seconda sempre.
 *
 * Non è nato coi punti salute. Loro lo rendono solo più grosso — abbassando la
 * soglia, quasi tutto attraversa il 100% e il colore diventa rumore — ma la
 * correzione si può fare e verificare senza toccarli, ed è il motivo per cui
 * è un commit suo.
 *
 * ─── E IL CONFRONTO NON È PIÙ CON UNA PERCENTUALE ──────────────────────────
 *
 * La percentuale resta sul MASSIMO: il danno è una proprietà del colpo e va
 * confrontato fra celle diverse. Il KO è una proprietà della situazione e
 * guarda quanti punti salute restano. Sono due domande, e `maxPct >= 100`
 * risponde a quella sbagliata appena `defPS` è diverso da `defHP`.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'
import { verdettoKO } from '../lib/damage.js'
import { readFileSync } from 'node:fs'
import it_ from '../locales/it.json' with { type: 'json' }
import en from '../locales/en.json' with { type: 'json' }

const att = (specie, extra = {}) => ({
  atkPokemon: specie, atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'adamant',
  atkAbility: null, atkItem: null, level: 50, atkAbilityFlags: {}, ...extra,
})
const dif = (specie, extra = {}) => ({
  defPokemon: specie, defSPs: [0, 0, 0, 0, 0, 0], defNature: null,
  defAbility: null, defItem: null, defBoost: 0, spDefBoost: 0,
  defAbilityFlags: {}, ...extra,
})
const calc = (a, d, move) => calculateDamage({ attacker: a, defender: d, move, field: {} })

// ═══════════════════════════════════════════════════════════════════════════
// 1. I tre stati
// ═══════════════════════════════════════════════════════════════════════════

describe('i tre stati', () => {
  const finto = (min, max, ps) => ({
    rolls: [min, max], minDmg: min, maxDmg: max, defHP: ps, defPS: ps, colpi: 1,
  })

  it('certo quando anche il tiro PEGGIORE basta', () => {
    const v = verdettoKO(finto(100, 120, 100))
    expect(v.stato).toBe('certo')
    expect(v.probabilita).toBe(1)
  })

  it('niente quando nemmeno il migliore basta', () => {
    expect(verdettoKO(finto(40, 99, 100)).stato).toBe('no')
  })

  it('possibile in mezzo, con la probabilità', () => {
    // Due tiri, uno uccide e uno no: mezzo.
    const v = verdettoKO(finto(40, 105, 100))
    expect(v.stato).toBe('possibile')
    expect(v.probabilita).toBe(0.5)
  })

  it('e i due casi che PRIMA erano lo stesso colore adesso non lo sono', () => {
    // È il difetto, detto come fatto rosso-o-verde: 40–105% e 100–120%
    // avevano tutt'e due `maxPct >= 100`.
    expect(verdettoKO(finto(40, 105, 100)).stato)
      .not.toBe(verdettoKO(finto(100, 120, 100)).stato)
  })

  it('il confine è `>=`, non `>`', () => {
    // Un colpo che toglie esattamente i punti rimasti uccide.
    expect(verdettoKO(finto(100, 100, 100)).stato).toBe('certo')
    expect(verdettoKO(finto(99, 99, 100)).stato).toBe('no')
  })
})

describe('i casi che non sono un verdetto', () => {
  it('un\'immunità non è un KO mancato', () => {
    expect(verdettoKO({ immune: true, rolls: [], defHP: 100 }).stato).toBe('no')
  })

  it('e nemmeno un risultato che non c\'è', () => {
    expect(verdettoKO(null).stato).toBe('no')
    expect(verdettoKO({ rolls: [], minDmg: 0, maxDmg: 0, defHP: 100 }).stato).toBe('no')
  })

  it('con zero punti salute non si decide niente', () => {
    // Non è un caso reale, ed è la ragione per cui esce «no» invece di
    // dividere per zero più in basso.
    expect(verdettoKO({ rolls: [10], minDmg: 10, maxDmg: 10, defHP: 0, defPS: 0 }).stato).toBe('no')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Guarda i punti salute RESIDUI, non i massimi
// ═══════════════════════════════════════════════════════════════════════════

describe('il verdetto guarda quanto ne resta', () => {
  it('una mossa che non uccide a vita piena uccide a metà', () => {
    // Garchomp Terremoto su Amoonguss: 126–148 su 221 punti salute, cioè
    // nessun KO. A metà vita gli stessi tiri uccidono tutti.
    const a = att('garchomp')
    const pieno = calc(a, dif('amoonguss'), 'earthquake')
    expect(verdettoKO(pieno).stato).toBe('no')

    const meta = calc(a, dif('amoonguss', { defPS: Math.floor(pieno.defHP / 2) }), 'earthquake')
    expect(verdettoKO(meta).stato).not.toBe('no')
  })

  it('e la PERCENTUALE non si muove — è del massimo', () => {
    // La decisione presa: il danno è una proprietà del colpo, e due celle
    // devono restare confrontabili. Se questo diventa rosso, qualcuno ha
    // messo il residuo al denominatore.
    const a = att('garchomp')
    const pieno = calc(a, dif('amoonguss'), 'earthquake')
    const meta = calc(a, dif('amoonguss', { defPS: Math.floor(pieno.defHP / 2) }), 'earthquake')
    expect(meta.maxPct).toBe(pieno.maxPct)
    expect(meta.defHP).toBe(pieno.defHP)
    expect(meta.defPS).toBeLessThan(meta.defHP)
  })

  it('il caso in mezzo esiste già a vita piena', () => {
    // Garchomp Terremoto su Incineroar difensivo: 176–210 su 202 punti salute.
    // Alcuni tiri uccidono e altri no — ed è il caso che prima era colorato
    // come un KO certo. È il primo caso dello snapshot, con i suoi punti.
    const v = verdettoKO(calc(
      att('garchomp', { atkSPs: [0, 32, 0, 0, 0, 30] }),
      dif('incineroar', { defSPs: [32, 0, 18, 0, 16, 0], defNature: 'careful' }),
      'earthquake',
    ))
    expect(v.stato).toBe('possibile')
    expect(v.probabilita).toBeGreaterThan(0)
    expect(v.probabilita).toBeLessThan(1)
  })

  it('il residuo si può anche passare a mano', () => {
    const r = calc(att('garchomp'), dif('amoonguss'), 'earthquake')
    expect(verdettoKO(r).stato).toBe('no')
    expect(verdettoKO(r, 1).stato).toBe('certo')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. La probabilità non è una stima
// ═══════════════════════════════════════════════════════════════════════════

describe('la probabilità è esatta, non approssimata', () => {
  it('conta i tiri che bastano', () => {
    // Sedici tiri, quattro dei quali uccidono: un quarto.
    const rolls = [...Array(12).fill(90), ...Array(4).fill(110)]
    const v = verdettoKO({ rolls, minDmg: 90, maxDmg: 110, defHP: 100, defPS: 100, colpi: 1 })
    expect(v.stato).toBe('possibile')
    expect(v.probabilita).toBeCloseTo(0.25, 10)
  })

  it('e per le mosse multi-colpo non moltiplica: convolve', () => {
    // Due colpi da 40 o 60, su 100 punti salute. Le quattro combinazioni sono
    // 80, 100, 100, 120: tre uccidono, perché 100 esatti bastano. Tre quarti.
    //
    // Il numero l'ha corretto questo test: avevo scritto un quarto, contando
    // solo 60+60 e dimenticando che il confine è `>=`. Un motore che sommasse
    // gli estremi direbbe «da 80 a 120» e da lì non si ricava.
    const rolls = [40, 60]
    const v = verdettoKO({ rolls, minDmg: 80, maxDmg: 120, defHP: 100, defPS: 100, colpi: 2 })
    expect(v.stato).toBe('possibile')
    expect(v.probabilita).toBeCloseTo(0.75, 10)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Nella cella: tre stati che si leggono anche in bianco e nero
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── PERCHE' UN TEST SUL SORGENTE ──────────────────────────────────────────
 *
 * Perché ciò che si sorveglia È una proprietà del sorgente: che i tre stati
 * non siano distinti dal SOLO colore. La matrice è densa e il progetto ha dei
 * test di accessibilità; tre sfumature di rosso non le passerebbero, e non le
 * supererebbe nemmeno chi il rosso dall'ambra non lo distingue.
 *
 * È lo stesso schema di `riquadroAbilita.test.js` e del segnalino sulla mossa.
 */
describe('la cella distingue i tre stati con una forma, non con un colore', () => {
  const sorgente = readFileSync(
    new URL('../components/DamageTable.jsx', import.meta.url), 'utf8')

  it('«KO» e «KO?» sono due testi diversi', () => {
    expect(sorgente).toContain("'KO' : 'KO?'")
  })

  it('e il verdetto arriva al nome accessibile, non solo al colore', () => {
    // Un colore che uno screen reader non legge è un'informazione che non
    // c'è. La frase è la stessa del `title`, composta in un posto solo.
    expect(sorgente).toContain('etichettaKO(t, ko)')
    const ariaLabel = sorgente.slice(sorgente.indexOf('aria-label={d'), sorgente.indexOf('className={`p-1 text-center'))
    expect(ariaLabel).toContain('etichettaKO')
  })

  it('le due frasi esistono in tutt\'e due le lingue', () => {
    for (const [lingua, dizionario] of [['it', it_], ['en', en]]) {
      expect(dizionario.ui?.ko_certo, `${lingua}: manca ko_certo`).toBeTruthy()
      expect(dizionario.ui?.ko_possibile, `${lingua}: manca ko_possibile`).toBeTruthy()
      expect(dizionario.ui.ko_possibile, `${lingua}: la frase non dice la probabilità`)
        .toContain('{{pct}}')
    }
  })
})
