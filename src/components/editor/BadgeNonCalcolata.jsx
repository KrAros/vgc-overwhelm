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

/**
 * ─── LA FRASE INTERA, UNA SOLA VOLTA ────────────────────────────────────────
 *
 * Le due forme — il riquadro e il segnalino — devono dire la STESSA cosa: è la
 * regola di P sulle due affordance. Qui la frase si compone in un posto solo e
 * la usano entrambe, come testo o come nome accessibile.
 */
function frase(t, tipo) {
  return `${t('gap.badge')} — ${t(tipo === 'item' ? 'gap.spiegazioneItem' : 'gap.spiegazioneAbilita')}`
}

/**
 * ─── IL SEGNALINO, PER CHI HA GIÀ UN RIQUADRO ───────────────────────────────
 *
 * Va all'estremità destra della riga della descrizione e **non aggiunge
 * altezza**: il riquadro del badge ne aggiungeva 40 px, e cambiando Pokémon
 * faceva saltare cursori e mosse.
 *
 * Il simbolo da solo non direbbe niente — è il difetto trovato in X, dove le X
 * che svuotano un campo si chiamavano «✕». Qui `title` lo dice a chi passa
 * col mouse e `aria-label` a chi usa uno screen reader, con la stessa frase
 * del riquadro. Su tocco resta il caso scoperto, ed è dichiarato: chi tocca
 * vede un avviso ambra e non la ragione. Il prezzo di non far saltare il
 * layout ogni volta che si cambia abilità.
 */
export function SegnalinoNonCalcolata({ tipo = 'ability' }) {
  const { t } = useTranslation()
  const testo = frase(t, tipo)
  return (
    <span
      role="note"
      aria-label={testo}
      title={testo}
      className="shrink-0 ml-2 text-amber-300 text-[13px] leading-none cursor-help"
    >
      ⚠
    </span>
  )
}

export default function BadgeNonCalcolata({ tipo = 'ability' }) {
  const { t } = useTranslation()

  /**
   * Il riquadro resta per le 51 abilità che il badge ce l'hanno **senza avere
   * una descrizione**: lì non c'è niente a cui attaccare il segnalino. Ora sta
   * su UNA riga invece di due — `truncate` più il titolo intero — così anche
   * qui lo sbalzo si dimezza.
   */
  const testo = frase(t, tipo)
  return (
    <div
      className="flex items-center gap-1.5 text-[11px] leading-snug text-amber-200
                 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1"
      role="note"
      title={testo}
    >
      {/* aria-hidden: il simbolo è decorativo, il testo accanto dice già tutto. */}
      <span aria-hidden="true" className="shrink-0">⚠</span>
      {/* La frase INTERA, tagliata solo se non ci sta: dove c'è spazio si legge
          tutta, dove non ce n'è resta nel `title`. Un riquadro che dice solo
          «Non calcolata» perderebbe la ragione proprio dove è l'unico segnale
          presente — gli strumenti non hanno un pannello descrittivo. */}
      <span className="min-w-0 truncate">
        <span className="font-medium">{t('gap.badge')}</span>
        {' — '}
        {t(tipo === 'item' ? 'gap.spiegazioneItem' : 'gap.spiegazioneAbilita')}
      </span>
    </div>
  )
}
