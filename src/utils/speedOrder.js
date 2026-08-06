/**
 * src/utils/speedOrder.js
 *
 * Chi attacca per primo. Priorità della mossa, Velocità finale, boost,
 * abilità meteo, strumenti, Trick Room.
 *
 * Esporta:
 *   SPEED_WEATHER_ABILITIES     tabella abilità → meteo che la accende
 *   speedWeatherAttiva(ability, weather) → boolean
 *   calcEffectiveSpe(pokemon, weather, tailwind) → number
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
import { normalizeAbilityKey } from '../data/abilityEffects.js'
import { calcStat } from '../lib/stats.js'
import { applyBoost, normalizzaMeteo, LEVEL, STAT_SPE } from '../lib/rules.js'
import { pokeRound } from '../lib/modifiers.js'

/**
 * Le abilità che raddoppiano la Velocità, e i meteo canonici che le accendono.
 *
 * Le chiavi sono nella forma di `normalizeAbilityKey` (minuscolo, trattini) e
 * i valori in quella di `normalizzaMeteo`. Nessuna delle due estremità accetta
 * sinonimi: la traduzione avviene una volta, in `speedWeatherAttiva`.
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
export const SPEED_WEATHER_ABILITIES = Object.freeze({
  'chlorophyll': ['sun', 'harsh sunshine'],
  'swift-swim':  ['rain', 'heavy rain'],
  'sand-rush':   ['sand'],
  'slush-rush':  ['snow'],
})

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
 * `getFinalSpeed` ha altri rami che qui non ci sono, tutti per la stessa
 * ragione: leggono uno stato che il nostro modello non ha.
 *
 *   paralisi (÷2)              nessuna condizione di stato — §1.12
 *   Quick Feet (×1.5)          idem, richiede uno status
 *   Unburden (×2)              richiede «ha PERSO l'item», non «non ha item».
 *                              Un Pokémon senza strumento non è sbilanciato:
 *                              trattare `item: null` come Unburden attivo
 *                              sarebbe sbagliato, non incompleto.
 *   Protosynthesis/Quark Drive richiedono la statistica più alta e il flag
 *   Slow Start, Surge Surfer   non ancora modellate
 *
 * Il ⚡ della matrice tace ancora in questi casi. La sessione F-2 li marca
 * nell'interfaccia insieme alle altre abilità non calcolate.
 *
 * @param {object} pokemon — slot dallo store
 * @param {string|null} weather
 * @param {boolean} [tailwind=false]
 * @returns {number}
 */
export function calcEffectiveSpe(pokemon, weather, tailwind = false) {
  if (!pokemon?.key) return 0
  const base = pokemonData[pokemon.key]?.stats?.[STAT_SPE] ?? 0
  const sp   = pokemon.sps?.[STAT_SPE] ?? 0

  // La tabella boost arriva da lib/rules dalla sessione C: prima questo file
  // ne aveva una copia propria, con 2/2 in posizione neutra invece di 1/1.
  // Davano lo stesso risultato, ma erano due tabelle.
  const spe = applyBoost(
    calcStat(base, sp, LEVEL, pokemon.nature, STAT_SPE),
    pokemon.speBoost ?? 0,
  )

  // ── otherSpeedMods, nell'ordine di NCP ───────────────────────────────────
  let altriMod = 1

  const item = (pokemon.item || '').toLowerCase()
  if (item === 'choice scarf') altriMod *= 1.5
  else if (ITEM_META_VELOCITA.has(item)) altriMod *= 0.5

  if (speedWeatherAttiva(pokemon.ability, weather)) altriMod *= 2

  if (tailwind) altriMod *= 2

  return pokeRound(spe * altriMod)
}

/**
 * Restituisce 't1' se T1 va prima, 't2' se T2 va prima, null se pareggio.
 */
export function whoGoesFirst(t1, t2, bestMoveT1, bestMoveT2, weather, trickRoom, tailwindT1 = false, tailwindT2 = false) {
  const p1 = movesData[bestMoveT1?.move]?.priority ?? 0
  const p2 = movesData[bestMoveT2?.move]?.priority ?? 0

  if (p1 !== p2) return p1 > p2 ? 't1' : 't2'

  const spe1 = calcEffectiveSpe(t1, weather, tailwindT1)
  const spe2 = calcEffectiveSpe(t2, weather, tailwindT2)

  if (spe1 === spe2) return null
  if (trickRoom) return spe1 < spe2 ? 't1' : 't2'
  return spe1 > spe2 ? 't1' : 't2'
}
