// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

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
        // ─── I PUNTI SALUTE, CHE DA NOI NON ESISTONO ─────────────────────
        //
        // Il nostro modello non ha i punti salute: ha delle levette. NCP
        // invece legge `curHP`, e tre condizioni diverse ci si appoggiano.
        // Qui si traduce, ed e' l'unico posto dove si traduce.
        //
        //   `hpPieni: false`  → un punto in meno. Multiscale legge
        //                       `curHP === maxHP`, e questo lo spegne.
        //   `psBassi: true`   → un terzo. Overgrow, Blaze, Torrent e Swarm
        //                       leggono `curHP <= maxHP / 3`, Defeatist
        //                       `<= maxHP / 2`: `floor(maxHP / 3)` soddisfa
        //                       tutt'e due, quindi un valore solo basta.
        //
        // ATTENZIONE, ed e' scritto anche nel test: abbassare `curHP` cambia
        // in NCP anche la POTENZA di Eruption, Water Spout, Flail, Reversal,
        // Crush Grip e Wring Out (`damage_MASTER.js:1354`, `:1360`, `:1367`,
        // `:1371`). Quelle mosse il nostro motore non le modella affatto — e'
        // il divario delle mosse registrato in CONTRIBUTING — quindi un caso
        // che accenda `psBassi` su una di loro divergerebbe per una ragione
        // che non c'entra con l'abilita' in prova.
        curHP: extra.psBassi === true
          ? Math.floor(maxHP / 3)
          : (extra.hpPieni === false ? maxHP - 1 : maxHP),
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
        // Era `'Healthy'` fisso, quindi la bruciatura, Guts, Flare Boost,
        // Toxic Boost, Marvel Scale, Facade, Hex, Venoshock, Smelling Salts,
        // Wake-Up Slap e Dream Eater non erano verificabili: il riferimento
        // vedeva sempre un Pokemon sano.
        status: STATO_NCP[extra.stato] || 'Healthy',
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
      // ── Le cinque caselle dell'ALLEATO ──────────────────────────────────
      // Erano `false` fisso, quindi non verificabili: qualunque cosa il motore
      // ne facesse, il riferimento diceva sempre «spente». Adesso arrivano dal
      // nostro `field`, con i nomi che `buildField` gli dà.
      //
      // `isFlowerGiftAtk` e `isFlowerGiftSpD` sono due campi qui e uno solo da
      // noi: la traduzione la fa `buildField`, che dallo stesso interruttore
      // ricava il verso — Attacco sul lato che attacca, Difesa Speciale su
      // quello che subisce.
      !!field.friendGuard, !!field.battery,
      // Era `false` fisso, quindi Unseen Fist e Piercing Drill non erano
      // verificabili: il riferimento vedeva sempre un bersaglio scoperto.
      !!field.protect,     // isProtect
      // Era `false` fisso: `field.isNeutralizingGas` e' letto dalle due aure
      // (`damage_MASTER.js:1574` e `:1655`) e dalle quattro Rovina
      // (`:1908-1909`, `:2077-2078`), che senza di esso restavano accese
      // anche col gas in campo.
      !!field.powerSpot, !!field.steelySpiritAlleato, !!field.gasNeutro,
      false,               // isGmaxField
      !!field.flowerGiftSpD, !!field.flowerGiftAtk,
      false, false,        // isTailwind, isSaltCure
      !!field.auroraVeil,
      false, false,        // isSwamp, isSeaFire
      false, false,        // isRedItem, isBlueItem
      false,               // isCharge
      false, false, false, false, false, false, // leechSeed…nightmare
    )
  }

  /**
   * Le caselle dell'interfaccia di NCP che il nostro modello tiene accese.
   *
   * Tre meccaniche in NCP non si leggono dall'abilità del Pokémon ma da una
   * casella di spunta della pagina, e `calcBPMods` le interroga così:
   *
   *     $("input:checkbox[id='" + move.type.toLowerCase() + "-aura']:checked")
   *     $("input:checkbox[id='aura-break']:checked")
   *
   * Il nostro modello non ha caselle di campo: dice la stessa cosa mettendo
   * l'abilità addosso a un Pokémon. Questa è la traduzione fra i due, ed è
   * dello stesso genere di quelle che l'harness fa già — `doubleTarget` →
   * formato, `multiscaleActive` → `curHP`. La ragione per cui è lecita, e come
   * si verifica che non stia aiutando NCP, sta in `prelude.js` §2-bis.
   *
   * L'aura vale per CHIUNQUE sia in campo, non solo per chi attacca: NCP la
   * chiede per tipo di mossa e non per lato, e la descrizione la attribuisce
   * indifferentemente a `attacker.ability` o a `defAbility`. Perciò si guardano
   * tutte e due le abilità.
   */
  const CASELLE_DA_ABILITA = {
    'Fairy Aura': 'fairy-aura',
    'Dark Aura': 'dark-aura',
    'Aura Break': 'aura-break',
    // Le quattro Rovina: nel riferimento sono caselle dell'interfaccia, non
    // abilita' lette da uno slot, esattamente come le aure. Il nostro modello
    // le legge dai due slot dello scontro, quindi qui si spunta la casella
    // quando uno dei due la porta — la stessa traduzione gia' fatta per le
    // aure, e lo stesso motivo.
    'Tablets of Ruin': 'tablets-of-ruin',
    'Vessel of Ruin': 'vessel-of-ruin',
    'Sword of Ruin': 'sword-of-ruin',
    'Beads of Ruin': 'beads-of-ruin',
  }
  /**
   * Le cinque che il riferimento accende dai PUNTI SALUTE, non da `abilityOn`.
   *
   * Trascritte dai nomi NCP: Overgrow, Blaze, Torrent e Swarm leggono
   * `curHP <= maxHP / 3` (`damage_MASTER.js:1942-1945`), Defeatist
   * `curHP <= maxHP / 2` (`:1925`).
   *
   * Da noi sono una levetta. Questo insieme e' il punto in cui la levetta
   * diventa punti salute: senza, accenderla non cambierebbe NIENTE nel
   * riferimento, e il confronto direbbe che divergiamo quando invece e'
   * l'oracolo a non essere stato interrogato bene.
   */
  /**
   * Il gas in campo, ricavato dai due slot.
   *
   * Nel riferimento e' `field.getNeutralGas()`, una casella dell'interfaccia
   * indipendente da chi e' in campo. Da noi si legge dai due Pokemon dello
   * scontro — la regola gia' scelta per le aure e per le quattro Rovina — e
   * qui si traduce, come si traduce la levetta in punti salute.
   *
   * Si guarda l'abilita' ORIGINALE, non quella dopo Trace: se Trace copiasse
   * un Neutralizing Gas, vorrebbe dire che il copiato ce l'ha gia'.
   */
  /**
   * I nostri sei stati nei nomi che il riferimento usa.
   *
   * Trascritti da `damage_MASTER.js`: `Healthy`, `Burned`, `Paralyzed`,
   * `Poisoned`, `Badly Poisoned`, `Asleep`. Congelato non c'e' — la stringa
   * `Frozen` non compare in tutto il vendor — e infatti non e' fra i nostri.
   */
  const STATO_NCP = {
    healthy: 'Healthy',
    burned: 'Burned',
    paralyzed: 'Paralyzed',
    poisoned: 'Poisoned',
    'badly-poisoned': 'Badly Poisoned',
    asleep: 'Asleep',
  }

  const gasInCampo = (a, d) =>
    tr.abilitaNCP(a) === 'Neutralizing Gas' || tr.abilitaNCP(d) === 'Neutralizing Gas'

  const ABILITA_A_PS_BASSI = new Set([
    'Overgrow', 'Blaze', 'Torrent', 'Swarm', 'Defeatist',
  ])

  const caselleDa = (...abilitaNCP) =>
    [...new Set(abilitaNCP.map(x => CASELLE_DA_ABILITA[x]).filter(Boolean))]

  /**
   * @returns {{ok: true, rolls: number[], format: string, entita: object}}
   *        | {{ok: false, motivo: string}}
   */
  function calcola({ attacker: a, defender: d, move, field = {} }) {
    // ── 1. Cose che NCP non sa esprimere ───────────────────────────────────
    if ((a.level ?? 50) !== 50) {
      return { ok: false, motivo: 'livello diverso da 50 — in Champions NCP lo forza a 50' }
    }
    // Intimidate non è applicato da `GET_DAMAGE_SV`: lo applica
    // `CALCULATE_ALL_MOVES_SV`, un livello sopra. Confrontare qui un caso con
    // Intimidate acceso darebbe una divergenza finta, perché noi il calo lo
    // applichiamo e questo ingresso no.
    //
    // Fino a F-2 la motivazione diceva «lo applica il wrapper d'interfaccia»,
    // e la conclusione taciuta era «quindi non è verificabile». Era falso: è
    // verificabile dall'ingresso alto, e da lì `calcolaConPreparazione` lo
    // verifica. L'esclusione resta perché resta vera *per questo ingresso*.
    if (d.defAbilityFlags?.intimidateActive) {
      return {
        ok: false,
        motivo: 'Intimidate attivo — fuori portata da questo ingresso; lo copre `calcolaConPreparazione`',
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
      boosts: { at: a.atkBoost || 0, sa: a.spAtkBoost || 0, sp: a.atkSpeBoost || 0 },
      mossaNCP,
      datiMossa,
      extra: {
        crit: field.crit,
        lastRespectsKOs: a.lastRespectsKOs || 0,
        // `abilityOn` del riferimento è uno solo, letto da condizioni diverse:
        // Flash Fire, Plus, Minus, Electromorphosis, Protean, Libero. Da noi
        // sono due flag — `flashFireActive` (che c'era già) e `interruttore`
        // (le altre cinque) — e qui si riuniscono, perché un Pokémon ha
        // un'abilità sola e non possono mai essere accesi tutt'e due sul serio.
        //
        // Era `flashFireActive` e basta: qualunque cosa il motore facesse con
        // le altre cinque, il riferimento le vedeva sempre spente.
        // `intimidateActive` c'e' anche qui e non solo nell'altro percorso: il
        // flag descrive lo stesso fatto — «l'abilita' di chi attacca e'
        // accesa» — e due costruttori che lo traducono in modo diverso sono
        // due modi di rispondere alla stessa domanda. In questo percorso non
        // cambia nessun numero (`checkIntimidate` sta nell'ingresso alto), ma
        // il giorno che lo cambiasse, cambierebbe da solo.
        abilitaAttiva: a.atkAbilityFlags?.flashFireActive
          || a.atkAbilityFlags?.interruttore
          || a.atkAbilityFlags?.intimidateActive,
        psBassi: ABILITA_A_PS_BASSI.has(tr.abilitaNCP(a.atkAbility))
          && a.atkAbilityFlags?.interruttore === true,
        stato: a.atkStatus,
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
      boosts: { df: d.defBoost || 0, sd: d.spDefBoost || 0, sp: d.defSpeBoost || 0 },
      mossaNCP,
      datiMossa,
      extra: {
        hpPieni: d.defAbilityFlags?.multiscaleActive !== false,
        stato: d.defStatus,
      },
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

    // ── 4-bis. LA VELOCITA' FINALE ─────────────────────────────────────────
    //
    // ─── COSA MANCAVA, E PERCHE' NESSUN TEST POTEVA VEDERLO ────────────────
    //
    // Questo percorso entra da `GET_DAMAGE_SV`, un livello sotto l'ingresso
    // vero. E l'ingresso vero, prima di ogni calcolo, fa due cose alla
    // Velocita' che qui non succedevano (`damage_SV.js:43-53`):
    //
    //     p1.stats[SP] = getModifiedStat(p1.rawStats[SP], p1.boosts[SP]);
    //     setHighestStat(p1, 0);
    //     p1.stats[SP] = getFinalSpeed(p1, weather, tailwind, swamp, terrain);
    //
    // `getFinalSpeed` e' Ferrolimo, Ferroblocco, Quick Feet, Slow Start, le
    // abilita' meteo, Surge Surfer, Unburden, Ventoincoda, il paradosso e la
    // paralisi. Senza, `stats[SP]` restava la Velocita' coi soli stadi.
    //
    // Chi la legge sono due cose: l'ordine di turno di Analytic
    // (`damage_SV.js:147`) e la potenza di Gyro Ball ed Electro Ball
    // (`damage_MASTER.js:1307` e `:1312`). Su tutt'e due l'harness rispondeva
    // con una Velocita' che nell'applicazione vera non esiste — e siccome il
    // nostro motore faceva lo stesso errore, il confronto era verde.
    //
    // E' la stessa forma del difetto che confondeva un danno fisso con un
    // colpo nullo: l'oracolo rispondeva, rispondeva sbagliato, e nessuno
    // poteva accorgersene perche' sbagliava d'accordo con noi.
    //
    // ─── COSA RESTA FUORI, DICHIARATO ─────────────────────────────────────
    //
    //   Ventoincoda      il nostro `field` non arriva fin qui coi due lati
    //                    separati, e `costruisciCampo` lo passa `false` anche
    //                    nell'altro percorso. Resta `false` da tutt'e due le
    //                    parti, quindi non e' una divergenza nascosta: e' una
    //                    casella che nessuno dei due accende.
    //   Grass/Water      le mosse Pledge non esistono nel nostro modello, come
    //     Pledge         gia' dichiarato in `utils/speedOrder.js`.
    //   il paradosso     `checkParadoxAbilities` gira nell'ingresso alto, non
    //                    qui: `paradoxAbilityBoost` resta indefinito e il
    //                    x1,5 non si accende. Chi vuole verificarlo usa
    //                    `calcolaConPreparazione`, che quello strato lo esegue.
    const meteoNCP = METEO_NCP[String(field.weather || '').toLowerCase()] || ''
    const terrenoNCP = TERRENO_NCP[field.terrain] || ''
    for (const [p, posizione] of [[att.pokemon, 0], [dif.pokemon, 1]]) {
      ncp.setHighestStat(p, posizione)
      p.stats.sp = ncp.getFinalSpeed(p, meteoNCP, false, false, terrenoNCP)
    }

    // ── 5. Esecuzione ──────────────────────────────────────────────────────
    let risultato
    try {
      ncp.spuntaCaselle(caselleDa(att.pokemon.ability, dif.pokemon.ability))
      risultato = ncp.GET_DAMAGE_SV(att.pokemon, dif.pokemon, att.mossa, costruisciLato({ ...field, gasNeutro: gasInCampo(a.atkAbility, d.defAbility) }, format))
    } catch (e) {
      return { ok: false, motivo: `errore dentro il motore NCP: ${e.message}` }
    } finally {
      // Il contesto NCP è uno solo e viene riusato da tutti i casi: una casella
      // lasciata accesa si porterebbe dietro un moltiplicatore nel caso dopo,
      // che uscirebbe plausibile e sbagliato.
      ncp.spuntaCaselle([])
    }

    // Quando NCP prevede un secondo calcolo (bacca che si consuma, Weak Armor…)
    // restituisce un array di array: il primo elemento è il colpo che ci
    // interessa, gli altri sono i colpi successivi in quello scenario.
    const multiplo = Array.isArray(risultato.damage[0])
    const danno = multiplo ? risultato.damage[0] : risultato.damage

    // ─── I COLPI SUCCESSIVI, CHE PRIMA SI BUTTAVANO VIA ──────────────────────
    //
    // Fino a Parental Bond bastava il primo: gli altri elementi descrivono
    // scenari — la bacca consumata, Weak Armor che ha già abbassato la Difesa —
    // che il nostro modello non esprime, quindi non c'era niente da
    // confrontare.
    //
    // Parental Bond li rende necessari: il SECONDO colpo è il suo, ed è dove
    // vive il quarto di danno. Senza esporlo, l'unica cosa verificabile
    // sarebbe il primo colpo — che con l'abilità è identico a quello senza, e
    // quindi non proverebbe niente.
    const rollsAggiuntivi = multiplo ? risultato.damage.slice(1) : []

    // Sedici roll è l'esito normale. Un array vuoto, o `[0]`, significa che NCP
    // considera il colpo nullo: immunità di tipo, immunità da abilità, oppure
    // una mossa che sotto quel meteo fallisce del tutto (le mosse Fire sotto
    // pioggia intensa, quelle Water sotto sole estremo).
    //
    // Questo NON è un motivo di esclusione: è un risultato, e va confrontato.
    // Se noi calcoliamo un danno dove NCP dice zero, quella è esattamente la
    // divergenza che vogliamo vedere — è il §1.6 del documento diagnostico.
    // ─── UN SOLO NUMERO NON E' UN COLPO NULLO ────────────────────────────
    //
    // Sedici roll e' l'esito normale. `[0]` — o un array vuoto — e' il colpo
    // nullo. Ma c'e' un terzo esito, e questa funzione lo confondeva col
    // secondo: il DANNO FISSO.
    //
    // Il riferimento ha un blocco intero di mosse che tornano UN numero solo
    // (`damage_MASTER.js:1240-1283`): Seismic Toss e Night Shade tornano il
    // livello, Dragon Rage 40, Sonic Boom 20, e le quattro mosse KO — Fissure,
    // Guillotine, Horn Drill, Sheer Cold — tornano i punti salute del
    // difensore. Non hanno variazione, quindi un numero solo, e il numero c'e'.
    //
    // Chiedendo a questo harness «Fissure su Walrein» la risposta era
    // `nullo: true, rolls: []`, cioe' «il riferimento dice zero». Falso: il
    // riferimento dice 185. La distinzione e' fra `[0]` e `[185]`, e prima non
    // si guardava.
    //
    // Il colpo nullo resta nullo: `[0]` non e' un danno fisso.
    if (Array.isArray(danno) && danno.length === 1 && danno[0] > 0) {
      return {
        ok: true,
        nullo: false,
        fisso: true,
        rolls: danno,
        rollsAggiuntivi,
        format,
        defHP: dif.pokemon.maxHP,
        descrizione: risultato.description,
        entita: { pokemon: [a.atkPokemon, d.defPokemon], mosse: [move] },
      }
    }

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
      rollsAggiuntivi,
      format,
      defHP: dif.pokemon.maxHP,
      descrizione: risultato.description,
      entita: {
        pokemon: [a.atkPokemon, d.defPokemon],
        mosse: [move],
      },
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // L'ingresso alto: CALCULATE_ALL_MOVES_SV
  // ───────────────────────────────────────────────────────────────────────────
  //
  // ─── PERCHÉ NON BASTAVA `calcola` ──────────────────────────────────────────
  // `GET_DAMAGE_SV` riceve due Pokémon GIÀ PREPARATI. Tutto ciò che in NCP
  // succede prima — Intimidate che abbassa l'Attacco, Intrepid Sword che lo
  // alza, Booster Energy che accende Protosynthesis, Download che legge le
  // difese avversarie — vive in `CALCULATE_ALL_MOVES_SV`, un livello sopra.
  //
  // Entrando in basso quello strato non era confrontato con niente. Peggio:
  // `calcola` ESCLUDEVA i casi con Intimidate attivo dicendo che «lo applica
  // il wrapper d'interfaccia» — il che era vero solo perché entravamo sotto al
  // wrapper. L'esclusione è tolta: adesso lo strato lo eseguiamo.
  //
  // ─── COSA CAMBIA NELLA COSTRUZIONE ─────────────────────────────────────────
  // Due differenze rispetto a `calcola`, entrambe obbligatorie:
  //
  //   1. `stats` NON va precalcolata. `CALCULATE_ALL_MOVES_SV` la ricava da
  //      `rawStats` e `boosts` DOPO aver applicato Intimidate e compagnia. Se
  //      la scrivessimo noi prima, verrebbe sovrascritta — ma i boost che
  //      legge sarebbero quelli modificati, quindi il risultato sarebbe giusto
  //      per caso. Meglio non dipendere da un caso.
  //
  //   2. Le quattro mosse devono essere quattro OGGETTI DISTINTI. Il motore
  //      scrive dentro l'oggetto mossa (`checkMoveTypeChange` ne cambia il
  //      tipo, `checkContactOverride` il contatto) e qui viene chiamato quattro
  //      volte di fila per lato. Con lo stesso riferimento ripetuto, la
  //      seconda chiamata partirebbe dalla mossa che la prima ha modificato.
  //      In `calcola`, che chiama una volta sola, il problema non si vede.
  //
  // ─── COME SI LEGGE IL RISULTATO ────────────────────────────────────────────
  // Restituisce `results[lato][mossa]`. Noi mettiamo l'attaccante come `p2`
  // (indice 1) e leggiamo `results[1][0]`, perché il portatore dell'abilità di
  // supporto — chi ha Intimidate — è il difensore, cioè `p1`.

  /**
   * L'oggetto campo che l'ingresso alto si aspetta: non un `Side`, ma un
   * oggetto con dei metodi. Nell'app vera è il `Field` di `ap_calc.js`.
   *
   * `getSide(i)` restituisce il lato del giocatore i. Attenzione all'ordine in
   * `CALCULATE_ALL_MOVES_SV`: quando p1 attacca gli viene passato `getSide(1)`,
   * cioè il lato del DIFENSORE. È coerente col resto del motore — gli schermi
   * che contano sono quelli di chi subisce — ma è controintuitivo da leggere.
   */
  function costruisciCampo(field, format) {
    const latoP0 = costruisciLato(field, format)
    const latoP1 = costruisciLato(field, format)

    // Il meteo è MUTABILE, e non per comodità: `checkAirLock`
    // (`damage_MASTER.js:411`) chiama `field.clearWeather()`, cioè cancella il
    // meteo dal campo per il resto del calcolo. Senza questo metodo l'ingresso
    // alto scoppiava con «field.clearWeather is not a function» — ed è così
    // che si è scoperto che Air Lock e Cloud Nine da `GET_DAMAGE_SV` non
    // passano nemmeno.
    //
    // Va azzerato in TRE posti, non uno: la copia locale che `getWeather`
    // restituisce, e il campo `weather` dei due lati. Le funzioni del danno
    // ricevono un LATO (`field.getSide(i)`) e leggono `field.weather` da
    // quello, non dal campo: azzerare solo il campo lascerebbe il sole acceso
    // dentro `calcBPMods` e il numero sarebbe giusto per metà.
    let meteoCorrente = METEO_NCP[String(field.weather || '').toLowerCase()] || ''

    return {
      getTerrain: () => TERRENO_NCP[field.terrain] || '',
      getWeather: () => meteoCorrente,
      clearWeather: () => {
        meteoCorrente = ''
        latoP0.weather = ''
        latoP1.weather = ''
      },
      // Era `false` fisso, quindi `checkNeutralGas` non spegneva mai niente e
      // Neutralizing Gas non era verificabile. Il valore arriva da noi: nel
      // riferimento e' una casella dell'interfaccia, da noi si ricava dai due
      // slot come le aure e le Rovina.
      getNeutralGas: () => !!field.gasNeutro,
      getSide: (i) => (i === 0 ? latoP0 : latoP1),
      getTailwind: () => false,
      getSwamp: () => false,
    }
  }

  /**
   * Come `calcola`, ma passando dallo strato di preparazione.
   *
   * @returns {{ok: true, rolls: number[], boostFinali: object}}
   *        | {{ok: false, motivo: string}}
   */
  function calcolaConPreparazione({ attacker: a, defender: d, move, field = {} }) {
    if ((a.level ?? 50) !== 50) {
      return { ok: false, motivo: 'livello diverso da 50 — in Champions NCP lo forza a 50' }
    }

    const mossaNCP = tr.mossaNCP(move)
    if (!mossaNCP) return { ok: false, motivo: `mossa non presente in NCP: ${move}` }
    const datiMossa = ncp.mosse[mossaNCP]

    const eSpread = datiMossa.isSpread === true
    const schermoAttivo = !!(field.reflect || field.lightScreen || field.auroraVeil)
    if (eSpread && !field.doubleTarget && schermoAttivo) {
      return { ok: false, motivo: 'mossa ad area su bersaglio singolo con schermo attivo — non esprimibile' }
    }
    const format = (eSpread && !field.doubleTarget) ? 'Singles' : 'Doubles'

    const att = costruisciPokemon({
      slug: a.atkPokemon,
      sps: a.atkSPs || [0, 0, 0, 0, 0, 0],
      nature: a.atkNature,
      ability: tr.abilitaNCP(a.atkAbility),
      item: tr.strumentoNCP(a.atkItem),
      boosts: { at: a.atkBoost || 0, sa: a.spAtkBoost || 0, sp: a.atkSpeBoost || 0 },
      mossaNCP,
      datiMossa,
      extra: {
        crit: field.crit,
        lastRespectsKOs: a.lastRespectsKOs || 0,
        // ─── `intimidateActive` MANCAVA, E IL DIFENSORE CE L'AVEVA ────────
        //
        // `checkIntimidate(source, target)` parte solo se `source.abilityOn`
        // e' vero (`damage_MASTER.js:558`). Il costruttore del DIFENSORE
        // traduceva `intimidateActive`, questo no: quindi l'harness sapeva
        // porre «il difensore ha Intimidate» e non «ce l'ha chi attacca».
        //
        // Nel secondo caso il riferimento rispondeva con Intimidate SPENTA —
        // un numero plausibile per una domanda diversa da quella fatta. Due
        // casi golden risultavano divergenti per questo, e nessuno dei due era
        // un difetto nostro: sono Mirror Armor che rimanda il calo
        // sull'attaccante e l'Adrenaline Orb che si consuma, e il nostro
        // motore li faceva gia' tutt'e due giusti.
        abilitaAttiva: a.atkAbilityFlags?.flashFireActive
          || a.atkAbilityFlags?.interruttore || a.atkAbilityFlags?.abilityOn
          || a.atkAbilityFlags?.intimidateActive,
        psBassi: ABILITA_A_PS_BASSI.has(tr.abilitaNCP(a.atkAbility))
          && a.atkAbilityFlags?.interruttore === true,
        stato: a.atkStatus,
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
      boosts: { df: d.defBoost || 0, sd: d.spDefBoost || 0, sp: d.defSpeBoost || 0 },
      mossaNCP,
      datiMossa,
      // `abilityOn` sul difensore raccoglie i nostri due flag che vi
      // corrispondono. Era il solo `intimidateActive`, e bastava finche' le
      // uniche abilita' del difensore che il riferimento accende con
      // `abilityOn` erano Intimidate e le sue dodici contrarie.
      //
      // Trace lo ha reso insufficiente: `checkTrace(p1, p2)` parte solo se
      // `source.abilityOn` e' vero, e p1 e' il DIFENSORE. Senza
      // `interruttore` qui, un Trace sul difensore non copiava mai niente nel
      // riferimento — e il confronto diceva che divergiamo noi.
      extra: {
        hpPieni: d.defAbilityFlags?.multiscaleActive !== false,
        stato: d.defStatus,
        abilitaAttiva: d.defAbilityFlags?.intimidateActive
          || d.defAbilityFlags?.interruttore,
      },
    })
    if (!dif) return { ok: false, motivo: `specie non presente in NCP: ${d.defPokemon}` }

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

    // Quattro oggetti mossa distinti per lato: vedi la nota sopra.
    const clona = (m) => Object.assign({}, m)
    att.pokemon.moves = [att.mossa, clona(att.mossa), clona(att.mossa), clona(att.mossa)]
    dif.pokemon.moves = [clona(dif.mossa), clona(dif.mossa), clona(dif.mossa), clona(dif.mossa)]

    let risultati
    try {
      ncp.spuntaCaselle(caselleDa(att.pokemon.ability, dif.pokemon.ability))
      // p1 = difensore (porta l'abilità di supporto), p2 = attaccante.
      risultati = ncp.CALCULATE_ALL_MOVES_SV(dif.pokemon, att.pokemon, costruisciCampo({ ...field, gasNeutro: gasInCampo(a.atkAbility, d.defAbility) }, format))
    } catch (e) {
      return { ok: false, motivo: `errore dentro il motore NCP: ${e.message}` }
    } finally {
      ncp.spuntaCaselle([])
    }

    const esito = risultati?.[1]?.[0]
    if (!esito) return { ok: false, motivo: 'nessun risultato dall\'ingresso alto' }
    const danno = Array.isArray(esito.damage[0]) ? esito.damage[0] : esito.damage

    const comune = {
      ok: true,
      format,
      defHP: dif.pokemon.maxHP,
      descrizione: esito.description,
      // I boost DOPO la preparazione. Servono a distinguere una divergenza di
      // formula da una di preparazione: se questi sono diversi dai nostri, il
      // problema è a monte del danno.
      boostFinali: { attaccante: { ...att.pokemon.boosts }, difensore: { ...dif.pokemon.boosts } },
      entita: { pokemon: [a.atkPokemon, d.defPokemon], mosse: [move] },
    }

    // Stessa distinzione dell'ingresso basso: un numero solo e maggiore di zero
    // è un DANNO FISSO, non un colpo nullo. La ragione, per esteso, sta lì.
    if (Array.isArray(danno) && danno.length === 1 && danno[0] > 0) {
      return { ...comune, nullo: false, fisso: true, rolls: danno }
    }
    if (!Array.isArray(danno) || danno.length !== 16) {
      return { ...comune, nullo: true, rolls: [] }
    }
    return { ...comune, nullo: false, rolls: danno }
  }

  return {
    calcola,
    calcolaConPreparazione,
    verificaAnagrafica: tr.verificaAnagrafica,
    traduttore: tr,
    ncp,
  }
}
