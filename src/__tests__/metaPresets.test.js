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
import { STAGIONI, regDiStagione } from '../lib/reg.js'
import { specieDiStagione } from '../lib/regSpecie.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }
import itemsData from '../data/items.json' with { type: 'json' }
import movesData from '../data/moves.json' with { type: 'json' }
import { NATURES } from '../data/natures.js'
import { MAX_SP_PER_STAT, MAX_SP_TOTAL } from '../lib/rules.js'

const idStagioni = new Set(STAGIONI.map(s => s.id))

/** La stessa normalizzazione di `PresetSelect.jsx:264`, non una più debole. */
const normalizzaMossa = (m) => (m ? m.replace(/-/g, ' ') : null)

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

  /**
   * ─── I CAMPI CHE NESSUNO GUARDAVA ────────────────────────────────────────
   *
   * Fino a qui il file controllava specie, stagione ed etichette. Natura,
   * strumento, abilità e mosse no: erano quattro stringhe che nessuno
   * confrontava con niente.
   *
   * Misurato invece che supposto: messi quattro refusi in un solo set —
   * `matcha-gotchaXX`, `hospitalityXX`, `kasib berryXX`, `BoldXX` — la suite
   * passava, 2034 test verdi. Il difetto sarebbe arrivato all'utente come un
   * set che si sceglie e non fa niente.
   *
   * Conta adesso più di prima: i set di M-5 si scrivono a mano, uno per uno,
   * e ogni campo è un'occasione di refuso.
   *
   * Ogni controllo qui sotto confronta con il listino che l'APP legge davvero,
   * che non è sempre quello che sembra — le abilità stanno in `pokemon.json`
   * per specie, non in `abilities.json`, e le due usano perfino grafie diverse
   * (`swift-swim` contro `swift swim`).
   */
  it('ogni natura esiste', () => {
    const ignote = META_PRESETS
      .filter(p => !NATURES.includes(String(p.nature).toLowerCase()))
      .map(p => `${p.slug}/${p.label} → «${p.nature}»`)
    expect(ignote, 'natura inesistente: applicando il set non verrebbe impostata').toEqual([])
  })

  it('ogni strumento è scelto fra quelli del listino', () => {
    // `applyPreset` passa `preset.item` così com'è, senza normalizzarlo:
    // deve combaciare con una chiave di items.json alla lettera.
    const ignoti = META_PRESETS
      .filter(p => p.item && !itemsData[p.item])
      .map(p => `${p.slug}/${p.label} → «${p.item}»`)
    expect(ignoti, 'strumento che il listino non ha: nessuna icona e nessun effetto').toEqual([])
  })

  it('ogni abilità è una di quelle della SUA specie', () => {
    // Non «esiste un'abilità con questo nome», ma «questo Pokémon ce l'ha»:
    // è la tendina che l'utente vede, e viene da pokemon.json.
    const sbagliate = []
    for (const p of META_PRESETS) {
      if (!p.ability) continue
      const proprie = pokemonData[p.slug]?.abilities ?? []
      if (!proprie.includes(p.ability)) {
        sbagliate.push(`${p.slug}/${p.label} → «${p.ability}» (ha: ${proprie.join(', ') || 'nessuna'})`)
      }
    }
    expect(sbagliate, 'abilità che questa specie non può avere').toEqual([])
  })

  it('ogni mossa esiste, una volta normalizzata come fa l\'app', () => {
    const ignote = []
    for (const p of META_PRESETS) {
      for (const m of p.moves) {
        if (!movesData[normalizzaMossa(m)]) ignote.push(`${p.slug}/${p.label} → «${m}»`)
      }
    }
    expect(ignote, 'mossa che il listino non ha: lo slot resterebbe vuoto').toEqual([])
  })

  it('gli SP stanno dentro le regole del gioco', () => {
    const fuori = []
    for (const p of META_PRESETS) {
      const somma = p.sps.reduce((a, b) => a + (b || 0), 0)
      if (somma > MAX_SP_TOTAL) fuori.push(`${p.slug}/${p.label}: ${somma} SP su ${MAX_SP_TOTAL}`)
      p.sps.forEach((v, i) => {
        if (v < 0 || v > MAX_SP_PER_STAT) fuori.push(`${p.slug}/${p.label}: SP[${i}] = ${v}`)
      })
    }
    expect(fuori, 'set impossibile da costruire nel gioco').toEqual([])
  })

  it('controllo negativo: i listini sono stati caricati davvero', () => {
    // Senza, i cinque controlli sopra passerebbero su elenchi vuoti — cioè
    // rifiuterebbero tutto o accetterebbero tutto, a seconda del verso.
    expect(NATURES).toContain('adamant')
    expect(itemsData['sitrus berry']).toBeTruthy()
    expect(movesData[normalizzaMossa('fake-out')]).toBeTruthy()
    expect(pokemonData['incineroar'].abilities).toContain('intimidate')
    expect(MAX_SP_TOTAL).toBe(66)
  })

  it('l\'indice per slug contiene tutti i set, senza perderne', () => {
    const totale = Object.values(PRESETS_BY_SLUG).reduce((n, v) => n + v.length, 0)
    expect(totale).toBe(META_PRESETS.length)
  })
})
