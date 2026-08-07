/**
 * src/__tests__/preparazione.test.js
 *
 * Lo strato di preparazione provato DA SOLO, sugli stadi di boost invece che
 * sui roll finali.
 *
 * ─── PERCHÉ NON BASTA `ncpPreparazione.test.js` ────────────────────────────
 * Quel file confronta i numeri col riferimento, ed è la prova che conta. Ma
 * quando diventa rosso dice «Garchomp fa 78 invece di 116» — e da lì al ramo
 * sbagliato di `checkIntimidate` c'è un pomeriggio di lavoro. Qui invece si
 * asserisce lo stadio: «Clear Body lascia l'Attacco a zero». Un rosso qui
 * indica la riga.
 *
 * ─── E SOPRATTUTTO: È QUI CHE VIVE LA TRASCRIZIONE ─────────────────────────
 * `lib/preparazione.js` non tiene l'elenco delle abilità: legge i flag da
 * `ABILITY_EFFECTS`. Buona cosa — una fonte sola — ma vuol dire che un giorno
 * qualcuno può togliere `intimidateAnnulla` a Own Tempo senza che niente si
 * accorga, perché il vendore non è lì a protestare.
 *
 * La tabella qui sotto è la trascrizione: dodici abilità, la famiglia di
 * ciascuna, copiate da `damage_MASTER.js:559`. Se i dati e il vendore
 * divergono, diverge questo file.
 *
 * ─── L'ALTRA COSA CHE NESSUN ALTRO TEST VEDREBBE ───────────────────────────
 * Il badge «non calcolata». Un'abilità che la preparazione calcola davvero non
 * deve più portarlo — ed è `gap.test.js` a bloccarlo, ma solo se la voce ha un
 * effetto in `ABILITY_EFFECTS`. Le due liste vengono da due posti diversi;
 * l'ultimo blocco qui sotto le tiene insieme.
 */

import { describe, it, expect } from 'vitest'
import { preparaCoppia, preparaSingolo, CHIAVI_BOOST } from '../lib/preparazione.js'
import { ABILITY_EFFECTS, normalizeAbilityKey } from '../data/abilityEffects.js'
import { abilitaNonCalcolata, strumentoNonCalcolato } from '../lib/gap.js'

const VUOTO = [0, 0, 0, 0, 0, 0]

/** L'intimidatore: un Incineroar con l'abilità accesa. */
function intimidatore(extra = {}) {
  return {
    pokemon: 'incineroar', sps: VUOTO, natura: 'serious',
    abilita: 'intimidate', abilitaAccesa: true, strumento: null,
    ...extra,
  }
}

/** Il bersaglio: un Garchomp a cui si cambia solo l'abilità. */
function bersaglio(abilita, extra = {}) {
  return {
    pokemon: 'garchomp', sps: VUOTO, natura: 'serious',
    abilita, abilitaAccesa: false, strumento: null,
    ...extra,
  }
}

/**
 * Fa arrivare un Intimidate dal difensore all'attaccante e restituisce i due
 * gruppi di stadi. È la direzione che conta nella matrice: il Pokémon che
 * subisce il colpo è quello che intimidisce.
 */
function intimidaAttaccante(abilitaAttaccante, extraAttaccante = {}) {
  return preparaCoppia({
    attaccante: bersaglio(abilitaAttaccante, extraAttaccante),
    difensore: intimidatore(),
  })
}

// ───────────────────────────────────────────────────────────────────────────

