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
 * ─── LA LINGUA DI FALLBACK RESTA STATICA, MA SOLO PER META' ────────────────
 * `en` è nel bundle sempre, anche per un utente italiano. Serve da ripiego: se
 * una chiave manca in `it.json` — sono millenovecento chiavi — senza `en` a
 * schermo comparirebbe la chiave grezza invece del testo inglese.
 *
 * Quella metà però costava 22,7 kB gzip su un budget di 210, e il margine
 * sotto la soglia era arrivato a 0,15 kB. Misurato, il peso non è una cosa
 * sola:
 *
 *     guscio    ui, report, editor, eot, aria, gap, natures, types    3,1 kB
 *     cataloghi moves, abilities, items, e le tre descrizioni        19,7 kB
 *
 * Il ripiego serve al GUSCIO: sono le scritte dell'interfaccia, quelle che
 * senza traduzione diventano `report.damage` e rendono la pagina illeggibile.
 * I cataloghi sono ottocentodieci nomi di mosse e trecento di abilità: se non
 * arrivassero si vedrebbe uno slug in una tendina — brutto, non illeggibile.
 *
 * Quindi il guscio inglese resta statico e continua a fare da ripiego, e i
 * cataloghi diventano pigri per tutt'e due le lingue. Il taglio lo fa
 * `vite.config.js` con le query `?guscio` e `?catalogo`; senza query il file
 * resta intero per i test e i generatori.
 *
 * ─── E L'INGLESE ADESSO CARICA ANCHE LUI ───────────────────────────────────
 * Prima un utente inglese non aspettava niente. Adesso aspetta il proprio
 * catalogo, esattamente come un italiano aspetta `it.json`: è l'`await` prima
 * di `createRoot` che `main.jsx` fa già, su un file che il browser scarica in
 * parallelo al resto.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import guscioEn from './locales/en.json?guscio'

/** I cataloghi che NON sono nel bundle e come si vanno a prendere. */
const A_RICHIESTA = {
  en: () => import('./locales/en.json?catalogo'),
  it: () => import('./locales/it.json'),
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: guscioEn },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

/**
 * Le lingue di cui abbiamo GIA' preso il pacchetto a richiesta.
 *
 * Prima questa condizione era `!i18n.hasResourceBundle(lingua)`, e adesso non
 * basterebbe più: l'inglese un pacchetto ce l'ha già — il guscio — quindi la
 * domanda «ce l'hai?» risponderebbe di sì e il catalogo non arriverebbe mai.
 * Il difetto sarebbe stato silenzioso: interfaccia giusta, nomi delle mosse
 * scritti come slug.
 */
const complete = new Set()

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
  if (prendi && !complete.has(lingua)) {
    const modulo = await prendi()
    // `deep` e `overwrite` a true: per l'inglese questo pacchetto si posa
    // SOPRA il guscio già presente invece di sostituirlo.
    i18n.addResourceBundle(lingua, 'translation', modulo.default, true, true)
    complete.add(lingua)
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
