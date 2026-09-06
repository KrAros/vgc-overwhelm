// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/lib/potenzaMostrata.js
 *
 * La potenza da scrivere accanto alla mossa, nell'editor.
 *
 * ─── PERCHÉ NON BASTA `moves.json` ─────────────────────────────────────────
 *
 * Perché per otto mosse quel numero non è quello che il motore usa. Forza
 * Ancestrale dice `power: 20` e a +2 il motore ne usa 60; Acrobazia dice 55 e
 * senza strumento ne usa 110; Ritorno dice 0 e ne usa 102. Sono numeri diversi
 * per la stessa cosa, sulla stessa schermata.
 *
 * Nessuna di queste è una svista nuova: erano tutte false anche prima che i
 * punti salute arrivassero nell'interfaccia. Eruzione lo è diventata quel
 * giorno — era vera per caso, perché l'app assumeva la vita piena — ed è
 * cercando quella che si è visto che le altre sette erano rotte da sempre.
 *
 * ─── IL CONFINE, ED È QUELLO CHE CONTA ─────────────────────────────────────
 *
 * L'editor mostra UN Pokémon alla volta: qui c'è chi attacca e basta. Quindi
 * questa funzione risponde solo per le mosse la cui potenza dipende da chi
 * TIRA, e per tutte le altre restituisce il dato grezzo.
 *
 * Restano fuori, e la riga mostra «—»:
 *
 *   Presa Ferrea, Strizzata, Pressoduro   i punti salute del BERSAGLIO
 *   Erbafrusta, Calciobasso, Corposcontro il suo peso
 *   Vortexpalla, Elettropalla             tutt'e due le Velocità
 *   Punizione                             gli stadi del BERSAGLIO
 *   Sciagura, Velenoshock, Sale Risveglia lo stato del BERSAGLIO
 *
 * Non è una lacuna da riempire un domani: è la risposta giusta. Un numero
 * inventato su un avversario che non c'è sarebbe peggio del trattino, ed è
 * esattamente l'errore che questa funzione è venuta a togliere.
 *
 * ─── PERCHÉ L'ORDINE È QUELLO DEL MOTORE ───────────────────────────────────
 *
 * I rami qui sotto sono nell'ordine di `effectiveBP` in `calcEngine.js`. Oggi
 * nessuna mossa cade in due rami, quindi l'ordine non cambia nessun numero —
 * ma il giorno che una ci cadesse, questa funzione e il motore darebbero la
 * stessa risposta invece di due. È lo stesso motivo per cui `battleState.js`
 * costruisce l'input una volta sola.
 *
 * ─── COME SI SA CHE È GIUSTA ───────────────────────────────────────────────
 *
 * Non «sembra plausibile»: `calculateDamage` restituisce `effectiveBP`, cioè
 * la potenza che ha davvero usato. Il presidio confronta i due numeri mossa
 * per mossa (`potenzaMostrata.test.js`), quindi il criterio è l'uguaglianza
 * col motore, non un valore riscritto a mano nel test.
 */

import movesData from '../data/moves.json'
import { stadiEffettivi } from './statMostrata.js'
import { psMassimi, psCorrenti } from './psSlot.js'
import {
  tipoPallaClima,
  MOSSE_POTENZA_PS_ATTACCANTE, MOSSE_POTENZA_PS_FLAIL,
  potenzaDaPsAttaccante, potenzaFlail,
  MOSSE_STADI_ATTACCANTE, potenzaDaStadiAttaccante,
  MOSSE_POTENZA_ASSUNTA, haPotenzaAssunta,
  potenzaAcrobatics,
  STATI_CHE_ACCENDONO_FACADE,
} from './rules.js'

/**
 * @param {string|null} mossa
 * @param {object|null} slot — lo slot dello store di chi TIRA
 * @param {object} [contesto] — { meteo, terreno, avversarioConIntimidate }
 * @returns {number} la potenza da mostrare; 0 significa «dipende
 *          dall'avversario», e chi chiama scrive «—»
 */
export function potenzaMostrata(mossa, slot, contesto = {}) {
  const dati = movesData[mossa]
  if (!dati) return 0

  const { meteo = null } = contesto

  // ── punto c del riferimento: i punti salute di chi tira ──────────────────
  if (MOSSE_POTENZA_PS_ATTACCANTE.has(mossa) || MOSSE_POTENZA_PS_FLAIL.has(mossa)) {
    const psMax = psMassimi(slot)
    // Senza Pokémon scelto non si inventa: si mostra il dato grezzo.
    if (!psMax) return dati.power
    const ps = psCorrenti(slot, psMax)
    return MOSSE_POTENZA_PS_ATTACCANTE.has(mossa)
      ? potenzaDaPsAttaccante(ps, psMax)
      : potenzaFlail(ps, psMax)
  }

  // ── punto f: gli stadi di chi tira ───────────────────────────────────────
  //
  // Gli stadi sono quelli EFFETTIVI, non quelli messi a mano: il motore legge
  // `preparazione.attaccante.boosts`, che porta anche il +1 di Spadelnvitta e
  // quello di Rapidascesa. Presi dallo store crudi, la riga direbbe 20 su un
  // Zacian che il motore calcola a 40.
  if (MOSSE_STADI_ATTACCANTE.has(mossa)) {
    if (!slot?.key) return dati.power
    return potenzaDaStadiAttaccante(stadiEffettivi(slot, contesto))
  }

  // ── punto l: Acrobazia, che dipende dallo strumento ──────────────────────
  if (mossa === 'acrobatics') {
    if (!slot?.key) return dati.power
    return potenzaAcrobatics(slot?.item)
  }

  // ── le tre a potenza assunta ─────────────────────────────────────────────
  //
  // Ritorno, Frustrazione e Ultimatum. Il numero non dipende da niente che
  // l'app modelli — è un'assunzione dichiarata del riferimento (affetto al
  // massimo, affetto a zero, una carta sola) — e proprio per questo la riga
  // mostrava «—», cioè «dipende», che è l'unica cosa che NON è vera.
  if (haPotenzaAssunta(mossa)) return MOSSE_POTENZA_ASSUNTA[mossa]

  // ── Ultimo Sigillo: 50 per ogni alleato caduto, dichiarato nello slot ────
  if (mossa === 'last respects') {
    const ko = Math.min(3, Math.max(0, slot?.lastRespectsKOs || 0))
    return 50 + ko * 50
  }

  // ── Palla Clima: 100 quando il meteo le cambia il tipo ───────────────────
  if (mossa === 'weather ball') {
    return tipoPallaClima(mossa, meteo) !== null ? 100 : dati.power
  }

  // ── Facciatosta: raddoppia sullo stato di CHI TIRA ───────────────────────
  //
  // È l'unica della famiglia «lo stato raddoppia» che guarda l'attaccante:
  // Sciagura, Velenoshock, Sale Risveglia e Schiaffosveglia guardano chi
  // subisce, e restano fuori con tutte le altre.
  if (mossa === 'facade' && STATI_CHE_ACCENDONO_FACADE.has(slot?.status)) {
    return dati.power * 2
  }

  return dati.power
}
