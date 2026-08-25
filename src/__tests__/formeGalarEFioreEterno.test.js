/**
 * src/__tests__/formeGalarEFioreEterno.test.js
 *
 * Le quattro forme che l'anagrafica non aveva, e la Megapietra che sbagliava
 * bersaglio.
 *
 * ─── DA DOVE VENGONO I NUMERI ──────────────────────────────────────────────
 *
 * Non dalla memoria di nessuno: da `vendor/ncp/pokedex.js`, che è dentro il
 * repository e si può rileggere. Questo file NON ricopia quei numeri a mano —
 * li rilegge dal riferimento e li confronta con i nostri. Ricopiarli qui
 * sarebbe stata una seconda trascrizione da tenere allineata, cioè la forma di
 * difetto che questo repo ha già incontrato tre volte.
 *
 * Se un giorno il vendor venisse aggiornato e una statistica cambiasse, questo
 * test diventa rosso — ed è quello che deve fare.
 *
 * ─── PERCHÉ LE QUATTRO FORME MANCAVANO ─────────────────────────────────────
 *
 * Sono uscite confrontando l'elenco della reg M-A con `pokemon.json`: la lista
 * nomina Slowbro, Slowking e Stunfisk due volte ciascuno — base più forma di
 * Galar — e una Floette che è il Fiore Eterno. Nessuna delle quattro esisteva.
 * Non erano un problema di mappatura: mancava proprio il dato.
 */

import { describe, it, expect } from 'vitest'
import pokemonData from '../data/pokemon.json' with { type: 'json' }
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import { TYPES } from '../data/typeChart.js'
import { caricaNCP } from '../../scripts/ncp/contesto.mjs'

/**
 * Il pokédex del riferimento passa da `caricaNCP()`, lo stesso contesto che
 * usano l'harness dell'oracolo e `gen-flag-dati.mjs`.
 *
 * Leggerlo a mano non funziona e non è un dettaglio: `vendor/ncp/pokedex.js`
 * non è un JSON ma una catena di generazioni costruite con `$.extend`
 * (`POKEDEX_RBY` → … → `POKEDEX_ZA_NATDEX`). Un `JSON.parse` sul testo
 * fallisce, e — peggio — un parser che "quasi" funzionasse leggerebbe la
 * generazione sbagliata, cioè statistiche vecchie di venti generazioni.
 */
let dexCache = null
const pokedexRiferimento = () => (dexCache ??= caricaNCP().pokedex)

/** Nostro ordine: [PS, Att, Dif, Att.Sp, Dif.Sp, Vel]. Quello di NCP è nominale. */
const statsDaRiferimento = (bs) => [bs.hp, bs.at, bs.df, bs.sa, bs.sd, bs.sp]

const NOME_TIPO = Object.fromEntries(Object.entries(TYPES).map(([n, i]) => [i, n]))

const COPPIE = {
  'slowbro-galar': 'Slowbro-Galar',
  'slowking-galar': 'Slowking-Galar',
  'stunfisk-galar': 'Stunfisk-Galar',
  'floette-eternal': 'Floette-Eternal',
}

