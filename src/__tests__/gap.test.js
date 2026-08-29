/**
 * src/__tests__/gap.test.js
 *
 * Verifica la lista che alimenta il badge «non calcolata».
 *
 * ─── COSA PUÒ ANDARE STORTO, E CHE NESSUN ALTRO TEST VEDREBBE ──────────────
 * Il badge è un'affermazione rivolta all'utente: «questa voce non entra nel
 * numero». Sbagliarla è peggio che tacere, in due modi opposti:
 *
 *   badge di troppo   su una voce che invece calcoliamo → l'utente diffida di
 *                     un numero corretto
 *   badge mancante    su una voce che non calcoliamo    → l'utente si fida di
 *                     un numero sbagliato
 *
 * Il secondo caso non è verificabile qui — dipende da cosa fa il riferimento,
 * e lo stabilisce il generatore. Il PRIMO invece sì, ed è quello che questo
 * file blocca: nessuna voce può stare contemporaneamente nella lista dei gap e
 * fra quelle con un effetto meccanico.
 *
 * Un test così serve perché le due liste nascono da due posti diversi
 * (`gapNoti.json` generato dal vendor, `ABILITY_EFFECTS` scritto a mano) e
 * niente le tiene allineate. Quando la sessione J implementerà i dieci pezzi
 * intorno a Intimidate, se qualcuno dimentica `npm run gap:gen` il badge
 * resterebbe su abilità ormai calcolate — e questo test diventa rosso.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ABILITY_EFFECTS, normalizeAbilityKey } from '../data/abilityEffects.js'
import { ITEM_EFFECTS } from '../data/itemEffects.js'
import { abilitaNonCalcolata, strumentoNonCalcolato, metaGap, elencoGap } from '../lib/gap.js'
import abilities from '../data/abilities.json' with { type: 'json' }
import items from '../data/items.json' with { type: 'json' }
import pokemonData from '../data/pokemon.json' with { type: 'json' }
// `haEffetto` arriva da qui e non è più ridefinito nel file: prima ne esisteva
// una copia identica a quella del generatore, quindi il test controllava il
// generatore con la definizione del generatore — ed è il motivo per cui non ha
// mai visto Pixilate. La seconda fonte indipendente è `inventarioMotore.test.js`.
import { haEffetto } from '../../scripts/campi-meta.mjs'

const norm = (s) => String(s || '').toLowerCase().replace(/[.'’:]/g, '').replace(/[\s\-_]+/g, '')

/**
 * Il rapporto con le prove. Il percorso è calcolato da `import.meta.url` e non
 * da `process.cwd()`: la seconda dipende da dove è stato lanciato il comando,
 * e `process` non è fra le globali dichiarate per i file di test in
 * `eslint.config.js`.
 */
function leggiRapporto() {
  const percorso = fileURLToPath(new URL('../../scripts/ncp/gap-rapporto.json', import.meta.url))
  return JSON.parse(fs.readFileSync(percorso, 'utf8'))
}

