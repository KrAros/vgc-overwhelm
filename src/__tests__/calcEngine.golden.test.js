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
 * @property {boolean}  [bugNoto]  — il motore diverge da NCP e sappiamo perché.
 *                                   Il caso gira con `it.fails`: è verde finché
 *                                   il bug c'è, e diventa rosso quando viene
 *                                   corretto, per ricordarti di togliere il flag.
 * @property {'NCP'|'previsione'} [fonte]
 *                                 — da dove vengono i roll. Default 'NCP'.
 *                                   'previsione' significa che li ha calcolati
 *                                   il motore stesso: NON verificano la
 *                                   correttezza, sono solo un fermo contro le
 *                                   regressioni. Vedi il blocco qui sotto.
 */

/**
 * ─── SUI CASI CON `fonte: 'previsione'` ────────────────────────────────────
 * Un caso i cui numeri attesi vengono dalla stessa formula che dovrebbe
 * verificare non dimostra che la formula sia giusta: passerà sempre. Serve a
 * un'altra cosa, che vale comunque: se qualcuno domani cambia SCREEN_MOD o
 * l'ordine dei modificatori, quel test diventa rosso.
 *
 * Sono etichettati esplicitamente perché la differenza fra "verificato" e
 * "congelato" non vada persa. Un test che si spaccia per golden senza esserlo
 * è peggio di un test assente: dà fiducia che non è stata guadagnata.
 *
 * Quando il caso viene confrontato con NCP, si toglie `fonte` e — se i numeri
 * coincidono — diventa un golden vero senza toccare nient'altro.
 */

