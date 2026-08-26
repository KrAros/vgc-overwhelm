// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/store/useReg.js
 *
 * Quale reg filtra i set proposti. Una preferenza di chi scrive la squadra,
 * non un dato della battaglia.
 *
 * ─── PERCHE' UN NEGOZIO A PARTE E NON UN CAMPO DI `useCalcStore` ───────────
 *
 * Perché la reg **non deve finire nel link condiviso**, e la separazione lo
 * rende impossibile invece che sconsigliato.
 *
 * `useCalcStore` serializza il campo di battaglia nell'URL: meteo, terreno,
 * Distortozona, nemici in campo. Sono cose che cambiano il numero, quindi chi
 * apre il link deve vederle. La reg no: il link porta la squadra **già
 * risolta**, e un danno non può cambiare perché chi lo apre ha un'altra reg
 * selezionata. Un campo dentro `useCalcStore` sarebbe stato a una riga di
 * distanza dal finire in `f.*`; qui quella riga non esiste.
 *
 * Vale lo stesso per le squadre salvate: la scelta della reg non entra in
 * `vgc-overwhelm-teams`, quindi caricare una squadra vecchia non sposta la
 * tendina sotto i piedi di chi la sta guardando.
 *
 * ─── IL VALORE `tutte` ─────────────────────────────────────────────────────
 *
 * È una scelta legittima, non l'assenza di scelta: «mostrami i set di ogni
 * reg». Per questo è una stringa e non `null` — `null` sarebbe stato
 * indistinguibile da «non ho ancora deciso», e il codice avrebbe dovuto
 * indovinare.
 *
 * ─── LA CHIAVE SALVATA E' CAMBIATA, ED E' VOLUTO ───────────────────────────
 *
 * Era `sixth_ember_stagione` e conteneva `M-4` o `M-5`. Ora è
 * `sixth_ember_reg` e contiene `M-A` o `M-B`. Cambiare NOME invece di
 * riusarlo evita che una preferenza vecchia venga letta come una nuova: `M-5`
 * non è una reg, e sarebbe stata scartata da `VALIDE` — ma solo per fortuna,
 * perché nessun identificatore si sovrappone. Con un nome nuovo la cosa non
 * dipende dalla fortuna, e chi riapre l'app riparte dal valore derivato.
 */

import { create } from 'zustand'
import { REG, regConSetPiuRecente } from '../lib/reg.js'
import { META_PRESETS } from '../data/metaPresets.js'

const LS_KEY = 'sixth_ember_reg'

export const TUTTE = 'tutte'

/** Le reg che hanno almeno un set: è ciò che decide il valore iniziale. */
export const REG_CON_SET = new Set(META_PRESETS.map(p => p.reg))

const VALIDE = new Set([TUTTE, ...REG.map(r => r.id)])

/**
 * Il valore di partenza: quello scelto l'ultima volta, se è ancora valido.
 * Altrimenti la reg con set più recente, e in mancanza di set `tutte`.
 *
 * Il controllo di validità non è una formalità: una reg può sparire dal
 * registro (un refuso corretto, una riga tolta) e riaprire l'app con una
 * preferenza che non esiste più darebbe una tendina vuota senza spiegazione.
 */
export function regIniziale() {
  try {
    const salvata = localStorage.getItem(LS_KEY)
    if (salvata && VALIDE.has(salvata)) return salvata
  } catch {
    // localStorage non disponibile: incognito con storage bloccato, o
    // permessi negati. Si continua col valore derivato.
  }
  return regConSetPiuRecente(REG_CON_SET) ?? TUTTE
}

const useReg = create((set) => ({
  reg: regIniziale(),

  setReg: (id) => {
    if (!VALIDE.has(id)) return
    set({ reg: id })
    try {
      localStorage.setItem(LS_KEY, id)
    } catch {
      // Come sopra: la preferenza vale per questa sessione e basta.
    }
  },
}))

export default useReg
