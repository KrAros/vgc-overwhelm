// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { TYPES } from './typeChart.js'

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

/**
 * ─── SOLO MECCANICA, NIENTE TESTO ───────────────────────────────────────────
 *
 * Su cosa il motore ramifica: `atkMult`, `flashFireImmune`, `furCoat`,
 * `multiscale`, `filter`, `paradosso`, `intimidate`, `showInSmogon`… La logica
 * sta in `calcEngine.js` e `lib/preparazione.js`, che leggono questi flag
 * insieme ad `abilityFlags`.
 *
 * ─── PERCHÉ NON CI SONO PIÙ LE DESCRIZIONI ─────────────────────────────────
 *
 * Fino alla sessione T ogni voce portava anche `desc`, `descOn` e `descOff`:
 * 198 voci, di cui **153 senza un solo campo meccanico**. Una tabella di
 * meccaniche in cui l'ottantacinque per cento delle righe non conteneva
 * meccanica, e il cui testo era duplicato nei file di traduzione.
 *
 * Non era una ridondanza innocua. `AbilityFlags.jsx` leggeva la traduzione con
 * `defaultValue: ABILITY_EFFECTS[key]?.desc`, e una chiave PRESENTE nel locale
 * vince sul valore di ripiego: in R si è scoperto che 52 descrizioni inglesi
 * erano troncate al primo apostrofo, e la copia rotta faceva ombra
 * all'originale sano che stava proprio qui. Il difetto si è potuto correggere
 * solo perché la seconda copia era intera — la volta dopo poteva andare al
 * contrario.
 *
 * Ora il testo vive in un posto solo: `locales/*.json`. Qui restano 45 voci, e
 * tutte hanno una ragione meccanica per esserci.
 *
 * Prima di togliere le descrizioni è stato verificato che i due insiemi
 * coincidessero: quattro abilità esistevano SOLO qui — `ice-scales`,
 * `prism-armor`, `protosynthesis`, `quark-drive` — e per quelle un utente
 * italiano leggeva inglese, in silenzio. Sono state portate nei locali con la
 * loro traduzione prima di procedere.
 */