describe('le forme di Galar e il Fiore Eterno', () => {
  const dex = pokedexRiferimento()

  it('il riferimento contiene tutte e quattro le voci attese', () => {
    // Controllo negativo del metodo: se la lettura del vendor fallisse, i
    // test sotto passerebbero a vuoto confrontando `undefined` con niente.
    for (const nome of Object.values(COPPIE)) {
      expect(dex[nome], `${nome} non è nel pokédex del riferimento`).toBeTruthy()
    }
    expect(dex['Garchomp'], 'lettura del vendor rotta').toBeTruthy()
    expect(dex['specie che non esiste']).toBeUndefined()
  })

  for (const [slug, nomeNcp] of Object.entries(COPPIE)) {
    it(`${slug} c'è, e coincide col riferimento`, () => {
      const nostro = pokemonData[slug]
      expect(nostro, `${slug} manca da pokemon.json`).toBeTruthy()

      const rif = dex[nomeNcp]
      expect(nostro.stats, `${slug}: statistiche diverse dal riferimento`)
        .toEqual(statsDaRiferimento(rif.bs))
      expect(nostro.weight, `${slug}: peso diverso dal riferimento`).toBe(rif.w)

      const tipiNostri = nostro.type.map(i => NOME_TIPO[i])
      const tipiRif = [rif.t1, rif.t2].filter(Boolean).map(t => t.toUpperCase())
      expect(tipiNostri, `${slug}: tipi diversi dal riferimento`).toEqual(tipiRif)
    })
  }

  it('le tre forme di Galar non sono copie della base', () => {
    // La cecità osservativa applicata ai dati: se avessi sbagliato a
    // trascrivere e copiato la riga della base, i test sopra passerebbero
    // comunque contro il riferimento sbagliato. Qui si guarda la differenza.
    expect(pokemonData['slowbro-galar'].stats).not.toEqual(pokemonData['slowbro'].stats)
    expect(pokemonData['slowking-galar'].stats).not.toEqual(pokemonData['slowking'].stats)
    expect(pokemonData['stunfisk-galar'].stats).not.toEqual(pokemonData['stunfisk'].stats)
    expect(pokemonData['floette-eternal'].stats).not.toEqual(pokemonData['floette'].stats)

    // E i tipi sono proprio quelli che cambiano il calcolo.
    expect(pokemonData['slowbro-galar'].type).toEqual([TYPES.POISON, TYPES.PSYCHIC])
    expect(pokemonData['stunfisk-galar'].type).toEqual([TYPES.GROUND, TYPES.STEEL])
  })
})

/**
 * `isStrumentoInamovibile` non è esportato, quindi qui si riproduce la sua
 * regola sui dati che legge. Non è un doppione della logica: è il contratto
 * fra `ITEM_EFFECTS` e il motore — quali slug una Megapietra riconosce — e
 * serve a bloccare il caso in cui qualcuno tolga `daForma` dai dati.
 */
function chiPuoTenere(itemKey, slug) {
  const eff = ITEM_EFFECTS[itemKey]
  const formaMega = eff?.megaStone
  if (!formaMega) return false
  if (eff.daForma) return eff.daForma === slug || formaMega === slug
  return formaMega === slug || formaMega.startsWith(`${slug}-mega`)
}

describe('quale forma può tenere la Megapietra', () => {
  it('la Floettite è del Fiore Eterno, non della Floette base', () => {
    expect(chiPuoTenere('floettite', 'floette-eternal')).toBe(true)
    expect(chiPuoTenere('floettite', 'floette-mega')).toBe(true)
    expect(
      chiPuoTenere('floettite', 'floette'),
      'la Floette base non può megaevolvere: solo il Fiore Eterno',
    ).toBe(false)
  })

  it('il riferimento è d\'accordo su chi porta alla Mega', () => {
    const dex = pokedexRiferimento()
    expect(dex['Floette-Eternal'].formes).toContain('Mega Floette')
    expect(dex['Floette'].formes, 'la base non dichiara nessuna forma Mega').toBeUndefined()
  })

  it('Slowbro di Galar non megaevolve, Slowbro normale sì', () => {
    expect(chiPuoTenere('slobronite', 'slowbro')).toBe(true)
    expect(chiPuoTenere('slobronite', 'slowbro-mega')).toBe(true)
    expect(
      chiPuoTenere('slobronite', 'slowbro-galar'),
      'la forma di Galar non ha una Mega',
    ).toBe(false)
  })

  it('l\'eccezione non ha rotto le altre ottantuno Megapietre', () => {
    // Il rischio di `daForma` è di svuotare la regola generale. Qui si
    // controlla che il prefisso valga ancora dove deve.
    expect(chiPuoTenere('garchompite', 'garchomp')).toBe(true)
    expect(chiPuoTenere('charizardite y', 'charizard')).toBe(true)
    expect(chiPuoTenere('charizardite y', 'charizard-mega-y')).toBe(true)
    expect(chiPuoTenere('garchompite', 'gholdengo')).toBe(false)

    const conEccezione = Object.entries(ITEM_EFFECTS)
      .filter(([, v]) => v.megaStone && v.daForma)
      .map(([k]) => k)
    expect(conEccezione, 'una sola eccezione prevista, la Floettite').toEqual(['floettite'])
  })
})
