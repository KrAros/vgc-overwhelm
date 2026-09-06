// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * ─── QUANTO VALE DAVVERO UNA STATISTICA ─────────────────────────────────────
 *
 * Una funzione sola per rispondere alla domanda che la colonna «Mod» pone:
 * quanto vale questa statistica con addosso tutto quello che questo Pokémon ha
 * — stadi, abilità, strumento, meteo, terreno, Tailwind.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * Perché la colonna se lo calcolava da sé, e sapeva meno di quanto sapesse
 * l'app. `StatRow` applicava il ×2 delle abilità meteo e quello di Tailwind e
 * si fermava lì, mentre `calcEffectiveSpe` — usata a due centimetri di
 * distanza per l'ordine di velocità — conosceva anche lo Choice Scarf, l'Iron
 * Ball, il Macho Brace, Surge Surfer e il ×1.5 delle abilità paradosso.
 *
 * Sullo stesso Pokémon nella stessa schermata i due numeri non erano
 * d'accordo. È lo stesso difetto che la sessione F-1 aveva già corretto una
 * volta — la tabella meteo scritta in tre file con tre convenzioni — e la
 * correzione è la stessa: una fonte, e i consumatori la chiamano.
 *
 * ─── LA REGOLA CHE QUESTA FUNZIONE SERVE ───────────────────────────────────
 *
 * Chiesta da Simone: di un'abilità che potenzia una statistica si deve SEMPRE
 * poter leggere il nuovo valore. Non «il danno tiene conto del ×2 di Huge
 * Power»: il numero, scritto, dove si guardano le statistiche. Chi costruisce
 * un set decide su quel numero.
 *
 * ─── IL CONFINE, DICHIARATO ────────────────────────────────────────────────
 *
 * Questa funzione mostra solo i potenziamenti che appartengono al POKÉMON, non
 * alla mossa. Sharpness, Transistor, Dragon's Maw e le altre stanno anch'esse
 * nella catena della statistica d'attacco, ma dipendono dal tipo o da un flag
 * della mossa: un numero solo, in una colonna che non sa quale mossa userai,
 * sarebbe vero per una mossa e falso per le altre tre.
 *
 * Gorilla Tactics invece c'è, e non è un'incoerenza: la sua condizione è
 * `move.category === "Physical"`, cioè vale per OGNI mossa fisica. Su un
 * Pokémon che attacca fisicamente è una proprietà dell'Attacco, non della
 * mossa.
 *
 * Intimidate non c'è, e per un'altra ragione ancora: dipende dall'AVVERSARIO,
 * e questa funzione riceve un Pokémon solo. Chi vuole vederlo mette lo stadio
 * a mano, che è il posto dove l'app lo ha sempre chiesto.
 */

import pokemonData from '../data/pokemon.json'
import { ABILITY_EFFECTS, normalizeAbilityKey } from '../data/abilityEffects.js'
import { calcStat } from './stats.js'
import { psMassimi, psCorrenti } from './psSlot.js'
import {
  applyBoost, LEVEL, psSottoLaMeta,
  STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD, STAT_SPE,
} from './rules.js'
import { preparaSingolo, CHIAVI_BOOST } from './preparazione.js'
import { MOD, chainMods, pokeRound, FIXED_POINT } from './modifiers.js'
import { calcEffectiveSpe } from '../utils/speedOrder.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'

/** Da indice di statistica alla chiave di boost usata dalla preparazione. */
const CHIAVE_DA_INDICE = Object.freeze({
  [STAT_ATT]: 'at',
  [STAT_DEF]: 'df',
  [STAT_SPA]: 'sa',
  [STAT_SPD]: 'sd',
  [STAT_SPE]: 'sp',
})

/** Il campo dello store che tiene lo stadio, per statistica. */
const CAMPO_STADIO = Object.freeze({
  [STAT_ATT]: 'atkBoost',
  [STAT_DEF]: 'defBoost',
  [STAT_SPA]: 'spAtkBoost',
  [STAT_SPD]: 'spDefBoost',
  [STAT_SPE]: 'speBoost',
})