describe('checkIntimidate — le quattro famiglie', () => {
  // La tabella trascritta da damage_MASTER.js:559. Non dedotta da come «ci si
  // aspetta» che funzionino le abilità: copiata dai rami del vendore.
  const FAMIGLIE = [
    // [abilità, famiglia, stadio d'Attacco atteso sul bersaglio]
    ['contrary',        'inverte',   +1],
    ['guard dog',       'inverte',   +1],
    ['clear body',      'annulla',    0],
    ['white smoke',     'annulla',    0],
    ['hyper cutter',    'annulla',    0],
    ['full metal body', 'annulla',    0],
    ['inner focus',     'annulla',    0],
    ['oblivious',       'annulla',    0],
    ['own tempo',       'annulla',    0],
    ['scrappy',         'annulla',    0],
    ['mirror armor',    'rimbalza',   0],
    ['simple',          'raddoppia', -2],
  ]

  for (const [abilita, famiglia, atteso] of FAMIGLIE) {
    it(`${abilita} (${famiglia}) porta l'Attacco a ${atteso}`, () => {
      const r = intimidaAttaccante(abilita)
      expect(r.attaccante.boosts.at).toBe(atteso)
    })
  }

  // Il controllo negativo del gruppo. Senza, tutte le righe «annulla» qui
  // sopra passerebbero anche con una preparazione che non fa proprio niente.
  it('un\'abilità neutra subisce il calo per intero', () => {
    expect(intimidaAttaccante('pressure').attaccante.boosts.at).toBe(-1)
  })

  it('a Intimidate spento nessuno si muove', () => {
    const r = preparaCoppia({
      attaccante: bersaglio('pressure'),
      difensore: intimidatore({ abilitaAccesa: false }),
    })
    expect(r.attaccante.boosts.at).toBe(0)
    expect(r.difensore.boosts.at).toBe(0)
  })

  it('Mirror Armor rimanda il calo al mittente, non lo cancella', () => {
    // Il caso «annulla» e il caso «rimbalza» lasciano il bersaglio a zero e
    // sarebbero indistinguibili guardando solo lui. La differenza si vede
    // sull'altro lato — ed è l'unico posto dove si vede.
    const r = intimidaAttaccante('mirror armor')
    expect(r.attaccante.boosts.at).toBe(0)
    expect(r.difensore.boosts.at).toBe(-1)
  })

  it('Clear Amulet annulla il calo come le abilità che lo annullano', () => {
    const r = intimidaAttaccante('pressure', { strumento: 'clear amulet' })
    expect(r.attaccante.boosts.at).toBe(0)
  })

  it('Contrary ha la meglio sul Clear Amulet', () => {
    // Il ramo che inverte viene valutato per PRIMO, quindi l'amuleto non entra
    // mai in gioco: +1, non 0. È la stranezza che il vendore commenta con
    // «for some reason», e senza questo caso la trascrizione dell'ORDINE non
    // sarebbe provata da niente.
    const r = intimidaAttaccante('contrary', { strumento: 'clear amulet' })
    expect(r.attaccante.boosts.at).toBe(+1)
  })

  it('Mirror Armor invece ha la meglio su Contrary… no: viene dopo', () => {
    // Controllo dell'affermazione opposta. Mirror Armor è il TERZO ramo, dopo
    // «inverte» e «annulla»: se un giorno qualcuno riordinasse la catena
    // mettendolo per primo, questo caso non se ne accorgerebbe (le due
    // abilità non coesistono) — ma il caso sopra sì, perché l'amuleto è uno
    // strumento e convive con qualsiasi abilità.
    expect(intimidaAttaccante('mirror armor').attaccante.boosts.at).toBe(0)
  })
})

describe('checkIntimidate — Defiant e Competitive, i tre che erano già giusti', () => {
  it('Defiant: il calo si applica e poi +2, netto +1', () => {
    expect(intimidaAttaccante('defiant').attaccante.boosts.at).toBe(+1)
  })

  it('Competitive: l\'Attacco cala davvero, e cresce l\'Att. Speciale', () => {
    // Sono due stadi distinti, e il vecchio motore ne teneva uno solo per
    // volta a seconda della categoria della mossa. Qui si vedono entrambi.
    const r = intimidaAttaccante('competitive')
    expect(r.attaccante.boosts.at).toBe(-1)
    expect(r.attaccante.boosts.sa).toBe(+2)
  })

  it('Contrary non riceve il +2 di Defiant', () => {
    // Contrary esce dalla catena al primo ramo: il +2 sta nel quarto e non
    // viene mai raggiunto. Un +3 qui vorrebbe dire che i rami si sommano.
    expect(intimidaAttaccante('contrary').attaccante.boosts.at).toBe(+1)
  })
})

