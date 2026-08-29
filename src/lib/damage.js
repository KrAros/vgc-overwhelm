// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/lib/damage.js
 *
 * Libreria di base per i calcoli danno end-of-turn e KO chance.
 * Fonte di verità unica — importata da ReportPanel e smogonString.
 *
 * Nessuna dipendenza React, nessun side effect.
 */

import { TYPES } from '../data/typeChart'
import { MAX_HITS, normalizzaMeteo } from './rules.js'
import { normalizeAbilityKey } from '../data/abilityEffects.js'

// ── Costanti ──────────────────────────────────────────────────────────────────

/**
 * Numero massimo di colpi considerato nella ricerca dell'NHKO.
 * Era 6 quando la KO chance costava 16^n: oltre quel numero il browser si
 * bloccava. Con la programmazione dinamica nove colpi costano 0,1 ms, e nove
 * è anche il tetto che usa il calculator di Smogon.
 *
 * Dalla sessione F-1 la simulazione della Sitrus Berry vive qui e usa lo stesso
 * tetto: prima stava in ReportPanel.jsx con un 6 scritto a mano, e il pannello
 * poteva dire «7HKO» nel badge e «nessun KO in 6 turni» nella riga sotto.
 */
// Ri-esportata per compatibilità: la definizione sta in `lib/rules.js` dalla
// sessione C, insieme alle altre regole di gioco. I chiamanti storici
// (`utils/smogonString.js`, i test) continuano a importarla da qui.
export { MAX_HITS }

/**
 * Sotto questa probabilità un KO viene considerato inesistente.
 * Serve a due cose: scartare il rumore in virgola mobile e non annunciare
 * un "0,004% chance to 4HKO" che non interessa a nessuno.
 */
const SOGLIA_KO = 0.0001

/** Sopra questa probabilità un KO viene considerato garantito. */
const SOGLIA_GARANTITO = 0.9999

// ── Immunità sabbia ───────────────────────────────────────────────────────────

const SAND_IMMUNE_TYPES = new Set([TYPES.ROCK, TYPES.STEEL, TYPES.GROUND])

/**
 * ─── CHIAVI COL TRATTINO, CONFRONTO NORMALIZZATO ───────────────────────────
 *
 * Erano scritte con lo SPAZIO e confrontate con un semplice `toLowerCase()`.
 * Sembrava funzionare perche' `pokemon.json` scriveva alcune abilita' con lo
 * spazio — ma solo alcune: 300 riferimenti su 1389. Per tutte le altre specie
 * l'immunita' alla sabbia non scattava, e nessuno lo notava perche' i tipi
 * Roccia, Acciaio e Terra sono immuni comunque e coprivano i casi piu' ovvi.
 *
 * Misurato: delle cinque abilita' qui sotto, quattro rispondevano solo nella
 * grafia con lo spazio. `overcoat` funzionava per caso, essendo una parola
 * sola.
 *
 * Normalizzando `pokemon.json` a una grafia sola questa tabella sarebbe
 * passata da meta' rotta a rotta del tutto. Ora usa la stessa normalizzazione
 * del resto del progetto, come gia' fa `speedOrder.js`.
 */
const SAND_IMMUNE_ABILITIES = new Set([
  'sand-force', 'sand-rush', 'sand-veil', 'magic-guard', 'overcoat',
])

/**
 * Restituisce true se il difensore è immune al danno da tempesta di sabbia.
 * @param {number[]} defTypes  — array di indici tipo dal pokemonData
 * @param {string}   ability   — abilità del difensore (slug lowercase)
 * @param {string}   item      — item del difensore (slug lowercase)
 */
export function isSandImmune(defTypes = [], ability = '', item = '') {
  return (
    defTypes.some(t => SAND_IMMUNE_TYPES.has(t)) ||
    SAND_IMMUNE_ABILITIES.has(normalizeAbilityKey(ability)) ||
    item.toLowerCase() === 'safety goggles'
  )
}

// ── EOT (End of Turn) ─────────────────────────────────────────────────────────

/**
 * Calcola tutti gli effetti fine turno rilevanti per un difensore.
 *
 * @param {object} def      — slot difensore dallo store { item, ability }
 * @param {number} defHP    — HP massimi del difensore (da result.defHP)
 * @param {string} weather  — meteo attivo (slug lowercase)
 * @param {number[]} defTypes — tipi del difensore (indici numerici)
 * @returns {{
 *   isSand: boolean,
 *   sandImmune: boolean,
 *   sandDmgHP: number,
 *   leftoversHP: number,
 *   sitrusBerryHP: number,
 *   eotNet: number,
 * }}
 */
