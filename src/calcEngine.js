// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import pokemonData from './data/pokemon.json'
import movesData from './data/moves.json'
import { getEffectiveness, hasSTAB, TYPES } from './data/typeChart.js'
import { ITEM_EFFECTS } from './data/itemEffects.js'
import { ABILITY_EFFECTS, normalizeAbilityKey } from './data/abilityEffects.js'
import { IS_DEBUG, publishDebugLog } from './lib/debugBus.js'
import {
  LEVEL,
  MAX_SP_TOTAL,
  SCREEN_MOD,
  SCREEN_BYPASS_MOVES,
  applyBoost,
  normalizzaMeteo,
  totalSPs,
  STAT_HP, STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD,
  ABILITA_ATE,
  MOSSE_SENZA_PARENTAL_BOND,
  tipoPallaClima,
} from './lib/rules.js'
import { pokeRound, chainMods, daDecimale, MOD, FIXED_POINT } from './lib/modifiers.js'
import { calcStat, getBaseStat } from './lib/stats.js'
import { preparaCoppia } from './lib/preparazione.js'

/**
 * Supreme Overlord: un moltiplicatore di potenza per ogni alleato caduto.
 * I valori sono quelli di NCP (`calcBPMods` punto y), non 1+n×0.1 calcolato.
 */
const SUPREME_OVERLORD_BP = [0x119A, 0x1333, 0x14CD, 0x1666, 0x1800]

const POKEMON_DATA = pokemonData
const MOVE_DATA = movesData

// Le costanti di regola, le tabelle boost e il calcolo delle statistiche vivono
// in `lib/rules.js` e `lib/stats.js` dalla sessione C — vedi gli import in cima.

/**
 * Segnala uno spread illegale, ma solo a debug acceso.
 *
 * Il controllo sta nel percorso caldo: con 36 celle × 4 direzioni × 4 mosse
 * può sparare centinaia di righe per render. Il vincolo dei 66 SP non è
 * ancora mostrato all'utente da nessuna parte nell'interfaccia — è un punto
 * aperto della sessione F.
 */
function validateSPs(sps, debug) {
  if (!debug) return
  const total = totalSPs(sps)
  if (total > MAX_SP_TOTAL) {
    console.warn(`SP totali (${total}) superano il massimo di ${MAX_SP_TOTAL}`)
  }
}

/**
 * Uno strumento è inamovibile solo per il Pokémon a cui appartiene.
 *
 * Oggi in Champions l'unico caso sono le Megapietre, ma la domanda giusta non
 * è «questo è una Megapietra?» — è «questo strumento si può togliere a QUESTO
 * Pokémon?». La differenza conta già adesso (Gholdengo con la Garchompite se
 * la fa strappare) e conterà di più quando arriveranno i leggendari: Orbo Alfa
 * e Omega, Orbo Platino, le Tavole con Multitipo, le Memorie con Sistema Alfa,
 * le Unità di Genesect seguono tutte la stessa regola. Scritto così, aggiungere
 * quei casi vorrà dire aggiungere righe qui dentro e nient'altro.
 *
 * `ITEM_EFFECTS[x].megaStone` contiene già lo slug della FORMA Mega
 * (`'garchomp-mega'`, `'charizard-mega-x'`). Confrontiamo con il prefisso
 * perché il difensore può essere:
 *
 *   - la forma base            `garchomp`        → `garchomp-mega` comincia per `garchomp-mega`
 *   - una delle due Mega       `charizard`       → `charizard-mega-x` comincia per `charizard-mega`
 *   - già la forma Mega        `garchomp-mega`   → coincidono
 *
 * @param {string} itemKey  chiave strumento minuscola
 * @param {string} pokeKey  slug del Pokémon che lo tiene
 * @returns {boolean} true se lo strumento NON può essere rimosso
 */
function isStrumentoInamovibile(itemKey, pokeKey) {
  const eff = ITEM_EFFECTS[itemKey]
  const formaMega = eff?.megaStone
  if (!formaMega || !pokeKey) return false

  // ─── QUANDO IL PREFISSO NON BASTA ────────────────────────────────────────
  //
  // La regola per prefisso vale per ottantuno Megapietre su ottantadue,
  // perché di norma la forma Mega si chiama come la base più `-mega`. Floette
  // è l'eccezione: la Mega si raggiunge dal **Fiore Eterno**, che nel nostro
  // schema è `floette-eternal`, mentre `floette-mega` comincia per `floette`.
  //
  // Senza questa riga il prefisso sbaglia in ENTRAMBI i versi: dava la Mega
  // alla Floette base (che non può) e la negava all'Eterna (che può). Non è
  // una deduzione nostra — `vendor/ncp/pokedex.js` lo scrive:
  //
  //     "Floette-Eternal": { … "formes": ["Floette-Eternal", "Mega Floette"] }
  //     "Floette":         { … "canEvolve": true }        ← nessun `formes`
  //
  // `daForma` dichiara la base quando non si deduce dal nome. Il giorno in
  // cui arriva un'altra forma così, si aggiunge una riga in ITEM_EFFECTS e
  // nient'altro.
  if (eff.daForma) return eff.daForma === pokeKey || formaMega === pokeKey

  return formaMega === pokeKey || formaMega.startsWith(`${pokeKey}-mega`)
}

/**
 * Il nome da mostrare per un'abilità, ricavato dalla chiave.
 *
 * Serve all'immunità alle mosse Terra, che lo restituisce a `DamageTable` per
 * scrivere «Immune (Levitate)». Prima era una stringa scritta a mano: con una
 * sola abilità nel ramo funzionava, con Rapidascesa che entra accanto a
 * Levitate no — avrebbe detto «Levitate» a chi ha scelto Rapidascesa. Sul
 * nome di prima il risultato è identico.
 */
const nomeAbilita = (chiave) =>
  String(chiave || '').split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')

/**
 * `levitate` NON è più confrontato per nome.
 *
 * Il flag `levitate` di ABILITY_EFFECTS ce l'hanno due abilità: Levitate e
 * Rapidascesa (`eelevate`), che in Champions immunizza alle mosse Terra
 * esattamente allo stesso modo. Con il confronto per chiave, la seconda non
 * sarebbe stata immune — e il numero mostrato sarebbe stato un danno pieno
 * invece di zero, cioè l'errore nella direzione peggiore.
 */
function isGrounded(pokeData, abilEffect) {
  if (pokeData.type.includes(TYPES.FLYING)) return false
  if (abilEffect?.levitate) return false
  return true
}

