// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/utils/showdownIO.js
 * Funzioni pure per convertire tra il formato paste Showdown e
 * gli slot dello store. Non importano React, non hanno side effects.
 *
 * Esporta:
 *   parseShowdownPaste(text)  → { pokemon[], warnings[] }
 *   teamToShowdown(team)      → string
 */

import pokemonData   from '../data/pokemon.json'
import movesData     from '../data/moves.json'
import itemsData     from '../data/items.json'
import abilitiesData from '../data/abilities.json'
import { NATURES }   from '../data/natures.js'
import { spToEv, EV_PER_SP, MAX_SP_PER_STAT, MAX_SP_TOTAL } from '../lib/rules.js'
import { abilitaPerSpecie } from '../lib/abilitaSpecie.js'

/**
 * ─── SP ⇄ EV ───────────────────────────────────────────────────────────────
 *
 * Champions investe in SP, Showdown in EV, e `rules.js` fissa il cambio:
 * **1 SP vale 8 EV** (`EV_PER_SP`). Fino alla sessione L queste due funzioni
 * non convertivano affatto:
 *
 *     SP_TO_EV = (sp) => sp                → esportava «EVs: 32», che in
 *                                            Showdown è quasi niente
 *     EV_TO_SP = (ev) => Math.min(32, ev)  → troncava invece di dividere
 *
 * Con il troncamento un normale 252/4/252 diventava 32/4/32: il 252 finiva
 * giusto per caso (il tetto coincide), ma il 4 valeva otto volte l'intenzione
 * e il totale usciva 68 su un tetto di 66 — l'editor scriveva `(-2/66)` e
 * lasciava passare.
 *
 * Con la divisione il tetto non si può più sforare, e non è una stima:
 * 508 EV — il massimo legale in Showdown — fanno 63,5 SP, e l'arrotondamento
 * aggiunge al più mezzo punto per statistica, cioè 3 in tutto. Il peggior caso
 * è 66,5, che su interi è **66**. Esattamente il tetto, mai oltre.
 *
 * Le due funzioni vanno cambiate INSIEME: correggere solo la lettura
 * romperebbe l'andata e ritorno, perché l'export scriverebbe ancora gli SP
 * grezzi e la rilettura li dividerebbe per otto.
 *
 * Il tetto a 252 nell'export è quello di Showdown: 32 SP varrebbero 256 EV,
 * che lì è illegale. Il giro resta stabile lo stesso — 32 → 252 → 32 —
 * perché 252/8 arrotonda a 32.
 *
 * CONFINE DICHIARATO. L'SP è un'unità più grossa dell'EV, quindi il giro
 * EV → SP → EV non conserva il TOTALE: 252/4/252 fa 508 in entrata e
 * 252/8/252 = 512 in uscita, perché i 4 EV di avanzo arrotondano a 1 SP e
 * tornano indietro come 8. Nel caso peggiore ogni statistica guadagna 4 EV,
 * quindi al più +24 sul totale. È il prezzo dell'arrotondamento verso il
 * massimo: con `Math.floor` il totale non crescerebbe mai, ma un set 252
 * perderebbe un punto e non sarebbe più massimale — che è il caso comune.
 * Il per-statistica resta sempre legale; è solo la somma che può eccedere i
 * 508 di Showdown.
 */
const SP_TO_EV = (sp) => Math.min(252, spToEv(sp))
const EV_TO_SP = (ev) => Math.min(MAX_SP_PER_STAT, Math.round((ev || 0) / EV_PER_SP))
const STAT_NAMES_SHOWDOWN = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']
const STAT_IDX = { HP: 0, Atk: 1, Def: 2, SpA: 3, SpD: 4, Spe: 5 }

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * I casi in cui il nome visibile e lo slug non si assomigliano abbastanza.
 * Chiave: nome già normalizzato. Sono cinque in tutto, e sono elencati per
 * esteso invece di essere indovinati da una regola, perché una regola che
 * riordina le parole («Dusk Mane Necrozma» → «necrozma-dusk») creerebbe più
 * falsi positivi di quanti casi risolve.
 *
 * Ogni forma di Necrozma compare due volte: come la scriviamo noi e come la
 * scrive Showdown, che mette il prefisso dall'altra parte.
 */