/** Le cinque statistiche che hanno uno stadio: tutte tranne gli HP. */
export const STAT_CON_STADIO = Object.freeze([STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD, STAT_SPE])

/**
 * I cinque stadi effettivi, nella forma che vuole `contaStadiPositivi`.
 *
 * Esportata per Forza Ancestrale e Sfoggio: la loro potenza è 20 più 20 per
 * ogni stadio positivo, e il motore la calcola sui boost PREPARATI — non su
 * quelli messi a mano. Farne un secondo conto in `potenzaMostrata.js`
 * vorrebbe dire che la riga della mossa e la colonna «Boost» possono dire due
 * cose diverse sullo stesso Pokémon, che è il difetto che questo file esiste
 * per togliere.
 *
 * Resta la differenza di portata già dichiarata in cima: l'editor guarda
 * «qualcuno nella squadra avversaria ha Intimidate», la matrice guarda
 * «questo avversario preciso». Sono due domande diverse, e in quei due posti
 * sono tutt'e due giuste.
 */
export function stadiEffettivi(slot, contesto = {}) {
  const { meteo = null, terreno = null, avversarioConIntimidate = false } = contesto
  const { statPiuAlta } = preparaSingolo(slot, meteo, terreno)
  const stadi = {}
  for (const statIdx of STAT_CON_STADIO) {
    stadi[CHIAVE_DA_INDICE[statIdx]] =
      stadioEffettivo(slot, statIdx, statPiuAlta, avversarioConIntimidate)
  }
  return stadi
}

/**
 * Lo stadio EFFETTIVO di una statistica: quello messo a mano più i gradi che
 * arrivano dalle abilità.
 *
 * Le due che li danno sono Intrepid Sword / Dauntless Shield (`boostIngresso`,
 * sempre, perché a gen 10 la condizione `gen !== 9` del riferimento è già
 * vera) e Rapidascesa quando ha messo KO (`boostStatPiuAltaSuKO`, che chiede
 * quale sia la statistica più alta e quindi la preparazione).
 */
function stadioEffettivo(slot, statIdx, statPiuAlta, avversarioConIntimidate) {
  const chiave = CHIAVE_DA_INDICE[statIdx]
  if (!chiave) return 0

  const eff = ABILITY_EFFECTS[normalizeAbilityKey(slot?.ability)] || null
  let stadio = slot?.[CAMPO_STADIO[statIdx]] || 0

  if (eff?.boostIngresso === chiave) stadio += 1
  if (eff?.boostStatPiuAltaSuKO && slot?.abilityFlags?.eelevateKOActive
      && statPiuAlta === chiave) {
    stadio += 1
  }
  // Le cinque che assorbono: il grado arriva solo quando chi usa l'app
  // dichiara che l'assorbimento c'e' gia' stato. Well-Baked Body ne dà due.
  if (eff?.boostAssorbimento?.stat === chiave && slot?.abilityFlags?.assorbimentoAttivo) {
    stadio += eff.boostAssorbimento.gradi
  }

  // ─── RATTLED: +1 ALLA VELOCITA' QUANDO SUBISCE INTIMIDATE ────────────────
  //
  // Il riferimento glielo da' DENTRO `checkIntimidate` (`:588`), e la nostra
  // preparazione lo calcola: `boosts.sp` vale 1. Ma quel valore non arrivava
  // qui — questa funzione riceve un Pokemon solo, e Rattled dipende
  // dall'avversario.
  //
  // Il dato pero' l'app ce l'ha gia': `SlotEditor` calcola
  // `opponentHasIntimidateActive` per Defiant, Contrary e Competitive, che
  // sono le altre tre della stessa famiglia. Rattled e' la quarta, e usa lo
  // stesso booleano — cosi' la colonna e il motore non possono dire due cose
  // diverse, perche' guardano lo stesso fatto.
  //
  // Resta una differenza di portata, ed e' voluta: l'editor guarda «qualcuno
  // nella squadra avversaria», la matrice guarda «questo avversario preciso».
  // Sono due domande diverse, e in quei due posti sono tutt'e due giuste.
  if (eff?.rattled && chiave === 'sp' && avversarioConIntimidate
      && !ITEM_EFFECTS[String(slot?.item || '').toLowerCase()]?.bloccaCaliAvversari) {
    stadio += 1
  }

  return Math.max(-6, Math.min(6, stadio))
}

