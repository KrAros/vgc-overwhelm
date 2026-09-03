// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/classificazione-badge.mjs
 *
 * Le voci su cui il MOTORE ramifica e che portano — o portavano — il badge
 * «non calcolata». Ognuna con un verdetto e la ragione, scritti a mano.
 *
 * ─── PERCHÉ UN MODULO A PARTE ──────────────────────────────────────────────
 * Perché lo leggono in due, e senza questo file si chiuderebbero in cerchio:
 *
 *   gen-inventario-motore.mjs  scopre le collisioni → ha bisogno di gapNoti
 *   gen-gap-noti.mjs           toglie i badge sbagliati → avrebbe bisogno
 *                              dell'inventario
 *
 * Un ciclo fra due generatori è una rete con una data di scadenza: rigenerare
 * l'uno invalida l'altro, e nessun test rosso lo segnala. Qui invece la
 * classificazione è SORGENTE, non prodotto: nessuno dei due la genera, tutti
 * e due la leggono.
 *
 * ─── I TRE VERDETTI ────────────────────────────────────────────────────────
 *
 *   badge-sbagliato        il motore applica proprio l'effetto per cui il
 *                          riferimento la calcola. Il badge va TOLTO, ed è
 *                          `gen-gap-noti.mjs` a toglierlo.
 *
 *   meccanica-diversa      il motore nomina la voce, ma per un'altra cosa.
 *                          Il badge resta CORRETTO: quello che il riferimento
 *                          calcola, noi continuiamo a non farlo.
 *
 *   citata-non-applicata   la voce compare solo in un elenco che non entra nel
 *                          danno. Badge corretto, ma è il segnale di un buco.
 *
 *   effetto-non-osservabile  il motore la calcola davvero, ma il risultato non
 *                          arriva a nessun numero mostrato. Badge CORRETTO:
 *                          toglierlo affermerebbe un calcolo che l'utente non
 *                          può vedere. È la cecità osservativa di CLAUDE.md
 *                          applicata al badge — «la differenza deve
 *                          sopravvivere fino al numero confrontato».
 *
 * Aggiungere una riga qui è un'affermazione, non una formalità: `npm run
 * inventario:gen` rifiuta di scrivere se una collisione non è classificata, e
 * `inventarioMotore.test.js` rilegge ogni prova per vedere se è ancora vera.
 */

export const CLASSIFICAZIONE = {
  abilita: {
    'pixilate': {
      verdetto: 'badge-sbagliato',
      nota: 'tabella ABILITA_ATE in lib/rules.js, applicata dal motore — Normale→Folletto e ×1,2 sulla potenza, esattamente checkAbilityTypeChange di NCP',
    },
    'aerilate': {
      verdetto: 'badge-sbagliato',
      nota: 'tabella ABILITA_ATE in lib/rules.js — Normale→Volante e ×1,2',
    },
    'refrigerate': {
      verdetto: 'badge-sbagliato',
      nota: 'tabella ABILITA_ATE in lib/rules.js — Normale→Ghiaccio e ×1,2',
    },
    'dragonize': {
      verdetto: 'badge-sbagliato',
      nota: 'tabella ABILITA_ATE in lib/rules.js — Normale→Drago e ×1,2',
    },
    'galvanize': {
      verdetto: 'badge-sbagliato',
      nota: 'tabella ABILITA_ATE in lib/rules.js — Normale→Elettro e ×1,2, quinto ramo dello stesso switch di checkAbilityTypeChange (damage_MASTER.js:1081)',
    },
    'long reach': {
      verdetto: 'badge-sbagliato',
      nota: 'calcEngine:332 — toglie il contatto come checkContactOverride, e da lì passano Tough Claws e Fluffy: cambia il numero',
    },
    'rattled': {
      verdetto: 'effetto-non-osservabile',
      nota: 'preparazione:275 le dà il +1 Velocità, ma calcEffectiveSpe (speedOrder:189) legge `pokemon.speBoost`, cioè lo stadio messo a mano nell\'editor — non `boosts.sp` della preparazione. Il boost non raggiunge nessun numero mostrato. Deciso in J, verificato di nuovo in F-3: vedi preparazione.test.js:461',
    },
    // `sand force` stava qui, `meccanica-diversa`, con questa nota:
    //
    //     «damage.js:47 la rende immune al danno da sabbia. NCP la calcola per
    //      il +30% di potenza in calcBPMods:1633, che noi non facciamo»
    //
    // Era vera fino alla sessione che ha implementato quel +30%. Adesso il
    // motore fa tutt'e due le cose, l'abilità ha un effetto meccanico e quindi
    // esce dal divario da sé: non è più una collisione, e la riga qui sarebbe
    // una lapide con una frase falsa sopra.
    //
    // La classificazione descrive uno STATO, non un fatto storico. Quando lo
    // stato cambia, la riga se ne va.

    // Qui stavano Battle Bond, Comatose e Forecast, nominate da rules.js
    // dentro `ABILITA_NON_COPIABILI` e `ABILITA_NON_SPEGNIBILI` — le due liste
    // trascritte da `cannotCopy` (damage_MASTER.js:387) e `cannotSupress`
    // (:403), dove comparire vuol dire il contrario di essere calcolate.
    //
    // Adesso le calcoliamo tutte e tre, quindi le loro righe se ne sono
    // andate: la classificazione descrive uno stato, non un fatto storico.

  },
  strumenti: {
    'iron ball': {
      verdetto: 'meccanica-diversa',
      nota: 'speedOrder:93 dimezza la Velocità. NCP la calcola via checkKlutz:451, che è l\'annullamento dello strumento',
    },
    'macho brace': {
      verdetto: 'meccanica-diversa',
      nota: 'speedOrder:93 dimezza la Velocità. NCP la calcola via checkKlutz:449',
    },
    // `kebia berry` stava qui con verdetto `citata-non-applicata`: era l'unica
    // delle diciotto resist berry senza una riga in ITEM_EFFECTS, mentre
    // `smogonString.js` la stampava già fra gli item difensivi. In F-3 le è
    // stata data la riga che le mancava (Veleno) e verificata contro NCP:
    // 162–192 contro 162–192. Non è più una collisione, quindi non va più
    // classificata — una riga qui affermerebbe un problema che non c'è.
  },
}

/** Le chiavi il cui badge va tolto, per tipo. */
export function badgeDaTogliere() {
  const per = (tipo) =>
    Object.entries(CLASSIFICAZIONE[tipo])
      .filter(([, v]) => v.verdetto === 'badge-sbagliato')
      .map(([k]) => k)
  return { abilita: per('abilita'), strumenti: per('strumenti') }
}
