// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/lib/preparazione.js
 *
 * Quello che succede ai due Pokémon PRIMA che il danno venga calcolato.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 * Il riferimento non calcola il danno appena riceve i due Pokémon. Prima li
 * sistema: Intimidate abbassa l'Attacco, Intrepid Sword lo alza, la Booster
 * Energy accende un'abilità paradosso e sparisce, Download guarda le difese
 * avversarie e sceglie da che parte crescere. Solo dopo comincia la formula.
 *
 * Fino alla sessione F-2 noi entravamo un livello più in basso, da
 * `GET_DAMAGE_SV`, che riceve i due Pokémon GIÀ SISTEMATI. Tutto questo strato
 * non era confrontato con niente: «zero divergenze dal riferimento» era vero
 * per la formula e falso per lo stato di partenza. Aperto l'ingresso alto, la
 * prima sonda ha trovato diciotto divergenze — di cui undici su Intimidate,
 * che già modellavamo e sbagliavamo di un terzo.
 *
 * ─── PERCHÉ UN MODULO E NON RIGHE DENTRO `calcEngine` ──────────────────────
 * Perché questo strato è SIMMETRICO e il motore non lo è.
 *
 * `calculateDamage` ragiona su una direzione sola: c'è un attaccante e c'è un
 * difensore. La preparazione invece tocca tutti e due, in un ordine che conta,
 * e alcuni effetti attraversano: Mirror Armor rimanda il calo al mittente,
 * quindi l'Intimidate del difensore può finire per abbassare l'Attacco
 * dell'attaccante — o viceversa. Tenerlo mescolato alla formula è la ragione
 * per cui, prima di questa sessione, Intimidate esisteva in una direzione e
 * mezza: leggevamo `defAbilityFlags.intimidateActive` e ignoravamo
 * l'omonimo dell'attaccante.
 *
 * E una funzione pura si prova da sola: si può asserire QUALI STADI escono,
 * non soltanto quanto danno esce. La differenza è fra un test che dice dov'è
 * il bug e uno che dice solo che c'è.
 *
 * ─── L'ORDINE, TRASCRITTO ──────────────────────────────────────────────────
 * Da `CALCULATE_ALL_MOVES_SV` (damage_SV.js:6), tolte le righe che riguardano
 * meccaniche che non modelliamo (Trace, Neutralizing Gas, Air Lock, Forecast,
 * Mimicry, Terastal, Klutz, i semi del terreno, Wind Rider, Supersweet Syrup,
 * Embody Aspect, Battle Bond):
 *
 *   1. checkParadoxAbilities  su entrambi
 *   2. checkSwordShield       su entrambi
 *   3. checkIntimidate        in tutte e due le direzioni
 *   4. checkDownload          in tutte e due le direzioni
 *   5. le statistiche modificate, e solo allora la statistica più alta
 *
 * L'ordine non è decorativo. Il punto 5 sta in fondo perché il riferimento ha
 * un commento apposta: «new order is important for the proper
 * Protosynthesis/Quark Drive boost». La statistica più alta va decisa sulle
 * statistiche GIÀ potenziate dagli stadi, quindi dopo Intimidate e dopo
 * Intrepid Sword. E Download sta dopo Dauntless Shield perché legge la Difesa
 * avversaria comprensiva del +1 che Dauntless Shield ha appena messo.
 *
 * ─── CHI È «p1» ────────────────────────────────────────────────────────────
 * Nel riferimento p1 e p2 sono il Pokémon di sinistra e quello di destra:
 * un'etichetta d'interfaccia, non un ruolo. L'harness dei test mette il
 * DIFENSORE come p1, e qui facciamo lo stesso, perché la fixture con cui ci
 * confrontiamo è stata generata così.
 *
 * L'ordine si vede in un caso solo: quando ENTRAMBI hanno Intimidate acceso e
 * uno dei due ha Mirror Armor. È un dettaglio arbitrario del riferimento, non
 * una regola del gioco, ed è scritto qui perché qualcuno che un giorno
 * troverà una discordanza sappia dove guardare.
 */

import pokemonData from '../data/pokemon.json'
import { ABILITY_EFFECTS, normalizeAbilityKey } from '../data/abilityEffects.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import { calcStat } from './stats.js'
import {
  LEVEL,
  applyBoost,
  normalizzaMeteo,
  STAT_ATT, STAT_DEF, STAT_SPA, STAT_SPD, STAT_SPE,
  ABILITA_NON_COPIABILI,
  ABILITA_NON_SPEGNIBILI,
} from './rules.js'

