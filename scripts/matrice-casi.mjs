// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/matrice-casi.mjs
 *
 * Le due squadre e gli scenari di campo su cui si caratterizza la matrice.
 *
 * ─── PERCHÉ SERVE UN BLOCCO A PARTE ────────────────────────────────────────
 * `snapshot.json` non attraversa `DamageTable`: fotografa `calculateDamage`
 * chiamata direttamente. È l'errore di criterio della sessione C, ed è ancora
 * vero. La sessione E rifattorizza proprio il codice che sta SOPRA il motore —
 * la scelta della mossa migliore, la prima mossa immune, l'indicatore di
 * velocità, l'orientamento del campo — e nessuno dei 584 casi esistenti può
 * accorgersi se quel codice cambia risposta.
 *
 * Questi casi coprono quello strato e nient'altro.
 *
 * ─── COSA DEVE POTER FALLIRE ───────────────────────────────────────────────
 * Ogni scenario è scelto perché muove qualcosa rispetto al precedente:
 *
 *   neutro          il riferimento
 *   sole            cambia il danno delle mosse Fuoco e la scelta della migliore
 *   pioggia+TR      inverte l'indicatore ⚡ su quasi tutte le celle
 *   elettrico+crit  il critico buca gli schermi, il terreno cambia la priorità
 *   neve+velo       riduce entrambe le categorie, sposta le soglie di KO
 *
 * Le squadre contengono di proposito: immunità da tipo (Terra su Gholdengo),
 * immunità da abilità (Levitate no, ma Good as Gold e Beads of Ruin toccano
 * altri rami), Intimidate e Clear Amulet — cioè lo strato di preparazione
 * chiuso in J — e strumenti che si consumano.
 */

/** Slot completo: nessun campo lasciato implicito. */
function slot({ key, moves, nature, ability, item, sps = [4, 4, 4, 4, 4, 4], boosts = {} }) {
  return {
    key,
    moves,
    sps,
    nature,
    ability,
    item,
    atkBoost:   boosts.atk   ?? 0,
    defBoost:   boosts.def   ?? 0,
    spAtkBoost: boosts.spAtk ?? 0,
    spDefBoost: boosts.spDef ?? 0,
    speBoost:   boosts.spe   ?? 0,
    abilityFlags: {},
    lastRespectsKOs: 0,
  }
}

export const SQUADRA_1 = [
  slot({ key: 'garchomp',     moves: ['earthquake', 'rock slide', 'dragon claw', 'protect'],
         nature: 'adamant', ability: 'rough skin',    item: 'life orb' }),
  slot({ key: 'incineroar',   moves: ['knock off', 'flare blitz', 'fake out', 'parting shot'],
         nature: 'adamant', ability: 'intimidate',    item: 'assault vest' }),
  slot({ key: 'rillaboom',    moves: ['wood hammer', 'grassy glide', 'u-turn', 'protect'],
         nature: 'adamant', ability: 'grassy surge',  item: 'choice band' }),
  slot({ key: 'amoonguss',    moves: ['sludge bomb', 'pollen puff', 'spore', 'rage powder'],
         nature: 'bold',    ability: 'regenerator',   item: 'leftovers',
         boosts: { def: 1 } }),
  // Quattro mosse Normale/Lotta: contro Gholdengo, che è Spettro, sono tutte
  // e quattro immuni. È l'unico modo per far entrare il ramo `firstImmuneT1`,
  // che si accende solo quando NESSUNA mossa produce danno.
  slot({ key: 'dragonite',    moves: ['extreme speed', 'body slam', 'brick break', 'close combat'],
         nature: 'adamant', ability: 'multiscale',    item: 'clear amulet' }),
  slot({ key: 'flutter-mane', moves: ['moonblast', 'shadow ball', 'icy wind', 'protect'],
         nature: 'timid',   ability: 'protosynthesis', item: 'booster energy' }),
]

export const SQUADRA_2 = [
  slot({ key: 'gholdengo',  moves: ['make it rain', 'shadow ball', 'thunderbolt', 'protect'],
         nature: 'modest',  ability: 'good as gold',  item: 'life orb' }),
  slot({ key: 'chi-yu',     moves: ['heat wave', 'dark pulse', 'snarl', 'protect'],
         nature: 'timid',   ability: 'beads of ruin', item: 'choice specs' }),
  slot({ key: 'kingambit',  moves: ['sucker punch', 'iron head', 'brick break', 'protect'],
         nature: 'adamant', ability: 'defiant',       item: 'assault vest',
         boosts: { atk: 2 } }),
  // Quattro mosse Elettro: contro Garchomp, che è Terra, sono tutte immuni.
  // Stesso ruolo di Dragonite qui sopra, ma per il ramo `firstImmuneT2`.
  slot({ key: 'iron-hands', moves: ['wild charge', 'thunder punch', 'volt switch', 'zap cannon'],
         nature: 'adamant', ability: 'quark drive',   item: 'booster energy' }),
  // Copia esatta del Garchomp di squadra 1: stessa specie, stessa natura,
  // stessi SP. La cella (0,4) è quindi un pareggio di velocità, che è l'unico
  // modo per far restituire `null` a `whoGoesFirst`. E non è una sonda cieca:
  // nello scenario col Vento in Coda su t2 il pareggio si rompe, quindi il
  // caso si muove fra uno scenario e l'altro.
  slot({ key: 'garchomp',   moves: ['earthquake', 'rock slide', 'dragon claw', 'protect'],
         nature: 'adamant', ability: 'rough skin',    item: 'life orb' }),
  slot({ key: 'urshifu',    moves: ['close combat', 'aqua jet', 'u-turn', 'protect'],
         nature: 'jolly',   ability: 'unseen fist',   item: 'choice scarf' }),
]

/** Stato di campo neutro, nella forma che `useFieldState` produce. */
const CAMPO_BASE = {
  weather: null,
  terrain: null,
  doubleTarget: true,
  trickRoom: false,
  helpingHand: { t1: false, t2: false },
  tailwind:    { t1: false, t2: false },
  auroraVeil:  { t1: false, t2: false },
  lightScreen: { t1: false, t2: false },
  reflect:     { t1: false, t2: false },
  crit:        { t1: false, t2: false },
}

export const SCENARI = [
  {
    nome: 'neutro',
    campo: { ...CAMPO_BASE },
  },
  {
    nome: 'sole-reflect-t2-hh-t1',
    campo: {
      ...CAMPO_BASE,
      weather: 'sun',
      reflect:     { t1: false, t2: true },
      helpingHand: { t1: true,  t2: false },
    },
  },
  {
    nome: 'pioggia-trickroom-tailwind-t2',
    campo: {
      ...CAMPO_BASE,
      weather: 'rain',
      trickRoom: true,
      tailwind: { t1: false, t2: true },
    },
  },
  {
    nome: 'elettrico-lightscreen-t1-crit-t1',
    campo: {
      ...CAMPO_BASE,
      terrain: 'electric',
      lightScreen: { t1: true,  t2: false },
      crit:        { t1: true,  t2: false },
    },
  },
  {
    nome: 'neve-auroraveil-t2-bersaglio-singolo',
    campo: {
      ...CAMPO_BASE,
      weather: 'snow',
      doubleTarget: false,
      auroraVeil: { t1: false, t2: true },
    },
  },
]

export const LIVELLO = 50
