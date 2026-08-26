// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/components/RegSelect.jsx
 *
 * La reg da cui pescare i set proposti.
 *
 * ─── PERCHE' STA NELL'INTESTAZIONE E NON NELLA STRISCIA DELLE OPZIONI ──────
 *
 * Perché non è una condizione di battaglia. Distortozona, meteo, terreno e
 * nemici in campo cambiano il numero, e stanno insieme per quello. La reg
 * cambia soltanto **cosa ti viene proposto mentre scrivi la squadra**: è una
 * preferenza, e la sua compagnia naturale è la lingua.
 *
 * C'è anche una ragione misurata: `TopBar.jsx` avverte che la sua striscia è
 * al limite del contenuto e che sotto `xl` va già a capo. Aggiungerci un
 * selettore avrebbe spinto quella misura senza che nessuno se ne accorgesse
 * fino al prossimo controllo del layout.
 *
 * ─── QUI C'ERANO LE STAGIONI ───────────────────────────────────────────────
 *
 * La tendina elencava M-1…M-5 raggruppate per reg. Sembrava più informativa, e
 * nascondeva set: scegliendo M-5 se ne vedevano 2 su 22, perché gli altri
 * erano etichettati M-4 pur essendo perfettamente giocabili. Le specie
 * cambiano solo fra reg, quindi è la reg a decidere cosa si può usare.
 *
 * Le stagioni non sono sparite dai dati: `reg.js` le usa ancora per sapere
 * quale reg è in corso oggi. Semplicemente non si scelgono più.
 *
 * `<select>` nativo, come `PresetSelect`: su mobile apre il selettore di
 * sistema, che è più accessibile di qualunque tendina disegnata a mano.
 */

import { useTranslation } from 'react-i18next'
import { REG, regCorrente } from '../lib/reg.js'
import useReg, { TUTTE, REG_CON_SET } from '../store/useReg.js'

export default function RegSelect() {
  const { t } = useTranslation()
  const reg = useReg(s => s.reg)
  const setReg = useReg(s => s.setReg)
  const corrente = regCorrente()

  return (
    <select
      value={reg}
      onChange={(e) => setReg(e.target.value)}
      aria-label={t('ui.reg_filter')}
      title={t('ui.reg_filter')}
      /* ─── LA LARGHEZZA E' VINCOLATA SOTTO I 480 px ────────────────────────
         Un <select> nativo si dimensiona sull'opzione PIU' LUNGA, non su
         quella scelta: con le stagioni «M-5 · in corso (nessun set)» lo
         portava a 175 px. Su un'intestazione da 360 px erano quasi la meta'
         della riga, e il blocco di sinistra ha `min-w-0` mentre questo ha
         `shrink-0`: il marchio si schiacciava da 133 px a 61, cioe' «The
         Sixt».

         Le voci di oggi sono piu' corte, ma il vincolo resta: la voce piu'
         lunga e' ancora «M-B · in corso», e una futura M-C con la sua nota
         riporterebbe il problema. Misurato a 320, 360 e 412 px: il marchio
         intero chiede 117 px, con 72 li ottiene a tutte e tre.

         Il testo che avanza si vede aprendo la tendina, che sul telefono e'
         il selettore di sistema a tutto schermo — quindi non si perde niente,
         si sposta soltanto dove c'e' spazio. */
      className="w-18 min-[480px]:w-auto text-[11px] font-bold px-2 py-1 rounded border border-gray-700 hover:border-gray-500 bg-gray-900 text-gray-300 hover:text-white transition-colors cursor-pointer"
    >
      <option value={TUTTE}>{t('ui.reg_all')}</option>
      {/* ─── DALLA PIU' RECENTE ALLA PIU' VECCHIA ───────────────────────────
          Il registro elenca in ordine cronologico, M-A prima di M-B, perche'
          e' l'ordine in cui le cose sono successe. Qui serve l'opposto: chi
          apre la tendina cerca quasi sempre la reg in corso, che e' l'ultima
          ed e' anche quella scelta di default.

          `[...REG]` perche' `reverse()` muta l'array, e REG e' il modulo. */}
      {[...REG].reverse().map(r => (
        <option key={r.id} value={r.id}>
          {/* La reg in corso si marca. Senza, l'utente non ha modo di sapere
              quale sia: gli identificatori non lo dicono, e la data di oggi
              non è scritta da nessuna parte nell'interfaccia. */}
          {r.id === corrente ? t('ui.reg_current', { id: r.id }) : r.id}
          {REG_CON_SET.has(r.id) ? '' : ` ${t('ui.reg_no_sets')}`}
        </option>
      ))}
    </select>
  )
}
