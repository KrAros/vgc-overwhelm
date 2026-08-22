/**
 * src/__tests__/share.test.js
 *
 * Sessione C — blocco 2. Il link condiviso.
 *
 * ─── COSA COPRE ────────────────────────────────────────────────────────────
 *  1. round-trip: quello che esce dev'essere quello che entra
 *  2. lo stato di campo, che prima non veniva condiviso affatto
 *  3. abilityFlags e lastRespectsKOs, che la decodifica scartava
 *  4. validazione: un payload ostile o corrotto non entra nello store
 *  5. retrocompatibilità: i link già in giro devono continuare a funzionare
 */

import { describe, it, expect } from 'vitest'
import { encodeTeamsToURL, decodeTeamsFromURL } from '../store/useCalcStore.js'
import pokemonData from '../data/pokemon.json'

// ─── Generatore deterministico ─────────────────────────────────────────────
// Niente Math.random: un test che fallisce dev'essere ripetibile.

function rngDeterministico(seme) {
  let stato = seme
  return () => {
    stato = (stato * 1103515245 + 12345) & 0x7fffffff
    return stato / 0x7fffffff
  }
}

const CHIAVI = Object.keys(pokemonData)
const NATURE = ['adamant', 'modest', 'timid', 'jolly', 'relaxed', 'hardy']
const MOSSE  = ['shadow ball', 'earthquake', 'flare blitz', 'moonblast', 'protect', 'u-turn']
const ITEM   = ['life orb', 'choice band', 'sitrus berry', 'assault vest', null]

function teamCasuale(rnd) {
  return Array.from({ length: 6 }, () => {
    if (rnd() < 0.15) return slotVuoto()
    const chiave = CHIAVI[Math.floor(rnd() * CHIAVI.length)]
    return {
      key: chiave,
      moves: Array.from({ length: 4 }, () => rnd() < 0.2 ? null : MOSSE[Math.floor(rnd() * MOSSE.length)]),
      sps: Array.from({ length: 6 }, () => Math.floor(rnd() * 33)),
      nature: NATURE[Math.floor(rnd() * NATURE.length)],
      /**
       * Dalla sessione Z l'abilità dev'essere una che la SPECIE può avere.
       *
       * Prima questa riga assegnava `intimidate` a caso su qualunque specie,
       * cioè generava stati che l'app non è in grado di produrre — e da quando
       * la decodifica guarisce le squadre, su quegli stati il giro codifica →
       * decodifica non è più l'identità.
       *
       * Non è il criterio a essersi indebolito: era il generatore a provare
       * una proprietà su input impossibili.
       */
      ability: pokemonData[chiave]?.abilities?.[0] ?? null,
      item: ITEM[Math.floor(rnd() * ITEM.length)],
      atkBoost:   Math.floor(rnd() * 13) - 6,
      defBoost:   Math.floor(rnd() * 13) - 6,
      spAtkBoost: Math.floor(rnd() * 13) - 6,
      spDefBoost: Math.floor(rnd() * 13) - 6,
      speBoost:   Math.floor(rnd() * 13) - 6,
      abilityFlags: {
        intimidateActive:   rnd() < 0.3,
        flashFireActive:    rnd() < 0.3,
        multiscaleActive:   rnd() < 0.7,
        supremeOverlordKOs: Math.floor(rnd() * 6),
      },
      lastRespectsKOs: Math.floor(rnd() * 4),
    }
  })
}

function slotVuoto() {
  return {
    key: null, moves: [null, null, null, null], sps: [0,0,0,0,0,0],
    nature: null, ability: null, item: null,
    atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
    abilityFlags: {
      intimidateActive: false, flashFireActive: false,
      multiscaleActive: true, supremeOverlordKOs: 0,
    },
    lastRespectsKOs: 0,
  }
}

// ─── 1. Round-trip ─────────────────────────────────────────────────────────

