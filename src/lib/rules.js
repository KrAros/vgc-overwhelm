// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { TYPES } from '../data/typeChart.js'

/**
 * src/lib/rules.js
 *
 * Le regole del gioco, in un posto solo.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 * Prima della sessione C questi numeri erano sparsi in almeno cinque file, a
 * volte come costante con un nome, più spesso come numero magico dentro
 * un'espressione. Alcuni esempi reali:
 *
 *   calcEngine.js       MAX_SP_PER_STAT = 32, MAX_SP_TOTAL = 66, IV = 31
 *   utils/statCalc.js   Math.min(sp ?? 0, 32) * 8   ← gli stessi numeri, muti
 *   calcEngine.js       BOOST_NUM / BOOST_DEN
 *   utils/speedOrder.js BOOST_NUM / BOOST_DEN       ← seconda copia
 *   editor/StatRow.jsx  BOOST_NUM / BOOST_DEN       ← terza copia
 *   lib/damage.js       MAX_HITS = 9
 *
 * Pokémon Champions è un gioco vivo: prima o poi cambierà uno di questi
 * valori. Con le copie sparse lo cambieresti in un posto e ne dimenticheresti
 * altri due, e il bug che ne esce è di quelli silenziosi — numeri leggermente
 * sbagliati, nessun errore in console.
 *
 * ─── COSA NON VA QUI ───────────────────────────────────────────────────────
 * Solo costanti e funzioni pure che dipendono unicamente da esse. Niente
 * import da `data/`, niente stato, niente React. Se una cosa ha bisogno del
 * Pokédex, sta in `lib/stats.js`; se ha bisogno del campo di battaglia, sta
 * in `lib/battleState.js`.
 */

// ─── Livello e IV ────────────────────────────────────────────────────────────

/** Champions gioca a livello fisso. Non è un default modificabile: è la regola. */
// ─── Abilità «-ate» ───────────────────────────────────────────────────────────

/**
 * Le abilità che trasformano le mosse di tipo Normale in un altro tipo e ne
 * aumentano la potenza del 20%.
 *
 * ─── PERCHÉ ERA IN DUE COPIE, E PERCHÉ STA QUI ────────────────────────────
 *
 * Fino alla sessione Q la corrispondenza esisteva due volte, in due
 * rappresentazioni diverse:
 *
 *   calcEngine.js       quattro `if` con le costanti TYPES.*
 *   SearchSelects.jsx   un ATE_MAP con gli indici numerici, per il badge del
 *                       tipo mossa nell'editor
 *
 * Le due concordavano — verificato prima di unificarle: 17 Fairy, 9 Flying,
 * 5 Ice, 14 Dragon — quindi non c'era un difetto vivo. Ma niente lo
 * garantiva, e la sessione Q stava per aggiungerne una terza per decidere il
 * colore del riquadro dell'abilità.
 *
 * ─── E PERCHÉ QUI E NON IN `data/typeChart.js` ────────────────────────────
 *
 * Prima l'avevo messa lì, dove vive `TYPES`: entrambi i consumatori già
 * importavano da quel file, quindi non nasceva nessuna dipendenza nuova.
 *
 * Sbagliato, e l'ha detto un test rosso. `gen-inventario-motore.mjs` — la
 * seconda fonte nata in F-3, quella che impedisce al badge «non calcolata» di
 * mentire — scandaglia `['src/calcEngine.js', 'src/lib', 'src/utils']`.
 * `src/data/` NON è nella superficie. Spostando la tabella lì avevo portato
 * quattro abilità fuori dal raggio della rete: l'inventario avrebbe smesso di
 * vedere che il motore ci ramifica sopra, ed è esattamente il difetto di F-3
 * che tornava.
 *
 * Avevo barattato la visibilità di una rete di sicurezza per un'estetica del
 * grafo dei moduli. Il costo vero — un import in più — è onesto: la regola
 * dipende davvero dagli id dei tipi.
 *
 * Le chiavi sono normalizzate col trattino, come `normalizeAbilityKey`.
 */