/**
 * I moltiplicatori che il POKÉMON porta su una statistica, in virgola fissa.
 *
 * Sono gli stessi che `calcEngine` spinge in `atMods` e nella catena di
 * difesa, e si applicano qui come là: una `chainMods` sola con un `pokeRound`
 * solo, non una moltiplicazione per volta. Applicarli uno alla volta darebbe
 * numeri che divergono dal motore di qualche punto, cioè una colonna che
 * contraddice il danno scritto sotto.
 */
function moltiplicatori(slot, statIdx, { paradosso, statPiuAlta }) {
  const eff = ABILITY_EFFECTS[normalizeAbilityKey(slot?.ability)] || null
  if (!eff) return []
  const chiave = CHIAVE_DA_INDICE[statIdx]
  const mods = []

  // Huge Power e Pure Power: ×2 sull'Attacco. `statType: 'physical'` nella
  // tabella vuol dire «sulle mosse fisiche», e la statistica delle mosse
  // fisiche è l'Attacco.
  if (statIdx === STAT_ATT && eff.atkMult === 2.0 && eff.statType === 'physical') {
    mods.push(MOD.X2)
  }

  // Gorilla Tactics: ×1.5 su ogni mossa fisica, quindi sull'Attacco.
  if (statIdx === STAT_ATT && eff.gorillaTactics) mods.push(MOD.X1_5)

  // Fur Coat: ×2 sulla Difesa. Nel riferimento è `calcDefense` punto e.
  if (statIdx === STAT_DEF && eff.furCoat) mods.push(MOD.X2)

  // ─── LE DUE CHE DIMEZZANO, E CHE QUI NON C'ERANO ────────────────────────
  //
  // Sconfittite e Partenza Lenta stanno nello STESSO `if` del motore
  // (`calcEngine.js`, punto b di `calcAttack`, `damage_MASTER.js:1924-1925`) e
  // spingono `MOD.X0_5` in `atMods` — cioè sono modificatori della
  // statistica, esattamente come Gorilla Tactics che sta qui sopra.
  //
  // Non c'erano perché questa funzione era nata per rispondere a «di
  // un'abilità che POTENZIA una statistica si deve poter leggere il nuovo
  // valore», e nessuno aveva notato che la stessa ragione vale al contrario:
  // un Attacco dimezzato che la colonna mostra intero è sbagliato quanto un
  // Attacco raddoppiato che non mostra.
  //
  // Sconfittite arriva qui adesso perché adesso è raggiungibile: fino a ieri
  // la accendeva una levetta, oggi la accende la barra dei punti salute, e il
  // numero che serve a deciderlo è nello slot.
  //
  // Le condizioni sono quelle del motore, non due riscritte a mano:
  //   - Partenza Lenta ha `!isSpecial`, quindi è il solo Attacco;
  //   - Sconfittite NON ha il controllo di categoria, quindi sono tutt'e due.
  // Rientrano nel confine dichiarato in cima: valgono per OGNI mossa della
  // categoria, non per una.
  if (statIdx === STAT_ATT && eff.slowStart && slot?.abilityFlags?.interruttore === true) {
    mods.push(MOD.X0_5)
  }
  if ((statIdx === STAT_ATT || statIdx === STAT_SPA) && eff.defeatist) {
    const psMax = psMassimi(slot)
    if (psMax && psSottoLaMeta(psCorrenti(slot, psMax), psMax)) mods.push(MOD.X0_5)
  }

  // Protosynthesis / Quark Drive: ×1.3 sulla statistica più alta. La Velocità
  // è esclusa perché lì il potenziamento è ×1.5 e vive in `calcEffectiveSpe`,
  // che questa funzione chiama invece di rifarne il conto.
  if (paradosso && chiave === statPiuAlta && statIdx !== STAT_SPE) {
    mods.push(MOD.X1_3)
  }

  return mods
}