/**
 * Le cinque statistiche che hanno uno stadio di boost, nell'ordine del
 * riferimento. L'ordine conta: `statPiuAlta` prende la PRIMA fra quelle a pari
 * merito, quindi un Pokémon con Attacco e Att. Speciale identici sceglie
 * l'Attacco. Non è una scelta nostra, è `indexOf(Math.max(...))`.
 */
export const CHIAVI_BOOST = Object.freeze(['at', 'df', 'sa', 'sd', 'sp'])

/** Da chiave di boost a indice di statistica, per parlare con `lib/stats.js`. */
const INDICE_STAT = Object.freeze({
  at: STAT_ATT,
  df: STAT_DEF,
  sa: STAT_SPA,
  sd: STAT_SPD,
  sp: STAT_SPE,
})

/** Boost tutti a zero. Nuovo oggetto ogni volta: qui dentro si scrive. */
function boostVuoti() {
  return { at: 0, df: 0, sa: 0, sd: 0, sp: 0 }
}

/** `Math.min(6, …)` e `Math.max(-6, …)` del riferimento, in una riga sola. */
function limita(stadio) {
  return Math.min(6, Math.max(-6, stadio))
}

/**
 * Un lato pronto da manipolare: quello che il riferimento chiama `pokemon`.
 * Gli oggetti di questo modulo sono usa e getta — si scrive dentro come fa il
 * vendore, e si buttano via alla fine restituendo solo il risultato.
 */
function costruisciLato(entrata) {
  const chiaveAbilita = normalizeAbilityKey(entrata.abilita)
  return {
    pokemon: entrata.pokemon ?? null,
    sps: entrata.sps || [0, 0, 0, 0, 0, 0],
    natura: entrata.natura ?? null,
    livello: entrata.livello ?? LEVEL,
    chiaveAbilita,
    effettoAbilita: ABILITY_EFFECTS[chiaveAbilita] || null,
    // L'abilità è accesa: nel riferimento è `abilityOn`, da noi
    // `abilityFlags.intimidateActive`. Serve solo a Intimidate: Intrepid
    // Sword e le abilità paradosso non lo guardano (vedi sotto).
    abilitaAccesa: entrata.abilitaAccesa === true,
    // Rapidascesa: «ha messo KO un avversario». Un interruttore a parte da
    // `abilitaAccesa`, che significa già un'altra cosa (Intimidate).
    koFatto: entrata.koFatto === true,
    // «Ha gia' assorbito una mossa del suo tipo»: Parafulmine e le altre
    // quattro. Un interruttore a parte dagli altri due, perche' e' un fatto
    // diverso — e perche' un Pokemon ha un'abilita' sola, quindi non possono
    // mai accendersi insieme.
    assorbimentoFatto: entrata.assorbimentoFatto === true,
    // Lo strumento può SPARIRE durante la preparazione. È l'unico campo che
    // esce da qui modificato oltre ai boost, ed è quello che rende visibile
    // nel danno la Booster Energy: Knock Off non trova più niente.
    strumento: entrata.strumento || null,
    boosts: { ...boostVuoti(), ...(entrata.boosts || {}) },
    paradosso: false,
    statPiuAlta: null,
  }
}

/** La chiave minuscola dello strumento, o stringa vuota se non ce n'è. */
function chiaveStrumento(lato) {
  return (lato.strumento || '').toLowerCase()
}

// ───────────────────────────────────────────────────────────────────────────
// 1 · checkParadoxAbilities            damage_MASTER.js:488
// ───────────────────────────────────────────────────────────────────────────
//
// ```
// if (['Protosynthesis','Quark Drive'].indexOf(pokemon.ability) !== -1) {
//     if ((ability === 'Protosynthesis' && weather === 'Sun')
//         || (ability === 'Quark Drive' && terrain === 'Electric')
//         || (manualProtoQuark && item !== 'Booster Energy'))
//         pokemon.paradoxAbilityBoost = true;
//     else if (item === 'Booster Energy') {
//         pokemon.paradoxAbilityBoost = true;
//         pokemon.item = '';
//     }
// }
// ```
//
// Tre cose da non perdere nella traduzione.
//
// `manualProtoQuark` è un interruttore dell'interfaccia del riferimento che
// significa «la statistica potenziata te la dico io». A `false` — come nel
// nostro harness e come qui — quel ramo non si accende mai. Non lo
// riproduciamo: sarebbe una condizione che nessuno può rendere vera.
//
// Il confronto sul meteo è `=== 'Sun'`, esatto. Altrove il riferimento usa
// `indexOf("Sun") > -1`, che fa passare anche il Sole Estremo: qui no. Copiato
// com'è, non «aggiustato» — se un giorno si scoprirà che il gioco fa
// diversamente, il posto dove cambiarlo è questo e uno solo.
//
// E la Booster Energy si consuma SOLO nel ramo `else`: con il sole già alto
// l'abilità è accesa dal meteo e lo strumento resta in mano. Sembra un
// cavillo, e invece è la differenza fra un Knock Off da 65 e uno da 97.

