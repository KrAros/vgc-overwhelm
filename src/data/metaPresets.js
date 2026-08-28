// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/data/metaPresets.js
 *
 * Set osservati nel meta competitivo di Champions.
 *
 * ─── LA PROVENIENZA STA SU OGNI SET, NON IN TESTA AL FILE ──────────────────
 *
 * Qui c'era una riga sola che dichiarava la fonte di tutti e venti, e
 * CONTRIBUTING.md ne fa una promessa: «il file dichiara la propria fonte in
 * testa, e quella riga deve restare vera». Restava vera finché i set venivano
 * tutti dallo stesso posto e dallo stesso periodo — cioè fino al primo set di
 * un altro periodo, che l'avrebbe resa falsa senza che niente diventasse
 * rosso.
 *
 * Ogni set porta quindi il campo `reg`, che dice sotto quali REGOLE è stato
 * osservato: M-A, M-B. `regChampions.json` elenca quelle valide, e
 * `metaPresets.test.js` rifiuta una reg che non esiste.
 *
 * ─── PERCHE' LA REG E NON LA STAGIONE ──────────────────────────────────────
 *
 * Il campo è stato per un po' la STAGIONE — M-1…M-5, il periodo di classifica
 * — e il cambio merita di essere scritto, perché è costato un difetto vero.
 *
 * L'idea era che un set fosse un'osservazione datata, e che la data valesse la
 * pena di conservarla. Vero in astratto. Ma il filtro dell'interfaccia usava
 * quella data per rispondere a una domanda diversa — «quali set posso usare
 * adesso?» — e le due cose divergono: le specie utilizzabili cambiano solo fra
 * REG, mai fra stagioni della stessa reg.
 *
 * Misurato quando M-5 è diventata la stagione di partenza: la tendina mostrava
 * set per 2 specie su 20. Gli altri venti set erano perfettamente legali e
 * invisibili, nascosti dalla loro data di osservazione.
 *
 * Scelta di Simone: la reg è l'unica cosa che cambia davvero cosa si può
 * giocare, quindi è l'unica che etichetta un set. Il prezzo, dichiarato: due
 * osservazioni della stessa specie con la stessa etichetta nella stessa reg
 * non possono coesistere. Quando è successo — Incineroar «Sitrus Support» in
 * M-4 con SP 24/8 e in M-5 con 21/11 — si è tenuta la più recente.
 */

