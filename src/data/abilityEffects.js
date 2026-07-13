export const ABILITY_EFFECTS = {
  // Raddoppia Atk fisico attaccante
  'huge-power':  { atkMult: 2.0, statType: 'physical' },
  'pure-power':  { atkMult: 2.0, statType: 'physical' },

  // STAB diventa ×2
  'adaptability': { adaptability: true },

  // Difensore: ×0.5 danno da Fuoco e Ghiaccio
  'thick-fat':   { thickFat: true },

  // Immunità a Fuoco + boost se colpito (gestiamo solo il boost passivo)
  'flash fire':  { flashFire: true },

  // Riduce danno superefficace di ×0.75
  'filter':      { filter: true },
  'solid rock':  { filter: true },
}