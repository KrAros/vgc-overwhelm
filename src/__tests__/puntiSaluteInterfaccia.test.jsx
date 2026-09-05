// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/puntiSaluteInterfaccia.test.jsx
 *
 * I punti salute correnti: dal numero nell'editor fino al danno.
 *
 * ─── COSA SORVEGLIA, IN UNA RIGA ───────────────────────────────────────────
 *
 * Che il numero che si vede sia lo stesso che il motore usa. Il motore sapeva
 * leggere i punti salute da tre sessioni — Eruption, Multiscale, Crush Grip —
 * ma non c'era nessun modo di dirglieli: l'interfaccia mandava sempre `null`,
 * e il numero se lo ricavava dalle due levette. Il difetto non era un calcolo
 * sbagliato, era un calcolo irraggiungibile: lo stesso di Stakeout e Slow
 * Start in `levette.test.js`.
 *
 * ─── PERCHÉ LA CATENA E NON I PEZZI ────────────────────────────────────────
 *
 * Perché i pezzi funzionavano già. `psDaLevetta` era verde, `potenzaDaPsAttaccante`
 * era verde, e Eruption mostrava lo stesso numero a vita piena e a metà.
 * Quello che nessuno guardava era l'anello fra lo store e `buildAttackerInput`.
 * Il caso end-to-end qui sotto tira tutta la catena e guarda il danno.
 *
 * ─── NIENTE jsdom ──────────────────────────────────────────────────────────
 *
 * Si rende in SSR e si guarda il markup, come `segnalinoMossa.test.jsx`. Si
 * verifica COSA si vede e con che nome accessibile, non cosa succede al
 * trascinamento — quello lo porta l'`input[type=range]` nativo, che non è
 * codice di questo progetto.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { caricaLingua } from '../i18n.js'
import BarraPS from '../components/editor/BarraPS.jsx'
import { SegnoPS } from '../components/DamageTable.jsx'
import {
  psMassimi, psCorrenti, colorePS, VERDE, GIALLO, ROSSO,
} from '../lib/psSlot.js'
import { buildAttackerInput, buildDefenderInput } from '../lib/battleState.js'
import { costruisciMatrice } from '../lib/matrice.js'
import useCalcStore, { emptyPokemon } from '../store/useCalcStore.js'
import { calcStat } from '../lib/stats.js'
import { STAT_HP } from '../lib/rules.js'
import pokemonData from '../data/pokemon.json' with { type: 'json' }

beforeAll(() => caricaLingua('it'))

const slot = (extra = {}) => ({ ...emptyPokemon(), ...extra })

// ─── 1. Il massimo ───────────────────────────────────────────────────────────

describe('psMassimi', () => {
  it('è la stessa statistica che l\'editor mostra nella riga HP', () => {
    // Il valore non è scritto a mano qui: è `calcStat`, cioè la funzione che
    // `StatRow` usa per la stessa riga. Scriverne uno a mano vorrebbe dire
    // avere due formule per lo stesso numero — che è il difetto che questo
    // file è venuto a chiudere, in un'altra forma.
    const s = slot({ key: 'garchomp', sps: [32, 0, 0, 0, 0, 0] })
    expect(psMassimi(s, 50))
      .toBe(calcStat(pokemonData.garchomp.stats[STAT_HP], 32, 50, null, STAT_HP))
    // Il presupposto: se fosse zero, l'uguaglianza qui sopra sarebbe vera e
    // vuota.
    expect(psMassimi(s, 50)).toBeGreaterThan(150)
  })

  it('senza Pokémon è zero, e non esplode', () => {
    for (const vuoto of [null, undefined, {}, { key: 'non-esiste' }]) {
      expect(psMassimi(vuoto)).toBe(0)
    }
  })

  it('gli SP lo alzano', () => {
    const senza = psMassimi(slot({ key: 'garchomp' }))
    const con   = psMassimi(slot({ key: 'garchomp', sps: [32, 0, 0, 0, 0, 0] }))
    expect(con).toBeGreaterThan(senza)
  })
})

// ─── 2. I correnti, e la traduzione delle vecchie levette ────────────────────

