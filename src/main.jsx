// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import i18n, { caricaLingua, linguaSalvata } from './i18n.js'
import App from './App.jsx'

/**
 * ─── PERCHÉ SI ASPETTA LA LINGUA PRIMA DI RENDERIZZARE ─────────────────────
 * `it.json` non è più nel bundle: si scarica a parte. Se il primo render
 * partisse senza aspettarlo, un utente italiano vedrebbe l'interfaccia in
 * inglese per qualche decina di millisecondi a ogni apertura — un lampo
 * fastidioso proprio nel momento in cui la pagina appare.
 *
 * L'attesa costa una richiesta che il browser fa in parallelo al resto. Se
 * fallisce (rete che cade a metà) si renderizza comunque: meglio un'app
 * imperfetta di una pagina bianca.
 *
 * ─── COSA SI VEDE SE QUELLA RICHIESTA FALLISCE ─────────────────────────────
 * Qui c'era scritto «si prosegue con l'inglese, che è sempre nel bundle». Non
 * è più vero per intero, e la mezza verità sarebbe stata peggio del silenzio.
 *
 * Nel bundle statico adesso c'è il GUSCIO inglese — le scritte
 * dell'interfaccia — mentre i nomi di mosse, abilità e strumenti arrivano col
 * pacchetto della lingua (vedi `i18n.js`). Se quel pacchetto non arriva, la
 * pagina resta leggibile e navigabile in inglese, ma nelle tendine si leggono
 * gli slug invece dei nomi.
 *
 * È il prezzo dichiarato dei 20 kB recuperati, e sta scritto qui perché chi
 * vedrà quel sintomo sappia da dove viene.
 */
async function avvia() {
  try {
    await caricaLingua(linguaSalvata())
  } catch {
    // Si prosegue col guscio inglese, che è sempre nel bundle.
  }

  // `<html lang>` seguiva index.html e restava fermo su "it" anche in
  // inglese. Qui parte allineato; il cambio a caldo lo fa Header.jsx.
  document.documentElement.lang = i18n.language

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

avvia()