/**
 * Il tipo che Palla Clima assume sotto ogni meteo.
 *
 * ─── ANCHE QUESTA ERA IN DUE COPIE, E NON COINCIDEVANO ────────────────────
 *
 * `calcEngine.js` la scriveva con le costanti TYPES.* e sei chiavi;
 * `SearchSelects.jsx`, per il badge del tipo mossa, con gli indici numerici e
 * OTTO — le stesse sei più `sandstorm` e `hail`.
 *
 * Le due chiavi in più non erano un difetto vivo: `normalizzaMeteo` traduce
 * `sandstorm → sand` e `hail → snow` in ingresso, e il motore normalizza prima
 * di leggere la tabella (`calcEngine.js:141`). Erano una terza espressione
 * della stessa normalizzazione, scritta a mano dentro un componente.
 *
 * Non un bug, ma il modo in cui i bug nascono: due tabelle che oggi dicono la
 * stessa cosa con chiavi diverse, e nessuno che garantisca che continuino.
 *
 * Le chiavi sono i meteo CANONICI. Chi legge da uno stato non normalizzato
 * deve passare da `normalizzaMeteo` prima, come fa il motore.
 */
export const TIPO_PALLA_CLIMA = Object.freeze({
  rain:             TYPES.WATER,
  'heavy rain':     TYPES.WATER,
  sun:              TYPES.FIRE,
  'harsh sunshine': TYPES.FIRE,
  sand:             TYPES.ROCK,
  snow:             TYPES.ICE,
})

/**
 * Il tipo che Palla Clima assume col meteo dato, oppure `null` se la mossa non
 * è Palla Clima o se non c'è meteo.
 *
 * Esiste perché la stessa domanda serviva in tre posti — il motore, il badge
 * del tipo mossa nell'editor, e da Q/3b il riquadro delle abilità «-ate», che
 * deve sapere se il moveset contiene ancora una mossa Normale. Scriverla tre
 * volte era il modo garantito di farle divergere.
 *
 * Restituisce `null` invece del tipo base di proposito: il motore distingue
 * «Palla Clima senza meteo» da «Palla Clima con meteo» anche per la potenza
 * (50 contro 100), e quel `null` è parte del risultato che espone.
 */
export function tipoPallaClima(nomeMossa, meteo) {
  if (nomeMossa !== 'weather ball') return null
  const canonico = normalizzaMeteo(meteo)
  return canonico ? TIPO_PALLA_CLIMA[canonico] ?? null : null
}

export const ABILITA_ATE = Object.freeze({
  'pixilate':    TYPES.FAIRY,
  'aerilate':    TYPES.FLYING,
  'refrigerate': TYPES.ICE,
  'dragonize':   TYPES.DRAGON,
})

export const LEVEL = 50

/** Gli IV sono fissi a 31 in Champions — non esiste la variabilità classica. */
export const IV = 31

// ─── Sistema SP ──────────────────────────────────────────────────────────────

/** 1 SP vale 8 EV nella formula classica. */
export const EV_PER_SP = 8

/** Tetto per singola statistica. */
export const MAX_SP_PER_STAT = 32

/** Tetto complessivo sui sei valori. */
export const MAX_SP_TOTAL = 66

/**
 * Converte SP in EV, applicando il tetto per statistica.
 * Il clamp sta qui e non nel chiamante: così un valore fuori range salvato in
 * localStorage o arrivato da un link condiviso non può gonfiare una statistica.
 *
 * @param {number} sp
 * @returns {number} EV equivalenti
 */
export function spToEv(sp) {
  return Math.min(sp ?? 0, MAX_SP_PER_STAT) * EV_PER_SP
}

/**
 * Somma degli SP di uno spread.
 * @param {number[]} sps — sei valori, ordine [HP, Atk, Def, SpA, SpD, Spe]
 * @returns {number}
 */
export function totalSPs(sps = []) {
  return sps.reduce((a, b) => a + (b || 0), 0)
}

/**
 * Uno spread è legale se non sfora né il tetto totale né quello per statistica.
 * @param {number[]} sps
 * @returns {boolean}
 */
export function areSPsLegal(sps = []) {
  if (totalSPs(sps) > MAX_SP_TOTAL) return false
  return sps.every(v => (v || 0) >= 0 && (v || 0) <= MAX_SP_PER_STAT)
}

// ─── Indici delle statistiche ────────────────────────────────────────────────
// L'ordine è quello dei dati grezzi di Showdown, usato da pokemon.json e da
// tutti gli array `sps` dello store.

