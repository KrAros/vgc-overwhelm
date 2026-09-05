// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/utils/speedOrder.js
 *
 * Chi attacca per primo. Priorità della mossa, Velocità finale, boost,
 * abilità meteo, strumenti, Trick Room.
 *
 * Esporta:
 *   SPEED_WEATHER_ABILITIES     tabella abilità → meteo che la accende
 *   speedWeatherAttiva(ability, weather) → boolean
 *   calcEffectiveSpe(pokemon, weather, tailwind, terrain) → number
 *   whoGoesFirst(...) → 't1' | 't2' | null
 *
 * ─── LA TABELLA ERA IN TRE COPIE, E LE TRE NON COINCIDEVANO ────────────────
 * Fino alla sessione F-1 la corrispondenza abilità → meteo esisteva in tre
 * file, scritta tre volte con tre convenzioni diverse per le chiavi:
 *
 *   AbilityFlags.jsx   chiavi col trattino, confronto su `normalizeAbilityKey`
 *                      → funzionava su tutte e quattro
 *   speedOrder.js      chiavi miste ('sand-rush' ma 'swift swim'),
 *                      confronto su `toLowerCase()`
 *                      → ne azzeccava due su quattro
 *   SlotEditor.jsx     chiavi tutte col trattino, confronto su `toLowerCase()`
 *                      → una su quattro
 *
 * Lo store salva le abilità come le scrive `abilities.json`, cioè con lo
 * spazio: `'sand rush'`. Quindi l'editor accendeva il fulmine su Sand Rush e
 * la matrice no, sullo stesso Pokémon nella stessa schermata — e nessuno dei
 * due era d'accordo con SlotEditor, che non lo accendeva mai tranne che su
 * Chlorophyll.
 *
 * Ora la tabella è una, le chiavi sono normalizzate con la funzione che già
 * esiste, e i tre consumatori chiamano `speedWeatherAttiva`.
 */

