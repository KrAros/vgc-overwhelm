/**
 * src/__tests__/anagrafica.test.js
 *
 * I dati della sessione I, asseriti direttamente.
 *
 * ─── PERCHÉ NON BASTA LO SNAPSHOT ──────────────────────────────────────────
 * Lo snapshot verifica le correzioni per CONSEGUENZA: cambio la Difesa di
 * Aegislash, il danno si muove, il caso diverge. Funziona per quasi tutto, ma
 * ha un buco preciso — `calculateDamage` non legge la Velocità. Dodrio,
 * Chespin e Poipole avevano tutti e tre un errore solo lì, e nessun caso di
 * caratterizzazione può renderli osservabili. Lo stesso vale per il campo
 * `name`, che non entra in nessun calcolo ma è quello che l'utente legge.
 *
 * Quindi qui si asserisce il dato, non il suo effetto. La sessione I cambia
 * dei numeri dentro un JSON: il test giusto per una modifica ai dati è un test
 * sui dati.
 *
 * ─── LE GUARDIE DI FORMA ───────────────────────────────────────────────────
 * Le ultime tre `it` non guardano le sedici voci corrette: guardano tutte e
 * 1221. Sono le regole che hanno permesso agli errori di restare invisibili
 * per mesi, trasformate in controlli. Quella sugli indici di tipo in
 * particolare: Decidueye aveva `type: [4, 18]`, e 18 non esiste in
 * `typeChart.js`. `TYPE_CHART[mossa][18]` vale `undefined`, che non è né 0 né 2
 * né -1, quindi `getEffectiveness` lo scavalcava senza toccare il
 * moltiplicatore. Risultato: Decidueye veniva calcolato come Erba puro, senza
 * la doppia debolezza a Spettro e Buio e senza l'immunità a Normale e Lotta.
 * Nessun errore, nessun avviso: solo numeri sbagliati.
 */

import { describe, it, expect } from 'vitest'
import pokemonData from '../data/pokemon.json'
import movesData from '../data/moves.json'
import { TYPE_NAMES } from '../data/typeChart.js'
import abilitiesData from '../data/abilities.json'
import { ABILITY_EFFECTS } from '../data/abilityEffects.js'
import { parseShowdownPaste } from '../utils/showdownIO.js'
import inglese from '../locales/en.json' with { type: 'json' }
import italiano from '../locales/it.json' with { type: 'json' }

/** Indici di `stats`: [PS, Att, Dif, Att.Sp, Dif.Sp, Vel]. */
const STATS_CORRETTE = {
  'aegislash': [60, 50, 140, 50, 140, 60],
  'aegislash-blade': [60, 140, 50, 140, 50, 60],
  'cresselia': [120, 70, 110, 75, 120, 85],
  'dodrio': [60, 110, 70, 60, 60, 110],
  'hoopa': [80, 110, 60, 150, 130, 70],
  'necrozma': [97, 107, 101, 127, 89, 79],
  'necrozma-ultra': [97, 167, 97, 167, 97, 129],
  'poipole': [67, 73, 67, 73, 67, 73],
  'chespin': [56, 61, 65, 48, 45, 38],
  'inkay': [53, 54, 53, 37, 46, 45],
  'wishiwashi-solo': [45, 20, 20, 25, 25, 40],
  'alakazam-mega': [55, 50, 65, 175, 105, 150],
}

/** Tipi scritti per nome: `['Ghost', 'Fairy']` si rilegge, `[13, 17]` no. */
const TIPI_CORRETTI = {
  'decidueye': ['Grass', 'Ghost'],
  'mimikyu': ['Ghost', 'Fairy'],
  'lurantis': ['Grass'],
  'dugtrio-alola': ['Ground', 'Steel'],
  'wishiwashi-school': ['Water'],
  'marowak-alola': ['Fire', 'Ghost'],
  'delphox-mega': ['Fire', 'Psychic'],
  'greninja-mega': ['Water', 'Dark'],
  'excadrill-mega': ['Ground', 'Steel'],
  'froslass-mega': ['Ice', 'Ghost'],
  'crabominable-mega': ['Fighting', 'Ice'],
  'starmie-mega': ['Water', 'Psychic'],
  'skarmory-mega': ['Steel', 'Flying'],
  'glimmora-mega': ['Rock', 'Poison'],
  'meowstic-mega': ['Psychic'],
  'raichu-mega-x': ['Electric'],
  'raichu-mega-y': ['Electric'],
  'malamar-mega': ['Dark', 'Psychic'],
  'scrafty-mega': ['Dark', 'Fighting'],
  'chimecho-mega': ['Psychic', 'Steel'],
  'chandelure-mega': ['Fire', 'Ghost'],
}