/**
 * Il valore di una statistica con tutto quello che il Pokémon ha addosso.
 *
 * @param {object} slot        lo slot dello store (key, sps, nature, ability,
 *                             item, *Boost, abilityFlags)
 * @param {number} statIdx     0..5
 * @param {object} [contesto]  { meteo, terreno, tailwind, livello }
 * @returns {{grezza: number, effettiva: number, modificata: boolean}}
 *          `grezza` è la statistica senza niente addosso (la colonna «Tot»),
 *          `effettiva` è quella da scrivere in «Mod», `modificata` dice se le
 *          due differiscono — cioè se c'è qualcosa da mostrare.
 */
export function statMostrata(slot, statIdx, contesto = {}) {
  const {
    meteo = null, terreno = null, tailwind = false, livello = LEVEL,
    avversarioConIntimidate = false,
  } = contesto

  const base = pokemonData[slot?.key]?.stats?.[statIdx]
  if (base === undefined) return { grezza: 0, effettiva: 0, modificata: false }

  const grezza = calcStat(base, slot?.sps?.[statIdx] ?? 0, livello, slot?.nature ?? null, statIdx)

  // Gli HP non hanno stadio né moltiplicatori: nessuna abilità di questo
  // gruppo li tocca, e la riga non ha nemmeno la casella dello stadio.
  if (statIdx === 0) return { grezza, effettiva: grezza, modificata: false }

  const { paradosso, statPiuAlta } = preparaSingolo(slot, meteo, terreno)

  // La Velocità la sa già qualcun altro, e la sa meglio: `calcEffectiveSpe`
  // porta lo Choice Scarf, l'Iron Ball, il Macho Brace, Surge Surfer, le
  // abilità meteo, Tailwind e il ×1.5 del paradosso. Rifarne il conto qui
  // sarebbe creare la seconda copia che questa funzione esiste per togliere.
  //
  // L'unica cosa che quella funzione non applica è il +1 di Rapidascesa —
  // scelta documentata in `preparazione.js`, perché legge lo stadio dello
  // store e non i boost preparati. Qui il +1 si applica prima, passandole uno
  // slot con lo stadio già alzato: così l'ordine di velocità resta quello che
  // era e la colonna dice la verità.
  if (statIdx === STAT_SPE) {
    const stadio = stadioEffettivo(slot, statIdx, statPiuAlta, avversarioConIntimidate)
    const conStadio = stadio === (slot?.speBoost || 0) ? slot : { ...slot, speBoost: stadio }
    const effettiva = calcEffectiveSpe(conStadio, meteo, tailwind, terreno)
    return { grezza, effettiva, modificata: effettiva !== grezza }
  }

  const stadio = stadioEffettivo(slot, statIdx, statPiuAlta, avversarioConIntimidate)
  const conStadio = applyBoost(grezza, stadio)

  const mods = moltiplicatori(slot, statIdx, { paradosso, statPiuAlta })
  const effettiva = mods.length > 0
    ? Math.max(1, pokeRound(conStadio * chainMods(mods) / FIXED_POINT))
    : conStadio

  return { grezza, effettiva, modificata: effettiva !== grezza }
}

/** Le cinque chiavi di boost, riesportate per chi disegna la colonna. */
export { CHIAVI_BOOST }

/** Gli indici delle cinque statistiche che hanno uno stadio. */
