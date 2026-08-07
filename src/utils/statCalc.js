// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/utils/statCalc.js
 *
 * ─── FILE DI COMPATIBILITÀ ─────────────────────────────────────────────────
 * La formula vera vive in `src/lib/stats.js` dalla sessione C. Questo file
 * resta solo per non riscrivere i suoi quattro chiamanti (`speedOrder.js`,
 * `editor/StatRow.jsx`, `editor/SlotEditor.jsx`, `ReportPanel.jsx`) dentro una
 * sessione il cui vincolo è "i numeri non si muovono".
 *
 * `calcFinalStat` è `calcStat` sotto un altro nome. La firma è identica —
 * (base, sp, level, nature, statIdx) — quindi i chiamanti esistenti
 * continuano a funzionare senza modifiche. La differenza è che ora possono
 * anche passare `weather` e `pokeTypes` come sesto e settimo argomento e
 * ottenere i bonus meteo, cosa che prima solo il motore sapeva fare.
 *
 * Quando i chiamanti saranno migrati a `lib/stats`, questo file sparisce.
 */

export { calcStat as calcFinalStat, calcStat, getBaseStat, getNatureModifier } from '../lib/stats.js'
export { STAT_NAMES } from '../lib/rules.js'