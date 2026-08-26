/**
 * src/__tests__/ordineCorretto.test.js
 *
 * Che le correzioni fatte a OCCHIO non si stacchino dalla tabella che
 * governano.
 *
 * ─── PERCHE' SERVE ─────────────────────────────────────────────────────────
 *
 * `formeSprite.json` nasce da un generatore, ma undici delle sue voci NON sono
 * generate: sono state decise guardando le immagini, perche' l'indice di forma
 * non e' verificabile chiedendo al server — l'URL esiste comunque, e' solo la
 * forma sbagliata. Quelle undici vivono in `ORDINE_CORRETTO`, dentro
 * `scripts/ordine-forme.mjs`, e sono l'unica cosa che impedisce a una
 * rigenerazione di riportarle alla posizione.
 *
 * Il difetto che questo test chiude e' che i due file si modificano da soli.
 * Chi corregge la tabella a mano — come e' successo per il Fiore Eterno e per
 * Slowbro di Galar — puo' benissimo dimenticare il fissaggio; e chi cambia il
 * fissaggio puo' dimenticare la tabella. Nei due casi il repository resta
 * verde e sembra a posto. Il danno appare la volta dopo, quando qualcuno lancia
 * `forme:gen` e le correzioni spariscono — cioe' nel momento esatto in cui il
 * fissaggio doveva proteggerle.
 *
 * E' il seguito diretto della lezione di Floette: una scelta fatta a occhio
 * resta un'ipotesi finche' qualcosa non la incrocia.
 */

import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { ORDINE_CORRETTO } from '../../scripts/ordine-forme.mjs'
import formeSprite from '../data/formeSprite.json' with { type: 'json' }
import pokemon from '../data/pokemon.json' with { type: 'json' }

/** La posizione dentro il gruppo che condivide il numero di Pokédex. */
function posizionale(chiave) {
  const numeroDi = (k) => {
    const d = pokemon[k]
    if (!d) return null
    let n = d.num
    if (!n) {
      const base = k.replace(/-mega.*$/, '').replace(/-primal$/, '').replace(/-unbound$/, '')
      n = pokemon[base]?.num || ''
    }
    return n?.replace('#', '').padStart(4, '0') || null
  }
  const mio = numeroDi(chiave)
  if (!mio) return null
  const gruppo = Object.keys(pokemon).filter(k => numeroDi(k) === mio)
  const i = gruppo.indexOf(chiave)
  return i < 0 ? null : `f${String(i).padStart(2, '0')}`
}

describe('le correzioni a occhio e la tabella dicono la stessa cosa', () => {
  it('ogni voce fissata combacia con `formeSprite.json`', () => {
    const scollate = []
    for (const [chiave, forma] of Object.entries(ORDINE_CORRETTO)) {
      const inTabella = formeSprite.forme[chiave]
      if (inTabella !== forma) scollate.push(`${chiave}: fissata ${forma} ≠ tabella ${inTabella}`)
    }
    expect(scollate, 'una rigenerazione sposterebbe queste voci').toEqual([])
  })

  it('ogni voce fissata esiste davvero nel listino', () => {
    // Un fissaggio su una chiave che non c'e' piu' non protegge niente e non
    // fallisce mai: e' commento travestito da codice.
    const fantasmi = Object.keys(ORDINE_CORRETTO).filter(k => !(k in pokemon))
    expect(fantasmi, 'chiavi fissate che il listino non ha').toEqual([])
  })

  it('nessuna voce e\' fissata su un valore che la posizione darebbe da sola', () => {
    // Se il fissaggio ripete la posizione non aggiunge nulla, ma soprattutto
    // NASCONDE il fatto che la regola posizionale e' cambiata sotto: qualcuno
    // ha inserito o tolto una forma nel gruppo e il fissaggio ha assorbito lo
    // spostamento in silenzio.
    const inutili = []
    for (const [chiave, forma] of Object.entries(ORDINE_CORRETTO)) {
      if (posizionale(chiave) === forma) inutili.push(chiave)
    }
    expect(inutili, 'fissaggi che ripetono la posizione: la regola e cambiata?').toEqual([])
  })

  it('controllo negativo: il confronto guarda davvero qualcosa', () => {
    // Senza, i test sopra passerebbero anche con `ORDINE_CORRETTO` vuoto.
    expect(Object.keys(ORDINE_CORRETTO).length).toBeGreaterThanOrEqual(11)

    // E la posizione deve saper divergere, altrimenti il terzo test non
    // potrebbe fallire mai: slowbro-galar e' f02 in tabella e f01 per
    // posizione, perche' su pokemon-zone la Mega occupa gia' f01.
    expect(posizionale('slowbro-galar')).toBe('f01')
    expect(formeSprite.forme['slowbro-galar']).toBe('f02')
  })

  it('il modulo dei fissaggi non contiene niente da eseguire', () => {
    // Il primo tentativo importava `ORDINE_CORRETTO` da `gen-forme-sprite.mjs`,
    // e importare quel file lo LANCIA. Provato: la suite passava da mezzo
    // secondo a 28, riscriveva `formeSprite.json` durante la corsa, e restava
    // VERDE — perche' il confronto trovava la tabella appena rigenerata dal
    // generatore che doveva controllare.
    //
    // Percio' i fissaggi ora stanno in un file che non esegue nulla. Questo
    // test guarda il sorgente invece di fidarsi: se qualcuno ci rimettesse
    // dentro una lettura di file, una fetch o una scrittura, il giro
    // tornerebbe possibile e nessun altro test se ne accorgerebbe.
    const sorgente = readFileSync(
      new URL('../../scripts/ordine-forme.mjs', import.meta.url), 'utf8')
    const eseguibile = ['fetch(', 'readFileSync', 'writeFileSync', 'process.argv', 'require(']
      .filter(t => sorgente.includes(t))
    expect(eseguibile, 'il modulo dei fissaggi e tornato eseguibile').toEqual([])

    // Controllo negativo: il filtro sa trovare qualcosa quando c'e'.
    expect(['fetch(', 'writeFileSync'].filter(t =>
      readFileSync(new URL('../../scripts/gen-forme-sprite.mjs', import.meta.url), 'utf8')
        .includes(t)).length).toBeGreaterThan(0)
  })
})
