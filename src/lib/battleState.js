// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/lib/battleState.js
 *
 * "Chi attacca, chi difende, com'è il campo" — definito una volta sola.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 * Prima della sessione C questi tre oggetti venivano costruiti a mano in
 * quattro punti diversi:
 *
 *   DamageTable.jsx     → `field`
 *   DamageTable.jsx     → `fieldReversed`
 *   ReportPanel.jsx     → dentro il useMemo di SinglePanel, e di nuovo fuori
 *   ReportPanel.jsx     → dentro buildMoves di CumulativePanel
 *
 * Erano copie, e le copie divergono. Avevano già divergenze reali:
 *
 *   1. Il ReportPanel non passava `lastRespectsKOs`. La cella della tabella
 *      mostrava Last Respects a potenza 200, ci cliccavi sopra, e il pannello
 *      di dettaglio ti rispondeva con potenza 50 — fattore 4 di differenza,
 *      sullo stesso identico Pokémon. È il bug §1.5 dell'analisi.
 *   2. Il ReportPanel non passava `trickRoom`, `tailwind` né `atkTeamSide`.
 *      Oggi il motore non li legge (servono solo all'indicatore ⚡ nella
 *      tabella), quindi nessun numero era sbagliato — ma bastava che il
 *      motore iniziasse a leggerne uno perché lo diventasse.
 *
 * ─── LA PARTE CHE SBAGLIAVA DAVVERO: IL LATO ──────────────────────────────
 * Il pezzo delicato non è copiare i campi, è la corrispondenza fra lato e
 * modificatore, che non è simmetrica:
 *
 *   - Helping Hand e il critico sono dell'ATTACCANTE → si leggono dal suo lato
 *   - Reflect, Light Screen e Aurora Veil sono del DIFENSORE → dal lato opposto
 *
 * Scritta a mano quattro volte, questa inversione è un errore che aspetta di
 * succedere. Qui è scritta una volta, in `buildField`.
 *
 * ─── QUESTO FILE RESTA PURO ────────────────────────────────────────────────
 * Niente React, niente hook, niente accesso diretto allo store: solo funzioni
 * che prendono dati e restituiscono dati. È ciò che le rende testabili senza
 * montare un componente. La lettura dallo store sta in `hooks/useFieldState.js`.
 */

import { LEVEL } from './rules.js'

/** Spread neutro, usato quando lo slot non ne ha uno. */
const SPS_VUOTI = [0, 0, 0, 0, 0, 0]

/**
 * Costruisce l'oggetto `attacker` che si passa a `calculateDamage`.
 *
 * ─── SU `lastRespectsKOs` ──────────────────────────────────────────────────
 * È il campo che il ReportPanel dimenticava. Sta qui e non fra i parametri
 * opzionali proprio per questo: se fa parte della costruzione, nessun
 * chiamante può ometterlo per distrazione.
 *
 * @param {object|null} slot — lo slot dello store (team1[i] o team2[i])
 * @param {number} [level=LEVEL]
 * @returns {object} input attaccante per il motore
 */
export function buildAttackerInput(slot, level = LEVEL) {
  const s = slot || {}
  return {
    atkPokemon:      s.key ?? null,
    atkSPs:          s.sps || SPS_VUOTI,
    atkNature:       s.nature ?? null,
    atkBoost:        s.atkBoost || 0,
    spAtkBoost:      s.spAtkBoost || 0,
    // Body Press attacca con la PROPRIA Difesa, quindi il boost che conta è
    // quello di Difesa dell'attaccante — non quello di Attacco. Senza questo
    // campo il motore non aveva proprio modo di saperlo: `atkBoost` era
    // l'unica cosa che gli arrivasse, e con Difesa −1 il danno andava su
    // invece che giù. Vedi il caso golden `B8-bodypress-def-1-004`.
    atkDefBoost:     s.defBoost || 0,
    atkItem:         s.item || null,
    atkAbility:      s.ability || null,
    atkAbilityFlags: s.abilityFlags || {},
    lastRespectsKOs: s.lastRespectsKOs || 0,
    level,
  }
}

