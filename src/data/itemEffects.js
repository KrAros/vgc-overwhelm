import { TYPES } from './typeChart.js'

// Effetti meccanici degli item sui calcoli danno.
// atkMult:    moltiplica la stat d'attacco usata nel calcolo
// defMult:    moltiplica la stat di difesa fisica
// spdMult:    moltiplica la stat di difesa speciale
// typBoost:   moltiplica il danno se il tipo della mossa coincide (TYPES.X)
// statType:   restringe atkMult a 'physical' o 'special' (per Choice items)
// resistBerry: riduce il danno subito di ×0.5 se il tipo della mossa corrisponde
// megaStone:  slug della forma Mega corrispondente (info, no effetto danno diretto)
// utility:    flag per item che non impattano i rolls (solo dropdown)

export const ITEM_EFFECTS = {
  // ── Boost attacco ─────────────────────────────────────────────────────────
  'choice band':    { atkMult: 1.5, statType: 'physical', showInSmogon: true },
  'choice specs':   { atkMult: 1.5, statType: 'special',  showInSmogon: true },
  'life orb':       { dmgMult: { num: 5324, den: 4096 },    showInSmogon: true },
  // ×1.1 su mosse fisiche / speciali rispettivamente
  'muscle band':    { atkMult: 1.1, statType: 'physical',  showInSmogon: true },
  'wise glasses':   { atkMult: 1.1, statType: 'special',   showInSmogon: true },
  // ×1.1 su mosse da pugno (ignora l'effetto aggiuntivo sull'abilità)
  'punching glove': { atkMult: 1.1, statType: 'physical',  showInSmogon: true },
  // Orb leggendari: ×1.2 su Dragon/Steel per Dialga, Water/Dragon per Palkia,
  // Ghost/Dragon per Giratina. Qui senza logica di filtro tipo — mostrati sempre.
  'adamant orb':    { showInSmogon: true },
  'lustrous orb':   { showInSmogon: true },
  'griseous orb':   { showInSmogon: true },
  // Throat Spray: ×1.5 SpAtk dopo una mossa sonora. Trattato come attivo.
  'throat spray':   { showInSmogon: true },
  // Booster Energy: attiva Protosynthesis / Quark Drive senza meteo/campo.
  'booster energy': { showInSmogon: true },

  // ── Type-boosting ×1.2 ────────────────────────────────────────────────────
  'silk scarf':     { typBoost: TYPES.NORMAL,   typMult: 1.2, showInSmogon: true },
  'black belt':     { typBoost: TYPES.FIGHTING, typMult: 1.2, showInSmogon: true },
  'sharp beak':     { typBoost: TYPES.FLYING,   typMult: 1.2, showInSmogon: true },
  'poison barb':    { typBoost: TYPES.POISON,   typMult: 1.2, showInSmogon: true },
  'soft sand':      { typBoost: TYPES.GROUND,   typMult: 1.2, showInSmogon: true },
  'hard stone':     { typBoost: TYPES.ROCK,     typMult: 1.2, showInSmogon: true },
  'spell tag':      { typBoost: TYPES.GHOST,    typMult: 1.2, showInSmogon: true },
  'metal coat':     { typBoost: TYPES.STEEL,    typMult: 1.2, showInSmogon: true },
  'charcoal':       { typBoost: TYPES.FIRE,     typMult: 1.2, showInSmogon: true },
  'mystic water':   { typBoost: TYPES.WATER,    typMult: 1.2, showInSmogon: true },
  'miracle seed':   { typBoost: TYPES.GRASS,    typMult: 1.2, showInSmogon: true },
  'magnet':         { typBoost: TYPES.ELECTRIC, typMult: 1.2, showInSmogon: true },
  'twisted spoon':  { typBoost: TYPES.PSYCHIC,  typMult: 1.2, showInSmogon: true },
  'never-melt-ice': { typBoost: TYPES.ICE,      typMult: 1.2, showInSmogon: true },
  // Variante senza trattino — anche ReportPanel usa questa forma per Never-Melt Ice
  'never-melt ice': { typBoost: TYPES.ICE,      typMult: 1.2, showInSmogon: true },
  'dragon fang':    { typBoost: TYPES.DRAGON,   typMult: 1.2, showInSmogon: true },
  'black glasses':  { typBoost: TYPES.DARK,     typMult: 1.2, showInSmogon: true },
  'silver powder':  { typBoost: TYPES.BUG,      typMult: 1.2, showInSmogon: true },
  // Fairy Feather: ×1.2 su mosse Fairy (introdotto in Scarlet/Violet)
  'fairy feather':  { typBoost: TYPES.FAIRY,    typMult: 1.2, showInSmogon: true },

  // ── Plates ×1.2 ───────────────────────────────────────────────────────────
  'flame plate':    { typBoost: TYPES.FIRE,     typMult: 1.2, showInSmogon: true },
  'splash plate':   { typBoost: TYPES.WATER,    typMult: 1.2, showInSmogon: true },
  'zap plate':      { typBoost: TYPES.ELECTRIC, typMult: 1.2, showInSmogon: true },
  'meadow plate':   { typBoost: TYPES.GRASS,    typMult: 1.2, showInSmogon: true },
  'icicle plate':   { typBoost: TYPES.ICE,      typMult: 1.2, showInSmogon: true },
  'fist plate':     { typBoost: TYPES.FIGHTING, typMult: 1.2, showInSmogon: true },
  'toxic plate':    { typBoost: TYPES.POISON,   typMult: 1.2, showInSmogon: true },
  'earth plate':    { typBoost: TYPES.GROUND,   typMult: 1.2, showInSmogon: true },
  'sky plate':      { typBoost: TYPES.FLYING,   typMult: 1.2, showInSmogon: true },
  'mind plate':     { typBoost: TYPES.PSYCHIC,  typMult: 1.2, showInSmogon: true },
  'insect plate':   { typBoost: TYPES.BUG,      typMult: 1.2, showInSmogon: true },
  'stone plate':    { typBoost: TYPES.ROCK,     typMult: 1.2, showInSmogon: true },
  'spooky plate':   { typBoost: TYPES.GHOST,    typMult: 1.2, showInSmogon: true },
  'draco plate':    { typBoost: TYPES.DRAGON,   typMult: 1.2, showInSmogon: true },
  'dread plate':    { typBoost: TYPES.DARK,     typMult: 1.2, showInSmogon: true },
  'iron plate':     { typBoost: TYPES.STEEL,    typMult: 1.2, showInSmogon: true },
  'pixie plate':    { typBoost: TYPES.FAIRY,    typMult: 1.2, showInSmogon: true },
  // Legend Plate: Arceus usa il tipo della forma — mostrata sempre in Smogon
  'legend plate':   { showInSmogon: true },

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

  // ── Mega Stone (nessun effetto diretto sul danno — info per UI/import) ─────
  // Il campo megaStone indica lo slug della forma Mega corrispondente.
  // In Champions le forme Mega si selezionano direttamente nel dropdown Pokémon.
  'venusaurite':        { megaStone: 'venusaur-mega'    },
  'charizardite x':     { megaStone: 'charizard-mega-x' },
  'charizardite y':     { megaStone: 'charizard-mega-y' },
  'blastoisinite':      { megaStone: 'blastoise-mega'   },
  'alakazite':          { megaStone: 'alakazam-mega'    },
  'gengarite':          { megaStone: 'gengar-mega'      },
  'kangaskhanite':      { megaStone: 'kangaskhan-mega'  },
  'pinsirite':          { megaStone: 'pinsir-mega'      },
  'gyaradosite':        { megaStone: 'gyarados-mega'    },
  'aerodactylite':      { megaStone: 'aerodactyl-mega'  },
  'mewtwonite x':       { megaStone: 'mewtwo-mega-x'    },
  'mewtwonite y':       { megaStone: 'mewtwo-mega-y'    },
  'ampharosite':        { megaStone: 'ampharos-mega'    },
  'scizorite':          { megaStone: 'scizor-mega'      },
  'heracronite':        { megaStone: 'heracross-mega'   },
  'houndoominite':      { megaStone: 'houndoom-mega'    },
  'tyranitarite':       { megaStone: 'tyranitar-mega'   },
  'blazikenite':        { megaStone: 'blaziken-mega'    },
  'gardevoirite':       { megaStone: 'gardevoir-mega'   },
  'mawilite':           { megaStone: 'mawile-mega'      },
  'aggronite':          { megaStone: 'aggron-mega'      },
  'medichamite':        { megaStone: 'medicham-mega'    },
  'manectite':          { megaStone: 'manectric-mega'   },
  'banettite':          { megaStone: 'banette-mega'     },
  'absolite':           { megaStone: 'absol-mega'       },
  'garchompite':        { megaStone: 'garchomp-mega'    },
  'lucarionite':        { megaStone: 'lucario-mega'     },
  'abomasite':          { megaStone: 'abomasnow-mega'   },
  'beedrillite':        { megaStone: 'beedrill-mega'    },
  'pidgeotite':         { megaStone: 'pidgeot-mega'     },
  'slowbro-mega':       { megaStone: 'slowbro-mega'     },
  'slobronite':         { megaStone: 'slowbro-mega'     },
  'steelixite':         { megaStone: 'steelix-mega'     },
  'sceptilite':         { megaStone: 'sceptile-mega'    },
  'swampertite':        { megaStone: 'swampert-mega'    },
  'sablenite':          { megaStone: 'sableye-mega'     },
  'sharpedonite':       { megaStone: 'sharpedo-mega'    },
  'cameruptite':        { megaStone: 'camerupt-mega'    },
  'altarianite':        { megaStone: 'altaria-mega'     },
  'glalitite':          { megaStone: 'glalie-mega'      },
  'salamencite':        { megaStone: 'salamence-mega'   },
  'metagrossite':       { megaStone: 'metagross-mega'   },
  'latiasite':          { megaStone: 'latias-mega'      },
  'latiosite':          { megaStone: 'latios-mega'      },
  'lopunnite':          { megaStone: 'lopunny-mega'     },
  'galladite':          { megaStone: 'gallade-mega'     },
  'audinite':           { megaStone: 'audino-mega'      },
  'diancite':           { megaStone: 'diancie-mega'     },
  // Nuove da Pokémon Legends Z-A (v1.0.2)
  'meganiumite':        { megaStone: 'meganium-mega'    },
  'feraligatrite':      { megaStone: 'feraligatr-mega'  },
  'emboarite':          { megaStone: 'emboar-mega'      },
  'dragonitite':        { megaStone: 'dragonite-mega'   },
  'chesnaughtite':      { megaStone: 'chesnaught-mega'  },
  'delphoxite':         { megaStone: 'delphox-mega'     },
  'greninjaite':        { megaStone: 'greninja-mega'    },
  'excadrillite':       { megaStone: 'excadrill-mega'   },
  'golurknite':         { megaStone: 'golurk-mega'      },
  'clefablite':         { megaStone: 'clefable-mega'    },
  'victreebelite':      { megaStone: 'victreebel-mega'  },
  'drampite':           { megaStone: 'drampa-mega'      },
  'froslasite':         { megaStone: 'froslass-mega'    },
  'hawluchite':         { megaStone: 'hawlucha-mega'    },
  'crabominite':        { megaStone: 'crabominable-mega'},
  'starmieite':         { megaStone: 'starmie-mega'     },
  'chimechite':         { megaStone: 'chimecho-mega'    },
  'skarmorite':         { megaStone: 'skarmory-mega'    },
  'scovillainite':      { megaStone: 'scovillain-mega'  },
  'glimmorite':         { megaStone: 'glimmora-mega'    },
  'chandelurite':       { megaStone: 'chandelure-mega'  },
  'floettite':          { megaStone: 'floette-mega'     },
  'meowstite':          { megaStone: 'meowstic-mega'    },
  // M-B (Champions-exclusive)
  'barbaraclite':       { megaStone: 'barbaracle-mega'  },
  'pyroarite':          { megaStone: 'pyroar-mega'      },
  'eelektrossite':      { megaStone: 'eelektross-mega'  },
  'staraptite':         { megaStone: 'staraptor-mega'   },
  'raichunite x':       { megaStone: 'raichu-mega-x'    },
  'raichunite y':       { megaStone: 'raichu-mega-y'    },
  'malamarite':         { megaStone: 'malamar-mega'     },
  'scraftite':          { megaStone: 'scrafty-mega'     },
  'scolipedonite':      { megaStone: 'scolipede-mega'   },
  'dragalgite':         { megaStone: 'dragalge-mega'    },
  'falinksite':         { megaStone: 'falinks-mega'     },

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