describe('checkIntimidate — le due code', () => {
  it('Adrenaline Orb si consuma anche se il calo è stato annullato', () => {
    const r = intimidaAttaccante('clear body', { strumento: 'adrenaline orb' })
    expect(r.attaccante.boosts.at).toBe(0)
    expect(r.attaccante.strumento).toBeNull()
    expect(r.attaccante.boosts.sp).toBe(+1)
  })

  it('ma non contro Mirror Armor, dove il calo non è mai arrivato', () => {
    const r = intimidaAttaccante('mirror armor', { strumento: 'adrenaline orb' })
    expect(r.attaccante.strumento).toBe('adrenaline orb')
    expect(r.attaccante.boosts.sp).toBe(0)
  })

  it('Simple raddoppia anche il +1 dell\'orbo', () => {
    const r = intimidaAttaccante('simple', { strumento: 'adrenaline orb' })
    expect(r.attaccante.boosts.at).toBe(-2)
    expect(r.attaccante.boosts.sp).toBe(+2)
  })

  it('senza Intimidate l\'orbo resta in mano', () => {
    const r = preparaCoppia({
      attaccante: bersaglio('pressure', { strumento: 'adrenaline orb' }),
      difensore: intimidatore({ abilitaAccesa: false }),
    })
    expect(r.attaccante.strumento).toBe('adrenaline orb')
  })
})

describe('checkSwordShield', () => {
  const zacian = (abilita) => ({
    pokemon: 'zacian', sps: VUOTO, natura: 'serious', abilita, strumento: null,
  })
  const inerte = { pokemon: 'garchomp', sps: VUOTO, natura: 'serious', abilita: null, strumento: null }

  it('Intrepid Sword alza l\'Attacco di uno', () => {
    const r = preparaCoppia({ attaccante: zacian('intrepid sword'), difensore: inerte })
    expect(r.attaccante.boosts.at).toBe(+1)
    expect(r.attaccante.boosts.df).toBe(0)
  })

  it('Dauntless Shield alza la Difesa di uno', () => {
    const r = preparaCoppia({ attaccante: zacian('dauntless shield'), difensore: inerte })
    expect(r.attaccante.boosts.df).toBe(+1)
    expect(r.attaccante.boosts.at).toBe(0)
  })

  it('si applica anche con l\'interruttore abbassato', () => {
    // In Champions la condizione del vendore è `gen !== 9 || abilityOn`, e
    // `gen` vale 10. Legarlo al flag darebbe due numeri diversi dallo stesso
    // stato di gioco. Questo caso è quello che impedisce di «aggiustarlo».
    const r = preparaCoppia({
      attaccante: { ...zacian('intrepid sword'), abilitaAccesa: false },
      difensore: inerte,
    })
    expect(r.attaccante.boosts.at).toBe(+1)
  })

  it('un\'abilità neutra sullo stesso Pokémon non alza niente', () => {
    const r = preparaCoppia({ attaccante: zacian('pressure'), difensore: inerte })
    expect(r.attaccante.boosts.at).toBe(0)
    expect(r.attaccante.boosts.df).toBe(0)
  })
})

