// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { useCallback, useEffect, useState } from 'react'

/**
 * ─── DICE SE UN CONTENITORE PUÒ ANCORA SCORRERE, E DA QUALE LATO ───────────
 *
 * Serve alla matrice, che scorre in orizzontale senza dichiararlo: a 360 px si
 * vedono tre colonne su sei e niente segnala che ce ne siano altre. È il
 * difetto 3 delle foto di Simone, l'unico dei quattro che nessuna proprietà del
 * DOM sa misurare — «l'utente non capisce» non è un numero.
 *
 * ─── PERCHÉ NON UNA SFUMATURA FISSA ────────────────────────────────────────
 *
 * Una sfumatura sempre accesa costa due righe di CSS e nessun JavaScript. Ma
 * direbbe «c'è dell'altro» anche quando sei in fondo, cioè mentirebbe
 * esattamente nel momento in cui l'utente cerca conferma di aver visto tutto.
 * Meglio quindici righe che dicono il vero.
 *
 * ─── COSA OSSERVA ──────────────────────────────────────────────────────────
 *
 * Tre eventi, e servono tutti e tre:
 *   scroll        l'utente si muove
 *   resize        la finestra cambia e il contenuto può smettere di sborda
 *   ResizeObserver  il CONTENUTO cambia — caricare una squadra aggiunge
 *                   colonne senza che la finestra si muova, e senza questo la
 *                   sfumatura resterebbe spenta proprio quando serve
 *
 * In SSR non gira niente: `useEffect` non viene eseguito e lo stato iniziale è
 * «non scorre», che è la risposta giusta per un render senza layout.
 */
export default function useBordiScorrimento(ref) {
  const [bordi, setBordi] = useState({ inizio: false, fine: false })

  const misura = useCallback(() => {
    const e = ref.current
    if (!e) return
    const massimo = e.scrollWidth - e.clientWidth
    // Un pixel di tolleranza: gli arrotondamenti sub-pixel farebbero lampeggiare
    // la sfumatura quando si è di fatto in fondo.
    setBordi({
      inizio: e.scrollLeft > 1,
      fine: e.scrollLeft < massimo - 1,
    })
  }, [ref])

  useEffect(() => {
    const e = ref.current
    if (!e) return
    misura()
    e.addEventListener('scroll', misura, { passive: true })
    window.addEventListener('resize', misura)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(misura) : null
    ro?.observe(e)
    return () => {
      e.removeEventListener('scroll', misura)
      window.removeEventListener('resize', misura)
      ro?.disconnect()
    }
  }, [ref, misura])

  return bordi
}
