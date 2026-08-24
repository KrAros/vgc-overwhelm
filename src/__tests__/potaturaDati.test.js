/**
 * src/__tests__/potaturaDati.test.js
 *
 * La rete sotto `scripts/potatura-dati.mjs`.
 *
 * ─── PERCHÉ QUESTO TEST DEVE ESISTERE ──────────────────────────────────────
 *
 * Il plugin di potatura gira con `apply: 'build'`: in sviluppo e qui nei test
 * i JSON restano interi. Vuol dire che il giorno in cui qualcuno scrivesse
 * `pokemonData[key].weight` in un componente, tutto resterebbe verde — la
 * suite legge il file intero — e il difetto uscirebbe solo online, come un
 * `undefined` dentro un numero.
 *
 * È la cecità osservativa di CONTRIBUTING.md applicata al bundle: la
 * differenza fra ciò che si prova e ciò che si pubblica. L'unico controllo
 * capace di fallire PRIMA del deploy è statico — leggere `src/` e cercarci i
 * campi potati — quindi è questo, non un test di comportamento.
 *
 * ─── FALSIFICABILITÀ ───────────────────────────────────────────────────────
 *
 * Il terzo test è il controllo negativo, e non è una formalità: senza,
 * `cercaCampo` potrebbe non trovare niente per un difetto suo — una regex
 * sbagliata, la cartella letta a vuoto — e i primi due passerebbero per il
 * motivo sbagliato. Il controllo cerca `stats`, che `src/` legge di sicuro:
 * se nemmeno quello si trova, la ricerca è rotta e lo dice.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { CAMPI_POTATI, campiPotati, pota } from '../../scripts/potatura-dati.mjs'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const SORGENTE = path.join(RADICE, 'src')

/** I file dell'applicazione: `src/`, esclusi i test e i dati stessi. */
function fileApplicazione(cartella = SORGENTE) {
  const risultato = []
  for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
    if (voce.name === '__tests__' || voce.name === 'data') continue
    const pieno = path.join(cartella, voce.name)
    if (voce.isDirectory()) risultato.push(...fileApplicazione(pieno))
    else if (/\.jsx?$/.test(voce.name)) risultato.push(pieno)
  }
  return risultato
}

/**
 * I file che importano un dato file di `src/data/`. Sono gli unici che ne
 * possono leggere un campo: chi non lo importa non ha come.
 */
function importatoriDi(nomeFile, file) {
  return file.filter(percorso =>
    fs.readFileSync(percorso, 'utf8').includes(`data/${nomeFile}`))
}

/**
 * Cerca un campo in `src/`, nei tre modi in cui JavaScript lo può leggere:
 * `.campo`, `['campo']` / `["campo"]`, e la destrutturazione `{ ..., campo }`.
 *
 * Sui commenti si passa sopra di proposito: `calcEngine.js` spiega a parole
 * perché la forma Mega NON si legge dal campo `mega`, e una spiegazione non è
 * un uso. Contarla renderebbe il test impossibile da soddisfare proprio dove
 * il codice è più documentato.
 */
function cercaCampo(campo, file) {
  const trovati = []
  const accesso = new RegExp(
    `\\.${campo}\\b|\\[\\s*['"\`]${campo}['"\`]\\s*\\]|\\{[^{}\\n]*\\b${campo}\\b[^{}\\n]*\\}\\s*=`,
  )
  for (const percorso of file) {
    const righe = fs.readFileSync(percorso, 'utf8').split('\n')
    righe.forEach((riga, i) => {
      const senzaCommento = riga.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
      if (accesso.test(senzaCommento)) {
        trovati.push(`${path.relative(RADICE, percorso)}:${i + 1}  ${riga.trim()}`)
      }
    })
  }
  return trovati
}

describe('potatura dei dati', () => {
  const file = fileApplicazione()

  for (const { file: nomeFile, campo } of campiPotati()) {
    it(`chi importa ${nomeFile} non legge mai \`${campo}\``, () => {
      const importatori = importatoriDi(nomeFile, file)

      // Se nessuno importa il file, la potatura è inutile ma soprattutto il
      // test non prova niente: meglio dirlo che passare in silenzio.
      expect(
        importatori.length,
        `nessun file di src/ importa ${nomeFile}: la potatura non ha bersaglio`,
      ).toBeGreaterThan(0)

      expect(
        cercaCampo(campo, importatori),
        `\`${campo}\` è potato da ${nomeFile}: queste righe leggerebbero undefined `
        + 'ONLINE, con la suite verde. Togli il campo da scripts/potatura-dati.mjs '
        + 'oppure togli l\'accesso da src/.',
      ).toEqual([])
    })
  }

  it('la potatura toglie davvero i campi, e lascia intatto il resto', () => {
    const interi = JSON.parse(
      fs.readFileSync(path.join(SORGENTE, 'data', 'pokemon.json'), 'utf8'),
    )
    const potati = pota('pokemon.json', interi)

    // Stesse specie, stesse statistiche: la potatura non è un filtro.
    expect(Object.keys(potati)).toEqual(Object.keys(interi))
    expect(potati.bulbasaur.stats).toEqual(interi.bulbasaur.stats)
    expect(potati.bulbasaur.abilities).toEqual(interi.bulbasaur.abilities)

    for (const campo of CAMPI_POTATI['pokemon.json'].voci) {
      expect(campo in interi.bulbasaur, `${campo} non era nel file di partenza`).toBe(true)
      expect(campo in potati.bulbasaur, `${campo} è sopravvissuto alla potatura`).toBe(false)
    }

    // E non muta l'ingresso: il file su disco serve ancora agli script.
    expect('weight' in interi.bulbasaur).toBe(true)
  })

  it('controllo negativo: un campo che src/ legge davvero viene trovato', () => {
    const chiImportaPokemon = importatoriDi('pokemon.json', file)
    expect(cercaCampo('stats', chiImportaPokemon).length).toBeGreaterThan(0)
    expect(cercaCampo('abilities', chiImportaPokemon).length).toBeGreaterThan(0)
  })

  it('controllo negativo: la restrizione a chi importa non svuota la ricerca', () => {
    // `num` è il caso che ha costretto a scoprire la regola: `sprite.js` lo
    // legge da `pokemon.json` e da `items.json`, e va trovato lì. Se questo
    // test smettesse di trovarlo, `importatoriDi` starebbe restituendo
    // insiemi vuoti e la potatura di `moves.json` passerebbe per un difetto
    // della ricerca, non perché è sicura.
    expect(cercaCampo('num', importatoriDi('pokemon.json', file)).length).toBeGreaterThan(0)
    expect(cercaCampo('num', importatoriDi('items.json', file)).length).toBeGreaterThan(0)
    expect(cercaCampo('meta', importatoriDi('gapNoti.json', file)).length).toBeGreaterThan(0)
  })
})
