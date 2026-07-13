import { TYPES } from './typeChart.js'

// Effetti meccanici degli item sui calcoli danno.
// atkMult:  moltiplica la stat d'attacco usata nel calcolo
// defMult:  moltiplica la stat di difesa fisica
// spdMult:  moltiplica la stat di difesa speciale
// typBoost: moltiplica il danno se il tipo della mossa coincide (TYPES.X)
// statType: restringe atkMult a 'physical' o 'special' (per Choice items)

export const ITEM_EFFECTS = {
  // Boost attacco
  'choice band':    { atkMult: 1.5, statType: 'physical' },
  'choice specs':   { atkMult: 1.5, statType: 'special' },
  'life orb':       { atkMult: 1.3 },

  // Type-boosting ×1.2
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

  // Plates ×1.2 (stessi boost, tipo Arceus)
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

  // Boost difesa
  'eviolite':       { defMult: 1.5, spdMult: 1.5 },
  'assault vest':   { spdMult: 1.5 },
}