// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/components/editor/BadgeNonCalcolata.jsx
 *
 * Dichiara che una voce selezionata NON entra nel calcolo del danno.
 *
 * ─── UNO STATO SOLO ────────────────────────────────────────────────────────
 * Il badge c'è oppure non c'è. Non esiste la spunta verde «calcolata».
 *
 * Il motivo è aritmetico: delle 310 abilità selezionabili ne calcoliamo 28.
 * Un badge a due stati produrrebbe 28 spunte verdi e 130 avvisi grigi su 310
 * voci — cioè rumore su entrambi i lati. Con uno stato solo la regola che
 * l'utente impara è semplice e vera:
 *
 *     badge presente  → questa voce non entra nel numero
 *     badge assente   → il numero è quello che sarebbe nel gioco
 *
 * ─── DOVE NON COMPARE, E PERCHÉ ────────────────────────────────────────────
 * Solo sulle voci che il riferimento NCP calcola davvero nel danno: 130
 * abilità e 41 strumenti, elencati in `src/data/gapNoti.json` e rigenerabili
 * con `npm run gap:gen`.
 *
 * Le altre 152 abilità senza effetto non toccano il danno nemmeno nel
 * riferimento — Raccolta, Fuga, Cursore. Un pallino lì non sarebbe onestà,
 * sarebbe rumore: insegnerebbe a ignorare il badge, e a quel punto smetterebbe
 * di funzionare anche dove serve.
 */

import { useTranslation } from 'react-i18next'

export default function BadgeNonCalcolata({ tipo = 'ability' }) {
  const { t } = useTranslation()

  return (
    <div
      className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-300/90
                 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1.5"
      role="note"
    >
      {/* aria-hidden: il simbolo è decorativo, il testo accanto dice già tutto. */}
      <span aria-hidden="true" className="mt-px shrink-0">⚠</span>
      <span>
        <span className="font-medium">{t('gap.badge')}</span>
        {' — '}
        {t(tipo === 'item' ? 'gap.spiegazioneItem' : 'gap.spiegazioneAbilita')}
      </span>
    </div>
  )
}