export function calcEOT(def, defHP, weather, defTypes = []) {
  // Un solo nome per un solo meteo. Prima qui c'era `w === 'sand' || w ===
  // 'sandstorm'`, cioè la terza delle quattro liste di sinonimi sparse per il
  // progetto — e ognuna ne conosceva un pezzo diverso.
  const isSand = normalizzaMeteo(weather) === 'sand'
  const sandImmune = isSandImmune(defTypes, def.ability || '', def.item || '')
  const sandDmgHP = isSand && !sandImmune ? Math.floor(defHP / 16) : 0
  const leftoversHP = (def.item || '').toLowerCase() === 'leftovers'
    ? Math.floor(defHP / 16)
    : 0
  const sitrusBerryHP = (def.item || '').toLowerCase() === 'sitrus berry'
    ? Math.floor(defHP / 4)
    : 0
  const eotNet = leftoversHP - sandDmgHP

  return { isSand, sandImmune, sandDmgHP, leftoversHP, sitrusBerryHP, eotNet }
}

// ── KO Chance ─────────────────────────────────────────────────────────────────

/**
 * Probabilità cumulativa di KO, colpo per colpo.
 *
 * ─── COME FUNZIONA ────────────────────────────────────────────────────────
 * L'implementazione precedente era una ricorsione che apriva un ramo per ogni
 * roll a ogni colpo: 16^n percorsi. Con sei colpi sono 16,7 milioni di rami,
 * 253 ms di main thread bloccato; con sette, quattro secondi e mezzo.
 *
 * Il punto è che quei milioni di percorsi arrivano su pochissimi stati diversi:
 * quello che conta di un percorso non è la sequenza dei roll ma solo gli HP
 * rimasti alla fine. Quindi invece di seguire i percorsi teniamo una mappa
 * `HP rimasti → probabilità di trovarsi lì`, e a ogni colpo la trasformiamo
 * nella mappa del colpo successivo. Gli stati possibili sono al massimo quanti
 * gli HP del difensore (~200-400), quindi il costo diventa
 * `colpi × stati × roll` ≈ 30 mila operazioni invece di 16,7 milioni.
 *
 * È la stessa tecnica già usata da `_calcSitrusProb` in ReportPanel.jsx.
 *
 * ─── SEMANTICA DEL TURNO ──────────────────────────────────────────────────
 * Per ogni colpo, in quest'ordine:
 *   1. sottrai il roll → se gli HP scendono a 0 o sotto è KO, e il turno finisce lì
 *   2. applica l'EOT (Leftovers positivo, sabbia negativo) → se gli HP
 *      scendono a 0 o sotto è KO (la sabbia può chiudere il conto a fine turno)
 *   3. limita gli HP al massimo del difensore
 *
 * I punti 1 e 3 sono le due correzioni di questa sessione. Prima il KO veniva
 * controllato solo dopo l'ultimo colpo, quindi una sequenza che uccideva al
 * secondo colpo e poi "risaliva" con i Leftovers veniva contata come non-KO;
 * e la cura poteva portare gli HP sopra il massimo, rendendo il KO sempre più
 * difficile turno dopo turno.
 *
 * Con `eotNet ≤ 0` (nessun EOT, oppure sabbia) i risultati sono identici alla
 * vecchia implementazione: gli HP scendono e basta, quindi controllare il KO
 * in mezzo o solo alla fine è la stessa cosa. I numeri cambiano solo quando i
 * Leftovers superano l'eventuale danno da sabbia.
 *
 * ─── UN TURNO PUÒ CONTENERE PIÙ COLPI ─────────────────────────────────────
 * `colpiPerTurno` esiste per le mosse multi-colpo: Bombardamento ne tira fino
 * a dieci in UN turno. La differenza con dieci turni non è un dettaglio, ed è
 * doppia:
 *
 *   · l'EOT si applica una volta per TURNO, non per colpo. Passare dieci
 *     colpi come dieci turni farebbe mangiare al difensore dieci volte gli
 *     Avanzi.
 *   · la domanda «fa KO?» riguarda il turno, non il singolo colpo.
 *
 * E soprattutto NON si può approssimare moltiplicando i roll: dieci tiri da
 * 10-13 danno un totale fra 100 e 130, ma quasi mai agli estremi — la somma
 * di dieci tiri indipendenti è molto più stretta di dieci volte un tiro solo.
 * La DP qui sotto la calcola esatta, perché convolve colpo per colpo.
 *
 * @param {number[]} rolls   — array dei 16 roll di danno di UN colpo
 * @param {number}   defHP   — HP del difensore all'inizio del calcolo
 * @param {number}   eotNet  — delta EOT per turno (+cura, -danno)
 * @param {number}   maxHits — quanti TURNI calcolare
 * @param {number}   colpiPerTurno — colpi della mossa in un turno (1 per quasi
 *                   tutte). L'EOT scatta dopo l'ultimo, non fra l'uno e l'altro.
 * @returns {number[]} array lungo `maxHits`: l'elemento in posizione `h - 1`
 *                     è la probabilità di aver fatto KO **entro** `h` turni.
 */
