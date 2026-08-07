// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/data/metaPresets.js
 * Set meta verificati da MetaVGC (Tenki's Cart Weekly #109 Reg MB, top 10).
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
  },
  {
    slug: 'incineroar',
    label: 'Sitrus Support',
    nature: 'Impish',
    item: 'sitrus berry',
    ability: 'intimidate',
    sps: [32, 0, 24, 0, 8, 2],
    moves: ['fake-out', 'flare-blitz', 'parting-shot', 'throat-chop'],
  },
  {
    slug: 'grimmsnarl',
    label: 'Screen Support',
    nature: 'Careful',
    item: 'light clay',
    ability: 'prankster',
    sps: [32, 0, 19, 0, 15, 0],
    moves: ['reflect', 'light-screen', 'parting-shot', 'spirit-break'],
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
  },
  {
    slug: 'swampert-mega',
    label: 'Rain Sweeper',
    nature: 'Adamant',
    item: 'swampertite',
    ability: 'swift-swim',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['wave-crash', 'earthquake', 'ice-punch', 'protect'],
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
  },
  {
    slug: 'charizard-mega-y',
    label: 'Sun Setter',
    nature: 'Modest',
    item: 'charizardite y',
    ability: 'drought',
    sps: [30, 0, 30, 1, 0, 5],
    moves: ['heat-wave', 'weather-ball', 'solar-beam', 'protect'],
  },
  {
    slug: 'kingambit',
    label: 'Defiant Sweeper',
    nature: 'Adamant',
    item: 'blackglasses',
    ability: 'defiant',
    sps: [32, 32, 0, 0, 2, 0],
    moves: ['kowtow-cleave', 'sucker-punch', 'swords-dance', 'protect'],
  },
  {
    slug: 'sneasler',
    label: 'Sash Attacker',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'unburden',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['fake-out', 'close-combat', 'dire-claw', 'protect'],
  },
  {
    slug: 'annihilape',
    label: 'Sash Attacker',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'defiant',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['fake-out', 'close-combat', 'phantom-force', 'protect'],
  },
  {
    slug: 'excadrill',
    label: 'Sash Sand Abuser',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'sand rush',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['earthquake', 'iron-head', 'rock-slide', 'protect'],
  },
  {
    slug: 'basculegion-m',
    label: 'Scarf Wallbreaker',
    nature: 'Jolly',
    item: 'choice scarf',
    ability: 'adaptability',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['wave-crash', 'last-respects', 'aqua-jet', 'flip-turn'],
  },
  {
    slug: 'venusaur',
    label: 'Sash Sun Abuser',
    nature: 'Modest',
    item: 'focus sash',
    ability: 'chlorophyll',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['sludge-bomb', 'earth-power', 'sleep-powder', 'protect'],
  },
  {
    slug: 'archaludon',
    label: 'Rain Special Attacker',
    nature: 'Modest',
    item: 'leftovers',
    ability: 'stamina',
    sps: [32, 0, 0, 1, 29, 4],
    moves: ['electro-shot', 'flash-cannon', 'dragon-pulse', 'protect'],
  },
  {
    slug: 'sylveon',
    label: 'Bulky Special Attacker',
    nature: 'Modest',
    item: 'fairy feather',
    ability: 'pixilate',
    sps: [18, 0, 10, 21, 0, 17],
    moves: ['hyper-beam', 'hyper-voice', 'quick-attack', 'detect'],
  },
  {
    slug: 'gholdengo',
    label: 'Choice Scarf ',
    nature: 'Modest',
    item: 'choice scarf',
    ability: 'good-as-gold',
    sps: [1, 0, 2, 32, 0, 31],
    moves: ['make-it-rain', 'shadow-ball', 'power-gem', 'focus-blast'],
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
  },
  {
    slug: 'staraptor-mega',
    label: 'Contrary Attacker',
    nature: 'Jolly',
    item: 'staraptite',
    ability: 'contrary',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['close-combat', 'brave-bird', 'quick-attack', 'protect'],
  },
  {
    slug: 'garchomp-mega',
    label: 'Sand Force Attacker',
    nature: 'Jolly',
    item: 'garchompite',
    ability: 'sand-force',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['dragon-claw', 'earthquake', 'rock-slide', 'protect'],
  },
]

export const PRESETS_BY_SLUG = META_PRESETS.reduce((acc, p) => {
  if (!acc[p.slug]) acc[p.slug] = []
  acc[p.slug].push(p)
  return acc
}, {})