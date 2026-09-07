// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

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
// soloSpecie: elenco di slug — l'effetto vale solo su quelle specie
// immuneTipo: tipo a cui lo strumento rende immuni (danno zero, non ridotto)
// nonAncorato: chi lo tiene non tocca il terreno — `pIsGrounded` del riferimento
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

  /**
   * ─── SFERASCINTILLA ───────────────────────────────────────────────────────
   *
   * ×2 sulla statistica d'attacco, ma solo addosso a Pikachu.
   *
   * Trascritto da `damage_MASTER.js:1993-1997`, `calcAtMods` punto
   * `//i. 2.0x Items`, che spinge `0x2000`:
   *
   *     (attacker.item === "Light Ball" && (attacker.name === "Pikachu"
   *                                      || attacker.name === "Pikachu-Gmax"))
   *
   * ─── QUELLO CHE NON C'E', ED E' LA PARTE CHE CONTA ────────────────────────
   *
   * Nessun controllo di categoria. Le altre due voci dello STESSO `if` ce
   * l'hanno — Clava Ossea vuole `move.category === "Physical"`, Squamastrana
   * vuole `"Special"` — e Sferascintilla no: raddoppia l'Attacco sulle fisiche
   * E l'Attacco Speciale sulle speciali. Percio' qui NON c'e' `statType`, ed e'
   * un'assenza deliberata: aggiungerlo per simmetria con le sorelle dimezzerebbe
   * meta' dei casi. Misurato contro il riferimento su tutt'e due le categorie.
   *
   * ─── PERCHE' SOLO `pikachu` E NON ANCHE LA FORMA GIGAMAX ──────────────────
   *
   * Il riferimento nomina anche `Pikachu-Gmax`. Nel nostro dex le forme Gigamax
   * non esistono affatto — zero voci, misurato — quindi scrivere qui uno slug
   * `pikachu-gmax` non sarebbe una trascrizione ma uno slug inventato, che
   * nessun dato conferma e nessun test puo' falsificare. Il giorno che le forme
   * Gigamax entrano nel dex, questa lista si allunga di una riga.
   *
   * ─── PERCHE' NON E' `atkMult: 2` E BASTA ──────────────────────────────────
   *
   * Perche' senza `soloSpecie` il raddoppio andrebbe a chiunque tenga la
   * Sferascintilla, e il riferimento dice di no: su Raichu e su Pichu risponde
   * gli stessi identici sedici roll con e senza lo strumento.
   */
  'light ball':     { atkMult: 2, soloSpecie: ['pikachu'], showInSmogon: true },
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
  /**
   * ─── GLI ORBI LEGGENDARI ──────────────────────────────────────────────────
   *
   * ×1.2 su DUE tipi, e quali dipende dalla specie che li tiene:
   * Acciaio/Drago su Dialga, Acqua/Drago su Palkia, Spettro/Drago su Giratina,
   * Drago/Psico su Latias e Latios.
   *
   * Stesso `0x1333` degli incensi e di Carbonella, stessa catena — è il punto
   * k di `calcBPMods` (`damage_MASTER.js:1704`) — quindi meccanicamente sono
   * la cosa più vicina al lavoro già fatto. La differenza è che la coppia di
   * tipi non è una proprietà dello strumento: è una proprietà della COPPIA
   * strumento-specie, e viene da un `switch` che CADE.
   *
   * ─── PERCHE' QUI C'E' SOLO UN FLAG ────────────────────────────────────────
   *
   * Perché la tabella vera è ORDINATA, e l'ordine è la meccanica: sta in
   * `STRUMENTI_DOPPIO_TIPO` dentro `lib/rules.js`, con la matrice misurata che
   * la giustifica. Scriverla qui come `tipi: [...]` per orbo perderebbe la
   * caduta — e con lei il fatto che l'Orbo Bramoso addosso a Palkia dà il
   * bonus di PALKIA, che è quello che il riferimento calcola.
   *
   * `doppioTipo` è solo il segnale che l'effetto esiste: lo legge il motore
   * per entrare nel ramo, e `haEffetto` per togliere il segnalino.
   *
   * ─── E PERCHE' LA GEMMADANIMA E' QUI ADESSO ───────────────────────────────
   *
   * Perché è il QUARTO caso dello stesso `switch`, e i tre orbi ci cadono
   * dentro. Non era una voce di questa sessione — è entrata perché senza di
   * lei l'Orbo Bramoso su Latios avrebbe dato zero invece del ×1.2 che il
   * riferimento gli dà.
   *
   * L'altra metà della Gemmadanima — ×1.5 sull'Attacco Speciale (`:2001`) e
   * sulla Difesa Speciale (`:2121`) — NON resta da fare: tutt'e due i rami
   * sono chiusi da `gen <= 6`, e Champions gira a `gen = 10`
   * (`scripts/ncp/contesto.mjs:83`). Sono codice morto alla nostra
   * generazione, non un pezzo mancante — e questo è il motivo per cui la
   * Gemmadanima esce dal segnalino intera e non a metà.
   */
  'adamant orb':    { doppioTipo: true, showInSmogon: true },
  'lustrous orb':   { doppioTipo: true, showInSmogon: true },
  'griseous orb':   { doppioTipo: true, showInSmogon: true },
  'soul dew':       { doppioTipo: true, showInSmogon: true },
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

  /**
   * ─── I CINQUE INCENSI ─────────────────────────────────────────────────────
   *
   * Stessa meccanica esatta delle diciotto righe qui sopra, e il riferimento
   * non li distingue affatto: `getItemBoostType` (`item_data.js:496`) li mette
   * nello stesso `switch` di Carbonella e Acquamistica, e il ramo che li usa e'
   * lo stesso — `//k. 1.2x Items`, `damage_MASTER.js:1699`, `0x1333`, cioe'
   * esattamente `MOD.X1_2`.
   *
   * Mancavano e basta. Sono cinque dei trentanove strumenti col segnalino «non
   * calcolata», ed erano l'unico gruppo dove il lavoro era gia' fatto per altri
   * e non per loro.
   *
   * Tipi trascritti dal riferimento, non dedotti dal nome — Sea e Wave sono
   * entrambi Acqua, e Odd e' Psico, che dal nome non si indovina.
   */
  'rose incense':   { typBoost: TYPES.GRASS,    bpMod: MOD.X1_2, showInSmogon: true },
  'odd incense':    { typBoost: TYPES.PSYCHIC,  bpMod: MOD.X1_2, showInSmogon: true },
  'sea incense':    { typBoost: TYPES.WATER,    bpMod: MOD.X1_2, showInSmogon: true },
  'wave incense':   { typBoost: TYPES.WATER,    bpMod: MOD.X1_2, showInSmogon: true },
  'rock incense':   { typBoost: TYPES.ROCK,     bpMod: MOD.X1_2, showInSmogon: true },
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

  /**
   * ─── PALLONCINO ───────────────────────────────────────────────────────────
   *
   * L'unico strumento GENERICO dei trentanove: chiunque può tenerlo, quindi è
   * anche l'unico dove il numero sbagliato lo incontra chiunque.
   *
   * ─── E' FAMIGLIA A, NON B: MISURATO ───────────────────────────────────────
   *
   * L'ipotesi di partenza era che il riferimento non lo calcolasse e servisse
   * un'aggiudicazione. È falsa: lo calcola in DUE posti, e le due cose sono
   * indipendenti.
   *
   *   1. IMMUNITA' A TERRA — `damage_MASTER.js:1119`, dentro `immunityChecks`,
   *      `return damage: [0]`:
   *
   *          move.type === "Ground" && !field.isGravity
   *            && defender.item === "Air Balloon"
   *            && move.name !== "Thousand Arrows"
   *
   *   2. NON TOCCA IL TERRENO — `pIsGrounded` (`:1298`), che decide se i
   *      terreni si applicano:
   *
   *          field.isGravity || mon.item == "Iron Ball"
   *            || (mon.item != "Air Balloon" && !Levitate && !Flying)
   *            || field.isIngrain
   *
   * Non è la stessa condizione letta due volte: un Volante è NON ancorato ma è
   * immune a Terra per il tipo, e Levitate è non ancorata ma immunizza come
   * abilità. Il Palloncino fa tutt'e due le cose per conto suo, e nel
   * riferimento sono due righe in due funzioni diverse. Perciò due campi.
   *
   * ─── QUANTO SI SBAGLIAVA, MISURATO CONTRO L'ORACOLO ───────────────────────
   *
   *   Terremoto su chi ha il Palloncino     NCP 0        noi 43-51
   *   Fulmine, terreno elettrico            NCP 45-54    noi 58-70
   *   Pulsardragon, terreno nebbioso        NCP 22-27    noi 11-14
   *
   * La prima riga è la direzione peggiore: mostravamo un danno pieno dove il
   * gioco non ne fa nessuno.
   *
   * ─── LE TRE CASELLE CHE NON ABBIAMO ───────────────────────────────────────
   *
   * `isGravity` e `isIngrain` non esistono nel nostro campo, e l'Ferroball —
   * che nel riferimento ANCORA chi lo tiene, vincendo su Volante e Levitate —
   * qui non ha un campo suo: resta col segnalino «non calcolata», che è dove
   * sta già oggi. Sono tre assenze dichiarate, non tre dimenticanze: nessuna
   * delle tre è esprimibile nell'app, quindi nessun caso può contraddirle.
   */
  'air balloon':    { immuneTipo: TYPES.GROUND, nonAncorato: true, showInSmogon: true },

  /**
   * ─── POLVERE METALLICA ────────────────────────────────────────────────────
   *
   * ×2 sulla Difesa, ma solo addosso a Ditto e solo contro le mosse fisiche.
   *
   * Trascritto da `damage_MASTER.js:2125-2127`, `calcDefMods` ramo
   * `//g. 2.0x Items`, che spinge `0x2000`:
   *
   *     (defender.item === "Metal Powder" && defender.name === "Ditto"
   *                                       && hitsPhysical)
   *
   * ─── PERCHE' `defMult` E NON ANCHE `spdMult` ──────────────────────────────
   *
   * Perché il riferimento scrive `hitsPhysical`, e la Sferascintilla — l'altra
   * viva dello stesso gruppo — invece NON ha nessun controllo di categoria.
   * Sono due voci della stessa famiglia con due condizioni diverse, e la
   * simmetria fra loro è quella sbagliata da cui farsi guidare: qui la
   * categoria c'è, lì no. Misurato contro il riferimento su tutt'e due —
   * su una mossa speciale NCP risponde gli stessi identici sedici roll con e
   * senza la Polvere.
   *
   * ─── E PERCHE' SOLO `ditto` ───────────────────────────────────────────────
   *
   * Nello stesso `if` c'è anche la Perlamarina, che è di Clamperl: Champions
   * non ce l'ha, quindi resta col segnalino «non calcolata» — di proposito,
   * pronta per il giorno che la specie arriva.
   */
  'metal powder':   { defMult: 2, soloSpecie: ['ditto'] },

  // Pietrapiuma: dimezza il PESO. Non tocca nessuna catena — il peso serve
  // solo alle quattro mosse che ne ricavano la potenza (Low Kick, Grass Knot,
  // Heavy Slam, Heat Crash).
  //
  // Nel riferimento e' una riga di `getWeightMods` (`damage_MASTER.js:723`),
  // un `if` a se' che si somma a Heavy Metal e Light Metal.
  //
  // Klutz la spegne, e viene da se': `checkKlutz` gira PRIMA di
  // `getWeightMods` (`damage_SV.js:18` contro `:59`), quindi lo strumento e'
  // gia' sparito quando i pesi si calcolano. Da noi la chiave dello strumento
  // e' gia' quella passata per Klutz.
  'float stone':    { dimezzaPeso: true },

  // ── Resist Berries (×0.5 danno se il tipo della mossa corrisponde) ────────
  // Trattate come sempre attive (nessun tracking consumo)
  'colbur berry':   { resistBerry: TYPES.DARK     },
  'chople berry':   { resistBerry: TYPES.FIGHTING },
  // Mancava: era l'unica dei diciotto tipi con una resist berry a non avere
  // una riga qui, mentre `smogonString.js` la stampava già fra gli item
  // difensivi. Trovata in F-3 dall'inventario del motore.
  'kebia berry':    { resistBerry: TYPES.POISON   },
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
  // Qui c'era anche una riga `'slowbro-mega': { megaStone: 'slowbro-mega' }`:
  // lo slug di una SPECIE usato come chiave di uno strumento. Non poteva
  // servire a niente — `isStrumentoInamovibile` cerca in questa tabella la
  // chiave dello strumento tenuto, e nessuno strumento si chiama così — e
  // duplicava la riga sotto, che porta già la stessa mappatura.
  'slowbronite':        { megaStone: 'slowbro-mega'     },
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
  'feraligite':         { megaStone: 'feraligatr-mega'  },
  'emboarite':          { megaStone: 'emboar-mega'      },
  'dragoninite':        { megaStone: 'dragonite-mega'   },
  'chesnaughtite':      { megaStone: 'chesnaught-mega'  },
  'delphoxite':         { megaStone: 'delphox-mega'     },
  'greninjite':         { megaStone: 'greninja-mega'    },
  'excadrite':          { megaStone: 'excadrill-mega'   },
  'golurkite':          { megaStone: 'golurk-mega'      },
  'clefablite':         { megaStone: 'clefable-mega'    },
  'victreebelite':      { megaStone: 'victreebel-mega'  },
  'drampanite':         { megaStone: 'drampa-mega'      },
  'froslassite':        { megaStone: 'froslass-mega'    },
  'hawluchanite':       { megaStone: 'hawlucha-mega'    },
  'crabominite':        { megaStone: 'crabominable-mega'},
  'starminite':         { megaStone: 'starmie-mega'     },
  'chimechite':         { megaStone: 'chimecho-mega'    },
  'skarmorite':         { megaStone: 'skarmory-mega'    },
  'scovillainite':      { megaStone: 'scovillain-mega'  },
  'glimmoranite':       { megaStone: 'glimmora-mega'    },
  'chandelurite':       { megaStone: 'chandelure-mega'  },
  // `daForma`: la Mega si raggiunge dal Fiore Eterno, non dalla Floette base.
  // Il nome della forma Mega non lo dice — `floette-mega` comincia per
  // `floette` — quindi la regola per prefisso di calcEngine sbaglierebbe in
  // entrambi i versi. Trascritto da vendor/ncp/pokedex.js, che elenca
  // `"formes": ["Floette-Eternal", "Mega Floette"]` sull'Eterna e niente
  // sulla base.
  'floettite':          { megaStone: 'floette-mega', daForma: 'floette-eternal' },
  'meowsticite':        { megaStone: 'meowstic-mega'    },
  // M-B (Champions-exclusive)
  'barbaracite':        { megaStone: 'barbaracle-mega'  },
  'pyroarite':          { megaStone: 'pyroar-mega'      },
  'eelektrossite':      { megaStone: 'eelektross-mega'  },
  'staraptite':         { megaStone: 'staraptor-mega'   },
  'raichunite x':       { megaStone: 'raichu-mega-x'    },
  'raichunite y':       { megaStone: 'raichu-mega-y'    },
  'malamarite':         { megaStone: 'malamar-mega'     },
  'scraftinite':        { megaStone: 'scrafty-mega'     },
  'scolipite':          { megaStone: 'scolipede-mega'   },
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