export function calculateDamage({ attacker, defender, move, field = {}, debug = IS_DEBUG }) {
  const {
    atkPokemon,
    atkSPs = [0,0,0,0,0,0],
    atkNature = null,
    atkAbility = null,
    atkItem = null,
    atkBoost = 0,
    spAtkBoost = 0,
    atkDefBoost = 0,
    // Gli altri due stadi dell'attaccante. Nessuna mossa li usa per attaccare,
    // ma la preparazione sì: `statPiuAlta` confronta tutte e cinque le
    // statistiche, e senza questi due un Pokémon paradosso potrebbe vedersi
    // assegnare il potenziamento alla statistica sbagliata.
    atkSpDefBoost = 0,
    atkSpeBoost = 0,
    atkAbilityFlags = {},
    lastRespectsKOs = 0,
    // Quante volte colpisce una mossa multi-colpo. Come `lastRespectsKOs`:
    // uno stato che dichiara chi usa l'app, non un numero che il motore possa
    // dedurre. `null` significa «non l'ha scelto», e allora si usa il massimo.
    colpiScelti = null,
    level = LEVEL,
  } = attacker

  const {
    defPokemon,
    defSPs = [0,0,0,0,0,0],
    defNature = null,
    defAbility = null,
    defItem = null,
    defBoost = 0,
    spDefBoost = 0,
    // Idem per il difensore: l'Attacco gli serve se qualcuno gli rimanda
    // addosso un Intimidate con Mirror Armor, e la Velocità per la statistica
    // più alta.
    defAtkBoost = 0,
    defSpAtkBoost = 0,
    defSpeBoost = 0,
    defAbilityFlags = {},
  } = defender

  validateSPs(atkSPs, debug)
  validateSPs(defSPs, debug)

  const moveData = MOVE_DATA[move]
  if (!moveData || !moveData.power) return null

  const atkPokeData = POKEMON_DATA[atkPokemon]
  const defPokeData = POKEMON_DATA[defPokemon]
  if (!atkPokeData || !defPokeData) return null

  // ── Il meteo, normalizzato una volta sola ────────────────────────────────
  // Da qui in giù `meteo` è uno dei sei nomi canonici oppure null. Nessun
  // altro punto del motore legge `field.weather`: se lo facesse, tornerebbe a
  // vedere le forme grezze — `hail`, `sandstorm`, un `HAIL` maiuscolo — e
  // ricomincerebbe la storia dei sinonimi sparsi.
  const meteo = normalizzaMeteo(field.weather)

  // ── Weather Ball: tipo e BP cambiano in base al meteo ────────────────────
  // Senza meteo: Normal BP 50 — Con meteo: tipo corrispondente BP 100
  // Tabella e regola stanno in `lib/rules.js` dalla sessione Q: la stessa
  // domanda serve al motore, al badge del tipo mossa e al riquadro delle -ate.
  const isWeatherBall = move === 'weather ball'
  const weatherBallType = tipoPallaClima(move, meteo)
  let moveType = weatherBallType !== null ? weatherBallType : moveData.type
  const isLastRespects = move === 'last respects'
  const lastRespectsBP = isLastRespects ? 50 + (Math.min(3, Math.max(0, lastRespectsKOs)) * 50) : null
  const effectiveBP    = isLastRespects ? lastRespectsBP
    : isWeatherBall && weatherBallType !== null ? 100
    : moveData.power
  const atkTypes = atkPokeData.type
  const defTypes = defPokeData.type
  // Il contatto "grezzo", quello scritto nei dati della mossa. Il contatto
  // EFFETTIVO si decide più sotto, dopo aver letto lo strumento: Punching
  // Glove, Protective Pads e Long Reach lo tolgono.
  const isContactBase = moveData.contact === true
  const isPunch = moveData.punch === true
  const isPulse = moveData.pulse === true
  const isSound = moveData.sound === true
  const isPrioritaria = moveData.prioritaria === true
  const isBite  = moveData.bite === true
  const isSpread  = moveData.spread === true

  const isSpecial = moveData.category === 1
  // Body Press: mossa fisica che usa la Def dell'attaccante invece dell'Atk.
  //
  // ─── LA REGOLA PER INTERO (Bulbapedia, "Body Press (move)") ──────────────
  // Cambia SOLO da dove si legge la statistica e quali stage si applicano:
  // valgono quelli di Difesa, non quelli di Attacco. Tutto il resto resta il
  // corredo OFFENSIVO dell'utente — strumento, abilità e bruciatura inclusi.
  //
  //   sì  → Huge Power, Choice Band, Slow Start, Defeatist  (modificano l'attacco)
  //   no  → Fur Coat, Eviolite, Sword of Ruin               (modificano la difesa)
  //
  // Due conseguenze per il seguito di questa sessione:
  //   1. quando Fur Coat entrerà in `dfMods`, deve restare confinata al
  //      difensore: non deve mai gonfiare il Body Press di chi la possiede;
  //   2. Intimidate abbassa lo stage di ATTACCO, quindi non tocca Body Press —
  //      vedi il blocco Intimidate più sotto.
  const isBodyPress = moveData.useDefAsStat === true
  const atkStatIdx = isSpecial ? STAT_SPA : (isBodyPress ? STAT_DEF : STAT_ATT)
  const defStatIdx = isSpecial ? STAT_SPD : STAT_DEF

  // ── Chiavi abilità normalizzate ──────────────────────────────────────────
  const atkAbilKey = normalizeAbilityKey(atkAbility)
  const defAbilKey = normalizeAbilityKey(defAbility)
  const atkAbilEffect = ABILITY_EFFECTS[atkAbilKey] || null
  const defAbilEffect = ABILITY_EFFECTS[defAbilKey] || null

  // ── QUANTE VOLTE COLPISCE ────────────────────────────────────────────────
  //
  // `colpi` in moves.json è `[min, max]`, trascritto da `hitRange` del vendor
  // da `gen-flag-dati.mjs`. Trentuno mosse su 810.
  //
  // ─── QUESTO NUMERO NON VIENE DAL RIFERIMENTO ──────────────────────────────
  // `GET_DAMAGE_SV` calcola il danno di UN colpo e basta: `move.hits` gli
  // serve solo per la stringa descrittiva. Quante volte colpisca lo decide
  // l'utente nell'interfaccia di NCP, che non abbiamo. Quindi il `[min, max]`
  // è trascritto, il numero dentro quell'intervallo è una scelta di modello —
  // e la scelta è: la dichiara chi usa l'app, con il massimo come riposo.
  //
  // ─── TRICALCIO E TRIPLO AXEL RESTANO A UNO ────────────────────────────────
  // Hanno `potenzaCrescente` (l'`isTripleHit` del vendor): la potenza sale a
  // ogni colpo — 10/20/30 e 20/40/60 — quindi il totale NON è un colpo per
  // tre, ed è una meccanica diversa che non abbiamo. Restano a un colpo, e il
  // pannello lo dichiara invece di moltiplicare un numero sbagliato.
  const intervalloColpi = (!moveData.potenzaCrescente && moveData.colpi) || null
  const colpi = intervalloColpi
    // Abilità Multipla inchioda al massimo: è la sua unica meccanica, e qui
    // costa una riga perché il numero di colpi esiste già come concetto.
    ? (atkAbilEffect?.skillLink
        ? intervalloColpi[1]
        : Math.min(intervalloColpi[1], Math.max(intervalloColpi[0], colpiScelti ?? intervalloColpi[1])))
    : 1

  // ── PARENTAL BOND: due colpi, il secondo a un quarto ─────────────────────
  //
  // La condizione e' quella del riferimento (`damage_MASTER.js:2456`):
  //
  //     move.hits === 1 && !move.hitRange && (format === "Singles" || !move.isSpread)
  //
  // cioe': non una mossa gia' multi-colpo, e non una mossa ad area che sta
  // colpendo piu' di un bersaglio. Il nostro `doubleTarget` dice esattamente
  // «quanti bersagli sono vivi», quindi la seconda meta' si traduce senza
  // forzature — ed e' la stessa distinzione che fa la fonte del gioco.
  //
  // Piu' le quattro mosse su cui il gioco non l'attiva e il riferimento si':
  // vedi `MOSSE_SENZA_PARENTAL_BOND`. E' l'unico punto in cui divergiamo
  // dall'oracolo di proposito.
  const parentalBond = atkAbilEffect?.parentalBond === true
    && !intervalloColpi
    && !(isSpread && field.doubleTarget)
    && !MOSSE_SENZA_PARENTAL_BOND.has(move)


  // Ate abilities: Normal -> altro tipo + x1.2 BP
  // La tabella sta in `data/typeChart.js` dalla sessione Q. Qui c'erano quattro
  // `if`, e in `SearchSelects.jsx` la stessa corrispondenza scritta con gli
  // indici numerici: due copie che concordavano senza che niente lo garantisse.
  let ateBoost = false
  if (moveType === TYPES.NORMAL && ABILITA_ATE[atkAbilKey] !== undefined) {
    moveType = ABILITA_ATE[atkAbilKey]
    ateBoost = true
  }

  // effectiveness calcolata DOPO la conversione ate
  const effectiveness = getEffectiveness(moveType, defTypes)

  // ── Meteo: sole e pioggia, normali ed estremi ────────────────────────────
  // NCP (`calcGeneralMods`, punto c) riconosce il sole con `indexOf("Sun") > -1`:
  // il Sole Estremo di Desolate Land dà quindi lo stesso ×1.5 sul Fuoco del
  // sole normale. Noi confrontavamo con `=== 'sun'`, e il boost non scattava.
  //
  // Il DIMEZZAMENTO del tipo opposto invece vale solo col meteo normale, e non
  // perché sotto meteo estremo sia più clemente: là il tipo opposto non è
  // dimezzato, è annullato del tutto (vedi l'immunità qui sotto).
  const isSoleEstremo    = meteo === 'harsh sunshine'
  const isPioggiaEstrema = meteo === 'heavy rain'
  const isSole    = meteo === 'sun'  || isSoleEstremo
  const isPioggia = meteo === 'rain' || isPioggiaEstrema

  // ── Immunità ─────────────────────────────────────────────────────────────
  // Levitate: immune a mosse Ground
  const isLevitating = defAbilEffect?.levitate === true && moveType === TYPES.GROUND
  // Flash Fire: sempre immune a Fire in difesa (indipendentemente dal toggle offensivo)
  const isFlashFire  = defAbilEffect?.flashFireImmune && moveType === TYPES.FIRE
  // Antisuono: immune alle mosse sonore. Il riferimento la mette in
  // `immunityChecks` insieme a Levitate, quindi qui, e non fra i modificatori:
  // esce con danno zero, non con un danno ridotto.
  const isAntisuono  = defAbilEffect?.soundproof === true && isSound
  // Armor Tail, Queenly Majesty e Dazzling: le mosse con priorità non hanno
  // effetto. Anche questa sta in `immunityChecks` nel riferimento, quindi qui
  // e non fra i modificatori: esce con danno zero.
  const isPrioritaBloccata = defAbilEffect?.bloccaPriorita === true && isPrioritaria

  if (isLevitating) {
    return { immune: true, reason: 'ability', abilityName: nomeAbilita(defAbilKey), rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
  if (isPrioritaBloccata) {
    return { immune: true, reason: 'ability', abilityName: nomeAbilita(defAbilKey), rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
  if (isAntisuono) {
    return { immune: true, reason: 'ability', abilityName: nomeAbilita(defAbilKey), rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
  if (isFlashFire) {
    // Qui il nome resta scritto: `flashFireImmune` ce l'ha una sola abilità, e
    // l'inventario del motore usa questa riga come prova che il motore la
    // nomina. Toglierla non guadagnava niente e faceva sparire un segnale.
    return { immune: true, reason: 'ability', abilityName: 'Flash Fire', rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
  if (effectiveness === 0) {
    return { immune: true, reason: 'type', rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
  // Meteo estremo: sotto Sole Estremo le mosse Acqua falliscono, sotto Pioggia
  // Intensa falliscono le mosse Fuoco. Non è una riduzione del danno: in NCP
  // (`immunityChecks`) la funzione esce subito con `damage: [0]`, esattamente
  // come per un'immunità di tipo. Prima di questa sessione noi non facevamo né
  // l'una né l'altra cosa e il colpo passava intero.
  if ((isSoleEstremo && moveType === TYPES.WATER) || (isPioggiaEstrema && moveType === TYPES.FIRE)) {
    return { immune: true, reason: 'weather', weatherName: meteo, rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }

  const atkBase = getBaseStat(atkPokemon, atkStatIdx)
  const defBase = getBaseStat(defPokemon, defStatIdx)
  const atkStat = calcStat(atkBase, atkSPs[atkStatIdx], level, atkNature, atkStatIdx, meteo, atkTypes)
  const defStat = calcStat(defBase, defSPs[defStatIdx], level, defNature, defStatIdx, meteo, defTypes)
  const defHP   = calcStat(getBaseStat(defPokemon, STAT_HP), defSPs[STAT_HP], level, null, STAT_HP, null, [])

  // ── LO STRATO DI PREPARAZIONE (`lib/preparazione.js`) ────────────────────
  // Tutto quello che il riferimento fa ai due Pokémon PRIMA della formula:
  // le abilità paradosso, Intrepid Sword e Dauntless Shield, Intimidate con le
  // dodici abilità che lo contrastano, Download.
  //
  // Fino alla sessione J Intimidate era scritto qui sotto a mano, in una
  // direzione sola e senza nessuna delle abilità che lo bloccano: davanti a
  // Clear Body il danno usciva più basso di un terzo. Adesso il motore non
  // decide più niente sugli stadi — li chiede, e li usa.
  const preparazione = preparaCoppia({
    attaccante: {
      pokemon: atkPokemon, sps: atkSPs, natura: atkNature, livello: level,
      abilita: atkAbility, strumento: atkItem,
      abilitaAccesa: atkAbilityFlags.intimidateActive === true,
      koFatto: atkAbilityFlags.eelevateKOActive === true,
      boosts: { at: atkBoost, df: atkDefBoost, sa: spAtkBoost, sd: atkSpDefBoost, sp: atkSpeBoost },
    },
    difensore: {
      pokemon: defPokemon, sps: defSPs, natura: defNature,
      abilita: defAbility, strumento: defItem,
      abilitaAccesa: defAbilityFlags.intimidateActive === true,
      koFatto: defAbilityFlags.eelevateKOActive === true,
      boosts: { at: defAtkBoost, df: defBoost, sa: defSpAtkBoost, sd: spDefBoost, sp: defSpeBoost },
    },
    meteo: field.weather,
    terreno: field.terrain,
  })

  // ── Boost di stat base ───────────────────────────────────────────────────
  // Il boost da usare segue la STATISTICA, non la categoria della mossa.
  // Per quasi tutte le mosse le due cose coincidono, ma Body Press è fisica e
  // attacca con la Difesa: prima della sessione D leggevamo comunque il
  // boost di Attacco, quindi un Registeel a Difesa −1 tirava un Body Press
  // *più forte* del normale se aveva l'Attacco a +1. NCP (`calcAttack`, punto
  // a) sceglie `attackStat = DF` e legge `boosts[attackStat]`: qui facciamo lo
  // stesso, indicizzando con `atkStatIdx` che è già stato deciso sopra.
  //
  // Che Intimidate non tocchi Body Press adesso è una conseguenza e non una
  // regola scritta a parte: Intimidate abbassa lo stadio `at`, e Body Press
  // legge `df`.
  const chiaveAtk = atkStatIdx === STAT_SPA ? 'sa' : atkStatIdx === STAT_DEF ? 'df' : 'at'
  const atkBoostVal0 = preparazione.attaccante.boosts[chiaveAtk]
  const defBoostVal0 = preparazione.difensore.boosts[isSpecial ? 'sd' : 'df']

  // ── Imprudenza, da tutti e due i lati ────────────────────────────────────
  //
  // Nel riferimento è un'abilità sola letta da due funzioni: `calcAttack`
  // punto b, dove il DIFENSORE che ce l'ha ignora i boost d'attacco di chi lo
  // colpisce; e `calcDefense` punto c, dove l'ATTACCANTE che ce l'ha ignora i
  // boost di difesa del bersaglio.
  //
  // In tutt'e due i casi NCP usa `rawStats`, cioè la statistica senza stadi.
  // Qui si azzera lo stadio, che è la stessa cosa: `applyBoost(stat, 0)`
  // restituisce la statistica grezza — lo dice già il commento del critico,
  // qui sotto.
  //
  // ─── IGNORA I BOOST IN TUTT'E DUE I VERSI, NON SOLO QUELLI SCOMODI ────────
  // Il critico ignora solo i boost che gli darebbero fastidio (i cali
  // d'attacco propri, i boost di difesa altrui). Imprudenza no: azzera lo
  // stadio comunque, quindi contro un attaccante a −2 il difensore con
  // Imprudenza prende PIÙ danno. È il verso che si dimentica, e ha un caso.
  //
  // ─── PERCHÉ PRIMA DEL CRITICO ────────────────────────────────────────────
  // Perché nel riferimento è così: il punto b di `calcAttack` viene prima del
  // punto c, ed è un `else if` — quindi quando Imprudenza si accende, il ramo
  // del critico non viene nemmeno valutato. Azzerando lo stadio qui, il clamp
  // del critico più sotto lavora su zero e non cambia niente: stesso esito.
  const atkBoostVal = defAbilEffect?.unaware ? 0 : atkBoostVal0
  const defBoostVal = atkAbilEffect?.unaware ? 0 : defBoostVal0

  // ── Il colpo critico ignora i boost che gli darebbero fastidio ───────────
  // Seconda metà della correzione §1.3 — la prima (il critico che buca gli
  // schermi) è arrivata in G. La regola, da NCP (`calcAttack` punto c e
  // `calcDefense` punto e): con un critico si usa la statistica GREZZA quando
  // il boost andrebbe a sfavore di chi attacca. Cioè:
  //
  //   - i cali d'attacco dell'attaccante  (boost < 0) vengono ignorati
  //   - i boost di difesa del bersaglio   (boost > 0) vengono ignorati
  //
  // Gli altri restano: un critico di un Pokémon a +2 Attacco è comunque a +2.
  // Scritto come clamp perché `applyBoost(stat, 0)` restituisce la statistica
  // grezza: azzerare lo stadio e usare il valore grezzo sono la stessa cosa.
  const atkBoostUsato = field.crit ? Math.max(0, atkBoostVal)  : atkBoostVal
  const defBoostUsato = field.crit ? Math.min(0, defBoostVal)  : defBoostVal

  const atkBoostEffective = Math.min(6, Math.max(-6, atkBoostUsato))
  let atkStatFinal = applyBoost(atkStat, atkBoostEffective)
  let defStatFinal = applyBoost(defStat, defBoostUsato)

  // ── Item effects ─────────────────────────────────────────────────────────
  // Le chiavi arrivano dalla PREPARAZIONE, non dagli input: uno strumento può
  // essersi consumato prima che la formula cominci. Oggi capita alla Booster
  // Energy (accende l'abilità paradosso e sparisce) e all'Adrenaline Orb
  // (scatta con Intimidate e sparisce). Chi legge `atkItem` direttamente da
  // qui in giù vedrebbe uno strumento che nel gioco non c'è più — e Knock Off
  // gli darebbe un ×1.5 che non gli spetta.
  const atkItemKey = (preparazione.attaccante.strumento || '').toLowerCase()
  const defItemKey = (preparazione.difensore.strumento || '').toLowerCase()
  const atkItemEffect = ITEM_EFFECTS[atkItemKey] || null
  const defItemEffect = ITEM_EFFECTS[defItemKey] || null

  // ── Contatto effettivo ───────────────────────────────────────────────────
  // NCP (`checkContactOverride`, damage_MASTER.js riga 826) toglie il contatto
  // quando l'attaccante ha Protective Pads, Long Reach, o Punching Glove su
  // una mossa pugno. Non è un dettaglio estetico: da qui passano Tough Claws
  // (che smette di applicarsi), Fluffy e — quando arriverà — Rocky Helmet.
  const isContact = isContactBase && !(
    atkItemKey === 'protective pads' ||
    atkAbilKey === 'long-reach' ||
    (atkItemKey === 'punching glove' && isPunch)
  )

  // ── CATENA DIFESA (`calcDefMods` di NCP) ─────────────────────────────────
  // Ordine dei push copiato da NCP, NON dedotto: Fur Coat (punto e) viene
  // PRIMA di Eviolite e Assault Vest (punto f). Da noi era l'inverso, e con
  // entrambi attivi l'inversione cambia il risultato.
  //
  // Fur Coat e Assault Vest non coesistono mai — il primo vale solo sul
  // fisico, il secondo solo sullo speciale — quindi l'unica coppia possibile
  // in questa catena è Fur Coat + Eviolite.
  //
  // `soloSeEvolvibile`: l'Eviolite funziona solo su chi può ancora evolversi.
  // `canEvolve` è generato in pokemon.json da scripts/gen-flag-dati.mjs; per
  // le poche voci non mappabili su NCP il campo è assente, e in quel caso
  // preferiamo NON applicare il bonus piuttosto che applicarlo a caso.
  const dfMods = []

  // punto d — Protosynthesis / Quark Drive sul lato difensivo: ×1.3 se la
  // statistica più alta è quella che sta subendo il colpo.
  //
  // ─── PERCHÉ È UN `else if` DI FUR COAT, E NON UN `if` A PARTE ────────────
  // Nel riferimento i punti c, d ed e sono una catena unica: Marvel Scale /
  // Grass Pelt, poi il paradosso, poi Fur Coat. Con un solo campo abilità le
  // tre non possono coesistere, quindi l'esclusione non serve mai — ma
  // l'ordine sì, perché se un giorno arrivasse un caso a tre modificatori
  // la posizione dentro la catena cambierebbe il risultato (misurato in D-2).
  // Scriverlo com'è costa un `else`; dedurre che «tanto non capita» è il tipo
  // di ragionamento che invecchia male.
  const paradossoDifesa = preparazione.difensore.paradosso && (
    (preparazione.difensore.statPiuAlta === 'df' && !isSpecial) ||
    (preparazione.difensore.statPiuAlta === 'sd' &&  isSpecial)
  )

  if (paradossoDifesa) dfMods.push(MOD.X1_3)
  // punto e — Fur Coat: ×2 sulla Difesa fisica.
  else if (defAbilEffect?.furCoat && !isSpecial) dfMods.push(MOD.X2)

  const itemDifesaOk = !defItemEffect?.soloSeEvolvibile || defPokeData.canEvolve === true
  if (itemDifesaOk) {
    if (defItemEffect?.defMult && !isSpecial) dfMods.push(daDecimale(defItemEffect.defMult))
    if (defItemEffect?.spdMult &&  isSpecial) dfMods.push(daDecimale(defItemEffect.spdMult))
  }

  if (dfMods.length > 0) {
    defStatFinal = Math.max(1, pokeRound(defStatFinal * chainMods(dfMods) / FIXED_POINT))
  }

  // ── CATENA ATTACCO (`calcAtMods` di NCP) ─────────────────────────────────
  // L'ordine dei push è copiato da NCP. Da noi la Choice Band era il PRIMO
  // moltiplicatore; in NCP è l'ULTIMO (punto j), dopo le abilità.
  //
  //   punto d → Fire Mane, Flash Fire attivo           ×1.5
  //   punto g → Water Bubble sulle mosse Acqua,
  //             Huge Power / Pure Power                ×2
  //   punto h → abilità DIFENSIVE che dimezzano
  //             l'attacco altrui                       ×0.5
  //   punto j → Choice Band / Choice Specs             ×1.5
  const atMods = []

  // punto d — ×1.5 offensive.
  // Fire Mane e Flash Fire stavano fra i modificatori di POTENZA o di danno
  // finale: li ha spostati D leggendo NCP, non un test rosso.
  const puntoD =
    (atkAbilEffect?.fireMane && moveType === TYPES.FIRE) ||
    (atkAbilEffect?.flashFireImmune && atkAbilityFlags.flashFireActive && moveType === TYPES.FIRE)

  // punto e — Protosynthesis / Quark Drive sul lato offensivo: ×1.3 se la
  // statistica più alta è quella con cui si sta attaccando.
  //
  // Nel riferimento d ed e sono lo stesso `if / else if`, quindi il ×1.3 del
  // paradosso non si somma mai al ×1.5 di Fire Mane o Flash Fire. Con un campo
  // abilità solo le due non possono nemmeno coesistere — l'`else` è qui per la
  // stessa ragione dell'altro, in fondo alla catena di difesa.
  //
  // La condizione guarda la CATEGORIA della mossa, non la statistica usata:
  // il riferimento scrive `move.category === "Physical"`. Su Body Press, che è
  // fisica ma attacca con la Difesa, la statistica potenziata resta quindi
  // l'Attacco. Trascritto, non corretto.
  const paradossoAttacco = preparazione.attaccante.paradosso && (
    (preparazione.attaccante.statPiuAlta === 'at' && !isSpecial) ||
    (preparazione.attaccante.statPiuAlta === 'sa' &&  isSpecial)
  )

  if (puntoD) atMods.push(MOD.X1_5)
  else if (paradossoAttacco) atMods.push(MOD.X1_3)

  // punto g — ×2 offensive: Water Bubble sull'Acqua, Huge Power / Pure Power.
  if (atkAbilEffect?.waterBubble && moveType === TYPES.WATER) atMods.push(MOD.X2)
  if (atkAbilEffect?.atkMult) {
    const isCorrectType = !atkAbilEffect.statType
      || (atkAbilEffect.statType === 'physical' && !isSpecial)
    if (isCorrectType) atMods.push(daDecimale(atkAbilEffect.atkMult))
  }

  // punto h — ×0.5 dalle abilità DIFENSIVE.
  // Controintuitivo ma è così: Thick Fat, Heatproof, Purifying Salt e il lato
  // difensivo di Water Bubble non riducono il danno finale, dimezzano la
  // statistica d'attacco. Sono nella catena dell'ATTACCANTE pur appartenendo
  // al difensore.
  const dimezzaAttacco =
    (defAbilEffect?.thickFat && (moveType === TYPES.FIRE || moveType === TYPES.ICE)) ||
    (defAbilEffect?.heatproof && moveType === TYPES.FIRE) ||
    (defAbilEffect?.waterBubble && moveType === TYPES.FIRE) ||
    (defAbilEffect?.purifyingSalt && moveType === TYPES.GHOST)
  if (dimezzaAttacco) atMods.push(MOD.X0_5)

  // punto j — ×1.5 dagli strumenti: Choice Band e Choice Specs.
  if (atkItemEffect?.atkMult === 1.5) {
    const isCorrectType = !atkItemEffect.statType
      || (atkItemEffect.statType === 'physical' && !isSpecial)
      || (atkItemEffect.statType === 'special'  &&  isSpecial)
    if (isCorrectType) atMods.push(MOD.X1_5)
  }

  if (atMods.length > 0) {
    atkStatFinal = Math.max(1, pokeRound(atkStatFinal * chainMods(atMods) / FIXED_POINT))
  }

  // (Fur Coat è salito nella catena di difesa, più sopra: in NCP è il punto e
  // di `calcDefMods` e viene PRIMA di Eviolite, non dopo.)

  // ── STAB ─────────────────────────────────────────────────────────────────
  const stab = hasSTAB(moveType, atkTypes)
    ? (atkAbilEffect?.adaptability ? 2.0 : 1.5)
    : 1

  // ── CATENA POTENZA (`calcBPMods` di NCP) ─────────────────────────────────
  // Rinominata da `terrainBP` a `modifiedBP`: il vecchio nome mentiva da
  // tempo, perché la variabile non ha mai contenuto solo il terreno.
  //
  // L'ordine dei push è copiato da NCP, non scelto. Le lettere sono i punti di
  // `calcBPMods` nel sorgente di riferimento, lasciate apposta per rendere il
  // confronto meccanico.
  //
  // ─── FINO A TECNICO L'ORDINE NON SI VEDEVA. ADESSO SÌ. ───────────────────
  // Qui c'era scritto che con `chainMods` l'ordine conta solo da tre
  // modificatori in su, e che «il riordino serve per quando la catena si
  // allargherà». Si è allargata: Tecnico legge `tempBP`, cioè la potenza a
  // METÀ catena, e la confronta con 60. Da qui in poi un push messo prima di
  // quella riga può spegnere Tecnico e uno messo dopo no — quindi la
  // posizione di ciascuno è parte della trascrizione.
  //
  // Il caso che lo dimostra vive in `tecnico.test.js`: Assorbibacio (50) con
  // Tecnico, contro un difensore con l'Aura Fatata. L'aura è il punto f,
  // prima di `tempBP`: porta la potenza a 67 e Tecnico si spegne. Aiutone è
  // il punto s, dopo: non lo spegne.
  //
  //   c.i → abilità "ate" (Pixilate, Aerilate, …)      ×1.2   0x1333
  //   e.iv→ Tough Claws                                 ×1.3   0x14CD
  //   f   → Aura Fatata, Aura Oscura                    ×1.33  0x1548
  //   ——— qui il riferimento calcola `tempBP`, che serve a Tecnico ———
  //   g   → Tecnico, Megalancio, Ferromascella,
  //         Ingegno Acciaio                             ×1.5   0x1800
  //   j   → Muscle Band, Wise Glasses                   ×1.1   0x1199
  //   k   → item type-boost                             ×1.2   0x1333
  //   o   → Knock Off su strumento rimovibile           ×1.5   0x1800
  //   s   → Helping Hand                                ×1.5   0x1800
  //   v   → terreno offensivo                           ×1.3   0x14CD
  //   w   → terreno difensivo (Misty/Grassy)            ×0.5   0x800
  //   y   → Supreme Overlord                            tabella
  //   z   → Punching Glove                              ×1.1   0x119A
  //
  // NOTA su j e k: in NCP sono un `else if`, ma la mutua esclusione è già
  // garantita dal fatto che un Pokémon tiene un solo strumento.
  const defGrounded = isGrounded(defPokeData, defAbilEffect)
  const atkGrounded = isGrounded(atkPokeData, atkAbilEffect)
  const bpMods = []

  // c.i — abilità "ate": Pixilate, Aerilate, Refrigerate, Dragonize.
  if (ateBoost) bpMods.push(MOD.X1_2)

  // e.ii — Impeto Sabbia: ×1.3 sulle mosse Roccia, Terra e Acciaio, e solo
  // con la sabbia in campo.
  //
  // `field.weather === "Sand"` nel riferimento è un confronto ESATTO, non un
  // `indexOf`: la sabbia non ha una variante «estrema» come sole e pioggia,
  // quindi non c'è niente da far passare oltre. Copiato com'è.
  //
  // Sta PRIMA di Tough Claws perché nel riferimento è il punto e.ii e Tough
  // Claws è e.iv. Oggi la posizione fra i due non è osservabile — nessun
  // Pokémon ha tutt'e due le abilità — ma da quando Tecnico legge `tempBP`
  // l'ordine dei push è parte della trascrizione, e questi due stanno
  // entrambi prima di quella riga.
  if (atkAbilEffect?.sandForce && meteo === 'sand'
      && (moveType === TYPES.ROCK || moveType === TYPES.GROUND || moveType === TYPES.STEEL)) {
    bpMods.push(MOD.X1_3)
  }

  // e.iv — Tough Claws sulle mosse a contatto. Il contatto è quello
  // EFFETTIVO: il Punching Glove lo toglie, e allora Tough Claws non vale.
  if (atkAbilEffect?.toughClaws && isContact) bpMods.push(MOD.X1_3)

  // f — Aura Fatata e Aura Oscura: ×1,33 sulle mosse del tipo dell'aura.
  //
  // Trascritto da `calcBPMods` punto f (`damage_MASTER.js:1654`), che spinge
  // `0x1548`. NON è `MOD.X1_3`: 0x1548 è 1,33007… e 0x14CD è 1,29980…, e la
  // differenza arriva fino al roll. Sta nella catena della POTENZA.
  //
  // Il posto in questa catena è quello del riferimento, fra Tough Claws (e.iv)
  // e le abilità ×1.5 (g). Oggi la posizione non è osservabile — con due soli
  // modificatori `chainMods` è commutativo — ma NCP calcola `tempBP` fra f e g
  // per decidere se Technician si applica: il giorno in cui Technician entra,
  // l'ordine diventa osservabile e dev'essere già giusto.
  //
  // ─── PERCHÉ GUARDA TUTTE E DUE LE ABILITÀ ─────────────────────────────────
  // Perché l'aura potenzia le mosse di quel tipo di CHIUNQUE sia in campo, non
  // solo di chi la possiede. NCP lo esprime chiedendo una casella per tipo di
  // mossa, senza guardare il lato, e attribuisce poi il bonus indifferentemente
  // a `attacker.ability` o a `defAbility`.
  //
  // ─── COSA NON FA, E CHE RESTA DICHIARATO ──────────────────────────────────
  // Frangiaura (`aura-break`) rovescia l'aura in ×0,75 — nel riferimento è il
  // punto a della stessa funzione. Non è implementata, e resta nelle 108: il
  // segnalino «non calcolata» lo dice all'utente che la sceglie.
  const aureInCampo = [atkAbilEffect?.aura, defAbilEffect?.aura]
  if (aureInCampo.some(tipo => tipo !== undefined && tipo === moveType)) {
    bpMods.push(MOD.X1_33)
  }

  // g — Megalancio sulle mosse-impulso: ×1.5.
  //
  // Il riferimento lo mette nel ramo delle «1.5x Abilities»
  // (`damage_MASTER.js:1672`) e spinge `0x1800`, che è 1,5 in virgola fissa —
  // cioè `MOD.X1_5`. Sta nella catena della POTENZA, non della statistica
  // d'attacco: la differenza conta quando si incatena con altri modificatori.
  //
  // `isPulse` viene dal flag `pulse` di moves.json, trascritto dal vendor:
  // Water Pulse, Aura Sphere, Dark Pulse, Dragon Pulse, Heal Pulse, Origin
  // Pulse, Terrain Pulse. Heal Pulse è di stato e non arriva mai qui, ma resta
  // nell'elenco perché l'elenco è trascritto e non filtrato da noi.
  //
  // Ferromascella sta nello STESSO `if` di Megalancio nel riferimento, con lo
  // stesso `0x1800`: qui sono due righe perché due condizioni diverse leggono
  // due flag diversi, ma il moltiplicatore e la catena sono gli stessi. Le due
  // abilità non possono convivere su un Pokémon, quindi non si sommano mai.
  //
  // `isBite` viene dal flag `bite` di moves.json — nove mosse: Bite, Hyper
  // Fang, Crunch, Poison Fang, Thunder Fang, Ice Fang, Fire Fang, Psychic
  // Fangs, Jaw Lock.
  // La potenza a metà catena, che serve solo a Tecnico.
  //
  // Il riferimento la calcola ESATTAMENTE qui, fra il punto f e il punto g, e
  // lo dice con un commento (`damage_MASTER.js:1665`):
  //
  //     //If the BP before this point would trigger Technician, don't apply it
  //     var tempBP = pokeRound(basePower * chainMods(bpMods) / 0x1000);
  //
  // «Qui» non è un dettaglio di stile: decide su quale numero cade la soglia
  // dei 60. I modificatori spinti PRIMA — le abilità «ate», Tough Claws, le
  // aure — la alzano e possono spegnere Tecnico; quelli spinti DOPO — gli
  // strumenti, Knock Off, Aiutone, i terreni, Prepotenza — no.
  //
  // Trascritta com'è, `Math.max(1, …)` compreso: che qui NON c'è, mentre c'è
  // sul `modifiedBP` finale. Cambierebbe solo il caso di una mossa a potenza
  // zero, che non arriva fin qui — ma la regola è trascrivere, non migliorare.
  //
  // ─── È IL PRIMO CASO IN CUI L'ORDINE DELLA CATENA SI VEDE ─────────────────
  // Il commento in cima a questa catena diceva che l'ordine dei push non
  // sposta nessun numero, e che il riordino serviva «per quando la catena si
  // allargherà». Si è allargata: da oggi una mossa da 60 con un ×1.2 spinto
  // prima di questa riga arriva a 72 e Tecnico non si accende, spinto dopo sì.
  // La posizione di ogni push è diventata parte della trascrizione.
  const tempBP = pokeRound(effectiveBP * chainMods(bpMods) / FIXED_POINT)

  // g — le abilità ×1.5. Nel riferimento sono un solo `if` con sei condizioni
  // in `||`, e un solo `bpMods.push(0x1800)`: qui sono righe separate perché
  // leggono flag diversi, ma non possono accendersi in due (un Pokémon ha
  // un'abilità sola).
  if (atkAbilEffect?.technician && tempBP <= 60) bpMods.push(MOD.X1_5)
  if (atkAbilEffect?.megaLauncher && isPulse) bpMods.push(MOD.X1_5)
  if (atkAbilEffect?.strongJaw && isBite) bpMods.push(MOD.X1_5)
  // Ingegno Acciaio, solo la metà «ce l'ha chi attacca». Quella dell'ALLEATO è
  // `field.isSteelySpirit` al punto d.iii del riferimento: una casella di campo
  // che non abbiamo, come per Battery e Power Spot.
  if (atkAbilEffect?.steelySpirit && moveType === TYPES.STEEL) bpMods.push(MOD.X1_5)

  // j / k — strumenti che modificano la potenza.
  // Fino a D-2 moltiplicavano la STATISTICA d'attacco: catena sbagliata.
  if (atkItemEffect?.bpMod) {
    const tipoOk = atkItemEffect.typBoost === undefined
      || atkItemEffect.typBoost === moveType
    const categoriaOk = !atkItemEffect.statType
      || (atkItemEffect.statType === 'physical' && !isSpecial)
      || (atkItemEffect.statType === 'special'  &&  isSpecial)
    // `soloMossePugno`: il Punching Glove vale sui pugni, non su tutte le
    // mosse fisiche. Il flag `punch` in moves.json viene da gen-flag-dati.mjs.
    const pugnoOk = !atkItemEffect.soloMossePugno || isPunch
    if (tipoOk && categoriaOk && pugnoOk) bpMods.push(atkItemEffect.bpMod)
  }

  // o — Knock Off: ×1.5 se il difensore tiene uno strumento RIMOVIBILE.
  //
  // Controllavamo lo STRUMENTO e non CHI LO TIENE: bastava che l'oggetto
  // fosse una Megapietra perché saltasse il ×1.5. Ma una Megapietra è
  // inamovibile solo addosso al Pokémon che ci si Megaevolve. Su chiunque
  // altro è un oggetto qualunque, e Knock Off se lo porta via.
  // Stessa logica di `cantRemoveItem` in NCP (`item_data.js`).
  if (move === 'knock off' && defItemKey && !isStrumentoInamovibile(defItemKey, defPokemon)) {
    bpMods.push(MOD.X1_5)
  }

  // s — Helping Hand.
  if (field.helpingHand) bpMods.push(MOD.X1_5)

  // v — terreno offensivo: potenzia le mosse del proprio tipo se
  // l'ATTACCANTE è a terra.
  if (atkGrounded && (
    (field.terrain === 'electric' && moveType === TYPES.ELECTRIC) ||
    (field.terrain === 'grassy'   && moveType === TYPES.GRASS) ||
    (field.terrain === 'psychic'  && moveType === TYPES.PSYCHIC)
  )) {
    bpMods.push(MOD.X1_3)
  }

  // w — terreno difensivo: dimezza, e richiede che il DIFENSORE sia a terra.
  //
  // Due correzioni rispetto a prima, entrambe da `calcBPMods` punto w:
  //  · `magnitude` è stata tolta dall'elenco. Dalla Gen 8 la mossa non esiste
  //    più, e infatti in moves.json ha potenza 0: il motore usciva prima di
  //    arrivare qui. Era codice morto, la rimozione non muove alcun numero.
  //  · aggiunto il cancello `defGrounded`. Oggi è INOSSERVABILE — un
  //    difensore non a terra è già immune a Earthquake, per tipo o per
  //    Levitate — quindi nessun caso di test può dimostrarlo. Serve quando
  //    arriveranno Air Balloon, Gravity e Magnet Rise, che oggi non
  //    modelliamo (§1.13).
  if (field.terrain === 'misty' && moveType === TYPES.DRAGON && defGrounded) {
    bpMods.push(MOD.X0_5)
  }
  if (field.terrain === 'grassy' && defGrounded && ['earthquake', 'bulldoze'].includes(move)) {
    bpMods.push(MOD.X0_5)
  }

  // y — Supreme Overlord (Kingambit). NCP usa una tabella esplicita invece di
  // calcolare 1 + n×0.1, perché i valori in virgola fissa non sono i decimali
  // tondi: 0x119A/4096 = 1,10009… La differenza è di un punto danno, ma è
  // proprio il genere di punto che decide un 2HKO.
  if (atkAbilEffect?.supremeOverlord) {
    const kos = Math.min(5, Math.max(0, atkAbilityFlags.supremeOverlordKOs || 0))
    if (kos > 0) bpMods.push(SUPREME_OVERLORD_BP[kos - 1])
  }

  // z — Punching Glove chiude la catena, dopo Supreme Overlord.
  // (Già inserito sopra insieme agli altri strumenti: un Pokémon ne tiene uno
  // solo, quindi la posizione relativa agli altri item non è osservabile.
  // Rispetto a Supreme Overlord invece sì — vedi il caso dedicato.)

  const modifiedBP = Math.max(1, pokeRound(effectiveBP * chainMods(bpMods) / FIXED_POINT))

  // ── Calcolo rolls (r = 85..100) ───────────────────────────────────────────
  // Base damage (fuori dal loop — identico per tutti i 16 roll)
  let baseDmg = Math.floor(
    Math.floor(
      Math.floor((2 * level) / 5 + 2) * modifiedBP * atkStatFinal / defStatFinal
    ) / 50
  ) + 2

  // Spread: ×0.75 con pokeRound come da formula Game Freak/Smogon.
  // `pokeRound` vive in lib/modifiers.js dalla sessione G — era la stessa
  // espressione ricopiata tre volte in questo file. Numeri identici.
  if (isSpread && field.doubleTarget) {
    baseDmg = pokeRound(baseDmg * 3072 / FIXED_POINT)
  }

  // ── Schermi: quale si applica, e a chi ───────────────────────────────────
  // Calcolato una volta sola, fuori dal loop: non dipende dal roll.
  //
  // 1. CHI BUCA LO SCHERMO
  //    - un colpo critico lo ignora del tutto (è metà della correzione §1.3;
  //      l'altra metà — il critico che ignora anche i boost — è di D)
  //    - Brick Break, Psychic Fangs e Raging Bull passano attraverso
  //    - Infiltrator passa attraverso qualunque schermo
  //
  // 2. QUALE SCHERMO
  //    Ne parte UNO SOLO, con la precedenza di NCP: Aurora Veil per primo,
  //    poi Reflect sul fisico, poi Light Screen sullo speciale.
  //    Prima della sessione G i tre `if` erano indipendenti: attivando Aurora
  //    Veil *e* Reflect il danno veniva dimezzato due volte (×0.25). Sono tre
  //    interruttori separati nell'interfaccia, quindi capitava davvero.
  //
  //    La categoria guarda `isSpecial`, cioè la categoria della mossa — non
  //    quale difesa la mossa colpisce. Body Press resta fisica e passa da
  //    Reflect, com'è giusto.
  const bypassaSchermi =
    field.crit === true ||
    SCREEN_BYPASS_MOVES.has(move) ||
    atkAbilEffect?.infiltrator === true

  const schermoAttivo = !bypassaSchermi && (
    field.auroraVeil === true ||
    (field.reflect     === true && !isSpecial) ||
    (field.lightScreen === true &&  isSpecial)
  )

  // ── CATENA FINALE: costruzione (`calcFinalMods` di NCP) ──────────────────
  // L'ordine dei push è copiato da NCP. È la catena in cui eravamo più
  // lontani: la nostra sequenza era quasi ROVESCIATA rispetto alla sua.
  // Il Life Orb era il PRIMO modificatore, in NCP è il penultimo; lo schermo
  // era l'ULTIMO, in NCP è il primo; le resist berry erano seconde, in NCP
  // chiudono la catena.
  //
  //   a → schermo (Reflect / Light Screen / Aurora Veil)   ×0.667  0xAAC
  //   g → Multiscale, Shadow Shield                        ×0.5    0x800
  //   h → Fluffy da contatto                               ×0.5    0x800
  //   j → Ice Scales sulle mosse speciali                  ×0.5    0x800
  //   l → Filter, Solid Rock, Prism Armor                  ×0.75   0xC00
  //   n → Fluffy sulle mosse Fuoco                         ×2      0x2000
  //   o → Expert Belt, se super efficace                    ×1.2    0x1333
  //   p → Life Orb                                         ×1.2998 0x14CC
  //   q → resist berry                                     ×0.5    0x800
  //
  // Fluffy compare DUE volte, e non è una svista: le due metà stanno in punti
  // diversi della catena (h e n). Su una mossa Fuoco a contatto si applicano
  // entrambe e il netto è ×1, ma passando per due arrotondamenti distinti.
  const finalMods = []

  if (schermoAttivo) finalMods.push(SCREEN_MOD)

  if (defAbilEffect?.multiscale && defAbilityFlags.multiscaleActive !== false) {
    finalMods.push(MOD.X0_5)
  }
  if (defAbilEffect?.fluffy && isContact)          finalMods.push(MOD.X0_5)
  if (defAbilEffect?.iceScales && isSpecial)       finalMods.push(MOD.X0_5)
  if (defAbilEffect?.filter && effectiveness > 1)  finalMods.push(MOD.X0_75)
  if (defAbilEffect?.fluffy && moveType === TYPES.FIRE) finalMods.push(MOD.X2)

  // o — Expert Belt, p — Life Orb.
  //
  // In NCP sono un `if / else if`, e lo teniamo: l'`else` non può scattare
  // finché l'attaccante ha un item solo, ma è la specifica e costa una riga.
  // L'ordine conta: o viene prima di p, e da tre modificatori in su nella
  // stessa catena l'ordine è osservabile (misurato in D-2, 279 terne su 729).
  if (atkItemEffect?.finalModSuperEff && effectiveness > 1) {
    finalMods.push(atkItemEffect.finalModSuperEff)
  } else if (atkItemEffect?.finalMod) {
    finalMods.push(atkItemEffect.finalMod)
  }

  // q — resist berry.
  //
  // ─── LA CHILAN BERRY ERA MORTA ───────────────────────────────────────────
  // La condizione era solo `effectiveness > 1`. NCP invece accetta anche
  // `move.type === "Normal"`: le mosse Normali non sono super efficaci contro
  // nessun tipo, quindi con la vecchia condizione la Chilan Berry — che
  // resiste al Normale — non si attivava MAI. Era selezionabile
  // nell'interfaccia, è legale in Champions (`ITEMS_CHAMPIONS` in vendor/ncp),
  // e non faceva niente in nessuna condizione.
  //
  // q — la bacca di resistenza, e le tre abilità che la governano.
  //
  // La condizione era già quella del riferimento (`calcFinalMods` punto q,
  // `damage_MASTER.js:2405`). Adesso porta anche le tre abilità che stanno
  // nella stessa riga là:
  //
  //   Unnerve e As One su chi ATTACCA spaventano il bersaglio, che la bacca
  //   non la mangia: la condizione non si accende proprio.
  //
  //   Ripen sul DIFENSORE la fa valere il doppio: `0x400` invece di `0x800`,
  //   cioè un quarto del danno e non la metà. Non è «×0.5 due volte» — è una
  //   costante diversa che il riferimento spinge al posto dell'altra.
  if (defItemEffect?.resistBerry !== undefined &&
      defItemEffect.resistBerry === moveType &&
      (effectiveness > 1 || moveType === TYPES.NORMAL) &&
      !atkAbilEffect?.impedisceBacca) {
    finalMods.push(defAbilEffect?.raddoppiaBacca ? MOD.X0_25 : MOD.X0_5)
  }

  /**
   * I sedici roll a partire da un danno base.
   *
   * Era un ciclo scritto una volta sola, perché di colpi ce n'era uno. Con
   * Parental Bond ce ne sono due, e il secondo NON è il primo moltiplicato:
   * il quarto si applica al danno BASE — prima del meteo, del critico, del
   * tiro, dello STAB, dell'efficacia e della catena finale — quindi va
   * ricalcolato tutto da lì. Il riferimento fa esattamente così
   * (`damage_MASTER.js:2160`, subito dopo il modificatore delle mosse ad
   * area) ed è il motivo per cui questo è diventato un parametro.
   */
  const tiraRoll = (base) => {
    const out = []
    for (let r = 85; r <= 100; r++) {
    let damage = base

    // Meteo — il ×1.5 vale anche coi meteo estremi, il ×0.5 solo con quelli
    // normali (col meteo estremo il tipo opposto è già uscito come immune)
    if (isSole    && moveType === TYPES.FIRE)  damage = Math.floor(damage * 1.5)
    if (isPioggia && moveType === TYPES.WATER) damage = Math.floor(damage * 1.5)
    if (meteo === 'sun'  && moveType === TYPES.WATER) damage = Math.floor(damage * 0.5)
    if (meteo === 'rain' && moveType === TYPES.FIRE)  damage = Math.floor(damage * 0.5)

    // Critico
    if (field.crit) damage = Math.floor(damage * 1.5)

    // Roll random (85-100%)
    damage = Math.floor(damage * r / 100)

    // STAB
    if (stab > 1) damage = Math.floor(damage * stab)

    // Efficacia tipo
    damage = Math.floor(damage * effectiveness)

    // ── CATENA FINALE (`calcFinalMods` di NCP) ─────────────────────────────
    // `finalMods` è costruita UNA volta sola, fuori dal loop: non dipende dal
    // roll. Qui dentro si applica e basta.
    if (finalMods.length > 0) {
      damage = pokeRound(damage * chainMods(finalMods) / FIXED_POINT)
    }

    out.push(damage)
    }
    return out
  }

  const rolls = tiraRoll(baseDmg)

  // ── Il secondo colpo di Parental Bond ────────────────────────────────────
  //
  // `0x0400` sul danno base, con `pokeRound`, esattamente dove lo mette il
  // riferimento: dopo il modificatore delle mosse ad area e prima di tutto il
  // resto. Non è «il primo colpo diviso quattro» — fra il danno base e il
  // numero finale ci sono sei passaggi che arrotondano, e farlo alla fine
  // darebbe un altro numero.
  const rollsFiglio = parentalBond
    ? tiraRoll(pokeRound(baseDmg * MOD.X0_25 / FIXED_POINT))
    : null

  // ── IL CONTRATTO DEL RISULTATO, CHE DA OGGI HA DUE LIVELLI ───────────────
  //
  //   `rolls`   i sedici roll di UN colpo. Restano per-colpo di proposito:
  //             sono ciò che il riferimento calcola, quindi sono la cosa che
  //             `ncpGolden` e gli altri confronti possono paragonare. Se qui
  //             ci mettessimo il totale, l'oracolo non avrebbe più niente
  //             contro cui misurarsi.
  //
  //   `minDmg`  il TOTALE del colpo intero, cioè per-colpo × `colpi`. È il
  //   `maxDmg`  numero che l'utente legge e su cui decide, ed è per questo
  //             che sono questi a portare il totale e non i roll.
  //
  //   `colpi`   quante volte. Vale 1 per tutte le mosse normali, quindi per
  //             loro non cambia niente.
  //
  // La probabilità di KO NON si calcola da `minDmg`/`maxDmg`: dieci colpi da
  // 10-13 non sono un colpo da 100-130, perché la somma di dieci tiri è molto
  // più stretta della somma degli estremi. Chi la calcola prende `rolls` e
  // `colpi` separati — vedi `koChanceCumulative`, parametro `colpiPerTurno`.
  // Con Parental Bond i colpi sono DUE e diversi, quindi il totale non è una
  // moltiplicazione: è una somma dei due estremi.
  const minDmg = rollsFiglio ? rolls[0] + rollsFiglio[0] : rolls[0] * colpi
  const maxDmg = rollsFiglio
    ? rolls[rolls.length - 1] + rollsFiglio[rollsFiglio.length - 1]
    : rolls[rolls.length - 1] * colpi
  const minPct = Math.floor(minDmg / defHP * 1000) / 10
  const maxPct = Math.floor(maxDmg / defHP * 1000) / 10

  // ── Log di debug ──────────────────────────────────────────────────────────
  // Costruito SOLO a debug acceso: le 15 stringhe interpolate costavano il
  // 52% del tempo di ogni chiamata (misurato), moltiplicato per ~576 chiamate
  // a render della tabella. A debug spento `log` resta null.
  //
  // Il disegno del pannello non è più qui: il motore pubblica il log sul bus
  // e DebugPanel.jsx lo renderizza in JSX. Nessun accesso al DOM da questo file.
  let log = null

  if (debug) {
    const terrainLabel = {
      electric: '⚡ Electric Terrain',
      grassy: '🌿 Grassy Terrain',
      misty: '🌫️ Misty Terrain',
      psychic: '🔮 Psychic Terrain',
    }

    log = [
      `📊 ${atkPokemon} → ${move} → ${defPokemon}`,
      `⚔️  Stat attacco: ${atkStatFinal} (base ${atkBase}, SP ${atkSPs[atkStatIdx]}, boost ${atkBoostVal > 0 ? '+' : ''}${atkBoostVal}, natura ${atkNature || 'neutra'})`,
      `🛡️  Stat difesa: ${defStatFinal} (base ${defBase}, SP ${defSPs[defStatIdx]}, boost ${defBoostVal > 0 ? '+' : ''}${defBoostVal}, natura ${defNature || 'neutra'})`,
      `❤️  HP difensore: ${defHP} (base ${getBaseStat(defPokemon, STAT_HP)}, SP ${defSPs[STAT_HP]})`,
      `💥 Potenza mossa: ${effectiveBP}${modifiedBP !== effectiveBP ? ` → ${modifiedBP} (catena BP: ${bpMods.length} modificator${bpMods.length === 1 ? 'e' : 'i'})` : ''}`,
      `🌍 Spread: ${isSpread ? (field.doubleTarget ? '×0.75 ✅' : 'mossa spread, ma single target ⚠️') : '❌'}`,
      `🎯 STAB: ${stab > 1 ? `×${stab} ✅` : '×1 ❌'}`,
      `🔥 Efficacia: ×${effectiveness}${effectiveness === 2 ? ' 🔥' : effectiveness === 4 ? ' 🔥🔥' : effectiveness === 0.5 ? ' ❄️' : ''}`,
      isContact ? `👊 Contatto: sì` : null,
      atkAbility ? `⚡ Abilità atk: ${atkAbility}` : null,
      defAbility ? `🛡️ Abilità def: ${defAbility}` : null,
      field.terrain ? `🌱 Terreno: ${terrainLabel[field.terrain] || field.terrain}` : null,
      meteo ? `☀️ Meteo: ${meteo}` : null,
      `🎲 Danno min: ${minDmg} (${minPct}%) | max: ${maxDmg} (${maxPct}%)`,
      `🎲 Rolls: ${rolls.join(', ')}`,
    ].filter(Boolean)

    publishDebugLog(log)
  }

  return {
    rolls, minDmg, maxDmg, minPct, maxPct, defHP, effectiveness, stab, log,
    atkBoostEffective, weatherBallType, effectiveBP, effectiveMoveType: moveType,
    // I sedici roll del SECONDO colpo di Parental Bond, o `null` se non
    // c'entra. Sono un array a parte e non un moltiplicatore perché i due
    // colpi hanno numeri diversi: chi calcola la probabilità di KO ha bisogno
    // di tutt'e due le distribuzioni, non della somma.
    rollsFiglio,
    // Quante volte ha colpito: 1 per tutte le mosse normali.
    //
    // È l'unico campo nuovo del risultato, e ci sta perché è CALCOLATO — il
    // massimo della mossa, oppure la scelta dell'utente limitata all'intervallo,
    // oppure il massimo imposto da Abilità Multipla. L'intervallo `[min, max]`
    // e il flag `potenzaCrescente` invece sono dati della mossa: chi disegna
    // il selettore li legge da `moves.json`, che ha già in mano, invece di
    // farseli ripetere da qui.
    colpi: rollsFiglio ? 2 : colpi,
  }
}