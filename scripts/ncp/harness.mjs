/**
 * scripts/ncp/harness.mjs
 *
 * Prende un caso scritto nel NOSTRO formato — lo stesso che accetta
 * `calculateDamage` — e restituisce i sedici roll che ci darebbe NCP.
 *
 *   import { creaHarness } from './scripts/ncp/harness.mjs'
 *   const h = creaHarness()
 *   h.calcola({ attacker, defender, move, field })
 *   // → { ok: true, rolls: [41,42,…,49], format: 'Doubles' }
 *   // → { ok: false, motivo: 'livello diverso da 50' }
 *
 * ─── LA REGOLA D'ORO ───────────────────────────────────────────────────────
 * Tutti i casi vanno raccolti con NCP impostato su **Doubles**. Sempre.
 * Il formato in NCP cambia tre cose: la penalità delle mosse ad area, il
 * moltiplicatore degli schermi (0xAAC nei doppi contro 0x800 nei singoli) e
 * Parental Bond. Un solo caso preso in Singles si porterebbe in casa il
 * moltiplicatore sbagliato dello schermo — e siccome il numero sembra
 * plausibile, resterebbe nella suite a validare l'errore per sempre.
 *
 * L'unica eccezione è meccanica, non discrezionale: il nostro `doubleTarget`
 * descrive quanti bersagli sono vivi in campo, cosa che NCP non modella.
 *
 *   doubleTarget = true  (2 bersagli)              → NCP "Doubles"
 *   doubleTarget = false (1 bersaglio), no schermi → NCP "Singles"
 *   doubleTarget = false (1 bersaglio) + schermo   → inesprimibile, si esclude
 *
 * La terza riga non è un buco nostro: è un buco loro. Il nostro modello della
 * penalità ad area è più fine del suo, e in quel punto le due descrizioni non
 * si sovrappongono. Il caso viene escluso con un motivo scritto, mai saltato
 * in silenzio.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { caricaNCP, statChampions, hpChampions } from './contesto.mjs'
import { creaTraduttore, naturaNCP, METEO_NCP, TERRENO_NCP } from './mappatura.mjs'

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const leggiJson = (p) => JSON.parse(fs.readFileSync(path.join(RADICE, p), 'utf8'))

/** I nostri SP sono un array indicizzato; NCP usa un oggetto con sigle. */
const NOSTRO_INDICE = { hp: 0, at: 1, df: 2, sa: 3, sd: 4, sp: 5 }
const STAT_NCP = ['at', 'df', 'sa', 'sd', 'sp']