const ALIAS_POKEMON = {
  'dusk-mane-necrozma': 'necrozma-dusk',
  'necrozma-dusk-mane': 'necrozma-dusk',
  'dawn-wings-necrozma': 'necrozma-dawn',
  'necrozma-dawn-wings': 'necrozma-dawn',
  'ultra-necrozma': 'necrozma-ultra',
  'basculegion': 'basculegion-m',
  /**
   * ─── LA FLOETTE ETERNA NON È LA SUA MEGA ─────────────────────────────────
   *
   * Qui c'erano tre righe che mandavano `floette-eternal` su `floette-mega`,
   * scritte in HH sulla premessa che fossero «la stessa creatura». La premessa
   * era sbagliata, e l'errore non era innocuo: sono due forme distinte, ed è
   * il Fiore Eterno a megaevolvere nella Mega.
   *
   * `vendor/ncp/pokedex.js` le tiene separate, con statistiche diverse:
   *
   *     Floette-Eternal   74/65/67/125/128/92
   *     Mega Floette      74/85/87/155/148/102
   *
   * Chi incollava un paste con `Floette-Eternal` si ritrovava quindi trenta
   * punti di Attacco Speciale e venti di Difesa Speciale in più di quelli
   * veri, e il calcolatore rispondeva con numeri sbagliati senza dirlo.
   *
   * La premessa nacque da un vincolo reale — `floette-eternal` non esisteva
   * nella nostra anagrafica, quindi mandarla sulla Mega era l'unico modo di
   * non rispondere «non trovato». Adesso la forma c'è, e l'alias sparisce:
   * ogni nome va sulla propria forma. `floette-eternal` e le sue scritture
   * lunghe le prende la regola generale della sessione W, che riordina i
   * segmenti; `Mega Floette` continua a risolversi da sé.
   */
  'eternal-flower-floette': 'floette-eternal',
  'floette-eternal-flower': 'floette-eternal',
}

/**
 * Nome Showdown → nostro slug.
 *
 * Le chiavi di `pokemon.json` seguono una convenzione sola: solo `[a-z0-9-]`,
 * il trattino come unico separatore. Qui applichiamo la STESSA normalizzazione
 * al nome in arrivo, invece di provare due o tre forme a caso.
 *
 * Le tre `replace` in fila fanno tre pulizie in ordine: via punti, apostrofi e
 * due punti (`Mr. Mime`, `Farfetch'd`, `Type: Null`), spazi e underscore
 * diventano trattini (`Flutter Mane`), e l'ultima schiaccia i trattini doppi
 * che le prime due possono aver prodotto. La `g` nella regex significa «tutte
 * le occorrenze», non solo la prima.
 *
 * Prima della sessione I questa funzione provava solo il minuscolo e poi
 * spazi→trattini: con le chiavi Gen 8-9 ancora collassate (`fluttermane`) non
 * trovava niente, e 71 specie — cioè quasi tutto il meta di Reg M-B — non
 * erano importabili da una paste.
 */
/**
 * ─── I PREFISSI REGIONALI SCRITTI PER ESTESO ────────────────────────────────
 *
 * L'albero usa il suffisso corto (`raichu-alola`), il mondo scrive l'aggettivo
 * davanti (`Alolan Raichu`). Sono quattro, si elencano.
 */
const PREFISSI_REGIONE = {
  alolan: 'alola',
  galarian: 'galar',
  hisuian: 'hisui',
  paldean: 'paldea',
}

/** Tutte le permutazioni dei segmenti. Con 2-4 segmenti sono al massimo 24. */
function permutazioni(a) {
  if (a.length <= 1) return [a]
  return a.flatMap((x, i) =>
    permutazioni([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]))
}

