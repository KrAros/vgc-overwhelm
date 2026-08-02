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

var __node = new Proxy({}, {
  get: function (_target, prop) {
    if (prop === 'val') return function () { return undefined }
    if (prop === 'prop') return function () { return false }
    if (prop === 'is') return function () { return false }
    if (prop === 'text') return function () { return '' }
    if (prop === 'attr') return function () { return '' }
    if (prop === 'length') return 0
    return function () { return __node }
  },
})

var $ = function () { return __node }
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