describe('psCorrenti', () => {
  const base = slot({ key: 'garchomp' })
  const max  = psMassimi(base)

  it('senza niente sono pieni', () => {
    expect(psCorrenti(base, max)).toBe(max)
  })

  it('il numero vince, e sta dentro i limiti', () => {
    expect(psCorrenti({ ...base, ps: 90 },   max)).toBe(90)
    expect(psCorrenti({ ...base, ps: 9999 }, max)).toBe(max)
    expect(psCorrenti({ ...base, ps: 0 },    max)).toBe(1)
    expect(psCorrenti({ ...base, ps: -5 },   max)).toBe(1)
  })

  it('una squadra salvata con «Multiscale spento» si apre a uno in meno del massimo', () => {
    // È la traduzione che l'harness fa da sempre per interrogare il
    // riferimento, e che il motore usa in `psDaLevetta`. Senza questo ramo un
    // link vecchio si aprirebbe mostrando vita piena e calcolando altro.
    const vecchio = { ...base, abilityFlags: { multiscaleActive: false } }
    expect(psCorrenti(vecchio, max)).toBe(max - 1)
  })

  it('una salvata con la levetta di Blaze si apre a un terzo', () => {
    const vecchio = {
      ...base, ability: 'Blaze', abilityFlags: { interruttore: true },
    }
    expect(psCorrenti(vecchio, max)).toBe(Math.floor(max / 3))
  })

  it('ma la stessa levetta su Protean NON tocca i punti salute', () => {
    // `interruttore` è una levetta sola per tredici abilità, e per otto di
    // esse non parla di punti salute. Tradurla sempre vorrebbe dire ferire un
    // Pokémon perché ha Protean.
    const protean = {
      ...base, ability: 'Protean', abilityFlags: { interruttore: true },
    }
    expect(psCorrenti(protean, max)).toBe(max)
  })

  it('il numero, se c\'è, vince sulla levetta', () => {
    const misto = {
      ...base, ps: 100, abilityFlags: { multiscaleActive: false },
    }
    expect(psCorrenti(misto, max)).toBe(100)
  })
})

// ─── 3. Il semaforo ──────────────────────────────────────────────────────────

describe('colorePS — le tre soglie di Simone', () => {
  // Le soglie sono sulla FRAZIONE, quindi si prova su un massimo che le rende
  // esatte: 100. Sui bordi, perché è lì che un `>` diventato `>=` si vede.
  it.each([
    [100, VERDE,  'pieni'],
    [ 51, VERDE,  'appena sopra la metà'],
    [ 50, GIALLO, 'esattamente la metà — il verde finisce SOPRA il 50%'],
    [ 21, GIALLO, 'appena sopra un quinto'],
    [ 20, ROSSO,  'esattamente un quinto — il giallo finisce SOPRA il 20%'],
    [  1, ROSSO,  'quasi morto'],
  ])('%i/100 → %s (%s)', (ps, atteso) => {
    expect(colorePS(ps, 100)).toBe(atteso)
  })

  it('i tre colori sono quelli che ha scelto Simone', () => {
    // Scritti qui perché siano falsificabili: se qualcuno cambia la costante,
    // questa riga lo dice invece di lasciar passare un verde diverso.
    expect([VERDE, GIALLO, ROSSO]).toEqual(['#70C8A0', '#FFFF00', '#FF0000'])
  })
})

// ─── 4. La barra ─────────────────────────────────────────────────────────────

describe('BarraPS', () => {
  const rendi = (props) => renderToStaticMarkup(<BarraPS onChange={() => {}} {...props} />)

  it('senza Pokémon non disegna niente', () => {
    expect(rendi({ ps: 0, psMax: 0 })).toBe('')
  })

  it('mostra il valore e il massimo', () => {
    const html = rendi({ ps: 131, psMax: 175 })
    expect(html).toContain('value="131"')
    expect(html).toContain('/ 175')
  })

  it('la percentuale compare solo sotto il massimo', () => {
    expect(rendi({ ps: 175, psMax: 175 })).not.toContain('%<')
    expect(rendi({ ps: 131, psMax: 175 })).toContain('75%')
  })

  it('il riempimento è la frazione, e il colore il semaforo', () => {
    expect(rendi({ ps: 175, psMax: 175 })).toContain('width:100%')
    const meta = rendi({ ps: 87, psMax: 175 })
    expect(meta).toContain('width:50%')
    // 87/175 è il 49,7%: sotto la metà, quindi giallo.
    expect(meta.toLowerCase()).toContain('#ffff00')
  })

  it('i due controlli hanno un nome accessibile, e sono due diversi', () => {
    // Trentasei cursori identici sono il difetto che `StatRow` ha già avuto.
    const html = rendi({ ps: 131, psMax: 175 })
    const nomi = [...html.matchAll(/aria-label="([^"]+)"/g)].map(m => m[1])
    expect(nomi).toHaveLength(2)
    expect(new Set(nomi).size).toBe(2)
    for (const n of nomi) expect(n).not.toMatch(/^aria\./)
  })

  it('tutt\'e due i controlli coprono l\'intervallo utile, da 1 al massimo', () => {
    // Zero non è un valore legale: un Pokémon a zero punti salute è KO, e la
    // matrice non calcola i danni di un KO.
    //
    // Si guardano i due `input` SEPARATAMENTE, e non il markup intero: la
    // prima stesura cercava `min="1"` in tutta la pagina, e la trovava nella
    // casella anche quando il cursore era stato messo a zero. Provato — la
    // mutazione restava verde.
    const html = rendi({ ps: 131, psMax: 175 })
    const tag = [...html.matchAll(/<input[^>]*>/g)].map(m => m[0])
    expect(tag).toHaveLength(2)
    for (const t of tag) {
      expect(t, t).toContain('min="1"')
      expect(t, t).toContain('max="175"')
    }
  })
})