export function koChanceCumulative(rolls, defHP, eotNet = 0, maxHits = MAX_HITS, colpiPerTurno = 1) {
  const cumulativa = new Array(Math.max(maxHits, 0)).fill(0)
  if (!rolls || rolls.length === 0 || maxHits < 1) return cumulativa

  const n = rolls.length
  const quotaRoll = 1 / n
  const colpi = Math.max(1, Math.floor(colpiPerTurno))

  // stati: HP rimasti → probabilità di trovarsi con quegli HP.
  // All'inizio siamo con certezza agli HP pieni.
  let stati = new Map([[defHP, 1]])
  let koTotale = 0

  for (let h = 0; h < maxHits; h++) {
    // ── I colpi del turno ──────────────────────────────────────────────────
    // Con `colpi === 1` questo ciclo gira una volta e il comportamento è
    // identico a prima, riga per riga.
    for (let c = 0; c < colpi; c++) {
      const dopoIlColpo = new Map()
      for (const [hp, prob] of stati) {
        const quota = prob * quotaRoll
        for (const roll of rolls) {
          const nuoviHP = hp - roll
          if (nuoviHP <= 0) { koTotale += quota; continue }  // KO dal colpo
          dopoIlColpo.set(nuoviHP, (dopoIlColpo.get(nuoviHP) || 0) + quota)
        }
      }
      stati = dopoIlColpo
      if (stati.size === 0) break
    }

    // ── L'EOT, una volta sola, a fine turno ────────────────────────────────
    const prossimi = new Map()
    for (const [hp, prob] of stati) {
      let nuoviHP = hp + eotNet
      if (nuoviHP <= 0) { koTotale += prob; continue }       // KO dall'EOT
      if (nuoviHP > defHP) nuoviHP = defHP                   // la cura non supera il massimo
      prossimi.set(nuoviHP, (prossimi.get(nuoviHP) || 0) + prob)
    }

    cumulativa[h] = koTotale
    stati = prossimi

    // Nessuno stato sopravvissuto: il KO è certo, i colpi successivi non
    // cambiano più niente. Riempio il resto e esco.
    if (stati.size === 0) {
      for (let k = h + 1; k < maxHits; k++) cumulativa[k] = koTotale
      break
    }
  }

  return cumulativa
}

/**
 * Probabilità di fare KO entro `hits` colpi.
 *
 * Wrapper su `koChanceCumulative` per i casi in cui serve un numero solo.
 * Se ti servono più valori di `hits`, chiama direttamente `koChanceCumulative`
 * una volta sola invece di questa funzione in un ciclo: la DP calcola tutti i
 * colpi nella stessa passata.
 *
 * @param {number[]} rolls
 * @param {number}   defHP
 * @param {number}   eotNet
 * @param {number}   hits
 * @returns {number} probabilità in [0, 1]
 */
export function calcKOChance(rolls, defHP, eotNet, hits, colpiPerTurno = 1) {
  if (hits < 1) return 0
  return koChanceCumulative(rolls, defHP, eotNet, hits, colpiPerTurno)[hits - 1]
}

// ── Best NHKO ─────────────────────────────────────────────────────────────────

