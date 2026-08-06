/**
 * scripts/ncp/contesto.mjs
 *
 * Carica i sorgenti di NCP in un ambiente JavaScript separato e ne restituisce
 * le funzioni e i dati.
 *
 * ─── COS'È UN "CONTESTO" ───────────────────────────────────────────────────
 * Il modulo `node:vm` permette di eseguire codice in uno spazio di nomi tutto
 * suo. Le variabili globali che NCP dichiara (`POKEDEX_CHAMPIONS`, `gen`,
 * `moves`…) vivono lì dentro e non toccano il nostro programma. È esattamente
 * il ruolo che nel browser ha la pagina: i file di NCP si aspettano di essere
 * caricati uno dopo l'altro con dei tag <script> e di vedersi a vicenda tramite
 * globali. Qui riproduciamo quella condizione, in una stanza chiusa.
 *
 * Il costo è di circa 160 ms una volta sola, quasi tutti spesi a leggere e
 * interpretare i 411 KB di `pokedex.js`. Per questo il contesto è costruito
 * una volta e riusato: `caricaNCP()` restituisce sempre lo stesso oggetto.
 *
 * ─── PERCHÉ IL DATASET È QUELLO "NATDEX" ───────────────────────────────────
 * NCP ha due varianti di Champions: quella base (315 specie, 496 mosse) e
 * quella "national dex" (1247 specie, 930 mosse), che nell'interfaccia si
 * attiva con un interruttore. Misurato: la variante base è un sottoinsieme
 * esatto dell'altra — zero differenze su base stats e zero su potenza delle
 * mosse, per tutte le voci in comune.
 *
 * Usiamo la variante estesa perché il nostro `pokemon.json` ha 1221 specie:
 * con quella ristretta un terzo dei casi non sarebbe nemmeno esprimibile.
 * Le correzioni specifiche di Champions (Make It Rain a -2, Dragon Claw che
 * diventa una mossa "taglio", i BP rivisti) ci sono in entrambe.
 */

import vm from 'node:vm'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const QUI = path.dirname(fileURLToPath(import.meta.url))
const RADICE = path.resolve(QUI, '..', '..')
const VENDOR = path.join(RADICE, 'vendor', 'ncp')

/**
 * L'ordine conta: ogni file si aspetta che i precedenti abbiano già dichiarato
 * le loro globali. `pokedex.js` usa `$.extend` (dal prelude), `damage_SV.js`
 * usa le funzioni di `damage_MASTER.js`, e così via.
 */
const FILE_NCP = [
  'type_data.js',
  'nature_data.js',
  'stat_data.js',
  'pokedex.js',
  'move_data.js',
  'ability_data.js',
  'item_data.js',
  'damage_MASTER.js',
  'damage_SV.js',
]

let cache = null

