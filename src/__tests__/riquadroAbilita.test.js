/**
 * src/__tests__/riquadroAbilita.test.js
 *
 * Che tutti i riquadri delle abilità abbiano la stessa altezza minima.
 *
 * ─── IL DIFETTO ────────────────────────────────────────────────────────────
 *
 * `AbilityFlags.jsx` ha nove rami, uno per famiglia di abilità, e ognuno
 * rendeva il proprio riquadro ricopiando la stessa stringa di classi. Il
 * minimo d'altezza però stava solo su DUE.
 *
 * Misurato con Chromium a 320 px, un'abilità per ramo:
 *
 *     26 px  prepotenza
 *     42 px  fuocardore, squame-multiple, conta-KO, antagonismo
 *     58 px  i due che avevano il minimo
 *     74 px  le tre descrizioni più lunghe (Pellearsa, Download, Fantasmanto)
 *
 * Cambiare abilità spostava il resto della colonna fino a 48 px. A 800 px
 * erano due altezze, 26 e 42.
 *
 * Dopo: una sola altezza sopra i 480 px, due sotto.
 *
 * ─── PERCHE' QUESTO TEST GUARDA IL SORGENTE ────────────────────────────────
 *
 * Perché il difetto non è un'altezza sbagliata, è una classe RICOPIATA: nove
 * copie e nessun posto dove la regola potesse diventare vera. Misurare le
 * altezze in Chromium richiede vite preview e mezzo minuto — `layout:gen` fa
 * quello, ed è il posto giusto per le misure. Qui si presidia la causa: che
 * nessun ramo torni a scriversi le classi per conto suo.
 *
 * È lo stesso schema di `ordineCorretto.test.js`, che controlla che il modulo
 * dei fissaggi non torni eseguibile: leggere il sorgente è legittimo quando
 * ciò che si sorveglia È una proprietà del sorgente.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sorgente = readFileSync(
  new URL('../components/editor/AbilityFlags.jsx', import.meta.url), 'utf8')

/** I `className` dei riquadri: quelli che aprono con la costante condivisa. */
const conCostante = [...sorgente.matchAll(/className=\{`\$\{RIQUADRO\}/g)]

describe('i riquadri delle abilità', () => {
  it('nessun ramo si riscrive le classi a mano', () => {
    // La firma che era ricopiata nove volte. Se ricompare, qualcuno ha
    // aggiunto un ramo copiando quello accanto invece di usare la costante —
    // ed è esattamente così che il minimo d'altezza si era perso per sette.
    //
    // Si cerca dentro i `className`, non in tutto il file: la stessa stringa
    // compare anche nel commento che spiega il difetto, e in `RIQUADRO`
    // stesso. Cercare ovunque avrebbe reso il test rosso per un commento.
    const ricopiate = [...sorgente.matchAll(/className=\{`[^`]*mt-1 px-1 py-1 rounded text-xs border/g)]
    expect(
      ricopiate.map(m => m[0].slice(0, 60)),
      'un ramo scrive le classi del riquadro invece di usare RIQUADRO: '
      + 'l\'altezza minima non lo raggiungerà, e il layout tornerà a saltare',
    ).toEqual([])

    // Controllo negativo: la firma cercata deve esistere ancora nel file,
    // altrimenti il test sopra passerebbe perché non cerca più niente.
    expect(
      sorgente.includes('mt-1 px-1 py-1 rounded text-xs border'),
      'la firma è cambiata: aggiorna il test invece di lasciarlo verde',
    ).toBe(true)
  })

  it('tutti e quattordici i rami usano la costante', () => {
    // Il conteggio è esplicito perché un ramo NUOVO che se la dimentica non
    // farebbe fallire il test sopra: non ricopierebbe la firma, semplicemente
    // non avrebbe nessun minimo.
    //
    // Da nove a dieci con la levetta di Rapidascesa — «ha messo KO».
    // Da dieci a undici con quella delle cinque abilità che assorbono — Sap
    // Sipper, Lightning Rod, Storm Drain, Motor Drive, Well-Baked Body: un
    // ramo solo per tutte e cinque, perché la forma è identica e la differenza
    // sta nella tabella delle abilità, non nel riquadro.
    //
    // Da undici a dodici col riquadro delle abilità dell'ALLEATO — Battery,
    // Power Spot, Friend Guard, Flower Gift e la metà «alleato» di Steely
    // Spirit: un ramo solo per tutte e cinque, che dice dove si accende la
    // casella invece di far credere che l'app non le calcoli.
    //
    // Da dodici a tredici con la levetta delle cinque che il riferimento
    // accende con `abilityOn` — Plus, Minus, Electromorphosis, Protean,
    // Libero: un ramo solo, perché un Pokémon ha un'abilità sola e le cinque
    // non possono accendersi insieme.
    //
    // Da tredici a quattordici con le cinque a vita bassa — Erbaiuto,
    // Aiutofuoco, Torrente, Insettoshock, Sconfittite. Sono USCITE dal ramo
    // dell'interruttore, dove stavano insieme a Protean e Stakeout, per
    // andare in un ramo proprio che legge i punti salute. Il conto sale di
    // uno anche se il numero di abilità coperte non cambia: quello che si
    // conta qui sono i rami, non le abilità.
    //
    // Tutt'e cinque le volte il numero è stato alzato DOPO aver visto il test
    // rosso, che è il modo in cui questo presidio deve funzionare.
    expect(
      conCostante.length,
      'i rami che rendono un riquadro non sono quattordici: se ne hai aggiunto '
      + 'uno, deve usare RIQUADRO e questo numero va alzato di proposito',
    ).toBe(14)
  })

  it('la costante porta un minimo per entrambe le larghezze', () => {
    const riga = sorgente.match(/const RIQUADRO = '([^']+)'/)
    expect(riga, 'la costante RIQUADRO non esiste più').toBeTruthy()
    const classi = riga[1]
    expect(classi, 'manca il minimo sotto i 480 px').toMatch(/(^| )min-h-\[[\d.]+rem\]/)
    expect(classi, 'manca il minimo sopra i 480 px').toMatch(/min-\[480px\]:min-h-\[[\d.]+rem\]/)

    // E il minimo per telefono deve essere il PIU' ALTO dei due: al contrario
    // non servirebbe a niente, perche' e' sullo schermo stretto che il testo
    // va a capo.
    const stretto = Number(classi.match(/(^| )min-h-\[([\d.]+)rem\]/)[2])
    const largo = Number(classi.match(/min-\[480px\]:min-h-\[([\d.]+)rem\]/)[1])
    expect(stretto, 'il minimo per telefono non e piu alto di quello per schermo largo')
      .toBeGreaterThan(largo)
  })
})
