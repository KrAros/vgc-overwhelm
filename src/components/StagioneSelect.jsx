// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/components/StagioneSelect.jsx
 *
 * La stagione da cui pescare i set proposti.
 *
 * ─── PERCHE' STA NELL'INTESTAZIONE E NON NELLA STRISCIA DELLE OPZIONI ──────
 *
 * Perché non è una condizione di battaglia. Distortozona, meteo, terreno e
 * nemici in campo cambiano il numero, e stanno insieme per quello. La
 * stagione cambia soltanto **cosa ti viene proposto mentre scrivi la
 * squadra**: è una preferenza, e la sua compagnia naturale è la lingua.
 *
 * C'è anche una ragione misurata: `TopBar.jsx` avverte che la sua striscia è
 * al limite del contenuto e che sotto `xl` va già a capo. Aggiungerci un
 * selettore avrebbe spinto quella misura senza che nessuno se ne accorgesse
 * fino al prossimo controllo del layout.
 *
 * ─── LE STAGIONI SI VEDONO, LE REG FANNO DA INTESTAZIONE ───────────────────
 *
 * Si sceglie una stagione, non una reg, perché è la stagione a etichettare un
 * set. La reg compare come `<optgroup>`: dice a quale insieme di regole
 * appartiene quella stagione senza aggiungere un secondo controllo.
 *
 * `<select>` nativo, come `PresetSelect`: su mobile apre il selettore di
 * sistema, che è più accessibile di qualunque tendina disegnata a mano.
 */

import { useTranslation } from 'react-i18next'
import { REG, stagioneCorrente } from '../lib/reg.js'
import useStagione, { TUTTE, STAGIONI_CON_SET } from '../store/useStagione.js'

export default function StagioneSelect() {
  const { t } = useTranslation()
  const stagione = useStagione(s => s.stagione)
  const setStagione = useStagione(s => s.setStagione)
  const corrente = stagioneCorrente()

  return (
    <select
      value={stagione}
      onChange={(e) => setStagione(e.target.value)}
      aria-label={t('ui.season_filter')}
      title={t('ui.season_filter')}
      className="text-[11px] font-bold px-2 py-1 rounded border border-gray-700 hover:border-gray-500 bg-gray-900 text-gray-300 hover:text-white transition-colors cursor-pointer"
    >
      <option value={TUTTE}>{t('ui.season_all')}</option>
      {REG.map(r => (
        <optgroup key={r.id} label={r.id}>
          {[...r.stagioni].reverse().map(s => (
            <option key={s.id} value={s.id}>
              {/* La stagione in corso si marca. Senza, l'utente non ha modo di
                  sapere quale sia: gli identificatori non lo dicono, e la data
                  di oggi non è scritta da nessuna parte nell'interfaccia. */}
              {s.id === corrente?.id ? t('ui.season_current', { id: s.id }) : s.id}
              {STAGIONI_CON_SET.has(s.id) ? '' : ` ${t('ui.season_no_sets')}`}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
