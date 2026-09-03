// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/divergenzeAggiudicate.test.js
 *
 * I punti in cui ci scostiamo dal riferimento DI PROPOSITO, con chi l'ha
 * deciso e perché.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * La regola del progetto è che l'oracolo è il riferimento eseguito: si
 * trascrive, non si migliora. Regge quasi sempre, e le due volte che non
 * regge vanno scritte, non ricordate — altrimenti fra sei mesi qualcuno vede
 * la divergenza, la scambia per un errore e la «corregge», riportando dentro
 * uno scivolone.
 *
 * È lo stesso schema di `pesiAggiudicati.test.js` e `nomiConfermati.test.js`:
 * un registro di decisioni umane, con la prova che la decisione era informata.
 *
 * ─── COSA NON PUÒ ESSERE VERIFICATO, E VA DETTO ────────────────────────────
 *
 * Su questi due casi il confronto roll per roll con NCP è IMPOSSIBILE per
 * costruzione: divergiamo apposta. Nessun test dell'oracolo li copre, e
 * nessuno deve provarci. Quello che questi test difendono è che la scelta
 * resti quella decisa, e che la ragione resti leggibile.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { preparaCoppia } from '../lib/preparazione.js'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { DANNO_FINE_TURNO_PER_STATO, STATI } from '../lib/rules.js'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const SORGENTE = path.join(RADICE, 'vendor', 'ncp', 'damage_MASTER.js')
const vendorPresente = fs.existsSync(SORGENTE)

const lato = (pokemon, abilita, accesa = false, strumento = null) => ({
  pokemon, sps: [0, 0, 0, 0, 0, 0], natura: null, livello: 50,
  abilita, strumento, abilitaAccesa: accesa,
  boosts: { at: 0, df: 0, sa: 0, sd: 0, sp: 0 },
})

// ═══════════════════════════════════════════════════════════════════════════
// 1. Supersweet Syrup contro Competitive
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── LO SCIVOLONE, ALLA LETTERA ────────────────────────────────────────────
 *
 * `checkSupersweetSyrup` (`damage_MASTER.js:549`):
 *
 *     else if (target.ability === "Competitive") {
 *         target.boosts[AT] = Math.min(6, target.boosts[SA] + 2);
 *     }
 *
 * Scrive sull'ATTACCO leggendo l'ATTACCO SPECIALE. Due funzioni sopra, in
 * `checkIntimidate` (`:580`), la stessa clausola è scritta giusta:
 *
 *     else if (target.ability === "Competitive") {
 *         target.boosts[SA] = Math.min(6, target.boosts[SA] + 2);
 *     }
 *
 * Due righe che dicono la stessa cosa in due modi, e una delle due è
 * distratta. Non è una regola del gioco: è un dito scivolato.
 *
 * ─── LA DECISIONE ──────────────────────────────────────────────────────────
 *
 * Simone ha aggiudicato: seguiamo la riga giusta, cioè Competitive alza
 * l'Attacco Speciale.
 */
