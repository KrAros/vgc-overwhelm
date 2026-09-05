// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/components/editor/StatusSelect.jsx
 *
 * Lo stato del Pokémon nel turno che si sta calcolando.
 *
 * ─── PERCHÉ UNA RIGA SUA, E NON UNA QUARTA COLONNA ─────────────────────────
 *
 * Simone aveva proposto di aggiungerlo come quarto elemento accanto ad
 * abilità, natura e strumento. La riga però ha già un vincolo misurato: la
 * natura più lunga, «Decisa (+Atk, -SpA)», chiede 152 px di testo. Al
 * breakpoint `sm:` (640 px) un terzo di riga ne lascia ~167 e ci sta; un
 * quarto ne lascerebbe ~118, e la natura si taglierebbe — per di più in
 * silenzio, perché il browser clippa l'opzione scelta e `scrollWidth` resta
 * uguale a `clientWidth` (è la misura aggiunta in P-2/4).
 *
 * L'altra ipotesi era metterlo accanto al riquadro dell'abilità. È chiusa da
 * un fatto: quel riquadro esiste solo se un'abilità è selezionata
 * (`SlotEditor.jsx`, `{data && ability && …}`), e lo stato non dipende
 * dall'abilità — sparirebbe su un Pokémon senza abilità scelta.
 *
 * Resta la riga a sé. Costa ~30 px, e l'editor mostra UN Pokémon alla volta
 * (`editor/index.jsx`, `index={activeTab}`): sono 30 px per pannello, non per
 * slot.
 *
 * ─── LARGHEZZA A METÀ ──────────────────────────────────────────────────────
 *
 * Il menù non ha bisogno di tutta la riga: l'etichetta più lunga è
 * «Gravemente avvelenato».
 *
 * L'altra metà è tenuta dalla barra dei punti salute (`BarraPS.jsx`), che sta
 * PRIMA — scelta di Simone. Fino a ieri qui c'era scritto che quello spazio
 * aspettava il tipo Tera: era una lapide nel layout, perché in Champions il
 * tipo Tera non esiste. Mezza riga tenuta libera per una cosa che non arriva
 * è mezza riga persa, e su telefono era la metà buona.
 */

import { useTranslation } from 'react-i18next'
import { STATI } from '../../lib/rules.js'

export default function StatusSelect({ value, onChange }) {
  const { t } = useTranslation()

  return (
    <select
      className="w-full bg-gray-700 text-xs text-white rounded px-2 py-1 outline-none"
      aria-label={t('aria.status')}
      value={value || 'healthy'}
      onChange={e => onChange(e.target.value === 'healthy' ? null : e.target.value)}
    >
      {STATI.map(s => (
        <option key={s} value={s}>{t(`statuses.${s}`)}</option>
      ))}
    </select>
  )
}
