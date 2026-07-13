import { TYPES } from './typeChart.js'

// Effetti meccanici degli item sui calcoli danno.
// atkMult:    moltiplica la stat d'attacco usata nel calcolo
// defMult:    moltiplica la stat di difesa fisica
// spdMult:    moltiplica la stat di difesa speciale
// typBoost:   moltiplica il danno se il tipo della mossa coincide (TYPES.X)
// statType:   restringe atkMult a 'physical' o 'special' (per Choice items)
// resistBerry: riduce il danno subito di ×0.5 se il tipo della mossa corrisponde
// utility:    flag per item che non impattano i rolls (solo dropdown)

export const ITEM_EFFECTS = {
  // ── Boost attacco ─────────────────────────────────────────────────────────
  'choice band':    { atkMult: 1.5, statType: 'physical' },
  'choice specs':   { atkMult: 1.5, statType: 'special'  },
  'life orb':       { atkMult: 1.3 },

  // ── Type-boosting ×1.2 ────────────────────────────────────────────────────
  'silk scarf':     { typBoost: TYPES.NORMAL,   typMult: 1.2 },
  'black belt':     { typBoost: TYPES.FIGHTING, typMult: 1.2 },
  'sharp beak':     { typBoost: TYPES.FLYING,   typMult: 1.2 },
  'poison barb':    { typBoost: TYPES.POISON,   typMult: 1.2 },
  'soft sand':      { typBoost: TYPES.GROUND,   typMult: 1.2 },
  'hard stone':     { typBoost: TYPES.ROCK,     typMult: 1.2 },
  'spell tag':      { typBoost: TYPES.GHOST,    typMult: 1.2 },
  'metal coat':     { typBoost: TYPES.STEEL,    typMult: 1.2 },
  'charcoal':       { typBoost: TYPES.FIRE,     typMult: 1.2 },
  'mystic water':   { typBoost: TYPES.WATER,    typMult: 1.2 },
  'miracle seed':   { typBoost: TYPES.GRASS,    typMult: 1.2 },
  'magnet':         { typBoost: TYPES.ELECTRIC, typMult: 1.2 },
  'twisted spoon':  { typBoost: TYPES.PSYCHIC,  typMult: 1.2 },
  'never-melt-ice': { typBoost: TYPES.ICE,      typMult: 1.2 },
  'dragon fang':    { typBoost: TYPES.DRAGON,   typMult: 1.2 },
  'black glasses':  { typBoost: TYPES.DARK,     typMult: 1.2 },
  'silver powder':  { typBoost: TYPES.BUG,      typMult: 1.2 },

  // ── Plates ×1.2 ───────────────────────────────────────────────────────────
  'flame plate':    { typBoost: TYPES.FIRE,     typMult: 1.2 },
  'splash plate':   { typBoost: TYPES.WATER,    typMult: 1.2 },
  'zap plate':      { typBoost: TYPES.ELECTRIC, typMult: 1.2 },
  'meadow plate':   { typBoost: TYPES.GRASS,    typMult: 1.2 },
  'icicle plate':   { typBoost: TYPES.ICE,      typMult: 1.2 },
  'fist plate':     { typBoost: TYPES.FIGHTING, typMult: 1.2 },
  'toxic plate':    { typBoost: TYPES.POISON,   typMult: 1.2 },
  'earth plate':    { typBoost: TYPES.GROUND,   typMult: 1.2 },
  'sky plate':      { typBoost: TYPES.FLYING,   typMult: 1.2 },
  'mind plate':     { typBoost: TYPES.PSYCHIC,  typMult: 1.2 },
  'insect plate':   { typBoost: TYPES.BUG,      typMult: 1.2 },
  'stone plate':    { typBoost: TYPES.ROCK,     typMult: 1.2 },
  'spooky plate':   { typBoost: TYPES.GHOST,    typMult: 1.2 },
  'draco plate':    { typBoost: TYPES.DRAGON,   typMult: 1.2 },
  'dread plate':    { typBoost: TYPES.DARK,     typMult: 1.2 },
  'iron plate':     { typBoost: TYPES.STEEL,    typMult: 1.2 },
  'pixie plate':    { typBoost: TYPES.FAIRY,    typMult: 1.2 },

  // ── Boost difesa ──────────────────────────────────────────────────────────
  'eviolite':       { defMult: 1.5, spdMult: 1.5 },
  'assault vest':   { spdMult: 1.5 },

  // ── Resist Berries (×0.5 danno se il tipo della mossa corrisponde) ────────
  // Trattate come sempre attive (nessun tracking consumo)
  'colbur berry':   { resistBerry: TYPES.DARK     },
  'chople berry':   { resistBerry: TYPES.FIGHTING },
  'roseli berry':   { resistBerry: TYPES.FAIRY    },
  'shuca berry':    { resistBerry: TYPES.GROUND   },
  'occa berry':     { resistBerry: TYPES.FIRE     },
  'passho berry':   { resistBerry: TYPES.WATER    },
  'haban berry':    { resistBerry: TYPES.DRAGON   },
  'kasib berry':    { resistBerry: TYPES.GHOST    },
  'coba berry':     { resistBerry: TYPES.FLYING   },
  'rindo berry':    { resistBerry: TYPES.GRASS    },
  'wacan berry':    { resistBerry: TYPES.ELECTRIC },
  'payapa berry':   { resistBerry: TYPES.PSYCHIC  },
  'tanga berry':    { resistBerry: TYPES.BUG      },
  'charti berry':   { resistBerry: TYPES.ROCK     },
  'yache berry':    { resistBerry: TYPES.ICE      },
  'babiri berry':   { resistBerry: TYPES.STEEL    },
  'chilan berry':   { resistBerry: TYPES.NORMAL   },

  // ── Utility (non impattano i rolls — solo presenza nel dropdown) ──────────
  // Il flag `utility: true` segnala al UI che l'item è riconosciuto
  // ma non altera nessun numero nel calcolo.
  'sitrus berry':   { utility: true },
  'leftovers':      { utility: true },
  'lum berry':      { utility: true },
  'white herb':     { utility: true },
  'mental herb':    { utility: true },
  'focus sash':     { utility: true },
}