/* eslint-disable */
/**
 * scripts/ncp/prelude.js
 *
 * Questo file viene eseguito DENTRO il contesto Node isolato prima dei sorgenti
 * di NCP. Serve a dare a quel codice le poche cose che si aspetta di trovare
 * nel browser e che qui non ci sono.
 *
 * Non è un modulo ES: è codice "vecchio stile" con `var`, eseguito come uno
 * script. È voluto — deve dichiarare globali nello stesso modo in cui lo fa un
 * `<script>` in una pagina, perché è così che i file di NCP si parlano fra loro.
 *
 * ─── PERCHÉ NON CARICHIAMO jQUERY VERO ────────────────────────────────────
 * jQuery vero servirebbe un DOM finto (jsdom), che è lento e introduce una
 * dipendenza pesante per una cosa che NCP usa pochissimo: nei nove file
 * vendorizzati ci sono 14 chiamate a `$()` in tutto, e sono tutte letture di
 * caselle di spunta dell'interfaccia. Qui rispondiamo "spento" a tutte.
 */

// ───────────────────────────────────────────────────────────────────────────
// 1. jQuery.extend
// ───────────────────────────────────────────────────────────────────────────
// Questo è l'unico pezzo di jQuery che deve funzionare *davvero*: i dataset di
// NCP sono costruiti a catena, ognuno estendendo il precedente
// (POKEDEX_SM → POKEDEX_SS_NATDEX → POKEDEX_SV_NATDEX → POKEDEX_ZA_NATDEX).
// Se `extend` sbaglia, i base stats escono sbagliati e non ce ne accorgiamo:
// il calcolo gira lo stesso e produce numeri plausibili.
//
// La versione "profonda" (primo argomento `true`) copia ricorsivamente gli
// oggetti annidati invece di condividerne il riferimento. Serve: senza,
// modificare le forme di Garchomp in Champions le modificherebbe anche in
// Gen 9, perché sarebbe lo stesso oggetto.

var __isPlain = function (o) {
  if (o === null || typeof o !== 'object') return false
  var proto = Object.getPrototypeOf(o)
  return proto === Object.prototype || proto === null
}

