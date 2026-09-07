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
 * La regola è «TUTTE le modifiche», e le due cose che restano fuori non sono
 * un residuo: sono le due che un numero solo non può dire.
 *
 * **Quello che dipende dalla MOSSA.** Affilato, Transistor, Fire Mane, Bolla
 * d'Acqua, Erbaiuto e sorelle stanno anch'esse nella catena della statistica
 * d'attacco, ma guardano il tipo o un flag della mossa. Una colonna che non sa
 * quale mossa userai scriverebbe un numero vero per una mossa e falso per le
 * altre tre — che è peggio di non scrivere niente, perché chi costruisce un
 * set decide su quel numero.
 *
 * Tattiche Scimmiesche invece c'è, e non è un'incoerenza: la sua condizione è
 * `move.category === "Physical"`, cioè vale per OGNI mossa fisica. Su un
 * Pokémon che attacca fisicamente è una proprietà dell'Attacco. La categoria
 * è il confine, non il tipo: la colonna dell'Attacco È quella delle fisiche.
 *
 * **Quello che dipende dall'AVVERSARIO o da un ALLEATO.** Intimidate, le
 * quattro Rovina, le abilità difensive che dimezzano l'attacco altrui, il
 * Flower Gift di un alleato. Questa funzione riceve un Pokémon solo. Chi vuole
 * vederli mette lo stadio a mano, che è il posto dove l'app lo ha sempre
 * chiesto.
 *
 * I due elenchi non sono qui e basta: `colonnaModCompleta.test.js` li asserisce
 * come casi, perché un confine scritto solo in un commento si allarga da sé.
 *
 * ─── E COSA C'E' DENTRO ────────────────────────────────────────────────────
 *
 * Tutto il resto delle due catene, strumenti compresi. Gli strumenti erano
 * fuori senza che nessuno l'avesse deciso — la Fascianodo dà ×1.5 sull'Attacco
 * su OGNI mossa fisica, esattamente come Tattiche Scimmiesche che c'era già —
 * e la colonna mostrava l'Attacco nudo.
 *
 * ─── COME SI SA CHE I NUMERI SONO GLI STESSI DEL DANNO ─────────────────────
 *
 * `calculateDamage` restituisce `atkStatFinal` e `defStatFinal`, cioè i due
 * numeri che entrano davvero nella formula, e il test li confronta con questi.
 * Non è una seconda scrittura della stessa logica che verifica la prima: è il
 * motore, che è già verificato contro NCP, messo accanto alla colonna.
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
import { MOD, chainMods, pokeRound, daDecimale, FIXED_POINT } from './modifiers.js'
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
 * Sono gli stessi che `calcEngine` spinge in `atMods` e in `dfMods`, e si
 * applicano qui come là: una `chainMods` sola con un `pokeRound` solo, non una
 * moltiplicazione per volta. Applicarli uno alla volta darebbe numeri che
 * divergono dal motore di qualche punto, cioè una colonna che contraddice il
 * danno scritto sotto.
 *
 * ─── L'ORDINE E' QUELLO DEL MOTORE, E NON E' DECORATIVO ────────────────────
 *
 * `chainMods` arrotonda a ogni passo, quindi due modificatori scambiati di
 * posto possono dare due numeri diversi. Qui i `push` seguono l'ordine delle
 * due catene di `calcEngine.js`, che a sua volta segue quello del riferimento:
 * prima le abilità, gli strumenti per ultimi.
 *
 * Anche i tre `else if` sono quelli del motore. Con un campo abilità solo non
 * possono servire — le condizioni si escludono da sé — ma copiarli costa una
 * riga, e dedurre che «tanto non capita» è il ragionamento che invecchia male.
 *
 * ─── LE DUE COLONNE SONO DUE LATI ──────────────────────────────────────────
 *
 * Attacco e Attacco Speciale portano i modificatori di `atMods`; Difesa e
 * Difesa Speciale quelli di `dfMods`. E la corrispondenza con la CATEGORIA è
 * incrociata sui due lati, il che è la cosa che si sbaglia leggendo in fretta:
 *
 *   Attacco   ← ciò che il motore applica quando la mossa è FISICA
 *   Difesa    ← ciò che applica quando la mossa che SUBISCE è fisica
 *
 * cioè `!isSpecial` in tutt'e due i casi, ma una volta è la mossa che tiri e
 * una volta quella che prendi.
 */
