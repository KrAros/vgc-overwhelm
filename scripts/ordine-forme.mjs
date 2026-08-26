// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/ordine-forme.mjs
 *
 * Le voci di `formeSprite.json` che NON vengono dal generatore.
 *
 * ─── PERCHE' STANNO IN UN FILE A PARTE ─────────────────────────────────────
 *
 * Stavano dentro `gen-forme-sprite.mjs`, che le usa. Ma sono anche l'unica
 * cosa che impedisce a una rigenerazione di cancellarle, quindi vanno
 * confrontate con la tabella da un test — e importare il generatore per
 * leggerle significa LANCIARLO.
 *
 * Non e' un timore teorico: provato. Con l'import dentro la suite, i test
 * ci mettevano 28 secondi invece di mezzo, riscrivevano `formeSprite.json`
 * durante la corsa, e passavano lo stesso — perche' il confronto trovava la
 * tabella appena riscritta dal generatore che avrebbe dovuto controllare.
 * Verde, e i dati sotto cambiati.
 *
 * Una guardia `LANCIATO` dentro il generatore avrebbe evitato quel giro, ma
 * sarebbe stata una difesa che si puo' togliere per sbaglio senza che niente
 * lo dica. Separare i dati dal codice che li esegue rende il giro
 * IMPOSSIBILE invece che sconsigliato: qui dentro non c'e' nulla da eseguire.
 */

/**
 * ═══ DOVE L'ORDINE DI `pokemon.json` NON È QUELLO DI HOME ══════════════════
 *
 * L'ipotesi «indice di forma = posizione in pokemon.json» regge per 151 gruppi
 * su 154, e NON è verificabile chiedendo al server: l'URL esiste comunque, è
 * solo la forma sbagliata. L'ha trovata l'occhio sul foglio di contatto.
 *
 * Ogni riga qui sotto dice come è stata verificata. Senza quella frase la
 * correzione sarebbe indistinguibile da un'altra ipotesi.
 */
export const ORDINE_CORRETTO = {
  // Ogerpon — `pokemon.json` li elenca in ordine alfabetico, HOME in ordine di
  // gioco (Teal, Wellspring, Hearthflame, Cornerstone).
  // Visto a 56px: f01 è la maschera BLU (acqua = Wellspring), f03 la GRIGIA
  // (roccia = Cornerstone). Hearthflame, rossa, cadeva già giusta su f02.
  'ogerpon-wellspring':  'f01',
  'ogerpon-cornerstone': 'f03',

  // Tauros di Paldea — stesso schema: alfabetico da noi, ordine di gioco su
  // HOME (Combat, Blaze, Aqua). Visto a 128px: f01 è il toro nero SENZA segni
  // (Combat), f02 ha la criniera ROSSA (Blaze), f03 i segni BLU sulle zampe
  // (Aqua). Blaze cadeva già giusto.
  'tauros-paldea-combat': 'f01',
  'tauros-paldea-aqua':   'f03',

  // Pumpkaboo e Gourgeist — HOME ordina Average, Small, Large, Super, mentre
  // da noi la taglia Small viene prima della base. Visto a 128px: f01 è
  // nettamente il più piccolo dei quattro, quindi è Small, e f00 è Average.
  'pumpkaboo':       'f00',
  'pumpkaboo-small': 'f01',
  'gourgeist':       'f00',
  'gourgeist-small': 'f01',

  // Floette — il caso che ha battuto due volte la regola posizionale, e la
  // seconda volta ha battuto anche l'occhio.
  //
  // Su HOME esistono f00-f05: sono i CINQUE colori del fiore piu' l'Eterno,
  // e nessuno di quegli indici e' la Mega, che HOME non ha. Su pokemon-zone
  // esistono due sole posizioni, f05 e f06.
  //
  // La sessione Y le guardo' e le assegno' al contrario: f05 ando' a
  // floette-mega, che da allora ha mostrato l'icona del Fiore Eterno sul sito
  // pubblicato. Riguardate da KrAros: f05 e' il Fiore Eterno, f06 la Mega.
  //
  // Entrambe vanno fissate qui perche' la posizione darebbe f01 e f02 — il
  // gruppo nei nostri dati e' [floette, floette-eternal, floette-mega].
  'floette-eternal': 'f05',
  'floette-mega':    'f06',

  // Slowbro di Galar — su pokemon-zone e' f02, non f01: la Mega occupa gia'
  // f01, quindi la forma regionale slitta di uno. La posizione nei nostri
  // dati direbbe f01, perche' il gruppo e' [slowbro, slowbro-galar,
  // slowbro-mega]. Verificata a occhio da KrAros.
  //
  // Le altre quattro forme aggiunte insieme a questa — slowking, slowking di
  // Galar, stunfisk e stunfisk di Galar — cadono giuste sulla posizione e non
  // hanno bisogno di una riga qui.
  'slowbro-galar':   'f02',
}