describe('Supersweet Syrup contro Competitive', () => {
  it.runIf(vendorPresente)('lo scivolone del riferimento è ancora lì', () => {
    // Se un aggiornamento del vendor lo correggesse, questa divergenza
    // smetterebbe di essere una divergenza — e questo test lo direbbe, invece
    // di lasciarci un registro che parla di un problema che non c'è più.
    const src = fs.readFileSync(SORGENTE, 'utf8')
    const dentro = src.slice(src.indexOf('function checkSupersweetSyrup'))
      .slice(0, 500)
    expect(
      dentro,
      'il riferimento è stato corretto: rileggere questa decisione',
    ).toMatch(/boosts\[AT\]\s*=\s*Math\.min\(6,\s*target\.boosts\[SA\]\s*\+\s*2\)/)
  })

  it('noi alziamo l\'Attacco Speciale, non l\'Attacco', () => {
    const r = preparaCoppia({
      attaccante: lato('dipplin', 'supersweet-syrup', true),
      difensore:  lato('milotic', 'competitive'),
    })
    // -1 alla Difesa da Supersweet Syrup, +2 all'Att. Speciale da Competitive.
    expect(r.difensore.boosts.df).toBe(-1)
    expect(r.difensore.boosts.sa, 'Competitive non ha alzato l\'Att. Speciale').toBe(2)
    expect(r.difensore.boosts.at, 'stiamo alzando l\'Attacco come lo scivolone').toBe(0)
  })

  it('con Defiant invece l\'Attacco è giusto: lì il riferimento non sbaglia', () => {
    const r = preparaCoppia({
      attaccante: lato('dipplin', 'supersweet-syrup', true),
      difensore:  lato('pawniard', 'defiant'),
    })
    expect(r.difensore.boosts.at).toBe(2)
    expect(r.difensore.boosts.df).toBe(-1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Battle Bond, che il riferimento chiude a una generazione che non è la nostra
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `checkBattleBond` (`damage_MASTER.js:683`):
 *
 *     if (pokemon.ability === 'Battle Bond' && pokemon.abilityOn && gen == 9)
 *
 * Champions è `gen = 10` (`damage_MASTER.js:83`). La condizione è quindi
 * sempre falsa: nel riferimento Battle Bond non alza mai niente.
 *
 * Il nome però compare nel sorgente, ed è per questo che il registro del
 * divario la contava fra le mancanti — lo stesso difetto delle otto trovate
 * dentro `cannotCopy`, con una causa diversa: lì un elenco di nomi, qui un
 * ramo chiuso a un'altra generazione.
 *
 * ─── LA DECISIONE ──────────────────────────────────────────────────────────
 *
 * Simone ha aggiudicato di implementarla comunque, come la vuole il gioco.
 */
describe('Battle Bond', () => {
  it.runIf(vendorPresente)('il riferimento la chiude a gen 9, e noi giriamo a 10', () => {
    const src = fs.readFileSync(SORGENTE, 'utf8')
    const dentro = src.slice(src.indexOf('function checkBattleBond')).slice(0, 400)
    expect(dentro, 'il cancello di generazione è cambiato: rileggere questa decisione')
      .toMatch(/gen\s*==\s*9/)
    // `gen` non lo decide il vendor: lo impostiamo NOI quando lo carichiamo,
    // in `scripts/ncp/contesto.mjs`. È lì che va guardato — e la prima
    // stesura di questo test guardava il vendor, dove quella riga non c'è mai
    // stata: passava per il motivo sbagliato finché non è diventata rossa.
    const contesto = fs.readFileSync(
      path.join(RADICE, 'scripts', 'ncp', 'contesto.mjs'), 'utf8')
    expect(contesto, 'Champions non è più gen 10: rileggere questa decisione')
      .toMatch(/gen\s*=\s*10/)
  })

  it('noi le diamo il +1 ad Attacco, Att. Speciale e Velocità', () => {
    const r = preparaCoppia({
      attaccante: lato('greninja', 'battle-bond', true),
      difensore:  lato('incineroar', null),
    })
    expect([r.attaccante.boosts.at, r.attaccante.boosts.sa, r.attaccante.boosts.sp])
      .toEqual([1, 1, 1])
  })

  it('e solo con la levetta accesa', () => {
    const r = preparaCoppia({
      attaccante: lato('greninja', 'battle-bond', false),
      difensore:  lato('incineroar', null),
    })
    expect([r.attaccante.boosts.at, r.attaccante.boosts.sa, r.attaccante.boosts.sp])
      .toEqual([0, 0, 0])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Il contraccolpo, dove l'oracolo non arriva proprio
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── NON È UNA DIVERGENZA: È UN TERRITORIO SCOPERTO ────────────────────────
 *
 * Le due qui sopra sono punti in cui il riferimento dice una cosa e noi ne
 * facciamo un'altra. Rock Head è diverso, e per questo sta in fondo con una
 * sezione sua: il riferimento **non dice niente**.
 *
 * Il contraccolpo NCP non lo calcola. `Rock Head` non compare mai in
 * `damage_MASTER.js` né in `damage_SV.js` — solo in `ability_data.js`, un
 * elenco di nomi, e in `pokedex.js`. Il contraccolpo lo mostriamo noi, ed è
 * una funzione che l'app ha in più rispetto all'oracolo.
 *
 * Quindi quello che abbiamo scritto è un'affermazione sulle regole del gioco,
 * non una trascrizione, e nessun confronto roll per roll potrà mai
 * confermarla o smentirla. Simone ha aggiudicato: Rock Head azzera il
 * contraccolpo delle dieci mosse in cui è una frazione del danno, e non tocca
 * le tre in cui è un prezzo in PS massimi.
 *
 * ─── E POI MAGIC GUARD, CHE ERA RIMASTA FUORI ─────────────────────────────
 *
 * Quando Rock Head è entrata, Magic Guard è stata lasciata fuori DI PROPOSITO:
 * Simone aveva aggiudicato «solo Rock Head, le dieci», e questo file lo
 * scriveva con un test che chiedeva che Magic Guard NON ci fosse.
 *
 * Adesso c'è, ed è la stessa aggiudicazione applicata due volte: la stessa
 * riga di codice (`contraccolpoDaMostrare`), le stesse dieci mosse, le stesse
 * tre lasciate fuori. Magicscudo nel gioco toglie ogni danno che non venga da
 * un attacco diretto — e la sua descrizione nell'app lo dice: «Subisce danno
 * solo dagli attacchi diretti».
 *
 * Le tre di tipo `maxhp` — Mind Blown, Chloroblast, Steel Beam — restano fuori
 * da entrambe. Non sono contraccolpo: sono il prezzo che la mossa chiede per
 * essere usata, e si paga anche quando la mossa fallisce.
 *
 * I dettagli e i casi stanno in `rockHead.test.js`; qui c'è la decisione.
 */
describe('Rock Head e Magic Guard, e il contraccolpo che il riferimento non conosce', () => {
  it.runIf(vendorPresente)('il riferimento non guarda mai quell\'abilità', () => {
    const src = fs.readFileSync(SORGENTE, 'utf8')
    expect(
      src.includes('Rock Head'),
      'il riferimento adesso la nomina: questa non è più un\'aggiudicazione',
    ).toBe(false)
  })

  it.runIf(vendorPresente)('e nemmeno l\'altra', () => {
    // Misurato, non ricordato: `Magic Guard` in tutto il vendor compare in
    // `ability_data.js` (due elenchi di nomi) e in `pokedex.js` (le specie che
    // ce l'hanno). Nei due file del danno, mai — esattamente come Rock Head.
    const src = fs.readFileSync(SORGENTE, 'utf8')
    expect(
      src.includes('Magic Guard'),
      'il riferimento adesso la nomina: questa non è più un\'aggiudicazione',
    ).toBe(false)
  })

  it('e noi sì, tutt\'e due, ma solo sulle dieci', () => {
    expect(ABILITY_EFFECTS['rock-head'].annullaContraccolpo).toBe(true)
    expect(
      ABILITY_EFFECTS['magic-guard']?.annullaContraccolpo,
      'Magic Guard è uscita: era entrata di proposito',
    ).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Cosa NON è ancora raggiungibile, e va detto invece che sottinteso
// ═══════════════════════════════════════════════════════════════════════════

describe('scritte adesso, raggiungibili quando la specie arriverà', () => {
  it('in Champions nessuna specie ha Embody Aspect o Battle Bond', () => {
    // È la situazione già accettata per Darmanitan-Galar: si scrive adesso, e
    // il giorno che la specie arriva l'abilità funziona già. Il test esiste
    // perché quel giorno diventi rosso e qualcuno venga a controllare che
    // l'implementazione regga davvero contro l'oracolo.
    const pokemonData = JSON.parse(
      fs.readFileSync(path.join(RADICE, 'src/data/pokemon.json'), 'utf8'))
    const con = (chiave) => Object.keys(pokemonData)
      .filter(k => (pokemonData[k].abilities ?? []).includes(chiave))

    expect(con('embody-aspect'), 'ora c\'è: verificare Embody Aspect contro NCP').toEqual([])
    expect(con('battle-bond'), 'ora c\'è: rileggere la divergenza aggiudicata').toEqual([])
  })

  it('le tre maschere di Ogerpon non sono fra i nostri strumenti', () => {
    // Tre dei quattro rami di Embody Aspect le richiedono. Finché mancano,
    // quei tre rami non possono essere veri nemmeno con la specie giusta.
    const items = JSON.parse(
      fs.readFileSync(path.join(RADICE, 'src/data/items.json'), 'utf8'))
    for (const m of ['wellspring mask', 'hearthflame mask', 'cornerstone mask']) {
      expect(items[m], `${m} ora c'è: verificare Embody Aspect`).toBeUndefined()
    }
  })

  it('ma le voci ci sono, e dichiarano l\'effetto', () => {
    expect(ABILITY_EFFECTS['embody-aspect']?.embodyAspect).toBe(true)
    expect(ABILITY_EFFECTS['battle-bond']?.battleBond).toBe(true)
    expect(ABILITY_EFFECTS['supersweet-syrup']?.supersweetSyrup).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Il fine turno, che il riferimento non calcola affatto
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ─── STESSA FORMA DELLA SEZIONE 3, SU CINQUE ABILITÀ ───────────────────────
 *
 * NCP calcola UN colpo. Quanti PS il difensore recupera o perde alla fine del
 * turno non lo guarda: `Leftovers`, `Ice Body`, `Rain Dish` e `Poison Heal`
 * non compaiono nemmeno una volta nei due file del danno, ed è asserito qui
 * sotto invece che ricordato. `Solar Power` e `Dry Skin` ci sono, ma solo per
 * la metà che tocca il danno.
 *
 * Il fine turno lo mostriamo noi, e lo mostravamo già: sabbia, Avanzi,
 * Baccacedro. Quelle tre righe erano aggiudicazioni anche prima che questo
 * file esistesse, e non erano scritte da nessuna parte — la prima volta che
 * qualcuno se ne accorge è questa. Le cinque abilità si aggiungono a loro.
 *
 * ─── LA FONTE, VISTO CHE NON È IL RIFERIMENTO ──────────────────────────────
 *
 * La descrizione che l'app stessa mostra all'utente, che le frazioni le scrive
 * per esteso: «ripristina 1/16 degli HP massimi alla fine di ogni turno».
 * Il test qui sotto legge quelle descrizioni e controlla che il numero scritto
 * nel motore sia quello promesso all'utente — cioè che le due metà dell'app
 * dicano la stessa cosa. È la verifica più forte disponibile quando l'oracolo
 * tace: non prova che la regola sia giusta, prova che non ci contraddiciamo.
 *
 * ─── E IL DANNO DA STATO, CHE ERA IL CASO SUCCESSIVO ───────────────────────
 *
 * Qui c'era scritto che non lo calcolavamo: «Velencura guadagna 1/8, e chi è
 * avvelenato senza non perde niente». Adesso c'è, ed è la stessa forma di
 * aggiudicazione — bruciatura 1/16, veleno 1/8, iride 1/16 crescente — con le
 * frazioni in `DANNO_FINE_TURNO_PER_STATO` (`lib/rules.js`).
 *
 * L'iride non è un numero ma una successione: al turno n toglie n/16 dei PS
 * massimi. È la ragione per cui `calcEOT` torna anche `eotAlTurno`, e per cui
 * le due DP accettano una funzione al posto del numero.
 *
 * ─── COSA RESTA FUORI, E VA DETTO ──────────────────────────────────────────
 *
 * Heatproof, nel gioco, dimezza il danno da bruciatura. Non l'abbiamo
 * scritto: il riferimento non lo dice, e sarebbe un'aggiudicazione in più di
 * quelle chieste. È il caso successivo, non una dimenticanza.
 *
 * E lo stato è un'ASSERZIONE DI CHI USA L'APP, non un fatto verificato: il
 * menù lascia scegliere «bruciato» su un Pokémon di tipo Fuoco, che nel gioco
 * non si può bruciare. Non lo impediamo, e non è una svista — l'app calcola il
 * turno che le si descrive.
 */
describe('il fine turno: cinque abilità dove il riferimento non arriva', () => {
  const DAL_RIFERIMENTO = ['Leftovers', 'Ice Body', 'Rain Dish', 'Poison Heal']

  it.runIf(vendorPresente)('nessuno dei due file del danno le nomina', () => {
    for (const file of ['damage_MASTER.js', 'damage_SV.js']) {
      const src = fs.readFileSync(path.join(RADICE, 'vendor', 'ncp', file), 'utf8')
      for (const nome of DAL_RIFERIMENTO) {
        expect(
          src.includes(nome),
          `${file} ora nomina ${nome}: il fine turno non è più solo nostro`,
        ).toBe(false)
      }
    }
  })

  it.runIf(vendorPresente)('e delle altre due nomina solo la metà che tocca il danno', () => {
    // Solar Power e Dry Skin il riferimento le conosce — il ×1,5 all'Att.
    // Speciale e il ×1,25 sulle mosse Fuoco — e quelle metà sono trascritte.
    // Ciò che non conosce sono i PS: nessuna delle righe che le nominano parla
    // di punti salute.
    const src = fs.readFileSync(SORGENTE, 'utf8')
    const righe = src.split('\n').filter(r => /Solar Power|Dry Skin/.test(r))
    expect(righe.length, 'il riferimento ha smesso di nominarle: rileggere').toBeGreaterThan(0)
    for (const r of righe) {
      expect(
        /curHP|maxHP|hp\s*[-+]=/.test(r),
        `il riferimento ora tocca i PS su questa riga: ${r.trim()}`,
      ).toBe(false)
    }
  })

  it('il numero nel motore è quello che la descrizione promette', () => {
    // `1/16` e `1/8` scritti nella descrizione italiana, contro il
    // denominatore in `ABILITY_EFFECTS`. Se qualcuno cambia uno dei due, il
    // test dice quale dei due sta mentendo all'altro.
    const descrizioni = JSON.parse(
      fs.readFileSync(path.join(RADICE, 'src/locales/it.json'), 'utf8')).abilities_desc
    for (const chiave of ['ice-body', 'rain-dish', 'solar-power', 'dry-skin', 'poison-heal']) {
      const voci = ABILITY_EFFECTS[chiave].fineTurno
      expect(voci, `${chiave} non dichiara il fine turno`).toBeTruthy()
      for (const v of voci) {
        expect(
          descrizioni[chiave],
          `${chiave}: il motore dice 1/${v.frazione}, la descrizione no`,
        ).toMatch(new RegExp(`1/${v.frazione}\\b`))
      }
    }
  })

  it('il danno da stato: le tre frazioni, e le tre assenze scritte', () => {
    // Elenco esatto su tutti e sei gli stati: un'assenza scritta è una
    // decisione, un'assenza taciuta è una dimenticanza. Se domani si
    // aggiungesse un settimo stato senza deciderne il fine turno, questo test
    // lo direbbe.
    expect(Object.keys(DANNO_FINE_TURNO_PER_STATO).sort()).toEqual([...STATI].sort())
    expect(DANNO_FINE_TURNO_PER_STATO['burned'].frazione).toBe(16)
    expect(DANNO_FINE_TURNO_PER_STATO['poisoned'].frazione).toBe(8)
    expect(DANNO_FINE_TURNO_PER_STATO['badly-poisoned']).toEqual({ frazione: 16, crescente: true })
    for (const s of ['healthy', 'paralyzed', 'asleep']) {
      expect(DANNO_FINE_TURNO_PER_STATO[s].frazione, `${s} ora toglie PS`).toBe(0)
    }
  })

  it.runIf(vendorPresente)('e il riferimento non ne calcola nessuna', () => {
    // `Badly Poisoned` NCP lo nomina — legge lo stato per raddoppiare Venoshock
    // e Facade — ma mai per togliere PS. La prova è che nessuna di quelle righe
    // parla di punti salute, ed è la stessa forma di controllo usata sopra per
    // Solar Power e Dry Skin.
    const src = fs.readFileSync(SORGENTE, 'utf8')
    const righe = src.split('\n').filter(r => /Badly Poisoned|"Burned"|"Poisoned"/.test(r))
    expect(righe.length, 'il riferimento ha smesso di nominare gli stati: rileggere').toBeGreaterThan(0)
    for (const r of righe) {
      expect(
        /curHP|maxHP|hp\s*[-+]=/.test(r),
        `il riferimento ora tocca i PS su questa riga: ${r.trim()}`,
      ).toBe(false)
    }
  })

  it('Heatproof NON dimezza la bruciatura, ed è una scelta', () => {
    // Nel gioco la dimezza. Il giorno che si decide di scriverlo, questo test
    // diventa rosso e la nota qui sopra va riscritta nello stesso commit.
    expect(ABILITY_EFFECTS['heatproof']?.annullaDannoDaStato).toBeUndefined()
    expect(ABILITY_EFFECTS['heatproof']?.dimezzaBruciatura).toBeUndefined()
  })
})