describe('checkParadoxAbilities', () => {
  const moon = (extra = {}) => ({
    pokemon: 'roaring-moon', sps: VUOTO, natura: 'serious',
    abilita: 'protosynthesis', strumento: null, ...extra,
  })
  const valiant = (extra = {}) => ({
    pokemon: 'iron-valiant', sps: VUOTO, natura: 'serious',
    abilita: 'quark drive', strumento: null, ...extra,
  })
  const inerte = { pokemon: 'garchomp', sps: VUOTO, natura: 'serious', abilita: null, strumento: null }

  const prep = (lato, campo = {}) =>
    preparaCoppia({ attaccante: lato, difensore: inerte, ...campo }).attaccante

  it('Protosynthesis si accende col sole', () => {
    expect(prep(moon(), { meteo: 'sun' }).paradosso).toBe(true)
  })

  it('e non con la pioggia', () => {
    expect(prep(moon(), { meteo: 'rain' }).paradosso).toBe(false)
  })

  it('nemmeno col Sole Estremo', () => {
    // Il vendore confronta `weather === 'Sun'`, esatto, mentre altrove usa
    // `indexOf("Sun")` che fa passare anche il sole di Desolate Land. È una
    // sua asimmetria, trascritta. Il giorno in cui si scopre che il gioco fa
    // diversamente, questo test diventa rosso e dice dove guardare.
    expect(prep(moon(), { meteo: 'harsh sunshine' }).paradosso).toBe(false)
  })

  it('Quark Drive si accende sul Campo Elettrico e non sugli altri', () => {
    expect(prep(valiant(), { terreno: 'electric' }).paradosso).toBe(true)
    expect(prep(valiant(), { terreno: 'grassy' }).paradosso).toBe(false)
    expect(prep(valiant()).paradosso).toBe(false)
  })

  it('il sole non accende Quark Drive, il campo non accende Protosynthesis', () => {
    expect(prep(valiant(), { meteo: 'sun' }).paradosso).toBe(false)
    expect(prep(moon(), { terreno: 'electric' }).paradosso).toBe(false)
  })

  it('la Booster Energy accende entrambe e si consuma', () => {
    const a = prep(moon({ strumento: 'booster energy' }))
    expect(a.paradosso).toBe(true)
    expect(a.strumento).toBeNull()

    const b = prep(valiant({ strumento: 'booster energy' }))
    expect(b.paradosso).toBe(true)
    expect(b.strumento).toBeNull()
  })

  it('col sole già alto la Booster Energy NON si consuma', () => {
    // È il ramo `else` del vendore: se il campo ha già acceso l'abilità, lo
    // strumento resta in mano. Sembra un cavillo e invece è la differenza fra
    // un Knock Off da 65 e uno da 97 di potenza.
    const a = prep(moon({ strumento: 'booster energy' }), { meteo: 'sun' })
    expect(a.paradosso).toBe(true)
    expect(a.strumento).toBe('booster energy')
  })

  it('la Booster Energy non fa niente a chi non ha un\'abilità paradosso', () => {
    const a = prep({ ...moon({ strumento: 'booster energy' }), abilita: 'pressure' })
    expect(a.paradosso).toBe(false)
    expect(a.strumento).toBe('booster energy')
  })
})

