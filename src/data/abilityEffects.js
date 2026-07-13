// ─── Flag di default per abilità con stato contestuale ───────────────────────
// Questi valori vengono usati da emptyPokemon() nello store per inizializzare
// abilityFlags su ogni slot Pokémon.
export const DEFAULT_ABILITY_FLAGS = {
  intimidateActive:      false, // difensore: applica -1 Atk all'attaccante nel calcolo
  flashFireActive:       false, // attaccante: boost ×1.5 Fire (dopo aver ricevuto mossa Fire)
  multiscaleActive:      true,  // difensore: ×0.5 danno ricevuto se HP pieni (default true)
  supremeOverlordKOs:    0,     // attaccante: numero alleati KO (0-5), boost ×(1 + n*0.1)
}

// ─── Effetti passivi delle abilità sul calcolo danno ─────────────────────────
// Le abilità con stato (intimidate, flash-fire, multiscale…) hanno qui solo
// metadati descrittivi. La logica vera è in calcEngine.js che legge abilityFlags.
export const ABILITY_EFFECTS = {
  // ── Attaccante: moltiplicatori stat ──────────────────────────────────────
  'huge-power':  { atkMult: 2.0, statType: 'physical' },
  'pure-power':  { atkMult: 2.0, statType: 'physical' },

  // ── Attaccante: STAB potenziato ──────────────────────────────────────────
  'adaptability': { adaptability: true },

  // ── Attaccante: boost tipo mossa ─────────────────────────────────────────
  // ×1.5 su mosse Fire (abilità esclusiva Champions — Mega Pyroar)
  'fire-mane':   { fireMane: true },

  // ── Attaccante: boost mosse contatto ─────────────────────────────────────
  // ×1.3 su mosse che fanno contatto fisico (Mega Metagross, Mega Barbaracle)
  'tough-claws': { toughClaws: true },

  // ── Attaccante: boost condizionale (stato) ───────────────────────────────
  // Gestito tramite abilityFlags.flashFireActive — qui solo il flag di immunità
  'flash-fire':  { flashFireImmune: true },

  // Kingambit: +10% Atk e SpAtk per ogni alleato KO
  // Gestito tramite abilityFlags.supremeOverlordKOs
  'supreme-overlord': { supremeOverlord: true },

  // ── Difensore: riduzione danno passiva ───────────────────────────────────
  'thick-fat':   { thickFat: true },   // ×0.5 danno Fire e Ice
  'filter':      { filter: true },     // ×0.75 su mosse super effective
  'solid-rock':  { filter: true },     // identico a Filter

  // Fluffy: ×0.5 da mosse contatto, ×2 da Fire (si moltiplicano se entrambi)
  'fluffy':      { fluffy: true },

  // Multiscale / Shadow Shield: ×0.5 danno ricevuto se HP pieni
  // Gestito tramite abilityFlags.multiscaleActive
  'multiscale':     { multiscale: true },
  'shadow-shield':  { multiscale: true },

  // ── Difensore: immunità con effetto attivabile ────────────────────────────
  // Gestito tramite abilityFlags.intimidateActive
  'intimidate':  { intimidate: true },

  // ── Attaccante: reazione automatica a Intimidate ─────────────────────────
  // Nessun flag manuale — la logica è automatica in calcEngine.js
  'defiant':     { defiant: true },
  'contrary':    { contrary: true },

  // ── Solo dropdown, nessun effetto sul calcolo danno ──────────────────────
  'levitate':    { levitate: true },   // immunità Ground gestita separatamente
  'hospitality': {},                   // Sinistcha: heal partner, nessun effetto rolls
  'eelevate':    {},                   // Mega Eelektross: Levitate + Beast Boost
}