describe('share — round-trip dei team', () => {
  it('50 team casuali sopravvivono a codifica e decodifica', () => {
    const rnd = rngDeterministico(20260731)
    for (let i = 0; i < 50; i++) {
      const t1 = teamCasuale(rnd)
      const t2 = teamCasuale(rnd)
      const decodificato = decodeTeamsFromURL(encodeTeamsToURL(t1, t2))
      expect(decodificato).not.toBeNull()
      expect(decodificato.team1).toEqual(t1)
      expect(decodificato.team2).toEqual(t2)
    }
  })

  it('due team vuoti restano due team vuoti', () => {
    const vuoto = Array.from({ length: 6 }, slotVuoto)
    const d = decodeTeamsFromURL(encodeTeamsToURL(vuoto, vuoto))
    expect(d.team1).toEqual(vuoto)
    expect(d.team2).toEqual(vuoto)
  })

  it('abilityFlags e lastRespectsKOs sopravvivono — prima venivano scartati', () => {
    const slot = {
      ...slotVuoto(), key: 'houndstone', lastRespectsKOs: 3,
      abilityFlags: {
        intimidateActive: true, flashFireActive: true,
        multiscaleActive: false, supremeOverlordKOs: 4,
      },
    }
    const team = [slot, ...Array.from({ length: 5 }, slotVuoto)]
    const d = decodeTeamsFromURL(encodeTeamsToURL(team, team))
    expect(d.team1[0].lastRespectsKOs).toBe(3)
    expect(d.team1[0].abilityFlags).toEqual(slot.abilityFlags)
  })

  it('multiscaleActive resta acceso di default e si spegne se lo era', () => {
    const acceso = { ...slotVuoto(), key: 'dragonite' }
    const spento  = { ...slotVuoto(), key: 'dragonite', abilityFlags: { ...slotVuoto().abilityFlags, multiscaleActive: false } }
    const team = [acceso, spento, ...Array.from({ length: 4 }, slotVuoto)]
    const d = decodeTeamsFromURL(encodeTeamsToURL(team, team))
    expect(d.team1[0].abilityFlags.multiscaleActive).toBe(true)
    expect(d.team1[1].abilityFlags.multiscaleActive).toBe(false)
  })
})

// ─── 2. Stato di campo ─────────────────────────────────────────────────────

describe('share — lo stato di campo viaggia nel link', () => {
  const vuoto = () => Array.from({ length: 6 }, slotVuoto)

  const campo = {
    weather: 'sand', terrain: 'grassy', trickRoom: true, doubleTarget: true,
    helpingHand: { t1: true,  t2: false },
    tailwind:    { t1: false, t2: true  },
    auroraVeil:  { t1: true,  t2: true  },
    lightScreen: { t1: false, t2: true  },
    reflect:     { t1: true,  t2: false },
    crit:        { t1: false, t2: false },
  }

  it('un link con Trick Room, Reflect e Tailwind li ripristina tutti', () => {
    const d = decodeTeamsFromURL(encodeTeamsToURL(vuoto(), vuoto(), campo))
    expect(d.field).toEqual(campo)
  })

  it('ogni coppia di lato si ricostruisce nel verso giusto', () => {
    const combinazioni = [
      { t1: false, t2: false }, { t1: true, t2: false },
      { t1: false, t2: true },  { t1: true, t2: true },
    ]
    for (const c of combinazioni) {
      const d = decodeTeamsFromURL(encodeTeamsToURL(vuoto(), vuoto(), { ...campo, reflect: c }))
      expect(d.field.reflect).toEqual(c)
    }
  })

  it('doubleTarget spento viaggia, perché il default è acceso', () => {
    const d = decodeTeamsFromURL(encodeTeamsToURL(vuoto(), vuoto(), { ...campo, doubleTarget: false }))
    expect(d.field.doubleTarget).toBe(false)
  })

  it('senza campo il link resta valido e field è null', () => {
    const d = decodeTeamsFromURL(encodeTeamsToURL(vuoto(), vuoto()))
    expect(d.field).toBeNull()
  })

  it('un meteo o terreno non riconosciuto viene scartato, non propagato', () => {
    const codificato = encodeTeamsToURL(vuoto(), vuoto(), { ...campo, weather: 'meteo-finto', terrain: 'terreno-finto' })
    const d = decodeTeamsFromURL(codificato)
    expect(d.field.weather).toBeNull()
    expect(d.field.terrain).toBeNull()
  })
})

