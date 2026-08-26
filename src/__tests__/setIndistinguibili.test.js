/**
 * src/__tests__/setIndistinguibili.test.js
 *
 * Due set della stessa specie che la regola larga non sa separare, e quale dei
 * due la tendina dice di aver selezionato.
 *
 * ─── LA REGOLA LARGA ───────────────────────────────────────────────────────
 *
 * `PresetSelect` deriva la voce selezionata confrontando strumento, abilità e
 * natura — non gli SP, non le mosse. È voluto: una squadra costruita a mano
 * con SP propri deve continuare a riconoscersi nel set meta da cui parte,
 * altrimenti la tendina direbbe «nessuno» a chiunque cambi un punto.
 *
 * Il prezzo è che due set possono combaciare entrambi. Allora `find`
 * restituisce il primo, e la tendina mostra un'etichetta che mente su cosa c'è
 * nello slot.
 *
 * ─── IL CASO NON E' ARRIVATO QUANDO CREDEVO ────────────────────────────────
 *
 * `metaPresets.test.js` aveva previsto questa collisione come una conseguenza
 * FUTURA di avere più periodi: «lo stesso Incineroar avrà plausibilmente un
 * Sitrus Support in M-4 e uno in M-6». Quando è arrivato il secondo
 * Incineroar è sembrata la conferma della profezia.
 *
 * Non lo era. La collisione c'era già, dentro M-4 sola, su Archaludon: «Rain /
 * Screen» e «Rain Special Attacker» hanno lo stesso strumento (Leftovers), la
 * stessa abilità (Stamina), la stessa natura (Modest) e perfino le stesse
 * quattro mosse. Cambiano solo negli SP. Scegliendo il secondo, la tendina ha
 * sempre mostrato il primo — da mesi, senza che nessuno guardasse.
 *
 * La previsione era giusta nel meccanismo e sbagliata nella causa: non serviva
 * un secondo periodo, bastava una specie con due set. Ed è il motivo per cui
 * questo file non è sparito quando il modello è passato dalle stagioni alle
 * reg: il difetto non dipendeva da quelle.
 *
 * ─── PERCHE' SI PROVA LA FUNZIONE E NON IL COMPONENTE ──────────────────────
 *
 * Perché il difetto vive tutto dentro la scelta fra candidati, e provarlo dal
 * componente vorrebbe dire ricostruire il negozio, il filtro e
 * `renderToString` con il vincolo che `filtroReg.test.jsx` documenta — tanta
 * impalcatura attorno a una funzione pura. Il filtro ha già il suo test lì;
 * qui si prova cosa succede DOPO il filtro.
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

/** Coppie della stessa specie che la regola larga NON separa. */
function coppieAmbigue() {
  const coppie = []
  for (const [slug, set] of Object.entries(PRESETS_BY_SLUG)) {
    for (let i = 0; i < set.length; i++) {
      for (let j = i + 1; j < set.length; j++) {
        const a = set[i], b = set[j]
        if (a.item === b.item && a.ability === b.ability &&
            a.nature.toLowerCase() === b.nature.toLowerCase()) coppie.push([slug, a, b])
      }
    }
  }
  return coppie
}

describe('set che la regola larga non separa', () => {
  it('il caso esiste davvero nei dati committati', () => {
    // Controllo negativo. Senza, i test sotto passerebbero per assenza del
    // caso invece che per correttezza — e nessuno saprebbe che il presidio è
    // diventato muto.
    const coppie = coppieAmbigue()
    expect(
      coppie.length,
      'nessuna coppia ambigua: questo file non prova più niente. '
      + 'Se è voluto, va tolto invece che lasciato verde.',
    ).toBeGreaterThan(0)

    // E devono essere davvero distinguibili da qualcosa, altrimenti nemmeno
    // il raffinamento potrebbe farcela.
    for (const [slug, a, b] of coppie) {
      const stessiSP = JSON.stringify(a.sps) === JSON.stringify(b.sps)
      const stesseMosse = JSON.stringify([...a.moves].sort()) === JSON.stringify([...b.moves].sort())
      expect(
        stessiSP && stesseMosse,
        `${slug}: «${a.label}» e «${b.label}» sono identici in tutto: nessuna tendina può separarli`,
      ).toBe(false)
    }
  })

  it('ogni set riconosce SE STESSO, anche fra omonimi ambigui', () => {
    // Il difetto in forma diretta: qui prima usciva sempre il primo dei due.
    for (const [slug, set] of Object.entries(PRESETS_BY_SLUG)) {
      for (const p of set) {
        const scelto = scegliCorrispondente(set, slotDa(p))
        expect(
          `${scelto?.label}`,
          `${slug}: applicando «${p.label}» la tendina ne mostra un altro`,
        ).toBe(p.label)
      }
    }
  })

  it('la regola larga sopravvive: uno slot fatto a mano si riconosce lo stesso', () => {
    // Il motivo per cui il confronto non è stato semplicemente stretto: chi
    // costruisce la squadra a mano con SP suoi deve continuare a vedere il set
    // riconosciuto, altrimenti la tendina direbbe «nessuno» a chiunque cambi
    // un SP.
    const [slug, a] = coppieAmbigue()[0]
    const aMano = { ...slotDa(a), sps: [10, 0, 10, 0, 10, 10] }
    expect(scegliCorrispondente(PRESETS_BY_SLUG[slug], aMano), 'nessuna corrispondenza larga')
      .toBeTruthy()
  })

  it('l\'ordine delle mosse non conta', () => {
    const [slug, a] = coppieAmbigue()[0]
    const rimescolato = { ...slotDa(a), moves: [...slotDa(a).moves].reverse() }
    const scelto = scegliCorrispondente(PRESETS_BY_SLUG[slug], rimescolato)
    expect(scelto?.label, 'spostare una mossa perde il riconoscimento').toBe(a.label)
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

  it('nessuna coppia è identica in tutto', () => {
    // Il presidio in avanti: due set che coincidono su strumento, abilità,
    // natura, SP E mosse sarebbero davvero indistinguibili, e la tendina non
    // potrebbe più scegliere. È il duplicato vero, e va tolto dai dati.
    const gemelli = []
    for (const [slug, a, b] of coppieAmbigue()) {
      if (JSON.stringify(a.sps) === JSON.stringify(b.sps) &&
          JSON.stringify([...a.moves].sort()) === JSON.stringify([...b.moves].sort())) {
        gemelli.push(`${slug}: «${a.label}» ≡ «${b.label}»`)
      }
    }
    expect(gemelli, 'due set identici in tutto: la tendina non può distinguerli').toEqual([])
  })

  it('controllo negativo: i set sono stati caricati', () => {
    expect(META_PRESETS.length).toBeGreaterThan(20)
  })
})