/**
 * Trova il miglior NHKO possibile con EOT: il primo numero di colpi la cui
 * probabilità di KO supera la soglia.
 *
 * Una sola passata di DP copre tutti i valori di `hits`, quindi non c'è più
 * il ciclo di chiamate che c'era prima.
 *
 * @param {number[]} rolls
 * @param {number}   defHP
 * @param {number}   eotNet
 * @param {object}   [opzioni]
 * @param {number}   [opzioni.minHits=1]        — da quanti colpi iniziare a
 *   guardare. La stringa Smogon passa 2 perché la chance di OHKO è mostrata
 *   altrove nel pannello.
 * @param {number}   [opzioni.maxHits=MAX_HITS] — tetto della ricerca.
 * @returns {{
 *   hits: number,
 *   chance: number,
 *   pct: number,
 *   guaranteed: boolean,
 * } | null}
 */
export function findBestNHKO(rolls, defHP, eotNet, { minHits = 1, maxHits = MAX_HITS, colpiPerTurno = 1 } = {}) {
  return primoKO(koChanceCumulative(rolls, defHP, eotNet, maxHits, colpiPerTurno), { minHits, maxHits })
}

/**
 * La regola di lettura di una cumulativa: il primo numero di colpi la cui
 * probabilità supera la soglia.
 *
 * Estratta da `findBestNHKO` nella sessione F-1 perché ora ci sono DUE
 * distribuzioni — con e senza Sitrus Berry — e la cosa che non deve
 * divergere fra le due è proprio questa regola. Finché è una funzione sola,
 * non può.
 *
 * @param {number[]} cumulativa
 * @param {object} [opzioni]
 * @returns {{hits:number, chance:number, pct:number, guaranteed:boolean}|null}
 */
function primoKO(cumulativa, { minHits = 1, maxHits = MAX_HITS } = {}) {
  for (let hits = Math.max(minHits, 1); hits <= maxHits; hits++) {
    const chance = cumulativa[hits - 1]
    if (chance > SOGLIA_KO) {
      return {
        hits,
        chance,
        pct: Math.round(chance * 1000) / 10,
        guaranteed: chance >= SOGLIA_GARANTITO,
      }
    }
  }
  return null
}

// ── Sitrus Berry ──────────────────────────────────────────────────────────────

/**
 * La stessa DP di `koChanceCumulative`, ma con la Sitrus Berry nello stato.
 *
 * ─── PERCHÉ SERVE UNO STATO IN PIÙ ────────────────────────────────────────
 * La bacca si mangia una volta sola, quando gli HP scendono a metà o sotto.
 * Quindi «quanti HP mi restano» non basta più a descrivere un percorso: due
 * percorsi con gli stessi HP sono diversi se uno ha già consumato la bacca e
 * l'altro no. Lo stato diventa la coppia `(hp, bacca già usata)`.
 *
 * La coppia è codificata in un intero — `hp * 2 + usata` — invece che nella
 * stringa `"${hp},${usata}"` che c'era prima in ReportPanel: stessa cosa, ma
 * senza costruire e ri-analizzare centomila stringhe per calcolo.
 *
 * ─── L'ORDINE DENTRO IL TURNO ─────────────────────────────────────────────
 *   1. sottrai il roll → se scende a 0 o sotto è KO, e il turno finisce lì
 *   2. la bacca, se non è ancora stata usata e gli HP sono a metà o sotto
 *   3. l'EOT (Avanzi positivo, sabbia negativo) → può uccidere anche lui
 *   4. limita gli HP al massimo
 *
 * ─── LA SABBIA POTEVA UCCIDERE, MA NON NELLA NARRATIVA ────────────────────
 * Il punto 4 del piano segnalava un `Math.max(hp + eot, 1)` che impediva alla
 * sabbia di chiudere il conto. Stava nella parte deterministica di
 * `simulateSitrus` — quella che disegnava il turno per turno — e quella parte
 * non era renderizzata da nessun componente: `healTurns`, `midDmg` e `hko`
 * venivano restituiti e mai letti. Il difetto era reale nel codice e
 * invisibile a schermo. È stata rimossa invece che corretta: qui sotto,
 * nella parte che invece finisce davvero sullo schermo, quel clamp non c'è
 * mai stato e la sabbia uccide.
 *
 * @param {number[]} rolls
 * @param {number}   defHP
 * @param {object}   [opzioni]
 * @param {number}   [opzioni.eotNet=0]
 * @param {boolean}  [opzioni.conSitrus=true]
 * @param {number}   [opzioni.maxHits=MAX_HITS]
 * @returns {number[]} probabilità di aver fatto KO **entro** h colpi
 */
