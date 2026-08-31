// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { TYPES } from './typeChart.js'

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
  eelevateKOActive:      false, // Rapidascesa: ha messo KO — +1 alla stat più alta
}

/**
 * ─── SOLO MECCANICA, NIENTE TESTO ───────────────────────────────────────────
 *
 * Su cosa il motore ramifica: `atkMult`, `flashFireImmune`, `furCoat`,
 * `multiscale`, `filter`, `paradosso`, `intimidate`, `showInSmogon`… La logica
 * sta in `calcEngine.js` e `lib/preparazione.js`, che leggono questi flag
 * insieme ad `abilityFlags`.
 *
 * ─── PERCHÉ NON CI SONO PIÙ LE DESCRIZIONI ─────────────────────────────────
 *
 * Fino alla sessione T ogni voce portava anche `desc`, `descOn` e `descOff`:
 * 198 voci, di cui **153 senza un solo campo meccanico**. Una tabella di
 * meccaniche in cui l'ottantacinque per cento delle righe non conteneva
 * meccanica, e il cui testo era duplicato nei file di traduzione.
 *
 * Non era una ridondanza innocua. `AbilityFlags.jsx` leggeva la traduzione con
 * `defaultValue: ABILITY_EFFECTS[key]?.desc`, e una chiave PRESENTE nel locale
 * vince sul valore di ripiego: in R si è scoperto che 52 descrizioni inglesi
 * erano troncate al primo apostrofo, e la copia rotta faceva ombra
 * all'originale sano che stava proprio qui. Il difetto si è potuto correggere
 * solo perché la seconda copia era intera — la volta dopo poteva andare al
 * contrario.
 *
 * Ora il testo vive in un posto solo: `locales/*.json`. Qui restano 45 voci, e
 * tutte hanno una ragione meccanica per esserci.
 *
 * Prima di togliere le descrizioni è stato verificato che i due insiemi
 * coincidessero: quattro abilità esistevano SOLO qui — `ice-scales`,
 * `prism-armor`, `protosynthesis`, `quark-drive` — e per quelle un utente
 * italiano leggeva inglese, in silenzio. Sono state portate nei locali con la
 * loro traduzione prima di procedere.
 */