/**
 * Costruisce l'oggetto `defender` che si passa a `calculateDamage`.
 *
 * Non prende il livello: il motore usa quello dell'attaccante per la formula
 * del danno, e la statistica del difensore viene calcolata a livello fisso.
 * È una semplificazione che regge finché Champions resta a livello 50 — cioè
 * sempre, nel formato che questo strumento copre.
 *
 * @param {object|null} slot
 * @returns {object} input difensore per il motore
 */
export function buildDefenderInput(slot) {
  const s = slot || {}
  return {
    defPokemon:      s.key ?? null,
    defSPs:          s.sps || SPS_VUOTI,
    defNature:       s.nature ?? null,
    defBoost:        s.defBoost || 0,
    spDefBoost:      s.spDefBoost || 0,
    defItem:         s.item || null,
    defAbility:      s.ability || null,
    defAbilityFlags: s.abilityFlags || {},
  }
}

/**
 * Costruisce l'oggetto `field` dal punto di vista di chi attacca.
 *
 * ─── COME SI LEGGE ─────────────────────────────────────────────────────────
 * `atkSide` dice quale squadra sta attaccando. Da lì:
 *
 *   mio = il lato dell'attaccante  → Helping Hand, critico
 *   suo = il lato del difensore    → Reflect, Light Screen, Aurora Veil
 *
 * Quindi `buildField(campo, 't1')` e `buildField(campo, 't2')` producono i due
 * oggetti che la tabella chiamava `field` e `fieldReversed`.
 *
 * ─── SUI VALORI MANCANTI ───────────────────────────────────────────────────
 * Un campo assente diventa `false`/`null`, mai un default inventato. In
 * particolare `doubleTarget` NON diventa `true` se manca: il motore tratta una
 * chiave assente come falsa, e questa funzione non deve dargli una semantica
 * diversa da quella che ha sempre avuto. Chi chiama passa lo stato reale.
 *
 * @param {object} campo — valori di campo dallo store (vedi useFieldState)
 * @param {'t1'|'t2'} [atkSide='t1'] — quale squadra attacca
 * @returns {object} field per il motore
 */
export function buildField(campo = {}, atkSide = 't1') {
  const mio = atkSide === 't2' ? 't2' : 't1'
  const suo = mio === 't1' ? 't2' : 't1'

  return {
    weather:      campo.weather ?? null,
    terrain:      campo.terrain ?? null,
    doubleTarget: !!campo.doubleTarget,

    // Modificatori dell'attaccante: si leggono dal suo lato.
    helpingHand: !!campo.helpingHand?.[mio],
    crit:        !!campo.crit?.[mio],

    // Modificatori del difensore: si leggono dal lato opposto.
    auroraVeil:  !!campo.auroraVeil?.[suo],
    lightScreen: !!campo.lightScreen?.[suo],
    reflect:     !!campo.reflect?.[suo],

    // Letti solo dall'indicatore di velocità, non dal motore di danno. Stanno
    // qui perché il campo di battaglia è uno: se domani il motore ne avesse
    // bisogno, li troverebbe già al posto giusto invece di trovarne metà.
    trickRoom:   !!campo.trickRoom,
    tailwindT1:  !!campo.tailwind?.t1,
    tailwindT2:  !!campo.tailwind?.t2,
    atkTeamSide: mio,
  }
}

/**
 * Scorciatoia: i tre oggetti in una chiamata sola.
 *
 * @param {object|null} atkSlot
 * @param {object|null} defSlot
 * @param {object} campo
 * @param {'t1'|'t2'} atkSide
 * @param {number} [level=LEVEL]
 * @returns {{attacker: object, defender: object, field: object}}
 */
export function buildMatchup(atkSlot, defSlot, campo, atkSide, level = LEVEL) {
  return {
    attacker: buildAttackerInput(atkSlot, level),
    defender: buildDefenderInput(defSlot),
    field:    buildField(campo, atkSide),
  }
}