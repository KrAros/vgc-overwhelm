/**
 * src/lib/stats.js
 *
 * Il calcolo delle statistiche finali, in un posto solo.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 * Prima della sessione C esistevano due implementazioni della stessa formula:
 *
 *   calcEngine.js → calcStat()       usata dal motore di danno
 *   utils/statCalc.js → calcFinalStat()  usata da speedOrder, StatRow, ReportPanel
 *
 * Producevano gli stessi numeri, ma solo la prima conosceva i bonus meteo
 * (Roccia sotto sabbia, Ghiaccio sotto neve). Due formule che oggi coincidono
 * per caso sono due formule che domani divergono: basta correggerne una.
 *
 * Questo file espone UNA `calcStat`. `utils/statCalc.js` sopravvive come
 * semplice ri-esportazione, per non dover riscrivere i suoi quattro chiamanti
 * in una sessione che deve restare a numeri invariati.
 *
 * ─── LA FORMULA ────────────────────────────────────────────────────────────
 * È quella classica di Game Freak, con la divisione intera a ogni passo:
 *
 *   HP        = ⌊(2·base + IV + ⌊EV/4⌋) · livello / 100⌋ + livello + 10
 *   le altre  = ⌊(⌊(2·base + IV + ⌊EV/4⌋) · livello / 100⌋ + 5) · natura / 10⌋
 *
 * I `Math.floor` non sono arrotondamenti estetici: il gioco tronca davvero a
 * ogni passaggio, e spostarne uno cambia il risultato di un'unità.
 */

import pokemonData from '../data/pokemon.json'
import { NATURE_MODIFIERS } from '../data/natures.js'
import { TYPES } from '../data/typeChart.js'
import { IV, LEVEL, spToEv, STAT_HP, STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD } from './rules.js'

/**
 * Il moltiplicatore di natura, espresso in decimi: 11 = +10%, 9 = −10%.
 *
 * Le nature neutre (Ardita, Docile…) sono registrate come `[0, 0]` in
 * `natures.js`. Il controllo `boost === 0` le intercetta prima dei confronti:
 * senza, una natura neutra darebbe +10% alla statistica di indice 0, che è
 * l'HP — che per fortuna esce prima da un altro ramo, ma è il tipo di
 * coincidenza su cui non conviene appoggiarsi.
 *
 * @param {string|null} nature
 * @param {number} stat — indice di statistica
 * @returns {10|11|9}
 */
export function getNatureModifier(nature, stat) {
  if (!nature || !NATURE_MODIFIERS[nature]) return 10
  const [boost, drop] = NATURE_MODIFIERS[nature]
  if (boost === 0) return 10
  if (stat === boost) return 11
  if (stat === drop) return 9
  return 10
}

/**
 * La statistica base di un Pokémon dal Pokédex.
 *
 * ─── L'ECCEZIONE AEGISLASH ─────────────────────────────────────────────────
 * Aegislash cambia forma con Stance Change: sta in forma Scudo (50 Atk /
 * 50 SpA, 150 Def / 150 SpD) finché non attacca, e nel momento in cui usa una
 * mossa offensiva passa in forma Spada, che ha i valori invertiti.
 *
 * Il Pokédex contiene entrambe le forme (`aegislash` e `aegislash-blade`), ma
 * modellare il passaggio come due entry separate obbligherebbe l'utente a
 * scegliere quella "sbagliata" per calcolare un attacco: nessuno seleziona
 * `aegislash-blade` per chiedersi quanto fa male il suo Shadow Ball.
 *
 * Quindi quando `aegislash` attacca usiamo i valori della forma Spada, e
 * quando difende quelli della forma Scudo — che è ciò che succede nel gioco.
 * L'override tocca solo Atk e SpA, che sono le uniche statistiche lette dal
 * lato attaccante.
 *
 * Resta un'eccezione hardcoded, e le eccezioni si moltiplicano. Se Champions
 * ne introduce una seconda, la strada giusta è un campo dichiarativo in
 * `pokemon.json` (es. `attackForm: 'aegislash-blade'`), non un secondo `if`.
 *
 * @param {string|null} pokemon — chiave del Pokédex
 * @param {number} stat — indice di statistica
 * @returns {number} 0 se il Pokémon non esiste
 */