export const STAT_HP  = 0
export const STAT_ATT = 1
export const STAT_DEF = 2
export const STAT_SPA = 3
export const STAT_SPD = 4
export const STAT_SPE = 5

/** Etichette brevi, nello stesso ordine degli indici. Usate dall'editor. */
export const STAT_NAMES = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']

// ─── Tabella dei boost ───────────────────────────────────────────────────────
/**
 * I boost (da −6 a +6) si applicano come frazione, non come decimale: il gioco
 * fa una divisione intera, e usare 0.66 al posto di 2/3 sposta l'ultima unità
 * di danno in una percentuale non trascurabile di casi.
 *
 * L'indice è `6 + boost`, quindi la posizione 6 è il valore neutro.
 *
 * ─── NOTA SULL'UNIFICAZIONE ────────────────────────────────────────────────
 * Le tre copie che questo file sostituisce non erano identiche: `calcEngine` e
 * `StatRow` avevano 1/1 in posizione neutra, `speedOrder` aveva 2/2. Danno
 * entrambe 1, quindi l'unificazione è sicura al bit — ma il fatto che fossero
 * diverse e per caso equivalenti è esattamente il motivo per cui adesso ce
 * n'è una sola.
 */
export const BOOST_NUM = [2, 2, 2, 2, 2, 2, 1, 3, 4, 5, 6, 7, 8]
export const BOOST_DEN = [8, 7, 6, 5, 4, 3, 1, 2, 2, 2, 2, 2, 2]

/**
 * Applica un boost a una statistica già calcolata.
 *
 * @param {number} stat  — statistica finale, prima del boost
 * @param {number} boost — da −6 a +6
 * @returns {number}
 */
export function applyBoost(stat, boost) {
  if (!boost) return stat
  const i = 6 + Math.min(6, Math.max(-6, boost))
  return Math.floor(stat * BOOST_NUM[i] / BOOST_DEN[i])
}

// ─── Formato di gioco ────────────────────────────────────────────────────────

/**
 * The Sixth Ember calcola solo lotte in doppio. Non è un'impostazione: è
 * l'identità del prodotto, e questa costante esiste perché la formula del
 * danno ha un punto in cui il formato cambia il risultato (vedi SCREEN_MOD).
 *
 * Non c'è nessun selettore singoli/doppi nell'interfaccia e non deve
 * essercene uno: il valore sta qui perché l'harness della sessione H possa
 * forzarlo per generare confronti in entrambe le modalità.
 *
 * ─── DA NON CONFONDERE CON `doubleTarget` ──────────────────────────────────
 * `field.doubleTarget` dice quanti *bersagli vivi* ha davanti l'attaccante, e
 * governa solo la penalità del 25% sulle mosse ad area. Sono due cose
 * diverse: in doppio con un nemico solo rimasto la penalità cade, ma lo
 * schermo resta ridotto di un terzo. Legare i due valori introdurrebbe un
 * errore nuovo.
 */
export const FORMAT = 'doubles'

// ─── Schermi ─────────────────────────────────────────────────────────────────
/**
 * Reflect, Light Screen e Aurora Veil riducono il danno di una frazione che
 * dipende dal formato:
 *
 *   singoli   2048/4096 = ×0.5      il danno viene dimezzato
 *   doppi     2732/4096 ≈ ×0.667    il danno cala di circa un terzo
 *
 * ─── PERCHÉ CONTA ──────────────────────────────────────────────────────────
 * Fino alla sessione G il motore usava 2048 — il valore dei singoli — in
 * un'app che fa solo doppi. Sbagliava sempre nella direzione peggiore:
 * sottostimava il danno che stai per subire. Diceva che resisti, e morivi.
 * Sul caso di verifica (Garchomp High Horsepower dietro Reflect) la
 * differenza era fra "5HKO garantito" e "può morire in 3".
 *
 * In terza e quarta generazione la riduzione dipendeva davvero da quanti
 * Pokémon c'erano in campo. Game Freak l'ha tolto in quinta. Champions è
 * nona: 2732 sempre, dal primo turno all'ultimo, con due Pokémon o con uno.
 *
 * Fonte: NCP, `script_res/damage_MASTER.js`, funzione `calcFinalMods`:
 *   finalMods.push(field.format !== "Singles" ? 0xAAC : 0x800)
 * dove 0xAAC = 2732 e 0x800 = 2048.
 */
