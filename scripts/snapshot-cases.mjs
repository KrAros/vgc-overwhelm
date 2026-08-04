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
  fluttMoon:  [atk('fluttermane', 'modest', SP.speciale), 'moonblast'],    // STAB speciale
  fluttShadow:[atk('fluttermane', 'modest', SP.speciale), 'shadow ball'],  // STAB speciale
  incinFlare: [atk('incineroar', 'adamant', SP.misto), 'flare blitz'],     // STAB Fire contatto
  incinKnock: [atk('incineroar', 'adamant', SP.misto), 'knock off'],       // STAB Dark contatto
  rillaWood:  [atk('rillaboom', 'adamant', SP.fisico), 'wood hammer'],     // STAB Grass contatto
  chienCrunch:[atk('chienpao', 'jolly', SP.fisico), 'crunch'],             // STAB Dark contatto
  chienIcicle:[atk('chienpao', 'jolly', SP.fisico), 'icicle crash'],       // STAB Ice
  handsPunch: [atk('ironhands', 'adamant', SP.fisico), 'drain punch'],     // STAB Fighting
  goldRain:   [atk('gholdengo', 'modest', SP.speciale), 'make it rain'],   // STAB Steel spread
  calyLance:  [atk('calyrexice', 'adamant', SP.fisico), 'glacial lance'],  // STAB Ice spread
  torkoalHeat:[atk('torkoal', 'modest', SP.speciale), 'heat wave'],        // STAB Fire spread
  bundleHydro:[atk('ironbundle', 'timid', SP.speciale), 'hydro pump'],     // STAB Water
  boltDraco:  [atk('ragingbolt', 'modest', SP.speciale), 'draco meteor'],  // STAB Dragon
  ursaRush:   [atk('ursaluna', 'adamant', SP.fisico), 'headlong rush'],    // STAB Ground
  dragoSpeed: [atk('dragonite', 'adamant', SP.fisico), 'extreme speed'],   // non-STAB priorità
  kingIron:   [atk('kingambit', 'adamant', SP.fisico), 'iron head'],       // STAB Steel
  pelipSurf:  [atk('pelipper', 'modest', SP.speciale), 'surf'],            // STAB Water spread
}

// ─── Difensori ricorrenti ──────────────────────────────────────────────────

const D = {
  incin:    def('incineroar', 'careful', SP.difensore),
  amoon:    def('amoonguss', 'calm', SP.bulkySpe),
  rilla:    def('rillaboom', 'impish', SP.bulkyFis),
  lando:    def('landorus-therian', 'impish', SP.bulkyFis),   // Flying: immune a Ground
  hands:    def('ironhands', 'adamant', SP.misto),
  flutt:    def('fluttermane', 'timid', SP.vuoto),            // fragilissimo
  gold:     def('gholdengo', 'bold', SP.difensore),
  torkoal:  def('torkoal', 'bold', SP.bulkyFis),
  dragonite:def('dragonite', 'careful', SP.difensore),
  chomp:    def('garchomp', 'jolly', SP.vuoto),
  ursa:     def('ursaluna', 'adamant', SP.bulkyFis),
  caly:     def('calyrexice', 'brave', SP.bulkyFis),
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
    ['band+thickfat',          'chienpao',    'adamant',  SP.fisico,   'choice band',   null,          'ursaluna', 'thick fat',      'icicle crash'],
    ['specs+purifsalt',        'gholdengo',   'timid',    [0,0,0,24,0,30], 'choice specs', null,       'ironhands','purifying salt', 'shadow ball'],
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