export const ABILITY_EFFECTS = {
  // ── Attaccante: moltiplicatori stat ──────────────────────────────────────
  'huge-power':  { atkMult: 2.0, statType: 'physical', showInSmogon: true },
  'pure-power':  { atkMult: 2.0, statType: 'physical', showInSmogon: true },

  // ── Attaccante: STAB potenziato ──────────────────────────────────────────
  'adaptability': { adaptability: true, showInSmogon: true },

  // ── Attaccante: boost tipo mossa ─────────────────────────────────────────
  //
  // Nel riferimento sono clausole in `or` dentro un solo `if` — `calcAtkMods`
  // punto d, «1.5x Offensive Abilities», `damage_MASTER.js:1941-1955` — che
  // spinge un solo `0x1800`. Cambia solo il tipo, quindi qui cambia solo il
  // valore del campo: nessuna delle sei ha una riga di motore sua.
  //
  // Fino alla sessione W Criniera Ardente aveva un flag col suo nome,
  // `fireMane`. Era il nome di UNA abilita' scritto nel motore per una regola
  // che ne governa sei: adesso e' il tipo, come le altre cinque.
  'fire-mane':     { boostTipoAtk: TYPES.FIRE,     showInSmogon: true },
  'dragons-maw':   { boostTipoAtk: TYPES.DRAGON,   showInSmogon: true },
  'steelworker':   { boostTipoAtk: TYPES.STEEL,    showInSmogon: true },
  'rocky-payload': { boostTipoAtk: TYPES.ROCK,     showInSmogon: true },

  // Sharpness e Gorilla Tactics stanno nello STESSO `if` delle quattro sopra e
  // spingono lo stesso `0x1800`, ma non guardano il tipo: la prima il flag
  // `isSlice` della mossa (`:1952`), la seconda la sua categoria (`:1953`).
  //
  // Le trenta mosse taglienti NON sono scritte qui: e' il flag `slicing` di
  // moves.json, che `gen-flag-dati.mjs` trascrive da `isSlice` del vendor.
  //
  // Su Gorilla Tactics il riferimento scrive `&& !attacker.isDynamax`: il
  // Dynamax non esiste in Champions e il motore non lo modella, quindi la
  // condizione qui non compare. E' l'unico pezzo dei sei che non trascriviamo,
  // e non perche' non torni: perche' non ha nulla su cui essere falso.
  'sharpness':       { sharpness: true,      showInSmogon: true },
  'gorilla-tactics': { gorillaTactics: true, showInSmogon: true },

  // Transistor NON e' nell'`if` delle sei: sta nell'`else if` successivo, e
  // vale meno.
  //
  // ─── IL PUNTO DOVE UNA LETTURA DISTRATTA SBAGLIA ─────────────────────────
  // Nel riferimento l'abilita' compare DUE volte, con due numeri diversi:
  //
  //     :1946   attacker.ability === "Transistor" && ... && gen == 8    0x1800
  //     :1965   attacker.ability === "Transistor" && ... && gen >= 9    0x14CD
  //
  // Il primo e' il ramo x1.5, il secondo quello x1.3. Il nostro contesto gira
  // a `gen = 10` (Champions, `scripts/ncp/contesto.mjs:83`), quindi vale il
  // SECONDO: x1.3. Chi cercasse «Transistor» e si fermasse alla prima riga
  // trovata darebbe un numero plausibile e sbagliato del quindici per cento.
  //
  // Ha un flag suo e non `boostTipoAtk` proprio per questo: sta in un ramo
  // diverso con un moltiplicatore diverso, e confonderlo con gli altri sei
  // sarebbe stato il modo piu' comodo per riprodurre l'errore.
  'transistor':  { transistor: true, showInSmogon: true },

  // Impeto Sabbia: x1.3 sulle mosse Roccia, Terra e Acciaio, ma SOLO con la
  // tempesta di sabbia in campo.
  //
  // Il motore la nominava gia', ma per un'altra cosa: `lib/damage.js` la mette
  // fra le abilita' immuni al danno da sabbia. Per questo
  // `classificazione-badge.mjs` la teneva come `meccanica-diversa` — il
  // segnalino «non calcolata» era corretto, perche' la meccanica che il
  // riferimento calcola e' un'ALTRA. Adesso ci sono tutt'e due.
  'sand-force':  { sandForce: true, showInSmogon: true },

  // ── Difensore: immunita' per famiglia di mossa ───────────────────────────
  //
  // Antisuono: le mosse sonore non hanno effetto. Nel riferimento sta in
  // `immunityChecks` (`damage_MASTER.js:1114`) accanto a Sap Sipper e
  // Bulletproof: esce con `damage: [0]`, cioe' e' un'immunita' vera e non una
  // riduzione.
  //
  // Le diciotto mosse sonore NON sono scritte nel motore: e' il flag `sound`
  // di moves.json, che `gen-flag-dati.mjs` trascrive da `isSound` del vendor.
  'soundproof':  { soundproof: true },

  // ── Le undici immunita' dello stesso `||` ────────────────────────────────
  //
  // Nel riferimento sono UNA condizione sola con un solo `return damage: [0]`
  // (`damage_MASTER.js:1107-1116`). Non sono riduzioni: la funzione esce, e
  // quello che l'utente deve leggere e' «non ha effetto», non un numero.
  //
  // Otto guardano il TIPO della mossa, quindi qui portano il tipo e non un
  // flag col loro nome: la regola e' una, cambia il valore.
  //
  //   Grass       Sap Sipper
  //   Fire        Well-Baked Body            (Flash Fire e' gia' scritta a parte)
  //   Water       Dry Skin, Water Absorb, Storm Drain
  //   Electric    Motor Drive, Volt Absorb, Lightning Rod
  //   Ground      Earth Eater                (Levitate ed Eelevate stanno sotto)
  //
  // Le altre tre guardano una famiglia di mosse, e la famiglia viene sempre da
  // un flag di moves.json trascritto dal vendor: mai da una lista scritta qui.
  //
  //   Bulletproof   flag `bullet`  (26 mosse, da `isBullet`)
  //   Wind Rider    flag `vento`   (14 mosse, da `isWind`)
  //   Soundproof    flag `sound`   (18 mosse, da `isSound`) — gia' sopra
  //
  // ─── QUATTRO NON SONO RAGGIUNGIBILI, E CI SONO LO STESSO ─────────────────
  // Well-Baked Body, Storm Drain, Wind Rider e Wonder Guard: nessuna specie
  // legale in M-B le porta. Ma sono clausole dello STESSO `||`, e sceglierne
  // otto su dodici dentro una condizione unica sarebbe stato decidere a mano
  // quale meta' del riferimento vale. Il giorno che la specie entra,
  // l'abilita' funziona senza toccare il motore.
  'sap-sipper':      { immuneTipo: TYPES.GRASS },
  'well-baked-body': { immuneTipo: TYPES.FIRE },
  'water-absorb':    { immuneTipo: TYPES.WATER },
  'storm-drain':     { immuneTipo: TYPES.WATER },
  'motor-drive':     { immuneTipo: TYPES.ELECTRIC },
  'volt-absorb':     { immuneTipo: TYPES.ELECTRIC },
  'lightning-rod':   { immuneTipo: TYPES.ELECTRIC },
  'earth-eater':     { immuneTipo: TYPES.GROUND },
  'bulletproof':     { immuneProiettili: true },
  'wind-rider':      { immuneVento: true },

  // Dry Skin ha due meta' che vanno in due punti diversi:
  //
  //   immunityChecks   (:1110)  immune all'Acqua, come Water Absorb
  //   calcBPMods i     (:1686)  x1.25 (0x1400) sulle mosse FUOCO
  //
  // La seconda e' un `else if` del punto h, che e' Heatproof prima della nona
  // generazione: a gen 10 h non scatta mai, quindi i si valuta sempre. La
  // catena e' trascritta com'e' lo stesso, perche' l'`else` e' la specifica.
  'dry-skin':        { immuneTipo: TYPES.WATER, debolePerIlFuoco: true },

  // Wonder Guard: passa SOLO il super efficace. Il riferimento scrive
  // `typeEffectiveness <= 1`, cioe' anche l'efficacia neutra e' annullata —
  // non e' una resistenza forte, e' un filtro.
  //
  // La clausola porta anche `move.type !== 'Typeless'` e un'eccezione di
  // quarta generazione su Fire Fang. Il primo non lo trascriviamo perche' non
  // abbiamo mosse senza tipo; la seconda perche' e' `gen !== 4` e noi siamo a
  // 10. Sono le uniche due parti di questo `||` che restano fuori, e restano
  // fuori perche' non hanno nulla su cui essere vere.
  'wonder-guard':    { wonderGuard: true },

  // Damp: quattro mosse non partono proprio (`damage_MASTER.js:1138`). Vale da
  // TUTT'E DUE i lati — chi ce l'ha le spegne anche a se' stesso — e i quattro
  // nomi stanno in `MOSSE_ANNULLATE_DA_DAMP` dentro `lib/rules.js`, perche' nel
  // vendor non c'e' un flag da trascrivere ma un elenco.
  'damp':            { damp: true },

  // Le tre che azzerano le mosse con priorita'. Nel riferimento sono un solo
  // ramo di `immunityChecks` (`damage_MASTER.js:1155`) e un solo
  // `return damage: [0]`: qui un flag solo per tutt'e tre, perche' la
  // condizione e' identica e non c'e' niente che le distingua.
  //
  // `prioritaria` viene dal flag di moves.json, trascritto da `isPriority` del
  // vendor. NON e' il campo `priority` che avevamo gia': quello e' un numero
  // e ce l'hanno anche Protect e Follow Me, che al danno non arrivano.
  'armor-tail':      { bloccaPriorita: true },
  'queenly-majesty': { bloccaPriorita: true },
  'dazzling':        { bloccaPriorita: true },

  // ── Le tre che governano la bacca di resistenza ──────────────────────────
  //
  // Stanno tutte e tre nella STESSA riga del riferimento — `calcFinalMods`
  // punto q, `damage_MASTER.js:2405` — e il motore quella riga ce l'ha gia':
  // dimezza il danno quando la bacca combacia col tipo della mossa.
  //
  //   Unnerve / As One  sull'ATTACCANTE: la bacca non si attiva affatto.
  //                     Nel riferimento sono due nomi nella stessa condizione.
  //   Ripen             sul DIFENSORE: la bacca vale il doppio, cioe' `0x400`
  //                     invece di `0x800` — un quarto del danno, non la meta'.
  'unnerve':     { impedisceBacca: true },
  'as-one':      { impedisceBacca: true },
  'ripen':       { raddoppiaBacca: true },

  // ── I due versi di Imprudenza ────────────────────────────────────────────
  //
  // Un flag solo, perche' nel riferimento e' la stessa abilita' letta da due
  // funzioni diverse:
  //
  //   calcAttack punto b   (riga 1870)  il DIFENSORE con Imprudenza ignora i
  //                                     boost d'attacco di chi lo colpisce
  //   calcDefense punto c  (riga 2039)  l'ATTACCANTE con Imprudenza ignora i
  //                                     boost di difesa del bersaglio
  //
  // Farne uno solo sarebbe stato meta' abilita' con l'aria di essere intera.
  'unaware':     { unaware: true, showInSmogon: true },

  // ── Attaccante: boost mosse contatto ─────────────────────────────────────
  'tough-claws': { toughClaws: true, showInSmogon: true },

  // ── Attaccante: boost per famiglia di mossa ──────────────────────────────
  //
  // Megalancio: x1.5 sulle mosse-impulso. Nel riferimento e' una delle sei
  // abilita' raccolte in un solo ramo — `damage_MASTER.js:1668`, «1.5x
  // Abilities» — insieme a Technician, Flare Boost, Toxic Boost, Strong Jaw e
  // Steely Spirit. Delle sei questa e' la prima che implementiamo, e non per
  // completezza: e' la prima che tocca un set del meta, il Mega Blastoise con
  // Dark Pulse.
  //
  // Quali mosse siano «impulso» NON e' scritto qui: e' il flag `pulse` di
  // moves.json, che `gen-flag-dati.mjs` trascrive da `isPulse` del vendor.
  // Una lista a mano in questo file sarebbe la tabella che marcisce.
  'mega-launcher': { megaLauncher: true, showInSmogon: true },

  // Ferromascella: x1.5 sulle mosse di morso. Nel riferimento e' nello STESSO
  // `if` di Megalancio — `damage_MASTER.js:1668`, le sei «1.5x Abilities» — e
  // spinge lo stesso `0x1800` nella stessa catena. Cambia solo la condizione.
  //
  // Le nove mosse di morso NON sono scritte qui: e' il flag `bite` di
  // moves.json, che `gen-flag-dati.mjs` trascrive da `isBite` del vendor.
  'strong-jaw':  { strongJaw: true, showInSmogon: true },

  // Ingegno Acciaio: x1.5 sulle mosse Acciaio. Terza delle sei dello stesso
  // ramo, e ultima raggiungibile per ora — delle altre due, Flare Boost vuole
  // lo stato «bruciato» e Toxic Boost «avvelenato», che non modelliamo.
  //
  // Nel riferimento compare DUE volte con lo stesso 0x1800: al punto g quando
  // ce l'ha chi attacca, e al punto d.iii come `field.isSteelySpirit` quando
  // ce l'ha un ALLEATO. Qui c'e' solo la prima: la seconda e' una casella di
  // campo che non abbiamo, come Battery e Power Spot — e infatti tutt'e tre
  // restano nelle 108 per quella meta'.
  'steely-spirit': { steelySpirit: true, showInSmogon: true },

  // Tecnico: x1.5 sulle mosse con potenza base fino a 60. Quarta e ultima
  // FATTIBILE delle sei del ramo — Flare Boost e Toxic Boost vogliono gli
  // stati, che non modelliamo.
  //
  // E' l'unica delle sei la cui condizione non guarda la mossa ma il NUMERO:
  // «60 o meno» si misura sulla potenza GIA' passata per i modificatori
  // precedenti, non su quella scritta nei dati. Il riferimento lo dice con un
  // commento e con una riga (`damage_MASTER.js:1665`):
  //
  //     //If the BP before this point would trigger Technician, don't apply it
  //     var tempBP = pokeRound(basePower * chainMods(bpMods) / 0x1000);
  //
  // Da qui una conseguenza che vale la pena scrivere: fino a oggi l'ORDINE
  // dei push nella catena della potenza non era osservabile — con pochi
  // modificatori `chainMods` e' commutativo. Adesso lo e'. Un'aura messa dopo
  // Tecnico invece che prima cambierebbe `tempBP` e quindi la soglia.
  'technician':  { technician: true, showInSmogon: true },

  // ── Attaccante: catena della POTENZA, non della statistica ───────────────
  //
  // Iron Fist e Reckless stanno nella stessa riga del riferimento — un solo
  // `else if` con un solo `bpMods.push(0x1333)`, `damage_MASTER.js:1604` — e
  // quel ramo e' l'ALTERNATIVA di Galvanize e compagnia (punto c.i): se la
  // mossa e' stata convertita di tipo, il x1.2 del pugno non si somma.
  //
  // Il moltiplicatore e' 0x1333, cioe' x1.2. Non 0x14CD: quello e' il x1.3 del
  // punto e, e i due si somigliano abbastanza da scambiarsi senza far rumore.
  //
  // Le ventidue mosse-pugno e le sedici col contraccolpo NON sono scritte qui:
  // sono i flag `punch` e `rinculo` di moves.json, trascritti da `isPunch` e
  // da `hasRecoil || recoilHP || hasCrash`.
  'iron-fist':   { ironFist: true, showInSmogon: true },
  'reckless':    { reckless: true, showInSmogon: true },

  // ── Punk Rock, che compare due volte con due segni opposti ───────────────
  //
  //   calcBPMods punto e.v    (:1649)  chi ATTACCA: mosse sonore x1.3
  //   calcFinalMods punto i   (:2370)  chi DIFENDE: mosse sonore x0.5
  //
  // Sono due punti diversi di due funzioni diverse. Un flag solo con due letture
  // nel motore, come Unaware: farne meta' sarebbe stata un'abilita' che
  // funziona solo quando conviene.
  //
  // Il ramo offensivo e' l'ultimo degli `else if` del punto e, quindi non si
  // somma a Sheer Force, Sand Force, Analytic e Tough Claws. Quello difensivo
  // e' un `if` a se' e si somma a tutto.
  'punk-rock':   { punkRock: true, showInSmogon: true },

  // ── Attaccante: modificatori FINALI ──────────────────────────────────────
  //
  // Tre abilita' che agiscono sull'ultimo anello, dopo la potenza e dopo le
  // statistiche. Nel riferimento sono tre `if` separati e indipendenti
  // (`calcFinalMods` punti b, d, e) — quindi si sommano fra loro: un critico
  // poco efficace di chi ha Tinted Lens e Sniper prende tutt'e due.
  //
  //   Neuroforce    (:2336)  x1.25 (0x1400) se l'efficacia e' maggiore di 1
  //   Sniper        (:2346)  x1.5  (0x1800) sul colpo critico
  //   Tinted Lens   (:2351)  x2    (0x2000) se l'efficacia e' minore di 1
  //
  // Le soglie sono scritte sull'efficacia GREZZA, non sul suo logaritmo: il
  // riferimento confronta `typeEffectiveness` con 1. Su una mossa immune
  // l'efficacia e' 0, quindi minore di 1 — ma li' non si arriva, perche'
  // l'immunita' esce prima con `damage: [0]`.
  'neuroforce':  { neuroforce: true, showInSmogon: true },
  'sniper':      { sniper: true, showInSmogon: true },
  'tinted-lens': { tintedLens: true, showInSmogon: true },

  // Skill Link: le mosse multi-colpo colpiscono sempre il massimo.
  //
  // NON e' un moltiplicatore e non tocca la catena della potenza: agisce sul
  // numero di colpi, che e' un concetto del motore solo da poco. Prima non
  // c'era niente su cui potesse agire.
  //
  // ─── LA FONTE, CHE PER UN PO' NON C'E' STATA ─────────────────────────────
  //
  // Il riferimento NON la nomina nel codice del danno: sta solo nel pokedex
  // come abilita' di una specie. Quando questa riga e' stata scritta l'effetto
  // era quindi DEDOTTO, e la deduzione e' rimasta dichiarata finche' Simone non
  // ha fornito la fonte:
  //
  //     «Abillegame permette alle mosse multicolpo di mandare a segno sempre
  //      il massimo dei colpi possibili.»
  //     wiki.pokemoncentral.it/Abillegame, sezione Effetti
  //
  // Coincide con quello che il motore fa. La fonte e' una wiki e non il
  // riferimento eseguibile, quindi qui non c'e' un confronto roll per roll: e'
  // il grado di verifica piu' alto disponibile per questa abilita', non il
  // grado di verifica normale del progetto.
  //
  // ─── QUELLO CHE LA FONTE DICE E NOI NON FACCIAMO ─────────────────────────
  //
  // La stessa voce aggiunge che dalla quinta generazione l'abilita' vale anche
  // per Triplocalcio e Triplo Axel. Da noi no, e non per svista: quelle due
  // hanno `potenzaCrescente` — la potenza sale a ogni colpo — e il motore le
  // tiene fuori dal modello dei colpi multipli proprio perche' quella
  // meccanica non c'e'. Su Infestazione invece l'abilita' vale, ed e' il caso
  // che conta per il meta.
  'skill-link':  { skillLink: true },

  // Parental Bond: la mossa colpisce due volte, la seconda a un quarto.
  //
  // Non e' un moltiplicatore: e' un secondo COLPO, con un danno suo. La
  // meccanica dei colpi multipli che il motore ha gia' non basta, perche'
  // quella assume colpi identici — Infestazione tira dieci volte lo stesso
  // tiro. Qui i due colpi sono diversi, e il secondo si calcola a parte.
  //
  // Fonte del meccanismo: `damage_MASTER.js`, tre punti —
  //   :2456  la condizione (non gia' multi-colpo, e un bersaglio solo)
  //   :2493  il secondo colpo, con l'abilita' dell'attaccante azzerata
  //   :2160  `childMod = 0x0400`, applicato al danno base
  //
  // Confermato dalla wiki, che per la settima generazione in poi dice «un
  // quarto del danno». Le due fonti coincidono sul numero.
  //
  // Le quattro mosse su cui il gioco NON la attiva e il riferimento si' stanno
  // in `MOSSE_SENZA_PARENTAL_BOND`, in lib/rules.js, con la fonte accanto.
  'parental-bond': { parentalBond: true, showInSmogon: true },

  // ── Le due aure: x1.33 sulle mosse del proprio tipo, da qualunque lato ───
  //
  // `aura` porta il TIPO, non un booleano, perche' il ramo del motore e' uno
  // solo per tutt'e due: cambia il tipo che deve combaciare con quello della
  // mossa. Il riferimento fa lo stesso — `damage_MASTER.js:1654` non nomina
  // ne' l'una ne' l'altra, guarda `move.type`.
  //
  // Perche' il registro del divario non le vedeva: in NCP il nome dell'abilita'
  // e' COSTRUITO a runtime (`attacker.ability === (move.type + " Aura")`,
  // riga 1568), quindi le stringhe "Fairy Aura" e "Dark Aura" non compaiono
  // mai nel codice che il generatore legge. Esistono solo dentro un commento,
  // e `gen-gap-noti.mjs` i commenti li scarta di proposito — con ragione, e la
  // ragione e' scritta a riga 61 di quel file. Due difese corrette, e queste
  // due abilita' cadevano nel varco fra loro. L'ha trovate
  // `descrizioniSilenziose.test.js`, guardando da un terzo lato: non cosa fa
  // il riferimento, ma cosa l'app dice di se'.
  //
  // Nota sul lato: l'aura vale per CHIUNQUE sia in campo, non solo per chi
  // attacca. Il motore guarda percio' l'abilita' di tutti e due.
  'fairy-aura': { aura: TYPES.FAIRY, showInSmogon: true },
  'dark-aura':  { aura: TYPES.DARK,  showInSmogon: true },

  // ── Attaccante: boost condizionale (stato) ───────────────────────────────
  'flash-fire':  { flashFireImmune: true, showInSmogon: true
    
    
    },

  'supreme-overlord': { supremeOverlord: true, showInSmogon: true
    },

  'multiscale':     { multiscale: true
    
    
    },

  'shadow-shield':  { multiscale: true
    
    
    },

  'intimidate':  { intimidate: true
    
    
    },

  'defiant':     { defiant: true
    
    
    },

  'contrary':    { contrary: true, intimidateInverte: true
    
    
    },

  'competitive': { competitive: true
    
    
    },

  // ── Meteo: Modifica le statistiche ─────────────────────────
  'sand-rush':     { sandRush: true
    
    
    },

  'chlorophyll':   { speedWeather: true
    
    
    },

  'swift-swim':    { speedWeather: true
    
    
    },

  'slush-rush':    { speedWeather: true
    
    
    },

  // ── Immunita' alle mosse Terra ───────────────────────────────────────────
  //
  // `levitate` e' un flag e non piu' un confronto per nome, perche' adesso ce
  // l'hanno in due. `eelevate` e' RAPIDASCESA, che esiste solo in Champions —
  // Eelektross Mega, due set del meta — e la cui prima meta' e' la stessa cosa
  // di Levitate: «Immunizza alle mosse Terra».
  //
  // ─── L'ORACOLO C'E', ED E' STATA UNA SORPRESA ────────────────────────────
  // La sessione era partita dall'idea che NCP non conoscesse Rapidascesa,
  // essendo un'abilita' di Champions, e che quindi non fosse verificabile.
  // E' falso, e il riferimento lo dice in due punti:
  //
  //     damage_MASTER.js:1112  immunityChecks — ['Levitate','Eelevate']
  //     damage_MASTER.js:1298  pIsGrounded    — ['Levitate','Eelevate']
  //
  // Quindi si verifica roll per roll come le aure, e lo fa
  // `rapidascesa.test.js`.
  //
  // ─── ALLORA PERCHE' NON ERA NELLE 108 ────────────────────────────────────
  // Per un terzo motivo, diverso da quello delle aure: l'universo del registro
  // e' `abilities.json`, e `abilities.json` non aveva questa riga. Il
  // generatore non l'ha «persa»: non gliel'ha mai vista passare davanti.
  //
  // Misurato: con la riga nel listino e senza questa voce, `npm run gap:report`
  // la trova e le 108 diventano 109, canale STR, prova
  // `damage_MASTER.js:1298`. Con questa voce restano 108 perche' adesso la
  // calcoliamo.
  //
  // ─── LA SECONDA META' NON C'E' ───────────────────────────────────────────
  // «Aumenta la statistica piu' alta di 1 grado quando mette KO un avversario»
  // e' uno stato che l'utente imposta a mano, come Aegislash, Morpeko e
  // Palafin — non un ramo del motore, e non si inventa un pezzo d'interfaccia
  // che nessuno ha deciso. NCP la chiama «Levitate + Beast Boost»
  // (`ability_data.js:345`) e nemmeno lui calcola quella meta': `beast boost`
  // e' selezionabile da noi, senza effetto, e NON e' fra le 108 — cioe' il
  // registro ha misurato che nemmeno il riferimento la calcola nel danno.
  //
  // Non e' un ramo del motore: e' uno STATO, e vive nello strato di
  // preparazione insieme a Intrepid Sword e Download, con l'interruttore
  // `eelevateKOActive` che l'utente accende nell'editor. Il boost va alla
  // statistica piu' alta, che `setHighestStat` calcola gia' per le abilita'
  // paradosso — e la calcola PRIMA del +1, come dev'essere: non si sceglie la
  // statistica in base a un potenziamento che si sta per applicare.
  'levitate':    { levitate: true },
  'eelevate':    { levitate: true, boostStatPiuAltaSuKO: true },
  // ── Lo strato di preparazione (sessione J) ────────────────────────────────
  //
  // Queste abilità non stanno in nessuna delle quattro catene di
  // moltiplicatori: agiscono PRIMA, in `lib/preparazione.js`, spostando gli
  // stadi di boost o accendendo un flag. Il danno cambia di conseguenza.
  //
  // ─── I QUATTRO FLAG DI INTIMIDATE ─────────────────────────────────────────
  // Sono i quattro rami di `checkIntimidate` (damage_MASTER.js:559), nello
  // stesso ordine in cui il vendore li valuta:
  //
  //   intimidateInverte   il calo diventa +1        Contrary · Guard Dog
  //   intimidateAnnulla   nessun calo               Clear Body e compagnia
  //   intimidateRimbalza  il calo torna al mittente Mirror Armor
  //   simple              il calo raddoppia         Simple
  //
  // L'ordine conta e non è quello che verrebbe in mente: Contrary e Guard Dog
  // vengono valutate per PRIME, quindi hanno la meglio sul Clear Amulet ma non
  // su Mirror Armor. Nel vendore c'è un commento che dice «for some reason»:
  // è una stranezza del gioco, non una regola con una logica dietro.

  'guard-dog':        { intimidateInverte: true
    },
  'full-metal-body':  { intimidateAnnulla: true
    },
  'simple':           { simple: true
    },

  // Intrepid Sword e Dauntless Shield: +1 alla statistica indicata entrando in
  // campo. `boostIngresso` contiene la chiave della statistica, non un
  // booleano, così l'implementazione è una riga sola per entrambe.
  //
  // In Champions si applicano SEMPRE. La condizione del vendore è
  // `gen !== 9 || abilityOn`, e `gen` vale 10: la prima metà è già vera, il
  // flag dell'interfaccia non viene mai letto. Legare il comportamento a un
  // interruttore che il riferimento ignora produrrebbe due numeri diversi
  // dallo stesso stato di gioco.
  'intrepid-sword':   { boostIngresso: 'at'
    },
  'dauntless-shield': { boostIngresso: 'df'
    },

  // Download: +1 Attacco o +1 Att. Speciale a seconda di quale difesa
  // avversaria è più bassa. Confronta le difese GIÀ modificate dai boost —
  // quindi anche da quelli che Intimidate e Dauntless Shield hanno appena
  // messo, perché nel vendore Download viene dopo.
  'download':         { download: true
    },

  // Protosynthesis e Quark Drive: ×1.3 alla statistica più alta (×1.5 se è la
  // Velocità, che nel danno non si vede). Il valore del campo dice cosa le
  // accende: il sole per la prima, il campo elettrico per la seconda. La
  // Booster Energy le accende entrambe.
  //
  // ─── IL SOLE ESTREMO NON LE ACCENDE ───────────────────────────────────────
  // Nel vendore la condizione è `weather === 'Sun'`, un confronto esatto, non
  // l'`indexOf("Sun")` che altrove fa passare anche il Sole Estremo di
  // Desolate Land. Trascritto com'è: se un giorno si scoprirà che il gioco
  // fa diversamente, il posto dove cambiarlo è uno solo.
  'protosynthesis':   { paradosso: 'sun'
    
    
    },
  'quark-drive':      { paradosso: 'electric'
    
    
    },

  // ─── PERCHÉ RATTLED NON È QUI ─────────────────────────────────────────────
  // `checkIntimidate` le dà +1 Velocità, e la preparazione lo calcola davvero
  // (vedi `lib/preparazione.js`). Ma la Velocità non passa da qui: il ⚡ della
  // matrice la ricava da `utils/speedOrder.js`, che non chiama la
  // preparazione. Finché è così, Rattled non sposta nessun numero che l'app
  // mostri — quindi resta senza voce, e il badge «non calcolata» le resta
  // addosso. Dargliela adesso toglierebbe il badge a fronte di niente, che è
  // esattamente la bugia che la sessione F-2 è servita a eliminare.

  // ── Descrizioni informative (nessun effetto sul calcolo) ──────────────────
  'clear-body': { intimidateAnnulla: true },
  'filter': { filter: true, showInSmogon: true },
  'fluffy': { fluffy: true, showInSmogon: true },
  'ice-scales': { iceScales: true, showInSmogon: true },
  'prism-armor': { filter: true, showInSmogon: true },
  'fur-coat': { furCoat: true, showInSmogon: true },
  'heatproof': { heatproof: true, showInSmogon: true },
  'hyper-cutter': { intimidateAnnulla: true },
  // Sessione G: attivata la parte che tocca il danno — ignora gli schermi.
  // Safeguard e substitute non sono modellati dal motore, quindi restano
  // soltanto descritti. Niente `showInSmogon`, per lo stesso motivo per cui
  // non ce l'ha `levitate`: cambia il numero solo in presenza di uno schermo.
  'infiltrator': { infiltrator: true },
  'inner-focus': { intimidateAnnulla: true },
  'mirror-armor': { intimidateRimbalza: true },
  'oblivious': { intimidateAnnulla: true },
  'own-tempo': { intimidateAnnulla: true },
  'purifying-salt': { purifyingSalt: true, showInSmogon: true },
  'scrappy': { intimidateAnnulla: true },
  'solid-rock': { filter: true, showInSmogon: true },
  'thick-fat': { thickFat: true, showInSmogon: true },
  'water-bubble': { waterBubble: true, showInSmogon: true },
  'white-smoke': { intimidateAnnulla: true },
}