export const SCREEN_MOD_DOUBLES = 2732
export const SCREEN_MOD_SINGLES = 2048

/** Il valore effettivamente in uso, derivato da FORMAT. */
export const SCREEN_MOD = FORMAT === 'singles' ? SCREEN_MOD_SINGLES : SCREEN_MOD_DOUBLES

/**
 * Le mosse che attraversano gli schermi come se non ci fossero.
 *
 * Le chiavi sono quelle di `moves.json` (minuscolo, spazi). Sono qui e non
 * nei dati delle mosse per una ragione pratica: `moves.json` non ha ancora un
 * insieme di flag (`sound`, `punch`, `bullet`… — §1.11 dell'analisi), e
 * aggiungere un campo a tre voci su 809 avrebbe significato far passare un
 * file da 126 KB attraverso una modifica manuale per tre chiavi.
 *
 * Quando i dati delle mosse verranno arricchiti, questa lista va spostata lì
 * come `ignoresScreens: true` e questa costante cancellata.
 *
 * Fonte: NCP, `move_data.js` — le uniche tre voci con `ignoresScreens: true`.
 */
export const SCREEN_BYPASS_MOVES = new Set([
  'brick break',
  'psychic fangs',
  'raging bull',
])

// ─── Il vocabolario del meteo ────────────────────────────────────────────────

/**
 * I sei nomi di meteo che il motore riconosce. Tutto il resto o si traduce in
 * uno di questi, o non esiste.
 */
export const METEO_CANONICI = Object.freeze([
  'sun', 'rain', 'sand', 'snow', 'harsh sunshine', 'heavy rain',
])

/**
 * I nomi morti, e quello vivo in cui si traducono.
 *
 * ─── PERCHÉ `hail` NON È UN SINONIMO ───────────────────────────────────────
 * La grandine, in Champions, non esiste: dalla nona generazione la condizione
 * è la neve, che invece della sfilza di danni a fine turno dà +50% di Difesa
 * ai Pokémon di tipo Ghiaccio. Non sono due nomi della stessa cosa, sono due
 * meccaniche di cui una sola è ancora in gioco.
 *
 * Quindi qui non stiamo "accettando anche `hail`". Stiamo dicendo che chi
 * scrive `hail` — un link condiviso vecchio, un caso di test ereditato — sta
 * nominando una cosa che oggi si chiama neve, e la traduciamo una volta sola
 * in ingresso invece di ricordarcene in ogni confronto.
 *
 * `sandstorm` è un caso più banale: è lo stesso meteo, scritto lungo.
 *
 * ─── QUESTA DECISIONE ERA GIÀ PRESA ────────────────────────────────────────
 * `scripts/ncp/mappatura.mjs` mappa `hail: 'Snow'` e `sandstorm: 'Sand'` da
 * quando esiste l'harness (sessione H), e il commento lì lo dichiara. Cioè:
 * all'oracolo dicevamo "neve" da cinquecento casi, e al nostro motore
 * continuavamo a dire "grandine". L'unica divergenza viva rimasta —
 * `B2-weather-hail-039` — non era una meccanica sbagliata, era una parola che
 * il motore non conosceva.
 *
 * Da notare che NCP, letteralmente, il bonus lo dà solo sotto `"Snow"`
 * (`damage_MASTER.js` riga 2065): la sua `"Hail"` è la grandine vecchia, che
 * serve alle generazioni precedenti. Noi quelle non le calcoliamo.
 */
const METEO_LEGACY = Object.freeze({
  hail: 'snow',
  sandstorm: 'sand',
})

/**
 * Porta un nome di meteo alla forma canonica.
 *
 * Si applica UNA volta, all'ingresso del motore, e da lì in poi ogni confronto
 * è con un nome canonico. È il contrario di quello che facevamo prima, cioè
 * elencare i sinonimi in ogni punto in cui il meteo veniva letto: `calcStat`
 * ne conosceva due, `calcEOT` tre, `WEATHER_BALL_TYPE` otto, `speedOrder`
 * otto. Quattro liste che si potevano disallineare — e infatti erano
 * disallineate.
 *
 * Un nome non riconosciuto torna `null`, cioè "nessun meteo": è la stessa
 * cosa che il motore già faceva con una stringa vuota, e vale come difesa
 * contro un `?share=` malformato.
 *
 * @param {string|null|undefined} meteo
 * @returns {string|null} uno dei `METEO_CANONICI`, oppure null
 */