describe('checkDownload', () => {
  const genesect = (abilita) => ({
    pokemon: 'genesect', sps: VUOTO, natura: 'serious', abilita, strumento: null,
  })

  it('contro una Difesa più bassa sceglie l\'Attacco fisico', () => {
    // Blissey: Difesa 10, Dif. Speciale 135.
    const r = preparaCoppia({
      attaccante: genesect('download'),
      difensore: { pokemon: 'blissey', sps: VUOTO, natura: 'serious', abilita: null, strumento: null },
    })
    expect(r.attaccante.boosts.at).toBe(+1)
    expect(r.attaccante.boosts.sa).toBe(0)
  })

  it('contro una Dif. Speciale più bassa sceglie l\'Att. Speciale', () => {
    // Iron Hands: Difesa 125, Dif. Speciale 80.
    const r = preparaCoppia({
      attaccante: genesect('download'),
      difensore: { pokemon: 'iron-hands', sps: VUOTO, natura: 'serious', abilita: null, strumento: null },
    })
    expect(r.attaccante.boosts.sa).toBe(+1)
    expect(r.attaccante.boosts.at).toBe(0)
  })

  it('legge le difese GIÀ modificate dagli stadi', () => {
    // Dauntless Shield alza la Difesa di uno stadio, e nel vendore viene
    // PRIMA di Download. Su Zamazenta (115/115) il pareggio si rompe: con la
    // Difesa a +1 la più bassa diventa la Speciale, e Download va sull'Att.
    // Speciale invece che sull'Attacco.
    //
    // Senza questo caso l'ordine fra i due controlli non sarebbe provato da
    // niente, e invertirli non romperebbe nessun test.
    const conScudo = preparaCoppia({
      attaccante: genesect('download'),
      difensore: { pokemon: 'zamazenta', sps: VUOTO, natura: 'serious', abilita: 'dauntless shield', strumento: null },
    })
    const senzaScudo = preparaCoppia({
      attaccante: genesect('download'),
      difensore: { pokemon: 'zamazenta', sps: VUOTO, natura: 'serious', abilita: 'pressure', strumento: null },
    })
    expect(conScudo.attaccante.boosts.sa).toBe(+1)
    expect(senzaScudo.attaccante.boosts.sa).toBe(+1)
    expect(senzaScudo.attaccante.boosts.at).toBe(0)
  })

  it('un\'abilità neutra non alza niente', () => {
    const r = preparaCoppia({
      attaccante: genesect('pressure'),
      difensore: { pokemon: 'blissey', sps: VUOTO, natura: 'serious', abilita: null, strumento: null },
    })
    expect(r.attaccante.boosts.at).toBe(0)
    expect(r.attaccante.boosts.sa).toBe(0)
  })
})

describe('setHighestStat', () => {
  const inerte = { pokemon: 'garchomp', sps: VUOTO, natura: 'serious', abilita: null, strumento: null }
  const conStat = (pokemon, extra = {}) =>
    preparaCoppia({
      attaccante: { pokemon, sps: VUOTO, natura: 'serious', abilita: null, strumento: null, ...extra },
      difensore: inerte,
    }).attaccante.statPiuAlta

  it('Roaring Moon: l\'Attacco', () => {
    expect(conStat('roaring-moon')).toBe('at')       // 139
  })

  it('Iron Treads: la Difesa', () => {
    expect(conStat('iron-treads')).toBe('df')        // 120
  })

  it('Iron Bundle: la Velocità', () => {
    expect(conStat('iron-bundle')).toBe('sp')        // 136
  })

  it('a pari merito vince la prima nell\'ordine at · df · sa · sd · sp', () => {
    // Genesect ha Attacco e Att. Speciale entrambi a 120. Il vendore usa
    // `indexOf(Math.max(...))`, che restituisce la prima posizione: l'Attacco.
    // Non è una nostra scelta ed è il tipo di dettaglio che, dedotto, si
    // deduce al contrario.
    expect(conStat('genesect')).toBe('at')
  })

  it('gli stadi entrano nel confronto, e possono ribaltarlo', () => {
    // È il motivo per cui il vendore mette `setHighestStat` in fondo, con un
    // commento apposta: la statistica più alta va decisa DOPO Intimidate e
    // Intrepid Sword, non prima.
    //
    // Zacian a livello 50 senza SP: Velocità 158, Difesa 135. La più alta è la
    // Velocità. Ma Dauntless Shield porta la Difesa a 202, e la più alta
    // diventa lei — con la conseguenza che un ipotetico paradosso in quella
    // posizione riceverebbe un ×1.3 sulla difesa invece di un ×1.5 sulla
    // velocità.
    //
    // ─── LA PRIMA STESURA DI QUESTO CASO ERA SBAGLIATA ────────────────────
    // Diceva «138 batte comunque 115×1.5», confrontando le statistiche BASE
    // invece di quelle calcolate. A livello 50 le basi si comprimono e i
    // rapporti non si conservano: 138 contro 115 diventa 158 contro 135, e uno
    // stadio di boost (×1.5) ribalta la seconda sopra la prima. Un criterio
    // numerico o è misurato sul motore, oppure è un'ipotesi.
    const conScudo = preparaCoppia({
      attaccante: { pokemon: 'zacian', sps: VUOTO, natura: 'serious', abilita: 'dauntless shield', strumento: null },
      difensore: inerte,
    })
    const senzaScudo = preparaCoppia({
      attaccante: { pokemon: 'zacian', sps: VUOTO, natura: 'serious', abilita: 'pressure', strumento: null },
      difensore: inerte,
    })
    expect(senzaScudo.attaccante.statPiuAlta).toBe('sp')
    expect(conScudo.attaccante.boosts.df).toBe(+1)
    expect(conScudo.attaccante.statPiuAlta).toBe('df')
  })

  it('le cinque chiavi sono quelle e in quell\'ordine', () => {
    expect(CHIAVI_BOOST).toEqual(['at', 'df', 'sa', 'sd', 'sp'])
  })
})

