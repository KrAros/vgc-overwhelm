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
  totalSPs,
  STAT_HP, STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD,
} from './lib/rules.js'
import { pokeRound, FIXED_POINT } from './lib/modifiers.js'
import { calcStat, getBaseStat } from './lib/stats.js'

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
  const formaMega = ITEM_EFFECTS[itemKey]?.megaStone
  if (!formaMega || !pokeKey) return false
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
    defAbilityFlags = {},
  } = defender

  validateSPs(atkSPs, debug)
  validateSPs(defSPs, debug)

  const moveData = MOVE_DATA[move]
  if (!moveData || !moveData.power) return null

  const atkPokeData = POKEMON_DATA[atkPokemon]
  const defPokeData = POKEMON_DATA[defPokemon]
  if (!atkPokeData || !defPokeData) return null

  // ── Weather Ball: tipo e BP cambiano in base al meteo ────────────────────
  // Senza meteo: Normal BP 50 — Con meteo: tipo corrispondente BP 100
  const WEATHER_BALL_TYPE = {
    rain:             TYPES.WATER,
    'heavy rain':     TYPES.WATER,
    sun:              TYPES.FIRE,
    'harsh sunshine': TYPES.FIRE,
    sand:             TYPES.ROCK,
    sandstorm:        TYPES.ROCK,
    snow:             TYPES.ICE,
    hail:             TYPES.ICE,
  }
  const isWeatherBall = move === 'weather ball'
  const weatherBallType = isWeatherBall && field.weather
    ? WEATHER_BALL_TYPE[(field.weather || '').toLowerCase()] ?? null
    : null
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
  let ateBoost = false
  if (moveType === TYPES.NORMAL) {
    if (atkAbilKey === 'pixilate')    { moveType = TYPES.FAIRY;  ateBoost = true }
    if (atkAbilKey === 'aerilate')    { moveType = TYPES.FLYING; ateBoost = true }
    if (atkAbilKey === 'refrigerate') { moveType = TYPES.ICE;    ateBoost = true }
    if (atkAbilKey === 'dragonize')   { moveType = TYPES.DRAGON; ateBoost = true }
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
  const meteo = (field.weather || '').toLowerCase()
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
  const atkStat = calcStat(atkBase, atkSPs[atkStatIdx], level, atkNature, atkStatIdx, field.weather, atkTypes)
  const defStat = calcStat(defBase, defSPs[defStatIdx], level, defNature, defStatIdx, field.weather, defTypes)
  const defHP   = calcStat(getBaseStat(defPokemon, STAT_HP), defSPs[STAT_HP], level, null, STAT_HP, null, [])

  // ── Boost di stat base ───────────────────────────────────────────────────
  // Il boost da usare segue la STATISTICA, non la categoria della mossa.
  // Per quasi tutte le mosse le due cose coincidono, ma Body Press è fisica e
  // attacca con la Difesa: prima di questa sessione leggevamo comunque il
  // boost di Attacco, quindi un Registeel a Difesa −1 tirava un Body Press
  // *più forte* del normale se aveva l'Attacco a +1. NCP (`calcAttack`, punto
  // a) sceglie `attackStat = DF` e legge `boosts[attackStat]`: qui facciamo lo
  // stesso, indicizzando con `atkStatIdx` che è già stato deciso sopra.
  let atkBoostVal = atkStatIdx === STAT_SPA ? spAtkBoost
    : atkStatIdx === STAT_DEF ? atkDefBoost
    : atkBoost
  const defBoostVal = isSpecial ? spDefBoost : defBoost

  // ── Intimidate → Defiant / Contrary (automatico, nessun toggle extra) ───
  // Il difensore ha Intimidate attivo: applica -1 Atk all'attaccante,
  // MA se l'attaccante ha Defiant o Contrary, il risultato cambia.
  //   - Normale:  atkBoostVal -= 1
  //   - Defiant:  -1 + 2 = +1 netto (drop avviene, poi +2 per ogni drop)
  //   - Contrary: -1 invertito = +1 (il drop diventa aumento)
  //   - Competitive: -1 Atk (normale) + 2 SpAtk separato
  //
  // Nota su Body Press: Intimidate abbassa l'ATTACCO, e Body Press non usa
  // l'Attacco. Il calo va quindi applicato solo quando la statistica offensiva
  // è davvero l'Attacco — altrimenti finirebbe per sottrarre uno stadio alla
  // Difesa, che Intimidate non tocca. Per questo il controllo guarda
  // `atkStatIdx` e non più `isSpecial`.
  if (defAbilEffect?.intimidate && defAbilityFlags.intimidateActive) {
    if (atkStatIdx === STAT_ATT) {
      // Atk drop — Defiant e Contrary lo invertono/compensano
      if (atkAbilEffect?.defiant)        atkBoostVal += 1  // -1 + 2 = +1
      else if (atkAbilEffect?.contrary)  atkBoostVal += 1  // invertito
      else                               atkBoostVal -= 1  // drop normale
    }
    // Competitive: +2 SpAtk indipendentemente dalla stat attaccata
    if (atkAbilEffect?.competitive && atkStatIdx === STAT_SPA) {
      atkBoostVal += 2
    }
  }

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
  const atkItemKey = (atkItem || '').toLowerCase()
  const defItemKey = (defItem || '').toLowerCase()
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

  if (atkItemEffect?.atkMult) {
    const isCorrectType = !atkItemEffect.statType
      || (atkItemEffect.statType === 'physical' && !isSpecial)
      || (atkItemEffect.statType === 'special'  &&  isSpecial)
    // `soloMossePugno`: Punching Glove vale sui pugni, non su tutte le mosse
    // fisiche. Il flag `punch` in moves.json arriva da gen-flag-dati.mjs.
    const pugnoOk = !atkItemEffect.soloMossePugno || isPunch
    if (isCorrectType && pugnoOk) atkStatFinal = Math.floor(atkStatFinal * atkItemEffect.atkMult)
  }
  if (atkItemEffect?.typBoost !== undefined && atkItemEffect.typBoost === moveType) {
    atkStatFinal = Math.floor(atkStatFinal * atkItemEffect.typMult)
  }
  // `soloSeEvolvibile`: l'Eviolite funziona solo su chi può ancora evolversi.
  // `canEvolve` è generato in pokemon.json da scripts/gen-flag-dati.mjs; per
  // le poche voci non mappabili su NCP il campo è assente, e in quel caso
  // preferiamo NON applicare il bonus piuttosto che applicarlo a caso.
  const itemDifesaOk = !defItemEffect?.soloSeEvolvibile || defPokeData.canEvolve === true
  if (itemDifesaOk) {
    if (defItemEffect?.defMult && !isSpecial) defStatFinal = Math.floor(defStatFinal * defItemEffect.defMult)
    if (defItemEffect?.spdMult &&  isSpecial) defStatFinal = Math.floor(defStatFinal * defItemEffect.spdMult)
  }

  // ── Ability effects su stat attaccante ───────────────────────────────────

  // Huge Power / Pure Power: ×2 Atk fisico
  if (atkAbilEffect?.atkMult) {
    const isCorrectType = !atkAbilEffect.statType
      || (atkAbilEffect.statType === 'physical' && !isSpecial)
    if (isCorrectType) atkStatFinal = Math.floor(atkStatFinal * atkAbilEffect.atkMult)
  }

  // ── 0.5× difensive che agiscono sull'ATTACCO ─────────────────────────────
  // Controintuitivo ma è così: Thick Fat, Heatproof, Purifying Salt e il lato
  // difensivo di Water Bubble non riducono il danno finale, dimezzano la
  // statistica d'attacco (NCP, `calcAtMods` punto h). La differenza si vede
  // appena c'è un altro modificatore in giro, perché ogni catena arrotonda
  // per conto suo.
  const dimezzaAttacco =
    (defAbilEffect?.thickFat && (moveType === TYPES.FIRE || moveType === TYPES.ICE)) ||
    (defAbilEffect?.heatproof && moveType === TYPES.FIRE) ||
    (defAbilEffect?.waterBubble && moveType === TYPES.FIRE) ||
    (defAbilEffect?.purifyingSalt && moveType === TYPES.GHOST)
  if (dimezzaAttacco) atkStatFinal = Math.floor(atkStatFinal * 0.5)

  // Water Bubble in attacco: ×2 sulle mosse Acqua (`calcAtMods` punto g).
  if (atkAbilEffect?.waterBubble && moveType === TYPES.WATER) {
    atkStatFinal = Math.floor(atkStatFinal * 2)
  }

  // Fire Mane: ×1.5 sulle mosse Fuoco. Stava fra i modificatori di POTENZA;
  // in NCP è un modificatore d'ATTACCO (`calcAtMods` punto d, 0x1800).
  // Nessun golden lo copriva, quindi era un errore silenzioso: l'ho trovato
  // leggendo il motore di riferimento, non guardando un test rosso.
  if (atkAbilEffect?.fireMane && moveType === TYPES.FIRE) {
    atkStatFinal = Math.floor(atkStatFinal * 1.5)
  }

  // Flash Fire attivo: ×1.5 sulle mosse Fuoco. Anche questo era applicato al
  // danno finale; in NCP sta in `calcAtMods`, insieme a Guts e ai vari Blaze.
  // (L'immunità difensiva resta gestita prima del calcolo.)
  if (atkAbilEffect?.flashFireImmune && atkAbilityFlags.flashFireActive && moveType === TYPES.FIRE) {
    atkStatFinal = Math.floor(atkStatFinal * 1.5)
  }

  // Fur Coat: ×2 sulla Difesa fisica (`calcDefMods` punto e). È una catena
  // ancora diversa — quella della difesa — e per questo non può essere
  // scritta come «×0.5 al danno»: il risultato differisce per arrotondamento.
  if (defAbilEffect?.furCoat && !isSpecial) {
    defStatFinal = Math.floor(defStatFinal * 2)
  }
  
  // ── STAB ─────────────────────────────────────────────────────────────────
  const stab = hasSTAB(moveType, atkTypes)
    ? (atkAbilEffect?.adaptability ? 2.0 : 1.5)
    : 1

  const bp = effectiveBP
  const defGrounded = isGrounded(defPokeData, defAbility)
  const atkGrounded = isGrounded(atkPokeData, atkAbility)

  // ── Terrain boost potenza ─────────────────────────────────────────────────
  let terrainBP = bp
  if (field.terrain === 'electric' && moveType === TYPES.ELECTRIC && atkGrounded) {
    terrainBP = Math.floor(terrainBP * 1.3)
  }
  if (field.terrain === 'grassy' && moveType === TYPES.GRASS && atkGrounded) {
    terrainBP = Math.floor(terrainBP * 1.3)
  }
  if (field.terrain === 'psychic' && moveType === TYPES.PSYCHIC && atkGrounded) {
    terrainBP = Math.floor(terrainBP * 1.3)
  }
  if (field.terrain === 'misty' && moveType === TYPES.DRAGON && defGrounded) {
    terrainBP = Math.floor(terrainBP * 0.5)
  }
  if (field.terrain === 'grassy' && ['earthquake', 'bulldoze', 'magnitude'].includes(move)) {
    terrainBP = Math.floor(terrainBP * 0.5)
  }
  // Tough Claws: ×1.3 BP su mosse contatto (Mega Metagross, Mega Barbaracle)
  if (atkAbilEffect?.toughClaws && isContact) {
    terrainBP = Math.floor(terrainBP * 1.3)
  }

  // Ate abilities: ×1.2 BP (pixilate, aerilate, refrigerate)
  if (ateBoost) {
    terrainBP = Math.floor(terrainBP * 1.2)
  }

  // Supreme Overlord (Kingambit): modificatore di POTENZA, non di statistica.
  // NCP (`calcBPMods` punto y) usa una tabella esplicita invece di calcolare
  // 1 + n×0.1, perché i valori in virgola fissa non sono i decimali tondi:
  // 0x119A/4096 = 1,10009…, 0x14CD/4096 = 1,30005… La differenza è di un
  // punto danno, ma è proprio il genere di punto che decide un 2HKO.
  if (atkAbilEffect?.supremeOverlord) {
    const kos = Math.min(5, Math.max(0, atkAbilityFlags.supremeOverlordKOs || 0))
    if (kos > 0) {
      terrainBP = pokeRound(terrainBP * SUPREME_OVERLORD_BP[kos - 1] / FIXED_POINT)
    }
  }

  // Helping Hand: ×1.5 sulla POTENZA (`calcBPMods` punto s, 0x1800).
  // Da noi era l'ultimo moltiplicatore del danno finale — cioè in fondo alla
  // catena invece che in cima. Cinque golden lo dicevano.
  if (field.helpingHand) {
    terrainBP = pokeRound(terrainBP * 6144 / FIXED_POINT)
  }

  // Knock Off: ×1.5 BP se il difensore tiene uno strumento RIMOVIBILE.
  //
  // ─── COSA SBAGLIAVAMO ────────────────────────────────────────────────────
  // Controllavamo lo STRUMENTO e non CHI LO TIENE: bastava che l'oggetto
  // fosse una Megapietra perché saltasse il ×1.5. Ma una Megapietra è
  // inamovibile solo addosso al Pokémon che ci si Megaevolve. Su chiunque
  // altro è un oggetto qualunque, e Knock Off se lo porta via.
  //
  // Il caso che l'ha smascherato è `B8-knockoff-garchompite-021`: Gholdengo
  // con la Garchompite. Gholdengo non si Megaevolve, quindi NCP applica il
  // ×1.5 (126) mentre noi no (84). Rapporto 1,5 esatto — aveva ragione NCP.
  // La stessa logica è in `cantRemoveItem` di NCP (`item_data.js`), che
  // confronta lo strumento con la specie tramite `LOCK_ITEM_LOOKUP`.
  if (move === 'knock off' && defItemKey) {
    if (!isStrumentoInamovibile(defItemKey, defPokemon)) {
      terrainBP = Math.floor(terrainBP * 1.5)
    }
  }

  // ── Calcolo rolls (r = 85..100) ───────────────────────────────────────────
  const rolls = []

  // Base damage (fuori dal loop — identico per tutti i 16 roll)
  let baseDmg = Math.floor(
    Math.floor(
      Math.floor((2 * level) / 5 + 2) * terrainBP * atkStatFinal / defStatFinal
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

    // dmgMult: moltiplicatori di danno finale (es. Life Orb)
    // Applicato DOPO efficacia tipo — ordine Smogon
    if (atkItemEffect?.dmgMult) {
      const { num, den } = atkItemEffect.dmgMult
      damage = pokeRound(damage * num / den)
    }

    // ── Moltiplicatori abilità difensore (post-efficacia, come da formula Gen6+) ─

    // Resist berry: ×0.5 se il tipo corrisponde e la mossa è SE
    if (defItemEffect?.resistBerry !== undefined && defItemEffect.resistBerry === moveType && effectiveness > 1) {
      damage = Math.floor(damage * 0.5)
    }

    // Filter / Solid Rock: ×0.75 su super effective
    if (defAbilEffect?.filter && effectiveness > 1) {
      damage = Math.floor(damage * 0.75)
    }

    // Ice Scales: ×0.5 sulle mosse speciali (`calcFinalMods` punto j).
    if (defAbilEffect?.iceScales && isSpecial) {
      damage = Math.floor(damage * 0.5)
    }

    // Fluffy: ×0.5 da contatto, ×2 da Fire (si moltiplicano: Fire+contatto = ×1.0 netto)
    if (defAbilEffect?.fluffy) {
      if (isContact)              damage = Math.floor(damage * 0.5)
      if (moveType === TYPES.FIRE) damage = Math.floor(damage * 2.0)
    }

    // Multiscale / Shadow Shield: ×0.5 danno ricevuto se HP pieni
    // Il toggle parte true di default — l'utente lo disattiva se il Pokémon è già danneggiato
    if (defAbilEffect?.multiscale && defAbilityFlags.multiscaleActive !== false) {
      damage = Math.floor(damage * 0.5)
    }

    // Schermi difensivi — un solo schermo, mai due (vedi `schermoAttivo`)
    if (schermoAttivo) {
      damage = pokeRound(damage * SCREEN_MOD / FIXED_POINT)
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
      `💥 Potenza mossa: ${bp}${terrainBP !== bp ? ` → ${terrainBP} (terreno)` : ''}`,
      `🌍 Spread: ${isSpread ? (field.doubleTarget ? '×0.75 ✅' : 'mossa spread, ma single target ⚠️') : '❌'}`,
      `🎯 STAB: ${stab > 1 ? `×${stab} ✅` : '×1 ❌'}`,
      `🔥 Efficacia: ×${effectiveness}${effectiveness === 2 ? ' 🔥' : effectiveness === 4 ? ' 🔥🔥' : effectiveness === 0.5 ? ' ❄️' : ''}`,
      isContact ? `👊 Contatto: sì` : null,
      atkAbility ? `⚡ Abilità atk: ${atkAbility}` : null,
      defAbility ? `🛡️ Abilità def: ${defAbility}` : null,
      field.terrain ? `🌱 Terreno: ${terrainLabel[field.terrain] || field.terrain}` : null,
      field.weather ? `☀️ Meteo: ${field.weather}` : null,
      `🎲 Danno min: ${minDmg} (${minPct}%) | max: ${maxDmg} (${maxPct}%)`,
      `🎲 Rolls: ${rolls.join(', ')}`,
    ].filter(Boolean)

    publishDebugLog(log)
  }

  return { rolls, minDmg, maxDmg, minPct, maxPct, defHP, effectiveness, stab, log, atkBoostEffective, weatherBallType, effectiveBP, effectiveMoveType: moveType }
}