// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/i18n.js
 *
 * ─── PERCHÉ UN LOCALE SOLO NEL BUNDLE ──────────────────────────────────────
 * `en.json` e `it.json` pesano insieme 145,6 kB grezzi, e prima entravano
 * entrambi nel chunk d'ingresso. Misurato sulla build: togliere `it.json`
 * dallo statico vale −63,2 kB grezzi e **−26,0 kB gzip** — di gran lunga il
 * risparmio più grosso della sessione E, e l'unico che sposta il numero che
 * l'utente paga davvero.
 *
 * Per confronto, togliere `zname` da `moves.json` vale 16 kB grezzi ma **0,74
 * kB gzip**: sono 664 stringhe ripetute e gzip se le mangia. È il motivo per
 * cui il criterio di questa sessione è scritto in gzip.
 *
 * ─── PERCHÉ NON C'È UN LAMPO DI INGLESE ────────────────────────────────────
 * `caricaLingua` si aspetta di essere attesa PRIMA del primo render (vedi
 * `main.jsx`). Se il caricamento partisse dopo, un utente italiano vedrebbe
 * l'interfaccia in inglese per qualche decina di millisecondi a ogni
 * apertura. Il costo è un `await` prima di `createRoot`, su un file che il
 * browser scarica in parallelo al resto.
 *
 * ─── LA LINGUA DI FALLBACK RESTA STATICA ───────────────────────────────────
 * `en` è nel bundle sempre, anche per un utente italiano. Serve da fallback:
 * se una chiave manca in `it.json` — succede, sono ottocento chiavi — senza
 * `en` a schermo comparirebbe la chiave grezza invece del testo inglese.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'

/** Le lingue che non sono nel bundle e come si vanno a prendere. */
const A_RICHIESTA = {
  it: () => import('./locales/it.json'),
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

/**
 * Carica una lingua se serve e la attiva.
 *
 * Idempotente: se il pacchetto è già in memoria non riscarica niente, quindi
 * si può chiamare a ogni cambio lingua senza precauzioni.
 *
 * @param {string} lingua — codice, es. 'it'
 * @returns {Promise<void>}
 */
export async function caricaLingua(lingua) {
  const prendi = A_RICHIESTA[lingua]
  if (prendi && !i18n.hasResourceBundle(lingua, 'translation')) {
    const modulo = await prendi()
    i18n.addResourceBundle(lingua, 'translation', modulo.default, true, true)
  }
  if (i18n.language !== lingua) await i18n.changeLanguage(lingua)
}

/** La lingua scelta l'ultima volta, o l'inglese. */
export function linguaSalvata() {
  try {
    return localStorage.getItem('lang') || 'en'
  } catch {
    // Storage bloccato (incognito con restrizioni): si parte in inglese.
    return 'en'
  }
}

export default i18n