function moltiplicatori(slot, statIdx, contesto) {
  const { paradosso, statPiuAlta, meteo, terreno } = contesto
  const eff = ABILITY_EFFECTS[normalizeAbilityKey(slot?.ability)] || null
  const chiaveItem = String(slot?.item || '').toLowerCase()
  const item = ITEM_EFFECTS[chiaveItem] || null
  if (!eff && !item) return []

  const chiave = CHIAVE_DA_INDICE[statIdx]
  const mods = []

  // Le quattro caselle, dette una volta sola. `perLeFisiche` e `controLeFisiche`
  // sono lo stesso `!isSpecial` del motore letto dai due lati.
  const perLeFisiche    = statIdx === STAT_ATT
  const perLeSpeciali   = statIdx === STAT_SPA
  const attacco         = perLeFisiche || perLeSpeciali
  const controLeFisiche  = statIdx === STAT_DEF
  const controLeSpeciali = statIdx === STAT_SPD

  const interruttore = slot?.abilityFlags?.interruttore === true
  const stato = slot?.status || 'healthy'
  const ombrello = chiaveItem === 'utility umbrella'
  // Il motore distingue il sole normale da quello estremo, e le due abilità
  // che seguono NON lo leggono allo stesso modo: Solar Power accetta tutt'e due
  // (`indexOf("Sun")`), Orichalcum Pulse solo quello normale (`=== "Sun"`).
  // È una distinzione trascritta, non una svista da uniformare.
  const sole = meteo === 'sun' || meteo === 'harsh sunshine'

  const psSottoMeta = () => {
    const psMax = psMassimi(slot)
    return !!psMax && psSottoLaMeta(psCorrenti(slot, psMax), psMax)
  }

  if (attacco) {
    // ── CATENA ATTACCO (`calcAtMods`) ────────────────────────────────────
    //
    // Punto a — le Rovina — non c'è, e non è una dimenticanza: dipendono da
    // CHI STA DI FRONTE, e questa funzione riceve un Pokémon solo. È la stessa
    // ragione per cui Intimidate non c'è, scritta in cima.

    // punto b — Partenza Lenta (solo fisiche) e Sconfittite (tutt'e due).
    if (perLeFisiche && eff?.slowStart && interruttore) mods.push(MOD.X0_5)
    if (eff?.defeatist && psSottoMeta()) mods.push(MOD.X0_5)

    // punto c — Flower Gift dell'ALLEATO non c'è, per la ragione delle Rovina:
    // è una casella di campo che descrive un terzo Pokémon.

    // punti d / e / f — un `if / else if` solo nel motore, quindi uno solo qui.
    //
    // Del punto d entrano le tre condizioni che NON guardano la mossa: Forza
    // Bruta con qualunque stato, Più e Meno con l'interruttore, e Tattiche
    // Scimmiesche. Restano fuori Fire Mane, Affilato, Fuocardore acceso e le
    // quattro a vita bassa (Erbaiuto e sorelle), che guardano il TIPO o un
    // flag della mossa: un numero solo sarebbe vero per una mossa e falso per
    // le altre tre. È il confine dichiarato in cima a questo file.
    const puntoD =
      (perLeFisiche && eff?.guts && stato !== 'healthy') ||
      (eff?.plusMinus && interruttore) ||
      (perLeFisiche && eff?.gorillaTactics)
    // Solar Power è l'`else if` successivo: ×1.5 sulle speciali, col sole.
    const solarPower = perLeSpeciali && eff?.solarPower && sole && !ombrello
    // punto e — il paradosso. Transistor sta nello stesso ramo del motore ma
    // guarda il tipo della mossa, quindi resta fuori.
    const puntoE = paradosso && chiave === statPiuAlta
    // punto f — Pulsorichalco vuole il sole NORMALE (`=== "Sun"` nel
    // riferimento), Motore Adroneutronico il terreno elettrico.
    const puntoF =
      (perLeFisiche && eff?.orichalcum && meteo === 'sun' && !ombrello) ||
      (perLeSpeciali && eff?.hadron && terreno === 'electric')

    if (puntoD) mods.push(MOD.X1_5)
    else if (solarPower) mods.push(MOD.X1_5)
    else if (puntoE) mods.push(MOD.X1_3)
    else if (puntoF) mods.push(MOD.X1_3333)

    // punto g — le ×2. Bolla d'Acqua guarda il tipo della mossa e resta fuori;
    // Agguato e Grancasa/Forzapura no.
    if (eff?.stakeout && interruttore) mods.push(MOD.X2)
    if (eff?.atkMult) {
      // `statType: 'physical'` nella tabella vuol dire «sulle mosse fisiche», e
      // la statistica delle mosse fisiche è l'Attacco.
      const categoriaOk = !eff.statType || (eff.statType === 'physical' && perLeFisiche)
      if (categoriaOk) mods.push(daDecimale(eff.atkMult))
    }

    // punto h — le abilità difensive che dimezzano l'attacco altrui non ci
    // sono: sono dell'AVVERSARIO, e per giunta guardano il tipo della mossa.

    // punti i / j — gli strumenti, per ultimi come nel motore.
    if (item) {
      const specieOk = !item.soloSpecie || item.soloSpecie.includes(slot?.key)
      const categoriaOk = !item.statType
        || (item.statType === 'physical' && perLeFisiche)
        || (item.statType === 'special'  && perLeSpeciali)
      if (item.atkMult === 2 && specieOk && categoriaOk) mods.push(MOD.X2)
      else if (item.atkMult === 1.5 && categoriaOk) mods.push(MOD.X1_5)
    }
  }

  if (controLeFisiche || controLeSpeciali) {
    // ── CATENA DIFESA (`calcDefMods`) ────────────────────────────────────
    //
    // Punto a (Spada e Perle della Rovina) e punto b (Flower Gift dell'alleato)
    // non ci sono, per la ragione di sempre: descrivono altri Pokémon.

    // punto c — Squame Miracolo con qualunque stato, Mantoerboso sul terreno
    // erboso. Tutt'e due solo contro le fisiche, cioè sulla Difesa.
    const puntoC = controLeFisiche && (
      (eff?.marvelScale && stato !== 'healthy') ||
      (eff?.grassPelt && terreno === 'grassy')
    )
    // punto d — il paradosso, e punto e — Pelo Folto.
    const puntoD = paradosso && chiave === statPiuAlta
    const puntoE = controLeFisiche && eff?.furCoat

    if (puntoC) mods.push(MOD.X1_5)
    else if (puntoD) mods.push(MOD.X1_3)
    else if (puntoE) mods.push(MOD.X2)

    // punti f / g — gli strumenti, per ultimi come nel motore.
    //
    // `soloSeEvolvibile` è l'Evolcondensa: `canEvolve` è generato in
    // pokemon.json, e dove il campo manca preferiamo NON applicare il bonus
    // piuttosto che applicarlo a caso — la stessa scelta del motore.
    if (item) {
      const evolvibileOk = !item.soloSeEvolvibile || pokemonData[slot?.key]?.canEvolve === true
      const specieOk = !item.soloSpecie || item.soloSpecie.includes(slot?.key)
      if (evolvibileOk && specieOk) {
        if (item.defMult && controLeFisiche)  mods.push(daDecimale(item.defMult))
        if (item.spdMult && controLeSpeciali) mods.push(daDecimale(item.spdMult))
      }
    }
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

  const mods = moltiplicatori(slot, statIdx, { paradosso, statPiuAlta, meteo, terreno })
  const effettiva = mods.length > 0
    ? Math.max(1, pokeRound(conStadio * chainMods(mods) / FIXED_POINT))
    : conStadio

  return { grezza, effettiva, modificata: effettiva !== grezza }
}

/** Le cinque chiavi di boost, riesportate per chi disegna la colonna. */
export { CHIAVI_BOOST }

/** Gli indici delle cinque statistiche che hanno uno stadio. */
