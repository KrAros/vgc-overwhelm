/**
 * src/__tests__/metaPresets.test.js
 *
 * I set del meta e il loro legame con il registro delle reg.
 *
 * ─── DUE FONTI CHE SI CONTROLLANO A VICENDA ────────────────────────────────
 *
 * `metaPresets.js` è scritto a mano; `regChampions.json` è trascritto dagli
 * elenchi ufficiali. Niente li tiene allineati, quindi qui si guarda che ogni
 * set dichiari una stagione che esiste davvero e una specie che in quella
 * stagione si poteva usare. È lo stesso schema di `gapNoti` e dell'inventario
 * del motore: due elenchi nati in posti diversi, e un test che li confronta.
 *
 * ─── LA CHIAVE DI UN SET ───────────────────────────────────────────────────
 *
 * `PresetSelect.jsx` identifica un set meta per **etichetta**, e ci mette il
 * valore dentro l'`<option>`. Finché i set vengono tutti da una stagione la
 * cosa regge; con più stagioni lo stesso Incineroar avrà plausibilmente un
 * «Sitrus Support» in M-4 e uno in M-6, e `find` prenderebbe il primo
 * lasciando il secondo irraggiungibile — in silenzio, che è il modo peggiore.
 *
 * La chiave vera è `slug + stagione + etichetta`, e il test qui sotto la
 * presidia adesso, prima che il secondo set esista. Aggiungere il presidio
 * dopo la collisione avrebbe voluto dire scoprirla da un utente.
 */

import { describe, it, expect } from 'vitest'
import { META_PRESETS, PRESETS_BY_SLUG } from '../data/metaPresets.js'
import { STAGIONI, specieDiStagione, regDiStagione } from '../lib/reg.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }

const idStagioni = new Set(STAGIONI.map(s => s.id))

describe('set del meta', () => {
  it('ce ne sono, e ognuno ha i campi che servono', () => {
    // Controllo negativo: senza, ogni test sotto passerebbe su un elenco vuoto.
    expect(META_PRESETS.length).toBeGreaterThan(0)
    for (const p of META_PRESETS) {
      expect(p.slug, `set senza slug: ${p.label}`).toBeTruthy()
      expect(p.label, `set senza etichetta: ${p.slug}`).toBeTruthy()
      expect(Array.isArray(p.sps) && p.sps.length === 6, `${p.slug}: SP malformati`).toBe(true)
      expect(Array.isArray(p.moves) && p.moves.length > 0, `${p.slug}: senza mosse`).toBe(true)
    }
  })

  it('ogni set dichiara una stagione che esiste nel registro', () => {
    const ignote = META_PRESETS
      .filter(p => !idStagioni.has(p.stagione))
      .map(p => `${p.slug}/${p.label} → «${p.stagione}»`)
    expect(
      ignote,
      'stagione non dichiarata in regChampions.json: o è un refuso, o il registro va aggiornato',
    ).toEqual([])
  })

  it('ogni set è di una specie utilizzabile nella sua stagione', () => {
    // Il controllo che lega davvero le due fonti: un set di un Pokémon che in
    // quella reg non si poteva usare è un set che nessuno ha mai giocato.
    const fuori = []
    for (const p of META_PRESETS) {
      const legali = new Set(specieDiStagione(p.stagione))
      if (!legali.has(p.slug)) fuori.push(`${p.slug} (${p.label}) non è in ${regDiStagione(p.stagione)}`)
    }
    expect(fuori, 'set di specie non utilizzabili nella reg della loro stagione').toEqual([])
  })

  it('ogni specie citata esiste nell\'anagrafica', () => {
    const ignote = [...new Set(META_PRESETS.map(p => p.slug))].filter(s => !pokemonData[s])
    expect(ignote).toEqual([])
  })

  it('la chiave slug+stagione+etichetta è unica', () => {
    // Non l'etichetta da sola, che è ciò che oggi legge PresetSelect: due set
    // omonimi della stessa specie in stagioni diverse sono legittimi, due
    // nella STESSA stagione no — il secondo sarebbe irraggiungibile.
    const viste = new Map()
    const collisioni = []
    for (const p of META_PRESETS) {
      const k = `${p.slug}|${p.stagione}|${p.label}`
      if (viste.has(k)) collisioni.push(k)
      viste.set(k, true)
    }
    expect(collisioni, 'due set con la stessa chiave: il secondo non si può scegliere').toEqual([])
  })

  it('dentro una stessa specie e stagione le etichette non si ripetono', () => {
    // La forma che il difetto prenderebbe nella tendina, dove i set sono
    // già filtrati per specie.
    const collisioni = []
    for (const [slug, set] of Object.entries(PRESETS_BY_SLUG)) {
      const perStagione = {}
      for (const p of set) {
        const k = `${p.stagione}|${p.label}`
        if (perStagione[k]) collisioni.push(`${slug}: «${p.label}» due volte in ${p.stagione}`)
        perStagione[k] = true
      }
    }
    expect(collisioni).toEqual([])
  })

  it('l\'indice per slug contiene tutti i set, senza perderne', () => {
    const totale = Object.values(PRESETS_BY_SLUG).reduce((n, v) => n + v.length, 0)
    expect(totale).toBe(META_PRESETS.length)
  })
})
