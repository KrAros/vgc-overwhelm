// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/lib/scegliPreset.js
 *
 * Quale set risulta scelto, dato cio' che c'e' nello slot.
 *
 * Sta fuori da `PresetSelect.jsx` per due ragioni. La prima e' che quel file
 * esporta un componente, e mescolarci funzioni rompe il ricaricamento a caldo
 * di Vite — lo dice il lint, non una preferenza. La seconda e' che una
 * funzione pura si prova senza montare niente: `setIndistinguibili.test.js` la
 * chiama e basta, invece di ricostruire negozio, filtro e
 * `renderToString`.
 */

/**
 * ─── QUALE SET RISULTA SCELTO, QUANDO PIU' D'UNO COMBACIA ──────────────────
 *
 * Il confronto storico guarda strumento, abilita e natura: e' volutamente
 * largo, cosi' una squadra costruita a mano si riconosce lo stesso anche con
 * SP diversi da quelli del set meta.
 *
 * Il prezzo e' che due set possono combaciare entrambi, e allora `find`
 * restituiva il primo: la tendina mostrava un'etichetta che mente su cosa c'e'
 * nello slot.
 *
 * Il caso vero e Archaludon, e c'era da mesi: «Rain / Screen» e «Rain Special
 * Attacker» hanno lo stesso strumento, la stessa abilita', la stessa natura e
 * perfino le stesse quattro mosse — cambiano solo negli SP. Scegliendo il
 * secondo si e' sempre visto il primo.
 *
 * `metaPresets.test.js` aveva previsto una collisione del genere, ma
 * attribuendola al futuro e a un'altra causa: piu' periodi di osservazione. La
 * risposta di allora fu rendere unica la CHIAVE dell'`<option>`, che risolve
 * l'irraggiungibilita' — i due set si possono entrambi scegliere — ma non la
 * RICERCA, che e' dove il difetto stava davvero.
 *
 * Quindi: prima si cercano i candidati con la regola larga di sempre, e se ne
 * sono piu' d'uno si preferisce quello che combacia anche negli SP e nelle
 * mosse. Nessuna corrispondenza esatta -> si torna al primo, cioe' al
 * comportamento di prima.
 */
const stessiSP = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
  a.every((v, i) => (v || 0) === (b[i] || 0))

const stesseMosse = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  const pulisci = (m) => (m ? String(m).toLowerCase().replace(/-/g, ' ') : null)
  // L'ordine degli slot non conta: chi sposta Protect in fondo ha lo stesso
  // set, e deve continuare a vederlo riconosciuto.
  const x = a.map(pulisci).filter(Boolean).sort()
  const y = b.map(pulisci).filter(Boolean).sort()
  return x.length === y.length && x.every((m, i) => m === y[i])
}

export function scegliCorrispondente(presets, slot) {
  const candidati = presets.filter(p =>
    p.item === slot.item &&
    p.ability === slot.ability &&
    p.nature?.toLowerCase() === slot.nature?.toLowerCase()
  )
  if (candidati.length <= 1) return candidati[0]
  return candidati.find(p => stessiSP(p.sps, slot.sps) && stesseMosse(p.moves, slot.moves))
      ?? candidati[0]
}