export function normalizzaMeteo(meteo) {
  if (!meteo) return null
  const s = String(meteo).trim().toLowerCase()
  const tradotto = METEO_LEGACY[s] ?? s
  return METEO_CANONICI.includes(tradotto) ? tradotto : null
}

// ─── Ricerca del KO ──────────────────────────────────────────────────────────

/**
 * Quanti colpi al massimo cerca `findBestNHKO` prima di dire "nessun KO".
 *
 * Era 6 fino alla sessione B, quando la ricorsione esponenziale rendeva
 * proibitivo salire. Con la programmazione dinamica il costo è lineare nei
 * colpi, quindi 9 non si sente. Sopra i 9 turni la domanda smette di avere
 * senso pratico in doubles: la partita è finita per altre ragioni.
 *
 * Chi legge questa costante: `lib/damage.js` (che la ri-esporta per
 * compatibilità) e, dalla sessione F, il ReportPanel per la scritta
 * "nessun KO in N turni".
 */
export const MAX_HITS = 9

/**
 * ─── LE MOSSE SU CUI PARENTAL BOND NON SI ATTIVA ────────────────────────────
 *
 * Questo elenco NON viene dal riferimento, ed è l'unico punto del motore in
 * cui ci discostiamo da lui di proposito. Va quindi letto sapendo cos'è.
 *
 * Il riferimento applica Parental Bond a ogni mossa che non sia già
 * multi-colpo e che non colpisca più bersagli insieme. Nel gioco non è così:
 * ci sono mosse su cui il secondo colpo non arriva, e il riferimento non le
 * modella perché il suo scopo è il numero di un colpo, non la sequenza del
 * turno.
 *
 * ─── LA FONTE, E LA CATENA DI CORREZIONI CHE HA RICHIESTO ──────────────────
 *
 * `wiki.pokemoncentral.it/Amorefiliale`, sezione Effetti, **corretta da
 * Simone su tre punti**. La wiki elenca una decina di famiglie escluse; delle
 * sue esclusioni queste quattro sono le uniche che ci riguardano, e due voci
 * della wiki sono state tolte perché sbagliate:
 *
 *   MOSSE A CARICAMENTO — la wiki le esclude, e sbaglia. Con Parental Bond
 *   la mossa carica al primo turno e al secondo colpisce DUE volte. Il
 *   riferimento fa già così, quindi non c'è niente da aggiungere.
 *
 *   UPROAR — la wiki la esclude, e sbaglia. Sceglie un bersaglio singolo fra
 *   gli avversari adiacenti, quindi non è come Terremoto che li colpisce
 *   tutti insieme: l'abilità si attiva e colpisce due volte. Anche qui il
 *   riferimento ha ragione.
 *
 * Le mosse a danno fisso e le OHKO che la wiki elenca non compaiono qui
 * perché da noi hanno potenza 0: al calcolo del danno non arrivano.
 *
 * ─── PERCHÉ IL SECONDO COLPO NON C'È ───────────────────────────────────────
 *
 * Due ragioni diverse, e vale la pena distinguerle perché una delle due non è
 * una regola dell'abilità:
 *
 *   explosion, self-destruct   il primo colpo manda KO CHI ATTACCA, quindi un
 *                              secondo colpo non può esistere. Non è
 *                              un'esclusione, è una conseguenza — ma il numero
 *                              che l'app deve mostrare è lo stesso.
 *
 *   rollout, ice ball          l'abilità viene ignorata del tutto: la mossa
 *                              colpisce una volta per turno come farebbe con
 *                              qualunque altro Pokémon.
 *
 * ─── DOVE SI VEDE LA DIVERGENZA ────────────────────────────────────────────
 *
 * `parentalBond.test.js` la elenca caso per caso: su queste quattro il
 * confronto col riferimento è DIVERSO di proposito, ed è scritto lì come
 * fatto rosso-o-verde invece che come nota.
 *
 * Explosion e Self-Destruct sono mosse ad area: in doppi il riferimento le
 * esclude già da sé, e la divergenza resta solo quando in campo è rimasto un
 * bersaglio solo.
 */