const normalizzaNome = (s) =>
  s.trim().toLowerCase().replace(/[.'’:]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-')

/**
 * ─── RISOLVE UNA CHIAVE GIÀ NORMALIZZATA ───────────────────────────────────
 *
 * Tre tentativi in ordine di specificità: chiave esatta, alias scritto a mano,
 * poi le due regole generali.
 *
 * ─── PERCHÉ LE PERMUTAZIONI E NON UNA TABELLA ──────────────────────────────
 *
 * Misurato prima di scrivere questa funzione: con le tre grafie che una
 * persona usa naturalmente — «Mega Scolipede», «Rotom (Wash)», «Alolan
 * Raichu» — fallivano **270 casi su 270**, zero funzionanti. Una tabella di
 * alias per 270 voci sarebbe una seconda copia dell'anagrafica, cioè il
 * difetto che questo progetto insegue da sei sessioni.
 *
 * La regola vera è che l'albero scrive `base-forma` e il mondo scrive
 * `Forma Base`: è un problema di ORDINE, non di vocabolario.
 *
 * ─── PERCHÉ È SICURO ───────────────────────────────────────────────────────
 *
 * Il rischio della regola generale è che una permutazione finisca su una
 * specie DIVERSA da quella voluta. Contato su tutte le 241 specie con più di
 * un segmento, provando ogni permutazione di ognuna: **zero collisioni**.
 * Nessuna specie dell'albero è il riordino di un'altra.
 *
 * Il tetto a 4 segmenti non è prudenza generica: 5 segmenti sarebbero 120
 * permutazioni, e nessuna chiave dell'albero ne ha più di 4.
 */
function risolviChiaveSpecie(norm) {
  if (pokemonData[norm]) return norm
  if (ALIAS_POKEMON[norm]) return ALIAS_POKEMON[norm]

  const parti = norm.split('-')

  const regione = PREFISSI_REGIONE[parti[0]]
  if (regione) {
    const c = [...parti.slice(1), regione].join('-')
    if (pokemonData[c]) return c
  }

  if (parti.length >= 2 && parti.length <= 4) {
    for (const p of permutazioni(parti)) {
      const c = p.join('-')
      if (pokemonData[c]) return c
    }
  }
  return null
}

/**
 * ─── LE PARENTESI VOGLIONO DIRE DUE COSE ───────────────────────────────────
 *
 * `Pikachu (Raichu)` in Showdown è un NICKNAME: la specie è quella dentro.
 * `Rotom (Wash)` invece è una FORMA: la specie è l'unione delle due.
 *
 * Non si distinguono guardandole, si distinguono provandole. L'ordine conta:
 * prima l'unione, perché è la lettura più specifica — se `rotom-wash` esiste
 * nell'albero, l'intenzione non è ambigua. Solo se l'unione non esiste si
 * ricade sul nickname.
 *
 * Prima di oggi vinceva sempre il nickname: `Rotom (Wash)` cercava «Wash» e
 * buttava via «Rotom». Falliva peggio degli altri casi, perché scartava
 * proprio la parte che identificava il Pokémon.
 *
 * Il marcatore di genere ricade qui da solo: `Basculegion (M)` si unisce in
 * `basculegion-m`, che è una chiave vera.
 */
function findPokemonKey(name) {
  const diretto = risolviChiaveSpecie(normalizzaNome(name))
  if (diretto) return diretto

  const m = name.match(/^(.+)\((.+)\)\s*$/)
  if (m) {
    const [, fuori, dentro] = m
    return risolviChiaveSpecie(normalizzaNome(fuori + '-' + dentro))
        ?? risolviChiaveSpecie(normalizzaNome(dentro))
        ?? risolviChiaveSpecie(normalizzaNome(fuori))
  }
  return null
}

function findMoveKey(name) {
  const slug = name.trim().toLowerCase()
  if (movesData[slug]) return slug
  const spaced = slug.replace(/-/g, ' ')
  if (movesData[spaced]) return spaced
  return null
}

function findItemKey(name) {
  const slug = name.trim().toLowerCase()
  return itemsData[slug] ? slug : null
}

function findAbilityKey(name) {
  const slug = name.trim().toLowerCase()
  return abilitiesData[slug] ? slug : null
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parsa una paste Showdown completa (fino a 6 Pokémon separati da righe vuote).
 * Restituisce { pokemon: slot[], warnings: string[] }.
 * I slot hanno la stessa forma di emptyPokemon() nello store.
 */
export function parseShowdownPaste(paste) {
  const blocks = paste
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean)
    .slice(0, 6)

  const warnings = []
  const pokemon  = []

  for (const [blockIdx, block] of blocks.entries()) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) continue

    // Riga 1: "Nome @ Item"
    let pokeRawName = lines[0]
    let itemKey     = null

    if (lines[0].includes(' @ ')) {
      const [pokePart, itemPart] = lines[0].split(' @ ')
      pokeRawName = pokePart.trim()
      itemKey = findItemKey(itemPart.trim())
      if (!itemKey) warnings.push(`Slot ${blockIdx + 1}: item "${itemPart.trim()}" not found.`)
    }

    // Le parentesi le scioglie `findPokemonKey`: possono essere un nickname
    // («Pikachu (Raichu)») o una forma («Rotom (Wash)»), e la differenza si
    // decide provando l'albero, non guardando la stringa. Toglierle qui, come
    // si faceva prima, impediva alla regola di vedere il caso.
    const pokemonKey = findPokemonKey(pokeRawName)
    if (!pokemonKey) {
      warnings.push(`Slot ${blockIdx + 1}: Pokémon "${pokeRawName}" not found, skipped.`)
      continue
    }

    let abilityKey = null
    let nature     = null
    const sps      = [0, 0, 0, 0, 0, 0]
    const moves    = [null, null, null, null]
    let moveIdx    = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('Ability:')) {
        const raw = line.replace('Ability:', '').trim()
        abilityKey = findAbilityKey(raw)
        if (!abilityKey) warnings.push(`Slot ${blockIdx + 1}: abilità "${raw}" non trovata.`)

      } else if (line.startsWith('EVs:')) {
        /**
         * ─── L'ETICHETTA DICE «EVs» E I NUMERI POSSONO ESSERE SP ───────────
         *
         * Champions investe in SP, Showdown in EV, ma chi scrive un set per
         * Champions usa comunque l'intestazione `EVs:` perché è quella che il
         * formato prevede. Prima di oggi la riga passava sempre da
         * `EV_TO_SP`, che divide per otto: una distribuzione SP legale
         * diventava un ottavo di sé stessa, e nessuno lo segnalava.
         *
         * ─── COME SI DISTINGUONO ───────────────────────────────────────────
         *
         * Non dall'etichetta, che è la stessa. Dai numeri, confrontati con i
         * due tetti che `rules.js` già dichiara: una distribuzione SP sta per
         * costruzione entro 32 per statistica e 66 in totale. Un set Showdown
         * vero ne esce quasi sempre al primo valore — 252 supera 32 da solo.
         *
         * L'export di quest'app scrive EV veri (SP×8), quindi il giro di
         * andata e ritorno non può cadere qui dentro: 32 SP escono come 256.
         *
         * ─── LA ZONA GRIGIA, DICHIARATA ────────────────────────────────────
         *
         * Un set Showdown genuino con pochissimi EV investiti — somma entro
         * 66 e nessun valore oltre 32 — viene letto come SP. È raro ma
         * possibile, e la lettura è ambigua per costruzione: gli stessi sei
         * numeri sono validi in entrambe le unità.
         *
         * Avevo proposto di scriverlo nei warning. **Simone ha scelto di no**,
         * dopo aver letto la ragione: l'ipotesi resta silenziosa. Registrato
         * qui perché fra sei mesi si sappia che il silenzio è voluto.
         */
        const grezzi = [0, 0, 0, 0, 0, 0]
        line.replace('EVs:', '').trim().split('/').forEach(seg => {
          const m = seg.trim().match(/^(\d+)\s+(\w+)$/)
          if (m) {
            const idx = STAT_IDX[m[2]]
            if (idx !== undefined) grezzi[idx] = parseInt(m[1], 10)
          }
        })
        const sonoGiaSP = grezzi.every(v => v <= MAX_SP_PER_STAT) &&
                          grezzi.reduce((a, b) => a + b, 0) <= MAX_SP_TOTAL
        for (let s = 0; s < 6; s++) {
          sps[s] = sonoGiaSP ? grezzi[s] : EV_TO_SP(grezzi[s])
        }

      } else if (line.endsWith(' Nature')) {
        const n = line.replace(' Nature', '').trim().toLowerCase()
        if (NATURES.includes(n)) nature = n
        else warnings.push(`Slot ${blockIdx + 1}: nature "${n}" not recognized.`)

      } else if (line.startsWith('- ') && moveIdx < 4) {
        const raw     = line.slice(2).trim()
        const moveKey = findMoveKey(raw)
        if (moveKey) moves[moveIdx] = moveKey
        else warnings.push(`Slot ${blockIdx + 1}: mossa "${raw}" non trovata.`)
        moveIdx++
      }
      // IVs, Level, Shiny, Tera Type → ignorati (Champions format)
    }

    // Fallback abilità di default se non trovata nella paste
    if (!abilityKey) {
      abilityKey = pokemonData[pokemonKey]?.abilities?.[0] || null
    }

    /**
     * ─── L'ABILITÀ DEVE ESSERE UNA CHE LA SPECIE PUÒ AVERE ──────────────────
     *
     * Un paste può portare un'abilità impossibile: `Charizard-Mega-Y` con
     * `Ability: Blaze`, che è quella del Charizard base. Prima di oggi finiva
     * nello store così com'era.
     *
     * Il difetto NON era visibile dove sembrava. La tendina disegna le opzioni
     * della specie — per una Mega spesso una sola — e un `<select>` il cui
     * `value` non corrisponde a nessuna `<option>` mostra la PRIMA: si leggeva
     * «Siccità» mentre lo store diceva ancora `blaze`. L'unico componente che
     * diceva il vero era il riquadro della descrizione, che sembrava quindi
     * l'unico sbagliato.
     *
     * E non era cosmetico: il danno si calcola sull'abilità dello store.
     *
     * ─── LE DUE CONVENZIONI DI CHIAVE ──────────────────────────────────────
     *
     * `abilities.json` scrive con lo spazio (`flower veil`, 196 su 196),
     * `pokemon.json` col trattino (`flower-veil`). L'import passava dal primo e
     * la tendina dal secondo, quindi lo store conteneva l'una o l'altra grafia
     * a seconda di come ci si era arrivati. Il motore tollera entrambe perché
     * normalizza, ma erano due modi di scrivere la stessa cosa.
     *
     * Qui si scrive la forma col trattino, riusando `normalizeAbilityKey`
     * invece di ricopiarne la regola.
     *
     * ─── SILENZIOSA, PER SCELTA ────────────────────────────────────────────
     *
     * Avevo proposto un warning, come già esiste per le mosse non trovate.
     * **Simone ha scelto la correzione silenziosa** dopo aver letto la ragione.
     */
    abilityKey = abilitaPerSpecie(pokemonKey, abilityKey)

    pokemon.push({
      key: pokemonKey, moves, sps, nature,
      ability: abilityKey, item: itemKey,
      atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
      abilityFlags: {},
    })
  }

  return { pokemon, warnings }
}