export const META_PRESETS = [
  // ── Support ────────────────────────────────────────────────────────────────
  {
    slug: 'sinistcha',
    label: 'Trick Room Support',
    nature: 'Bold',
    item: 'kasib berry',
    ability: 'hospitality',
    sps: [32, 0, 14, 0, 20, 0],
    moves: ['matcha-gotcha', 'rage-powder', 'trick-room', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'grimmsnarl',
    label: 'Screen Support',
    nature: 'Careful',
    item: 'light clay',
    ability: 'prankster',
    sps: [32, 0, 19, 0, 15, 0],
    moves: ['reflect', 'light-screen', 'parting-shot', 'spirit-break'],
    reg: 'M-B',
  },
  {
    slug: 'blaziken',
    label: 'Coaching Support',
    nature: 'Modest',
    item: 'focus sash',
    // La forma BASE, e qui `speed-boost` e' davvero la sua: la trappola della
    // Mega scatta solo quando il set tiene la Megapietra. Questo tiene Focus
    // Sash, quindi Blaziken resta Blaziken per tutta la partita.
    ability: 'speed-boost',
    // Modest su chi ha Attacco 120 e Attacco Speciale 110 sembra un refuso.
    // Non lo e': Ondacalda e Auraconflusso sono entrambe speciali, quindi la
    // natura toglie da una statistica che il set non usa.
    sps: [2, 0, 0, 32, 0, 32],
    moves: ['heat-wave', 'aura-sphere', 'coaching', 'protect'],
    reg: 'M-B',
  },

  // ── Rain ───────────────────────────────────────────────────────────────────
  {
    slug: 'pelipper',
    label: 'Rain Setter',
    nature: 'Modest',
    item: 'sitrus berry',
    ability: 'drizzle',
    sps: [2, 0, 0, 32, 0, 32],
    moves: ['weather-ball', 'hurricane', 'tailwind', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'swampert-mega',
    label: 'Rain Sweeper',
    nature: 'Adamant',
    item: 'swampertite',
    ability: 'swift-swim',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['wave-crash', 'earthquake', 'ice-punch', 'protect'],
    reg: 'M-B',
  },

  // ── Rain / Screen ──────────────────────────────────────────────────────────
  {
    slug: 'archaludon',
    label: 'Rain / Screen',
    nature: 'Modest',
    item: 'leftovers',
    ability: 'stamina',
    sps: [32, 0, 0, 5, 15, 14],
    moves: ['electro-shot', 'flash-cannon', 'dragon-pulse', 'protect'],
    reg: 'M-B',
  },

  // ── Attaccanti ─────────────────────────────────────────────────────────────
  {
    slug: 'garchomp',
    label: 'Life Orb Attacker',
    nature: 'Jolly',
    item: 'life orb',
    ability: 'rough-skin',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['dragon-claw', 'rock-slide', 'earthquake', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'charizard-mega-y',
    label: 'Sun Setter',
    nature: 'Modest',
    item: 'charizardite y',
    ability: 'drought',
    sps: [30, 0, 30, 1, 0, 5],
    moves: ['heat-wave', 'weather-ball', 'solar-beam', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'kingambit',
    label: 'Defiant Sweeper',
    nature: 'Adamant',
    item: 'blackglasses',
    ability: 'defiant',
    sps: [32, 32, 0, 0, 2, 0],
    moves: ['kowtow-cleave', 'sucker-punch', 'swords-dance', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'sneasler',
    label: 'Sash Attacker',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'unburden',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['fake-out', 'close-combat', 'dire-claw', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'annihilape',
    label: 'Sash Attacker',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'defiant',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['fake-out', 'close-combat', 'phantom-force', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'excadrill',
    label: 'Sash Sand Abuser',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'sand-rush',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['earthquake', 'iron-head', 'rock-slide', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'basculegion-m',
    label: 'Scarf Wallbreaker',
    nature: 'Jolly',
    item: 'choice scarf',
    ability: 'adaptability',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['wave-crash', 'last-respects', 'aqua-jet', 'flip-turn'],
    reg: 'M-B',
  },
  {
    slug: 'venusaur',
    label: 'Sash Sun Abuser',
    nature: 'Modest',
    item: 'focus sash',
    ability: 'chlorophyll',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['sludge-bomb', 'earth-power', 'sleep-powder', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'archaludon',
    label: 'Rain Special Attacker',
    nature: 'Modest',
    item: 'leftovers',
    ability: 'stamina',
    sps: [32, 0, 0, 1, 29, 4],
    moves: ['electro-shot', 'flash-cannon', 'dragon-pulse', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'sylveon',
    label: 'Bulky Special Attacker',
    nature: 'Modest',
    item: 'fairy feather',
    ability: 'pixilate',
    sps: [18, 0, 10, 21, 0, 17],
    moves: ['hyper-beam', 'hyper-voice', 'quick-attack', 'detect'],
    reg: 'M-B',
  },
  {
    slug: 'gholdengo',
    label: 'Choice Scarf',
    nature: 'Modest',
    item: 'choice scarf',
    ability: 'good-as-gold',
    sps: [1, 0, 2, 32, 0, 31],
    moves: ['make-it-rain', 'shadow-ball', 'power-gem', 'focus-blast'],
    reg: 'M-B',
  },

  // ── Mega ───────────────────────────────────────────────────────────────────
  {
    slug: 'metagross-mega',
    label: 'Tough Claws Attacker',
    nature: 'Jolly',
    item: 'metagrossite',
    ability: 'tough-claws',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['iron-head', 'psychic-fangs', 'body-press', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'staraptor-mega',
    label: 'Contrary Attacker',
    nature: 'Jolly',
    item: 'staraptite',
    ability: 'contrary',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['close-combat', 'brave-bird', 'quick-attack', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'garchomp-mega',
    label: 'Sand Force Attacker',
    nature: 'Jolly',
    item: 'garchompite',
    ability: 'sand-force',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['dragon-claw', 'earthquake', 'rock-slide', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'incineroar',
    label: 'Sitrus Support',
    nature: 'Impish',
    item: 'sitrus berry',
    ability: 'intimidate',
    sps: [32, 0, 21, 0, 11, 2],
    moves: ['fake-out', 'flare-blitz', 'throat-chop', 'parting-shot'],
    reg: 'M-B',
  },
  {
    slug: 'aerodactyl',
    label: 'Sash Tailwind Lead',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'unnerve',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['rock-slide', 'dual-wingbeat', 'wide-guard', 'tailwind'],
    reg: 'M-B',
  },
  {
    slug: 'aerodactyl-mega',
    label: 'Bulky Speed Control',
    nature: 'Jolly',
    item: 'aerodactylite',
    ability: 'tough-claws',
    sps: [28, 11, 9, 0, 1, 17],
    moves: ['rock-slide', 'ice-fang', 'tailwind', 'wide-guard'],
    reg: 'M-B',
  },
  {
    slug: 'arcanine-hisui',
    label: 'Rock Head Attacker',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'rock-head',
    sps: [1, 32, 1, 0, 0, 32],
    moves: ['flare-blitz', 'head-smash', 'rock-slide', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'arcanine-hisui',
    label: 'Intimidate Support',
    nature: 'Adamant',
    item: 'lum berry',
    ability: 'intimidate',
    sps: [0, 32, 2, 0, 0, 32],
    // `will-o-wisp` col trattino, che e' la chiave vera di moves.json. Fino a
    // ieri una mossa cosi' non si poteva scrivere in un set: la risoluzione
    // sostituiva ogni trattino con uno spazio e lo slot restava vuoto.
    moves: ['flare-blitz', 'protect', 'will-o-wisp', 'rock-slide'],
    reg: 'M-B',
  },
  {
    // `-m`, il maschio: le due forme divergono nelle stat — 112 Att / 80 AttSp
    // contro 92 / 100 — e questo e' un set fisico. Anche l'altro Basculegion
    // in questo file e' il maschio.
    slug: 'basculegion-m',
    label: 'Life Orb Attacker',
    nature: 'Jolly',
    item: 'life orb',
    ability: 'adaptability',
    sps: [4, 30, 0, 0, 0, 32],
    moves: ['wave-crash', 'aqua-jet', 'last-respects', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'basculegion-m',
    label: 'Rain Sweeper',
    nature: 'Adamant',
    ability: 'swift-swim',
    item: 'life orb',
    sps: [4, 18, 11, 0, 1, 32],
    moves: ['last-respects', 'wave-crash', 'aqua-jet', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'blastoise',
    label: 'Bulky Pivot',
    nature: 'Impish',
    ability: 'rain-dish',
    item: 'leftovers',
    sps: [32, 0, 30, 0, 4, 0],
    moves: ['flip-turn', 'fake-out', 'yawn', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'blastoise-mega',
    label: 'Setup Sweeper',
    nature: 'Modest',
    item: 'blastoisinite',
    // `mega-launcher`, non `rain-dish`. Il set ricevuto dichiarava Pellepioggia
    // perche' in formato Showdown si scrive l'abilita della forma BASE: la
    // megaevoluzione avviene in partita. Nel nostro modello la Mega e una
    // specie a se, e ha Megalancio come unica abilita.
    ability: 'mega-launcher',
    sps: [1, 0, 1, 32, 0, 32],
    moves: ['dark-pulse', 'water-spout', 'shell-smash', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'blastoise-mega',
    label: 'Trick Room Abuser',
    nature: 'Quiet',
    item: 'blastoisinite',
    // Anche qui `mega-launcher` contro il Pellepioggia dichiarato in Showdown,
    // e qui la differenza si vede nei numeri: Megalancio porta Auraconflusso e
    // Buiosfera al 150%. Con `rain-dish` resterebbe un set che ha scelto due
    // mosse per un'abilita' che non ha.
    ability: 'mega-launcher',
    // Non porta Distortozona: gliela mette il compagno. Da qui «Abuser», come
    // Excadrill con la sabbia e Venusaur col sole, e non «Sweeper».
    sps: [31, 0, 3, 32, 0, 0],
    moves: ['water-spout', 'dark-pulse', 'aura-sphere', 'fake-out'],
    reg: 'M-B',
  },
]

export const PRESETS_BY_SLUG = META_PRESETS.reduce((acc, p) => {
  if (!acc[p.slug]) acc[p.slug] = []
  acc[p.slug].push(p)
  return acc
}, {})