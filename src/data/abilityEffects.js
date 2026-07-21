// ─── Normalizzazione chiave abilità ──────────────────────────────────────────
// Converte un nome abilità in qualsiasi formato (es. "Flash Fire", "flash fire")
// nella chiave usata in ABILITY_EFFECTS (es. "flash-fire").
// Esportata così che calcEngine.js e chiunque altro la importino da un posto solo.
export function normalizeAbilityKey(str) {
  return (str || '').toLowerCase().replace(/ /g, '-')
}

// ─── Flag di default per abilità con stato contestuale ───────────────────────
// Questi valori vengono usati da emptyPokemon() nello store per inizializzare
// abilityFlags su ogni slot Pokémon.
export const DEFAULT_ABILITY_FLAGS = {
  intimidateActive:      false, // difensore: applica -1 Atk all'attaccante nel calcolo
  flashFireActive:       false, // attaccante: boost ×1.5 Fire (dopo aver ricevuto mossa Fire)
  multiscaleActive:      true,  // difensore: ×0.5 danno ricevuto se HP pieni (default true)
  supremeOverlordKOs:    0,     // attaccante: numero alleati KO (0-5), boost ×(1 + n*0.1)
}

// ─── Effetti passivi delle abilità sul calcolo danno ─────────────────────────
// Le abilità con stato (intimidate, flash-fire, multiscale…) hanno qui solo
// metadati descrittivi. La logica vera è in calcEngine.js che legge abilityFlags.
export const ABILITY_EFFECTS = {
  // ── Attaccante: moltiplicatori stat ──────────────────────────────────────
  'huge-power':  { atkMult: 2.0, statType: 'physical', showInSmogon: true, desc: '×2 Atk su mosse fisiche' },
  'pure-power':  { atkMult: 2.0, statType: 'physical', showInSmogon: true, desc: '×2 Atk su mosse fisiche' },

  // ── Attaccante: STAB potenziato ──────────────────────────────────────────
  'adaptability': { adaptability: true, showInSmogon: true, desc: 'Aumenta l\'efficacia delle mosse STAB dal normale 1,5× a 2×.' },

  // ── Attaccante: boost tipo mossa ─────────────────────────────────────────
  'fire-mane':   { fireMane: true, showInSmogon: true, desc: '×1.5 BP su mosse Fire' },

  // ── Attaccante: boost mosse contatto ─────────────────────────────────────
  'tough-claws': { toughClaws: true, showInSmogon: true, desc: 'Aumenta l\'efficacia delle mosse da contatto di 1,3x' },

  // ── Attaccante: boost condizionale (stato) ───────────────────────────────
  'flash-fire':  { flashFireImmune: true, showInSmogon: true,
    desc: 'Immune alle mosse Fire — se colpito, ×1.5 BP Fire',
    descOn:  '×1.5 Fire attivo (colpito in precedenza)',
    descOff: 'Immune Fire — boost non ancora attivato' },

  'supreme-overlord': { supremeOverlord: true, showInSmogon: true,
    desc: '+10% Atk e SpAtk per ogni alleato a terra (max ×1.5)' },

  'multiscale':     { multiscale: true,
    desc: '×0.5 danno ricevuto quando HP pieni',
    descOn:  'Multiscale: ×0.5 danno ricevuto (HP pieni)',
    descOff: 'Multiscale: HP non pieni — nessuna riduzione' },

  'shadow-shield':  { multiscale: true,
    desc: '×0.5 danno ricevuto quando HP pieni',
    descOn:  'Shadow Shield: ×0.5 danno ricevuto (HP pieni)',
    descOff: 'Shadow Shield: HP non pieni — nessuna riduzione' },

  'intimidate':  { intimidate: true,
    desc: '−1 Atk all\'avversario a inizio turno',
    descOn:  '−1 Atk avversario attivo nel calcolo',
    descOff: 'Intimidate non ancora attivato' },

  'defiant':     { defiant: true,
    desc: '+2 Atk quando una stat viene abbassata da un avversario',
    descOn:  'Intimidate avversario attivo → Defiant: +1 Atk netto',
    descOff: 'Si attiva automaticamente quando l\'avversario usa Intimidate' },

  'contrary':    { contrary: true,
    desc: 'I boost diventano drop e viceversa — Intimidate diventa +1 Atk',
    descOn:  'Intimidate avversario attivo → Contrary: drop invertito in +1 Atk',
    descOff: 'Si attiva automaticamente quando l\'avversario usa Intimidate' },

  'competitive': { competitive: true,
    desc: '+2 SpAtk quando una stat viene abbassata da un avversario',
    descOn:  'Intimidate avversario attivo → +2 SpAtk nel calcolo',
    descOff: 'Si attiva automaticamente quando l\'avversario usa Intimidate (+2 SpAtk)' },

  // ── Meteo: Modifica le statistiche ─────────────────────────
  'sand-rush':     { sandRush: true,
    desc: 'Raddoppia la velocità in caso di tempesta di sabbia',
    descOn:  'Sand Rush attivo — velocità ×2 (vedi riga Spe)',
    descOff: 'Raddoppia la velocità in caso di tempesta di sabbia' },

  'chlorophyll':   { speedWeather: true,
    desc: 'Raddoppia la velocità sotto il sole',
    descOn:  'Chlorophyll attivo — velocità ×2 (vedi riga Spe)',
    descOff: 'Raddoppia la velocità sotto il sole' },

  'swift swim':    { speedWeather: true,
    desc: 'Raddoppia la velocità sotto la pioggia',
    descOn:  'Swift Swim attivo — velocità ×2 (vedi riga Spe)',
    descOff: 'Raddoppia la velocità sotto la pioggia' },

  'slush rush':    { speedWeather: true,
    desc: 'Raddoppia la velocità sotto la neve',
    descOn:  'Slush Rush attivo — velocità ×2 (vedi riga Spe)',
    descOff: 'Raddoppia la velocità sotto la neve' },

  // ── Solo dropdown, nessun effetto sul calcolo danno ──────────────────────
  'levitate':    { levitate: true, desc: 'Immune alle mosse Ground' },
  'hospitality': { desc: 'Cura il partner a inizio turno (nessun effetto sui rolls)' },
  'eelevate':    { desc: 'Levitate + Beast Boost (nessun effetto diretto sui rolls)' },
}