export const MOSSE_SENZA_PARENTAL_BOND = new Set([
  'explosion',
  'self-destruct',
  'rollout',
  'ice ball',
])
/**
 * ─── LE QUATTRO MOSSE CHE DAMP SPEGNE ───────────────────────────────────────
 *
 * Trascritte da `damage_MASTER.js:1138`, che le elenca per nome:
 *
 *     if ((defAbility === "Damp" || attacker.ability === "Damp") &&
 *         ["Self-Destruct", "Explosion", "Mind Blown", "Misty Explosion"]
 *           .indexOf(move.name) !== -1) { ... return { damage: [0] } }
 *
 * ─── PERCHÉ QUESTA LISTA STA QUI E NON IN `FLAG_MOSSE` ─────────────────────
 *
 * Perché nel vendor non c'è un flag da trascrivere: è un elenco di nomi
 * scritto dentro la condizione. `FLAG_MOSSE` serve quando NCP classifica le
 * mosse e noi copiamo la classificazione; qui non classifica niente, nomina
 * quattro mosse. Inventare un flag `esplosiva` che il vendor non ha vorrebbe
 * dire dedurre una categoria dove il riferimento fa un elenco.
 *
 * È la seconda lista di nomi nel motore dopo `MOSSE_SENZA_PARENTAL_BOND`, e
 * con una differenza che conta: quella lì registra dove DIVERGIAMO dal
 * riferimento e la fonte è una wiki, questa è trascritta dall'oracolo
 * eseguibile e ci fa combaciare con lui.
 *
 * ─── DUE LATI, NON UNO ─────────────────────────────────────────────────────
 *
 * La condizione guarda `defAbility === "Damp" || attacker.ability === "Damp"`.
 * Non è una difesa: chi ha Damp spegne queste mosse anche a sé stesso. Un
 * motore che controllasse solo il difensore sarebbe metà abilità con l'aria
 * di essere intera — lo stesso errore che Unaware invitava a fare.
 */
export const MOSSE_ANNULLATE_DA_DAMP = new Set([
  'self-destruct',
  'explosion',
  'mind blown',
  'misty explosion',
])

/**
 * ─── LE DIECI ABILITÀ CHE MOLD BREAKER NON RIESCE A IGNORARE ────────────────
 *
 * Trascritte da `damage_MASTER.js:999`, che le elenca per nome:
 *
 *     var isIgnoreable = ['Shadow Shield', 'Full Metal Body', 'Prism Armor',
 *         'As One', 'Protosynthesis', 'Quark Drive', 'Tablets of Ruin',
 *         'Vessel of Ruin', 'Sword of Ruin', 'Beads of Ruin']
 *         .indexOf(defAbility) == -1 && defItem !== "Ability Shield";
 *
 * ─── PERCHÉ UNA LISTA QUI E NON UN CAMPO IN `ABILITY_EFFECTS` ──────────────
 *
 * Perché un campo `nonIgnorabile` mentirebbe al registro del divario.
 *
 * Quattro di queste dieci — le «of Ruin» — non hanno oggi nessuna voce in
 * `ABILITY_EFFECTS`: non le calcoliamo, e il badge «non calcolata» lo dice.
 * Ma `haEffetto` (in `scripts/campi-meta.mjs`) considera calcolata qualunque
 * voce con almeno un campo non-meta: scrivere `{ nonIgnorabile: true }` le
 * farebbe sparire dal divario senza che il motore ne calcoli niente.
 *
 * È lo stesso motivo per cui il riferimento stesso le tiene in un elenco
 * dentro la funzione invece che addosso alle abilità.
 *
 * ─── IL CONFINE SUI NOMI ───────────────────────────────────────────────────
 *
 * L'elenco porta anche `defItem !== "Ability Shield"`, cioè lo strumento che
 * protegge l'abilità dall'essere ignorata. Nei nostri `items.json` non esiste,
 * quindi quella metà non è trascritta: come `gen !== 4`, è una condizione che
 * non ha nulla su cui essere vera. Il giorno che l'oggetto entrasse, il posto
 * dove aggiungerlo è la funzione che legge questo insieme.
 */
export const ABILITA_NON_IGNORABILI = new Set([
  'shadow-shield',
  'full-metal-body',
  'prism-armor',
  'as-one',
  'protosynthesis',
  'quark-drive',
  'tablets-of-ruin',
  'vessel-of-ruin',
  'sword-of-ruin',
  'beads-of-ruin',
])

