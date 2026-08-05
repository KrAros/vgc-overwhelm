/**
 * scripts/ncp/mappatura.mjs
 *
 * Il ponte fra i nostri nomi e quelli di NCP.
 *
 * Noi identifichiamo le cose con slug minuscoli e trattini (`landorus-therian`,
 * `never-melt ice`, `high horsepower`). NCP usa i nomi con le maiuscole come
 * appaiono nel gioco (`Landorus-Therian`, `Never-Melt Ice`, `High Horsepower`).
 *
 * ─── PERCHÉ QUESTO FILE ESISTE ─────────────────────────────────────────────
 * L'harness deve confrontare due mondi che non condividono niente: il nostro
 * motore coi nostri dati, il loro motore coi loro. È il punto: se gli passassi
 * i nostri dati e i nostri dati fossero sbagliati, NCP confermerebbe l'errore
 * con grande sicurezza. L'unica cosa che i due mondi devono condividere è
 * l'identità delle entità — "il Garchomp di cui parlo io è il Garchomp di cui
 * parli tu" — ed è quello che traduce questo file.
 *
 * ─── LA DISTINZIONE CHE CONTA ──────────────────────────────────────────────
 * Due mondi indipendenti possono dare numeri diversi per due ragioni:
 *
 *   1. ANAGRAFICA — uno dei due ha il dato sbagliato. Aegislash da noi ha 150
 *      di Difesa, in NCP 140 (fu ridotto in Scarlet/Violet). Il danno esce
 *      diverso, ma la formula non c'entra.
 *   2. FORMULA — base stats identiche, tipi identici, potenza identica, e il
 *      danno esce comunque diverso.
 *
 * Solo la seconda interessa alla sessione D. Per questo `verificaAnagrafica`
 * fa da cancello: un caso in cui i dati di partenza già divergono non diventa
 * mai un golden, perché entrerebbe nella suite come test rosso e passeresti
 * un pomeriggio a cercare nella formula un bug che sta nel JSON.
 */

import { TYPE_NAMES } from '../../src/data/typeChart.js'

/**
 * Riduce una stringa a una forma confrontabile: minuscolo, senza punti né
 * apostrofi, senza spazi né trattini.
 *
 *   'Never-Melt Ice'   → 'nevermeltice'
 *   'never-melt ice'   → 'nevermeltice'
 *   "King's Rock"      → 'kingsrock'
 *   'Landorus-Therian' → 'landorustherian'
 *
 * Buttare via spazi e trattini insieme è deliberato: le due convenzioni non
 * concordano su dove metterli (`black glasses` da noi, `Black Glasses` da loro,
 * `blackglasses` nel nostro items.json in altri punti), e la distinzione non
 * porta informazione. Il rischio teorico è far collidere due entità diverse:
 * misurato sui quattro dataset, non succede.
 */
