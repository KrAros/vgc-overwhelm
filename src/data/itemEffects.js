import { TYPES } from './typeChart.js'
import { MOD } from '../lib/modifiers.js'

// Effetti meccanici degli item sui calcoli danno.
//
// atkMult:    moltiplica la stat d'attacco (catena ATTACCO — solo i Choice)
// defMult:    moltiplica la stat di difesa fisica (catena DIFESA)
// spdMult:    moltiplica la stat di difesa speciale (catena DIFESA)
// bpMod:      modificatore di POTENZA in virgola fissa (catena BP)
// finalMod:   modificatore di DANNO FINALE in virgola fissa (catena FINALE)
// finalModSuperEff: come finalMod, ma solo quando l'efficacia è maggiore di 1
// typBoost:   tipo richiesto perché bpMod si applichi (TYPES.X)
// statType:   restringe atkMult/bpMod a 'physical' o 'special'
//
// ─── PERCHÉ bpMod E NON UN DECIMALE ────────────────────────────────────────
// Fino a D-2 gli item type-boost e i ×1.1 erano scritti come moltiplicatori
// della STATISTICA d'attacco (`typMult: 1.2`, `atkMult: 1.1`). Nel gioco sono
// modificatori di POTENZA, ed è una catena diversa che arrotonda per conto
// suo. Il valore va scritto in virgola fissa perché i decimali tondi NON sono
// i valori veri: 0x1333/4096 = 1,19995…, non 1.2.
//
// E soprattutto: Muscle Band e Punching Glove hanno lo STESSO ×1.1 nominale
// ma due costanti diverse nel gioco (0x1199 = 4505 contro 0x119A = 4506).
// Con `atkMult: 1.1` quella distinzione non è nemmeno esprimibile.
// resistBerry: riduce il danno subito di ×0.5 se il tipo della mossa corrisponde
// megaStone:  slug della forma Mega corrispondente (info, no effetto danno diretto)
// utility:    flag per item che non impattano i rolls (solo dropdown)