describe('preparaSingolo — quello che serve alla velocità', () => {
  it('vede il paradosso acceso dal campo', () => {
    const slot = { key: 'iron-bundle', sps: VUOTO, nature: 'serious', ability: 'quark drive', item: null }
    expect(preparaSingolo(slot, null, 'electric')).toEqual({ paradosso: true, statPiuAlta: 'sp' })
  })

  it('e spento senza campo né strumento', () => {
    const slot = { key: 'iron-bundle', sps: VUOTO, nature: 'serious', ability: 'quark drive', item: null }
    expect(preparaSingolo(slot, null, null).paradosso).toBe(false)
  })

  it('non esplode su uno slot vuoto', () => {
    // La matrice chiama questa funzione su celle che possono essere vuote.
    expect(() => preparaSingolo(null)).not.toThrow()
  })
})

describe('il badge dice ancora la verità', () => {
  // Il badge «non calcolata» nasce da `gapNoti.json`, che a sua volta guarda
  // se la voce ha un effetto in ABILITY_EFFECTS. Le due liste vivono in due
  // posti e niente le tiene insieme: se qualcuno implementa un'abilità e si
  // dimentica `npm run gap:gen`, il badge resta su qualcosa che ormai
  // calcoliamo. `gap.test.js` lo blocca in generale; qui si nominano le voci
  // di questa sessione, così il messaggio d'errore dice quale.
  const CALCOLATE_DA_J = [
    'clear body', 'white smoke', 'hyper cutter', 'full metal body',
    'inner focus', 'oblivious', 'own tempo', 'scrappy',
    'guard dog', 'contrary', 'mirror armor', 'simple',
    'intrepid sword', 'dauntless shield',
    'protosynthesis', 'quark drive', 'download',
  ]

  for (const nome of CALCOLATE_DA_J) {
    it(`${nome} ha un effetto e non porta più il badge`, () => {
      const voce = ABILITY_EFFECTS[normalizeAbilityKey(nome)]
      expect(voce, `${nome} non ha una voce in ABILITY_EFFECTS`).toBeTruthy()
      expect(abilitaNonCalcolata(nome), 'rigenerare con `npm run gap:gen`').toBe(false)
    })
  }

  for (const nome of ['clear amulet', 'booster energy', 'adrenaline orb']) {
    it(`${nome} è calcolato e non porta più il badge`, () => {
      expect(strumentoNonCalcolato(nome), 'rigenerare con `npm run gap:gen`').toBe(false)
    })
  }

  it('Rattled invece il badge ce l\'ha ancora, ed è giusto così', () => {
    // La preparazione le dà il suo +1 Velocità, ma la Velocità della matrice
    // arriva da `speedOrder.js`, che non passa dalla preparazione per gli
    // stadi. Finché è così, Rattled non sposta nessun numero che l'app
    // mostri: toglierle il badge sarebbe affermare un calcolo che non c'è.
    expect(abilitaNonCalcolata('rattled')).toBe(true)
  })
})
