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
 * fallisce (rete che cade a metà) si renderizza comunque, in inglese: meglio
 * un'app in inglese di una pagina bianca.
 */
async function avvia() {
  try {
    await caricaLingua(linguaSalvata())
  } catch {
    // Si prosegue con l'inglese, che è sempre nel bundle.
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