// ─── 5. La catena intera ─────────────────────────────────────────────────────

describe('dal numero nello slot fino al danno', () => {
  it('`buildAttackerInput` e `buildDefenderInput` portano il numero', () => {
    const ferito = slot({ key: 'garchomp', ps: 90 })
    expect(buildAttackerInput(ferito).atkPS).toBe(90)
    expect(buildDefenderInput(ferito).defPS).toBe(90)
  })

  it('e `null` quando è pieno, così le levette vecchie funzionano ancora', () => {
    const pieno = slot({ key: 'garchomp' })
    expect(buildAttackerInput(pieno).atkPS).toBeNull()
    expect(buildDefenderInput(pieno).defPS).toBeNull()
  })

  it('Eruption a metà vita fa meno danno — è l\'anello che mancava', () => {
    // La domanda da cui è partita tutta la sessione: «quanto fa Eruption con
    // questo Pokémon a metà?». Prima di oggi la risposta era sempre la stessa
    // del pieno, perché il numero non arrivava mai al motore.
    const attaccante = (ps) => slot({ key: 'torkoal', moves: ['eruption'], ps })
    const difensore  = slot({ key: 'amoonguss' })

    const danno = (ps) => {
      const m = costruisciMatrice([attaccante(ps)], [difensore], {})
      return m[0][0].migliore1.result.maxDmg
    }

    const pieno = danno(null)
    const max   = psMassimi(attaccante(null))
    const meta  = danno(Math.floor(max / 2))

    expect(pieno).toBeGreaterThan(0)
    expect(meta).toBeLessThan(pieno)
    // Non è «un po' meno»: la potenza di Eruption è proporzionale ai punti
    // salute, quindi a metà è circa metà. Il confronto largo è voluto — il
    // numero esatto lo presidia `potenzaDaiPuntiSalute.test.js` contro
    // l'oracolo, e ripeterlo qui vorrebbe dire due fonti per lo stesso fatto.
    expect(meta).toBeLessThan(pieno * 0.6)
  })

  it('Multiscale si spegne muovendo la barra, senza toccare nessuna levetta', () => {
    // Non Terremoto: Dragonite è Volante, e il danno sarebbe zero in tutt'e
    // due i casi — un confronto vero fra due numeri che non esistono. È lo
    // stesso inciampo di `mosseDaiPuntiSalute.test.js`, ed è la ragione per
    // cui questo test guarda anche che il danno pieno sia maggiore di zero.
    const attaccante = slot({ key: 'garchomp', moves: ['rock slide'] })
    const difensore  = (ps) => slot({ key: 'dragonite', ability: 'Multiscale', ps })

    const danno = (ps) => {
      const m = costruisciMatrice([attaccante], [difensore(ps)], {})
      return m[0][0].migliore1.result.maxDmg
    }

    const psMax = psMassimi(difensore(null))
    expect(danno(null)).toBeGreaterThan(0)
    expect(danno(psMax - 1)).toBeGreaterThan(danno(null))
  })
})

// ─── 6. Il segno nell'intestazione della matrice ─────────────────────────────

