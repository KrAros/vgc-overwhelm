// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/snapshot-cases.mjs
 *
 * Definizione dei casi di caratterizzazione del motore di calcolo.
 *
 * ATTENZIONE — questo file NON contiene i risultati attesi.
 * Contiene solo gli INPUT. I risultati vengono fotografati da
 * `scripts/gen-snapshot.mjs` eseguendo il motore così com'è.
 *
 * Lo snapshot congela anche i bug: è voluto. Non è un oracolo di
 * correttezza (quello sono i casi golden da NCP), è un RILEVATORE DI
 * CAMBIAMENTI. Serve a rispondere alla domanda "cosa si è mosso?"
 * dopo un refactor.
 *
 * Nessun import da src/ — solo stringhe e numeri. Così questo file
 * gira con node puro, senza passare da Vite.
 *
 * Generazione deterministica: cicli espliciti su liste esplicite,
 * nessun numero casuale. Rigenerare produce byte identici.
 */

// ─── Spread SP ricorrenti ──────────────────────────────────────────────────
// Ordine indici: [HP, Atk, Def, SpA, SpD, Spe] — max 32 per stat, max 66 totali

const SP = {
  vuoto:      [0, 0, 0, 0, 0, 0],
  fisico:     [0, 32, 0, 0, 0, 30],   // 62
  speciale:   [0, 0, 0, 32, 0, 30],   // 62
  bulkyFis:   [32, 0, 32, 0, 0, 0],   // 64
  bulkySpe:   [32, 0, 0, 0, 32, 0],   // 64
  misto:      [16, 16, 8, 16, 8, 0],  // 64
  difensore:  [32, 0, 18, 0, 16, 0],  // 66
}

// ─── Costruttori ───────────────────────────────────────────────────────────

function atk(key, nature, sps, extra = {}) {
  return {
    atkPokemon: key,
    atkSPs: sps,
    atkNature: nature,
    atkAbility: null,
    atkItem: null,
    atkBoost: 0,
    spAtkBoost: 0,
    atkAbilityFlags: {},
    lastRespectsKOs: 0,
    level: 50,
    ...extra,
  }
}

function def(key, nature, sps, extra = {}) {
  return {
    defPokemon: key,
    defSPs: sps,
    defNature: nature,
    defAbility: null,
    defItem: null,
    defBoost: 0,
    spDefBoost: 0,
    defAbilityFlags: {},
    ...extra,
  }
}

const FIELD_VUOTO = {
  weather: null,
  terrain: null,
  helpingHand: false,
  auroraVeil: false,
  lightScreen: false,
  reflect: false,
  crit: false,
  doubleTarget: false,
  trickRoom: false,
}

function field(extra = {}) {
  return { ...FIELD_VUOTO, ...extra }
}

// ─── Coppie attaccante/mossa ricorrenti ────────────────────────────────────
// Nome breve → [attaccante, mossa]. Il nome finisce nell'id del caso,
// così un caso divergente si legge senza aprire il JSON.

const A = {
  chompEq:    [atk('garchomp', 'adamant', SP.fisico), 'earthquake'],       // STAB fisico spread
  chompClaw:  [atk('garchomp', 'adamant', SP.fisico), 'dragon claw'],      // STAB fisico contatto
  chompRock:  [atk('garchomp', 'adamant', SP.fisico), 'rock slide'],       // non-STAB spread
  fluttMoon:  [atk('flutter-mane', 'modest', SP.speciale), 'moonblast'],    // STAB speciale
  fluttShadow:[atk('flutter-mane', 'modest', SP.speciale), 'shadow ball'],  // STAB speciale
  incinFlare: [atk('incineroar', 'adamant', SP.misto), 'flare blitz'],     // STAB Fire contatto
  incinKnock: [atk('incineroar', 'adamant', SP.misto), 'knock off'],       // STAB Dark contatto
  rillaWood:  [atk('rillaboom', 'adamant', SP.fisico), 'wood hammer'],     // STAB Grass contatto
  chienCrunch:[atk('chien-pao', 'jolly', SP.fisico), 'crunch'],             // STAB Dark contatto
  chienIcicle:[atk('chien-pao', 'jolly', SP.fisico), 'icicle crash'],       // STAB Ice
  handsPunch: [atk('iron-hands', 'adamant', SP.fisico), 'drain punch'],     // STAB Fighting
  goldRain:   [atk('gholdengo', 'modest', SP.speciale), 'make it rain'],   // STAB Steel spread
  calyLance:  [atk('calyrex-ice', 'adamant', SP.fisico), 'glacial lance'],  // STAB Ice spread
  torkoalHeat:[atk('torkoal', 'modest', SP.speciale), 'heat wave'],        // STAB Fire spread
  bundleHydro:[atk('iron-bundle', 'timid', SP.speciale), 'hydro pump'],     // STAB Water
  boltDraco:  [atk('raging-bolt', 'modest', SP.speciale), 'draco meteor'],  // STAB Dragon
  ursaRush:   [atk('ursaluna', 'adamant', SP.fisico), 'headlong rush'],    // STAB Ground
  dragoSpeed: [atk('dragonite', 'adamant', SP.fisico), 'extreme speed'],   // non-STAB priorità
  kingIron:   [atk('kingambit', 'adamant', SP.fisico), 'iron head'],       // STAB Steel
  pelipSurf:  [atk('pelipper', 'modest', SP.speciale), 'surf'],            // STAB Water spread
  // Aggiunto in F-3: era l'unico tipo senza un attaccante nel catalogo, e
  // senza di lui Kebia Berry non era esprimibile. Amoonguss è Erba/Veleno
  // (STAB) e Whimsicott è Erba/Folletto: il Veleno ci va ×4, quindi la resist
  // berry si attiva davvero — le berry richiedono il super efficace.
  amoonSludge:[atk('amoonguss', 'modest', SP.speciale), 'sludge bomb'],    // STAB Poison
}

// ─── Difensori ricorrenti ──────────────────────────────────────────────────

const D = {
  incin:    def('incineroar', 'careful', SP.difensore),
  amoon:    def('amoonguss', 'calm', SP.bulkySpe),
  rilla:    def('rillaboom', 'impish', SP.bulkyFis),
  lando:    def('landorus-therian', 'impish', SP.bulkyFis),   // Flying: immune a Ground
  hands:    def('iron-hands', 'adamant', SP.misto),
  flutt:    def('flutter-mane', 'timid', SP.vuoto),            // fragilissimo
  gold:     def('gholdengo', 'bold', SP.difensore),
  torkoal:  def('torkoal', 'bold', SP.bulkyFis),
  dragonite:def('dragonite', 'careful', SP.difensore),
  chomp:    def('garchomp', 'jolly', SP.vuoto),
  ursa:     def('ursaluna', 'adamant', SP.bulkyFis),
  caly:     def('calyrex-ice', 'brave', SP.bulkyFis),
  farigiraf:def('farigiraf', 'calm', SP.bulkySpe),
  whimsi:   def('whimsicott', 'timid', SP.vuoto),
  registeel:def('registeel', 'impish', SP.difensore),
  corvi:    def('corviknight', 'impish', SP.bulkyFis),
}

// ─── Utilità di costruzione ────────────────────────────────────────────────

const casi = []
const contatori = {}

