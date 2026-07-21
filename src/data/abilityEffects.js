// ─── Normalizzazione chiave abilità ──────────────────────────────────────────
// Converte un nome abilità in qualsiasi formato (es. "Flash Fire", "flash fire")
// nella chiave usata in ABILITY_EFFECTS (es. "flash-fire").
// Esportata così che calcEngine.js e chiunque altro la importino da un posto solo.
export function normalizeAbilityKey(str) {
  return (str || '').toLowerCase().replace(/ /g, '-')
}

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
  'huge-power':  { atkMult: 2.0, statType: 'physical', showInSmogon: true, desc: '×2 Atk su mosse fisiche' },
  'pure-power':  { atkMult: 2.0, statType: 'physical', showInSmogon: true, desc: '×2 Atk su mosse fisiche' },

  // ── Attaccante: STAB potenziato ──────────────────────────────────────────
  'adaptability': { adaptability: true, showInSmogon: true, desc: 'Aumenta l\'efficacia delle mosse STAB dal normale 1,5× a 2×.' },

  // ── Attaccante: boost tipo mossa ─────────────────────────────────────────
  'fire-mane':   { fireMane: true, showInSmogon: true, desc: '×1.5 BP su mosse Fire' },

  // ── Attaccante: boost mosse contatto ─────────────────────────────────────
  'tough-claws': { toughClaws: true, showInSmogon: true, desc: 'Aumenta l\'efficacia delle mosse da contatto di 1,3x' },

  // ── Attaccante: boost condizionale (stato) ───────────────────────────────
  'flash-fire':  { flashFireImmune: true, showInSmogon: true, desc: 'Immune alle mosse Fire — se colpito, ×1.5 BP Fire' },

  // Kingambit: +10% Atk e SpAtk per ogni alleato KO
  'supreme-overlord': { supremeOverlord: true, showInSmogon: true, desc: '+10% Atk e SpAtk per ogni alleato a terra (max ×1.5)' },

  // ── Difensore: riduzione danno passiva ───────────────────────────────────
  'thick-fat':   { thickFat: true,  desc: '×0.5 danno subito da Fire e Ice' },
  'filter':      { filter: true,    desc: '×0.75 danno subito da mosse super effective' },
  'solid-rock':  { filter: true,    desc: '×0.75 danno subito da mosse super effective' },
  'fluffy':      { fluffy: true,    desc: '×0.5 da contatto · ×2 da Fire' },

  // Multiscale / Shadow Shield: ×0.5 danno ricevuto se HP pieni
  'multiscale':     { multiscale: true, desc: '×0.5 danno ricevuto quando HP pieni' },
  'shadow-shield':  { multiscale: true, desc: '×0.5 danno ricevuto quando HP pieni' },

  // ── Difensore: immunità con effetto attivabile ────────────────────────────
  'intimidate':  { intimidate: true, desc: '−1 Atk all\'avversario a inizio turno' },

  // ── Attaccante: reazione automatica a Intimidate ─────────────────────────
  'defiant':     { defiant: true,     desc: '+2 Atk quando una stat viene abbassata da un avversario' },
  'contrary':    { contrary: true,    desc: 'I boost diventano drop e viceversa — Intimidate diventa +1 Atk' },
  'competitive': { competitive: true, desc: '+2 SpAtk quando una stat viene abbassata da un avversario' },

  // ── Meteo: Modifica le statistiche ─────────────────────────
  'sand-rush':     { sandRush: true,     desc: 'Raddoppia la velocità in caso di tempesta di sabbia' },

  // ── Solo dropdown, nessun effetto sul calcolo danno ──────────────────────
  'levitate':    { levitate: true, desc: 'Immune alle mosse Ground' },
  'hospitality': { desc: 'Cura il partner a inizio turno (nessun effetto sui rolls)' },
  'eelevate':    { desc: 'Levitate + Beast Boost (nessun effetto diretto sui rolls)' },
}