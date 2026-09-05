// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import pokemonData from './data/pokemon.json'
import movesData from './data/moves.json'
import { getEffectiveness, hasSTAB, TYPES } from './data/typeChart.js'
import { ITEM_EFFECTS } from './data/itemEffects.js'
import { ABILITY_EFFECTS } from './data/abilityEffects.js'
import { IS_DEBUG, publishDebugLog } from './lib/debugBus.js'
import {
  STATI_VELENO,
  MOSSE_X2_STATO_QUALUNQUE, MOSSE_X2_VELENO, MOSSE_X2_PARALISI, MOSSE_X2_SONNO,
  STATI_CHE_ACCENDONO_FACADE, MOSSE_CHE_IGNORANO_BRUCIATURA,
} from './lib/rules.js'
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
  tipiEffettivi,
  MOSSE_SENZA_PARENTAL_BOND,
  MOSSE_ANNULLATE_DA_DAMP,
  STRUMENTI_IMMUNI_A_KLUTZ,
  haPotenzaDaPeso,
  haPotenzaDaVelocita,
  potenzaGyroBall,
  potenzaElectroBall,
  potenzaDaPeso,
  potenzaDaRapportoPeso,
  dannoFisso,
  mossaEntraNelCalcolo,
  MOSSE_PESO_BERSAGLIO,
  MOSSE_CHE_IGNORANO_ABILITA,
  ABILITA_NON_IGNORABILI,
  tipoPallaClima,
} from './lib/rules.js'
import { pokeRound, chainMods, daDecimale, MOD, FIXED_POINT } from './lib/modifiers.js'
import { calcStat, getBaseStat } from './lib/stats.js'
import { preparaCoppia, abilitaEffettive } from './lib/preparazione.js'
import { calcEffectiveSpe } from './utils/speedOrder.js'

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
    // Lo stato di chi attacca. Sei valori (`rules.js` → `STATI`); `null` e
    // 'healthy' valgono lo stesso.
    atkStatus = null,
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
    // Lo stato di chi subisce. Lo leggono Hex, Venoshock, Smelling Salts,
    // Wake-Up Slap, Dream Eater e Marvel Scale.
    defStatus = null,
  } = defender

  validateSPs(atkSPs, debug)
  validateSPs(defSPs, debug)

  const moveData = MOVE_DATA[move]
  // Le quattro mosse a peso hanno `power: 0` nei dati — la potenza vera si
  // ricava dal peso dei due Pokémon, più in basso. Senza questa eccezione il
  // motore uscirebbe prima di guardarle, ed è il motivo per cui fino a questa
  // sessione restituivano `null`.
  //
  // Le quattro mosse KO — `koSecco` — hanno potenza zero e non ce l'hanno
  // affatto una potenza: il loro danno non passa dalla formula. Il riferimento
  // scrive `bp: 1`, che e' un segnaposto perche' la moltiplicazione non
  // annulli tutto, e poi le intercetta al punto f (`damage_MASTER.js:1278`)
  // tornando i punti salute del difensore. Anche loro devono superare questa
  // riga, per la stessa ragione delle mosse a peso: qui non si decide il
  // danno, si decide chi entra.
  //
  // E le quattro a danno fisso — Sonic Boom, Dragon Rage, Seismic Toss, Night
  // Shade — per la terza volta la stessa storia: `power: 0` nei dati, il danno
  // deciso ai punti d ed e (`damage_MASTER.js:1256-1275`), il blocco subito
  // sopra quello delle mosse KO. Finche' non superavano questa riga il motore
  // le disegnava come mosse di stato.
  //
  // La condizione sta in `rules.js` e non qui perché ha due lettori: questo, e
  // il generatore del badge «non calcolata» sulle mosse, che deve elencare
  // esattamente chi questa riga scarta. Due copie sarebbero due occasioni di
  // far mentire il badge.
  if (!mossaEntraNelCalcolo(move, moveData)) return null

  const atkPokeData = POKEMON_DATA[atkPokemon]
  const defPokeData = POKEMON_DATA[defPokemon]
  if (!atkPokeData || !defPokeData) return null

  // ── Chiavi abilità normalizzate ──────────────────────────────────────────
  //
  // Prima di normalizzare c'e' da sapere QUALE abilita' ciascuno dei due ha
  // davvero: Trace copia quella dell'altro e Neutralizing Gas le spegne
  // tutt'e due. Nel riferimento sono le prime tre righe di
  // `CALCULATE_ALL_MOVES_SV` (`damage_SV.js:7-9`), prima di ogni altra cosa,
  // e da noi stanno in `abilitaEffettive` per la stessa ragione per cui ci
  // sta la preparazione: sono una trasformazione dei due Pokemon, non un
  // pezzo della formula.
  //
  // `gasNeutro` torna a parte perche' non e' un'abilita': e' il segnale di
  // campo che le aure e le quattro Rovina leggono come
  // `field.isNeutralizingGas`, e resta acceso anche dopo che il gas ha spento
  // l'abilita' di chi lo porta.
  const { attaccante: atkAbilVera, difensore: defAbilVera, gasNeutro } =
    abilitaEffettive({
      atkAbility, defAbility,
      atkInterruttore: atkAbilityFlags.interruttore === true,
      defInterruttore: defAbilityFlags.interruttore === true,
    })

  const atkAbilKey = atkAbilVera || ''
  const defAbilKey = defAbilVera || ''
  const atkAbilEffect = ABILITY_EFFECTS[atkAbilKey] || null
  const defAbilEffettiva = ABILITY_EFFECTS[defAbilKey] || null

  // ── Mold Breaker, Teravolt, Turboblaze ───────────────────────────────────
  //
  // Nel riferimento `abilityIgnore` (`damage_MASTER.js:998`) gira UNA volta
  // sola, all'inizio del calcolo (`damage_SV.js:125`), e rimpiazza `defAbility`
  // con la sentinella `"[ignored]"`. Nessuna delle funzioni a valle sa che
  // Mold Breaker esiste: leggono una stringa che non combacia con niente.
  //
  // Qui la sostituzione ha la stessa forma e sta nello stesso posto. Spegnere
  // `defAbilEffect` una volta spegne i ventitré campi che il motore legge dal
  // difensore — `multiscale`, `filter`, `fluffy`, `iceScales`, `thickFat`,
  // `heatproof`, `furCoat`, `unaware`, `soundproof`, `levitate`, le otto
  // `immuneTipo`, `bloccaPriorita`, `wonderGuard` e le altre — senza che
  // nessuna di quelle righe debba nominare Mold Breaker.
  //
  // ─── L'AUREA NON SI SPEGNE, E QUESTA È LA TRAPPOLA ───────────────────────
  //
  // Contro ogni intuizione. Il ×1,33 di Fairy Aura e Dark Aura è al punto f
  // (`:1655`), e la sua condizione è:
  //
  //     if (auraActive && !auraBreak && !field.isNeutralizingGas
  //         && (gen > 7 || defAbility !== '[ignored]')) {
  //
  // A gen 10 `gen > 7` è già vero, quindi il secondo controllo non viene
  // nemmeno valutato: l'aura resta. E nel riferimento `auraActive` viene da
  // una CASELLA di campo, non dall'abilità — da noi la casella la deduciamo
  // dalle abilità presenti, quindi spegnendo `defAbilEffect` in blocco
  // spegneremmo un'aura che il riferimento tiene accesa.
  //
  // Per questo di ignorato resta `aura` e nient'altro.
  //
  // ─── COSA NON PASSA DI QUI ───────────────────────────────────────────────
  //
  // La PREPARAZIONE. Intimidate, Download, Intrepid Sword, le abilità paradosso
  // e i boost da assorbimento girano prima di `abilityIgnore` nel riferimento,
  // e prima di questa riga da noi: Mold Breaker non annulla un Intimidate già
  // subito. Un'implementazione che spegnesse l'abilità del difensore «ovunque»
  // sbaglierebbe qui, e senza far rumore.
  //
  // `move.ignoresFriendGuard`, che il riferimento accende nello stesso punto,
  // non ha niente da spegnere: Friend Guard è ancora nel divario.
  const ignoraAbilitaBersaglio =
    (atkAbilEffect?.ignoraAbilita === true || MOSSE_CHE_IGNORANO_ABILITA.has(move))
    && !ABILITA_NON_IGNORABILI.has(defAbilKey)

  const defAbilEffect = ignoraAbilitaBersaglio
    ? (defAbilEffettiva?.aura !== undefined ? { aura: defAbilEffettiva.aura } : null)
    : defAbilEffettiva

  // (Questo blocco stava piu' in basso fino alla sessione che ha portato
  // Air Lock: e' salito perche' il meteo adesso dipende dalle abilita' dei due
  // Pokemon, e una costante non puo' leggerne una dichiarata dopo di lei.)
  // ── Il meteo, normalizzato una volta sola ────────────────────────────────
  // Da qui in giù `meteo` è uno dei sei nomi canonici oppure null. Nessun
  // altro punto del motore legge `field.weather`: se lo facesse, tornerebbe a
  // vedere le forme grezze — `hail`, `sandstorm`, un `HAIL` maiuscolo — e
  // ricomincerebbe la storia dei sinonimi sparsi.
  //
  // ─── AIR LOCK E CLOUD NINE: IL METEO NON C'È PIÙ ─────────────────────────
  //
  // Trascritto da `checkAirLock` (`damage_MASTER.js:411`), che fa
  // `field.clearWeather()` — non riduce l'effetto del meteo, lo TOGLIE.
  //
  // E il riferimento la chiama su TUTT'E DUE i Pokémon (`damage_SV.js:10-11`),
  // prima di qualunque altra cosa: basta che ce l'abbia uno dei due e il meteo
  // sparisce per entrambi, anche per chi ci contava.
  //
  // Sta qui e non più in basso perché `meteo` è la variabile che tutto il
  // motore legge: azzerarla in un punto solo spegne il ×1.5 del sole,
  // il dimezzamento, Sand Force, Solar Power, il tipo di Weather Ball, le
  // abilità meteo-velocità e le immunità da meteo estremo, senza che nessuna
  // di quelle righe sappia che Air Lock esiste. Stessa forma della
  // sostituzione di Mold Breaker, e per la stessa ragione.
  const meteoAnnullato =
    atkAbilEffect?.annullaMeteo === true || defAbilEffect?.annullaMeteo === true
  const meteo = meteoAnnullato ? null : normalizzaMeteo(field.weather)

  // ── Weather Ball: tipo e BP cambiano in base al meteo ────────────────────
  // Senza meteo: Normal BP 50 — Con meteo: tipo corrispondente BP 100
  // Tabella e regola stanno in `lib/rules.js` dalla sessione Q: la stessa
  // domanda serve al motore, al badge del tipo mossa e al riquadro delle -ate.
  const isWeatherBall = move === 'weather ball'
  // Mega Sol la porta a Fuoco a prescindere dal meteo, ed e' il PRIMO ramo del
  // ternario nel riferimento (`:729`): viene prima del sole vero, quindi vince
  // anche sotto pioggia o sabbia.
  const weatherBallType = isWeatherBall && atkAbilEffect?.megaSol === true
    ? TYPES.FIRE
    : tipoPallaClima(move, meteo)
  let moveType = weatherBallType !== null ? weatherBallType : moveData.type
  const isLastRespects = move === 'last respects'
  const lastRespectsBP = isLastRespects ? 50 + (Math.min(3, Math.max(0, lastRespectsKOs)) * 50) : null
  // ─── IL TIPO EFFETTIVO, NON QUELLO SCRITTO NEI DATI ──────────────────────
  //
  // Forecast segue il meteo, Mimicry il terreno, e tutt'e due azzerano il
  // secondo tipo. Nel riferimento sono due passaggi dell'ingresso alto
  // (`damage_SV.js:12-15`), prima di ogni calcolo: da qui passano lo STAB,
  // l'efficacia, le immunita' e le statistiche potenziate dal meteo.
  const atkTypes = tipiEffettivi(
    atkPokeData.type, atkAbilEffect, atkPokemon, meteo, field.terrain)
  const defTypes = tipiEffettivi(
    defPokeData.type, defAbilEffect, defPokemon, meteo, field.terrain)
  // Il contatto "grezzo", quello scritto nei dati della mossa. Il contatto
  // EFFETTIVO si decide più sotto, dopo aver letto lo strumento: Punching
  // Glove, Protective Pads e Long Reach lo tolgono.
  const isContactBase = moveData.contact === true
  const isPunch = moveData.punch === true
  const isPulse = moveData.pulse === true
  const isSound = moveData.sound === true
  const isPrioritaria = moveData.prioritaria === true
  const isBite  = moveData.bite === true
  const isSlicing = moveData.slicing === true
  const isRinculo = moveData.rinculo === true
  const isBullet = moveData.bullet === true
  const isVento = moveData.vento === true
  const isSecondario = moveData.secondario === true
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


  // ── Liquid Voice: le mosse sonore diventano Acqua ────────────────────────
  //
  // Trascritto da `checkAbilityTypeChange` (`damage_MASTER.js:1063`), che è la
  // STESSA funzione delle abilità «-ate» — e ne è il ramo `if`, mentre le
  // «-ate» sono l'`else`. I due non possono quindi accendersi insieme, ed è
  // scritto qui come `else if` per la stessa ragione.
  //
  // Non è un moltiplicatore: è un cambio di TIPO, e da qui passa tutto —
  // lo STAB, l'efficacia, il meteo, le aure, le immunità. Cambiare `moveType`
  // in questo punto è come lo fa il riferimento: prima che chiunque altro lo
  // legga.
  //
  // Le diciotto mosse sonore vengono dal flag `sound` di moves.json, lo stesso
  // che usano Soundproof e Punk Rock — e non è indovinabile dal nome: ci sono
  // Snore, Round, Relic Song, Chatter, Psychic Noise e Torch Song.
  //
  // Ate abilities: Normal -> altro tipo + x1.2 BP
  // La tabella sta in `data/typeChart.js` dalla sessione Q. Qui c'erano quattro
  // `if`, e in `SearchSelects.jsx` la stessa corrispondenza scritta con gli
  // indici numerici: due copie che concordavano senza che niente lo garantisse.
  let ateBoost = false
  if (atkAbilEffect?.liquidVoice && isSound) {
    moveType = TYPES.WATER
  }
  else if (atkAbilEffect?.normalize) {
    // Normalize e' l'`else if` DOPO le «-ate» (`damage_MASTER.js:1091`), e la
    // sua condizione e' l'opposto: le altre chiedono che la mossa sia gia'
    // Normale, lei la rende Normale qualunque fosse.
    //
    // Prende il x1,2 come le altre — `isBoosted = gen >= 7 ? true : false`, e
    // noi giriamo a 10.
    moveType = TYPES.NORMAL
    ateBoost = true
  }
  else if (moveType === TYPES.NORMAL && ABILITA_ATE[atkAbilKey] !== undefined) {
    moveType = ABILITA_ATE[atkAbilKey]
    ateBoost = true
  }

  // effectiveness calcolata DOPO la conversione ate
  // Scrappy e Mind's Eye stanno nella stessa clausola del riferimento
  // (`damage_MASTER.js:230`); Tera Shell nel punto che la chiama (`:215`).
  //
  // Tera Shell si legge da `defAbilEffect`, che Mold Breaker azzera: nel
  // riferimento la condizione guarda `defAbility`, cioe' il valore gia'
  // sostituito con `[ignored]`. Quindi Mold Breaker la spegne, e da noi lo fa
  // senza che serva scriverlo.
  const effectiveness = getEffectiveness(moveType, defTypes, {
    ignoraGhost: atkAbilEffect?.ignoraGhost === true,
    teraShell: defAbilEffect?.teraShell === true,
  })

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

  // ─── MEGA SOL: «E' COME SE CI FOSSE IL SOLE», MA NON PER TUTTO ────────────
  //
  // Meganium-Mega. Nel riferimento non e' un meteo: e' una condizione in `or`
  // ripetuta in sette punti diversi, ognuno col proprio dettaglio. Non si puo'
  // quindi scrivere `isSole || megaSol` una volta e basta — su alcune righe
  // c'e' e su altre no, e la differenza e' voluta.
  //
  //   c'e':   il x1,5 sulle mosse Fuoco (`:2163`), il tipo e la potenza di
  //           Weather Ball (`:729`, `:1424`), l'esenzione dal dimezzamento
  //           della pioggia sul Fuoco (`:2173`)
  //   NON c'e': il dimezzamento del sole sulle mosse Acqua — quello resta
  //           legato al meteo vero
  const megaSol = atkAbilEffect?.megaSol === true
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

  // Le undici dello stesso `||` (`damage_MASTER.js:1107-1116`).
  //
  // Otto guardano il tipo, tre la famiglia della mossa, una — Wonder Guard —
  // guarda l'efficacia. Nel riferimento sono una condizione sola con un solo
  // `return damage: [0]`, e qui restano una condizione sola per la stessa
  // ragione: sono la stessa regola, non undici regole che si somigliano.
  //
  // Il tipo NON è scritto nel motore: sta in `immuneTipo` dentro
  // `abilityEffects.js`, un campo per abilità. Le famiglie vengono dai flag
  // `bullet` e `vento` di moves.json, trascritti da `isBullet` e `isWind`.
  //
  // Wonder Guard è `typeEffectiveness <= 1`, non `< 1`: anche l'efficacia
  // neutra è annullata. Non è una resistenza forte, è un filtro che lascia
  // passare solo il super efficace.
  const isImmuneDaAbilita =
    (defAbilEffect?.immuneTipo !== undefined && moveType === defAbilEffect.immuneTipo) ||
    (defAbilEffect?.immuneProiettili && isBullet) ||
    (defAbilEffect?.immuneVento && isVento) ||
    (defAbilEffect?.wonderGuard && effectiveness <= 1)

  // Damp (`damage_MASTER.js:1138`): quattro mosse non partono proprio.
  //
  // Guarda TUTT'E DUE i lati, e lo fa il riferimento: `defAbility === "Damp"
  // || attacker.ability === "Damp"`. Chi ce l'ha spegne queste mosse anche a
  // sé stesso. Controllare solo il difensore sarebbe metà abilità.
  //
  // I quattro nomi stanno in `MOSSE_ANNULLATE_DA_DAMP` dentro `lib/rules.js`,
  // non qui: nel vendor non c'è un flag da trascrivere, c'è un elenco.
  const isDampSpenta =
    (defAbilEffect?.damp === true || atkAbilEffect?.damp === true) &&
    MOSSE_ANNULLATE_DA_DAMP.has(move)

  // Dream Eater contro chi NON dorme non fa niente (`damage_MASTER.js:1163`):
  // il riferimento esce con danno zero, dentro `immunityChecks`.
  //
  // Non e' un'immunita' del difensore — e' la mossa che fallisce — quindi il
  // motivo e' `move` e non `ability`, e il riquadro scrive «Fallisce» col nome
  // della mossa, come gia' fa per le mosse Fuoco sotto pioggia intensa.
  //
  // Comatose la sbloccherebbe (vale come «addormentato»): non e' implementata,
  // e il giorno che entra si aggiunge qui.
  if (move === 'dream eater' && (defStatus || 'healthy') !== 'asleep'
      && !defAbilEffect?.comatose) {
    return { immune: true, reason: 'move', moveName: move, rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }

  // ─── STURDY, CHE NEL RIFERIMENTO E' SOLO QUESTO ─────────────────────────
  //
  //     if (move.isOHKO && defAbility === "Sturdy")   `damage_MASTER.js:1144`
  //
  // Una riga, dentro `immunityChecks`, e nient'altro in tutt'e due i file del
  // danno. Il «sopravvive con un punto salute» che l'abilita' ha nel gioco li'
  // non c'e', e non e' una dimenticanza del riferimento: non e' la catena del
  // danno di un colpo: e' cosa succede DOPO che il danno e' stato calcolato.
  //
  // Legge `defAbility` — il valore gia' passato da `abilityIgnore` — quindi
  // Mold Breaker la spegne. Da noi quello e' `defAbilEffect`, che e' `null`
  // quando l'abilita' e' ignorata: la condizione lo eredita senza dover
  // nominare Mold Breaker.
  const isKoSeccoFermatoDaSturdy = moveData.koSecco === true && defAbilEffect?.sturdy === true

  if (isKoSeccoFermatoDaSturdy) {
    return { immune: true, reason: 'ability', abilityName: nomeAbilita(defAbilKey), rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
  if (isImmuneDaAbilita) {
    return { immune: true, reason: 'ability', abilityName: nomeAbilita(defAbilKey), rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
  if (isDampSpenta) {
    // Il nome mostrato è quello di chi ce l'ha davvero: se Damp è
    // dell'attaccante, scrivere il difensore sarebbe una bugia comoda.
    const chi = defAbilEffect?.damp ? defAbilKey : atkAbilKey
    return { immune: true, reason: 'ability', abilityName: nomeAbilita(chi), rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
  }
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

  // ── PUNTI d ed e — IL DANNO FISSO (`damage_MASTER.js:1256-1275`) ─────────
  //
  //     //d. Set Damage (Sonic Boom, Dragon Rage)
  //     if (move.name === "Sonic Boom")
  //         return !isParentBond ? { "damage": [20] } : { "damage": [40] };
  //     if (move.name === "Dragon Rage")
  //         return !isParentBond ? { "damage": [40] } : { "damage": [80] };
  //
  //     //e. Level Dependent Damage (Seismic Toss, Night Shade)
  //     if (move.name === "Seismic Toss" || move.name === "Night Shade") {
  //         var lv = attacker.level;
  //         if (isParentBond) lv *= 2;
  //         return { "damage": [lv] };
  //     }
  //
  // Trascritto com'e', e sta QUI perche' li' sta: `setDamage` gira dopo
  // `immunityChecks` (`damage_SV.js:136-142`) e prima di ogni riga di formula.
  // I punti d ed e vengono prima del punto f, quindi vengono prima anche qui —
  // l'ordine non cambia niente, nessuna mossa e' in due blocchi, e si rispetta
  // lo stesso.
  //
  // Come per le mosse KO il danno e' UN numero, non sedici: non c'e' roll,
  // quindi non c'e' variazione. La differenza e' che qui il numero non guarda
  // il bersaglio — Sonic Boom toglie 20 punti a chiunque, e la percentuale
  // cambia solo perche' cambia il denominatore.
  //
  // ─── PARENTAL BOND RADDOPPIA, E NON E' UN SECONDO COLPO ──────────────────
  //
  // Il riferimento non torna due colpi: torna un numero gia' raddoppiato
  // (`[100]`, non `[50, 50]`). Quindi `rollsFiglio` resta `null` e `colpi`
  // resta 1 — chi calcola la probabilita' di KO non ha due distribuzioni da
  // sommare, ne ha una deterministica.
  //
  // La condizione del riferimento e' il solo `attacker.ability === "Parental
  // Bond"`, senza i controlli su colpi multipli e mosse ad area che ci sono
  // altrove. Qui si usa lo stesso `parentalBond` del resto del motore perche'
  // su queste quattro le due condizioni coincidono: nessuna e' multi-colpo,
  // nessuna e' ad area, nessuna sta in `MOSSE_SENZA_PARENTAL_BOND`.
  //
  // Quell'ultima clausola non e' un dettaglio: e' la levetta della decisione
  // che questa sessione NON ha preso. La wiki dice che nel gioco Parental Bond
  // su una mossa a danno fisso non fa niente, il riferimento la raddoppia, e
  // finche' nessuno sceglie si segue il riferimento — che e' l'oracolo. Il
  // giorno che si sceglie diversamente, la modifica sono quattro nomi in
  // quella lista e nessuna riga qui. Vedi `docs/lavoro-aperto.md`, sezione B.
  const fisso = dannoFisso(move, level)
  if (fisso !== null) {
    const danno = parentalBond ? fisso * 2 : fisso
    return {
      rolls: [danno], minDmg: danno, maxDmg: danno,
      minPct: Math.floor(danno / defHP * 1000) / 10,
      maxPct: Math.floor(danno / defHP * 1000) / 10,
      defHP, effectiveness, stab: 1, log: null,
      atkBoostEffective: 0, weatherBallType: null, effectiveBP: 0,
      effectiveMoveType: moveType, rollsFiglio: null, colpi: 1,
    }
  }

  // ── PUNTO f — LE MOSSE KO (`damage_MASTER.js:1277-1283`) ─────────────────
  //
  //     if (move.isOHKO) {
  //         if (move.name == 'Sheer Cold' && defender.hasType("Ice"))
  //             return { "damage": [0], … };
  //         else
  //             return { "damage": [defender.curHP], … };
  //     }
  //
  // Trascritto com'e'. Due cose che si vedono solo leggendolo:
  //
  //   · il danno e' UN numero, non sedici. Non c'e' variazione: la mossa
  //     toglie tutti i punti salute che il bersaglio ha. Il nostro `rolls` ha
  //     quindi un elemento solo, e non e' un caso limite da aggirare — e' il
  //     risultato. (L'harness lo confondeva con un colpo nullo, e la
  //     distinzione fra `[0]` e `[185]` e' stata aggiunta li' per questo.)
  //
  //   · l'eccezione e' scritta sul NOME della mossa, non su un flag. Sheer
  //     Cold contro un Ghiaccio fallisce; le altre tre no. E' l'unico posto di
  //     questo motore dove si guarda il nome di una mossa KO, e ci si guarda
  //     perche' li' il riferimento guarda quello.
  //
  // `defender.curHP` sono i punti salute CORRENTI. Noi assumiamo la vita
  // piena, com'e' scritto in `CONTRIBUTING.md` per Eruption e Water Spout:
  // quindi `defHP`.
  //
  // Sta qui e non piu' in alto perche' ha bisogno di `defHP`, e sta dopo tutte
  // le immunita' perche' li' sta nel riferimento: Fissure contro uno Volante e
  // Guillotine contro uno Spettro escono zero dall'immunita' di tipo, non da
  // questo ramo. Verificato contro l'oracolo, non dedotto.
  if (moveData.koSecco) {
    if (move === 'sheer cold' && defTypes.includes(TYPES.ICE)) {
      return { immune: true, reason: 'move', moveName: move, rolls: [], minDmg: 0, maxDmg: 0, minPct: 0, maxPct: 0, defHP: 0, effectiveness: 0 }
    }
    return {
      rolls: [defHP], minDmg: defHP, maxDmg: defHP, minPct: 100, maxPct: 100,
      defHP, effectiveness, stab: 1, log: null,
      atkBoostEffective: 0, weatherBallType: null, effectiveBP: 0,
      effectiveMoveType: moveType, rollsFiglio: null, colpi: 1,
    }
  }

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
      abilita: atkAbilVera, strumento: atkItem,
      abilitaAccesa: atkAbilityFlags.intimidateActive === true,
      koFatto: atkAbilityFlags.eelevateKOActive === true,
      assorbimentoFatto: atkAbilityFlags.assorbimentoAttivo === true,
      boosts: { at: atkBoost, df: atkDefBoost, sa: spAtkBoost, sd: atkSpDefBoost, sp: atkSpeBoost },
    },
    difensore: {
      pokemon: defPokemon, sps: defSPs, natura: defNature,
      abilita: defAbilVera, strumento: defItem,
      abilitaAccesa: defAbilityFlags.intimidateActive === true,
      koFatto: defAbilityFlags.eelevateKOActive === true,
      assorbimentoFatto: defAbilityFlags.assorbimentoAttivo === true,
      boosts: { at: defAtkBoost, df: defBoost, sa: defSpAtkBoost, sd: spDefBoost, sp: defSpeBoost },
    },
    meteo: field.weather,
    terreno: field.terrain,
  })

  // ── LA VELOCITA' EFFETTIVA DEI DUE ───────────────────────────────────────
  //
  // Sta QUI e non piu' in basso perche' adesso ha DUE lettori, e uno dei due
  // e' la potenza base — che si calcola molto prima dei moltiplicatori:
  //
  //   Gyro Ball, Electro Ball   la loro potenza E' il rapporto fra le due
  //   Analytic                  l'ordine di turno, punto e.iii della catena
  //
  // Nel riferimento e' la stessa cosa per la stessa ragione: `stats[SP]` viene
  // scritta una volta sola nell'ingresso alto (`damage_SV.js:43-53`) e poi la
  // leggono sia `basePowerFunc` (`:1307`, `:1312`) sia la riga dell'ordine di
  // turno (`:147`). Una Velocita' calcolata due volte in due punti sarebbe
  // due occasioni di calcolarla in due modi.
  //
  // Gli stadi che si passano sono quelli DOPO la preparazione, non quelli
  // dell'argomento: nel riferimento `getFinalSpeed` gira dopo `checkIntimidate`
  // e compagnia, e legge `pokemon.boosts[SP]` gia' modificato. Stessa cosa per
  // l'abilita', che e' quella VERA — dopo Trace e Neutralizing Gas — perche'
  // `checkTrace` e `checkNeutralGas` sono le prime tre righe dell'ingresso
  // alto, prima di ogni assegnamento a `stats`.
  //
  // ─── COSA RESTA FUORI ────────────────────────────────────────────────────
  //
  // Il Ventoincoda: `calculateDamage` non riceve i due lati del campo, e
  // l'harness lo passa `false` da tutt'e due le parti. Non e' una divergenza
  // nascosta — e' una casella che nessuno dei due accende — ma e' un confine,
  // e sta scritto invece che essere scoperto.
  const velocitaDi = (specie, sps, natura, abilita, strumento, stato, boostSp) =>
    calcEffectiveSpe(
      { key: specie, sps, nature: natura, speBoost: boostSp, item: strumento, ability: abilita, status: stato },
      meteo, false, field.terrain, level,
    )
  const speAttaccante = velocitaDi(
    atkPokemon, atkSPs, atkNature, atkAbilVera, atkItem, atkStatus, preparazione.attaccante.boosts.sp)
  const speDifensore = velocitaDi(
    defPokemon, defSPs, defNature, defAbilVera, defItem, defStatus, preparazione.difensore.boosts.sp)

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
  // ── Il critico può non esserci affatto: Shell Armor e Battle Armor ───────
  //
  // Trascritto da `critMove` (`damage_MASTER.js:1018`), che è una riga sola:
  //
  //     return move.isCrit && ["Battle Armor", "Shell Armor"].indexOf(defAbility) === -1;
  //
  // Da qui in giù si legge `critico` e non più `field.crit`: l'interruttore
  // dell'interfaccia dice cosa ha chiesto chi usa l'app, questa costante dice
  // cosa succede davvero. Sono quattro punti — i due clamp qui sotto, lo
  // schermo bucato, il ×1.5 dentro il tiro e Sniper — e se uno solo continuasse
  // a leggere `field.crit` il critico sparirebbe a metà.
  //
  // ─── E MOLD BREAKER LO FA PASSARE ────────────────────────────────────────
  // Nel riferimento `critMove` riceve la `defAbility` GIÀ passata per
  // `abilityIgnore`. Qui `defAbilEffect` è già quella sostituita, quindi la
  // cosa viene da sé: contro Mold Breaker, Battle Armor non ferma niente.
  const critico = field.crit === true && !defAbilEffect?.bloccaCritico

  const atkBoostUsato = critico ? Math.max(0, atkBoostVal)  : atkBoostVal
  const defBoostUsato = critico ? Math.min(0, defBoostVal)  : defBoostVal

  const atkBoostEffective = Math.min(6, Math.max(-6, atkBoostUsato))
  let atkStatFinal = applyBoost(atkStat, atkBoostEffective)

  // ── punto e di `calcAttack`: Hustle ──────────────────────────────────────
  //
  // Il riferimento lo commenta da sé, ed è l'unica volta che lo fa per
  // avvertire di una differenza di forma (`damage_MASTER.js:1895`):
  //
  //     // unlike all other attack modifiers, Hustle gets applied directly
  //     attack = pokeRound(attack * 3 / 2);
  //
  // Cioè: NON entra in `atMods`. Si applica alla statistica appena boostata, e
  // la catena dei modificatori parte da lì. Metterlo nella catena darebbe un
  // numero plausibile e diverso, perché `chainMods` concatena in virgola fissa
  // e questo è un `× 3 / 2` con un solo `pokeRound` suo.
  //
  // Scritto `* 3 / 2` e non `* 1.5` per copiarlo com'è: sono lo stesso numero,
  // ma la forma dice da dove viene.
  if (atkAbilEffect?.hustle && !isSpecial) {
    atkStatFinal = pokeRound(atkStatFinal * 3 / 2)
  }
  let defStatFinal = applyBoost(defStat, defBoostUsato)

  // ── Item effects ─────────────────────────────────────────────────────────
  // Le chiavi arrivano dalla PREPARAZIONE, non dagli input: uno strumento può
  // essersi consumato prima che la formula cominci. Oggi capita alla Booster
  // Energy (accende l'abilità paradosso e sparisce) e all'Adrenaline Orb
  // (scatta con Intimidate e sparisce). Chi legge `atkItem` direttamente da
  // qui in giù vedrebbe uno strumento che nel gioco non c'è più — e Knock Off
  // gli darebbe un ×1.5 che non gli spetta.
  const atkItemGrezzo = (preparazione.attaccante.strumento || '').toLowerCase()
  const defItemGrezzo = (preparazione.difensore.strumento || '').toLowerCase()

  // ── Klutz: lo strumento non conta più ────────────────────────────────────
  //
  // Trascritto da `checkKlutz` (`damage_MASTER.js:448`), che scrive
  // `pokemon.item = "Klutz"` — cioè un nome che nessuna tabella conosce, ed è
  // il modo in cui il riferimento dice «non ha più niente in mano».
  //
  // Da noi la stessa cosa si dice azzerando la chiave: il resto del motore
  // legge `atkItemKey` e non sa che Klutz esiste. Stessa forma della
  // sostituzione di Mold Breaker e dell'azzeramento del meteo di Air Lock.
  //
  // I sette che restano in piedi — gli attrezzi da allenamento — stanno in
  // `STRUMENTI_IMMUNI_A_KLUTZ`. Uno solo dei sette esiste nei nostri dati, ma
  // ci sono tutti: la lista è l'eccezione a una regola che ANNULLA, e tenerne
  // una parte vorrebbe dire che il giorno in cui uno degli altri entrasse,
  // Klutz comincerebbe a spegnerlo in silenzio.
  const klutzAtk = ABILITY_EFFECTS[atkAbilKey]?.klutz && !STRUMENTI_IMMUNI_A_KLUTZ.has(atkItemGrezzo)
  const klutzDef = ABILITY_EFFECTS[defAbilKey]?.klutz && !STRUMENTI_IMMUNI_A_KLUTZ.has(defItemGrezzo)

  const atkItemKey = klutzAtk ? '' : atkItemGrezzo
  const defItemKey = klutzDef ? '' : defItemGrezzo
  const atkItemEffect = ITEM_EFFECTS[atkItemKey] || null
  const defItemEffect = ITEM_EFFECTS[defItemKey] || null

  // ── La potenza di base ───────────────────────────────────────────────────
  //
  // Sta QUI e non più in alto perché le quattro mosse a peso hanno bisogno
  // degli strumenti già risolti: la Pietrapiuma dimezza il peso, e Klutz la
  // spegne. Nel riferimento l'ordine è lo stesso — `checkKlutz` gira a
  // `damage_SV.js:18`, `getWeightMods` a `:59`.
  //
  // ─── IL PESO EFFETTIVO ───────────────────────────────────────────────────
  //
  // Trascritto da `getWeightMods` (`damage_MASTER.js:716-725`), che gira su
  // tutt'e due i Pokémon:
  //
  //     Heavy Metal  ×2      \ un `if / else if`: non si sommano
  //     Light Metal  ÷2      /
  //     Float Stone  ÷2        un `if` a sé: si somma a entrambe
  const pesoEffettivo = (specie, abilEffect, itemEffect) => {
    let peso = POKEMON_DATA[specie]?.weight ?? 0
    if (abilEffect?.pesoMult) peso *= abilEffect.pesoMult
    if (itemEffect?.dimezzaPeso) peso /= 2
    return peso
  }

  // ─── LE DUE TABELLE ──────────────────────────────────────────────────────
  // Stanno in `lib/rules.js`, trascritte da `basePowerFunc` punto b. Low Kick
  // e Grass Knot guardano il peso del BERSAGLIO; Heavy Slam e Heat Crash il
  // RAPPORTO fra i due — quindi le prime due leggono un peso solo e le altre
  // due tutt'e due.
  let potenzaDalPeso = null
  if (haPotenzaDaPeso(move)) {
    const pesoDif = pesoEffettivo(defPokemon, defAbilEffect, defItemEffect)
    if (MOSSE_PESO_BERSAGLIO.has(move)) {
      potenzaDalPeso = potenzaDaPeso(pesoDif)
    } else {
      const pesoAtk = pesoEffettivo(atkPokemon, atkAbilEffect, atkItemEffect)
      // Divisione per zero: nessuna specie pesa 0 (il minimo è 0,1 kg), ma un
      // peso mancante darebbe `Infinity` e quindi 120 fisso. Meglio il gradino
      // più basso, che è la risposta di chi non sa.
      potenzaDalPeso = pesoDif > 0 ? potenzaDaRapportoPeso(pesoAtk / pesoDif) : 40
    }
  }

  // ─── LA POTENZA DALLA VELOCITA' ──────────────────────────────────────────
  //
  // Punto a di `basePowerFunc`, il blocco sopra quello del peso. Le formule
  // stanno in `lib/rules.js`; qui c'e' solo la scelta di quale delle due, e
  // le due Velocita' sono quelle gia' calcolate piu' su — le stesse che legge
  // l'ordine di turno di Analytic, come nel riferimento.
  //
  // Gyro Ball guarda il rapporto in un verso, Electro Ball nell'altro: la
  // prima premia chi e' lento, la seconda chi e' veloce. Passarle nello stesso
  // ordine sarebbe un difetto che a Velocita' simili non si vedrebbe, e che
  // qui e' presidiato da un caso con l'attaccante lentissimo.
  let potenzaDallaVelocita = null
  if (haPotenzaDaVelocita(move)) {
    potenzaDallaVelocita = move === 'gyro ball'
      ? potenzaGyroBall(speAttaccante, speDifensore)
      : potenzaElectroBall(speAttaccante, speDifensore)
  }

  // ─── LE MOSSE CHE LO STATO RADDOPPIA ──────────────────────────────────────
  //
  // Nel riferimento sono rami del `switch` di `calcBasePower`
  // (`damage_MASTER.js:1405-1419`) e il punto u di `calcBPMods` (`:1770`).
  // Raddoppiano la POTENZA BASE, quindi stanno qui e non fra i moltiplicatori:
  // un ×2 sulla potenza base passa poi per Technician, che guarda il numero.
  //
  // Ognuna legge uno stato diverso, e su un lato diverso. Le quattro qui sotto
  // guardano CHI SUBISCE; Facade guarda CHI ATTACCA, ed e' l'unica.
  //
  // Comatose e' entrata: vale come «addormentato» per Wake-Up Slap e Dream
  // Eater, e come «ha uno stato» per Hex. Le due condizioni sono separate piu'
  // sotto proprio perche' nel riferimento sono diverse.
  const statoDif = defStatus || 'healthy'
  const statoAtk = atkStatus || 'healthy'

  // Comatose vale come stato per Hex e come sonno per Wake-Up Slap. Le due
  // condizioni sono diverse nel riferimento e restano diverse qui.
  const dorme = statoDif === 'asleep' || defAbilEffect?.comatose === true
  const haUnoStato = statoDif !== 'healthy' || defAbilEffect?.comatose === true

  const raddoppiaPerStato =
    (MOSSE_X2_STATO_QUALUNQUE.has(move) && haUnoStato) ||
    (MOSSE_X2_VELENO.has(move)   && STATI_VELENO.has(statoDif)) ||
    (MOSSE_X2_PARALISI.has(move) && statoDif === 'paralyzed') ||
    (MOSSE_X2_SONNO.has(move)    && dorme) ||
    (move === 'facade' && STATI_CHE_ACCENDONO_FACADE.has(statoAtk))

  const effectiveBP = potenzaDalPeso !== null ? potenzaDalPeso
    : potenzaDallaVelocita !== null ? potenzaDallaVelocita
    : isLastRespects ? lastRespectsBP
    : isWeatherBall && weatherBallType !== null ? 100
    : raddoppiaPerStato ? moveData.power * 2
    : moveData.power

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
  // ─── LE QUATTRO ROVINA ────────────────────────────────────────────────────
  //
  // Ognuna abbassa di un quarto (`0x0C00`) una statistica di tutti gli ALTRI
  // in campo. Nel riferimento sono due `if / else if` gemelli, uno per catena:
  // Tablets e Vessel in `calcAtMods` punto a (`damage_MASTER.js:1913`), Sword
  // e Beads in `calcDefMods` punto a (`:2082`). In tutt'e due i casi sono la
  // PRIMA cosa della catena.
  //
  // ─── PERCHE' NON BASTA GUARDARE L'ALTRO ──────────────────────────────────
  //
  // Verrebbe da scrivere «se il difensore ha Tablets, abbassa l'attacco»: nel
  // nostro modello a due Pokemon sembra equivalente, perche' se ce l'ha
  // l'attaccante il riferimento lo esenta comunque.
  //
  // Non lo e' nello specchio. Wo-Chien contro Wo-Chien: la casella e' accesa,
  // ma `attacker.ability !== "Tablets of Ruin"` e' FALSA, quindi il
  // riferimento non abbassa niente. La scorciatoia abbasserebbe. Percio' qui
  // e' trascritta la forma del riferimento — «e' in campo» E «non e' chi la
  // subisce» — e non la sua semplificazione.
  const ruinInCampo = (nome) =>
    !gasNeutro && (atkAbilEffect?.ruin === nome || defAbilEffect?.ruin === nome)

  const dfMods = []

  // punto a — Sword of Ruin e Beads of Ruin: ×0,75 sulla DIFESA di chi subisce.
  //
  // `hitsPhysical` nel riferimento non e' esattamente `!isSpecial`: comprende
  // anche Psyshock, Psystrike e Secret Sword, speciali che colpiscono la
  // Difesa (`damage_MASTER.js:2025`). Quella distinzione il nostro motore non
  // ce l'ha — `defStatIdx` sceglie la difesa dalla sola categoria — ed e' un
  // limite che precede questo blocco, non uno che introduce.
  //
  // L'`else if` fra le due e' del riferimento. Non e' osservabile — fisico e
  // speciale si escludono — ma si trascrive com'e' scritto.
  if (ruinInCampo('sword') && !isSpecial && defAbilEffect?.ruin !== 'sword') {
    dfMods.push(MOD.X0_75)
  }
  else if (ruinInCampo('beads') && isSpecial && defAbilEffect?.ruin !== 'beads') {
    dfMods.push(MOD.X0_75)
  }

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

  // punto b — Flower Gift dell'ALLEATO, lato difensore: ×1.5 sulla Difesa
  // Speciale, col sole (`damage_MASTER.js:2097`).
  //
  // È la stessa casella dell'altra metà, letta dall'altro lato: nel
  // riferimento sono due campi diversi (`isFlowerGiftAtk` e `isFlowerGiftSpD`)
  // perché la sua interfaccia ha due caselle, ma dicono la stessa cosa —
  // l'alleato ce l'ha, quindi ti alza l'Attacco quando attacchi e la Difesa
  // Speciale quando difendi.
  //
  // Sta al punto b, prima del paradosso (punto c), ed è un `if` a sé.
  if (field.flowerGiftSpD && isSole && isSpecial && defItemKey !== 'utility umbrella') {
    dfMods.push(MOD.X1_5)
  }

  // punto c — Grass Pelt: ×1,5 sulla Difesa col Campo Erboso, solo fisiche
  // (`damage_MASTER.js:2104`).
  //
  // Nel riferimento sta nello STESSO `if` di Marvel Scale, che vuole uno stato
  // e non lo modelliamo ancora; e apre la catena `c / else if d / else if e`
  // che prosegue col paradosso e con Fur Coat. Qui apre la stessa catena, con
  // lo stesso ordine: se un giorno arrivasse un caso a tre modificatori la
  // posizione conterebbe, e dev'essere gia' quella giusta.
  // Marvel Scale sta nello STESSO `if` di Grass Pelt (`:2103`), in `or`: x1,5
  // sulla Difesa di chi subisce, con qualunque stato. Finalmente ha una
  // condizione da leggere.
  if ((defAbilEffect?.marvelScale && statoDif !== 'healthy' && !isSpecial)
      || (defAbilEffect?.grassPelt && field.terrain === 'grassy' && !isSpecial)) {
    dfMods.push(MOD.X1_5)
  }
  else if (paradossoDifesa) dfMods.push(MOD.X1_3)
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

  // punto a — Tablets of Ruin e Vessel of Ruin: ×0,75 sull'ATTACCO di chi
  // colpisce (`damage_MASTER.js:1913`). Prima cosa della catena, come nel
  // riferimento, e con la stessa esenzione del portatore.
  if (ruinInCampo('tablets') && !isSpecial && atkAbilEffect?.ruin !== 'tablets') {
    atMods.push(MOD.X0_75)
  }
  else if (ruinInCampo('vessel') && isSpecial && atkAbilEffect?.ruin !== 'vessel') {
    atMods.push(MOD.X0_75)
  }

  // punto b — Slow Start: ×0,5 sull'attacco fisico, quando l'interruttore e'
  // acceso (`damage_MASTER.js:1924`).
  //
  // Il riferimento la mette in `or` con Defeatist, che chiede i punti salute e
  // non li modelliamo ancora. La sua condizione comprende anche le mosse Z
  // speciali: da noi le mosse Z non esistono, quindi resta il solo fisico.
  //
  // E' un `if` a se', prima del punto c e del punto d.
  // Defeatist sta nello STESSO `if` (`:1925`), in `or`: ×0,5 sull'attacco
  // quando i punti salute sono sotto la meta'. Non ha il controllo di
  // categoria che ha Slow Start — vale anche sulle mosse speciali.
  if ((atkAbilEffect?.slowStart && atkAbilityFlags.interruttore === true && !isSpecial)
      || (atkAbilEffect?.defeatist && atkAbilityFlags.interruttore === true)) {
    atMods.push(MOD.X0_5)
  }

  // punto d — ×1.5 offensive.
  // Fire Mane e Flash Fire stavano fra i modificatori di POTENZA o di danno
  // finale: li ha spostati D leggendo NCP, non un test rosso.
  const puntoD =
    (atkAbilEffect?.boostTipoAtk !== undefined && moveType === atkAbilEffect.boostTipoAtk) ||
    (atkAbilEffect?.sharpness && isSlicing) ||
    (atkAbilEffect?.gorillaTactics && !isSpecial) ||
    (atkAbilEffect?.flashFireImmune && atkAbilityFlags.flashFireActive && moveType === TYPES.FIRE) ||
    // Overgrow, Blaze, Torrent, Swarm: ×1,5 sulle mosse del proprio tipo
    // quando i punti salute sono a un terzo o meno (`:1942-1945`). Stanno
    // nello stesso `if` del resto del punto d, in `or`.
    (atkAbilEffect?.psBassiTipo !== undefined && moveType === atkAbilEffect.psBassiTipo
      && atkAbilityFlags.interruttore === true) ||
    // Guts: x1,5 sull'attacco fisico con qualunque stato (`:1941`). E' la
    // PRIMA condizione dello stesso `if`, in `or` con tutte le altre.
    (atkAbilEffect?.guts && statoAtk !== 'healthy' && !isSpecial)

  // punto e — Protosynthesis / Quark Drive sul lato offensivo, e Transistor:
  // ×1.3 se la statistica più alta è quella con cui si sta attaccando.
  //
  // Nel riferimento d ed e sono lo stesso `if / else if`, quindi il ×1.3 non
  // si somma mai al ×1.5 del punto d. Con un campo abilità solo le due non
  // possono nemmeno coesistere — l'`else` è qui per la stessa ragione
  // dell'altro, in fondo alla catena di difesa.
  //
  // La condizione guarda la CATEGORIA della mossa, non la statistica usata:
  // il riferimento scrive `move.category === "Physical"`. Su Body Press, che è
  // fisica ma attacca con la Difesa, la statistica potenziata resta quindi
  // l'Attacco. Trascritto, non corretto.
  const paradossoAttacco = preparazione.attaccante.paradosso && (
    (preparazione.attaccante.statPiuAlta === 'at' && !isSpecial) ||
    (preparazione.attaccante.statPiuAlta === 'sa' &&  isSpecial)
  )

  // Transistor sta nello STESSO `else if` del paradosso (`:1965`), non nel
  // ramo delle ×1.5 — e vale ×1.3, non ×1.5, perché il ramo ×1.5 lo nomina
  // solo a `gen == 8` (`:1946`) e noi giriamo a `gen = 10`. Vedi il commento
  // in `abilityEffects.js`: è il punto dove leggere la prima riga trovata
  // invece del ramo giusto darebbe un numero plausibile e sbagliato.
  const puntoE = paradossoAttacco ||
    (atkAbilEffect?.transistor && moveType === TYPES.ELECTRIC)

  // punto c — Flower Gift dell'ALLEATO: ×1.5 sull'Attacco, col sole.
  //
  // Nel riferimento sono due rami dello stesso `if / else if` (`:1929-1938`):
  // il primo è Cherrim che ce l'ha addosso, il secondo `field.isFlowerGiftAtk`,
  // cioè l'alleato. Qui c'è solo il secondo, perché Cherrim non è in Champions
  // e la prima metà non avrebbe nulla su cui essere vera.
  //
  // Il sole si legge con `indexOf("Sun")`, quindi vale anche il Sole Estremo —
  // e la nostra `isSole` fa già quella somma. L'Utility Umbrella lo spegne,
  // com'è scritto là.
  //
  // Sta PRIMA del punto d, quindi prima dell'`if / else if` qui sotto: è un
  // `if` a sé e si somma.
  if (field.flowerGiftAtk && isSole && !isSpecial && atkItemKey !== 'utility umbrella') {
    atMods.push(MOD.X1_5)
  }

  // Plus e Minus stanno nello STESSO `if` del punto d (`:1951`), quindi fra le
  // ×1.5: il riferimento le mette in `or` con Guts, Overgrow e le altre. Il
  // loro `abilityOn` significa «l'alleato ha l'altra delle due».
  const puntoDConInterruttore = puntoD ||
    (atkAbilEffect?.plusMinus && atkAbilityFlags.interruttore === true)

  // Solar Power è l'`else if` SUCCESSIVO (`:1958`), quindi non si somma al
  // punto d — e viene prima del ×1.3 del punto e.
  const solarPower = atkAbilEffect?.solarPower && isSole && isSpecial
    && atkItemKey !== 'utility umbrella'

  // punto f — Orichalcum Pulse e Hadron Engine: ×1,3333 (`0x1555`, `:1970`).
  //
  // ─── ORICHALCUM PULSE VUOLE IL SOLE NORMALE, NON QUELLO ESTREMO ─────────
  //
  // Il riferimento scrive `field.weather === "Sun"`, con l'uguale, dove Solar
  // Power due righe sopra scrive `indexOf("Sun") > -1`. Sotto Desolate Land
  // Solar Power si applica e Orichalcum Pulse no. Qui percio' si legge
  // `meteo === 'sun'` e non `isSole`: sono le due variabili che l'app tiene
  // gia' distinte per questa ragione.
  //
  // Hadron Engine guarda il terreno, dove la distinzione non esiste.
  const puntoF =
    (atkAbilEffect?.orichalcum && meteo === 'sun' && !isSpecial
      && atkItemKey !== 'utility umbrella') ||
    (atkAbilEffect?.hadron && field.terrain === 'electric' && isSpecial)

  if (puntoDConInterruttore) atMods.push(MOD.X1_5)
  else if (solarPower) atMods.push(MOD.X1_5)
  else if (puntoE) atMods.push(MOD.X1_3)
  else if (puntoF) atMods.push(MOD.X1_3333)

  // punto g — ×2 offensive: Water Bubble sull'Acqua, Huge Power / Pure Power,
  // e Stakeout quando l'interruttore e' acceso (`:1979`).
  //
  // Nel riferimento sono un `if` solo, in `or`: le tre non possono coesistere
  // — un campo abilita' e' uno — quindi il tre-in-uno non e' osservabile, ma
  // e' com'e' scritto.
  if (atkAbilEffect?.waterBubble && moveType === TYPES.WATER) atMods.push(MOD.X2)
  if (atkAbilEffect?.stakeout && atkAbilityFlags.interruttore === true) {
    atMods.push(MOD.X2)
  }
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
  // ── Protean e Libero: lo STAB anche fuori tipo ───────────────────────────
  //
  // Nel riferimento è un `else` (`damage_MASTER.js:2224-2233`), e la forma
  // conta più del numero:
  //
  //     if (attacker.hasType(move.type)) stabMod = Adaptability ? 0x2000 : 0x1800
  //     else if (Protean/Libero && (gen < 9 || abilityOn)) stabMod = 0x1800
  //
  // Se la mossa è GIÀ del tipo del Pokémon, Protean non viene nemmeno valutata:
  // vince il primo ramo, e il numero è identico a quello di chiunque altro.
  // Si vede SOLO sulle mosse fuori tipo. Un test che la provasse su una mossa
  // del tipo giusto passerebbe anche con l'abilità non implementata.
  //
  // A gen ≥ 9 serve l'interruttore; noi giriamo a 10, quindi `gen < 9` è falso
  // e resta solo `abilityOn`. Trascritto senza il primo ramo, che non ha nulla
  // su cui essere vero.
  //
  // ─── QUESTA È SOLO LA METÀ OFFENSIVA, ED È UNA SCELTA ────────────────────
  // Nel gioco Protean cambia il TIPO di chi la usa, e quel cambiamento vale
  // anche in difesa. Il riferimento non lo modella e per ora nemmeno noi:
  // decisione di Simone, registrata in `protean.test.js` insieme a cosa
  // comporterebbe farla.
  const stab = hasSTAB(moveType, atkTypes)
    ? (atkAbilEffect?.adaptability ? 2.0 : 1.5)
    : (atkAbilEffect?.protean && atkAbilityFlags.interruttore === true ? 1.5 : 1)

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
  //         Spiritoferreo                             ×1.5   0x1800
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

  // ─── PUNTO a — FRANGIAURA ────────────────────────────────────────────────
  //
  // Rovescia l'aura: dove ci sarebbe un ×1,33 mette un ×0,75
  // (`damage_MASTER.js:1573`). Non ci si moltiplica sopra — sono due rami
  // esclusivi dello stesso `auraBreak`, uno al punto a e uno al punto f.
  //
  // Vale per chi ce l'ha da tutt'e due i lati, come l'aura che rovescia: nel
  // riferimento sono due caselle senza lato.
  const auraDelTipoInCampo =
    [atkAbilEffect?.aura, defAbilEffect?.aura]
      .some(tipo => tipo !== undefined && tipo === moveType)
  const frangiaura =
    atkAbilEffect?.auraBreak === true || defAbilEffect?.auraBreak === true

  // `!field.isNeutralizingGas` sta in tutt'e due i rami dell'aura
  // (`damage_MASTER.js:1574` e `:1655`) e nelle quattro Rovina (`:1908-1909`,
  // `:2077-2078`).
  //
  // ─── E DA NOI NON E' OSSERVABILE. MISURATO. ──────────────────────────────
  //
  // Nel riferimento aure e Rovina vengono da CASELLE, che possono essere
  // accese da un alleato che nel calcolo non compare: li' il gas deve
  // spegnerle esplicitamente. Da noi vengono dai due slot, e il gas quegli
  // slot li ha gia' azzerati in `abilitaEffettive` — nessuna delle sei sta
  // fra le non spegnibili. Quindi la condizione non puo' mai essere la sola
  // cosa che decide.
  //
  // E' scritta lo stesso perche' e' vera nel riferimento, e perche' il giorno
  // in cui aure o Rovina diventassero caselle diventerebbe l'unica cosa che
  // le spegne.
  if (auraDelTipoInCampo && frangiaura && !gasNeutro) bpMods.push(MOD.X0_75)

  // c.i — abilità "ate": Pixilate, Aerilate, Refrigerate, Dragonize.
  if (ateBoost) bpMods.push(MOD.X1_2)

  // c.ii — Iron Fist sulle mosse-pugno, Reckless su quelle col contraccolpo.
  //
  // È un `else if` di c.i, e lo è nel riferimento (`damage_MASTER.js:1604`):
  // su una mossa convertita di tipo il ×1.2 del pugno NON si somma a quello
  // della conversione. Sono lo stesso `0x1333`, e sommarli darebbe ×1.44.
  //
  // Reckless legge il flag `rinculo` di moves.json, che vale per sedici mosse:
  // le tredici col contraccolpo in frazione dei danni inflitti (`recoilHP`) e
  // le tre che restano fra le quattro che feriscono chi manca il bersaglio
  // (`hasCrash`) — Double-Edge sta due volte nel vendor. Il riferimento
  // controlla anche `hasRecoil`, che oggi non ce l'ha nessuna mossa: lo
  // controlliamo lo stesso, dentro il flag, perché il giorno che comparisse
  // comparirebbe da sola.
  else if ((atkAbilEffect?.ironFist && isPunch) ||
           (atkAbilEffect?.reckless && isRinculo)) {
    bpMods.push(MOD.X1_2)
  }

  // ── punto d: le abilità dell'ALLEATO ─────────────────────────────────────
  //
  // Nel riferimento non hanno un nome: sono `field.isBattery`,
  // `field.isPowerSpot` e `field.isSteelySpirit` (`damage_MASTER.js:1609-1623`),
  // cioè caselle di campo, non abilità lette dal Pokémon. È coerente: chi le
  // possiede non è quello che attacca — è il compagno accanto.
  //
  // Sono tre `if` INDIPENDENTI, non una catena: un alleato con Power Spot e un
  // altro con Battery si sommano. E stanno tutti e tre PRIMA del punto e,
  // quindi prima di `tempBP` — un alleato con Power Spot può spegnere il
  // Tecnico di chi attacca.
  if (field.battery && isSpecial) bpMods.push(MOD.X1_3)
  if (field.powerSpot) bpMods.push(MOD.X1_3)
  if (field.steelySpiritAlleato && moveType === TYPES.STEEL) bpMods.push(MOD.X1_5)

  // e.iii — Analytic: ×1.3 se NON muovi per primo.
  //
  // ─── L'ORDINE DI TURNO NON VIENE DALL'INTERFACCIA ───────────────────────
  //
  // Se lo ricava il riferimento, in una riga (`damage_SV.js:147`):
  //
  //     var turnOrder = attacker.stats[SP] > defender.stats[SP] ? "FIRST" : "LAST";
  //
  // Due cose da non perdere nella traduzione.
  //
  // ─── E `stats[SP]` NON E' LA VELOCITA' COI SOLI STADI ───────────────────
  //
  // Qui c'era scritto il contrario, e la riga era sbagliata. Leggendo il solo
  // `damage_SV.js:147` sembra che `stats[SP]` siano gli stadi e basta, e la
  // sessione che ha scritto Analytic ne ha tratto la conclusione ragionevole:
  // usare `calcEffectiveSpe` sarebbe stato «migliorare» il riferimento.
  //
  // Ma quattro righe piu' su nello STESSO file (`damage_SV.js:43-53`),
  // dentro `CALCULATE_ALL_MOVES_SV` — che `CONTRIBUTING.md` dichiara essere
  // l'ingresso vero — c'e' questo, prima di ogni singolo calcolo:
  //
  //     p1.stats[SP] = getModifiedStat(p1.rawStats[SP], p1.boosts[SP]);
  //     setHighestStat(p1, 0);
  //     p1.stats[SP] = getFinalSpeed(p1, weather, tailwind, swamp, terrain);
  //
  // `getFinalSpeed` (`damage_MASTER.js:307`) e' Ferrolimo, Ferroblocco, Quick
  // Feet, Slow Start, le abilita' meteo, Surge Surfer, Unburden, Ventoincoda,
  // il paradosso e la paralisi. Quindi il riferimento la Velocita' effettiva
  // la guarda eccome: la scrive dentro `stats[SP]` prima di leggerla.
  //
  // Usare `calcEffectiveSpe` non e' migliorare il riferimento. E' trascriverlo.
  //
  // ─── PERCHE' NESSUN TEST L'HA VISTO PER DUE SESSIONI ───────────────────
  //
  // Perche' l'harness sbagliava d'accordo con noi. `calcola` entra da
  // `GET_DAMAGE_SV`, un livello sotto, e quelle tre righe non le eseguiva:
  // l'oracolo rispondeva con la stessa Velocita' incompleta, e il confronto
  // usciva verde. C'era perfino un caso «Analytic con lo Scarf ≡ NCP» che
  // passava — confrontando due numeri sbagliati nello stesso modo.
  //
  // La correzione all'harness e' nello stesso commit di questa riga, ed e' il
  // pezzo che rende la differenza rossa invece che invisibile. E' la stessa
  // forma del difetto che confondeva un danno fisso con un colpo nullo.
  //
  // ─── COSA RESTA FUORI ──────────────────────────────────────────────────
  //
  // Il Ventoincoda: `calculateDamage` non riceve i due lati del campo, e
  // l'harness lo passa `false` da tutt'e due le parti. Non e' una divergenza
  // nascosta — e' una casella che nessuno dei due accende — ma e' un confine,
  // e sta scritto invece che essere scoperto.
  //
  // Il confronto è `>` STRETTO, e l'`else` è «LAST». Quindi a parità esatta di
  // Velocità Analytic SI ACCENDE. È il caso che un `>=` scritto per simmetria
  // farebbe sparire, e nessun numero lo direbbe ad alta voce.
  //
  // ─── PERCHÉ IL CALCOLO STA QUI E IL PUSH PIÙ SOTTO ──────────────────────
  // Perché i cinque punti e.i-e.v sono una catena `else if` sola, e una
  // dichiarazione in mezzo la spezzerebbe — l'ho scoperto spezzandola. Il
  // confronto si calcola qui sopra, il push sta al suo posto nella catena,
  // fra e.ii (Impeto Sabbia) ed e.iv (Tough Claws).
  //
  // Gli stadi che si passano sono quelli DOPO la preparazione, non quelli
  // dell'argomento: nel riferimento `getFinalSpeed` gira dopo `checkIntimidate`
  // e compagnia, e legge `pokemon.boosts[SP]` gia' modificato. Stessa cosa per
  // l'abilita', che e' quella VERA — dopo Trace e Neutralizing Gas — perche'
  // `checkTrace` e `checkNeutralGas` sono le prime tre righe dell'ingresso
  // alto, prima di ogni assegnamento a `stats`.
  const muovePerPrimo = speAttaccante > speDifensore

  // e.i — Sheer Force: ×1.3 sulle mosse con un effetto secondario.
  //
  // Primo anello della catena `else if` del punto e, quindi batte tutti gli
  // altri quattro. Le 193 mosse non sono scritte qui: è il flag `secondario`
  // di moves.json, trascritto da `hasSecondaryEffect` del vendor.
  //
  // Nel gioco l'abilità toglie anche l'effetto secondario e spegne il
  // contraccolpo del Life Orb. Il riferimento non modella né l'una né l'altra
  // cosa nel danno: qui c'è il ×1.3 e basta.
  if (atkAbilEffect?.sheerForce && isSecondario) bpMods.push(MOD.X1_3)

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
  //
  // È il SECONDO anello della catena `else if`, non il primo: e.i è Sheer
  // Force, qui sopra. Vedi anche e.iv/e.v più sotto.
  else if (atkAbilEffect?.sandForce && meteo === 'sand'
      && (moveType === TYPES.ROCK || moveType === TYPES.GROUND || moveType === TYPES.STEEL)) {
    bpMods.push(MOD.X1_3)
  }

  // e.iv — Tough Claws sulle mosse a contatto. Il contatto è quello
  // EFFETTIVO: il Punching Glove lo toglie, e allora Tough Claws non vale.
  //
  // e.v — Punk Rock sulle mosse sonore, stesso ×1.3.
  //
  // I due sono incatenati con `else if` perché nel riferimento lo sono: e.i-e.v
  // sono un solo `if / else if`, e al massimo uno dei cinque si applica. Oggi
  // la catena non è osservabile — nessuna specie ha due di queste abilità, e
  // un Pokémon ne ha una sola — ma è così che è scritta, ed è così che va
  // letta il giorno che una casella di campo o una copia cambiassero le carte.
  //
  // Le diciotto mosse sonore vengono dal flag `sound` di moves.json.
  else if (atkAbilEffect?.analytic && !muovePerPrimo) bpMods.push(MOD.X1_3)
  else if (atkAbilEffect?.toughClaws && isContact) bpMods.push(MOD.X1_3)
  else if (atkAbilEffect?.punkRock && isSound) bpMods.push(MOD.X1_3)

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
  if (auraDelTipoInCampo && !frangiaura && !gasNeutro) bpMods.push(MOD.X1_33)

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
  // Flare Boost e Toxic Boost stanno nello stesso `if` di Tecnico (`:1670-1671`),
  // e sono le due che aspettavano lo stato. Leggono anche la CATEGORIA, e sono
  // opposte: Flare Boost solo speciale, Toxic Boost solo fisico.
  if (atkAbilEffect?.flareBoost && statoAtk === 'burned' && isSpecial) bpMods.push(MOD.X1_5)
  if (atkAbilEffect?.toxicBoost && STATI_VELENO.has(statoAtk) && !isSpecial) bpMods.push(MOD.X1_5)
  if (atkAbilEffect?.megaLauncher && isPulse) bpMods.push(MOD.X1_5)
  if (atkAbilEffect?.strongJaw && isBite) bpMods.push(MOD.X1_5)
  // Spiritoferreo, solo la metà «ce l'ha chi attacca». Quella dell'ALLEATO è
  // `field.isSteelySpirit` al punto d.iii del riferimento: una casella di campo
  // che non abbiamo, come per Battery e Power Spot.
  if (atkAbilEffect?.steelySpirit && moveType === TYPES.STEEL) bpMods.push(MOD.X1_5)

  // i — Dry Skin dal lato del DIFENSORE: ×1.25 sulle mosse Fuoco.
  //
  // È la seconda metà dell'abilità: l'altra è l'immunità all'Acqua, molto più
  // in su, in `immunityChecks`.
  //
  // ─── PERCHÉ IL POSTO CONTA, E NON È QUELLO CHE SEMBRA ────────────────────
  // La prima stesura l'aveva messa prima del punto f, con l'aura. Sbagliato:
  // nel riferimento è il punto i, DOPO g. E fra f e g si calcola `tempBP`,
  // cioè la potenza su cui Technician decide se accendersi — quindi un
  // modificatore spostato di là dalla riga sbagliata cambia una soglia, non
  // solo l'ordine di una moltiplicazione commutativa.
  //
  // Nel riferimento è un `else if` del punto h, che è Heatproof prima della
  // nona generazione. A gen 10 h non scatta mai, quindi i si valuta sempre; e
  // da noi Heatproof sta nell'altra catena (il ×0.5 al punto h di
  // `calcAtkMods`, dov'è a gen ≥ 9). Qui non c'è nessun `else` da scrivere
  // perché il ramo che lo precedeva non esiste in questa catena.
  if (defAbilEffect?.debolePerIlFuoco && moveType === TYPES.FIRE) {
    bpMods.push(MOD.X1_25)
  }

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

  // t — Electromorphosis: ×2 sulle mosse Elettro quando si è caricata.
  //
  // È il moltiplicatore più grosso di questo gruppo, e va letto bene: il
  // riferimento spinge `0x2000`, cioè ×2, non uno dei ×1.5 che gli stanno
  // intorno (`damage_MASTER.js:1764`).
  //
  // Nella stessa riga c'e' anche Wind Power, con lo stesso `abilityOn` e lo
  // stesso ×2: e' la stessa clausola, e da noi e' lo stesso campo `caricata`.
  // Il commento che stava qui diceva che nessuna specie legale la porta, ed
  // era falso — ce l'hanno Wattrel e Kilowattrel. Restava fuori `field.isCharge`,
  // la mossa Carica, che non modelliamo.
  if (atkAbilEffect?.caricata && atkAbilityFlags.interruttore === true
      && moveType === TYPES.ELECTRIC) {
    bpMods.push(MOD.X2)
  }

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
    critico ||
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
  //   b → Neuroforce, se super efficace                    ×1.25   0x1400
  //   d → Sniper, sul colpo critico                        ×1.5    0x1800
  //   e → Tinted Lens, se poco efficace                    ×2      0x2000
  //   g → Multiscale, Shadow Shield                        ×0.5    0x800
  //   h → Fluffy da contatto                               ×0.5    0x800
  //   i → Punk Rock in difesa, sulle mosse sonore          ×0.5    0x800
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
  // Il quarto del Protect: serve che il bersaglio si stia proteggendo E che
  // chi attacca sia uno dei due che lo bucano. Protect da solo non riduce
  // niente — nel riferimento non c'e' nessun ramo che lo faccia.
  const bucaProtect = field.protect === true && atkAbilEffect?.bucaProtect === true

  const finalMods = []

  if (schermoAttivo) finalMods.push(SCREEN_MOD)

  // b, d, e — le tre che moltiplicano il danno di chi attacca.
  //
  // Nel riferimento sono tre `if` SEPARATI e indipendenti (`:2336`, `:2346`,
  // `:2351`), non una catena: si sommano fra loro, e stanno tutti e tre PRIMA
  // di Multiscale. Un critico poco efficace di chi ha Sniper e Tinted Lens
  // prende tutti e due i moltiplicatori.
  //
  // Le soglie guardano l'efficacia GREZZA — il riferimento confronta
  // `typeEffectiveness` con 1, non il suo logaritmo. Con efficacia 0 la
  // condizione di Tinted Lens sarebbe vera, ma lì non si arriva: l'immunità
  // esce molto prima con `damage: [0]`.
  //
  // `critico` è lo stesso valore che più sotto moltiplica per 1.5 il
  // danno dentro il tiro. Sniper non lo sostituisce, ci si aggiunge.
  if (atkAbilEffect?.neuroforce && effectiveness > 1) finalMods.push(MOD.X1_25)
  if (atkAbilEffect?.sniper && critico)               finalMods.push(MOD.X1_5)
  if (atkAbilEffect?.tintedLens && effectiveness < 1) finalMods.push(MOD.X2)

  if (defAbilEffect?.multiscale && defAbilityFlags.multiscaleActive !== false) {
    finalMods.push(MOD.X0_5)
  }
  if (defAbilEffect?.fluffy && isContact)          finalMods.push(MOD.X0_5)
  // i — Punk Rock dal lato del DIFENSORE: le mosse sonore fanno metà danno.
  // È la seconda metà dell'abilità, e sta fra h (Fluffy da contatto) e j
  // (Ice Scales), dove la mette il riferimento (`:2370`).
  if (defAbilEffect?.punkRock && isSound)          finalMods.push(MOD.X0_5)
  if (defAbilEffect?.iceScales && isSpecial)       finalMods.push(MOD.X0_5)
  // k — Friend Guard dell'ALLEATO del difensore: ×0.75 (`:2380`).
  //
  // È l'unica delle cinque caselle che sta dal lato di chi SUBISCE, ed è anche
  // l'unica che oggi un alleato legale in M-B può davvero avere: Vivillon e
  // Maushold.
  //
  // `!move.ignoresFriendGuard` del riferimento non è trascritto: quel campo lo
  // accende `abilityIgnore`, cioè Mold Breaker e le tre mosse che ignorano
  // l'abilità. Da noi la condizione c'è, e passa per lo stesso valore.
  if (field.friendGuard && !ignoraAbilitaBersaglio) finalMods.push(MOD.X0_75)
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
  // La bruciatura non dipende dal roll: si decide una volta.
  const bruciaturaDimezza =
    statoAtk === 'burned' && !isSpecial
    && !atkAbilEffect?.guts
    && !MOSSE_CHE_IGNORANO_BRUCIATURA.has(move)

  const tiraRoll = (base) => {
    const out = []
    for (let r = 85; r <= 100; r++) {
    let damage = base

    // Meteo — il ×1.5 vale anche coi meteo estremi, il ×0.5 solo con quelli
    // normali (col meteo estremo il tipo opposto è già uscito come immune)
    // Mega Sol entra qui, e in due delle quattro righe: da' il ×1.5 al Fuoco
    // come farebbe il sole (`:2163`) e toglie il dimezzamento della pioggia
    // sul Fuoco (`:2173`). Sulle mosse Acqua non compare — il dimezzamento del
    // sole resta legato al meteo vero.
    if ((isSole || megaSol) && moveType === TYPES.FIRE) damage = Math.floor(damage * 1.5)
    if (isPioggia && moveType === TYPES.WATER) damage = Math.floor(damage * 1.5)
    if (meteo === 'sun'  && moveType === TYPES.WATER) damage = Math.floor(damage * 0.5)
    if (meteo === 'rain' && moveType === TYPES.FIRE && !megaSol) {
      damage = Math.floor(damage * 0.5)
    }

    // Critico
    if (critico) damage = Math.floor(damage * 1.5)

    // Roll random (85-100%)
    damage = Math.floor(damage * r / 100)

    // STAB
    if (stab > 1) damage = Math.floor(damage * stab)

    // Efficacia tipo
    damage = Math.floor(damage * effectiveness)

    // punto h — la bruciatura dimezza il danno fisico.
    //
    // ─── NON E' UN MODIFICATORE FINALE, ED E' LA COSA DA SAPERE ────────────
    //
    // Sta FRA l'efficacia di tipo (punto g) e la catena finale (punto i), ed e'
    // un `Math.floor(damage / 2)` nudo — non un `0x800` da concatenare
    // (`damage_MASTER.js:2255`). Metterlo in `finalMods` darebbe un numero
    // vicino e diverso, perche' `chainMods` accumula in virgola fissa e
    // arrotonda una volta sola, mentre qui si tronca subito.
    //
    // E' lo stesso genere di trappola del quarto di Protect, dall'altra parte
    // della catena.
    //
    // Le due eccezioni sono trascritte: Guts, che la annulla, e le mosse con
    // `ignoresBurn`, che nel vendor e' una sola — Facade.
    if (bruciaturaDimezza) damage = Math.floor(damage / 2)

    // ── CATENA FINALE (`calcFinalMods` di NCP) ─────────────────────────────
    // `finalMods` è costruita UNA volta sola, fuori dal loop: non dipende dal
    // roll. Qui dentro si applica e basta.
    if (finalMods.length > 0) {
      damage = pokeRound(damage * chainMods(finalMods) / FIXED_POINT)
    }

    // punto j — il quarto di chi buca il Protect.
    //
    // Sta FUORI dalla catena finale e DOPO di essa (`damage_MASTER.js:2261`):
    // e' un `pokeRound` suo, non un modificatore da concatenare. Metterlo in
    // `finalMods` darebbe un numero vicino e diverso, perche' `chainMods`
    // concatena in virgola fissa prima di arrotondare una volta sola.
    //
    // Essendo dentro il tiro, vale per ogni roll — e quindi anche per il
    // secondo colpo di Parental Bond, che passa dalla stessa funzione.
    if (bucaProtect) {
      damage = pokeRound(damage * MOD.X0_25 / FIXED_POINT)
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