var __extend = function () {
  var args = Array.prototype.slice.call(arguments)
  var deep = false
  var i = 0
  if (typeof args[0] === 'boolean') { deep = args[0]; i = 1 }
  var target = args[i] || {}
  i++
  for (; i < args.length; i++) {
    var src = args[i]
    if (src == null) continue
    for (var name in src) {
      if (!Object.prototype.hasOwnProperty.call(src, name)) continue
      var copy = src[name]
      if (target === copy) continue
      if (deep && copy && (__isPlain(copy) || Array.isArray(copy))) {
        var srcVal = target[name]
        var clone
        if (Array.isArray(copy)) clone = Array.isArray(srcVal) ? srcVal : []
        else clone = __isPlain(srcVal) ? srcVal : {}
        target[name] = __extend(true, clone, copy)
      } else if (copy !== undefined) {
        target[name] = copy
      }
    }
  }
  return target
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Il nodo jQuery finto
// ───────────────────────────────────────────────────────────────────────────
// Un Proxy che risponde a qualunque metodo. Le risposte NON sono arbitrarie:
//
//   .val()  → undefined     NCP verifica `!= undefined` per capire se una
//                           casella è spuntata. Se qui restituissimo un
//                           oggetto (che è "vero"), si accenderebbero da sole
//                           le abilità Ruin, le Aura e i modificatori custom.
//                           Costato mezz'ora di debug: con un `val()` sbagliato
//                           il caso golden 01 usciva 31-37 invece di 41-49.
//   .prop() → false         "casella non spuntata"
//   .is()   → false         "non corrisponde"
//   .text() → ''            "campo vuoto"
//
// Tutto il resto restituisce il nodo stesso, così le catene tipo
// `$("#x").find(".y").hide()` non esplodono.

var __nodo = function (spuntata) {
  var self = new Proxy({}, {
    get: function (_target, prop) {
      if (prop === 'val') return function () { return spuntata ? 'on' : undefined }
      if (prop === 'prop') return function () { return !!spuntata }
      if (prop === 'is') return function () { return !!spuntata }
      if (prop === 'text') return function () { return '' }
      if (prop === 'attr') return function () { return '' }
      if (prop === 'length') return spuntata ? 1 : 0
      return function () { return self }
    },
  })
  return self
}

var __node = __nodo(false)
var __nodeAcceso = __nodo(true)

// ───────────────────────────────────────────────────────────────────────────
// 2-bis. Le caselle che si possono ACCENDERE
// ───────────────────────────────────────────────────────────────────────────
// Fino alla sessione delle aure la risposta era "spento" a tutte e quattordici
// le chiamate, e andava bene perché nessuna delle meccaniche dietro quelle
// caselle era implementata da noi.
//
// Aura Fatata e Aura Oscura hanno rotto quella comodità. In NCP non si leggono
// dall'abilità: `calcBPMods` guarda una casella dell'interfaccia,
//
//     var auraActive = ($("input:checkbox[id='" + move.type.toLowerCase() +
//                        "-aura']:checked").val() != undefined);
//
// e col nodo sempre spento il ramo non si accendeva mai. Non era un oracolo
// che diceva "zero": era un oracolo che non si poteva interrogare.
//
// ─── PERCHÉ ACCENDERE LA CASELLA NON È "AIUTARE" NCP ───────────────────────
// Perché è NCP stessa a legare la casella all'abilità, dieci righe più sotto:
//
//     if (isAttackerAura) description.attackerAbility = attacker.ability;
//
// dove `isAttackerAura` è `attacker.ability === (move.type + " Aura")`. Se la
// casella non volesse dire "c'è un'aura di quel tipo in campo", attribuire il
// bonus all'abilità sarebbe un errore del riferimento. La traduzione è quindi
// la stessa che l'harness fa già per `doubleTarget` → formato e per
// `multiscaleActive` → `curHP`: il nostro modello dice la cosa con l'abilità,
// il loro con la casella.
//
// E resta verificabile: i test delle aure controllano che NCP scriva il nome
// dell'abilità nella descrizione. Se la traduzione fosse arbitraria, non lo
// farebbe.
//
// ─── PERCHÉ LE CHIAVI SONO LE CASELLE E NON I TIPI ─────────────────────────
// Perché `move.type` che NCP usa qui è quello DOPO le abilità che cambiano
// tipo: con Pixilate sull'attaccante e Aura Fatata sul difensore, una mossa
// Normale arriva a questa riga come Folletto. Tenendo qui l'elenco delle aure
// accese — e non un tipo deciso da noi prima — è NCP a fare l'abbinamento con
// la sua nozione di tipo, che è l'unica giusta.

var __caselleSpuntate = Object.create(null)

/** Accende esattamente le caselle elencate, spegnendo tutte le altre. */
function __spunta(elenco) {
  __caselleSpuntate = Object.create(null)
  for (var i = 0; i < (elenco || []).length; i++) __caselleSpuntate[elenco[i]] = true
}

/** L'id della casella dentro un selettore, se il selettore ne nomina una. */
function __idSelettore(sel) {
  if (typeof sel !== 'string') return null
  var m = /\[id=['"]([^'"]+)['"]\]/.exec(sel)
  if (m) return m[1]
  m = /^#([A-Za-z0-9_-]+)$/.exec(sel)
  if (m) return m[1]
  return null
}

var $ = function (sel) {
  var id = __idSelettore(sel)
  return (id && __caselleSpuntate[id]) ? __nodeAcceso : __node
}
$.extend = __extend
$.isEmptyObject = function (o) { return !o || Object.keys(o).length === 0 }
var jQuery = $

// ───────────────────────────────────────────────────────────────────────────
// 3. Le due cose che vivono in ap_calc.js
// ───────────────────────────────────────────────────────────────────────────
// `ap_calc.js` è il file dell'interfaccia: 115 KB di gestione dei menu a
// tendina, con dentro due funzioni pure che il motore usa. Ricopiarle qui
// (identiche all'originale, righe 2164 e 1918 del file NCP) evita di caricare
// tutto il resto.

// ───────────────────────────────────────────────────────────────────────────
// 3-bis. Le globali che servono SOLO all'ingresso alto
// ───────────────────────────────────────────────────────────────────────────
// `CALCULATE_ALL_MOVES_SV` è l'ingresso vero di NCP: prima prepara i due
// Pokémon (Trace, Paradosso, Intimidate, Download, Sword/Shield, pesi) e poi
// chiama `GET_DAMAGE_SV` quattro volte per lato. Fino alla sessione F-2 noi
// entravamo direttamente da `GET_DAMAGE_SV`, e tutto lo strato di preparazione
// non era mai stato confrontato con niente.
//
// Queste quattro variabili le dichiara `ap_calc.js` a livello di pagina e le
// funzioni di preparazione le leggono e ci riscrivono dentro. Senza, il motore
// si ferma con un ReferenceError alla prima chiamata.
//
// I valori iniziali NON sono arbitrari, sono quelli della pagina appena
// caricata:
//
//   lastHighestStat    [-1, -1]        nessuna statistica ancora eletta come
//                                      "più alta" per Protosynthesis/Quark Drive
//   lastIntimidateState[false, false]  Intimidate non ancora applicato
//   lastParadoxState   [false, false]  nessun boost paradosso in corso
//   manualProtoQuark   false           l'utente non ha forzato a mano il boost
//                                      dal menu: lo deduce il motore dai dati
//
// `manualProtoQuark` in particolare va lasciato a `false`: a `true` NCP salta
// la propria logica e si aspetta che sia l'interfaccia a dire quale statistica
// è stata potenziata. Noi vogliamo misurare la SUA logica, non sostituirla.

var lastHighestStat = [-1, -1]
var lastIntimidateState = [false, false]
var lastParadoxState = [false, false]
var manualProtoQuark = false

function Side(format, terrain, weather, isGravity, isSR, spikes, isReflect, isLightScreen, isForesight, isHelpingHand, isFriendGuard, isBattery, isProtect, isPowerSpot, isSteelySpirit, isNeutralizingGas, isGmaxField, isFlowerGiftSpD, isFlowerGiftAtk, isTailwind, isSaltCure, isAuroraVeil, isSwamp, isSeaFire, isRedItem, isBlueItem, isCharge, isLeechSeed, isIngrain, isCurse, isBinding, isAquaRing, isNightmare) {
  this.format = format
  this.terrain = terrain
  this.weather = weather
  this.isGravity = isGravity
  this.isSR = isSR
  this.spikes = spikes
  this.isReflect = isReflect
  this.isLightScreen = isLightScreen
  this.isForesight = isForesight
  this.isHelpingHand = isHelpingHand
  this.isFriendGuard = isFriendGuard
  this.isBattery = isBattery
  this.isProtect = isProtect
  this.isPowerSpot = isPowerSpot
  this.isSteelySpirit = isSteelySpirit
  this.isNeutralizingGas = isNeutralizingGas
  this.isGMaxField = isGmaxField
  this.isFlowerGiftSpD = isFlowerGiftSpD
  this.isFlowerGiftAtk = isFlowerGiftAtk
  this.isTailwind = isTailwind
  this.isSaltCure = isSaltCure
  this.isAuroraVeil = isAuroraVeil
  this.isSwamp = isSwamp
  this.isSeaFire = isSeaFire
  this.isRedItem = isRedItem
  this.isBlueItem = isBlueItem
  this.isCharge = isCharge
  this.isLeechSeed = isLeechSeed
  this.isIngrain = isIngrain
  this.isCurse = isCurse
  this.isBinding = isBinding
  this.isAquaRing = isAquaRing
  this.isNightmare = isNightmare
}

var setHasTypeFunc = function () {
  for (var i = 0; i < arguments.length; i++) {
    if ([this.type1, this.type2].includes(arguments[i])) return true
  }
  return false
}