function aggiungi(blocco, etichetta, input) {
  contatori[blocco] = (contatori[blocco] || 0) + 1
  const n = String(contatori[blocco]).padStart(3, '0')
  casi.push({
    id: `${blocco}-${etichetta}-${n}`,
    input,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// B1 — Baseline neutro: nessun campo, nessun item, nessuna abilità (60 casi)
// ═══════════════════════════════════════════════════════════════════════════

{
  const coppie = [
    A.chompEq, A.chompClaw, A.fluttMoon, A.incinFlare, A.incinKnock,
    A.rillaWood, A.chienCrunch, A.handsPunch, A.goldRain, A.calyLance,
  ]
  const difensori = [D.incin, D.amoon, D.rilla, D.hands, D.gold, D.dragonite]

  for (const [attaccante, mossa] of coppie) {
    for (const difensore of difensori) {
      aggiungi('B1', 'base', {
        attacker: attaccante, defender: difensore, move: mossa, field: field(),
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// B2 — Meteo (40 casi)
// Include heavy rain / harsh sunshine, oggi riconosciuti solo da Weather Ball.
// Include difensori Rock e Ice per il bonus stat di sabbia/neve in calcStat.
// ═══════════════════════════════════════════════════════════════════════════

{
  const meteo = ['sun', 'rain', 'sand', 'snow', 'heavy rain', 'harsh sunshine', 'sandstorm', 'hail']
  const coppie = [
    [A.torkoalHeat, D.amoon],    // Fire sotto sole/pioggia
    [A.bundleHydro, D.torkoal],  // Water sotto pioggia/sole
    [A.chompEq, D.incin],        // neutro al meteo
    [A.calyLance, D.caly],       // Ice contro difensore Ice (bonus neve)
    [A.chompRock, D.corvi],      // Rock contro difensore Steel (bonus sabbia)
  ]

  for (const w of meteo) {
    for (const [[attaccante, mossa], difensore] of coppie) {
      aggiungi('B2', `weather-${w.replace(/ /g, '_')}`, {
        attacker: attaccante, defender: difensore, move: mossa, field: field({ weather: w }),
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// B3 — Terreno (40 casi)
// Copre i boost ×1.3, il dimezzamento Dragon su Misty e Earthquake su Grassy,
// più il ramo isGrounded (Flutter Mane è a terra, Dragonite è Flying).
// ═══════════════════════════════════════════════════════════════════════════

{
  const terreni = [null, 'electric', 'grassy', 'psychic', 'misty']
  const coppie = [
    [A.chompEq, D.incin],        // Earthquake: dimezzata su Grassy
    [A.rillaWood, D.incin],      // Grass: ×1.3 su Grassy
    [A.boltDraco, D.dragonite],  // Dragon: ×0.5 su Misty se il bersaglio è a terra
    [A.boltDraco, D.chomp],      // Dragon su bersaglio a terra
    [A.fluttMoon, D.hands],      // Fairy: nessun terreno la tocca
    [A.chompClaw, D.dragonite],  // Dragon contatto su difensore Flying
    [A.goldRain, D.rilla],       // Steel speciale
    [A.handsPunch, D.gold],      // Fighting
  ]

  for (const terrain of terreni) {
    for (const [[attaccante, mossa], difensore] of coppie) {
      aggiungi('B3', `terrain-${terrain ?? 'none'}`, {
        attacker: attaccante, defender: difensore, move: mossa, field: field({ terrain }),
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// B4 — Boost di stat (40 casi)
// atkBoost e spAtkBoost sono impostati allo stesso valore: il motore sceglie
// quale usare in base alla categoria della mossa. Idem lato difesa.
// ═══════════════════════════════════════════════════════════════════════════

{
  const configurazioni = [
    { a: 1, d: 0 }, { a: 2, d: 0 }, { a: -1, d: 0 }, { a: -2, d: 0 },
    { a: 0, d: 1 }, { a: 0, d: 2 }, { a: 0, d: -2 }, { a: 6, d: 6 },
  ]
  const coppie = [
    [A.chompEq, D.incin],
    [A.fluttMoon, D.hands],
    [A.incinFlare, D.amoon],
    [A.goldRain, D.rilla],
    [A.calyLance, D.dragonite],
  ]

  for (const { a, d } of configurazioni) {
    for (const [[attaccante, mossa], difensore] of coppie) {
      aggiungi('B4', `boost-a${a}-d${d}`, {
        attacker: { ...attaccante, atkBoost: a, spAtkBoost: a },
        defender: { ...difensore, defBoost: d, spDefBoost: d },
        move: mossa,
        field: field(),
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// B5 — Item con effetto reale (40 casi)
// side 'atk' → item sull'attaccante, side 'def' → item sul difensore.
// ═══════════════════════════════════════════════════════════════════════════

{
  const item = [
    // Attaccante — moltiplicatori di stat
    { nome: 'choice band',    side: 'atk', coppia: A.chompEq,     difensore: D.incin },
    { nome: 'choice specs',   side: 'atk', coppia: A.fluttMoon,   difensore: D.hands },
    { nome: 'muscle band',    side: 'atk', coppia: A.chompEq,     difensore: D.incin },
    { nome: 'wise glasses',   side: 'atk', coppia: A.fluttMoon,   difensore: D.hands },
    { nome: 'punching glove', side: 'atk', coppia: A.handsPunch,  difensore: D.gold },
    // Attaccante — moltiplicatore di danno finale
    { nome: 'life orb',       side: 'atk', coppia: A.chompEq,     difensore: D.incin },
    { nome: 'life orb',       side: 'atk', coppia: A.fluttMoon,   difensore: D.hands },
    // Attaccante — type boost ×1.2
    { nome: 'soft sand',      side: 'atk', coppia: A.chompEq,     difensore: D.incin },
    { nome: 'charcoal',       side: 'atk', coppia: A.incinFlare,  difensore: D.amoon },
    { nome: 'mystic water',   side: 'atk', coppia: A.bundleHydro, difensore: D.torkoal },
    { nome: 'black glasses',  side: 'atk', coppia: A.incinKnock,  difensore: D.gold },
    { nome: 'never-melt ice', side: 'atk', coppia: A.calyLance,   difensore: D.dragonite },
    { nome: 'dragon fang',    side: 'atk', coppia: A.boltDraco,   difensore: D.dragonite },
    { nome: 'magnet',         side: 'atk', coppia: A.fluttMoon,   difensore: D.hands },
    { nome: 'fairy feather',  side: 'atk', coppia: A.fluttMoon,   difensore: D.hands },
    { nome: 'metal coat',     side: 'atk', coppia: A.kingIron,    difensore: D.flutt },
    // Difensore — moltiplicatori di stat difensiva
    { nome: 'eviolite',       side: 'def', coppia: A.chompEq,     difensore: D.incin },
    { nome: 'assault vest',   side: 'def', coppia: A.fluttMoon,   difensore: D.hands },
    // Difensore — resist berry (si attivano solo su super efficace)
    { nome: 'yache berry',    side: 'def', coppia: A.calyLance,   difensore: D.dragonite },
    { nome: 'chople berry',   side: 'def', coppia: A.handsPunch,  difensore: D.gold },
    // Kebia Berry — l'unica delle diciotto resist berry senza effetto in
    // ITEM_EFFECTS, trovata in F-3. Prima di questo caso nessuno dei 584
    // casi la nominava: il criterio «snapshot:diff si muove» sarebbe stato
    // vuoto, quindi la fotografia si scatta qui, PRIMA della correzione.
    { nome: 'kebia berry',    side: 'def', coppia: A.amoonSludge, difensore: D.whimsi },
  ]

  // Due varianti per item: campo vuoto, e con crit — il crit è il modificatore
  // che nella sessione D cambierà di più, e va fotografato in coppia con gli item.
  for (const { nome, side, coppia, difensore } of item) {
    for (const conCrit of [false, true]) {
      const [attaccante, mossa] = coppia
      aggiungi('B5', `item-${nome.replace(/ /g, '_')}${conCrit ? '-crit' : ''}`, {
        attacker: side === 'atk' ? { ...attaccante, atkItem: nome } : attaccante,
        defender: side === 'def' ? { ...difensore, defItem: nome } : difensore,
        move: mossa,
        field: field({ crit: conCrit }),
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// B6 — Abilità (30 casi)
// Il motore non verifica che il Pokémon possa davvero avere l'abilità:
// questo permette di isolare l'effetto su coppie fisse e confrontabili.
//
// Sono inclusi di proposito filter / thick fat / fluffy, che OGGI NON HANNO
// EFFETTO (in abilityEffects.js hanno solo `desc`). Congelarli adesso significa
// che quando verranno implementati, il diff dello snapshot li isolerà da solo.
// ═══════════════════════════════════════════════════════════════════════════

{
  const abilitaAtk = [
    { nome: 'huge power',       coppia: A.chompEq,    difensore: D.incin, flags: {} },
    { nome: 'pure power',       coppia: A.chompEq,    difensore: D.incin, flags: {} },
    { nome: 'adaptability',     coppia: A.chompEq,    difensore: D.incin, flags: {} },
    { nome: 'adaptability',     coppia: A.fluttMoon,  difensore: D.hands, flags: {} },
    { nome: 'tough claws',      coppia: A.chompClaw,  difensore: D.incin, flags: {} },
    { nome: 'tough claws',      coppia: A.chompEq,    difensore: D.incin, flags: {} }, // non contatto: nessun effetto
    { nome: 'fire mane',        coppia: A.incinFlare, difensore: D.amoon, flags: {} },
    { nome: 'flash fire',       coppia: A.incinFlare, difensore: D.amoon, flags: { flashFireActive: true } },
    { nome: 'flash fire',       coppia: A.incinFlare, difensore: D.amoon, flags: { flashFireActive: false } },
    { nome: 'supreme overlord', coppia: A.kingIron,   difensore: D.flutt, flags: { supremeOverlordKOs: 1 } },
    { nome: 'supreme overlord', coppia: A.kingIron,   difensore: D.flutt, flags: { supremeOverlordKOs: 3 } },
    { nome: 'supreme overlord', coppia: A.kingIron,   difensore: D.flutt, flags: { supremeOverlordKOs: 5 } },
    { nome: 'defiant',          coppia: A.chompEq,    difensore: D.incin, flags: {} },
    { nome: 'contrary',         coppia: A.chompEq,    difensore: D.incin, flags: {} },
    { nome: 'competitive',      coppia: A.fluttMoon,  difensore: D.hands, flags: {} },
  ]

  for (const { nome, coppia, difensore, flags } of abilitaAtk) {
    const [attaccante, mossa] = coppia
    aggiungi('B6', `abil-atk-${nome.replace(/ /g, '_')}`, {
      attacker: { ...attaccante, atkAbility: nome, atkAbilityFlags: flags },
      defender: difensore,
      move: mossa,
      field: field(),
    })
  }

  const abilitaDef = [
    { nome: 'multiscale',    coppia: A.chompEq,    difensore: D.dragonite, flags: { multiscaleActive: true } },
    { nome: 'multiscale',    coppia: A.chompEq,    difensore: D.dragonite, flags: { multiscaleActive: false } },
    { nome: 'shadow shield', coppia: A.chompEq,    difensore: D.dragonite, flags: { multiscaleActive: true } },
    { nome: 'intimidate',    coppia: A.chompEq,    difensore: D.incin,     flags: { intimidateActive: true } },
    { nome: 'intimidate',    coppia: A.chompEq,    difensore: D.incin,     flags: { intimidateActive: false } },
    { nome: 'intimidate',    coppia: A.fluttMoon,  difensore: D.incin,     flags: { intimidateActive: true } },
    { nome: 'levitate',      coppia: A.chompEq,    difensore: D.incin,     flags: {} },  // immunità
    { nome: 'flash fire',    coppia: A.incinFlare, difensore: D.amoon,     flags: {} },  // immunità
    // Rami morti oggi — congelati come sentinelle per la sessione D
    { nome: 'filter',        coppia: A.calyLance,  difensore: D.dragonite, flags: {} },
    { nome: 'solid rock',    coppia: A.calyLance,  difensore: D.dragonite, flags: {} },
    { nome: 'thick fat',     coppia: A.incinFlare, difensore: D.amoon,     flags: {} },
    { nome: 'fluffy',        coppia: A.chompClaw,  difensore: D.incin,     flags: {} },
    { nome: 'fur coat',      coppia: A.chompEq,    difensore: D.incin,     flags: {} },
    { nome: 'ice scales',    coppia: A.fluttMoon,  difensore: D.hands,     flags: {} },
    { nome: 'heatproof',     coppia: A.incinFlare, difensore: D.amoon,     flags: {} },
  ]

  for (const { nome, coppia, difensore, flags } of abilitaDef) {
    const [attaccante, mossa] = coppia
    aggiungi('B6', `abil-def-${nome.replace(/ /g, '_')}`, {
      attacker: attaccante,
      defender: { ...difensore, defAbility: nome, defAbilityFlags: flags },
      move: mossa,
      field: field(),
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// B7 — Schermi, crit, Helping Hand, spread (40 casi)
// Il caso reflect+auroraVeil è quello del §1.4: oggi il danno è ×0.25.
// ═══════════════════════════════════════════════════════════════════════════

{
  const configurazioni = [
    { nome: 'reflect',        f: { reflect: true } },
    { nome: 'lightscreen',    f: { lightScreen: true } },
    { nome: 'auroraveil',     f: { auroraVeil: true } },
    { nome: 'reflect+veil',   f: { reflect: true, auroraVeil: true } },
    { nome: 'crit',           f: { crit: true } },
    { nome: 'crit+reflect',   f: { crit: true, reflect: true } },
    { nome: 'helpinghand',    f: { helpingHand: true } },
    { nome: 'spread',         f: { doubleTarget: true } },
  ]
  const coppie = [
    [A.chompEq, D.incin],       // spread fisico
    [A.fluttMoon, D.hands],     // singolo speciale
    [A.goldRain, D.rilla],      // spread speciale
    [A.chompClaw, D.incin],     // singolo fisico
    [A.calyLance, D.dragonite], // spread super efficace
  ]

  for (const { nome, f } of configurazioni) {
    for (const [[attaccante, mossa], difensore] of coppie) {
      aggiungi('B7', `campo-${nome}`, {
        attacker: attaccante, defender: difensore, move: mossa, field: field(f),
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// B8 — Mosse con logica dedicata (30 casi)
// Body Press, Last Respects, Weather Ball, Knock Off.
// ═══════════════════════════════════════════════════════════════════════════

{
  // Body Press: usa la Def dell'attaccante. Con boost di Def per verificare
  // che applyBoost venga applicato alla stat giusta.
  for (const boost of [0, 1, 2, -1]) {
    aggiungi('B8', `bodypress-def${boost}`, {
      attacker: { ...atk('registeel', 'impish', SP.difensore), atkBoost: boost },
      defender: D.incin,
      move: 'body press',
      field: field(),
    })
  }
  aggiungi('B8', 'bodypress-corvi', {
    attacker: atk('corviknight', 'impish', SP.bulkyFis),
    defender: D.flutt,
    move: 'body press',
    field: field(),
  })

  // Last Respects: BP 50 + 50 per KO, clampato a 3 KO.
  // Il caso KOs=5 verifica il clamp (deve dare lo stesso di KOs=3).
  for (const kos of [0, 1, 2, 3, 5]) {
    aggiungi('B8', `lastrespects-ko${kos}`, {
      attacker: { ...atk('gholdengo', 'adamant', SP.fisico), lastRespectsKOs: kos },
      defender: D.flutt,
      move: 'last respects',
      field: field(),
    })
  }

  // Weather Ball: tipo e BP cambiano col meteo.
  // Sotto heavy rain / harsh sunshine il tipo cambia ma il ×1.5 meteo NON si
  // applica (§1.6) — questo caso congela esattamente quel comportamento.
  for (const w of [null, 'sun', 'rain', 'sand', 'snow', 'heavy rain', 'harsh sunshine']) {
    aggiungi('B8', `weatherball-${(w ?? 'none').replace(/ /g, '_')}`, {
      attacker: atk('pelipper', 'modest', SP.speciale),
      defender: D.incin,
      move: 'weather ball',
      field: field({ weather: w }),
    })
  }

  // Knock Off: ×1.5 BP se il difensore tiene un item rimovibile.
  const itemKnock = [null, 'leftovers', 'assault vest', 'garchompite', 'sitrus berry']
  for (const it of itemKnock) {
    aggiungi('B8', `knockoff-${(it ?? 'nessuno').replace(/ /g, '_')}`, {
      attacker: A.incinKnock[0],
      defender: { ...D.gold, defItem: it },
      move: 'knock off',
      field: field(),
    })
  }

  // Mossa spread senza doubleTarget: la penalità non deve applicarsi.
  aggiungi('B8', 'spread-single-target', {
    attacker: A.chompEq[0], defender: D.incin, move: 'earthquake',
    field: field({ doubleTarget: false }),
  })
  // Mossa non-spread con doubleTarget attivo: la penalità non deve applicarsi.
  aggiungi('B8', 'nonspread-double-target', {
    attacker: A.chompClaw[0], defender: D.incin, move: 'dragon claw',
    field: field({ doubleTarget: true }),
  })
  // Immunità di tipo (Ground → Flying)
  aggiungi('B8', 'immune-tipo', {
    attacker: A.chompEq[0], defender: D.lando, move: 'earthquake', field: field(),
  })
  // Ate ability: Pixilate su mossa Normal
  aggiungi('B8', 'ate-pixilate', {
    attacker: { ...atk('whimsicott', 'adamant', SP.fisico), atkAbility: 'pixilate' },
    defender: D.chomp, move: 'tackle', field: field(),
  })
  // Ate ability: Aerilate
  aggiungi('B8', 'ate-aerilate', {
    attacker: { ...atk('dragonite', 'adamant', SP.fisico), atkAbility: 'aerilate' },
    defender: D.hands, move: 'extreme speed', field: field(),
  })
  // Livello diverso da 50 — non usato dall'app, ma il parametro esiste
  aggiungi('B8', 'livello-100', {
    attacker: { ...A.chompEq[0], level: 100 },
    defender: D.incin, move: 'earthquake', field: field(),
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// B9 — Catene di modificatori (sessione D-2)
//
// PERCHÉ ESISTE QUESTO BLOCCO.
// `chainMods` concatena i modificatori in virgola fissa e arrotonda UNA volta
// sola, invece di troncare dopo ognuno. Con zero o un modificatore nella stessa
// catena le due formule danno lo stesso numero: la differenza si vede solo da
// DUE in su.
//
// Misurato sui 318 casi preesistenti, per catena:
//     potenza  239 casi a 0 mod · 77 a 1 · SOLO 2 a >=2
//     attacco  307 a 0 · 11 a 1 · ZERO a >=2
//     difesa   312 a 0 ·  6 a 1 · ZERO a >=2
//     finale   278 a 0 · 40 a 1 · ZERO a >=2
//
// Cioè: senza questo blocco, `chainMods` passerebbe tutti i test restando
// completamente non verificato su tre catene su quattro. I casi vanno quindi
// generati PRIMA di toccare il motore.
//
// I nomi delle catene seguono NCP (vendor/ncp/damage_MASTER.js):
//   bp = calcBPMods · at = calcAtMods · df = calcDefMods · fn = calcFinalMods
//
// VINCOLO: con uno schermo attivo la mossa deve essere NON-spread, altrimenti
// l'harness NCP dichiara il caso inesprimibile (in NCP il formato governa
// insieme penalità d'area e moltiplicatore dello schermo).
// ═══════════════════════════════════════════════════════════════════════════

{
  // Difensore capace di evolversi: serve per far coesistere Eviolite e Fur Coat
  // nella catena di difesa. Nessun difensore preesistente ha canEvolve.
  //
  // ─── DUE TENTATIVI PRIMA DI TROVARE UN CASO CHE DICA QUALCOSA ────────────
  // Fur Coat (×2) ed Eviolite (×1.5) concatenati danno esattamente ×3:
  //
  //     vecchio:  floor(floor(Def × 1.5) × 2)
  //     nuovo:    pokeRound(Def × 3)
  //
  // 1° tentativo — Dusclops, Def 184. Le due formule divergono solo con Def
  //    DISPARI: con Def pari `floor(×1.5)` non tronca niente. Caso cieco.
  //
  // 2° tentativo — Rhydon, Def 171 (dispari): la catena dà 512 contro 513.
  //    Ma quel punto muore nella divisione `22 × BP × Atk / Def`, e il danno
  //    esce identico. Anche col vecchio motore: 16/16 contro NCP. Ancora cieco.
  //
  // 3° — Chansey, Def 27: la catena dà 80 contro 81, e con una Difesa così
  //    bassa un punto vale lo 1,2%. Il danno base passa da 90 a 88. QUESTO
  //    caso sa distinguere le due formule.
  //
  // Morale: perché un caso serva non basta che la condizione sia presente,
  // deve anche SOPRAVVIVERE fino al numero che confrontiamo.
  const dusclops = def('dusclops', 'bold', SP.difensore)              // Def 184 — cieco, tenuto come controllo
  const chansey  = def('chansey', 'bold', [32, 0, 0, 0, 32, 0])       // Def 27  — osservabile

  // ── Catena FINALE: >=2 modificatori ──────────────────────────────────────
  // Ordine NCP: schermo -> Multiscale -> Fluffy -> Ice Scales -> Filter ->
  //             Life Orb -> resist berry. Da noi oggi è quasi rovesciato.
  const finali = [
    ['lifeorb+reflect',      A.chompClaw,  { ...D.incin },                                  { atkItem: 'life orb' }, { reflect: true }],
    ['lifeorb+lightscreen',  A.fluttMoon,  { ...D.hands },                                  { atkItem: 'life orb' }, { lightScreen: true }],
    ['lifeorb+auroraveil',   A.chienCrunch,{ ...D.gold },                                   { atkItem: 'life orb' }, { auroraVeil: true }],
    ['lifeorb+multiscale',   A.chompClaw,  { ...D.dragonite, defAbility: 'multiscale' },    { atkItem: 'life orb' }, {}],
    ['multiscale+reflect',   A.chompClaw,  { ...D.dragonite, defAbility: 'multiscale' },    {},                      { reflect: true }],
    ['multiscale+berry',     A.chienIcicle,{ ...D.dragonite, defAbility: 'multiscale', defItem: 'yache berry' }, {}, {}],
    ['filter+berry',         A.chienCrunch,{ ...D.gold, defAbility: 'filter', defItem: 'colbur berry' }, {},         {}],
    ['icescales+lightscreen',A.fluttMoon,  { ...D.hands, defAbility: 'ice scales' },        {},                      { lightScreen: true }],
    ['fluffy+reflect',       A.chompClaw,  { ...D.incin, defAbility: 'fluffy' },            {},                      { reflect: true }],
    ['lifeorb+icescales',    A.fluttMoon,  { ...D.hands, defAbility: 'ice scales' },        { atkItem: 'life orb' }, {}],
    ['fluffy+fuoco+lifeorb', A.incinFlare, { ...D.amoon, defAbility: 'fluffy' },            { atkItem: 'life orb' }, {}],
    // tre modificatori nella stessa catena
    ['filter+lifeorb+reflect', A.chienCrunch, { ...D.gold, defAbility: 'filter' },          { atkItem: 'life orb' }, { reflect: true }],
    ['filter+lifeorb+berry',   A.chienCrunch, { ...D.gold, defAbility: 'filter', defItem: 'colbur berry' }, { atkItem: 'life orb' }, {}],
    ['multiscale+lifeorb+veil',A.chompClaw,   { ...D.dragonite, defAbility: 'multiscale' }, { atkItem: 'life orb' }, { auroraVeil: true }],
  ]
  for (const [nome, coppia, difensore, extraAtk, extraField] of finali) {
    aggiungi('B9', `fn-${nome}`, {
      attacker: { ...coppia[0], ...extraAtk },
      defender: difensore,
      move: coppia[1],
      field: field(extraField),
    })
  }

  // ── Catena ATTACCO: >=2 modificatori ─────────────────────────────────────
  // Ordine NCP: Fire Mane/Flash Fire -> Water Bubble/Huge Power ->
  //             abilità difensive x0.5 -> Choice Band/Specs.
  // Da noi la Choice Band è la PRIMA invece che l'ultima.
  const attacchi = [
    ['choiceband+thickfat',    A.chienIcicle, { ...D.ursa, defAbility: 'thick fat' },        { atkItem: 'choice band' }],
    // NB: il difensore NON può essere di tipo Normale — sarebbe immune a Ghost
    // e il caso non misurerebbe niente. Iron Hands (Fighting/Electric) prende 1x.
    ['choicespecs+purifsalt',  A.fluttShadow, { ...D.hands, defAbility: 'purifying salt' }, { atkItem: 'choice specs' }],
    ['firemane+choiceband',    A.incinFlare,  { ...D.amoon },                                { atkAbility: 'fire mane', atkItem: 'choice band' }],
    ['firemane+thickfat',      A.incinFlare,  { ...D.ursa, defAbility: 'thick fat' },        { atkAbility: 'fire mane' }],
    ['firemane+heatproof',     A.incinFlare,  { ...D.registeel, defAbility: 'heatproof' },   { atkAbility: 'fire mane' }],
    ['waterbubble+choicespecs',A.bundleHydro, { ...D.torkoal },                              { atkAbility: 'water bubble', atkItem: 'choice specs' }],
    ['hugepower+choiceband',   A.chompClaw,   { ...D.incin },                                { atkAbility: 'huge power', atkItem: 'choice band' }],
    ['flashfire+choiceband',   A.incinFlare,  { ...D.amoon },                                { atkAbility: 'flash fire', atkItem: 'choice band', atkAbilityFlags: { flashFireActive: true } }],
    // tre nella stessa catena
    ['firemane+thickfat+band', A.incinFlare,  { ...D.ursa, defAbility: 'thick fat' },        { atkAbility: 'fire mane', atkItem: 'choice band' }],
  ]
  for (const [nome, coppia, difensore, extraAtk] of attacchi) {
    aggiungi('B9', `at-${nome}`, {
      attacker: { ...coppia[0], ...extraAtk },
      defender: difensore,
      move: coppia[1],
      field: field(),
    })
  }

  // ── Catena ATTACCO: configurazioni OSSERVABILI ───────────────────────────
  // I casi qui sopra attivano le combinazioni giuste ma sono CIECHI: gli
  // attaccanti che usano hanno statistiche pari (Chien-Pao 172, Incineroar
  // 166, Iron Bundle 176, Garchomp 200) e il riordino della catena cambia la
  // statistica solo di un punto, che poi muore nella divisione per la Difesa.
  //
  // Questi sotto sono stati TROVATI, non scelti: uno script ha girato vecchio
  // e nuovo motore fianco a fianco su ogni combinazione di specie, natura e
  // SP, tenendo solo quelle in cui i roll cambiano davvero. Su ognuna il
  // vecchio motore divergeva da NCP e il nuovo lo azzecca 16/16.
  const attacchiOsservabili = [
    // nome                     attaccante     natura      SP           item             abilità        difensore   abil.dif.        mossa
    ['band+thickfat',          'chien-pao',    'adamant',  SP.fisico,   'choice band',   null,          'ursaluna', 'thick fat',      'icicle crash'],
    ['specs+purifsalt',        'gholdengo',   'timid',    [0,0,0,24,0,30], 'choice specs', null,       'iron-hands','purifying salt', 'shadow ball'],
    ['firemane+band',          'incineroar',  'adamant',  SP.fisico,   'choice band',   'fire mane',   'amoonguss', null,            'flare blitz'],
    ['firemane+thickfat',      'incineroar',  'jolly',    SP.fisico,   null,            'fire mane',   'ursaluna', 'thick fat',      'flare blitz'],
    ['hugepower+band',         'garchomp',    'adamant',  [0,0,0,0,0,30], 'choice band', 'huge power',  'incineroar', null,           'dragon claw'],
    ['waterbubble+specs',      'pelipper',    'timid',    SP.speciale, 'choice specs',  'water bubble','torkoal',  null,             'hydro pump'],
  ]
  for (const [nome, ap, anat, asps, item, abil, dp, dabil, mv] of attacchiOsservabili) {
    aggiungi('B9', `at-oss-${nome}`, {
      attacker: atk(ap, anat, asps, { atkItem: item, atkAbility: abil }),
      defender: def(dp, 'careful', SP.difensore, { defAbility: dabil }),
      move: mv,
      field: field(),
    })
  }
  // Flash Fire va acceso a mano: senza il flag l'abilità è solo un'immunità.
  aggiungi('B9', 'at-oss-flashfire+band', {
    attacker: atk('incineroar', 'adamant', SP.fisico, {
      atkItem: 'choice band', atkAbility: 'flash fire',
      atkAbilityFlags: { flashFireActive: true },
    }),
    defender: def('amoonguss', 'careful', SP.difensore),
    move: 'flare blitz',
    field: field(),
  })

  // ── Catena DIFESA: >=2 modificatori ──────────────────────────────────────
  // Ordine NCP: Fur Coat -> Eviolite/Assault Vest. Da noi è l'inverso.
  // Fur Coat e Assault Vest NON coesistono mai: il primo vale solo sul fisico,
  // il secondo solo sullo speciale. L'unica coppia possibile è con Eviolite.
  const difese = [
    ['furcoat+eviolite-claw',  A.chompClaw,   {}],
    ['furcoat+eviolite-crunch',A.chienCrunch, {}],
    ['furcoat+eviolite-crit',  A.chompClaw,   { crit: true }],
    ['furcoat+eviolite-hh',    A.chompClaw,   { helpingHand: true }],
  ]
  for (const [nome, coppia, extraField] of difese) {
    aggiungi('B9', `df-${nome}`, {
      attacker: coppia[0],
      defender: { ...dusclops, defAbility: 'fur coat', defItem: 'eviolite' },
      move: coppia[1],
      field: field(extraField),
    })
  }
  // Controlli a un modificatore solo, per isolare il contributo di ciascuno
  aggiungi('B9', 'df-solo-furcoat', {
    attacker: A.chompClaw[0], defender: { ...dusclops, defAbility: 'fur coat' },
    move: A.chompClaw[1], field: field(),
  })
  aggiungi('B9', 'df-solo-eviolite', {
    attacker: A.chompClaw[0], defender: { ...dusclops, defItem: 'eviolite' },
    move: A.chompClaw[1], field: field(),
  })

  // Gli stessi casi su Chansey (Def 27): QUESTI sanno distinguere la catena
  // concatenata dal vecchio troncamento a ogni passo.
  const difeseDispari = [
    ['furcoat+eviolite-claw',  A.chompClaw,   {}],
    ['furcoat+eviolite-crunch',A.chienCrunch, {}],
    ['furcoat+eviolite-crit',  A.chompClaw,   { crit: true }],
    ['furcoat+eviolite-hh',    A.chompClaw,   { helpingHand: true }],
  ]
  for (const [nome, coppia, extraField] of difeseDispari) {
    aggiungi('B9', `df-chansey-${nome}`, {
      attacker: coppia[0],
      defender: { ...chansey, defAbility: 'fur coat', defItem: 'eviolite' },
      move: coppia[1],
      field: field(extraField),
    })
  }
  aggiungi('B9', 'df-chansey-solo-furcoat', {
    attacker: A.chompClaw[0], defender: { ...chansey, defAbility: 'fur coat' },
    move: A.chompClaw[1], field: field(),
  })
  aggiungi('B9', 'df-chansey-solo-eviolite', {
    attacker: A.chompClaw[0], defender: { ...chansey, defItem: 'eviolite' },
    move: A.chompClaw[1], field: field(),
  })

  // ── Catena POTENZA: >=2 modificatori ─────────────────────────────────────
  // Ordine NCP: ate -> Tough Claws -> Muscle Band -> type-boost -> Knock Off ->
  //             Helping Hand -> terreno -> Supreme Overlord -> Punching Glove.
  // Da noi il terreno è il PRIMO invece che il penultimo.
  const potenze = [
    ['typeboost+terrain',      A.rillaWood,  { atkItem: 'miracle seed' },                        { terrain: 'grassy' }],
    ['muscleband+terrain',     A.rillaWood,  { atkItem: 'muscle band' },                         { terrain: 'grassy' }],
    ['toughclaws+terrain',     A.rillaWood,  { atkAbility: 'tough claws' },                      { terrain: 'grassy' }],
    ['helpinghand+terrain',    A.rillaWood,  {},                                                 { terrain: 'grassy', helpingHand: true }],
    ['helpinghand+typeboost',  A.rillaWood,  { atkItem: 'miracle seed' },                        { helpingHand: true }],
    ['toughclaws+helpinghand', A.chompClaw,  { atkAbility: 'tough claws' },                      { helpingHand: true }],
    ['toughclaws+typeboost',   A.rillaWood,  { atkAbility: 'tough claws', atkItem: 'miracle seed' }, {}],
    ['knockoff+helpinghand',   A.incinKnock, {},                                                 { helpingHand: true }],
    ['punchglove+helpinghand', A.handsPunch, { atkItem: 'punching glove' },                      { helpingHand: true }],
    ['ate+helpinghand',        A.dragoSpeed, { atkAbility: 'pixilate' },                         { helpingHand: true }],
    ['ate+typeboost',          A.dragoSpeed, { atkAbility: 'pixilate', atkItem: 'fairy feather' }, {}],
    ['overlord+helpinghand',   A.kingIron,   { atkAbility: 'supreme overlord', atkAbilityFlags: { supremeOverlordKOs: 2 } }, { helpingHand: true }],
    ['overlord+typeboost',     A.kingIron,   { atkAbility: 'supreme overlord', atkItem: 'metal coat', atkAbilityFlags: { supremeOverlordKOs: 2 } }, {}],
    ['overlord+terrain',       A.rillaWood,  { atkAbility: 'supreme overlord', atkAbilityFlags: { supremeOverlordKOs: 3 } }, { terrain: 'grassy' }],
    // tre nella stessa catena
    ['typeboost+terrain+hh',   A.rillaWood,  { atkItem: 'miracle seed' },                        { terrain: 'grassy', helpingHand: true }],
    ['toughclaws+terrain+hh',  A.rillaWood,  { atkAbility: 'tough claws' },                      { terrain: 'grassy', helpingHand: true }],
    ['ate+typeboost+hh',       A.dragoSpeed, { atkAbility: 'pixilate', atkItem: 'fairy feather' }, { helpingHand: true }],
  ]
  for (const [nome, coppia, extraAtk, extraField] of potenze) {
    aggiungi('B9', `bp-${nome}`, {
      attacker: { ...coppia[0], ...extraAtk },
      defender: D.incin,
      move: coppia[1],
      field: field(extraField),
    })
  }

  // ── Catene incrociate ────────────────────────────────────────────────────
  // Modificatori in catene DIVERSE contemporaneamente: verificano che le
  // quattro catene restino separate invece di mescolarsi.
  aggiungi('B9', 'cross-terrain+lifeorb+multiscale', {
    attacker: { ...A.rillaWood[0], atkItem: 'life orb' },
    defender: { ...D.dragonite, defAbility: 'multiscale' },
    move: A.rillaWood[1],
    field: field({ terrain: 'grassy' }),
  })
  aggiungi('B9', 'cross-band+terrain+reflect', {
    attacker: { ...A.rillaWood[0], atkItem: 'choice band' },
    defender: D.incin,
    move: A.rillaWood[1],
    field: field({ terrain: 'grassy', reflect: true }),
  })
  aggiungi('B9', 'cross-typeboost+furcoat', {
    attacker: { ...A.chompClaw[0], atkItem: 'dragon fang' },
    defender: { ...dusclops, defAbility: 'fur coat', defItem: 'eviolite' },
    move: A.chompClaw[1],
    field: field(),
  })

  // ── Critico + boost ──────────────────────────────────────────────────────
  // D ha corretto il critico perché ignori i cali d'attacco e i boost di
  // difesa, ma NESSUN caso di caratterizzazione mette insieme le due cose:
  // `snapshot:diff` uscì a zero. Qui si copre il buco.
  const critBoost = [
    ['atk+2',        2,  0],
    ['atk-2',       -2,  0],
    ['def+2',        0,  2],
    ['def-2',        0, -2],
    ['atk+2_def+2',  2,  2],
    ['atk-2_def+2', -2,  2],
    ['atk+2_def-2',  2, -2],
  ]
  for (const [nome, aB, dB] of critBoost) {
    aggiungi('B9', `crit-boost-${nome}`, {
      attacker: { ...A.chompClaw[0], atkBoost: aB },
      defender: { ...D.incin, defBoost: dB },
      move: A.chompClaw[1],
      field: field({ crit: true }),
    })
    // stessa coppia senza critico: il confronto isola l'effetto del critico
    aggiungi('B9', `nocrit-boost-${nome}`, {
      attacker: { ...A.chompClaw[0], atkBoost: aB },
      defender: { ...D.incin, defBoost: dB },
      move: A.chompClaw[1],
      field: field(),
    })
  }
  // Critico + boost + schermo: il critico deve bucare lo schermo E ignorare
  // il boost di difesa nello stesso calcolo.
  aggiungi('B9', 'crit-boost-reflect', {
    attacker: { ...A.chompClaw[0], atkBoost: 2 },
    defender: { ...D.incin, defBoost: 2 },
    move: A.chompClaw[1],
    field: field({ crit: true, reflect: true }),
  })

  // ── Fire Mane e Punching Glove: singoli aggiuntivi ───────────────────────
  // Un caso ciascuno esiste già (B6-007, B5-009/010), ma coprono una sola
  // combinazione. Qui si aggiungono le varianti che D ha toccato.
  aggiungi('B9', 'solo-firemane-crit', {
    attacker: { ...A.incinFlare[0], atkAbility: 'fire mane' },
    defender: D.amoon, move: A.incinFlare[1], field: field({ crit: true }),
  })
  aggiungi('B9', 'solo-firemane-sole', {
    attacker: { ...A.incinFlare[0], atkAbility: 'fire mane' },
    defender: D.amoon, move: A.incinFlare[1], field: field({ weather: 'sun' }),
  })
  // Punching Glove toglie il contatto: con Tough Claws il bonus NON si applica.
  aggiungi('B9', 'solo-punchglove+toughclaws', {
    attacker: { ...A.handsPunch[0], atkItem: 'punching glove', atkAbility: 'tough claws' },
    defender: D.incin, move: A.handsPunch[1], field: field(),
  })
  aggiungi('B9', 'solo-toughclaws-senza-glove', {
    attacker: { ...A.handsPunch[0], atkAbility: 'tough claws' },
    defender: D.incin, move: A.handsPunch[1], field: field(),
  })

  // ── Chilan Berry: nasce DIVERGENTE, deve rovesciarsi ─────────────────────
  // NCP attiva le resist berry con `typeEffectiveness > 1 || move.type ===
  // "Normal"`. Noi richiediamo solo `effectiveness > 1`, quindi la Chilan
  // Berry — che resiste al Normale, e il Normale non è super efficace contro
  // nulla — oggi non fa NIENTE, pur essendo selezionabile nell'interfaccia
  // ed essendo legale in Champions (ITEMS_CHAMPIONS in vendor/ncp).
  // Questi casi devono nascere `divergente` e diventare `concorde`.
  aggiungi('B9', 'chilan-normale-incin', {
    attacker: A.dragoSpeed[0], defender: { ...D.incin, defItem: 'chilan berry' },
    move: A.dragoSpeed[1], field: field(),
  })
  aggiungi('B9', 'chilan-normale-amoon', {
    attacker: A.dragoSpeed[0], defender: { ...D.amoon, defItem: 'chilan berry' },
    move: A.dragoSpeed[1], field: field(),
  })
  aggiungi('B9', 'chilan-normale-lifeorb', {
    attacker: { ...A.dragoSpeed[0], atkItem: 'life orb' },
    defender: { ...D.incin, defItem: 'chilan berry' },
    move: A.dragoSpeed[1], field: field(),
  })
  // Controllo negativo: con Pixilate la mossa diventa Fairy, quindi la Chilan
  // NON deve attivarsi né prima né dopo la correzione.
  aggiungi('B9', 'chilan-ate-fairy', {
    attacker: { ...A.dragoSpeed[0], atkAbility: 'pixilate' },
    defender: { ...D.incin, defItem: 'chilan berry' },
    move: A.dragoSpeed[1], field: field(),
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// B10 — Anagrafica (sessione I)
//
// PERCHÉ ESISTE QUESTO BLOCCO.
// La sessione I corregge base stats e tipi in `pokemon.json`. Il criterio di
// accettazione era «ogni caso mosso nello snapshot coinvolge una delle specie
// corrette» — ma misurando prima di scrivere è venuto fuori che NESSUNA delle
// specie da correggere compariva nei 403 casi preesistenti. Il criterio era
// soddisfatto muovendo zero casi: non falsificabile, quindi inutile.
//
// Questo blocco costruisce il bersaglio PRIMA di sparare. Viene generato con i
// dati sbagliati di oggi, e la correzione lo muove. Da lì il criterio diventa
// binario e verificabile in due letture:
//     i 403 casi vecchi   → invariati al byte
//     i casi B10          → mossi, ognuno nella direzione prevista
//
// NON copre le tre specie il cui unico errore è nella Velocità (Dodrio,
// Chespin, Poipole): `calculateDamage` non legge la Velocità, quindi nessun
// caso può renderle osservabili. Quelle sono verificate da
// `src/__tests__/anagrafica.test.js`, che asserisce i valori direttamente.
// ═══════════════════════════════════════════════════════════════════════════

{
  // ── Sonde ──────────────────────────────────────────────────────────────
  // Quattro attacchi fissi scelti per discriminare i tipi che cambiano:
  //   earthquake   Ground fisico  → legge la Difesa
  //   moonblast    Fairy speciale → legge la Difesa Speciale
  //   crunch       Dark fisico    → ×2 su Ghost e Psychic, ×0.5 su Fighting
  //   make it rain Steel speciale → ×2 su Fairy/Ice/Rock, ×0.5 su Steel/Water
  // Insieme distinguono ognuna delle coppie di tipi in gioco in questa sessione.
  const SONDE = [
    [atk('garchomp', 'adamant', SP.fisico), 'earthquake', 'eq'],
    [atk('flutter-mane', 'modest', SP.speciale), 'moonblast', 'moon'],
    [atk('chien-pao', 'jolly', SP.fisico), 'crunch', 'crunch'],
    [atk('gholdengo', 'modest', SP.speciale), 'make it rain', 'rain'],
  ]

  // ── B10.1 — Stat difensive che cambiano ────────────────────────────────
  // Aegislash 150→140 Def/SpD, Cresselia 120/130→110/120, Mega Alakazam
  // 95→105 SpD, Wishiwashi-Solo 20→25 SpD, Inkay colonna sfalsata (Def 37→53).
  {
    const specie = ['aegislash', 'cresselia', 'alakazam-mega', 'wishiwashi-solo', 'inkay']
    for (const chiave of specie) {
      for (const [attaccante, mossa, nome] of [SONDE[0], SONDE[1]]) {
        aggiungi('B10', `stat-def-${chiave}-${nome}`, {
          attacker: attaccante,
          defender: def(chiave, 'careful', SP.difensore),
          move: mossa,
          field: field(),
        })
      }
    }
  }

  // ── B10.2 — Stat offensive che cambiano ────────────────────────────────
  // Aegislash-Blade 150→140 Atk/SpA, Hoopa 100→110 Atk, Necrozma 107→127 SpA,
  // Ultra Necrozma 161→167 SpA, Inkay 46→37 SpA.
  {
    const specie = ['aegislash-blade', 'hoopa', 'necrozma', 'necrozma-ultra', 'inkay']
    const mosse = [['earthquake', 'eq'], ['shadow ball', 'shadow']]
    const difensori = [D.incin, D.amoon]
    for (const chiave of specie) {
      for (const [mossa, nome] of mosse) {
        for (const difensore of difensori) {
          aggiungi('B10', `stat-atk-${chiave}-${nome}`, {
            attacker: atk(chiave, 'quiet', SP.misto),
            defender: difensore,
            move: mossa,
            field: field(),
          })
        }
      }
    }
  }

  // ── B10.3 — Tipi che cambiano, lato difensore ──────────────────────────
  // Le sei forme reali più le tredici Mega. Marowak-Alola è nella lista pur
  // essendo un cambio di solo ORDINE: serve come controllo negativo, perché
  // `getEffectiveness` cicla sull'array e la moltiplicazione è commutativa.
  // Se quel caso si muovesse, avremmo rotto qualcosa.
  {
    const specie = [
      'decidueye', 'mimikyu', 'lurantis', 'dugtrio-alola', 'wishiwashi-school',
      'marowak-alola',
      'delphox-mega', 'greninja-mega', 'excadrill-mega', 'froslass-mega',
      'crabominable-mega', 'starmie-mega', 'skarmory-mega', 'glimmora-mega',
      'meowstic-mega', 'raichu-mega-x', 'raichu-mega-y', 'malamar-mega',
      'scrafty-mega',
    ]
    for (const chiave of specie) {
      for (const [attaccante, mossa, nome] of SONDE) {
        aggiungi('B10', `tipo-def-${chiave}-${nome}`, {
          attacker: attaccante,
          defender: def(chiave, 'careful', SP.difensore),
          move: mossa,
          field: field(),
        })
      }
    }
  }

  // ── B10.4 — Tipi che cambiano, lato attaccante (STAB) ──────────────────
  // Il segnale più netto della sessione: una mossa che ACQUISTA lo STAB e una
  // che lo PERDE, sulla stessa specie. Un ×1.5 che compare o sparisce non si
  // confonde con nulla.
  {
    const coppie = [
      // specie                mossa che acquista STAB   mossa che perde STAB
      ['decidueye', 'shadow ball', null],
      ['lurantis', 'energy ball', 'earthquake'],
      ['dugtrio-alola', 'iron head', 'crunch'],
      ['mimikyu', 'play rough', 'flash cannon'],
      ['delphox-mega', 'psychic', 'flash cannon'],
      ['greninja-mega', 'crunch', 'ice beam'],
      ['excadrill-mega', 'iron head', 'psychic'],
      ['froslass-mega', 'ice beam', 'crunch'],
      ['crabominable-mega', 'ice punch', 'crunch'],
      ['starmie-mega', 'psychic', 'flash cannon'],
      ['skarmory-mega', 'iron head', 'psychic'],
      ['glimmora-mega', 'power gem', 'surf'],
      ['meowstic-mega', 'psychic', 'flash cannon'],
      ['raichu-mega-x', null, 'close combat'],
      ['raichu-mega-y', null, 'flash cannon'],
      ['malamar-mega', 'psychic', 'flash cannon'],
      ['scrafty-mega', 'crunch', 'ice beam'],
    ]
    // Il difensore è Amoonguss (Grass/Poison) e non Incineroar, e la ragione
    // è una lezione già pagata in D-2: un caso può attivare la condizione
    // giusta e restare comunque CIECO, se la differenza non sopravvive fino al
    // numero confrontato. Incineroar è Fire/Dark, e sei di queste sonde sono
    // Psychic: contro il Buio l'efficacia è zero, quindi lo STAB che compare o
    // sparisce moltiplicava comunque per niente. Contro Amoonguss nessuna delle
    // tredici mosse qui sotto è a efficacia zero.
    for (const [chiave, acquista, perde] of coppie) {
      for (const [mossa, verso] of [[acquista, 'stab+'], [perde, 'stab-']]) {
        if (!mossa) continue
        aggiungi('B10', `tipo-atk-${chiave}-${verso}`, {
          attacker: atk(chiave, 'quiet', SP.misto),
          defender: D.amoon,
          move: mossa,
          field: field(),
        })
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// B11 — Expert Belt e vocabolario del meteo (sessione F-1)
//
// PERCHÉ ESISTE QUESTO BLOCCO.
// La sessione I ha lasciato una regola: prima di scrivere un criterio, verifica
// che esista almeno un caso capace di farlo fallire. Expert Belt non compariva
// in nessuno dei 540 casi né dei 500 golden — misurato con grep, non dedotto.
// Implementarlo avrebbe quindi lasciato `snapshot:diff` a zero, e lo zero
// avrebbe voluto dire "non c'è bersaglio", non "non ho rotto niente".
//
// Il blocco viene fotografato PRIMA della correzione, cioè con Expert Belt
// ancora inerte. Dopo l'implementazione i casi super efficaci devono muoversi
// e i controlli negativi devono restare fermi.
//
// L'EFFICACIA DEI TRE DIFENSORI, contro Earthquake (Terra) di Garchomp:
//   incineroar   Fuoco/Buio     ×2  ×1  = ×2     → Expert Belt si attiva
//   amoonguss    Erba/Veleno    ×½  ×2  = ×1     → controllo negativo
//   rillaboom    Erba           ×½        = ×½    → controllo negativo
//
// I due controlli negativi non sono una formalità: la condizione di NCP è
// `typeEffectiveness > 1`, e senza un caso a ×1 e uno a ×½ un `>=` scritto per
// sbaglio passerebbe inosservato.
// ═══════════════════════════════════════════════════════════════════════════

{
  const [chomp, eq] = A.chompEq

  // ── Expert Belt da solo: uno che deve muoversi, due che non devono ───────
  const bersagli = [
    ['superefficace', D.incin],   // ×2
    ['neutro',        D.amoon],   // ×1
    ['resistito',     D.rilla],   // ×½
  ]

  for (const [nome, difensore] of bersagli) {
    aggiungi('B11', `expertbelt-${nome}`, {
      attacker: { ...chomp, atkItem: 'expert belt' },
      defender: difensore,
      move: eq,
      field: field(),
    })
  }

  // ── Confronto diretto con Life Orb ────────────────────────────────────────
  // In NCP i due item stanno nello stesso `if/else if` (punti o e p di
  // `calcFinalMods`). Essendo l'item un campo solo, l'esclusione è già
  // garantita dai dati e l'`else` non può mai servire — ma tenere i due casi
  // affiancati rende visibile che ×1.2 (0x1333) e ×1,2998 (0x14CC) sono due
  // numeri diversi applicati nello stesso punto della catena.
  aggiungi('B11', 'lifeorb-superefficace', {
    attacker: { ...chomp, atkItem: 'life orb' },
    defender: D.incin,
    move: eq,
    field: field(),
  })

  // ── Expert Belt dentro una catena di due e di tre ────────────────────────
  // Con un modificatore solo la concatenazione coincide quasi sempre col
  // troncamento (è la lezione di D-2). Serve un secondo modificatore nella
  // STESSA catena finale perché l'aritmetica sia osservabile: lo schermo
  // (0xAAC) sta al punto a, Expert Belt al punto o, la bacca al punto q.
  //
  // ─── PERCHÉ NON GARCHOMP ────────────────────────────────────────────────
  // Il primo tentativo usava Earthquake come i casi qui sopra, ed è finito
  // negli ESCLUSI dell'harness: una mossa ad area su bersaglio singolo con uno
  // schermo attivo non è esprimibile in NCP, dove il formato governa insieme
  // la penalità d'area e il moltiplicatore dello schermo. Sarebbero rimasti
  // due casi vivi solo nello snapshot — cioè congelati, non verificati.
  //
  // Crunch di Chien-Pao è a bersaglio singolo e prende super efficace su
  // Gholdengo (Buio contro Spettro ×2, contro Acciaio ×1), e la Colbur Berry
  // resiste al Buio. Stessa catena, stesso punto della formula, ma con un
  // caso che l'oracolo sa leggere.
  const [chien, crunch] = A.chienCrunch

  aggiungi('B11', 'expertbelt+reflect', {
    attacker: { ...chien, atkItem: 'expert belt' },
    defender: D.gold,
    move: crunch,
    field: field({ reflect: true }),
  })

  // Tre modificatori: schermo + Expert Belt + bacca resistente. Da tre in su
  // l'ordine dentro la catena può contare (misurato in D-2: 279 terne su 729),
  // quindi questo è anche il caso che verifica di aver copiato l'ordine di NCP
  // e non uno qualsiasi.
  aggiungi('B11', 'expertbelt+reflect+colbur', {
    attacker: { ...chien, atkItem: 'expert belt' },
    defender: { ...D.gold, defItem: 'colbur berry' },
    move: crunch,
    field: field({ reflect: true }),
  })

  // ── Vocabolario del meteo ────────────────────────────────────────────────
  // B2 copre già `hail` e `sandstorm` sulle cinque coppie standard, ma solo
  // una di quelle coppie ha un difensore che reagisce al meteo (Calyrex-Ice
  // sotto neve). Questi casi aggiungono l'altra metà — il difensore Roccia
  // sotto sabbia, che in B2 non c'è: `chompRock` colpisce Corviknight, che è
  // Acciaio/Volante, e comunque Rock Slide è fisica mentre il bonus della
  // sabbia è sulla Difesa Speciale.
  //
  // Tyranitar è Roccia/Buio e prende un attacco speciale: sotto `sand` il
  // bonus c'è già oggi, sotto `sandstorm` no. Dopo la normalizzazione i due
  // devono dare lo stesso numero — ed è una relazione, non un valore, quindi
  // sopravvive a qualunque cambio futuro della formula.
  const ttar = def('tyranitar', 'careful', SP.difensore)
  for (const w of ['sand', 'sandstorm', null]) {
    aggiungi('B11', `sabbia-roccia-${w ?? 'nessuno'}`, {
      attacker: A.fluttMoon[0],
      defender: ttar,
      move: A.fluttMoon[1],
      field: field({ weather: w }),
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// B12 — Lo strato di preparazione (sessione J)
//
// PERCHÉ ESISTE QUESTO BLOCCO.
// Il piano chiedeva, come criterio di J, che «`snapshot:diff` si muova». Prima
// di scriverlo l'ho misurato sui 549 casi esistenti. Quanti erano capaci di
// muoversi:
//
//   Intimidate contro una delle dodici abilità che lo contrastano     0
//   Protosynthesis / Quark Drive                                      0
//   Download                                                          0
//   Intrepid Sword / Dauntless Shield                                 0
//   Booster Energy                                                    0
//   Intimidate sull'ATTACCANTE                                        0
//
// Zero su tutta la riga. Il corpus conteneva Intimidate solo con l'attaccante
// ad abilità nulla, e Defiant / Contrary / Competitive solo contro un
// difensore SENZA Intimidate. Il criterio, così com'era, sarebbe stato
// soddisfatto anche da una sessione che non implementa niente — è il difetto
// che il piano elenca nove volte e che questa volta è stato trovato prima.
//
// Quindi: questo blocco viene fotografato PRIMA della correzione, cioè con la
// preparazione ancora sbagliata. Dopo l'implementazione `snapshot:diff` deve
// muovere esattamente questi casi e nessuno degli altri 549.
//
// ─── I CONTROLLI CHE NON DEVONO MUOVERSI ──────────────────────────────────
// Contrary, Defiant e Competitive oggi sono già d'accordo con il riferimento
// (lo dicono i tre golden B6-abil-atk-*). Metterli qui, questa volta CONTRO un
// Intimidate acceso, serve a dimostrare che riscrivere il blocco non li ha
// spostati. Se si muovono, la trascrizione ha rotto la parte che funzionava.
// ═══════════════════════════════════════════════════════════════════════════

{
  const [chomp, eq] = A.chompEq
  const [flutt, moonblast] = A.fluttMoon

  // Il difensore con Intimidate acceso: sempre lo stesso, così l'unica cosa
  // che varia fra un caso e l'altro è l'abilità dell'attaccante.
  const incinIntimida = {
    ...D.incin,
    defAbility: 'intimidate',
    defAbilityFlags: { intimidateActive: true },
  }

  // ── Le dodici abilità di `checkIntimidate`, più la neutra ────────────────
  // L'ordine è quello del vendor (damage_MASTER.js:559): prima chi inverte,
  // poi chi annulla, poi chi rimbalza, poi chi raddoppia.
  const contrastiIntimidate = [
    'contrary',          // inverte  → +1   (già corretto oggi: non deve muoversi)
    'guard dog',         // inverte  → +1
    'clear body',        // annulla
    'white smoke',       // annulla
    'hyper cutter',      // annulla
    'full metal body',   // annulla
    'inner focus',       // annulla (da ottava generazione)
    'oblivious',         // annulla (da ottava generazione)
    'own tempo',         // annulla (da ottava generazione)
    'scrappy',           // annulla (da ottava generazione)
    'mirror armor',      // rimbalza al mittente
    'simple',            // raddoppia → −2
    'defiant',           // il calo si applica, poi +2 (già corretto oggi)
    'pressure',          // neutra: il calo passa senza ostacoli (controllo)
  ]

  for (const nome of contrastiIntimidate) {
    aggiungi('B12', `intimidate-vs-${nome.replace(/ /g, '_')}`, {
      attacker: { ...chomp, atkAbility: nome },
      defender: incinIntimida,
      move: eq,
      field: field(),
    })
  }

  // Competitive alza l'Attacco Speciale: per vederlo serve una mossa speciale,
  // altrimenti è una sonda cieca — la trappola in cui è caduta la prima misura
  // di F-2, e la ragione per cui questo caso non usa Garchomp.
  aggiungi('B12', 'intimidate-vs-competitive', {
    attacker: { ...flutt, atkAbility: 'competitive' },
    defender: incinIntimida,
    move: moonblast,
    field: field(),
  })

  // ── Clear Amulet: uno strumento dentro `checkIntimidate` ─────────────────
  // Sta nella stessa condizione delle quattro abilità che annullano il calo.
  // Fino a oggi non era nemmeno selezionabile: `items.json` si fermava alla
  // settima generazione.
  aggiungi('B12', 'intimidate-vs-clear_amulet', {
    attacker: { ...chomp, atkAbility: 'pressure', atkItem: 'clear amulet' },
    defender: incinIntimida,
    move: eq,
    field: field(),
  })

  // ── Adrenaline Orb: l'unico pezzo di Intimidate che si vede nel danno ────
  // Alza la Velocità — invisibile qui — ma CONSUMA sé stesso, e uno strumento
  // consumato non c'è più quando Knock Off va a cercarlo. Quindi l'attaccante
  // deve essere lui a intimidire, e la mossa deve essere Knock Off.
  const incinKnockIntimida = {
    ...A.incinKnock[0],
    atkAbility: 'intimidate',
    atkAbilityFlags: { intimidateActive: true },
  }

  aggiungi('B12', 'adrenaline_orb-consumato', {
    attacker: incinKnockIntimida,
    defender: { ...D.chomp, defItem: 'adrenaline orb' },
    move: 'knock off',
    field: field(),
  })

  // Controllo: stesso strumento, Intimidate SPENTO. L'orbo resta addosso e
  // Knock Off tiene il suo ×1.5. Senza questo caso, il precedente proverebbe
  // solo che «qualcosa è cambiato».
  aggiungi('B12', 'adrenaline_orb-controllo', {
    attacker: { ...incinKnockIntimida, atkAbilityFlags: { intimidateActive: false } },
    defender: { ...D.chomp, defItem: 'adrenaline orb' },
    move: 'knock off',
    field: field(),
  })

  // ── Mirror Armor visto dall'altro lato ───────────────────────────────────
  // L'attaccante intimidisce, il difensore rimbalza, e il calo torna
  // sull'Attacco di CHI ATTACCA. È l'unico caso in cui l'Intimidate
  // dell'attaccante — che oggi non leggiamo affatto — sposta il danno della
  // cella in cui si trova.
  aggiungi('B12', 'intimidate-attaccante-vs-mirror_armor', {
    attacker: {
      ...A.incinKnock[0],
      atkAbility: 'intimidate',
      atkAbilityFlags: { intimidateActive: true },
    },
    defender: { ...D.chomp, defAbility: 'mirror armor' },
    move: 'knock off',
    field: field(),
  })

  // ── Intrepid Sword e Dauntless Shield ────────────────────────────────────
  // In Champions si applicano SEMPRE: la condizione del vendore è
  // `gen !== 9 || abilityOn`, e `gen` vale 10. Legarli al flag sarebbe
  // costruire un controllo identico al bersaglio per definizione.
  const zacian = atk('zacian', 'adamant', SP.fisico)

  aggiungi('B12', 'intrepid_sword', {
    attacker: { ...zacian, atkAbility: 'intrepid sword' },
    defender: D.chomp,
    move: 'play rough',
    field: field(),
  })
  aggiungi('B12', 'intrepid_sword-controllo', {
    attacker: { ...zacian, atkAbility: 'pressure' },
    defender: D.chomp,
    move: 'play rough',
    field: field(),
  })

  const zamazenta = def('zamazenta', 'impish', SP.bulkyFis)

  aggiungi('B12', 'dauntless_shield', {
    attacker: chomp,
    defender: { ...zamazenta, defAbility: 'dauntless shield' },
    move: eq,
    field: field(),
  })
  aggiungi('B12', 'dauntless_shield-controllo', {
    attacker: chomp,
    defender: { ...zamazenta, defAbility: 'pressure' },
    move: eq,
    field: field(),
  })

  // ── Abilità paradosso ────────────────────────────────────────────────────
  // Roaring Moon ha l'Attacco come statistica più alta (139), Iron Valiant
  // pure (130): con una mossa fisica il ×1.3 finisce sull'attacco e si vede.
  // Iron Treads ha la Difesa più alta (120): lì il ×1.3 va sulla difesa.
  //
  // Le tre condizioni di accensione sono separate perché sono tre rami
  // distinti del vendor, e un caso che le mescolasse non saprebbe dire quale
  // ramo ha fallito.
  const moonCrunch = atk('roaring-moon', 'serious', SP.vuoto)
  const valiant = atk('iron-valiant', 'serious', SP.vuoto)

  aggiungi('B12', 'protosynthesis-sole', {
    attacker: { ...moonCrunch, atkAbility: 'protosynthesis' },
    defender: D.chomp,
    move: 'crunch',
    field: field({ weather: 'sun' }),
  })
  aggiungi('B12', 'protosynthesis-booster_energy', {
    attacker: { ...moonCrunch, atkAbility: 'protosynthesis', atkItem: 'booster energy' },
    defender: D.chomp,
    move: 'crunch',
    field: field(),
  })
  aggiungi('B12', 'protosynthesis-spento', {
    attacker: { ...moonCrunch, atkAbility: 'protosynthesis' },
    defender: D.chomp,
    move: 'crunch',
    field: field(),
  })
  aggiungi('B12', 'quark_drive-campo', {
    attacker: { ...valiant, atkAbility: 'quark drive' },
    defender: D.chomp,
    move: 'close combat',
    field: field({ terrain: 'electric' }),
  })
  aggiungi('B12', 'quark_drive-booster_energy', {
    attacker: { ...valiant, atkAbility: 'quark drive', atkItem: 'booster energy' },
    defender: D.chomp,
    move: 'close combat',
    field: field(),
  })
  aggiungi('B12', 'quark_drive-spento', {
    attacker: { ...valiant, atkAbility: 'quark drive' },
    defender: D.chomp,
    move: 'close combat',
    field: field(),
  })

  // Il lato difensivo: `calcDefMods` punto d. Senza questo caso, metà del
  // paradosso resterebbe non fotografata.
  const treads = def('iron-treads', 'serious', SP.vuoto)

  aggiungi('B12', 'quark_drive-difesa', {
    attacker: chomp,
    defender: { ...treads, defAbility: 'quark drive' },
    move: eq,
    field: field({ terrain: 'electric' }),
  })
  aggiungi('B12', 'quark_drive-difesa-spento', {
    attacker: chomp,
    defender: { ...treads, defAbility: 'quark drive' },
    move: eq,
    field: field(),
  })

  // Booster Energy consumato: il difensore lo tiene, l'abilità lo accende,
  // e Knock Off non trova più niente da buttare via. Roaring Moon ha
  // l'Attacco come statistica più alta, quindi il ×1.3 va sull'attacco e NON
  // sulla difesa: il caso misura la sparizione dello strumento e nient'altro.
  aggiungi('B12', 'booster_energy-consumato', {
    attacker: A.incinKnock[0],
    defender: { ...def('roaring-moon', 'serious', SP.vuoto), defAbility: 'protosynthesis', defItem: 'booster energy' },
    move: 'knock off',
    field: field(),
  })
  aggiungi('B12', 'booster_energy-controllo', {
    attacker: A.incinKnock[0],
    defender: { ...def('roaring-moon', 'serious', SP.vuoto), defAbility: 'pressure', defItem: 'booster energy' },
    move: 'knock off',
    field: field(),
  })

  // ── Download ─────────────────────────────────────────────────────────────
  // Blissey ha Difesa 10 e Difesa Speciale 135: Download sceglie l'Attacco
  // fisico. La mossa di prova è quindi fisica, o il boost c'è e non si vede.
  const genesect = atk('genesect', 'serious', SP.vuoto)
  const blissey = def('blissey', 'serious', SP.vuoto)

  aggiungi('B12', 'download-fisico', {
    attacker: { ...genesect, atkAbility: 'download' },
    defender: blissey,
    move: 'iron head',
    field: field(),
  })
  aggiungi('B12', 'download-controllo', {
    attacker: { ...genesect, atkAbility: 'pressure' },
    defender: blissey,
    move: 'iron head',
    field: field(),
  })
}

// ─── Tag derivati ──────────────────────────────────────────────────────────

/**
 * Calcola i tag di un caso a partire dai suoi input.
 *
 * I tag non sono decorazione: sono lo strumento con cui nella sessione D si
 * verifica il criterio di accettazione "cambiano solo i casi con ≥2
 * modificatori finali". `scripts/diff-snapshot.mjs` raggruppa per questi tag.
 *
 * `mods:N` conta i modificatori che nella formula reale andrebbero concatenati
 * in fixed-point (§1.2). Oggi il motore applica un Math.floor a ciascuno.
 */
export function calcolaTag(input) {
  const { attacker: a, defender: d, field: f, move } = input
  const tag = []

  if (f.weather) tag.push(`weather:${f.weather.replace(/ /g, '_')}`)
  if (f.terrain) tag.push(`terrain:${f.terrain}`)
  if (f.crit) tag.push('crit')
  if (f.helpingHand) tag.push('helpinghand')
  if (f.doubleTarget) tag.push('doubletarget')
  if (f.reflect) tag.push('reflect')
  if (f.lightScreen) tag.push('lightscreen')
  if (f.auroraVeil) tag.push('auroraveil')
  if (f.reflect && f.auroraVeil) tag.push('schermi-multipli')

  if (a.atkItem) tag.push(`item-atk:${a.atkItem.replace(/ /g, '_')}`)
  if (d.defItem) tag.push(`item-def:${d.defItem.replace(/ /g, '_')}`)
  if (a.atkAbility) tag.push(`abil-atk:${a.atkAbility.replace(/ /g, '_')}`)
  if (d.defAbility) tag.push(`abil-def:${d.defAbility.replace(/ /g, '_')}`)

  if (a.atkBoost || a.spAtkBoost) tag.push('boost-atk')
  if (d.defBoost || d.spDefBoost) tag.push('boost-def')
  if (a.lastRespectsKOs) tag.push('lastrespects')
  if (move === 'body press') tag.push('bodypress')
  if (move === 'weather ball') tag.push('weatherball')
  if (move === 'knock off') tag.push('knockoff')

  // Conteggio dei modificatori finali potenzialmente concatenabili
  let mods = 0
  if (a.atkItem === 'life orb') mods++
  // Expert Belt occupa il punto o della catena finale, subito prima di Life
  // Orb. Conta come modificatore solo quando l'efficacia è maggiore di 1, ma
  // qui l'efficacia non è calcolabile senza il Pokédex — e questo file non
  // importa niente da `src/`. Lo conto sempre: sovrastima il tag di qualche
  // caso, mai il contrario, e il tag serve a raggruppare il diff, non ad
  // asserire.
  if (a.atkItem === 'expert belt') mods++
  if (d.defItem && d.defItem.endsWith(' berry') && d.defItem !== 'sitrus berry') mods++
  if (d.defAbility && ['multiscale', 'shadow shield', 'filter', 'solid rock', 'thick fat', 'fluffy'].includes(d.defAbility)) mods++
  if (f.reflect) mods++
  if (f.lightScreen) mods++
  if (f.auroraVeil) mods++
  if (f.helpingHand) mods++
  tag.push(`mods:${mods}`)

  return tag
}

export const CASI = casi.map(c => ({ ...c, tags: calcolaTag(c.input) }))