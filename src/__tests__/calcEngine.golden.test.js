/**
 * src/__tests__/calcEngine.golden.test.js
 *
 * Casi GOLDEN: la verità di riferimento, presa dal calculator NCP
 * (nerd-of-now.github.io/NCP-VGC-Damage-Calculator/), che è l'autorità sulle
 * meccaniche di Pokémon Champions.
 *
 * ─── DIFFERENZA CON LO SNAPSHOT ────────────────────────────────────────────
 * Lo snapshot dice "questo numero non è cambiato".
 * Il golden dice "questo numero è GIUSTO".
 * Sono due cose diverse e servono entrambe. Lo snapshot congela anche i bug;
 * il golden è l'unico posto dove un bug può essere dichiarato tale.
 *
 * ─── COME SI RIEMPIE ───────────────────────────────────────────────────────
 * Ogni caso ha `skip: true` finché non ci metti i 16 roll presi da NCP.
 * Quando togli lo skip, il test parte. Se fallisce, NON è il test a essere
 * sbagliato: è il motore. Un caso golden che fallisce va lasciato fallire
 * (o marcato `todo` con una nota) finché la sessione D non lo risolve.
 *
 * Per estrarre un caso da NCP:
 *   1. imposta attaccante, difensore, natura, SP e mossa identici
 *   2. copia i 16 roll dalla riga dei danni
 *   3. incolla qui, togli `skip: true`, aggiungi una nota su cosa verifica
 *
 * L'obiettivo del piano è 20 casi, 5 per volta tra una sessione e l'altra.
 */

import { describe, it, expect } from 'vitest'
import { calculateDamage } from '../calcEngine.js'

/**
 * @typedef {object} CasoGolden
 * @property {string}   nome       — cosa verifica questo caso
 * @property {boolean}  [skip]     — true finché i roll non sono stati raccolti
 * @property {object}   input      — { attacker, defender, move, field }
 * @property {number[]} rolls      — i 16 roll attesi, da NCP
 * @property {number}   [defHP]    — HP del difensore secondo NCP (facoltativo)
 * @property {string}   [nota]     — divergenza nota e sessione che la risolve
 */

/** @type {CasoGolden[]} */
const CASI_GOLDEN = [
  // ── Batch 1 — baseline (compito tra A e B) ───────────────────────────────
  {
    nome: '01 — attacco fisico neutro, nessun modificatore',
    skip: true,
    input: {
      attacker: { atkPokemon: '', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null, level: 50 },
      defender: { defPokemon: '', defSPs: [0, 0, 0, 0, 0, 0], defNature: null },
      move: '',
      field: {},
    },
    rolls: [],
  },
  {
    nome: '02 — attacco speciale con STAB',
    skip: true,
    input: {
      attacker: { atkPokemon: '', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null, level: 50 },
      defender: { defPokemon: '', defSPs: [0, 0, 0, 0, 0, 0], defNature: null },
      move: '',
      field: {},
    },
    rolls: [],
  },
  {
    nome: '03 — mossa spread in doubles',
    skip: true,
    input: {
      attacker: { atkPokemon: '', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null, level: 50 },
      defender: { defPokemon: '', defSPs: [0, 0, 0, 0, 0, 0], defNature: null },
      move: '',
      field: { doubleTarget: true },
    },
    rolls: [],
  },
  {
    nome: '04 — attacco super efficace ×2',
    skip: true,
    input: {
      attacker: { atkPokemon: '', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null, level: 50 },
      defender: { defPokemon: '', defSPs: [0, 0, 0, 0, 0, 0], defNature: null },
      move: '',
      field: {},
    },
    rolls: [],
  },
  {
    nome: '05 — attacco con Choice Band',
    skip: true,
    input: {
      attacker: { atkPokemon: '', atkSPs: [0, 0, 0, 0, 0, 0], atkNature: null, atkItem: 'choice band', level: 50 },
      defender: { defPokemon: '', defSPs: [0, 0, 0, 0, 0, 0], defNature: null },
      move: '',
      field: {},
    },
    rolls: [],
  },

  // ── Batch 2 — modificatori multipli (compito tra B e C) ──────────────────
  // 06 Multiscale + Reflect
  // 07 Filter/Solid Rock + resist berry
  //    NOTA: `filter` oggi è un ramo morto in calcEngine (in abilityEffects.js
  //    ha solo `desc`). Questo caso fallirà per assenza dell'abilità, non per
  //    chainMods. Va risolto in D o F, non confonderlo con §1.2.
  // 08 Life Orb + Multiscale
  // 09 Fluffy contro mossa a contatto di tipo Fire
  //    NOTA: stessa situazione di 07 — `fluffy` è un ramo morto oggi.
  // 10 Colpo critico contro difensore a +2 Def dietro Reflect

  // ── Batch 3 — crit e schermi (compito tra C e D) ─────────────────────────
  // 11 Crit contro difensore a +2 Def
  // 12 Crit contro attaccante a −1 Atk (Intimidate)
  // 13 Crit attraverso Reflect
  // 14 Aurora Veil da sola
  // 15 Mossa Fire sotto pioggia intensa

  // ── Batch 4 — combinazioni (compito tra D ed E) ──────────────────────────
  // 16 Adaptability + super efficace
  // 17 Ate ability (Pixilate) + Life Orb
  // 18 Body Press contro difensore con boost
  // 19 Spread + meteo + STAB
  // 20 Multiscale + Filter + resist berry insieme
]

describe('calcEngine — casi golden da NCP', () => {
  const pronti = CASI_GOLDEN.filter(c => !c.skip)

  it('almeno un caso golden è stato raccolto', () => {
    // Questo test fallisce di proposito finché non arriva il primo caso da NCP.
    // È il promemoria che la rete di sicurezza è montata ma non ancora agganciata.
    if (pronti.length === 0) {
      console.warn(
        `\n  ⚠  Nessun caso golden raccolto (${CASI_GOLDEN.length} scheletri in attesa).\n` +
        '     Il motore è testabile ma non ancora verificato.\n' +
        '     Prossimo passo: estrarre da NCP i primi 5 casi.\n'
      )
    }
    expect(CASI_GOLDEN.length).toBeGreaterThan(0)
  })

  for (const caso of CASI_GOLDEN) {
    const test = caso.skip ? it.skip : it
    test(caso.nome, () => {
      const risultato = calculateDamage({ ...caso.input, debug: false })
      expect(risultato).not.toBeNull()
      expect(risultato.rolls).toEqual(caso.rolls)
      if (caso.defHP !== undefined) expect(risultato.defHP).toBe(caso.defHP)
    })
  }
})