describe('anagrafica — base stats corrette nella sessione I', () => {
  for (const [slug, attese] of Object.entries(STATS_CORRETTE)) {
    it(`${slug} ha le base stats di Gen 9`, () => {
      expect(pokemonData[slug]).toBeDefined()
      expect(pokemonData[slug].stats).toEqual(attese)
    })
  }

  it('Zorua di Hisui NON viene allineato a NCP', () => {
    // L'unica voce in cui il valore giusto è il nostro e quello sbagliato è di
    // NCP. Il totale base coincide (330), quindi non è un ribilanciamento ma
    // una trascrizione; e i due valori in cui NCP differisce — PS 40 e Att.Sp
    // 80 — sono quelli dello Zorua di Unima. Questo test esiste perché un
    // futuro allineamento alla cieca reintrodurrebbe l'errore in silenzio.
    expect(pokemonData['zorua-hisui'].stats).toEqual([35, 60, 40, 85, 40, 70])
    expect(pokemonData['zorua'].stats).toEqual([40, 65, 40, 80, 40, 65])
  })
})

describe('anagrafica — tipi corretti nella sessione I', () => {
  for (const [slug, attesi] of Object.entries(TIPI_CORRETTI)) {
    it(`${slug} è ${attesi.join('/')}`, () => {
      expect(pokemonData[slug]).toBeDefined()
      expect(pokemonData[slug].type.map(i => TYPE_NAMES[i])).toEqual(attesi)
    })
  }
})

describe('anagrafica — nomi visibili', () => {
  it('Dewpider non si chiama più Dewpier', () => {
    expect(pokemonData['dewpider'].name).toBe('Dewpider')
  })

  it("Sirfetch'd non mostra una sequenza di escape", () => {
    // Il valore era la stringa letterale `Sirfetch\u2019d`: sette caratteri di
    // escape mai interpretati, che a schermo si leggevano tali e quali.
    expect(pokemonData['sirfetchd'].name).toBe("Sirfetch'd")
    expect(pokemonData['sirfetchd'].name).not.toContain('\\u')
  })
})

describe('guardie di forma su tutto pokemon.json', () => {
  it('ogni slug segue la convenzione [a-z0-9-]', () => {
    const fuori = Object.keys(pokemonData).filter(s => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))
    expect(
      fuori,
      'il trattino è l\'unico separatore ammesso: niente spazi, punti o apostrofi',
    ).toEqual([])
  })

  /**
   * ─── I NOMI DELLE ABILITÀ FINISCONO NEL PASTE SHOWDOWN ────────────────────
   *
   * `showdownHelpers.js` costruisce la riga `Ability:` con
   * `abilitiesData[slug]?.name`, e `receiver` aveva `name: 'receiver'` — una
   * su 310, tutte le altre capitalizzate. Il paste esportato diceva
   * `Ability: receiver`.
   *
   * Il difetto interessante non è la minuscola: è che il ripiego
   * `|| slot.ability.replace(...)` avrebbe capitalizzato da solo. Un valore
   * PRESENTE e sbagliato batte un ripiego giusto — la stessa forma delle 52
   * descrizioni inglesi troncate in R, dove la copia rotta faceva ombra
   * all'originale sano.
   */
  it('ogni nome di abilità comincia con la maiuscola', () => {
    const minuscole = Object.entries(abilitiesData)
      .filter(([, v]) => typeof v?.name === 'string' && v.name && v.name[0] !== v.name[0].toUpperCase())
      .map(([slug, v]) => `${slug} → ${v.name}`)
    expect(minuscole, 'finiscono nella riga `Ability:` del paste Showdown').toEqual([])
  })

  /**
   * ─── LA TABELLA DI MECCANICA NON CONTIENE TESTO ──────────────────────────
   *
   * Fino a T ogni voce di `ABILITY_EFFECTS` portava anche `desc`, `descOn` e
   * `descOff`: 198 voci, di cui 153 senza un solo campo meccanico. E quel
   * testo era duplicato nei file di traduzione.
   *
   * Non era ridondanza innocua: `AbilityFlags` lo usava come `defaultValue`, e
   * una chiave presente nel locale vince sul ripiego. In R si è scoperto che
   * 52 descrizioni inglesi erano troncate, e la copia rotta faceva ombra
   * all'originale sano che stava proprio lì. Si è potuto correggere solo
   * perché la seconda copia era intera: la volta dopo poteva andare al
   * contrario.
   *
   * Questa asserzione impedisce che una descrizione rientri di soppiatto nella
   * tabella sbagliata.
   */
  it('ABILITY_EFFECTS non contiene descrizioni', () => {
    const conTesto = Object.entries(ABILITY_EFFECTS)
      .filter(([, v]) => 'desc' in v || 'descOn' in v || 'descOff' in v)
      .map(([k]) => k)
    expect(conTesto, 'il testo vive in locales/*.json, non qui').toEqual([])
  })

  it('ogni voce di ABILITY_EFFECTS ha una ragione meccanica per esserci', () => {
    const vuote = Object.entries(ABILITY_EFFECTS)
      .filter(([, v]) => Object.keys(v).length === 0)
      .map(([k]) => k)
    expect(vuote).toEqual([])
  })

  it('ogni indice di tipo sta fra 0 e 17', () => {
    const fuori = Object.entries(pokemonData)
      .filter(([, v]) => (v.type || []).some(t => !Number.isInteger(t) || t < 0 || t > 17))
      .map(([s]) => s)
    expect(
      fuori,
      'un indice fuori intervallo non solleva errori: getEffectiveness lo ignora '
      + 'e il tipo sparisce dal calcolo senza che nessuno se ne accorga',
    ).toEqual([])
  })

  it('ogni voce ha sei base stats intere e positive', () => {
    const rotte = Object.entries(pokemonData)
      .filter(([, v]) => !Array.isArray(v.stats) || v.stats.length !== 6
        || v.stats.some(n => !Number.isInteger(n) || n <= 0))
      .map(([s]) => s)
    expect(rotte).toEqual([])
  })
})

