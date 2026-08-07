/**
 * src/__tests__/onesta.test.js — sessione F-1
 *
 * I bersagli costruiti al passo 1: ogni test qui dentro è rosso sul motore
 * pre-sessione. Sono scritti come RELAZIONI dove possibile — «queste due
 * funzioni concordano», «questi due input danno lo stesso numero» — perché una
 * relazione sopravvive a un cambio futuro della formula, mentre un numero
 * inchiodato costringe a riscrivere il test insieme al codice e smette di
 * proteggere proprio quando servirebbe.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { normalizzaMeteo, METEO_CANONICI, MAX_HITS } from '../lib/rules.js'
import { calcStat } from '../lib/stats.js'
import { TYPES } from '../data/typeChart.js'
import {
  koChanceCumulative,
  koChanceSitrus,
  findBestNHKO,
  findBestNHKOSitrus,
  calcEOT,
} from '../lib/damage.js'
import {
  calcEffectiveSpe,
  speedWeatherAttiva,
  SPEED_WEATHER_ABILITIES,
} from '../utils/speedOrder.js'

// ═══════════════════════════════════════════════════════════════════════════
// Punto 8 — il vocabolario del meteo
// ═══════════════════════════════════════════════════════════════════════════

describe('normalizzaMeteo', () => {
  it('traduce i nomi morti in quelli vivi', () => {
    expect(normalizzaMeteo('hail')).toBe('snow')
    expect(normalizzaMeteo('sandstorm')).toBe('sand')
  })

  it('lascia passare i sei nomi canonici', () => {
    for (const m of METEO_CANONICI) expect(normalizzaMeteo(m)).toBe(m)
  })

  it('tollera maiuscole e spazi, perché arrivano da link condivisi', () => {
    expect(normalizzaMeteo('  HAIL ')).toBe('snow')
    expect(normalizzaMeteo('Harsh Sunshine')).toBe('harsh sunshine')
  })

  it('rifiuta quello che non riconosce invece di propagarlo', () => {
    expect(normalizzaMeteo('fog')).toBeNull()
    expect(normalizzaMeteo('')).toBeNull()
    expect(normalizzaMeteo(null)).toBeNull()
    expect(normalizzaMeteo(undefined)).toBeNull()
  })
})

describe('il bonus statistico non dipende da come si chiama il meteo', () => {
  // La relazione, non il numero: sotto sabbia un tipo Roccia ha la stessa
  // Difesa Speciale comunque si scriva «sabbia». Era falso prima di F-1:
  // `calcStat` conosceva solo 'sand', e 'sandstorm' passava senza effetto.
  const roccia = [TYPES.ROCK]
  const STAT_SPD = 4

  it('sand e sandstorm danno lo stesso valore', () => {
    const a = calcStat(100, 32, 50, 'careful', STAT_SPD, normalizzaMeteo('sand'), roccia)
    const b = calcStat(100, 32, 50, 'careful', STAT_SPD, normalizzaMeteo('sandstorm'), roccia)
    expect(a).toBe(b)
  })

  it('e comunque un valore diverso da quello senza meteo', () => {
    const conSabbia = calcStat(100, 32, 50, 'careful', STAT_SPD, normalizzaMeteo('sandstorm'), roccia)
    const senza     = calcStat(100, 32, 50, 'careful', STAT_SPD, null, roccia)
    expect(conSabbia).toBeGreaterThan(senza)
  })

  it('snow e hail danno lo stesso valore su un tipo Ghiaccio', () => {
    const ghiaccio = [TYPES.ICE]
    const STAT_DEF = 2
    const a = calcStat(100, 32, 50, 'bold', STAT_DEF, normalizzaMeteo('snow'), ghiaccio)
    const b = calcStat(100, 32, 50, 'bold', STAT_DEF, normalizzaMeteo('hail'), ghiaccio)
    expect(a).toBe(b)
  })
})

describe('calcEOT conosce la sabbia sotto entrambi i nomi', () => {
  const difensore = { item: null, ability: null }

  it('sandstorm fa danno come sand', () => {
    const a = calcEOT(difensore, 200, 'sand', [TYPES.NORMAL])
    const b = calcEOT(difensore, 200, 'sandstorm', [TYPES.NORMAL])
    expect(b.sandDmgHP).toBe(a.sandDmgHP)
    expect(a.sandDmgHP).toBeGreaterThan(0)
  })

  it('la neve non fa danno a fine turno — non è la grandine', () => {
    // Dalla nona generazione la neve non toglie HP a nessuno. Se un giorno
    // qualcuno reintroducesse la grandine come sinonimo di `snow`, questo
    // test lo intercetta.
    for (const nome of ['snow', 'hail']) {
      expect(calcEOT(difensore, 200, nome, [TYPES.NORMAL]).sandDmgHP).toBe(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Punto 6 — la velocità
// ═══════════════════════════════════════════════════════════════════════════

describe('speedWeatherAttiva', () => {
  // Il baco storico: lo store salva `'sand rush'` con lo spazio, la tabella di
  // `speedOrder` aveva `'sand-rush'` col trattino. Sand Rush e Slush Rush non
  // si accendevano MAI nel calcolo dell'ordine d'attacco, mentre nell'editor
  // il fulmine si accendeva — due schermate, due risposte.
  it('accetta le abilità nella forma in cui le salva lo store', () => {
    expect(speedWeatherAttiva('sand rush', 'sand')).toBe(true)
    expect(speedWeatherAttiva('slush rush', 'snow')).toBe(true)
    expect(speedWeatherAttiva('swift swim', 'rain')).toBe(true)
    expect(speedWeatherAttiva('chlorophyll', 'sun')).toBe(true)
  })

  it('accetta anche trattini e maiuscole', () => {
    expect(speedWeatherAttiva('Sand Rush', 'sand')).toBe(true)
    expect(speedWeatherAttiva('sand-rush', 'sand')).toBe(true)
  })

  it('accetta il meteo sotto il nome morto', () => {
    expect(speedWeatherAttiva('slush rush', 'hail')).toBe(true)
    expect(speedWeatherAttiva('sand rush', 'sandstorm')).toBe(true)
  })

  it('non si accende col meteo sbagliato', () => {
    expect(speedWeatherAttiva('sand rush', 'snow')).toBe(false)
    expect(speedWeatherAttiva('chlorophyll', 'rain')).toBe(false)
    expect(speedWeatherAttiva('sand rush', null)).toBe(false)
    expect(speedWeatherAttiva(null, 'sand')).toBe(false)
  })

  it('i meteo estremi accendono solo chi li accetta in NCP', () => {
    // `getFinalSpeed` punto f: Chlorophyll controlla indexOf("Sun") e Swift
    // Swim indexOf("Rain"), quindi prendono anche le versioni estreme.
    expect(speedWeatherAttiva('chlorophyll', 'harsh sunshine')).toBe(true)
    expect(speedWeatherAttiva('swift swim', 'heavy rain')).toBe(true)
  })

  it('ogni chiave della tabella è già normalizzata e punta a meteo canonici', () => {
    for (const [chiave, meteo] of Object.entries(SPEED_WEATHER_ABILITIES)) {
      expect(chiave).toBe(chiave.toLowerCase().replace(/ /g, '-'))
      for (const m of meteo) expect(METEO_CANONICI).toContain(m)
    }
  })
})

describe('calcEffectiveSpe', () => {
  const base = { key: 'garchomp', sps: [0, 0, 0, 0, 0, 32], nature: 'jolly', speBoost: 0 }

  it('Sand Rush raddoppia sotto sabbia', () => {
    const nudo    = calcEffectiveSpe({ ...base }, 'sand')
    const conRush = calcEffectiveSpe({ ...base, ability: 'sand rush' }, 'sand')
    expect(conRush).toBe(nudo * 2)
  })

  it('Choice Scarf moltiplica per uno e mezzo', () => {
    const nudo     = calcEffectiveSpe({ ...base }, null)
    const conScarf = calcEffectiveSpe({ ...base, item: 'choice scarf' }, null)
    // Relazione, non numero: pokeRound arrotonda verso il basso a .5 esatto.
    expect(conScarf).toBe(Math.floor(nudo * 1.5) + (((nudo * 1.5) % 1) > 0.5 ? 1 : 0))
    expect(conScarf).toBeGreaterThan(nudo)
  })

  it('Scarf e Tailwind si accumulano prima di arrotondare, non dopo', () => {
    // Il punto della trascrizione da NCP: un solo pokeRound in fondo.
    // Applicandoli in fila (`floor(x*1.5)*2`) il risultato può differire.
    const nudo = calcEffectiveSpe({ ...base }, null)
    const both = calcEffectiveSpe({ ...base, item: 'choice scarf' }, null, true)
    const atteso = nudo * 3
    expect(both).toBe(atteso % 1 > 0.5 ? Math.ceil(atteso) : Math.floor(atteso))
  })

  it('Iron Ball dimezza', () => {
    const nudo = calcEffectiveSpe({ ...base }, null)
    expect(calcEffectiveSpe({ ...base, item: 'iron ball' }, null)).toBe(Math.floor(nudo / 2))
  })

  // ── Surge Surfer (F-2) ───────────────────────────────────────────────────
  // Un caso positivo e tre negativi. I negativi sono la parte che rende il
  // criterio falsificabile: senza, «×2 sul Campo Elettrico» sarebbe soddisfatto
  // anche da un'implementazione che raddoppia sempre.

  it('Surge Surfer raddoppia sul Campo Elettrico', () => {
    const nudo   = calcEffectiveSpe({ ...base }, null, false, 'electric')
    const surfer = calcEffectiveSpe({ ...base, ability: 'surge surfer' }, null, false, 'electric')
    expect(surfer).toBe(nudo * 2)
  })

  it('Surge Surfer non fa niente sugli altri tre terreni', () => {
    for (const terreno of ['grassy', 'psychic', 'misty']) {
      const nudo   = calcEffectiveSpe({ ...base }, null, false, terreno)
      const surfer = calcEffectiveSpe({ ...base, ability: 'surge surfer' }, null, false, terreno)
      expect(surfer, `Surge Surfer si attiva su ${terreno}`).toBe(nudo)
    }
  })

  it('Surge Surfer non fa niente senza terreno', () => {
    const nudo   = calcEffectiveSpe({ ...base }, null, false, null)
    const surfer = calcEffectiveSpe({ ...base, ability: 'surge surfer' }, null, false, null)
    expect(surfer).toBe(nudo)
  })

  it('il Campo Elettrico non tocca la velocità di chi non ha Surge Surfer', () => {
    // Controllo incrociato: se questo fallisse, il ×2 sarebbe legato al
    // terreno invece che all'abilità, e il test positivo passerebbe lo stesso.
    const senzaCampo = calcEffectiveSpe({ ...base, ability: 'rough skin' }, null, false, null)
    const conCampo   = calcEffectiveSpe({ ...base, ability: 'rough skin' }, null, false, 'electric')
    expect(conCampo).toBe(senzaCampo)
  })

  // ── Protosynthesis / Quark Drive (J) ─────────────────────────────────────
  // Punto i di `getFinalSpeed`: ×1.5, ma SOLO se la statistica più alta è la
  // Velocità. È la condizione che rende il caso interessante — e che rende
  // necessari due Pokémon diversi invece di due configurazioni dello stesso.
  //
  // Iron Bundle ha la Velocità come statistica più alta (136): il ×1.5 arriva.
  // Iron Treads ha la Difesa (120): il paradosso si accende lo stesso, ma sulla
  // velocità non si vede niente. Senza il secondo caso, «×1.5 col paradosso»
  // sarebbe soddisfatto anche da un'implementazione che ignora la condizione.

  const bundle = { key: 'iron-bundle', sps: [0, 0, 0, 0, 0, 0], nature: 'serious', speBoost: 0 }
  const treads = { key: 'iron-treads', sps: [0, 0, 0, 0, 0, 0], nature: 'serious', speBoost: 0 }

  it('Quark Drive moltiplica per uno e mezzo se la Velocità è la statistica più alta', () => {
    const nudo = calcEffectiveSpe({ ...bundle }, null, false, 'electric')
    const quark = calcEffectiveSpe({ ...bundle, ability: 'quark drive' }, null, false, 'electric')
    expect(quark).toBe(Math.floor(nudo * 1.5) + (((nudo * 1.5) % 1) > 0.5 ? 1 : 0))
    expect(quark).toBeGreaterThan(nudo)
  })

  it('ma non se la statistica più alta è un\'altra', () => {
    const nudo = calcEffectiveSpe({ ...treads }, null, false, 'electric')
    const quark = calcEffectiveSpe({ ...treads, ability: 'quark drive' }, null, false, 'electric')
    expect(quark).toBe(nudo)
  })

  it('e non senza Campo Elettrico', () => {
    const nudo = calcEffectiveSpe({ ...bundle }, null, false, null)
    const quark = calcEffectiveSpe({ ...bundle, ability: 'quark drive' }, null, false, null)
    expect(quark).toBe(nudo)
  })

  it('la Booster Energy lo accende senza campo', () => {
    const nudo = calcEffectiveSpe({ ...bundle }, null, false, null)
    const conBooster = calcEffectiveSpe(
      { ...bundle, ability: 'quark drive', item: 'booster energy' }, null, false, null,
    )
    expect(conBooster).toBeGreaterThan(nudo)
  })

  it('la Booster Energy non fa niente a chi non ha un\'abilità paradosso', () => {
    // Controllo incrociato: senza, il ×1.5 potrebbe essere legato allo
    // strumento invece che all'abilità.
    const nudo = calcEffectiveSpe({ ...bundle, ability: 'rough skin' }, null, false, null)
    const conBooster = calcEffectiveSpe(
      { ...bundle, ability: 'rough skin', item: 'booster energy' }, null, false, null,
    )
    expect(conBooster).toBe(nudo)
  })

  it('restituisce un intero: si confronta con === per decidere chi va prima', () => {
    for (const item of [null, 'choice scarf', 'iron ball']) {
      for (const tw of [false, true]) {
        expect(Number.isInteger(calcEffectiveSpe({ ...base, item }, 'sand', tw))).toBe(true)
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Punti 2, 3 e 4 — il KO, la Sitrus, i tetti
// ═══════════════════════════════════════════════════════════════════════════

// Sedici roll che tolgono circa un ottavo degli HP: il KO cade fra il settimo
// e l'ottavo colpo, cioè OLTRE il vecchio tetto di 6 e DENTRO quello di 9.
const ROLLS_LENTI = [25, 25, 26, 26, 26, 27, 27, 27, 28, 28, 28, 29, 29, 29, 30, 30]
const HP = 200

describe('i due tetti sono lo stesso tetto', () => {
  it('un KO al settimo colpo viene trovato, non chiamato «nessun KO»', () => {
    const best = findBestNHKO(ROLLS_LENTI, HP, 0)
    expect(best).not.toBeNull()
    expect(best.hits).toBeGreaterThan(6)
    expect(best.hits).toBeLessThanOrEqual(MAX_HITS)
  })

  it('e viene trovato anche dalla simulazione con la Sitrus', () => {
    // Prima di F-1 questa si fermava a 6 turni e rispondeva «nessun KO»,
    // mentre il badge sopra diceva già 7HKO o 8HKO.
    const best = findBestNHKOSitrus(ROLLS_LENTI, HP, { conSitrus: true })
    expect(best).not.toBeNull()
    expect(best.hits).toBeLessThanOrEqual(MAX_HITS)
  })
})

describe('le due distribuzioni rispondono alla stessa domanda', () => {
  it('senza bacca, la DP con lo stato Sitrus coincide con quella senza', () => {
    const a = koChanceCumulative(ROLLS_LENTI, HP, 0)
    const b = koChanceSitrus(ROLLS_LENTI, HP, { conSitrus: false })
    expect(b).toEqual(a)
  })

  it('la stessa cosa con un EOT non nullo', () => {
    for (const eotNet of [-12, -5, 0, 6, 12]) {
      expect(koChanceSitrus(ROLLS_LENTI, HP, { conSitrus: false, eotNet }))
        .toEqual(koChanceCumulative(ROLLS_LENTI, HP, eotNet))
    }
  })

  it('senza bacca i due NHKO coincidono — badge e riga sotto non si contraddicono', () => {
    // Era falso: la versione Sitrus prendeva la probabilità di morire
    // ESATTAMENTE a quel turno, `findBestNHKO` quella di essere morto ENTRO
    // quel turno. Sullo stesso pannello, due definizioni.
    const a = findBestNHKO(ROLLS_LENTI, HP, 0)
    const b = findBestNHKOSitrus(ROLLS_LENTI, HP, { conSitrus: false })
    expect(b).toEqual(a)
  })

  it('la cumulativa non decresce mai', () => {
    const c = koChanceSitrus(ROLLS_LENTI, HP, { conSitrus: true })
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1])
  })
})

describe('la Sitrus Berry ritarda il KO, non lo anticipa', () => {
  it('con la bacca la probabilità di KO non è mai maggiore', () => {
    const senza = koChanceSitrus(ROLLS_LENTI, HP, { conSitrus: false })
    const con   = koChanceSitrus(ROLLS_LENTI, HP, { conSitrus: true })
    for (let i = 0; i < senza.length; i++) {
      expect(con[i]).toBeLessThanOrEqual(senza[i] + 1e-12)
    }
  })

  it('si mangia una volta sola', () => {
    // Con danni piccoli e cura grande, se la bacca si rimangiasse a ogni
    // discesa sotto metà il KO non arriverebbe mai entro il tetto.
    const piccoli = new Array(16).fill(30)
    const best = findBestNHKOSitrus(piccoli, HP, { conSitrus: true })
    expect(best).not.toBeNull()
  })
})

describe('la sabbia può chiudere il conto', () => {
  it('un EOT negativo uccide anche se nessun colpo ci arriva da solo', () => {
    // Otto colpi da 20 su 200 HP non uccidono: 160 di danno. Con 12 HP di
    // sabbia a turno il totale supera gli HP, e il KO deve comparire.
    const deboli = new Array(16).fill(20)
    const senzaSabbia = findBestNHKOSitrus(deboli, HP, { conSitrus: false, eotNet: 0 })
    const conSabbia   = findBestNHKOSitrus(deboli, HP, { conSitrus: false, eotNet: -12 })
    expect(senzaSabbia).toBeNull()
    expect(conSabbia).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Igiene — quello che è stato tolto deve restare tolto
// ═══════════════════════════════════════════════════════════════════════════

describe('il badge KO falso non torna', () => {
  const SORGENTE = path.resolve(import.meta.dirname, '..')

  function tuttiIFile(cartella) {
    const out = []
    for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
      const pieno = path.join(cartella, voce.name)
      if (voce.isDirectory()) { if (voce.name !== '__tests__') out.push(...tuttiIFile(pieno)) }
      else if (/\.jsx?$/.test(voce.name)) out.push(pieno)
    }
    return out
  }

  it('nessuna chiamata a calcHKO o formatHKO in src/', () => {
    // Il criterio del piano era `grep -rn "calcHKO\\|formatHKO" src/` a zero
    // risultati. Preso alla lettera lo violerebbe anche il commento che spiega
    // PERCHÉ sono state tolte, quindi qui si cercano le chiamate e le
    // dichiarazioni, non le menzioni.
    const colpevoli = []
    for (const file of tuttiIFile(SORGENTE)) {
      const testo = fs.readFileSync(file, 'utf8')
      if (/(?:function\s+|[^/\s])\b(calcHKO|formatHKO)\s*\(/.test(testo)) {
        colpevoli.push(path.relative(SORGENTE, file))
      }
    }
    expect(colpevoli).toEqual([])
  })

  it('la tabella meteo-velocità esiste in un posto solo', () => {
    // Ne esistevano tre, con tre comportamenti diversi. Un quarto `'slush-rush'`
    // scritto a mano da qualche parte è il modo in cui il baco tornerebbe.
    const colpevoli = []
    for (const file of tuttiIFile(SORGENTE)) {
      if (file.endsWith(path.join('utils', 'speedOrder.js'))) continue
      const testo = fs.readFileSync(file, 'utf8')
      // La firma cercata è «chiave slush rush → LISTA di meteo»: in
      // `abilityEffects.js` la stessa chiave esiste ma punta a un oggetto di
      // descrizioni, che è un'altra cosa e deve restare dov'è.
      if (/['"]slush-?rush['"]\s*:\s*\[/.test(testo)) colpevoli.push(path.relative(SORGENTE, file))
    }
    expect(colpevoli).toEqual([])
  })
})