describe('gap noti — la lista che alimenta il badge', () => {
  it('la lista è stata generata dal vendor e porta il commit', () => {
    expect(metaGap.ncpCommit).toBeTruthy()
    expect(metaGap.ingresso).toBe('CALCULATE_ALL_MOVES_SV')
    expect(elencoGap.abilita.length).toBeGreaterThan(0)
    expect(elencoGap.strumenti.length).toBeGreaterThan(0)
  })

  it('nessuna abilità che calcoliamo porta il badge', () => {
    const conEffetto = Object.entries(ABILITY_EFFECTS)
      .filter(([, v]) => haEffetto(v))
      .map(([k]) => k)

    const sbagliate = conEffetto.filter(k => abilitaNonCalcolata(k))
    expect(
      sbagliate,
      'queste abilità hanno un effetto e mostrano comunque «non calcolata»: '
      + 'rigenerare con `npm run gap:gen`',
    ).toEqual([])
  })

  it('nessuno strumento che calcoliamo porta il badge', () => {
    const conEffetto = Object.entries(ITEM_EFFECTS)
      .filter(([, v]) => haEffetto(v))
      .map(([k]) => k)

    const sbagliati = conEffetto.filter(k => strumentoNonCalcolato(k))
    expect(sbagliati, 'rigenerare con `npm run gap:gen`').toEqual([])
  })

  it('ogni voce della lista è davvero selezionabile dalla tendina', () => {
    // Un badge su una voce che nessuno può scegliere è codice morto. Il
    // generatore parte da `abilities.json` e `items.json`, quindi non dovrebbe
    // succedere — ma se un giorno partisse da ABILITY_EFFECTS ricadremmo nel
    // difetto che il documento diagnostico aveva in §1.9.
    const abSelezionabili = new Set(Object.keys(abilities).map(norm))
    const itSelezionabili = new Set(Object.keys(items).map(norm))

    for (const k of elencoGap.abilita) {
      expect(abSelezionabili.has(norm(k)), `abilità fantasma nella lista: ${k}`).toBe(true)
    }
    for (const k of elencoGap.strumenti) {
      expect(itSelezionabili.has(norm(k)), `strumento fantasma nella lista: ${k}`).toBe(true)
    }
  })

  it('ogni voce porta la riga di prova che l\'ha fatta entrare', () => {
    // Senza la prova la lista non è verificabile a mano, e una lista di
    // centotrenta nomi che nessuno può controllare è una lista di cui fidarsi
    // per fede. Con file e riga si apre il vendor e si guarda.
    //
    // Le prove stanno nel rapporto e non nel file importato dall'app: nel
    // browser sarebbero 25 kB di bundle che nessuno legge. Qui si leggono da
    // disco, cosa che in ambiente Node si può fare.
    const rapporto = leggiRapporto()
    const tutte = [...rapporto.prove.abilita, ...rapporto.prove.strumenti]
    expect(tutte.length).toBe(elencoGap.abilita.length + elencoGap.strumenti.length)

    for (const v of tutte) {
      expect(v.prova?.file, `${v.chiave} è nella lista senza prova`).toBeTruthy()
      expect(v.prova?.riga, `${v.chiave} è nella lista senza riga`).toBeGreaterThan(0)
      expect(v.prova?.funzione, `${v.chiave} è nella lista senza funzione`).toBeTruthy()
    }
  })

  it('il rapporto e il file leggero elencano le stesse voci', () => {
    // Se il generatore venisse spezzato in due comandi, i due file potrebbero
    // divergere e il badge apparirebbe su una lista mentre le issue nascono
    // dall'altra.
    const rapporto = leggiRapporto()
    expect(rapporto.prove.abilita.map(v => v.chiave).sort()).toEqual([...elencoGap.abilita].sort())
    expect(rapporto.prove.strumenti.map(v => v.chiave).sort()).toEqual([...elencoGap.strumenti].sort())
  })

  it('le chiavi si riconoscono in tutte e tre le convenzioni del progetto', () => {
    // `abilities.json` usa gli spazi, `ABILITY_EFFECTS` i trattini, NCP le
    // maiuscole. È la stessa disallineatura che in §1.8 aveva spento Sand Rush,
    // e in cui si ricasca ogni volta che si confrontano due liste a occhio.
    const campione = elencoGap.abilita[0]
    expect(abilitaNonCalcolata(campione)).toBe(true)
    expect(abilitaNonCalcolata(campione.replace(/ /g, '-'))).toBe(true)
    expect(abilitaNonCalcolata(campione.toUpperCase())).toBe(true)
    expect(abilitaNonCalcolata(normalizeAbilityKey(campione))).toBe(true)
  })

  it('il registro vede tutte le abilità che un utente può scegliere', () => {
    // ─── IL BUCO CHE QUESTO TEST CHIUDE ──────────────────────────────────
    //
    // Il generatore enumera `abilities.json`. La tendina dell'app invece
    // disegna le abilità di `pokemon.json` (`abilitaPerSpecie`). Sono due
    // elenchi diversi, e niente li teneva allineati: `eelevate` (Eelektross
    // Mega) e `fire mane` (Pyroar Mega) stavano nel secondo e non nel primo.
    //
    // Non era cosmetico. Rapidascesa NCP la calcola — `damage_MASTER.js:1112`
    // e `:1298` — quindi sarebbe dovuta entrare nelle 108 col segnalino «non
    // calcolata». Invece era invisibile al registro: l'utente poteva
    // sceglierla, il numero usciva sbagliato, e nessuno lo dichiarava. Un
    // silenzio a monte di tutti gli altri, perché nemmeno il contatore sapeva
    // di doverlo contare.
    //
    // Il verso opposto NON si controlla: `abilities.json` è anche il catalogo
    // per l'import da Showdown, e può legittimamente contenere nomi che
    // nessuna specie del roster porta.
    const nelListino = new Set(Object.keys(abilities).map(normalizeAbilityKey))
    const assegnate = new Map()
    for (const [specie, dati] of Object.entries(pokemonData)) {
      for (const a of dati.abilities ?? []) {
        const chiave = normalizeAbilityKey(a)
        if (!nelListino.has(chiave) && !assegnate.has(chiave)) assegnate.set(chiave, specie)
      }
    }
    expect(
      [...assegnate].map(([a, specie]) => `${a} (${specie})`),
      'questa abilità è addosso a una specie ma non è in abilities.json: il '
      + 'registro del divario non la enumera nemmeno, quindi non può dichiararla '
      + 'non calcolata — qualunque cosa faccia il riferimento.',
    ).toEqual([])
  })

  it('controllo negativo: la ricerca sopra sa distinguere presente da assente', () => {
    // Senza, il test qui sopra passerebbe con una normalizzazione che risponde
    // sempre di sì, o con `pokemon.json` letto vuoto.
    const nelListino = new Set(Object.keys(abilities).map(normalizeAbilityKey))
    expect(nelListino.has('eelevate')).toBe(true)
    expect(nelListino.has('fire-mane')).toBe(true)
    expect(nelListino.has('abilita-che-non-esiste')).toBe(false)
    const conAbilita = Object.values(pokemonData).filter(d => (d.abilities ?? []).length)
    expect(conAbilita.length).toBeGreaterThan(1000)
  })

  it('una voce inventata non porta il badge', () => {
    // Controllo negativo: senza, tutti i test sopra passerebbero anche con una
    // funzione che risponde sempre `true`.
    expect(abilitaNonCalcolata('abilità che non esiste')).toBe(false)
    expect(abilitaNonCalcolata(null)).toBe(false)
    expect(abilitaNonCalcolata('')).toBe(false)
    expect(strumentoNonCalcolato('strumento che non esiste')).toBe(false)
    expect(strumentoNonCalcolato(null)).toBe(false)
  })
})