export const ABILITY_EFFECTS = {
  // ── Attaccante: moltiplicatori stat ──────────────────────────────────────
  'huge-power':  { atkMult: 2.0, statType: 'physical', showInSmogon: true },
  'pure-power':  { atkMult: 2.0, statType: 'physical', showInSmogon: true },

  // ── Attaccante: STAB potenziato ──────────────────────────────────────────
  'adaptability': { adaptability: true, showInSmogon: true },

  // ── Attaccante: boost tipo mossa ─────────────────────────────────────────
  'fire-mane':   { fireMane: true, showInSmogon: true },

  // ── Attaccante: boost mosse contatto ─────────────────────────────────────
  'tough-claws': { toughClaws: true, showInSmogon: true },

  // ── Attaccante: boost per famiglia di mossa ──────────────────────────────
  //
  // Megalancio: x1.5 sulle mosse-impulso. Nel riferimento e' una delle sei
  // abilita' raccolte in un solo ramo — `damage_MASTER.js:1668`, «1.5x
  // Abilities» — insieme a Technician, Flare Boost, Toxic Boost, Strong Jaw e
  // Steely Spirit. Delle sei questa e' la prima che implementiamo, e non per
  // completezza: e' la prima che tocca un set del meta, il Mega Blastoise con
  // Dark Pulse.
  //
  // Quali mosse siano «impulso» NON e' scritto qui: e' il flag `pulse` di
  // moves.json, che `gen-flag-dati.mjs` trascrive da `isPulse` del vendor.
  // Una lista a mano in questo file sarebbe la tabella che marcisce.
  'mega-launcher': { megaLauncher: true, showInSmogon: true },

  // Ferromascella: x1.5 sulle mosse di morso. Nel riferimento e' nello STESSO
  // `if` di Megalancio — `damage_MASTER.js:1668`, le sei «1.5x Abilities» — e
  // spinge lo stesso `0x1800` nella stessa catena. Cambia solo la condizione.
  //
  // Le nove mosse di morso NON sono scritte qui: e' il flag `bite` di
  // moves.json, che `gen-flag-dati.mjs` trascrive da `isBite` del vendor.
  'strong-jaw':  { strongJaw: true, showInSmogon: true },

  // Ingegno Acciaio: x1.5 sulle mosse Acciaio. Terza delle sei dello stesso
  // ramo, e ultima raggiungibile per ora — delle altre due, Flare Boost vuole
  // lo stato «bruciato» e Toxic Boost «avvelenato», che non modelliamo.
  //
  // Nel riferimento compare DUE volte con lo stesso 0x1800: al punto g quando
  // ce l'ha chi attacca, e al punto d.iii come `field.isSteelySpirit` quando
  // ce l'ha un ALLEATO. Qui c'e' solo la prima: la seconda e' una casella di
  // campo che non abbiamo, come Battery e Power Spot — e infatti tutt'e tre
  // restano nelle 108 per quella meta'.
  'steely-spirit': { steelySpirit: true, showInSmogon: true },

  // ── Le due aure: x1.33 sulle mosse del proprio tipo, da qualunque lato ───
  //
  // `aura` porta il TIPO, non un booleano, perche' il ramo del motore e' uno
  // solo per tutt'e due: cambia il tipo che deve combaciare con quello della
  // mossa. Il riferimento fa lo stesso — `damage_MASTER.js:1654` non nomina
  // ne' l'una ne' l'altra, guarda `move.type`.
  //
  // Perche' il registro del divario non le vedeva: in NCP il nome dell'abilita'
  // e' COSTRUITO a runtime (`attacker.ability === (move.type + " Aura")`,
  // riga 1568), quindi le stringhe "Fairy Aura" e "Dark Aura" non compaiono
  // mai nel codice che il generatore legge. Esistono solo dentro un commento,
  // e `gen-gap-noti.mjs` i commenti li scarta di proposito — con ragione, e la
  // ragione e' scritta a riga 61 di quel file. Due difese corrette, e queste
  // due abilita' cadevano nel varco fra loro. L'ha trovate
  // `descrizioniSilenziose.test.js`, guardando da un terzo lato: non cosa fa
  // il riferimento, ma cosa l'app dice di se'.
  //
  // Nota sul lato: l'aura vale per CHIUNQUE sia in campo, non solo per chi
  // attacca. Il motore guarda percio' l'abilita' di tutti e due.
  'fairy-aura': { aura: TYPES.FAIRY, showInSmogon: true },
  'dark-aura':  { aura: TYPES.DARK,  showInSmogon: true },

  // ── Attaccante: boost condizionale (stato) ───────────────────────────────
  'flash-fire':  { flashFireImmune: true, showInSmogon: true
    
    
    },

  'supreme-overlord': { supremeOverlord: true, showInSmogon: true
    },

  'multiscale':     { multiscale: true
    
    
    },

  'shadow-shield':  { multiscale: true
    
    
    },

  'intimidate':  { intimidate: true
    
    
    },

  'defiant':     { defiant: true
    
    
    },

  'contrary':    { contrary: true, intimidateInverte: true
    
    
    },

  'competitive': { competitive: true
    
    
    },

  // ── Meteo: Modifica le statistiche ─────────────────────────
  'sand-rush':     { sandRush: true
    
    
    },

  'chlorophyll':   { speedWeather: true
    
    
    },

  'swift-swim':    { speedWeather: true
    
    
    },

  'slush-rush':    { speedWeather: true
    
    
    },

  // ── Immunita' alle mosse Terra ───────────────────────────────────────────
  //
  // `levitate` e' un flag e non piu' un confronto per nome, perche' adesso ce
  // l'hanno in due. `eelevate` e' RAPIDASCESA, che esiste solo in Champions —
  // Eelektross Mega, due set del meta — e la cui prima meta' e' la stessa cosa
  // di Levitate: «Immunizza alle mosse Terra».
  //
  // ─── L'ORACOLO C'E', ED E' STATA UNA SORPRESA ────────────────────────────
  // La sessione era partita dall'idea che NCP non conoscesse Rapidascesa,
  // essendo un'abilita' di Champions, e che quindi non fosse verificabile.
  // E' falso, e il riferimento lo dice in due punti:
  //
  //     damage_MASTER.js:1112  immunityChecks — ['Levitate','Eelevate']
  //     damage_MASTER.js:1298  pIsGrounded    — ['Levitate','Eelevate']
  //
  // Quindi si verifica roll per roll come le aure, e lo fa
  // `rapidascesa.test.js`.
  //
  // ─── ALLORA PERCHE' NON ERA NELLE 108 ────────────────────────────────────
  // Per un terzo motivo, diverso da quello delle aure: l'universo del registro
  // e' `abilities.json`, e `abilities.json` non aveva questa riga. Il
  // generatore non l'ha «persa»: non gliel'ha mai vista passare davanti.
  //
  // Misurato: con la riga nel listino e senza questa voce, `npm run gap:report`
  // la trova e le 108 diventano 109, canale STR, prova
  // `damage_MASTER.js:1298`. Con questa voce restano 108 perche' adesso la
  // calcoliamo.
  //
  // ─── LA SECONDA META' NON C'E' ───────────────────────────────────────────
  // «Aumenta la statistica piu' alta di 1 grado quando mette KO un avversario»
  // e' uno stato che l'utente imposta a mano, come Aegislash, Morpeko e
  // Palafin — non un ramo del motore, e non si inventa un pezzo d'interfaccia
  // che nessuno ha deciso. NCP la chiama «Levitate + Beast Boost»
  // (`ability_data.js:345`) e nemmeno lui calcola quella meta': `beast boost`
  // e' selezionabile da noi, senza effetto, e NON e' fra le 108 — cioe' il
  // registro ha misurato che nemmeno il riferimento la calcola nel danno.
  //
  // Non sparisce pero': sta nel registro delle PARZIALI in
  // `descrizioniSilenziose.test.js`, perche' il presidio da solo non
  // l'avrebbe vista — gli basta che l'abilita' abbia UN effetto per non
  // considerarla muta.
  'levitate':    { levitate: true },
  'eelevate':    { levitate: true },
  // ── Lo strato di preparazione (sessione J) ────────────────────────────────
  //
  // Queste abilità non stanno in nessuna delle quattro catene di
  // moltiplicatori: agiscono PRIMA, in `lib/preparazione.js`, spostando gli
  // stadi di boost o accendendo un flag. Il danno cambia di conseguenza.
  //
  // ─── I QUATTRO FLAG DI INTIMIDATE ─────────────────────────────────────────
  // Sono i quattro rami di `checkIntimidate` (damage_MASTER.js:559), nello
  // stesso ordine in cui il vendore li valuta:
  //
  //   intimidateInverte   il calo diventa +1        Contrary · Guard Dog
  //   intimidateAnnulla   nessun calo               Clear Body e compagnia
  //   intimidateRimbalza  il calo torna al mittente Mirror Armor
  //   simple              il calo raddoppia         Simple
  //
  // L'ordine conta e non è quello che verrebbe in mente: Contrary e Guard Dog
  // vengono valutate per PRIME, quindi hanno la meglio sul Clear Amulet ma non
  // su Mirror Armor. Nel vendore c'è un commento che dice «for some reason»:
  // è una stranezza del gioco, non una regola con una logica dietro.

  'guard-dog':        { intimidateInverte: true
    },
  'full-metal-body':  { intimidateAnnulla: true
    },
  'simple':           { simple: true
    },

  // Intrepid Sword e Dauntless Shield: +1 alla statistica indicata entrando in
  // campo. `boostIngresso` contiene la chiave della statistica, non un
  // booleano, così l'implementazione è una riga sola per entrambe.
  //
  // In Champions si applicano SEMPRE. La condizione del vendore è
  // `gen !== 9 || abilityOn`, e `gen` vale 10: la prima metà è già vera, il
  // flag dell'interfaccia non viene mai letto. Legare il comportamento a un
  // interruttore che il riferimento ignora produrrebbe due numeri diversi
  // dallo stesso stato di gioco.
  'intrepid-sword':   { boostIngresso: 'at'
    },
  'dauntless-shield': { boostIngresso: 'df'
    },

  // Download: +1 Attacco o +1 Att. Speciale a seconda di quale difesa
  // avversaria è più bassa. Confronta le difese GIÀ modificate dai boost —
  // quindi anche da quelli che Intimidate e Dauntless Shield hanno appena
  // messo, perché nel vendore Download viene dopo.
  'download':         { download: true
    },

  // Protosynthesis e Quark Drive: ×1.3 alla statistica più alta (×1.5 se è la
  // Velocità, che nel danno non si vede). Il valore del campo dice cosa le
  // accende: il sole per la prima, il campo elettrico per la seconda. La
  // Booster Energy le accende entrambe.
  //
  // ─── IL SOLE ESTREMO NON LE ACCENDE ───────────────────────────────────────
  // Nel vendore la condizione è `weather === 'Sun'`, un confronto esatto, non
  // l'`indexOf("Sun")` che altrove fa passare anche il Sole Estremo di
  // Desolate Land. Trascritto com'è: se un giorno si scoprirà che il gioco
  // fa diversamente, il posto dove cambiarlo è uno solo.
  'protosynthesis':   { paradosso: 'sun'
    
    
    },
  'quark-drive':      { paradosso: 'electric'
    
    
    },

  // ─── PERCHÉ RATTLED NON È QUI ─────────────────────────────────────────────
  // `checkIntimidate` le dà +1 Velocità, e la preparazione lo calcola davvero
  // (vedi `lib/preparazione.js`). Ma la Velocità non passa da qui: il ⚡ della
  // matrice la ricava da `utils/speedOrder.js`, che non chiama la
  // preparazione. Finché è così, Rattled non sposta nessun numero che l'app
  // mostri — quindi resta senza voce, e il badge «non calcolata» le resta
  // addosso. Dargliela adesso toglierebbe il badge a fronte di niente, che è
  // esattamente la bugia che la sessione F-2 è servita a eliminare.

  // ── Descrizioni informative (nessun effetto sul calcolo) ──────────────────
  'clear-body': { intimidateAnnulla: true },
  'filter': { filter: true, showInSmogon: true },
  'fluffy': { fluffy: true, showInSmogon: true },
  'ice-scales': { iceScales: true, showInSmogon: true },
  'prism-armor': { filter: true, showInSmogon: true },
  'fur-coat': { furCoat: true, showInSmogon: true },
  'heatproof': { heatproof: true, showInSmogon: true },
  'hyper-cutter': { intimidateAnnulla: true },
  // Sessione G: attivata la parte che tocca il danno — ignora gli schermi.
  // Safeguard e substitute non sono modellati dal motore, quindi restano
  // soltanto descritti. Niente `showInSmogon`, per lo stesso motivo per cui
  // non ce l'ha `levitate`: cambia il numero solo in presenza di uno schermo.
  'infiltrator': { infiltrator: true },
  'inner-focus': { intimidateAnnulla: true },
  'mirror-armor': { intimidateRimbalza: true },
  'oblivious': { intimidateAnnulla: true },
  'own-tempo': { intimidateAnnulla: true },
  'purifying-salt': { purifyingSalt: true, showInSmogon: true },
  'scrappy': { intimidateAnnulla: true },
  'solid-rock': { filter: true, showInSmogon: true },
  'thick-fat': { thickFat: true, showInSmogon: true },
  'water-bubble': { waterBubble: true, showInSmogon: true },
  'white-smoke': { intimidateAnnulla: true },
}