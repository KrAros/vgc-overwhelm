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