// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/lib/regSpecie.js
 *
 * Quali specie si possono usare in una reg.
 *
 * ─── PERCHE' UN MODULO A PARTE ─────────────────────────────────────────────
 *
 * Perché oggi lo importano solo i test. La stagione scelta filtra i SET, non
 * le specie, quindi i 582 slug delle due reg — 1490 byte gzip — non servono a
 * chi apre l'app, e Vite non li mette nel bundle finché nessun componente
 * arriva qui.
 *
 * Non è prematuro: era già successo. Con gli elenchi dentro `reg.js`, che il
 * selettore importa, il margine sotto la soglia dei 210 kB era sceso da 4,56
 * a 0,85 kB — pagati per un dato che nessuna riga leggeva.
 *
 * Il giorno in cui l'interfaccia filtrerà o segnalerà anche le specie, questo
 * file viene importato da un componente e il peso rientra nel conto. È il
 * modo giusto: pagarlo quando lo si usa, non prima.
 */

import registro from '../data/regChampionsSpecie.json'
import { regDiStagione } from './reg.js'

/** Le condizioni della trascrizione, e le divergenze con la sonda del roster. */
export const CONDIZIONI = registro.condizioni
export const DIVERGENZE = registro.divergenze_con_la_sonda

/** Le specie utilizzabili in una reg. */
export function specieDiReg(idReg) {
  return registro.specie[idReg] ?? []
}

/** Le specie utilizzabili in una stagione, passando dalla sua reg. */
export function specieDiStagione(idStagione) {
  const reg = regDiStagione(idStagione)
  return reg ? specieDiReg(reg) : []
}