describe('SegnoPS — il promemoria nella griglia', () => {
  const rendi = (s) => renderToStaticMarkup(<SegnoPS slot={s} />)

  it('a vita piena non c\'è', () => {
    // Se ci fosse sempre, sarebbe rumore su dodici intestazioni su dodici.
    expect(rendi(slot({ key: 'garchomp' }))).toBe('')
  })

  it('sotto il massimo dice la percentuale, col colore della barra', () => {
    // Il motivo per cui esiste: la barra sta nell'editor, che mostra UN
    // Pokémon alla volta. Un Pokémon messo al 50% e poi dimenticato cambia il
    // significato di tutta la sua riga e di tutta la sua colonna, in silenzio.
    // Garchomp senza SP ha 183 punti salute: 150 sono l'82%, quindi verde.
    // (Al primo giro avevo scritto 90 aspettandomi il verde: 90/183 è il 49%,
    // cioè giallo. Il test l'ha detto, e il numero corretto è questo.)
    const html = rendi(slot({ key: 'garchomp', ps: 150 }))
    expect(html).toContain('82%')
    expect(html.toLowerCase()).toContain('#70c8a0')
    // Il numero esatto nel `title`: la percentuale arrotondata non basta a
    // rileggere quanto si era messo.
    expect(html).toMatch(/title="150 \/ 183"/)

    // E il semaforo cambia davvero, sullo stesso Pokémon.
    expect(rendi(slot({ key: 'garchomp', ps: 90 })).toLowerCase()).toContain('#ffff00')
    expect(rendi(slot({ key: 'garchomp', ps: 30 })).toLowerCase()).toContain('#ff0000')
  })

  it('senza Pokémon non c\'è, e non esplode', () => {
    for (const vuoto of [null, undefined, {}, slot()]) {
      expect(rendi(vuoto)).toBe('')
    }
  })

  it('una squadra vecchia con «Multiscale spento» si vede anche qui', () => {
    // La levetta è sparita dall'interfaccia, quindi se il segno non traducesse
    // anche lei un link vecchio calcolerebbe un danno diverso da quello che
    // mostra, senza niente che lo dica.
    const html = rendi(slot({ key: 'garchomp', abilityFlags: { multiscaleActive: false } }))
    expect(html).toContain('99%')
  })
})

// ─── 7. Lo store: il numero spegne le levette che dicevano lo stesso ─────────

describe('setPS', () => {
  const conSlot = (patch) => {
    useCalcStore.setState({
      team1: Array.from({ length: 6 }, () => emptyPokemon()),
    })
    const t = [...useCalcStore.getState().team1]
    t[0] = { ...t[0], ...patch }
    useCalcStore.setState({ team1: t })
  }
  const primo = () => useCalcStore.getState().team1[0]

  it('scrive il numero, e `null` rimette a vita piena', () => {
    conSlot({ key: 'garchomp' })
    useCalcStore.getState().setPS('team1', 0, 90)
    expect(primo().ps).toBe(90)
    useCalcStore.getState().setPS('team1', 0, null)
    expect(primo().ps).toBeNull()
  })

  it('rimette `multiscaleActive` al default: non significava altro che «a vita piena»', () => {
    // Lasciarla accesa vorrebbe dire tenersi in memoria una seconda
    // affermazione sullo stesso fatto, che il link poi porterebbe in giro.
    conSlot({ key: 'dragonite', ability: 'Multiscale', abilityFlags: { multiscaleActive: false } })
    useCalcStore.getState().setPS('team1', 0, 100)
    expect(primo().abilityFlags.multiscaleActive).toBe(true)
  })

  it('spegne l\'interruttore SOLO se l\'abilità è una delle cinque a vita bassa', () => {
    conSlot({ key: 'charizard', ability: 'Blaze', abilityFlags: { interruttore: true } })
    useCalcStore.getState().setPS('team1', 0, 50)
    expect(primo().abilityFlags.interruttore).toBe(false)

    // Su Protean lo stesso interruttore vuol dire un'altra cosa — «ha già
    // cambiato tipo» — e spegnerlo qui sarebbe un danno, non una pulizia.
    conSlot({ key: 'greninja', ability: 'Protean', abilityFlags: { interruttore: true } })
    useCalcStore.getState().setPS('team1', 0, 50)
    expect(primo().abilityFlags.interruttore).toBe(true)
  })

  it('non scende sotto 1: un Pokémon a zero è KO, e la matrice non lo calcola', () => {
    conSlot({ key: 'garchomp' })
    useCalcStore.getState().setPS('team1', 0, 0)
    expect(primo().ps).toBe(1)
  })
})