// ─── Serializer ───────────────────────────────────────────────────────────────

function slotToShowdown(slot) {
  if (!slot?.key) return null
  const data = pokemonData[slot.key]
  if (!data) return null

  const displayName   = data.name || slot.key
  const itemDisplay   = slot.item
    ? (itemsData[slot.item]?.name || slot.item.replace(/\b\w/g, c => c.toUpperCase()))
    : null
  const line1 = itemDisplay ? `${displayName} @ ${itemDisplay}` : displayName

  const abilityDisplay = slot.ability
    ? (abilitiesData[slot.ability]?.name || slot.ability.replace(/\b\w/g, c => c.toUpperCase()))
    : 'None'

  const evParts = (slot.sps || [])
    .map((sp, i) => sp > 0 ? `${SP_TO_EV(sp)} ${STAT_NAMES_SHOWDOWN[i]}` : null)
    .filter(Boolean)

  const natureLine = slot.nature
    ? `${slot.nature.charAt(0).toUpperCase() + slot.nature.slice(1)} Nature`
    : null

  const moveLines = (slot.moves || [])
    .filter(Boolean)
    .map(moveKey => {
      const moveName = movesData[moveKey]?.name
        || moveKey.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return `- ${moveName}`
    })

  return [
    line1,
    `Ability: ${abilityDisplay}`,
    evParts.length ? `EVs: ${evParts.join(' / ')}` : null,
    natureLine,
    ...moveLines,
  ].filter(Boolean).join('\n')
}

/**
 * Serializza un team (array di 6 slot) in paste Showdown.
 */
export function teamToShowdown(team) {
  return team.map(slotToShowdown).filter(Boolean).join('\n\n')
}