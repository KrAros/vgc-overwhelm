/**
 * src/__tests__/setOmonimi.test.js
 *
 * Due set con lo stesso nome in stagioni diverse, e quale dei due la tendina
 * dice di aver selezionato.
 *
 * ─── LA COLLISIONE PREVISTA, ARRIVATA IN UNA TERZA FORMA ───────────────────
 *
 * `metaPresets.test.js` l'aveva scritta prima che esistesse: «lo stesso
 * Incineroar avrà plausibilmente un Sitrus Support in M-4 e uno in M-6, e
 * `find` prenderebbe il primo lasciando il secondo irraggiungibile». La
 * risposta fu mettere la stagione nella chiave dell'`<option>`.
 *
 * Quella chiusura era giusta e insufficiente. Rendeva unica la CHIAVE — i due
 * set si possono entrambi scegliere — ma non la RICERCA che decide quale
 * risulta scelto, che continuava a guardare solo strumento, abilità e natura.
 *
 * Col primo set di M-5 la cosa è diventata misurabile: Incineroar «Sitrus
 * Support» esiste in M-4 (SP 24/8) e in M-5 (SP 21/11) con lo stesso
 * strumento, la stessa abilità e la stessa natura. Guardando «tutte le
 * stagioni», applicare il set di M-5 mostrava selezionato quello di M-4 —
 * un'etichetta che mente su cosa c'è nello slot.
 *
 * ─── PERCHE' SI PROVA LA FUNZIONE E NON IL COMPONENTE ──────────────────────
 *
 * Perché il difetto vive tutto dentro la scelta fra candidati, e provarlo dal
 * componente vorrebbe dire ricostruire il negozio, il filtro di stagione e
 * `renderToString` con il vincolo che `filtroStagione.test.jsx` documenta —
 * tanta impalcatura attorno a una funzione pura. Il filtro per stagione ha già
 * il suo test lì; qui si prova cosa succede DOPO il filtro.
 */

import { describe, it, expect } from 'vitest'
import { PRESETS_BY_SLUG, META_PRESETS } from '../data/metaPresets.js'
import { scegliCorrispondente } from '../lib/scegliPreset.js'

/** Lo slot come resta dopo che `applyPreset` ha scritto quel set. */
const slotDa = (p) => ({
  item: p.item,
  ability: p.ability,
  nature: p.nature.toLowerCase(),
  sps: p.sps,
  moves: p.moves.map(m => m.replace(/-/g, ' ')),
})

describe('due set omonimi in stagioni diverse', () => {
  const incineroar = PRESETS_BY_SLUG['incineroar'] ?? []

  it('il caso esiste davvero: due set indistinguibili con la regola larga', () => {
    // Controllo negativo. Senza, i test sotto passerebbero per assenza del
    // caso invece che per correttezza — e il giorno che i due set divergessero
    // su strumento o natura nessuno saprebbe che il presidio è diventato muto.
    const omonimi = incineroar.filter(p => p.label === 'Sitrus Support')
    expect(omonimi.length, 'servono due Sitrus Support per provare la collisione').toBe(2)
    expect(new Set(omonimi.map(p => p.stagione)).size, 'devono essere di stagioni diverse').toBe(2)

    const [a, b] = omonimi
    expect(a.item).toBe(b.item)
    expect(a.ability).toBe(b.ability)
    expect(a.nature).toBe(b.nature)
    expect(a.sps, 'se gli SP coincidessero i due set sarebbero identici').not.toEqual(b.sps)
  })

  it('con tutte le stagioni, ogni set riconosce SE STESSO', () => {
    // Il difetto in forma diretta: qui prima usciva sempre il primo dei due.
    for (const p of incineroar) {
      const scelto = scegliCorrispondente(incineroar, slotDa(p))
      expect(
        `${scelto?.label}/${scelto?.stagione}`,
        `applicando il set di ${p.stagione} la tendina ne mostra un altro`,
      ).toBe(`${p.label}/${p.stagione}`)
    }
  })

  it('la regola larga sopravvive: uno slot fatto a mano si riconosce lo stesso', () => {
    // Il motivo per cui il confronto non è stato semplicemente stretto: chi
    // costruisce la squadra a mano con SP suoi deve continuare a vedere il set
    // riconosciuto, altrimenti la tendina direbbe «nessuno» a chiunque cambi
    // un SP.
    const m5 = incineroar.find(p => p.stagione === 'M-5')
    const aMano = { ...slotDa(m5), sps: [10, 0, 10, 0, 10, 10] }
    expect(scegliCorrispondente(incineroar, aMano), 'nessuna corrispondenza larga').toBeTruthy()
  })

  it('l\'ordine delle mosse non conta', () => {
    const m5 = incineroar.find(p => p.stagione === 'M-5')
    const rimescolato = { ...slotDa(m5), moves: [...slotDa(m5).moves].reverse() }
    const scelto = scegliCorrispondente(incineroar, rimescolato)
    expect(scelto?.stagione, 'spostare una mossa perde il riconoscimento').toBe('M-5')
  })

  it('un solo candidato non paga nessun raffinamento', () => {
    // Il caso normale, che è la stragrande maggioranza: una specie con un set
    // solo deve continuare a funzionare come sempre, SP diversi compresi.
    const soli = Object.values(PRESETS_BY_SLUG).filter(v => v.length === 1)
    expect(soli.length, 'nessuna specie con un set solo?').toBeGreaterThan(0)
    for (const [p] of soli) {
      const aMano = { ...slotDa(p), sps: [1, 1, 1, 1, 1, 1], moves: ['protect'] }
      expect(scegliCorrispondente([p], aMano), `${p.slug} non si riconosce più`).toBe(p)
    }
  })

  it('nessuno slug ha due set che collidono senza essere distinguibili', () => {
    // Il presidio in avanti: se un domani due set della stessa specie
    // coincidessero su strumento, abilità, natura, SP E mosse, sarebbero
    // davvero indistinguibili e la tendina non potrebbe piu scegliere.
    const gemelli = []
    for (const [slug, set] of Object.entries(PRESETS_BY_SLUG)) {
      for (let i = 0; i < set.length; i++) {
        for (let j = i + 1; j < set.length; j++) {
          const a = set[i], b = set[j]
          const stessi = a.item === b.item && a.ability === b.ability &&
            a.nature.toLowerCase() === b.nature.toLowerCase() &&
            JSON.stringify(a.sps) === JSON.stringify(b.sps) &&
            JSON.stringify([...a.moves].sort()) === JSON.stringify([...b.moves].sort())
          if (stessi) gemelli.push(`${slug}: «${a.label}»/${a.stagione} ≡ «${b.label}»/${b.stagione}`)
        }
      }
    }
    expect(gemelli, 'due set identici in tutto: la tendina non puo distinguerli').toEqual([])
  })

  it('controllo negativo: i set sono stati caricati', () => {
    expect(META_PRESETS.length).toBeGreaterThan(20)
    expect(incineroar.length).toBeGreaterThan(1)
  })
})