import pokemonData from '../data/pokemon.json'
import movesData   from '../data/moves.json'
import { normalizeAbilityKey, ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { calcStat } from '../lib/stats.js'
import { preparaSingolo, preparaCoppia } from '../lib/preparazione.js'
import { applyBoost, normalizzaMeteo, LEVEL, STAT_SPE } from '../lib/rules.js'
import { pokeRound } from '../lib/modifiers.js'

/**
 * Le abilità che raddoppiano la Velocità, e i meteo canonici che le accendono.
 *
 * Le chiavi sono nella forma di `normalizeAbilityKey` (minuscolo, trattini) e
 * i valori in quella di `normalizzaMeteo`. Nessuna delle due estremità accetta
 * sinonimi: la traduzione avviene una volta, in `speedWeatherAttiva`.
 *
 * ─── E LA QUARTA COPIA, CHE ERA DORMIENTE ──────────────────────────────────
 * La nota qui sotto racconta di tre copie disallineate, riunite in questa. Ce
 * n'era una quarta e nessuna delle tre l'aveva vista: `sandRush: true` e
 * `speedWeather: true` in `ABILITY_EFFECTS`, che NESSUN file leggeva. Non
 * sbagliavano — non facevano niente, e sembravano il meccanismo.
 *
 * Adesso il dato sta LA' — `speedWeather: ['sun', 'harsh sunshine']` — e
 * questa tabella si costruisce da quello. Le copie sono zero.
 *
 * ─── PERCHÉ CHLOROPHYLL HA DUE METEO E SAND RUSH UNO ──────────────────────
 * Non è un'asimmetria nostra, è quella di NCP (`getFinalSpeed`, punto f):
 * Chlorophyll controlla `weather.indexOf("Sun")`, che accetta anche il Sole
 * Estremo, e Swift Swim `indexOf("Rain")`, che accetta la Pioggia Intensa.
 * Sand Rush confronta con `"Sand"` esatto — e va bene, perché una sabbia
 * estrema non esiste.
 *
 * Slush Rush in NCP accetta `["Hail", "Snow"]`; da noi la grandine non è più
 * una condizione separata (vedi `normalizzaMeteo`), quindi resta `snow`.
 */
export const SPEED_WEATHER_ABILITIES = Object.freeze(
  Object.fromEntries(
    Object.entries(ABILITY_EFFECTS)
      .filter(([, v]) => Array.isArray(v.speedWeather))
      .map(([chiave, v]) => [chiave, Object.freeze([...v.speedWeather])]),
  ),
)

/**
 * True se l'abilità raddoppia la Velocità con questo meteo.
 *
 * Accetta l'abilità in qualunque forma la salvi lo store (`'sand rush'`,
 * `'Sand Rush'`) e il meteo in qualunque forma arrivi (`'hail'`, `'SNOW'`).
 *
 * @param {string|null} ability
 * @param {string|null} weather
 * @returns {boolean}
 */
export function speedWeatherAttiva(ability, weather) {
  const condizioni = SPEED_WEATHER_ABILITIES[normalizeAbilityKey(ability)]
  if (!condizioni) return false
  const meteo = normalizzaMeteo(weather)
  return meteo !== null && condizioni.includes(meteo)
}

/**
 * Gli strumenti che dimezzano la Velocità (`getFinalSpeed` punto b).
 * Stanno nello stesso `else if` di Choice Scarf: un Pokémon ha un item solo,
 * quindi l'esclusione non può servire, ma è la specifica.
 */
const ITEM_META_VELOCITA = new Set([
  'macho brace', 'iron ball',
  'power anklet', 'power band', 'power belt',
  'power bracer', 'power lens', 'power weight',
])

/**
 * La Velocità effettiva di un Pokémon.
 *
 * ─── COME COMBINA I MODIFICATORI (trascritto, non dedotto) ─────────────────
 * NCP accumula TUTTI i moltiplicatori in un decimale unico e arrotonda una
 * volta sola:
 *
 *     speed = pokeRound(speed * otherSpeedMods)
 *
 * Non è pignoleria. Prima qui c'erano due `spe = spe * 2` in fila, che sugli
 * interi non fanno danno; ma appena entra Choice Scarf col suo ×1.5 la
 * differenza diventa reale — `floor(103 × 1.5) × 2 = 308` contro
 * `pokeRound(103 × 3) = 309`. È lo stesso errore che D-2 ha tolto dalla catena
 * dei danni, e non aveva senso reintrodurlo qui.
 *
 * ─── COSA MANCA ANCORA, E PERCHÉ ──────────────────────────────────────────
 * `getFinalSpeed` ha altri rami che qui non ci sono. Elencati dopo averli
 * CONTATI sul vendor, non a memoria — la prima stesura di questo commento
 * diceva che mancavano tutti «per la stessa ragione», e non era vero.
 *
 * Bloccati da uno stato che non modelliamo:
 *   paralisi (÷2, punto 3)      nessuna condizione di stato — §1.12.
 *                               Lo store non ha proprio un campo `status`.
 *   Quick Feet (×1.5, punto d)  idem: si accende con uno status qualsiasi
 *   Slow Start (×0.5, punto e)  richiede il conteggio dei turni in campo
 *   Unburden (×2, punto f)      richiede «ha PERSO l'item», non «non ha
 *                               item». Un Pokémon senza strumento non è
 *                               sbilanciato: trattare `item: null` come
 *                               Unburden attivo sarebbe SBAGLIATO, non
 *                               incompleto. È l'unico che non va aggiunto
 *                               quando arriverà il resto.
 *                               NOTA (F-2): NCP lo fa proprio nel modo
 *                               ingenuo — `pokemon.item === ""`, riga 337.
 *                               Nella loro interfaccia funziona perché lo
 *                               strumento resta scritto finché non viene
 *                               rimosso. Copiarlo da lì erediterebbe l'errore:
 *                               qui l'oracolo non va trascritto.
 *   Utility Umbrella (punto f)  annulla Chlorophyll e Swift Swim, ma
 *                               l'ombrello non è in `items.json`: è un
 *                               buco di dati, non di motore
 *
 * Fatto in F-2:
 *   Surge Surfer (×2, punto f)  raddoppia sul Campo Elettrico. Trascritto dal
 *                               vendor (damage_MASTER.js:336): sta nello
 *                               stesso blocco `×2` delle abilità meteo e NON
 *                               ha un cancello sul contatto col terreno —
 *                               verificato leggendo, non dedotto.
 *
 * Fatto in J:
 *   Protosynthesis / Quark      ×1.5 quando la statistica più alta è la
 *     Drive (×1.5, punto i)     Velocità. Il flag e la statistica più alta
 *                               arrivano da `lib/preparazione.js`, che è lo
 *                               stesso posto da cui li prende il motore del
 *                               danno: una fonte sola per due consumatori.
 *
 *                               IL CONFINE: qui la statistica più alta è
 *                               calcolata sui boost dello slot e basta, senza
 *                               Intimidate né Intrepid Sword — questa
 *                               funzione riceve un Pokémon alla volta e non sa
 *                               chi ha davanti. Nel gioco quegli stadi
 *                               possono spostare quale statistica è la più
 *                               alta. Serve un paradosso con due statistiche
 *                               a un soffio l'una dall'altra, quindi è un
 *                               caso di confine — ma è un confine, e sta
 *                               scritto invece che essere scoperto.
 *
 * Fuori portata per scelta:
 *   Grass/Water Pledge (punto h) le mosse Pledge non esistono nel modello
 *   Quick Powder (punto c)       vale solo per Ditto
 *
 * Finché mancano, il ⚡ della matrice tace nei casi corrispondenti: dice il
 * falso solo se qualcuno si aspetta che sappia tutto. La sessione F-2 lo
 * dichiara nell'interfaccia insieme alle altre abilità non calcolate.
 *
 * @param {object} pokemon — slot dallo store
 * @param {string|null} weather
 * @param {boolean} [tailwind=false]
 * @param {string|null} [terrain=null] — serve a Surge Surfer. Ultimo parametro
 *        e con un valore di riposo, così i chiamanti che non lo passano
 *        continuano a funzionare come prima.
 * @param {number} [livello=LEVEL] — il livello di chi calcola. La matrice
 *        lavora sempre a 50 e non lo passa; `calculateDamage` invece accetta
 *        un livello per chiamata, e da quando l'ordine di turno di Analytic
 *        passa di qui quel livello deve arrivarci. Inchiodarlo a `LEVEL`
 *        avrebbe dato la risposta giusta a 50 e sbagliata altrove, cioè il
 *        difetto che non si vede.
 * @returns {number}
 */
export function calcEffectiveSpe(pokemon, weather, tailwind = false, terrain = null, livello = LEVEL) {
  if (!pokemon?.key) return 0
  const base = pokemonData[pokemon.key]?.stats?.[STAT_SPE] ?? 0
  const sp   = pokemon.sps?.[STAT_SPE] ?? 0

  // La tabella boost arriva da lib/rules dalla sessione C: prima questo file
  // ne aveva una copia propria, con 2/2 in posizione neutra invece di 1/1.
  // Davano lo stesso risultato, ma erano due tabelle.
  const spe = applyBoost(
    calcStat(base, sp, livello, pokemon.nature, STAT_SPE),
    pokemon.speBoost ?? 0,
  )

  // ── otherSpeedMods, nell'ordine di NCP ───────────────────────────────────
  let altriMod = 1

  const item = (pokemon.item || '').toLowerCase()
  if (item === 'choice scarf') altriMod *= 1.5
  else if (ITEM_META_VELOCITA.has(item)) altriMod *= 0.5

  if (speedWeatherAttiva(pokemon.ability, weather)) altriMod *= 2

  // Surge Surfer. Nel vendor sta nello stesso blocco `×2` delle abilità meteo
  // (damage_MASTER.js:336), quindi qui accanto. Nessun cancello sul contatto
  // col terreno: NCP non ce l'ha, e Raichu di Alola è comunque a terra —
  // aggiungerlo sarebbe una condizione inosservabile, cioè non verificabile.
  if (normalizeAbilityKey(pokemon.ability) === 'surge-surfer'
      && String(terrain || '').toLowerCase() === 'electric') {
    altriMod *= 2
  }

  if (tailwind) altriMod *= 2

  // Punto i — Protosynthesis / Quark Drive. Il ×1.5 vale SOLO se la statistica
  // più alta è la Velocità: sulle altre quattro il potenziamento è ×1.3 e vive
  // nelle catene del danno, non qui.
  const { paradosso, statPiuAlta } = preparaSingolo(pokemon, weather, terrain)
  if (paradosso && statPiuAlta === 'sp') altriMod *= 1.5

  // Punto d — Quick Feet: x1,5 con QUALUNQUE stato (`damage_MASTER.js:324`).
  // Sta prima delle abilita' meteo, in un `if / else if` con Slow Start: da noi
  // e' qui perche' la moltiplicazione e' commutativa e `altriMod` non
  // arrotonda mai a meta' strada — l'unico arrotondamento e' il `pokeRound`
  // finale.
  const stato = pokemon.status || 'healthy'
  const quickFeet = normalizeAbilityKey(pokemon.ability) === 'quick-feet'
  if (quickFeet && stato !== 'healthy') altriMod *= 1.5

  const velocita = pokeRound(spe * altriMod)

  // ─── PUNTO 3 — LA PARALISI, E STA FUORI DA `altriMod` ─────────────────────
  //
  // Nel riferimento non e' un moltiplicatore: e' un passaggio a se', DOPO il
  // `pokeRound` di tutti gli altri, e tronca invece di arrotondare
  // (`damage_MASTER.js:349-355`). Scriverlo come `altriMod *= 0.5` darebbe un
  // numero diverso ogni volta che la Velocita' e' dispari.
  //
  // Quick Feet la annulla: chi ce l'ha non subisce il dimezzamento — ed e'
  // scritto nella stessa condizione, non altrove.
  if (stato === 'paralyzed' && !quickFeet) return Math.floor(velocita / 2)

  return velocita
}

/**
 * Restituisce 't1' se T1 va prima, 't2' se T2 va prima, null se pareggio.
 */
/**
 * Da slot dello store a «lato» come lo vuole `preparaCoppia`.
 *
 * I nomi dei campi non coincidono — lo store dice `key` e `abilityFlags`, la
 * preparazione dice `pokemon` e `abilitaAccesa` — e questa e' la traduzione,
 * scritta una volta sola.
 */
function latoPerPreparazione(p) {
  const f = p?.abilityFlags || {}
  return {
    pokemon: p?.key ?? null,
    sps: p?.sps || [0, 0, 0, 0, 0, 0],
    natura: p?.nature ?? null,
    livello: LEVEL,
    abilita: p?.ability ?? null,
    strumento: p?.item ?? null,
    abilitaAccesa: f.intimidateActive === true || f.interruttore === true,
    koFatto: f.eelevateKOActive === true,
    assorbimentoFatto: f.assorbimentoAttivo === true,
    boosts: {
      at: p?.atkBoost || 0, df: p?.defBoost || 0, sa: p?.spAtkBoost || 0,
      sd: p?.spDefBoost || 0, sp: p?.speBoost || 0,
    },
  }
}

export function whoGoesFirst(t1, t2, bestMoveT1, bestMoveT2, weather, trickRoom, tailwindT1 = false, tailwindT2 = false, terrain = null) {
  const p1 = movesData[bestMoveT1?.move]?.priority ?? 0
  const p2 = movesData[bestMoveT2?.move]?.priority ?? 0

  if (p1 !== p2) return p1 > p2 ? 't1' : 't2'

  // ─── GLI STADI VENGONO DALLA PREPARAZIONE, NON DALLO STORE ────────────────
  //
  // `calcEffectiveSpe` legge `pokemon.speBoost`, cioe' lo stadio messo a mano
  // nell'editor. Ma alla Velocita' arrivano anche gradi che nessuno mette a
  // mano: il +1 di Rattled quando subisce Intimidate (`damage_MASTER.js:588`),
  // il +1 dell'Orbo Adrenalina, il +1 di Battle Bond.
  //
  // La preparazione li calcola gia' tutti — e li calcolava anche prima, ma
  // finivano in un campo che nessuno leggeva. Qui i due Pokemon ci sono
  // tutt'e due, quindi si puo' chiedere a lei.
  //
  // ─── PERCHE' NON BASTAVA LA COLONNA «Mod» ────────────────────────────────
  //
  // Perche' avrebbe creato due sorgenti che dicono numeri diversi sullo stesso
  // Pokemon: la colonna con Rattled e l'indicatore senza. E' il difetto che
  // `statMostrata` esiste per aver corretto una volta.
  const prep = preparaCoppia({
    attaccante: latoPerPreparazione(t1),
    difensore:  latoPerPreparazione(t2),
    meteo: weather, terreno: terrain,
  })
  const conStadio = (p, stadio) =>
    (p?.speBoost || 0) === stadio ? p : { ...p, speBoost: stadio }

  const spe1 = calcEffectiveSpe(
    conStadio(t1, prep.attaccante.boosts.sp), weather, tailwindT1, terrain)
  const spe2 = calcEffectiveSpe(
    conStadio(t2, prep.difensore.boosts.sp), weather, tailwindT2, terrain)

  if (spe1 === spe2) return null
  if (trickRoom) return spe1 < spe2 ? 't1' : 't2'
  return spe1 > spe2 ? 't1' : 't2'
}