// ─── 3. Robustezza dell'alfabeto ───────────────────────────────────────────

describe('share — base64url', () => {
  it('non produce mai i caratteri che una query string rovina', () => {
    const rnd = rngDeterministico(7)
    for (let i = 0; i < 30; i++) {
      const s = encodeTeamsToURL(teamCasuale(rnd), teamCasuale(rnd))
      expect(s).not.toMatch(/[+/=]/)
    }
  })

  it('sopravvive al passaggio in una query string vera', () => {
    const rnd = rngDeterministico(99)
    const t1 = teamCasuale(rnd), t2 = teamCasuale(rnd)
    const codificato = encodeTeamsToURL(t1, t2)
    const riletto = new URLSearchParams(`share=${codificato}`).get('share')
    expect(riletto).toBe(codificato)
    expect(decodeTeamsFromURL(riletto).team1).toEqual(t1)
  })

  it('legge ancora i link vecchi, in base64 classico', () => {
    // Formato pre-sessione C: btoa(unescape(encodeURIComponent(json))),
    // alfabeto standard e padding con '='.
    const json = JSON.stringify({
      t1: [{ k: 'amoonguss', n: 'relaxed', sp: [32,0,32,0,2,0] }],
      t2: [{ k: 'incineroar' }],
    })
    const vecchioFormato = btoa(unescape(encodeURIComponent(json)))
    const d = decodeTeamsFromURL(vecchioFormato)
    expect(d).not.toBeNull()
    expect(d.team1[0].key).toBe('amoonguss')
    expect(d.team1[0].sps).toEqual([32,0,32,0,2,0])
    expect(d.team2[0].key).toBe('incineroar')
    expect(d.team1).toHaveLength(6)   // normalizzato a sei slot
  })
})

// ─── 4. Validazione: il payload arriva da fuori ────────────────────────────