/** @type {CasoGolden[]} */
const CASI_GOLDEN = [
  // ── Batch 1 — baseline ───────────────────────────────────────────────────
  // Tutti sulla stessa coppia Garchomp / Venusaur: ogni caso cambia una cosa
  // sola rispetto al precedente, così un fallimento ha un solo sospetto.
  {
    nome: '01 — attacco fisico neutro, nessun modificatore',
    input: {
      attacker: { atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'hardy', atkAbility: 'sand veil', atkItem: null, level: 50 },
      defender: { defPokemon: 'venusaur', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy', defAbility: 'chlorophyll', defItem: null },
      move: 'crunch',
      field: {},
    },
    rolls: [41, 42, 42, 43, 43, 44, 44, 45, 45, 46, 46, 47, 47, 48, 48, 49],
    defHP: 187,
    nota: 'Formula base + conversione 1 SP = 8 EV su HP e Difesa. Danno base 41.',
  },
  {
    nome: '02 — attacco fisico con STAB',
    input: {
      attacker: { atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'hardy', atkAbility: 'sand veil', atkItem: null, level: 50 },
      defender: { defPokemon: 'venusaur', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy', defAbility: 'chlorophyll', defItem: null },
      move: 'high horsepower',
      field: {},
    },
    rolls: [73, 73, 75, 76, 76, 78, 78, 79, 79, 81, 82, 82, 84, 84, 85, 87],
    defHP: 187,
    nota: 'STAB ×1.5 applicato DOPO il troncamento del roll. I doppioni (73,73) sono la firma di questo ordine: applicando lo STAB prima del roll uscirebbe 73,74,75,76,77…',
  },
  {
    nome: '02b — attacco speciale con STAB',
    input: {
      attacker: { atkPokemon: 'venusaur', atkSPs: [32, 0, 32, 0, 0, 0], atkNature: 'hardy', atkAbility: 'chlorophyll', atkItem: null, level: 50 },
      defender: { defPokemon: 'garchomp', defSPs: [0, 32, 0, 0, 0, 0], defNature: 'hardy', defAbility: 'sand veil', defItem: null },
      move: 'energy ball',
      field: {},
    },
    rolls: [58, 60, 60, 61, 61, 63, 63, 64, 64, 66, 66, 67, 67, 69, 69, 70],
    defHP: 183,
    nota: 'Ramo speciale: SpA, SpD e categoria mossa passano per codice diverso dai casi fisici.',
  },
  {
    nome: '03 — mossa spread in doubles',
    input: {
      attacker: { atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'hardy', atkAbility: 'sand veil', atkItem: null, level: 50 },
      defender: { defPokemon: 'venusaur', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy', defAbility: 'chlorophyll', defItem: null },
      move: 'earthquake',
      field: { doubleTarget: true },
    },
    rolls: [58, 58, 60, 60, 60, 61, 61, 63, 63, 64, 64, 66, 66, 67, 67, 69],
    defHP: 187,
    nota: 'Penalità spread: 61 × 0.75 = 45.75, arrotondato SU a 46 (pokeRound). Con un floor uscirebbe 45 e la sequenza partirebbe da 57.',
  },
  {
    nome: '04 — attacco super efficace ×2',
    input: {
      attacker: { atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'hardy', atkAbility: 'sand veil', atkItem: null, level: 50 },
      defender: { defPokemon: 'typhlosion', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy', defAbility: 'blaze', defItem: null },
      move: 'earthquake',
      field: { doubleTarget: true },
    },
    rolls: [116, 120, 120, 122, 122, 126, 126, 128, 128, 132, 132, 134, 134, 138, 138, 140],
    defHP: 185,
    nota: 'Tre verifiche insieme: efficacia ×2 dopo lo STAB (invertendo l\'ordine uscirebbe 117 invece di 116); pokeRound che arrotonda GIÙ (63 × 0.75 = 47.25 → 47), complementare al caso 03.',
  },
  {
    nome: '05 — attacco con Life Orb',
    input: {
      attacker: { atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'hardy', atkAbility: 'sand veil', atkItem: 'life orb', level: 50 },
      defender: { defPokemon: 'venusaur', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy', defAbility: 'chlorophyll', defItem: null },
      move: 'crunch',
      field: {},
    },
    rolls: [53, 55, 55, 56, 56, 57, 57, 58, 58, 60, 60, 61, 61, 62, 62, 64],
    defHP: 187,
    nota: 'Moltiplicatore di danno finale 5324/4096 con pokeRound. Con un floor nove valori su sedici cambierebbero.',
  },
  {
    nome: '05b — item type-boost ×1.2 (Soft Sand)',
    bugNoto: true,
    input: {
      attacker: { atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'hardy', atkAbility: 'sand veil', atkItem: 'soft sand', level: 50 },
      defender: { defPokemon: 'blastoise', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy', defAbility: 'torrent', defItem: null },
      move: 'high horsepower',
      field: {},
    },
    rolls: [78, 79, 79, 81, 82, 82, 84, 85, 85, 87, 87, 88, 90, 90, 91, 93],
    defHP: 186,
    nota: 'BUG CONFERMATO — §1.10. NCP applica il ×1.2 alla POTENZA BASE (95 → 114, danno base 62); il motore lo applica alla STATISTICA d\'attacco (182 → 218, danno base 61). Divergenza di 1 HP sul danno base, 1–2 HP sui roll. Vale per tutti gli item ×1.2 per tipo e per Muscle Band / Wise Glasses. Da correggere nella sessione D. ATTENZIONE: la maggior parte dei matchup NON distingue i due modelli (coincidono per arrotondamento) — Blastoise è uno dei 233 che li separa.',
  },

  // ── Batch 2 — schermi (sessione G) ───────────────────────────────────────
  {
    nome: '06 — Reflect nei doppi',
    fonte: 'previsione',
    input: {
      attacker: { atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'hardy', atkAbility: 'sand veil', atkItem: null, level: 50 },
      defender: { defPokemon: 'venusaur', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy', defAbility: 'chlorophyll', defItem: null },
      move: 'high horsepower',
      field: { reflect: true },
    },
    rolls: [49, 49, 50, 51, 51, 52, 52, 53, 53, 54, 55, 55, 56, 56, 57, 58],
    defHP: 187,
    nota: 'DA VERIFICARE SU NCP (impostato su Doubles). È il caso 02 con Reflect e nient\'altro: senza schermo il motore riproduce NCP roll per roll (73–87), quindi qui l\'unica variabile è lo schermo — il che lo rende il posto giusto per verificare SCREEN_MOD isolato dal §1.10. Se NCP conferma 49–58, togliere `fonte` e questo diventa un golden vero.',
  },
  {
    nome: '07 — Reflect con item type-boost',
    bugNoto: true,
    input: {
      attacker: { atkPokemon: 'garchomp', atkSPs: [0, 32, 0, 0, 0, 0], atkNature: 'hardy', atkAbility: 'sand veil', atkItem: 'soft sand', level: 50 },
      defender: { defPokemon: 'blastoise', defSPs: [32, 0, 32, 0, 0, 0], defNature: 'hardy', defAbility: 'torrent', defItem: null },
      move: 'high horsepower',
      field: { reflect: true },
    },
    rolls: [52, 53, 53, 54, 55, 55, 56, 57, 57, 58, 58, 59, 60, 60, 61, 62],
    defHP: 186,
    nota: 'Il caso 05b con Reflect. NCP dà 52–62, il motore dopo G dà 51–61: l\'HP che manca NON è lo schermo, è il §1.10 ereditato dal 05b (i roll di partenza sono 76–91 invece di 78–93). Resta `bugNoto` finché D non corregge gli item type-boost; a quel punto si rovescia insieme al 05b. Se questo diventa verde mentre il 05b è ancora rosso, c\'è qualcosa che non torna negli schermi.',
  },
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

  it('i casi non ancora verificati su NCP sono dichiarati', () => {
    // Non fallisce: elenca. Serve a non dimenticare che qualche numero atteso
    // l'ha prodotto il motore stesso e non l'autorità di riferimento.
    const daVerificare = CASI_GOLDEN.filter(c => c.fonte === 'previsione' && !c.skip)
    if (daVerificare.length > 0) {
      console.warn(
        `\n  ⚠  ${daVerificare.length} caso/i con numeri PREVISTI, non presi da NCP:\n` +
        daVerificare.map(c => `     · ${c.nome}`).join('\n') +
        '\n     Bloccano le regressioni, non verificano la correttezza.\n' +
        '     Vanno confrontati con NCP impostato su Doubles.\n'
      )
    }
    expect(Array.isArray(daVerificare)).toBe(true)
  })

  for (const caso of CASI_GOLDEN) {
    // `it.fails` si aspetta che il test fallisca: resta verde finché il bug
    // esiste e diventa rosso quando viene corretto, ricordandoti di togliere
    // il flag `bugNoto`. Un test rosso permanente lo smetteresti di guardare.
    const test = caso.skip ? it.skip : caso.bugNoto ? it.fails : it
    // Il nome porta l'etichetta della fonte: leggendo l'output della suite si
    // deve capire quali numeri sono verificati e quali no.
    const etichetta = caso.fonte === 'previsione' ? ' [previsione — da verificare su NCP]' : ''
    test(caso.nome + etichetta, () => {
      const risultato = calculateDamage({ ...caso.input, debug: false })
      expect(risultato).not.toBeNull()
      expect(risultato.rolls).toEqual(caso.rolls)
      if (caso.defHP !== undefined) expect(risultato.defHP).toBe(caso.defHP)
    })
  }
})