export function normalizza(s) {
  return String(s).toLowerCase().replace(/[.'’:]/g, '').replace(/[-\s_]+/g, '')
}

/** Costruisce una mappa forma-normalizzata → nome originale. */
function indicizza(chiavi) {
  const m = new Map()
  for (const k of chiavi) m.set(normalizza(k), k)
  return m
}

/**
 * Forme che nessuna regola meccanica indovina. Chiave: nostro slug.
 * L'elenco è corto di proposito — le Mega e le Primal seguono una regola e
 * non stanno qui.
 */
export const ECCEZIONI_POKEMON = {
  'calyrex-ice': 'Calyrex-Ice Rider',
  'calyrex-shadow': 'Calyrex-Shadow Rider',
  'toxtricity-low-key': 'Toxtricity-Low Key',
  'urshifu': 'Urshifu-Single Strike',
  'urshifu-rapid-strike': 'Urshifu-Rapid Strike',
  'type-null': 'Type: Null',
  'basculegion-m': 'Basculegion',
  'basculegion-f': 'Basculegion-F',
  'basculin-blue-striped': 'Basculin',
  // `whisiwashi-school` stava qui per aggirare il refuso nel nostro slug. La
  // sessione I l'ha corretto in `wishiwashi-school`, che ora si normalizza da
  // solo su `Wishiwashi-School`: l'eccezione non serve più.
  'necrozma-dusk': 'Necrozma-Dusk-Mane',
  'necrozma-dawn': 'Necrozma-Dawn-Wings',
  'necrozma-ultra': 'Ultra Necrozma',
  'minior-meteor': 'Minior',
  'minior-core': 'Minior-Core',
  'pumpkaboo': 'Pumpkaboo-Average',
  'gourgeist': 'Gourgeist-Average',
  'oricorio-fire': 'Oricorio-Baile',
  'oricorio-electric': 'Oricorio-Pom-Pom',
  'oricorio-psychic': "Oricorio-Pa'u",
  'oricorio-ghost': 'Oricorio-Sensu',
}

/**
 * Le regole che invece si applicano da sole. Ogni voce prova a riscrivere lo
 * slug in un nome NCP; la prima che produce un nome esistente vince.
 *
 *   'garchomp-mega'      → 'Mega Garchomp'
 *   'charizard-mega-x'   → 'Mega Charizard X'
 *   'kyogre-primal'      → 'Primal Kyogre'
 */
const REGOLE_FORMA = [
  { da: /^(.+)-mega-([xyz])$/, a: (m) => `Mega ${m[1]} ${m[2].toUpperCase()}` },
  { da: /^(.+)-mega$/, a: (m) => `Mega ${m[1]}` },
  { da: /^(.+)-primal$/, a: (m) => `Primal ${m[1]}` },
]

/**
 * Le nostre nature sono slug minuscoli, quelle di NCP hanno l'iniziale grande.
 * Non c'è nient'altro da fare: i 25 nomi coincidono.
 */
export function naturaNCP(slug) {
  if (!slug) return 'Hardy'
  return slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase()
}

/**
 * Meteo e terreno: i nostri valori interni verso le etichette di NCP.
 *
 * Nota sui sinonimi: il nostro store usa sia `sand` che `sandstorm`, sia `snow`
 * che `hail`, per la stessa condizione. NCP ne ha una sola per tipo. Qui le
 * uniamo, il che significa che l'harness NON riproduce il difetto descritto al
 * punto 8 della sessione F (dove `calcStat` riconosce solo una delle due forme)
 * — e proprio per questo lo mette in luce come divergenza.
 */
export const METEO_NCP = {
  sun: 'Sun',
  rain: 'Rain',
  sand: 'Sand',
  sandstorm: 'Sand',
  snow: 'Snow',
  hail: 'Snow',
  'heavy rain': 'Heavy Rain',
  'harsh sunshine': 'Harsh Sun',
}

export const TERRENO_NCP = {
  electric: 'Electric',
  grassy: 'Grassy',
  misty: 'Misty',
  psychic: 'Psychic',
}

/**
 * Il traduttore vero e proprio. Va costruito una volta passandogli i dataset
 * NCP e i nostri, poi si interroga.
 */
export function creaTraduttore(ncp, nostri) {
  const iPokemon = indicizza(Object.keys(ncp.pokedex))
  const iMosse = indicizza(Object.keys(ncp.mosse))
  const iStrumenti = indicizza(ncp.strumenti)
  const iAbilita = indicizza(ncp.abilita)

  function pokemonNCP(slug) {
    if (!slug) return null
    const ecc = ECCEZIONI_POKEMON[slug]
    if (ecc) return ncp.pokedex[ecc] ? ecc : null
    const diretto = iPokemon.get(normalizza(slug))
    if (diretto) return diretto
    for (const regola of REGOLE_FORMA) {
      const m = slug.match(regola.da)
      if (!m) continue
      const candidato = iPokemon.get(normalizza(regola.a(m)))
      if (candidato) return candidato
    }
    return null
  }

  const mossaNCP = (slug) => (slug ? iMosse.get(normalizza(slug)) ?? null : null)
  const strumentoNCP = (slug) => (slug ? iStrumenti.get(normalizza(slug)) ?? null : null)
  const abilitaNCP = (slug) => (slug ? iAbilita.get(normalizza(slug)) ?? null : null)

  /**
   * Il cancello. Restituisce l'elenco (eventualmente vuoto) delle differenze
   * di dato fra i due mondi per le entità coinvolte in un caso.
   *
   * Non guarda tutto: guarda le tre cose che entrano nella formula del danno —
   * base stats, tipi, potenza della mossa. Il peso, la categoria e i flag di
   * contatto non ci entrano direttamente e li lasciamo fuori per non riempire
   * il report di rumore.
   */
  function verificaAnagrafica({ pokemon = [], mosse = [] }) {
    const differenze = []

    for (const slug of pokemon) {
      const nome = pokemonNCP(slug)
      if (!nome) { differenze.push({ tipo: 'specie assente in NCP', entita: slug }); continue }
      const loro = ncp.pokedex[nome]
      const nostro = nostri.pokemon[slug]
      if (!nostro) { differenze.push({ tipo: 'specie assente da noi', entita: slug }); continue }

      const bsLoro = [loro.bs.hp, loro.bs.at, loro.bs.df, loro.bs.sa, loro.bs.sd, loro.bs.sp]
      if (JSON.stringify(nostro.stats) !== JSON.stringify(bsLoro)) {
        differenze.push({ tipo: 'base stats', entita: slug, nostro: nostro.stats, ncp: bsLoro })
      }

      const tipiLoro = [loro.t1, loro.t2].filter(Boolean).map(normalizza).sort()
      const tipiNostri = (nostro.type || []).filter(t => t !== null && t !== undefined)
        .map(i => TYPE_NAMES[i]).filter(Boolean).map(normalizza).sort()
      if (JSON.stringify(tipiNostri) !== JSON.stringify(tipiLoro)) {
        differenze.push({ tipo: 'tipi', entita: slug, nostro: tipiNostri, ncp: tipiLoro })
      }
    }

    for (const slug of mosse) {
      const nome = mossaNCP(slug)
      if (!nome) { differenze.push({ tipo: 'mossa assente in NCP', entita: slug }); continue }
      const loro = ncp.mosse[nome]
      const nostro = nostri.mosse[slug]
      if (!nostro) { differenze.push({ tipo: 'mossa assente da noi', entita: slug }); continue }

      if ((nostro.power || 0) !== (loro.bp || 0)) {
        differenze.push({ tipo: 'potenza', entita: slug, nostro: nostro.power ?? 0, ncp: loro.bp ?? 0 })
      }
      const tipoLoro = normalizza(loro.type || '')
      const tipoNostro = normalizza(TYPE_NAMES[nostro.type] || '')
      if (tipoNostro !== tipoLoro) {
        differenze.push({ tipo: 'tipo mossa', entita: slug, nostro: tipoNostro, ncp: tipoLoro })
      }
    }

    return differenze
  }

  return { pokemonNCP, mossaNCP, strumentoNCP, abilitaNCP, verificaAnagrafica }
}