describe('share — un link malformato non entra nello store', () => {
  const codifica = (oggetto) => {
    const bytes = new TextEncoder().encode(JSON.stringify(oggetto))
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  it('una stringa illeggibile restituisce null invece di esplodere', () => {
    for (const spazzatura of ['', '!!!', 'non-base64-@@@', 'YWJj', '{}', 'undefined']) {
      expect(() => decodeTeamsFromURL(spazzatura)).not.toThrow()
    }
    expect(decodeTeamsFromURL('non-e-json-valido')).toBeNull()
  })

  it('un Pokémon inesistente diventa uno slot vuoto', () => {
    const d = decodeTeamsFromURL(codifica({ t1: [{ k: 'mewthree' }], t2: [] }))
    expect(d.team1[0].key).toBeNull()
  })

  it('una mossa inesistente diventa null, le altre restano', () => {
    const d = decodeTeamsFromURL(codifica({
      t1: [{ k: 'amoonguss', m: ['spore', 'mossa-finta', 'protect', null] }], t2: [],
    }))
    expect(d.team1[0].moves).toEqual(['spore', null, 'protect', null])
  })

  it('gli SP fuori range vengono riportati nei limiti', () => {
    const d = decodeTeamsFromURL(codifica({
      t1: [{ k: 'amoonguss', sp: [999, -50, 'ciao', null, 32, 16] }], t2: [],
    }))
    expect(d.team1[0].sps).toEqual([32, 0, 0, 0, 32, 16])
  })

  it('uno spread della lunghezza sbagliata viene scartato del tutto', () => {
    const d = decodeTeamsFromURL(codifica({ t1: [{ k: 'amoonguss', sp: [32, 32] }], t2: [] }))
    expect(d.team1[0].sps).toEqual([0,0,0,0,0,0])
  })

  it('i boost fuori range vengono clampati a ±6', () => {
    const d = decodeTeamsFromURL(codifica({
      t1: [{ k: 'amoonguss', ab: 99, db: -99, sab: 'x', sdb: 2.7, spb: null }], t2: [],
    }))
    const s = d.team1[0]
    expect(s.atkBoost).toBe(6)
    expect(s.defBoost).toBe(-6)
    expect(s.spAtkBoost).toBe(0)
    expect(s.spDefBoost).toBe(2)
    expect(s.speBoost).toBe(0)
  })

  it('una natura inventata non entra', () => {
    const d = decodeTeamsFromURL(codifica({ t1: [{ k: 'amoonguss', n: 'natura-finta' }], t2: [] }))
    expect(d.team1[0].nature).toBeNull()
  })

  it('un payload con più di sei slot viene troncato, uno più corto riempito', () => {
    const dieci = Array.from({ length: 10 }, () => ({ k: 'amoonguss' }))
    const d = decodeTeamsFromURL(codifica({ t1: dieci, t2: [{ k: 'amoonguss' }] }))
    expect(d.team1).toHaveLength(6)
    expect(d.team2).toHaveLength(6)
    expect(d.team2[5].key).toBeNull()
  })

  it('valori di tipo assurdo al posto degli slot non fanno danni', () => {
    const d = decodeTeamsFromURL(codifica({ t1: ['ciao', 42, null, [], true, { k: 'amoonguss' }], t2: 'non-un-array' }))
    expect(d.team1).toHaveLength(6)
    expect(d.team1[5].key).toBe('amoonguss')
    expect(d.team1[0].key).toBeNull()
    expect(d.team2).toHaveLength(6)
  })

  it('lastRespectsKOs e supremeOverlordKOs restano nei loro limiti', () => {
    const d = decodeTeamsFromURL(codifica({
      t1: [{ k: 'houndstone', lr: 99, af: { so: 99 } }], t2: [],
    }))
    expect(d.team1[0].lastRespectsKOs).toBe(3)
    expect(d.team1[0].abilityFlags.supremeOverlordKOs).toBe(5)
  })
})
/**
 * ─────────────────────────────────────────────────────────────────────────
 * SESSIONE Z — un link condiviso prima della correzione
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Stessa ragione del caricamento da `localStorage`: un link creato quando
 * l'import accettava un'abilità impossibile la porta dentro il payload, e chi
 * lo apre non ha modo di accorgersene — la tendina disegna comunque l'opzione
 * giusta perché il valore non è fra le sue `<option>`.
 *
 * Il link non si può «rigenerare»: è già in giro. Quindi la guarigione deve
 * stare in decodifica.
 */
describe('i link creati prima della correzione', () => {
  const conAbilita = (key, ability) => {
    const t = Array(6).fill(null).map(() => slotVuoto())
    t[0] = { ...slotVuoto(), key, ability }
    return t
  }

  it('l’abilità impossibile viene guarita in decodifica', () => {
    const d = decodeTeamsFromURL(encodeTeamsToURL(conAbilita('raichu-mega-y', 'static'), conAbilita('charizard-mega-y', 'blaze')))
    expect(d.team1[0].ability).toBe('no-guard')
    expect(d.team2[0].ability).toBe('drought')
  })

  it('un’abilità legittima attraversa intatta', () => {
    // IL CONTROLLO CHE SI MUOVE: `charizard` ha `blaze` come prima abilità e
    // `solar-power` come seconda, quindi una guarigione che sovrascrivesse
    // sempre con la prima farebbe fallire questo caso.
    const d = decodeTeamsFromURL(encodeTeamsToURL(conAbilita('charizard', 'solar-power'), conAbilita('charizard', 'blaze')))
    expect(d.team1[0].ability).toBe('solar-power')
    expect(d.team2[0].ability).toBe('blaze')
  })
})