/**
 * ─── LE MOSSE CHE IGNORANO L'ABILITÀ DEL BERSAGLIO ──────────────────────────
 *
 * Trascritte da `damage_MASTER.js:1002`, che ne elenca nove:
 *
 *     var isIgnoreMove = ["Moongeist Beam", "Sunsteel Strike", "Photon Geyser",
 *         "Searing Sunraze Smash", "Menacing Moonraze Maelstrom",
 *         "Light That Burns the Sky", 'G-Max Drum Solo', 'G-Max Fireball',
 *         'G-Max Hydrosnipe'].indexOf(move.name) !== -1;
 *
 * Fanno lo stesso di Mold Breaker senza che nessuno abbia l'abilità.
 *
 * ─── PERCHÉ TRE E NON NOVE ─────────────────────────────────────────────────
 *
 * Perché sei di quelle nove non esistono nei nostri `moves.json`: le tre mosse
 * Z (Searing Sunraze Smash, Menacing Moonraze Maelstrom, Light That Burns the
 * Sky) e le tre G-Max. Non è una scelta di modello, è il contenuto dei dati —
 * e se un giorno entrassero, il generatore dei dati le porterebbe e questa
 * lista andrebbe allungata a mano.
 *
 * Il test che accompagna questa costante misura esattamente quello: quali
 * delle nove esistono. Se il conto cambia, diventa rosso invece di restare
 * silenziosamente incompleto.
 */
export const MOSSE_CHE_IGNORANO_ABILITA = new Set([
  'moongeist beam',
  'sunsteel strike',
  'photon geyser',
])

/**
 * ─── I SETTE STRUMENTI CHE KLUTZ NON ANNULLA ────────────────────────────────
 *
 * Trascritti da `checkKlutz` (`damage_MASTER.js:448`):
 *
 *     if (['Macho Brace', 'Power Anklet', 'Power Band', 'Power Belt',
 *          'Power Bracer', 'Power Lens', 'Power Weight']
 *         .indexOf(pokemon.item) === -1) {
 *         pokemon.item = "Klutz";      // cioè: lo strumento non c'è più
 *     }
 *
 * Klutz spegne lo strumento di chi ce l'ha. Questi sette no — sono gli attrezzi
 * da allenamento, che continuano a pesare sulla Velocità anche con Klutz.
 *
 * ─── UNO SU SETTE ESISTE NEI NOSTRI DATI ───────────────────────────────────
 *
 * Solo `macho brace`. Gli altri sei — Power Anklet, Power Band, Power Belt,
 * Power Bracer, Power Lens, Power Weight — in `items.json` non ci sono.
 *
 * Sono scritti lo stesso, e non per completezza: la lista è l'eccezione a una
 * regola che ANNULLA. Tenerne una parte vorrebbe dire che il giorno in cui uno
 * dei sei entrasse nei dati, Klutz comincerebbe a spegnerlo in silenzio — e un
 * effetto che sparisce non lascia tracce come un effetto che compare.
 *
 * Il test che accompagna questa costante misura quanti dei sette esistono, così
 * se il conto cambia diventa rosso invece di restare una nota vecchia.
 */
export const STRUMENTI_IMMUNI_A_KLUTZ = new Set([
  'macho brace',
  'power anklet',
  'power band',
  'power belt',
  'power bracer',
  'power lens',
  'power weight',
])

/**
 * ─── LE QUATTRO MOSSE LA CUI POTENZA VIENE DAL PESO ─────────────────────────
 *
 * Nei dati hanno `power: 0`, che il motore tratta come «non calcolabile»: la
 * potenza vera non è scritta nella mossa, si ricava dal peso dei due Pokémon.
 *
 * Trascritte da `basePowerFunc` punto b (`damage_MASTER.js:1318-1347`), che le
 * divide in due famiglie con due tabelle diverse.
 *
 * ─── LE DUE TABELLE, COPIATE E NON RICOSTRUITE ─────────────────────────────
 *
 * Sono scritte come catene di ternari nel riferimento, e qui restano catene:
 * le soglie sono `>=`, il confronto è sul peso in VIRGOLA MOBILE — nessun
 * arrotondamento, e i nostri dati vanno da 0,1 a 999,9 kg.
 *
 *     Low Kick, Grass Knot     guardano il peso del BERSAGLIO
 *     Heavy Slam, Heat Crash   guardano il RAPPORTO attaccante / bersaglio
 *
 * ─── PERCHÉ UNA LISTA DI NOMI E NON UN FLAG ────────────────────────────────
 *
 * Perché nel vendor sono quattro `case` di uno `switch` sul nome della mossa,
 * non un campo che si possa trascrivere. Stessa forma di
 * `MOSSE_ANNULLATE_DA_DAMP` e per la stessa ragione.
 */