describe('flag delle mosse importati dal vendor', () => {
  const conta = (flag) => Object.values(movesData).filter(m => m[flag]).length

  // I conteggi sono misurati, non stimati: sono quelli che `gen-flag-dati.mjs`
  // riporta girando sul vendor al commit 7919130. Se un aggiornamento del
  // vendor li sposta, questi test lo dicono invece di lasciarlo passare.
  it.each([
    ['punch', 22],
    ['sound', 18],
    ['bite', 9],
    ['slicing', 30],
    ['bullet', 26],
  ])('%s è impostato su %i mosse', (flag, atteso) => {
    expect(conta(flag)).toBe(atteso)
  })

  it('i flag sono sempre `true`, mai `false`', () => {
    // Convenzione ereditata da NCP e mantenuta: il campo esiste solo quando è
    // vero. Un `false` esplicito sarebbe indistinguibile da un dato mancante.
    for (const [nome, m] of Object.entries(movesData)) {
      for (const flag of ['punch', 'sound', 'bite', 'slicing', 'bullet']) {
        if (flag in m) expect(m[flag], `${nome}.${flag}`).toBe(true)
      }
    }
  })

  it('le mosse di riferimento hanno il flag giusto', () => {
    expect(movesData['boomburst'].sound).toBe(true)
    expect(movesData['crunch'].bite).toBe(true)
    expect(movesData['aqua cutter'].slicing).toBe(true)
    expect(movesData['aura sphere'].bullet).toBe(true)
    expect(movesData['drain punch'].punch).toBe(true)
    // Controllo negativo: una mossa che non è nessuna delle cinque cose.
    expect(movesData['earthquake'].sound).toBeUndefined()
    expect(movesData['earthquake'].bite).toBeUndefined()
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SESSIONE Y — Light of Ruin
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Mancava del tutto: l'import di un team con Floette-Mega dava «mossa non
 * trovata». Non è nemmeno nel riferimento vendorizzato, quindi non c'era una
 * fonte da cui trascriverla — **i valori li ha dati Simone leggendoli dal
 * gioco**, ed è l'unico modo che rispetta «trascrivere, non dedurre»: le altre
 * versioni della serie potrebbero averla bilanciata diversamente.
 *
 * `num` è assente di proposito: non lo legge nessuno per le mosse, e 57 voci
 * su 810 ne erano già senza. Inventarne uno sarebbe stato un dato non
 * verificato messo lì per simmetria.
 */
describe('Light of Ruin', () => {
  it('esiste con i valori dati dal gioco', () => {
    const m = movesData['light of ruin']
    expect(m).toBeDefined()
    expect(m.type).toBe(17)        // Folletto
    expect(m.category).toBe(1)     // speciale
    expect(m.power).toBe(140)
    expect(m.recoil).toEqual({ type: 'damage', fraction: [1, 2] })
  })

  it('si importa da un paste Showdown', () => {
    const r = parseShowdownPaste('Floette-Mega @ Leftovers\nAbility: Fairy Aura\n- Light of Ruin')
    expect(r.warnings).toEqual([])
    expect(r.pokemon[0].moves[0]).toBe('light of ruin')
  })

  it('ha un nome in entrambe le lingue', () => {
    // Senza questo, l'interfaccia mostrerebbe la chiave grezza «light of ruin»
    // in minuscolo: il `defaultValue` protegge dall'assenza, e questo test
    // controlla che l'assenza non ci sia.
    expect(inglese.moves['light of ruin']).toBe('Light of Ruin')
    expect(italiano.moves['light of ruin']).toBeTruthy()
    expect(italiano.moves['light of ruin']).not.toBe(inglese.moves['light of ruin'])
  })
})
