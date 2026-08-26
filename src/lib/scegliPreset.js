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
 * funzione pura si prova senza montare niente: `setOmonimi.test.js` la
 * chiama e basta, invece di ricostruire negozio, filtro di stagione e
 * `renderToString`.
 */

/**
 * ─── QUALE SET RISULTA SCELTO, QUANDO PIU' D'UNO COMBACIA ──────────────────
 *
 * Il confronto storico guarda strumento, abilita e natura: e' volutamente
 * largo, cosi' una squadra costruita a mano si riconosce lo stesso anche con
 * SP diversi da quelli del set meta.
 *
 * Con una stagione sola nessun set poteva combaciare due volte. Con due,
 * si': lo stesso Incineroar «Sitrus Support» esiste in M-4 e in M-5 con lo
 * stesso strumento, la stessa abilita e la stessa natura, e cambia solo negli
 * SP (24/8 contro 21/11). Guardando «tutte le stagioni», `find` restituiva il
 * primo — quindi applicando il set di M-5 la tendina mostrava «M-4», cioe'
 * un'etichetta che mente su cosa c'e' nello slot.
 *
 * `metaPresets.test.js` aveva previsto la collisione e messo la stagione nella
 * chiave dell'`<option>`. Quello risolveva l'irraggiungibilita' — i due set si
 * possono entrambi scegliere — ma non questo: la CHIAVE era diventata unica,
 * la RICERCA no.
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