export function caricaNCP() {
  if (cache) return cache

  const contesto = vm.createContext({
    console,
    // NCP tocca queste due solo di striscio; darle vuote basta.
    window: {},
    localStorage: { getItem: () => null, setItem: () => {} },
  })

  const esegui = (sorgente, nome) => vm.runInContext(sorgente, contesto, { filename: nome })

  esegui(fs.readFileSync(path.join(QUI, 'prelude.js'), 'utf8'), 'prelude.js')
  for (const f of FILE_NCP) {
    esegui(fs.readFileSync(path.join(VENDOR, f), 'utf8'), `ncp/${f}`)
  }

  // Queste globali le imposta normalmente `ap_calc.js` quando l'utente sceglie
  // la generazione dal menu a tendina. `gen = 10` è Champions.
  esegui(`
    gen = 10;
    typeChart = TYPE_CHART_SV;
    STATS = STATS_GSC;
    pokedex   = POKEDEX_ZA_NATDEX;
    moves     = MOVES_CHAMPIONS_NATDEX;
    items     = ITEMS_ZA_NATDEX;
    abilities = ABILITIES_CHAMPIONS_NATDEX;

    // "SPs" è la modalità in cui NCP mostra i punti statistica di Champions
    // invece degli EV. Influenza solo le stringhe descrittive, non i numeri,
    // ma senza di lei alcune funzioni leggono una variabile non dichiarata.
    resultDisplayMode = "SPs";

    // Tre globali che l'interfaccia riempie e che il motore consulta.
    transformSpecies = { p1: '', p2: '' };
    mechanicsTests = {};
    isCustomMods = false;
  `, 'setup.js')

  const leggi = (espressione) => vm.runInContext(espressione, contesto)

  cache = {
    /** Valuta un'espressione dentro il contesto NCP. Utile per ispezionare. */
    leggi,
    /** La funzione di calcolo danni per Champions. */
    GET_DAMAGE_SV: leggi('GET_DAMAGE_SV'),
    /**
     * L'ingresso VERO di NCP, un livello sopra `GET_DAMAGE_SV`.
     *
     * Prepara i due Pokémon — Trace, Paradosso, Intimidate, Download,
     * Intrepid Sword, semi del terreno, pesi — poi calcola le statistiche
     * dopo i boost e infine chiama `GET_DAMAGE_SV` per le quattro mosse di
     * ciascun lato.
     *
     * Fino a F-2 non lo usavamo, e quello strato non era coperto da nessun
     * confronto: la prima sonda ha trovato quattordici divergenze su sedici.
     * Vuole un oggetto campo con dei metodi invece del semplice `Side`;
     * lo costruisce `costruisciCampo` nell'harness.
     */
    CALCULATE_ALL_MOVES_SV: leggi('CALCULATE_ALL_MOVES_SV'),
    /** Applica il moltiplicatore di boost (+1, -2…) a una statistica grezza. */
    getModifiedStat: leggi('getModifiedStat'),
    /** Il costruttore del lato campo, dal prelude. */
    Side: leggi('Side'),
    /** Il metodo `hasType` che ogni Pokémon NCP deve avere addosso. */
    setHasTypeFunc: leggi('setHasTypeFunc'),
    /** I dataset. */
    pokedex: leggi('POKEDEX_ZA_NATDEX'),
    mosse: leggi('MOVES_CHAMPIONS_NATDEX'),
    strumenti: leggi('ITEMS_ZA_NATDEX'),
    abilita: leggi('ABILITIES_CHAMPIONS_NATDEX'),
    nature: leggi('NATURES'),
  }
  return cache
}

/**
 * Le formule delle statistiche di Champions, trascritte da `stat_data.js`
 * (`CALC_STAT_CHAMP` e `CALC_HP_CHAMP`).
 *
 * Perché ricopiarle invece di chiamare le loro: le originali leggono i valori
 * dai campi di una pagina HTML (`poke.find(".hp .sps").val()`) e scrivono il
 * risultato dentro un altro campo, invece di restituirlo. Non sono richiamabili
 * da fuori. La formula però è tre righe, ed è questa:
 *
 *   HP   = ⌊(base × 2 + 31) × 50 / 100⌋ + 50 + 10 + SP
 *   stat = ⌊(⌊(base × 2 + 31) × 50 / 100⌋ + 5 + SP) × natura⌋
 *
 * IV fissi a 31, livello fisso a 50, gli SP che si sommano dopo il livello:
 * è lo stesso modello che abbiamo in `src/lib/stats.js`. Se un giorno le due
 * dovessero divergere, il test `ncpGolden` lo direbbe subito su tutti i casi
 * in una volta, perché ogni singolo danno cambierebbe.
 */
export function statChampions(base, sp, nature, statNCP, nature_table) {
  const mod = nature_table[nature]
  const mult = mod[0] === statNCP ? 1.1 : mod[1] === statNCP ? 0.9 : 1
  return Math.floor((Math.floor((base * 2 + 31) * 50 / 100) + 5 + sp) * mult)
}

export function hpChampions(base, sp) {
  if (base === 1) return 1
  return Math.floor((base * 2 + 31) * 50 / 100) + 50 + 10 + sp
}