export const MOSSE_PESO_BERSAGLIO = new Set(['low kick', 'grass knot'])
export const MOSSE_PESO_RAPPORTO  = new Set(['heavy slam', 'heat crash'])

/** Vero se la potenza di questa mossa si ricava dal peso invece che dai dati. */
export function haPotenzaDaPeso(mossa) {
  return MOSSE_PESO_BERSAGLIO.has(mossa) || MOSSE_PESO_RAPPORTO.has(mossa)
}

/**
 * Low Kick e Grass Knot: la potenza dal peso del bersaglio.
 * `damage_MASTER.js:1323`
 */
export function potenzaDaPeso(peso) {
  return peso >= 200 ? 120
    : peso >= 100 ? 100
    : peso >= 50 ? 80
    : peso >= 25 ? 60
    : peso >= 10 ? 40
    : 20
}

/**
 * Heavy Slam e Heat Crash: la potenza dal rapporto fra i due pesi.
 * `damage_MASTER.js:1336`
 *
 * Nota che la catena è più corta dell'altra e non ha il gradino più basso: sotto
 * il rapporto 2 la potenza è 40 e non scende oltre.
 */
export function potenzaDaRapportoPeso(rapporto) {
  return rapporto >= 5 ? 120
    : rapporto >= 4 ? 100
    : rapporto >= 3 ? 80
    : rapporto >= 2 ? 60
    : 40
}

/**
 * ─── LE DUE LISTE DEI COPIATORI ─────────────────────────────────────────────
 *
 * Trascritte da `checkTrace` (`damage_MASTER.js:387`) e da `checkNeutralGas`
 * (`:403`). Sono le abilita' che Trace non puo' copiare e quelle che
 * Neutralizing Gas non puo' spegnere.
 *
 * Le due liste NON coincidono, ed e' la cosa da non dedurre. Contate:
 *
 *   undici stanno solo fra le non copiabili — Commander, Flower Gift,
 *   Forecast, Illusion, Imposter, Power of Alchemy, Protosynthesis, Quark
 *   Drive, Receiver, Trace, Wonder Guard: Trace non le copia, Neutralizing
 *   Gas le spegne;
 *
 *   due stanno solo fra le non spegnibili — Power Construct e Tera Shift:
 *   Neutralizing Gas non le spegne, e Trace le copierebbe.
 *
 * Trascritte separatamente proprio per questo: dedurre l'una dall'altra
 * sbaglierebbe tredici voci su ventiquattro.
 *
 * I rami del riferimento per `gen <= 4` non sono qui: giriamo a `gen = 10`.
 *
 * L'`Ability Shield` che il riferimento controlla in tutt'e due le funzioni
 * non e' fra i nostri strumenti, quindi la sua condizione non ha oggi niente
 * su cui essere vera. Resta scritta nei commenti del motore.
 */
export const ABILITA_NON_COPIABILI = new Set([
  'as-one',
  'battle-bond',
  'comatose',
  'commander',
  'disguise',
  'flower-gift',
  'forecast',
  'gulp-missile',
  'ice-face',
  'illusion',
  'imposter',
  'multitype',
  'power-of-alchemy',
  'protosynthesis',
  'quark-drive',
  'receiver',
  'rks-system',
  'schooling',
  'shields-down',
  'stance-change',
  'trace',
  'wonder-guard',
  'zen-mode',
  'zero-to-hero',
])

export const ABILITA_NON_SPEGNIBILI = new Set([
  'as-one',
  'battle-bond',
  'comatose',
  'disguise',
  'gulp-missile',
  'ice-face',
  'multitype',
  'power-construct',
  'rks-system',
  'schooling',
  'shields-down',
  'stance-change',
  'tera-shift',
  'zen-mode',
  'zero-to-hero',
])