export function creaHarness() {
  const ncp = caricaNCP()
  const nostri = {
    pokemon: leggiJson('src/data/pokemon.json'),
    mosse: leggiJson('src/data/moves.json'),
  }
  const tr = creaTraduttore(ncp, nostri)

  /**
   * Costruisce l'oggetto Pokémon che `GET_DAMAGE_SV` si aspetta.
   *
   * Nell'applicazione vera questo oggetto lo riempie il costruttore `Pokemon`
   * di `ap_calc.js` leggendo i campi della pagina. Qui lo riempiamo noi. I
   * campi che contano per il danno sono pochi (`rawStats`, `stats`, `boosts`,
   * tipi, abilità, strumento); gli altri ci sono perché il motore li tocca
   * lungo la strada e senza esploderebbe.
   */
  function costruisciPokemon({ slug, sps, nature, ability, item, boosts, mossaNCP, datiMossa, extra = {} }) {
    const nome = tr.pokemonNCP(slug)
    if (!nome) return null
    const dex = ncp.pokedex[nome]
    const nat = naturaNCP(nature)

    const rawStats = {}
    const spsNCP = {}
    const boostNCP = {}
    const evs = {}
    const ivs = {}
    for (const s of STAT_NCP) {
      spsNCP[s] = sps[NOSTRO_INDICE[s]] || 0
      boostNCP[s] = boosts[s] || 0
      evs[s] = 0
      ivs[s] = 31
      rawStats[s] = statChampions(dex.bs[s], spsNCP[s], nat, s, ncp.nature)
    }
    // `stats` sono le statistiche DOPO i boost. Nell'app le calcola
    // `CALCULATE_ALL_MOVES_SV` prima di chiamare il motore; qui tocca a noi.
    const stats = {}
    for (const s of STAT_NCP) stats[s] = ncp.getModifiedStat(rawStats[s], boostNCP[s])

    const maxHP = hpChampions(dex.bs.hp, sps[NOSTRO_INDICE.hp] || 0)

    const mossa = Object.assign({}, datiMossa, {
      name: mossaNCP,
      isCrit: !!extra.crit,
      hits: 1,
      isDouble: 0,
      combinePledge: 0,
      // Last Respects e Rage Fist: NCP calcola BP = potenza × (timesAffected + 1)
      timesAffected: extra.lastRespectsKOs || 0,
      usedOppMoveIndex: 0,
      getsStellarBoost: false,
      isPlusMove: false,
    })

    return {
      pokemon: {
        name: nome,
        type1: dex.t1,
        type2: dex.t2 || '',
        tera_type: dex.t1,
        level: 50,
        maxHP,
        // Multiscale legge `curHP === maxHP`. Quando il nostro toggle è spento,
        // togliamo un punto: è il modo di dire a NCP "non è più a vita piena".
        curHP: extra.hpPieni === false ? maxHP - 1 : maxHP,
        HPSPs: sps[NOSTRO_INDICE.hp] || 0,
        HPEVs: 0,
        HPIVs: 31,
        HPraw: maxHP,
        isDynamax: false,
        gmax_factor: false,
        isTerastalize: false,
        rawStats,
        boosts: boostNCP,
        stats,
        sps: spsNCP,
        evs,
        ivs,
        nature: nat,
        ability: ability || '',
        abilityOn: !!extra.abilitaAttiva,
        supremeOverlord: extra.supremeOverlordKOs || 0,
        rivalryGender: 'N/A',
        highestStat: -1,
        item: item || '',
        status: 'Healthy',
        toxicCounter: 0,
        moves: [mossa, mossa, mossa, mossa],
        glaiveRushMod: false,
        weight: dex.w,
        canEvolve: dex.canEvolve || false,
        isTransformed: false,
        hasCustomModifiers: false,
        hasType: ncp.setHasTypeFunc,
      },
      mossa,
    }
  }

  /**
   * Il lato del campo su cui sta il difensore. NCP passa qui schermi, meteo,
   * terreno e Helping Hand: sono trentatré parametri posizionali, e quelli che
   * non usiamo restano tutti a `false`.
   */
  function costruisciLato(field, format) {
    return new ncp.Side(
      format,
      TERRENO_NCP[field.terrain] || '',
      METEO_NCP[String(field.weather || '').toLowerCase()] || '',
      false,               // isGravity
      false, 0,            // isSR, spikes
      !!field.reflect,
      !!field.lightScreen,
      false,               // isForesight
      !!field.helpingHand,
      false, false,        // isFriendGuard, isBattery
      false,               // isProtect
      false, false, false, // isPowerSpot, isSteelySpirit, isNeutralizingGas
      false,               // isGmaxField
      false, false,        // isFlowerGiftSpD, isFlowerGiftAtk
      false, false,        // isTailwind, isSaltCure
      !!field.auroraVeil,
      false, false,        // isSwamp, isSeaFire
      false, false,        // isRedItem, isBlueItem
      false,               // isCharge
      false, false, false, false, false, false, // leechSeed…nightmare
    )
  }

  /**
   * @returns {{ok: true, rolls: number[], format: string, entita: object}}
   *        | {{ok: false, motivo: string}}
   */
  function calcola({ attacker: a, defender: d, move, field = {} }) {
    // ── 1. Cose che NCP non sa esprimere ───────────────────────────────────
    if ((a.level ?? 50) !== 50) {
      return { ok: false, motivo: 'livello diverso da 50 — in Champions NCP lo forza a 50' }
    }
    if (d.defAbilityFlags?.intimidateActive) {
      return {
        ok: false,
        motivo: 'Intimidate attivo — in NCP il calo di Attacco lo applica il wrapper d\'interfaccia, non il motore',
      }
    }
    if ((a.lastRespectsKOs || 0) > 3) {
      return {
        ok: false,
        motivo: 'Last Respects oltre 3 KO — noi limitiamo a 3 (in doppi porti 4 Pokémon), NCP non limita',
      }
    }

    // ── 2. Traduzione dei nomi ─────────────────────────────────────────────
    const mossaNCP = tr.mossaNCP(move)
    if (!mossaNCP) return { ok: false, motivo: `mossa non presente in NCP: ${move}` }
    const datiMossa = ncp.mosse[mossaNCP]

    // ── 3. Il formato ──────────────────────────────────────────────────────
    const eSpread = datiMossa.isSpread === true
    const schermoAttivo = !!(field.reflect || field.lightScreen || field.auroraVeil)
    if (eSpread && !field.doubleTarget && schermoAttivo) {
      return {
        ok: false,
        motivo: 'mossa ad area su bersaglio singolo con schermo attivo — non esprimibile: '
              + 'in NCP il formato governa insieme penalità d\'area e moltiplicatore dello schermo',
      }
    }
    const format = (eSpread && !field.doubleTarget) ? 'Singles' : 'Doubles'

    // ── 4. Costruzione ─────────────────────────────────────────────────────
    const att = costruisciPokemon({
      slug: a.atkPokemon,
      sps: a.atkSPs || [0, 0, 0, 0, 0, 0],
      nature: a.atkNature,
      ability: tr.abilitaNCP(a.atkAbility),
      item: tr.strumentoNCP(a.atkItem),
      boosts: { at: a.atkBoost || 0, sa: a.spAtkBoost || 0 },
      mossaNCP,
      datiMossa,
      extra: {
        crit: field.crit,
        lastRespectsKOs: a.lastRespectsKOs || 0,
        abilitaAttiva: a.atkAbilityFlags?.flashFireActive,
        supremeOverlordKOs: a.atkAbilityFlags?.supremeOverlordKOs,
      },
    })
    if (!att) return { ok: false, motivo: `specie non presente in NCP: ${a.atkPokemon}` }

    const dif = costruisciPokemon({
      slug: d.defPokemon,
      sps: d.defSPs || [0, 0, 0, 0, 0, 0],
      nature: d.defNature,
      ability: tr.abilitaNCP(d.defAbility),
      item: tr.strumentoNCP(d.defItem),
      boosts: { df: d.defBoost || 0, sd: d.spDefBoost || 0 },
      mossaNCP,
      datiMossa,
      extra: { hpPieni: d.defAbilityFlags?.multiscaleActive !== false },
    })
    if (!dif) return { ok: false, motivo: `specie non presente in NCP: ${d.defPokemon}` }

    // Un'abilità che non esiste nel loro elenco arriverebbe qui come stringa
    // vuota, e il motore la ignorerebbe in silenzio: il danno uscirebbe
    // plausibile ma calcolato senza quell'abilità. Meglio escludere il caso.
    if (a.atkAbility && !att.pokemon.ability) {
      return { ok: false, motivo: `abilità non presente in NCP: ${a.atkAbility}` }
    }
    if (d.defAbility && !dif.pokemon.ability) {
      return { ok: false, motivo: `abilità non presente in NCP: ${d.defAbility}` }
    }
    if (a.atkItem && !att.pokemon.item) {
      return { ok: false, motivo: `strumento non presente in NCP: ${a.atkItem}` }
    }
    if (d.defItem && !dif.pokemon.item) {
      return { ok: false, motivo: `strumento non presente in NCP: ${d.defItem}` }
    }

    // ── 5. Esecuzione ──────────────────────────────────────────────────────
    let risultato
    try {
      risultato = ncp.GET_DAMAGE_SV(att.pokemon, dif.pokemon, att.mossa, costruisciLato(field, format))
    } catch (e) {
      return { ok: false, motivo: `errore dentro il motore NCP: ${e.message}` }
    }

    // Quando NCP prevede un secondo calcolo (bacca che si consuma, Weak Armor…)
    // restituisce un array di array: il primo elemento è il colpo che ci
    // interessa, gli altri sono i colpi successivi in quello scenario.
    const danno = Array.isArray(risultato.damage[0]) ? risultato.damage[0] : risultato.damage

    // Sedici roll è l'esito normale. Qualunque altra cosa significa che NCP
    // considera il colpo nullo: immunità di tipo, immunità da abilità, oppure
    // una mossa che sotto quel meteo fallisce del tutto (le mosse Fire sotto
    // pioggia intensa, quelle Water sotto sole estremo).
    //
    // Questo NON è un motivo di esclusione: è un risultato, e va confrontato.
    // Se noi calcoliamo un danno dove NCP dice zero, quella è esattamente la
    // divergenza che vogliamo vedere — è il §1.6 del documento diagnostico.
    if (!Array.isArray(danno) || danno.length !== 16) {
      return {
        ok: true,
        nullo: true,
        rolls: [],
        format,
        defHP: dif.pokemon.maxHP,
        descrizione: risultato.description,
        entita: { pokemon: [a.atkPokemon, d.defPokemon], mosse: [move] },
      }
    }

    return {
      ok: true,
      nullo: false,
      rolls: danno,
      format,
      defHP: dif.pokemon.maxHP,
      descrizione: risultato.description,
      entita: {
        pokemon: [a.atkPokemon, d.defPokemon],
        mosse: [move],
      },
    }
  }

  return { calcola, verificaAnagrafica: tr.verificaAnagrafica, traduttore: tr, ncp }
}