export function getBaseStat(pokemon, stat) {
  if (!pokemon || !pokemonData[pokemon]) return 0
  if (pokemon === 'aegislash' && (stat === STAT_ATT || stat === STAT_SPA)) {
    // Il valore viene LETTO dalla forma Spada, non scritto qui. Fino alla
    // sessione I era un 150 hardcoded, e quando l'anagrafica ha portato
    // Aegislash ai 140 di Gen 9 il numero fisso è rimasto indietro: il
    // Pokédex diceva 140, il motore continuava a calcolare 150. Un dato in due
    // posti è un dato che prima o poi diverge.
    return pokemonData['aegislash-blade'].stats[stat]
  }
  return pokemonData[pokemon].stats[stat]
}

/**
 * La statistica finale di un Pokémon.
 *
 * ─── I BONUS METEO ─────────────────────────────────────────────────────────
 * Due meteo alzano una statistica difensiva senza che sia un boost:
 *   sabbia → +50% SpD ai tipi Roccia
 *   neve   → +50% Def ai tipi Ghiaccio
 * Non sono modificatori di danno ma modificatori di *statistica*, quindi
 * entrano qui e non nella catena dei moltiplicatori.
 *
 * Sono opzionali: chi chiama senza `weather` (l'editor, il calcolo della
 * velocità) ottiene la statistica nuda, che è ciò che vuole mostrare.
 *
 * ─── NOTA SUI NOMI DEL METEO ───────────────────────────────────────────────
 * Il confronto è con `'sand'` e `'snow'` esatti, e resta così: dalla sessione
 * F-1 il motore normalizza il meteo UNA volta all'ingresso di
 * `calculateDamage` (`normalizzaMeteo` in `lib/rules.js`), quindi qui arriva
 * sempre un nome canonico.
 *
 * Prima erano quattro liste di sinonimi in quattro file, e non coincidevano:
 * questa ne conosceva due, `calcEOT` tre, `WEATHER_BALL_TYPE` otto. Da lì
 * l'unica divergenza da NCP rimasta viva dopo D-2 — l'harness diceva
 * all'oracolo «neve» e il motore leggeva «grandine», una parola che non
 * conosceva.
 *
 * Chi chiama `calcStat` da fuori il motore (l'editor, `speedOrder`) o passa
 * già un nome canonico, o non passa il meteo affatto.
 *
 * @param {number} base — statistica base dal Pokédex
 * @param {number} sp — SP investiti in questa statistica
 * @param {number} [level=LEVEL]
 * @param {string|null} [nature]
 * @param {number} stat — indice di statistica
 * @param {string|null} [weather]
 * @param {number[]} [pokeTypes] — tipi del Pokémon, per i bonus meteo
 * @returns {number}
 */
export function calcStat(base, sp, level = LEVEL, nature = null, stat, weather = null, pokeTypes = []) {
  const ev = spToEv(sp)
  let result

  if (stat === STAT_HP) {
    result = Math.floor(((2 * base + IV + Math.floor(ev / 4)) * level) / 100) + level + 10
  } else {
    const raw = Math.floor(((2 * base + IV + Math.floor(ev / 4)) * level) / 100) + 5
    result = Math.floor(raw * getNatureModifier(nature, stat) / 10)
  }

  if (weather === 'sand' && stat === STAT_SPD && pokeTypes.includes(TYPES.ROCK)) {
    result = Math.floor(result * 1.5)
  }

  if (weather === 'snow' && stat === STAT_DEF && pokeTypes.includes(TYPES.ICE)) {
    result = Math.floor(result * 1.5)
  }

  return result
}