export function koChanceSitrus(rolls, defHP, { eotNet = 0, conSitrus = true, maxHits = MAX_HITS, colpiPerTurno = 1 } = {}) {
  const cumulativa = new Array(Math.max(maxHits, 0)).fill(0)
  if (!rolls || rolls.length === 0 || maxHits < 1) return cumulativa

  const quotaRoll = 1 / rolls.length
  const cura   = Math.floor(defHP / 4)
  const soglia = Math.floor(defHP / 2)
  const colpi  = Math.max(1, Math.floor(colpiPerTurno))

  // chiave = hp * 2 + (bacca usata ? 1 : 0)
  let stati = new Map([[defHP * 2, 1]])
  let koTotale = 0

  for (let h = 0; h < maxHits; h++) {
    // ── I colpi del turno ──────────────────────────────────────────────────
    // La bacca si controlla DENTRO questo ciclo, non fuori: con una mossa
    // multi-colpo può attivarsi a metà mossa — è il terzo colpo di
    // Bombardamento a portare sotto metà, e i sette dopo trovano già la cura
    // fatta. Metterla fuori vorrebbe dire farla scattare a mossa finita, cioè
    // dopo che il KO è già successo.
    for (let c = 0; c < colpi; c++) {
      const dopoIlColpo = new Map()
      for (const [stato, prob] of stati) {
        const hp    = stato >> 1
        const usata = (stato & 1) === 1
        const quota = prob * quotaRoll

        for (const roll of rolls) {
          let nuoviHP = hp - roll
          if (nuoviHP <= 0) { koTotale += quota; continue }

          let oraUsata = usata
          if (conSitrus && !usata && nuoviHP <= soglia) {
            nuoviHP = Math.min(nuoviHP + cura, defHP)
            oraUsata = true
          }

          const chiave = nuoviHP * 2 + (oraUsata ? 1 : 0)
          dopoIlColpo.set(chiave, (dopoIlColpo.get(chiave) || 0) + quota)
        }
      }
      stati = dopoIlColpo
      if (stati.size === 0) break
    }

    // ── L'EOT, una volta sola, a fine turno ────────────────────────────────
    const prossimi = new Map()
    for (const [stato, prob] of stati) {
      const usata = (stato & 1) === 1
      let nuoviHP = (stato >> 1) + eotNet
      if (nuoviHP <= 0) { koTotale += prob; continue }
      if (nuoviHP > defHP) nuoviHP = defHP
      const chiave = nuoviHP * 2 + (usata ? 1 : 0)
      prossimi.set(chiave, (prossimi.get(chiave) || 0) + prob)
    }

    cumulativa[h] = koTotale
    stati = prossimi

    if (stati.size === 0) {
      for (let k = h + 1; k < maxHits; k++) cumulativa[k] = koTotale
      break
    }
  }

  return cumulativa
}

/**
 * Il miglior NHKO tenendo conto della Sitrus Berry.
 *
 * Stessa forma di ritorno e stessa regola di lettura di `findBestNHKO`: le due
 * funzioni differiscono solo per la distribuzione da cui leggono.
 *
 * ─── PRIMA RISPONDEVANO A DUE DOMANDE DIVERSE ─────────────────────────────
 * La versione in ReportPanel prendeva la probabilità di morire *esattamente* a
 * quel turno, mentre `findBestNHKO` prende quella di essere morto *entro* quel
 * turno. Nello stesso pannello, sulla stessa mossa, il badge diceva una cosa e
 * la riga sotto un'altra — e quella del Sitrus era sempre la più bassa delle
 * due, cioè sbagliava nella direzione che fa sopravvalutare la sopravvivenza.
 * Per un tool da torneo è la direzione peggiore in cui sbagliare.
 *
 * @param {number[]} rolls
 * @param {number}   defHP
 * @param {object}   [opzioni] — come `koChanceSitrus`, più `minHits`
 * @returns {{hits:number, chance:number, pct:number, guaranteed:boolean}|null}
 */
export function findBestNHKOSitrus(rolls, defHP, { eotNet = 0, conSitrus = true, minHits = 1, maxHits = MAX_HITS, colpiPerTurno = 1 } = {}) {
  return primoKO(koChanceSitrus(rolls, defHP, { eotNet, conSitrus, maxHits, colpiPerTurno }), { minHits, maxHits })
}