function checkParadoxAbilities(lato, terreno, meteo) {
  const acceso = lato.effettoAbilita?.paradosso
  if (!acceso) return

  const daCampo = (acceso === 'sun' && meteo === 'sun')
    || (acceso === 'electric' && terreno === 'electric')

  if (daCampo) {
    lato.paradosso = true
  } else if (ITEM_EFFECTS[chiaveStrumento(lato)]?.accendeParadosso) {
    lato.paradosso = true
    lato.strumento = null
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 2 · checkSwordShield                 damage_MASTER.js:593
// ───────────────────────────────────────────────────────────────────────────
//
// ```
// if (ability === "Intrepid Sword"   && (gen !== 9 || abilityOn)) boosts[AT] += 1
// else if (ability === "Dauntless Shield" && (gen !== 9 || abilityOn)) boosts[DF] += 1
// ```
//
// In Champions `gen` vale 10, quindi `gen !== 9` è già vero e la seconda metà
// non viene nemmeno valutata: il boost si applica SEMPRE, acceso o spento che
// sia l'interruttore dell'interfaccia.
//
// È scritto qui perché è la trappola in cui è caduta la prima costruzione dei
// casi in F-2: un controllo negativo fatto sullo stesso Pokémon con il flag
// abbassato confronta due cose identiche per definizione, e passa sempre.

function checkSwordShield(lato) {
  const stat = lato.effettoAbilita?.boostIngresso
  if (!stat) return
  lato.boosts[stat] = limita(lato.boosts[stat] + 1)
}

// ───────────────────────────────────────────────────────────────────────────
// 3 · checkIntimidate                  damage_MASTER.js:559
// ───────────────────────────────────────────────────────────────────────────
//
// Trenta righe trascritte, non dedotte. La struttura è una catena di quattro
// rami che si escludono, più due code che girano comunque.
//
// ─── L'ORDINE DEI QUATTRO RAMI ─────────────────────────────────────────────
//   1. inverte     Contrary, Guard Dog       → +1
//   2. annulla     Clear Body, White Smoke, Hyper Cutter, Full Metal Body,
//                  Inner Focus, Oblivious, Own Tempo, Scrappy, Clear Amulet
//   3. rimbalza    Mirror Armor              → il calo va al MITTENTE
//   4. tutto il resto                        → −1, raddoppiato da Simple,
//                                              poi Defiant +2 Att. oppure
//                                              Competitive +2 Att. Speciale
//
// Il riferimento commenta il primo ramo così: «Contrary & Guard Dog need to be
// first; these abilities supersede Clear Amulet but not Mirror Armor for some
// reason». Cioè: con Contrary il Clear Amulet non serve a niente (l'aumento
// arriva lo stesso), ma Mirror Armor batte tutto perché sarebbe stato valutato
// prima — solo che non lo è. È una stranezza del gioco. Riprodotta com'è.
//
// ─── LE DUE CODE ───────────────────────────────────────────────────────────
// Adrenaline Orb e Rattled girano DOPO la catena, e qualunque ramo abbia
// vinto. L'orbo si consuma anche quando il calo è stato annullato — quindi un
// Clear Body con l'orbo in mano se lo brucia comunque — e non si consuma solo
// contro Mirror Armor, perché lì il calo non è mai arrivato.
//
// Rattled controlla `item !== "Clear Amulet"` DOPO che l'orbo si è già
// consumato: se il Pokémon aveva l'orbo, adesso ha le mani vuote e Rattled
// passa. L'ordine delle due code non è indifferente.
//
// ─── COSA DI QUESTO SI VEDE NEL DANNO ──────────────────────────────────────
// Di Adrenaline Orb e Rattled, il danno vede solo il consumo dell'orbo (via
// Knock Off). I +1 Velocità non passano da qui. Sono trascritti lo stesso
// perché sono parte delle trenta righe, e perché `statPiuAlta` confronta anche
// la Velocità: escluderli sarebbe stato dedurre che non contano.

function checkIntimidate(sorgente, bersaglio) {
  if (!sorgente.effettoAbilita?.intimidate || !sorgente.abilitaAccesa) return

  const eff = bersaglio.effettoAbilita
  const raddoppia = eff?.simple ? 1 : 0
  const amuleto = ITEM_EFFECTS[chiaveStrumento(bersaglio)]?.bloccaCaliAvversari === true

  if (eff?.intimidateInverte) {
    bersaglio.boosts.at = limita(bersaglio.boosts.at + 1)
  } else if (eff?.intimidateAnnulla || amuleto) {
    // nessun effetto
  } else if (eff?.intimidateRimbalza) {
    sorgente.boosts.at = limita(sorgente.boosts.at - 1)
  } else {
    bersaglio.boosts.at = limita(bersaglio.boosts.at - 1 * (1 + raddoppia))
    if (eff?.defiant) {
      bersaglio.boosts.at = limita(bersaglio.boosts.at + 2)
    } else if (eff?.competitive) {
      bersaglio.boosts.sa = limita(bersaglio.boosts.sa + 2)
    }
  }

  if (ITEM_EFFECTS[chiaveStrumento(bersaglio)]?.orboAdrenalina && !eff?.intimidateRimbalza) {
    bersaglio.boosts.sp = limita(bersaglio.boosts.sp + 1 * (1 + raddoppia))
    bersaglio.strumento = null
  }
  if (bersaglio.chiaveAbilita === 'rattled'
      && ITEM_EFFECTS[chiaveStrumento(bersaglio)]?.bloccaCaliAvversari !== true) {
    bersaglio.boosts.sp = limita(bersaglio.boosts.sp + 1)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 4 · checkDownload                    damage_MASTER.js:646
// ───────────────────────────────────────────────────────────────────────────
//
// Il riferimento ha due rami: se le statistiche del bersaglio sono già state
// calcolate usa quelle, altrimenti le ricava da `rawStats` e dai boost. Nel
// nostro percorso — e in quello dell'harness — non sono ancora calcolate,
// perché il punto 5 viene dopo. Quindi vale sempre il secondo ramo, ed è
// quello scritto qui: nessun `if` che non può essere falso.
//
// La condizione è `Dif. Speciale <= Difesa`, con l'uguale dalla parte della
// Difesa Speciale: a parità il boost va all'Attacco Speciale.

function checkDownload(sorgente, bersaglio) {
  if (!sorgente.effettoAbilita?.download) return

  const dif  = statModificata(bersaglio, 'df')
  const difS = statModificata(bersaglio, 'sd')

  if (difS <= dif) {
    sorgente.boosts.sa = limita(sorgente.boosts.sa + 1)
  } else {
    sorgente.boosts.at = limita(sorgente.boosts.at + 1)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 5 · setHighestStat                   damage_MASTER.js:364
// ───────────────────────────────────────────────────────────────────────────
//
// La statistica più alta fra le cinque potenziate dagli stadi. Serve alle
// abilità paradosso, che moltiplicano quella e non un'altra.
//
// Due dettagli che sembrano niente:
//
//   - le statistiche NON portano i bonus meteo (la Dif. Speciale della sabbia
//     su un tipo Roccia, la Difesa della neve su un tipo Ghiaccio). Nel
//     riferimento quei bonus vivono dentro `calcDefense`, applicati «direttamente»
//     e non come modificatore, quindi non entrano in `rawStats` e non entrano
//     in questo confronto. Per questo `calcStat` è chiamata senza meteo.
//
//   - a pari merito vince la prima nell'ordine Att · Dif · Att.Sp · Dif.Sp ·
//     Vel., perché il riferimento usa `indexOf(Math.max(...))`. Un Genesect,
//     che ha Attacco e Att. Speciale identici, sceglierebbe l'Attacco.

/** Una statistica del lato, potenziata dal suo stadio. */
function statModificata(lato, chiave) {
  const indice = INDICE_STAT[chiave]
  const base = pokemonData[lato.pokemon]?.stats?.[indice] ?? 0
  const grezza = calcStat(base, lato.sps[indice], lato.livello, lato.natura, indice)
  return applyBoost(grezza, lato.boosts[chiave])
}

function setHighestStat(lato) {
  const valori = CHIAVI_BOOST.map(c => statModificata(lato, c))
  const massimo = Math.max(...valori)
  lato.statPiuAlta = CHIAVI_BOOST[valori.indexOf(massimo)]
}

// ───────────────────────────────────────────────────────────────────────────
// 6 · La seconda metà di Rapidascesa               nessuna riga del riferimento
// ───────────────────────────────────────────────────────────────────────────
//
// «Aumenta la statistica più alta di 1 grado quando mette KO un avversario.»
//
// ─── QUESTA NON VIENE DA NCP, E VA DETTO ───────────────────────────────────
//
// Tutte le altre cinque funzioni di questo file portano il numero di riga del
// riferimento perché sono trascritte. Questa no: NCP conosce Rapidascesa e ne
// implementa l'immunità alle mosse Terra (`damage_MASTER.js:1112` e `:1298`),
// ma di questa metà non c'è traccia — e non è una svista sua. È la stessa metà
// di Beast Boost, che il registro del divario ha già misurato come NON
// calcolata dal riferimento: `beast boost` è selezionabile, senza effetto da
// noi, e non compare fra le abilità del divario.
//
// Quindi l'unica fonte è la descrizione nel gioco, e la verifica è per
// conseguenza: lo stadio sale di uno, sulla statistica giusta, e il danno si
// muove di conseguenza. Non c'è un oracolo da interrogare e non si finge che
// ci sia.
//
// ─── PERCHÉ DOPO `setHighestStat`, E NON DENTRO ────────────────────────────
//
// Perché la statistica da potenziare è quella più alta PRIMA del +1. Metterlo
// dentro vorrebbe dire scegliere in base a un potenziamento che si sta ancora
// applicando. È anche il motivo per cui `statPiuAlta` resta quella di prima
// nel risultato: le abilità paradosso la leggono, e per loro il +1 di
// Rapidascesa non è mai esistito (nessun Pokémon ha tutt'e due le abilità).
//
// ─── PERCHÉ UN INTERRUTTORE E NON UN CALCOLO ───────────────────────────────
//
// Perché «ha messo KO un avversario» è un fatto del turno precedente, e l'app
// calcola un colpo solo. Stessa forma di `supremeOverlordKOs`, che conta gli
// alleati caduti: lo stato lo dichiara chi usa l'app, non lo deduce il motore.

function checkBoostSuKO(lato) {
  if (!lato.effettoAbilita?.boostStatPiuAltaSuKO) return
  if (!lato.koFatto) return
  lato.boosts[lato.statPiuAlta] = limita(lato.boosts[lato.statPiuAlta] + 1)
}

// ───────────────────────────────────────────────────────────────────────────
// 7 · Il boost delle cinque che assorbono        nessuna riga del riferimento
// ───────────────────────────────────────────────────────────────────────────
//
//   Sap Sipper        +1 Attacco          assorbendo una mossa Erba
//   Lightning Rod     +1 Att. Speciale    assorbendo una mossa Elettro
//   Storm Drain       +1 Att. Speciale    assorbendo una mossa Acqua
//   Motor Drive       +1 Velocita'        assorbendo una mossa Elettro
//   Well-Baked Body   +2 Difesa           assorbendo una mossa Fuoco
//
// ─── COME LA SESTA, QUESTA NON VIENE DA NCP ────────────────────────────────
//
// Il riferimento implementa l'immunita' di queste abilita' e nient'altro:
// «Lightning Rod» compare in una riga sola di tutto il vendor,
// `damage_MASTER.js:1112`. Non e' una svista — e' lo stesso confine di Beast
// Boost e della seconda meta' di Rapidascesa.
//
// La fonte e' Simone, che ha confermato valori e condizioni su richiesta. Come
// per Parental Bond e Skill Link resta scritto che la fonte e' una persona e
// non un programma da eseguire: qui sotto non c'e' niente da confrontare roll
// per roll, e la verifica e' per conseguenza — lo stadio sale di quanto deve,
// sulla statistica giusta, e il danno si muove con lui.
//
// ─── PERCHE' DOPO `setHighestStat` ─────────────────────────────────────────
//
// Perche' alzando una statistica potrebbe cambiare quale sia la piu' alta, e
// le abilita' paradosso leggono quel campo. Nessun Pokemon ha tutt'e due le
// abilita', quindi oggi non e' osservabile — ma l'ordine e' quello giusto, e
// non per caso.

// ───────────────────────────────────────────────────────────────────────────
// checkSupersweetSyrup                 damage_MASTER.js:549
// ───────────────────────────────────────────────────────────────────────────
//
// Fa a chi subisce quello che fa Intimidate, ma sulla DIFESA: -1, e le stesse
// due abilita' che si ribellano — Defiant e Competitive — reagiscono col +2.
// Vuole `abilityOn`, cioe' la levetta.
//
// Il riferimento NON ripete qui le dodici abilita' che bloccano Intimidate:
// guarda solo il Clear Amulet. Trascritto com'e': un Clear Body davanti a
// Supersweet Syrup, nel riferimento, non protegge.
//
// ─── LA DIVERGENZA AGGIUDICATA ─────────────────────────────────────────────
//
// Sul ramo Competitive il riferimento scrive
//
//     target.boosts[AT] = Math.min(6, target.boosts[SA] + 2);
//
// cioe' scrive sull'ATTACCO leggendo l'ATTACCO SPECIALE. Due funzioni sopra,
// in `checkIntimidate` (`:580`), la stessa clausola e' scritta giusta:
// `target.boosts[SA] = ... target.boosts[SA] + 2`. E' uno scivolone loro, non
// una regola.
//
// Simone ha aggiudicato: seguiamo quella giusta. Il caso oracolo per
// Competitive quindi non esiste — divergeremmo di proposito — ed e' registrato
// in `divergenzeAggiudicate.test.js`.
function checkSupersweetSyrup(sorgente, bersaglio) {
  if (!sorgente.effettoAbilita?.supersweetSyrup || !sorgente.abilitaAccesa) return
  if (ITEM_EFFECTS[chiaveStrumento(bersaglio)]?.bloccaCaliAvversari === true) return

  const eff = bersaglio.effettoAbilita
  bersaglio.boosts.df = limita(bersaglio.boosts.df - 1)
  if (eff?.defiant) {
    bersaglio.boosts.at = limita(bersaglio.boosts.at + 2)
  } else if (eff?.competitive) {
    bersaglio.boosts.sa = limita(bersaglio.boosts.sa + 2)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// checkEmbodyAspect                    damage_MASTER.js:666
// ───────────────────────────────────────────────────────────────────────────
//
// Ogerpon alza di uno una statistica diversa per ogni forma, e le tre forme
// mascherate lo fanno solo se portano la propria maschera.
//
// ─── NON E' RAGGIUNGIBILE OGGI, E VA DETTO ─────────────────────────────────
//
// In Champions nessuna specie ha Embody Aspect: le quattro Ogerpon portano
// Defiant, Sturdy, Mold Breaker e Water Absorb. E le tre maschere non sono
// fra i nostri strumenti. Quindi nessuno dei quattro rami puo' essere vero.
//
// E' la situazione gia' accettata per Darmanitan-Galar: si scrive adesso, e il
// giorno che la specie arriva funziona.
const STAT_EMBODY_ASPECT = {
  'ogerpon':             { stat: 'sp', maschera: null },
  'ogerpon-wellspring':  { stat: 'sd', maschera: 'wellspring mask' },
  'ogerpon-hearthflame': { stat: 'at', maschera: 'hearthflame mask' },
  'ogerpon-cornerstone': { stat: 'df', maschera: 'cornerstone mask' },
}

function checkEmbodyAspect(lato) {
  if (!lato.effettoAbilita?.embodyAspect) return
  const voce = STAT_EMBODY_ASPECT[lato.pokemon]
  if (!voce) return
  if (voce.maschera && chiaveStrumento(lato) !== voce.maschera) return
  lato.boosts[voce.stat] = limita(lato.boosts[voce.stat] + 1)
}

// ───────────────────────────────────────────────────────────────────────────
// checkBattleBond                      damage_MASTER.js:683
// ───────────────────────────────────────────────────────────────────────────
//
// +1 ad Attacco, Attacco Speciale e Velocita', con la levetta.
//
// ─── L'ALTRA DIVERGENZA AGGIUDICATA ────────────────────────────────────────
//
// Il riferimento la chiude dietro `gen == 9`, e noi giriamo a `gen = 10`
// (Champions): da loro non si applica MAI. Il nome compare nel sorgente, ed e'
// per questo che il registro la contava fra le mancanti.
//
// Simone ha aggiudicato di implementarla lo stesso. Nessun caso oracolo puo'
// verificarla — divergeremmo di proposito — ed e' registrata in
// `divergenzeAggiudicate.test.js`. Anche qui, in Champions nessuna specie ce
// l'ha ancora.
function checkBattleBond(lato) {
  if (!lato.effettoAbilita?.battleBond || !lato.abilitaAccesa) return
  for (const stat of ['at', 'sa', 'sp']) {
    lato.boosts[stat] = limita(lato.boosts[stat] + 1)
  }
}

function checkBoostAssorbimento(lato) {
  const boost = lato.effettoAbilita?.boostAssorbimento
  if (!boost) return
  if (!lato.assorbimentoFatto) return
  lato.boosts[boost.stat] = limita(lato.boosts[boost.stat] + boost.gradi)
}

// ───────────────────────────────────────────────────────────────────────────
// L'ingresso pubblico
// ───────────────────────────────────────────────────────────────────────────

/**
 * Prepara i due Pokémon prima del calcolo del danno.
 *
 * Non muta gli argomenti: copia tutto all'inizio e restituisce oggetti nuovi.
 *
 * @param {object} p
 * @param {object} p.attaccante — { pokemon, sps, natura, livello, abilita,
 *                                  abilitaAccesa, strumento, boosts }
 * @param {object} p.difensore  — stessa forma
 * @param {string|null} [p.meteo]   — nome di meteo canonico o grezzo
 * @param {string|null} [p.terreno]
 * @returns {{attaccante: object, difensore: object}} per ciascun lato:
 *          `boosts` (i cinque stadi finali), `strumento` (eventualmente
 *          consumato), `paradosso` (booleano), `statPiuAlta` (chiave).
 */
/**
 * ─── I DUE CHE RISCRIVONO L'ABILITA' PRIMA DI TUTTO ─────────────────────────
 *
 * Trace e Neutralizing Gas non moltiplicano niente: cambiano QUALE abilita'
 * ciascuno dei due ha, e tutto il resto — Intimidate, Download, le abilita'
 * paradosso, le catene — gira poi sull'abilita' nuova.
 *
 * Nel riferimento sono le prime tre righe di `CALCULATE_ALL_MOVES_SV`
 * (`damage_SV.js:7-9`), prima di ogni altro controllo:
 *
 *     checkTrace(p1, p2);
 *     checkTrace(p2, p1);
 *     checkNeutralGas(p1, p2, field.getNeutralGas());
 *
 * ─── L'ORDINE DELLE DUE CHIAMATE A TRACE E' OSSERVABILE ────────────────────
 *
 * `checkTrace(p1, p2)` scrive dentro `p1.ability`. La chiamata dopo,
 * `checkTrace(p2, p1)`, LEGGE `p1.ability` — cioe' quella appena scritta. Con
 * due Trace uno di fronte all'altro la seconda copierebbe la copia. Non
 * succede, perche' `Trace` sta nella lista delle non copiabili e la prima
 * chiamata quindi non scrive niente; ma la sequenza e' quella, ed e'
 * trascritta cosi'.
 *
 * ─── NEUTRALIZING GAS: DA NOI E' NEI DUE SLOT, NEL RIFERIMENTO E' UNA CASELLA
 *
 * Il riferimento legge `field.getNeutralGas()`, una casella dell'interfaccia:
 * la presenza dell'abilita' addosso a qualcuno, da sola, non spegne niente.
 * Da noi vale la regola gia' scelta per le aure e per le quattro Rovina — si
 * guarda l'abilita' dei due Pokemon dello scontro.
 *
 * Si decide sugli slot ORIGINALI, prima di Trace. Non e' una scorciatoia: se
 * Trace copiasse un Neutralizing Gas, vorrebbe dire che il copiato ce l'ha
 * gia', e il gas sarebbe in campo comunque.
 *
 * E il gas spegne ANCHE l'abilita' di chi lo porta: `cannotSupress` non
 * contiene Neutralizing Gas, e il riferimento azzera tutt'e due i Pokemon.
 * Il segnale di campo resta pero' acceso — serve alle aure e alle Rovina, che
 * lo leggono come `field.isNeutralizingGas` — ed e' per questo che qui torna
 * separato dalle due abilita'.
 *
 * @returns {{attaccante: string|null, difensore: string|null, gasNeutro: boolean}}
 */
export function abilitaEffettive({
  atkAbility, defAbility, atkInterruttore = false, defInterruttore = false,
}) {
  // p1 = difensore, p2 = attaccante: la convenzione di tutto questo file.
  let p1 = normalizeAbilityKey(defAbility) || null
  let p2 = normalizeAbilityKey(atkAbility) || null

  const gas = k => ABILITY_EFFECTS[k]?.gasNeutro === true
  const gasNeutro = gas(p1) || gas(p2)

  // checkTrace(p1, p2) — il difensore copia l'attaccante.
  if (ABILITY_EFFECTS[p1]?.trace && defInterruttore && p2 && !ABILITA_NON_COPIABILI.has(p2)) {
    p1 = p2
  }
  // checkTrace(p2, p1) — l'attaccante copia il difensore, gia' aggiornato.
  if (ABILITY_EFFECTS[p2]?.trace && atkInterruttore && p1 && !ABILITA_NON_COPIABILI.has(p1)) {
    p2 = p1
  }

  if (gasNeutro) {
    if (p1 && !ABILITA_NON_SPEGNIBILI.has(p1)) p1 = null
    if (p2 && !ABILITA_NON_SPEGNIBILI.has(p2)) p2 = null
  }

  return { attaccante: p2, difensore: p1, gasNeutro }
}

export function preparaCoppia({ attaccante, difensore, meteo = null, terreno = null }) {
  // p1 = difensore, p2 = attaccante. Vedi la nota in cima al file.
  const p1 = costruisciLato(difensore)
  const p2 = costruisciLato(attaccante)

  const meteoCanonico = normalizzaMeteo(meteo)
  const terrenoNorm = terreno ? String(terreno).toLowerCase() : null

  checkParadoxAbilities(p1, terrenoNorm, meteoCanonico)
  checkParadoxAbilities(p2, terrenoNorm, meteoCanonico)

  checkSwordShield(p1)
  checkSwordShield(p2)

  checkIntimidate(p1, p2)
  checkIntimidate(p2, p1)

  // Dopo Intimidate, come nel riferimento (`damage_SV.js:29-32`). L'ordine
  // conta: Defiant reagisce a tutt'e due, e chi arriva prima decide da quale
  // valore parte il secondo +2.
  checkSupersweetSyrup(p1, p2)
  checkSupersweetSyrup(p2, p1)

  checkEmbodyAspect(p1)
  checkEmbodyAspect(p2)

  checkBattleBond(p1)
  checkBattleBond(p2)

  checkDownload(p1, p2)
  checkDownload(p2, p1)

  setHighestStat(p1)
  setHighestStat(p2)

  checkBoostSuKO(p1)
  checkBoostSuKO(p2)

  checkBoostAssorbimento(p1)
  checkBoostAssorbimento(p2)

  return {
    attaccante: risultato(p2),
    difensore: risultato(p1),
  }
}

function risultato(lato) {
  return {
    boosts: { ...lato.boosts },
    strumento: lato.strumento,
    paradosso: lato.paradosso,
    statPiuAlta: lato.statPiuAlta,
  }
}

/**
 * La sola parte della preparazione che riguarda un Pokémon da solo, senza
 * avversario: le abilità paradosso.
 *
 * Serve a `utils/speedOrder.js`, che calcola la Velocità di uno slot alla
 * volta e non ha modo di sapere chi ha davanti.
 *
 * ─── IL CONFINE, DICHIARATO ────────────────────────────────────────────────
 * Qui la statistica più alta è calcolata sui boost dello slot e basta: senza
 * Intimidate, senza Intrepid Sword, senza Download. Nel gioco quegli stadi
 * possono cambiare quale statistica è la più alta, e quindi su quale cade il
 * potenziamento. È un caso di confine — servirebbe un Pokémon paradosso con
 * due statistiche a un soffio l'una dall'altra — ma è un confine, non
 * un'assenza, e va scritto invece che scoperto.
 *
 * @param {object} slot — lo slot dello store
 * @returns {{paradosso: boolean, statPiuAlta: string|null}}
 */
export function preparaSingolo(slot, meteo = null, terreno = null) {
  const lato = costruisciLato({
    pokemon: slot?.key ?? null,
    sps: slot?.sps,
    natura: slot?.nature ?? null,
    abilita: slot?.ability ?? null,
    strumento: slot?.item ?? null,
    boosts: {
      at: slot?.atkBoost || 0,
      df: slot?.defBoost || 0,
      sa: slot?.spAtkBoost || 0,
      sd: slot?.spDefBoost || 0,
      sp: slot?.speBoost || 0,
    },
  })

  checkParadoxAbilities(lato, terreno ? String(terreno).toLowerCase() : null, normalizzaMeteo(meteo))
  setHighestStat(lato)
  // `checkBoostSuKO` NON viene chiamata qui, ed è una scelta.
  //
  // Se la statistica più alta fosse la Velocità, il +1 di Rapidascesa la
  // alzerebbe e l'ordine di velocità dovrebbe cambiare. Ma `calcEffectiveSpe`
  // legge `pokemon.speBoost` — lo stadio messo a mano nell'editor — e non i
  // boost che escono da qui: applicarlo produrrebbe un numero che nessuno
  // legge. È esattamente il caso di `rattled`, che `classificazione-badge.mjs`
  // marca `effetto-non-osservabile` per la stessa ragione.
  //
  // Il giorno in cui `calcEffectiveSpe` leggerà i boost preparati, questa
  // riga va aggiunta e diventa verificabile. Oggi sarebbe codice che nessun
  // test può dimostrare.

  return { paradosso: lato.paradosso, statPiuAlta: lato.statPiuAlta }
}
