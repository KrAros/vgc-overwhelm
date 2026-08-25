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

function isGrounded(pokeData, ability) {
  if (pokeData.type.includes(TYPES.FLYING)) return false
  if (ability === 'levitate') return false
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
  const isLevitating = defAbilKey === 'levitate' && moveType === TYPES.GROUND
  // Flash Fire: sempre immune a Fire in difesa (indipendentemente dal toggle offensivo)
  const isFlashFire  = defAbilEffect?.flashFireImmune && moveType === TYPES.FIRE

  if (isLevitating) {
    return { immune: true, reason: 'ability', abilityName: 'Levitate', rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
  if (isFlashFire) {
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
      boosts: { at: atkBoost, df: atkDefBoost, sa: spAtkBoost, sd: atkSpDefBoost, sp: atkSpeBoost },
    },
    difensore: {
      pokemon: defPokemon, sps: defSPs, natura: defNature,
      abilita: defAbility, strumento: defItem,
      abilitaAccesa: defAbilityFlags.intimidateActive === true,
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
  const atkBoostVal = preparazione.attaccante.boosts[chiaveAtk]
  const defBoostVal = preparazione.difensore.boosts[isSpecial ? 'sd' : 'df']

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
  // L'ordine dei push è copiato da NCP, non scelto. Con `chainMods` l'ordine
  // conta solo da TRE modificatori in su (vedi modifiers.test.js): quello che
  // ha spostato i numeri qui non è il riordino, è la concatenazione. Il
  // riordino serve per quando la catena si allargherà. Le lettere sono i
  // punti di `calcBPMods` nel sorgente di riferimento, lasciate apposta per
  // rendere il confronto meccanico.
  //
  //   c.i → abilità "ate" (Pixilate, Aerilate, …)      ×1.2   0x1333
  //   e.iv→ Tough Claws                                 ×1.3   0x14CD
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
  const defGrounded = isGrounded(defPokeData, defAbility)
  const atkGrounded = isGrounded(atkPokeData, atkAbility)
  const bpMods = []

  // c.i — abilità "ate": Pixilate, Aerilate, Refrigerate, Dragonize.
  if (ateBoost) bpMods.push(MOD.X1_2)

  // e.iv — Tough Claws sulle mosse a contatto. Il contatto è quello
  // EFFETTIVO: il Punching Glove lo toglie, e allora Tough Claws non vale.
  if (atkAbilEffect?.toughClaws && isContact) bpMods.push(MOD.X1_3)

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
  const rolls = []

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
  // NCP salta anche le bacche contro Unnerve e As One: non modelliamo
  // nessuna delle due, quindi il cancello non serve ancora.
  if (defItemEffect?.resistBerry !== undefined &&
      defItemEffect.resistBerry === moveType &&
      (effectiveness > 1 || moveType === TYPES.NORMAL)) {
    finalMods.push(MOD.X0_5)
  }

  for (let r = 85; r <= 100; r++) {
    let damage = baseDmg

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

    rolls.push(damage)
  }

  const minDmg = rolls[0]
  const maxDmg = rolls[rolls.length - 1]
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

  return { rolls, minDmg, maxDmg, minPct, maxPct, defHP, effectiveness, stab, log, atkBoostEffective, weatherBallType, effectiveBP, effectiveMoveType: moveType }
}