export const ITEM_EFFECTS = {
  // ── Boost attacco ─────────────────────────────────────────────────────────
  'choice band':    { atkMult: 1.5, statType: 'physical', showInSmogon: true },
  'choice specs':   { atkMult: 1.5, statType: 'special',  showInSmogon: true },
  // Expert Belt: ×1.2 sul danno finale, ma SOLO contro un bersaglio che prende
  // super efficace (`calcFinalMods` punto o). Serve un campo suo perché
  // `finalMod` è incondizionato: scriverlo lì darebbe il ×1.2 anche su un
  // colpo neutro, che è metà dei colpi.
  //
  // In NCP i punti o e p sono un `if / else if`: Expert Belt esclude Life Orb.
  // Essendo l'item un campo solo, quell'esclusione non può mai servire — ma la
  // riproduciamo lo stesso nel motore, perché copiare la specifica costa una
  // riga e dedurre che «tanto non capita» è il tipo di ragionamento che
  // invecchia male.
  'expert belt':    { finalModSuperEff: MOD.X1_2,           showInSmogon: true },
  // Life Orb: modificatore di DANNO FINALE (`calcFinalMods` punto p).
  // 0x14CC = 5324, cioè ×1,29980… — non ×1.3. La differenza è reale.
  'life orb':       { finalMod: MOD.X1_3_ORB,               showInSmogon: true },
  // ×1.1 su mosse fisiche / speciali rispettivamente
  'muscle band':    { bpMod: MOD.X1_1, statType: 'physical',  showInSmogon: true },
  'wise glasses':   { bpMod: MOD.X1_1, statType: 'special',   showInSmogon: true },
  // ×1.1 su mosse da pugno (ignora l'effetto aggiuntivo sull'abilità)
  // Punching Glove: ×1.1, ma solo sulle mosse pugno — non su tutte le fisiche
  // come facevamo prima. Il flag `punch` in moves.json arriva dalla stessa
  // generazione di `canEvolve`. In NCP toglie anche il contatto alla mossa
  // (`damage_MASTER.js` riga 826): quello lo modelliamo qui sotto nel motore.
  'punching glove': { bpMod: MOD.X1_1_ALT, soloMossePugno: true,  showInSmogon: true },
  // Orb leggendari: ×1.2 su Dragon/Steel per Dialga, Water/Dragon per Palkia,
  // Ghost/Dragon per Giratina. Qui senza logica di filtro tipo — mostrati sempre.
  'adamant orb':    { showInSmogon: true },
  'lustrous orb':   { showInSmogon: true },
  'griseous orb':   { showInSmogon: true },
  // Throat Spray: ×1.5 SpAtk dopo una mossa sonora. Trattato come attivo.
  'throat spray':   { showInSmogon: true },
  // (Booster Energy stava qui con il solo `showInSmogon`, cioè fra le voci
  // dichiarate e mai calcolate. Dalla sessione J ha un effetto vero e si è
  // spostata più in basso, nella sezione della preparazione.)

  // ── Type-boosting ×1.2 ────────────────────────────────────────────────────
  'silk scarf':     { typBoost: TYPES.NORMAL,   bpMod: MOD.X1_2, showInSmogon: true },
  'black belt':     { typBoost: TYPES.FIGHTING, bpMod: MOD.X1_2, showInSmogon: true },
  'sharp beak':     { typBoost: TYPES.FLYING,   bpMod: MOD.X1_2, showInSmogon: true },
  'poison barb':    { typBoost: TYPES.POISON,   bpMod: MOD.X1_2, showInSmogon: true },
  'soft sand':      { typBoost: TYPES.GROUND,   bpMod: MOD.X1_2, showInSmogon: true },
  'hard stone':     { typBoost: TYPES.ROCK,     bpMod: MOD.X1_2, showInSmogon: true },
  'spell tag':      { typBoost: TYPES.GHOST,    bpMod: MOD.X1_2, showInSmogon: true },
  'metal coat':     { typBoost: TYPES.STEEL,    bpMod: MOD.X1_2, showInSmogon: true },
  'charcoal':       { typBoost: TYPES.FIRE,     bpMod: MOD.X1_2, showInSmogon: true },
  'mystic water':   { typBoost: TYPES.WATER,    bpMod: MOD.X1_2, showInSmogon: true },
  'miracle seed':   { typBoost: TYPES.GRASS,    bpMod: MOD.X1_2, showInSmogon: true },
  'magnet':         { typBoost: TYPES.ELECTRIC, bpMod: MOD.X1_2, showInSmogon: true },
  'twisted spoon':  { typBoost: TYPES.PSYCHIC,  bpMod: MOD.X1_2, showInSmogon: true },
  'never-melt-ice': { typBoost: TYPES.ICE,      bpMod: MOD.X1_2, showInSmogon: true },
  // Variante senza trattino — anche ReportPanel usa questa forma per Never-Melt Ice
  'never-melt ice': { typBoost: TYPES.ICE,      bpMod: MOD.X1_2, showInSmogon: true },
  'dragon fang':    { typBoost: TYPES.DRAGON,   bpMod: MOD.X1_2, showInSmogon: true },
  'black glasses':  { typBoost: TYPES.DARK,     bpMod: MOD.X1_2, showInSmogon: true },
  'silver powder':  { typBoost: TYPES.BUG,      bpMod: MOD.X1_2, showInSmogon: true },
  // Fairy Feather: ×1.2 su mosse Fairy (introdotto in Scarlet/Violet)
  'fairy feather':  { typBoost: TYPES.FAIRY,    bpMod: MOD.X1_2, showInSmogon: true },

  // ── Plates ×1.2 ───────────────────────────────────────────────────────────
  'flame plate':    { typBoost: TYPES.FIRE,     bpMod: MOD.X1_2, showInSmogon: true },
  'splash plate':   { typBoost: TYPES.WATER,    bpMod: MOD.X1_2, showInSmogon: true },
  'zap plate':      { typBoost: TYPES.ELECTRIC, bpMod: MOD.X1_2, showInSmogon: true },
  'meadow plate':   { typBoost: TYPES.GRASS,    bpMod: MOD.X1_2, showInSmogon: true },
  'icicle plate':   { typBoost: TYPES.ICE,      bpMod: MOD.X1_2, showInSmogon: true },
  'fist plate':     { typBoost: TYPES.FIGHTING, bpMod: MOD.X1_2, showInSmogon: true },
  'toxic plate':    { typBoost: TYPES.POISON,   bpMod: MOD.X1_2, showInSmogon: true },
  'earth plate':    { typBoost: TYPES.GROUND,   bpMod: MOD.X1_2, showInSmogon: true },
  'sky plate':      { typBoost: TYPES.FLYING,   bpMod: MOD.X1_2, showInSmogon: true },
  'mind plate':     { typBoost: TYPES.PSYCHIC,  bpMod: MOD.X1_2, showInSmogon: true },
  'insect plate':   { typBoost: TYPES.BUG,      bpMod: MOD.X1_2, showInSmogon: true },
  'stone plate':    { typBoost: TYPES.ROCK,     bpMod: MOD.X1_2, showInSmogon: true },
  'spooky plate':   { typBoost: TYPES.GHOST,    bpMod: MOD.X1_2, showInSmogon: true },
  'draco plate':    { typBoost: TYPES.DRAGON,   bpMod: MOD.X1_2, showInSmogon: true },
  'dread plate':    { typBoost: TYPES.DARK,     bpMod: MOD.X1_2, showInSmogon: true },
  'iron plate':     { typBoost: TYPES.STEEL,    bpMod: MOD.X1_2, showInSmogon: true },
  'pixie plate':    { typBoost: TYPES.FAIRY,    bpMod: MOD.X1_2, showInSmogon: true },
  // Legend Plate: Arceus usa il tipo della forma — mostrata sempre in Smogon
  'legend plate':   { showInSmogon: true },

  // ── Boost difesa ──────────────────────────────────────────────────────────
  // Eviolite: ×1.5 su entrambe le difese, ma SOLO se il Pokémon può ancora
  // evolversi. `soloSeEvolvibile` è il cancello che il motore consulta contro
  // il campo `canEvolve` di pokemon.json (generato da scripts/gen-flag-dati.mjs).
  // Prima lo applicavamo a chiunque: Incineroar con l'Eviolite guadagnava un
  // 50% di Difesa che nel gioco non esiste.
  'eviolite':       { defMult: 1.5, spdMult: 1.5, soloSeEvolvibile: true },
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

  // ── Strumenti dello strato di preparazione (sessione J) ───────────────────
  // Non stanno in nessuna delle quattro catene: agiscono PRIMA, su
  // `lib/preparazione.js`, cambiando gli stadi di boost o accendendo
  // un'abilità. Che il danno cambi è una conseguenza, non il meccanismo.
  //
  // ─── PERCHÉ NON HANNO `num` ───────────────────────────────────────────────
  // `num` è l'indice Game Freak da cui `utils/sprite.js` costruisce l'URL
  // dell'icona. `items.json` si fermava alla settima generazione (il massimo
  // reale era 656, più le megapietre inventate); questi tre sono i primi
  // strumenti di ottava e nona generazione del file, e l'indice che Champions
  // usa per loro non lo conosco. Scriverne uno a caso darebbe un'icona
  // sbagliata o rotta; ometterlo dà nessuna icona, che è la cosa vera.

  // Clear Amulet: nessun calo di statistiche inflitto dall'avversario. Nel
  // vendore è una delle condizioni di `checkIntimidate` (damage_MASTER.js:566),
  // in mezzo alle quattro abilità che annullano il calo.
  'clear amulet':   { bloccaCaliAvversari: true, showInSmogon: true },

  // Booster Energy: accende Protosynthesis o Quark Drive senza sole né campo,
  // e si consuma. Il consumo è la parte che si vede nel danno — uno strumento
  // sparito non è più lì quando Knock Off va a cercarlo.
  'booster energy': { accendeParadosso: true, showInSmogon: true },

  // Adrenaline Orb: +1 Velocità quando arriva Intimidate, e si consuma.
  // La Velocità non entra nel danno; il consumo sì, sempre per via di Knock
  // Off. È l'unico motivo per cui questo strumento ha un effetto qui dentro.
  'adrenaline orb': { orboAdrenalina: true, showInSmogon: true },

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