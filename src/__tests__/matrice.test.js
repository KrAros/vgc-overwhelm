/**
 * src/__tests__/matrice.test.js
 *
 * Lo strato sopra il motore non si muove.
 *
 * ─── PERCHÉ NON BASTAVA snapshot.json ──────────────────────────────────────
 * I 584 casi di `snapshot.json` chiamano `calculateDamage` direttamente: non
 * attraversano né `DamageTable` né la scelta della mossa migliore. È l'errore
 * di criterio della sessione C, ed è ancora vero oggi. La sessione E
 * rifattorizza proprio quel codice, quindi i 584 casi resterebbero verdi
 * qualunque cosa si rompa lì sopra.
 *
 * `matrice.json` è la fotografia di quello strato, scattata a `0a9e6c7` da
 * una trascrizione di `DamageTable.jsx` (vedi `scripts/gen-matrice.mjs`).
 * Questo test dice che `costruisciMatrice` la riproduce identica.
 *
 * ─── SE DIVENTA ROSSO ──────────────────────────────────────────────────────
 * La domanda è "perché è cambiata questa cella", non "come lo faccio tornare
 * verde". Rigenerare la fixture è corretto solo dopo aver capito e voluto
 * ogni singola differenza.
 */

import { describe, it, expect } from 'vitest'

import { costruisciMatrice } from '../lib/matrice.js'
import { SQUADRA_1, SQUADRA_2, SCENARI, LIVELLO } from '../../scripts/matrice-casi.mjs'
import { serializzaCella } from '../../scripts/matrice-formato.mjs'
import fixture from './fixtures/matrice.json' with { type: 'json' }

describe('matrice — caratterizzazione', () => {
  it('la fixture copre tutti gli scenari dichiarati', () => {
    expect(fixture.scenari).toHaveLength(SCENARI.length)
    expect(fixture.scenari.map(s => s.nome)).toEqual(SCENARI.map(s => s.nome))
    expect(fixture.meta.celle).toBe(180)
  })

  for (const [i, scenario] of SCENARI.entries()) {
    describe(scenario.nome, () => {
      const attesa = fixture.scenari[i]
      const ottenuta = costruisciMatrice(SQUADRA_1, SQUADRA_2, scenario.campo, LIVELLO)

      for (let ri = 0; ri < SQUADRA_1.length; ri++) {
        for (let ci = 0; ci < SQUADRA_2.length; ci++) {
          const nome = `${SQUADRA_1[ri].key} vs ${SQUADRA_2[ci].key} (${ri},${ci})`
          it(nome, () => {
            expect(serializzaCella(ottenuta[ri][ci])).toEqual(attesa.celle[ri][ci])
          })
        }
      }
    })
  }
})

describe('matrice — struttura', () => {
  const campo = SCENARI[0].campo

  it('una cella con uno slot vuoto è null', () => {
    const conVuoto = [{ key: null, moves: [] }, SQUADRA_1[0]]
    const m = costruisciMatrice(conVuoto, [SQUADRA_2[0]], campo, LIVELLO)
    expect(m[0][0]).toBeNull()
    expect(m[1][0]).not.toBeNull()
  })

  it('le dimensioni seguono i due team, non un 6×6 fisso', () => {
    const m = costruisciMatrice(SQUADRA_1.slice(0, 2), SQUADRA_2.slice(0, 3), campo, LIVELLO)
    expect(m).toHaveLength(2)
    expect(m[0]).toHaveLength(3)
  })

  it('team vuoti non fanno esplodere niente', () => {
    expect(costruisciMatrice([], [], campo, LIVELLO)).toEqual([])
    expect(costruisciMatrice(undefined, undefined, campo, LIVELLO)).toEqual([])
  })

  it('l’etichetta di immunità appare solo se nessuna mossa fa danno', () => {
    const m = costruisciMatrice(SQUADRA_1, SQUADRA_2, campo, LIVELLO)
    for (const riga of m) {
      for (const cella of riga) {
        if (!cella) continue
        if (cella.migliore1) expect(cella.immune1).toBeNull()
        if (cella.migliore2) expect(cella.immune2).toBeNull()
      }
    }
  })
})
