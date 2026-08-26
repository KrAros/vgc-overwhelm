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
 * un'altra stagione, che l'avrebbe resa falsa senza che niente diventasse
 * rosso.
 *
 * Ogni set porta quindi il campo `stagione`, che dice **quando** è stato
 * osservato. La reg non si scrive: la determina la stagione, e scriverle
 * entrambe permetterebbe di dichiarare `M-A` accanto a `M-5`.
 *
 * ─── PERCHE' LA STAGIONE E NON LA LEGALITA' ────────────────────────────────
 *
 * Un set non è «valido in M-4» come una specie è legale in una reg: è stato
 * **visto** nel meta di quel periodo. È un'osservazione, e le osservazioni non
 * scadono — un set di M-4 resta un fatto vero su M-4 anche a M-9. Per questo
 * i set vecchi non si cancellano: si etichettano e si filtrano.
 *
 * Questi venti vengono da una raccolta settimanale pubblica delle squadre
 * meglio piazzate, letta durante la **stagione M-4** (8 luglio – 5 agosto
 * 2026, sotto la reg M-B). Chi ne aggiunge uno scriva da dove viene e con
 * quale stagione l'ha visto: `regChampions.json` elenca quelle valide, e
 * `metaPresets.test.js` rifiuta una stagione che non esiste.
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
    stagione: 'M-4',
  },
  {
    slug: 'incineroar',
    label: 'Sitrus Support',
    nature: 'Impish',
    item: 'sitrus berry',
    ability: 'intimidate',
    sps: [32, 0, 24, 0, 8, 2],
    moves: ['fake-out', 'flare-blitz', 'parting-shot', 'throat-chop'],
    stagione: 'M-4',
  },
  {
    slug: 'grimmsnarl',
    label: 'Screen Support',
    nature: 'Careful',
    item: 'light clay',
    ability: 'prankster',
    sps: [32, 0, 19, 0, 15, 0],
    moves: ['reflect', 'light-screen', 'parting-shot', 'spirit-break'],
    stagione: 'M-4',
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
    stagione: 'M-4',
  },
  {
    slug: 'swampert-mega',
    label: 'Rain Sweeper',
    nature: 'Adamant',
    item: 'swampertite',
    ability: 'swift-swim',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['wave-crash', 'earthquake', 'ice-punch', 'protect'],
    stagione: 'M-4',
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
    stagione: 'M-4',
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
    stagione: 'M-4',
  },
  {
    slug: 'charizard-mega-y',
    label: 'Sun Setter',
    nature: 'Modest',
    item: 'charizardite y',
    ability: 'drought',
    sps: [30, 0, 30, 1, 0, 5],
    moves: ['heat-wave', 'weather-ball', 'solar-beam', 'protect'],
    stagione: 'M-4',
  },
  {
    slug: 'kingambit',
    label: 'Defiant Sweeper',
    nature: 'Adamant',
    item: 'blackglasses',
    ability: 'defiant',
    sps: [32, 32, 0, 0, 2, 0],
    moves: ['kowtow-cleave', 'sucker-punch', 'swords-dance', 'protect'],
    stagione: 'M-4',
  },
  {
    slug: 'sneasler',
    label: 'Sash Attacker',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'unburden',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['fake-out', 'close-combat', 'dire-claw', 'protect'],
    stagione: 'M-4',
  },
  {
    slug: 'annihilape',
    label: 'Sash Attacker',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'defiant',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['fake-out', 'close-combat', 'phantom-force', 'protect'],
    stagione: 'M-4',
  },
  {
    slug: 'excadrill',
    label: 'Sash Sand Abuser',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'sand-rush',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['earthquake', 'iron-head', 'rock-slide', 'protect'],
    stagione: 'M-4',
  },
  {
    slug: 'basculegion-m',
    label: 'Scarf Wallbreaker',
    nature: 'Jolly',
    item: 'choice scarf',
    ability: 'adaptability',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['wave-crash', 'last-respects', 'aqua-jet', 'flip-turn'],
    stagione: 'M-4',
  },
  {
    slug: 'venusaur',
    label: 'Sash Sun Abuser',
    nature: 'Modest',
    item: 'focus sash',
    ability: 'chlorophyll',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['sludge-bomb', 'earth-power', 'sleep-powder', 'protect'],
    stagione: 'M-4',
  },
  {
    slug: 'archaludon',
    label: 'Rain Special Attacker',
    nature: 'Modest',
    item: 'leftovers',
    ability: 'stamina',
    sps: [32, 0, 0, 1, 29, 4],
    moves: ['electro-shot', 'flash-cannon', 'dragon-pulse', 'protect'],
    stagione: 'M-4',
  },
  {
    slug: 'sylveon',
    label: 'Bulky Special Attacker',
    nature: 'Modest',
    item: 'fairy feather',
    ability: 'pixilate',
    sps: [18, 0, 10, 21, 0, 17],
    moves: ['hyper-beam', 'hyper-voice', 'quick-attack', 'detect'],
    stagione: 'M-4',
  },
  {
    slug: 'gholdengo',
    label: 'Choice Scarf',
    nature: 'Modest',
    item: 'choice scarf',
    ability: 'good as gold',
    sps: [1, 0, 2, 32, 0, 31],
    moves: ['make-it-rain', 'shadow-ball', 'power-gem', 'focus-blast'],
    stagione: 'M-4',
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
    stagione: 'M-4',
  },
  {
    slug: 'staraptor-mega',
    label: 'Contrary Attacker',
    nature: 'Jolly',
    item: 'staraptite',
    ability: 'contrary',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['close-combat', 'brave-bird', 'quick-attack', 'protect'],
    stagione: 'M-4',
  },
  {
    slug: 'garchomp-mega',
    label: 'Sand Force Attacker',
    nature: 'Jolly',
    item: 'garchompite',
    ability: 'sand-force',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['dragon-claw', 'earthquake', 'rock-slide', 'protect'],
    stagione: 'M-4',
  },
  // ── M-5 ──────────────────────────────────────────────────────────────────
  //
  // Stagione in corso (5 agosto – 9 settembre 2026, reg M-B). I set di M-4
  // restano: sono osservazioni di quel periodo, e un'osservazione non scade.
  {
    slug: 'incineroar',
    label: 'Sitrus Support',
    nature: 'Impish',
    item: 'sitrus berry',
    ability: 'intimidate',
    sps: [32, 0, 21, 0, 11, 2],
    moves: ['fake-out', 'flare-blitz', 'throat-chop', 'parting-shot'],
    stagione: 'M-5',
  },
  {
    slug: 'aerodactyl',
    label: 'Sash Tailwind Lead',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'unnerve',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['rock-slide', 'dual-wingbeat', 'wide-guard', 'tailwind'],
    stagione: 'M-5',
  },
]

export const PRESETS_BY_SLUG = META_PRESETS.reduce((acc, p) => {
  if (!acc[p.slug]) acc[p.slug] = []
  acc[p.slug].push(p)
  return acc
}, {})