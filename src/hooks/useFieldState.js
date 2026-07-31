/**
 * src/hooks/useFieldState.js
 *
 * Legge dallo store i valori di campo, tutti insieme.
 *
 * ─── PERCHÉ SERVE ──────────────────────────────────────────────────────────
 * `buildField` in `lib/battleState.js` sa mappare lato e modificatore, ma può
 * mappare solo quello che riceve. Prima della sessione C il ReportPanel
 * leggeva otto valori dallo store e la DamageTable undici: anche con
 * `buildField` in mezzo, i due avrebbero continuato a costruire campi diversi,
 * perché a monte leggevano cose diverse.
 *
 * Con questo hook la lista dei valori esiste in un posto solo. Aggiungere un
 * modificatore di campo domani (Gravity, Wonder Room…) vuol dire toccare
 * questo file e `buildField`, non andare a caccia dei consumatori.
 *
 * ─── PERCHÉ NON STA IN lib/ ────────────────────────────────────────────────
 * `lib/` è codice puro, testabile senza React. Questo è un hook: usa lo store
 * e `useMemo`. Tenerli separati è ciò che permette a `battleState.test.js` di
 * girare senza montare nulla.
 *
 * ─── PERCHÉ useMemo ────────────────────────────────────────────────────────
 * Senza, l'hook restituirebbe un oggetto nuovo a ogni render, e qualunque
 * memoizzazione a valle (il `React.memo` sulle celle previsto nella sessione E)
 * si vanificherebbe da sola. Le dipendenze sono i riferimenti dello store, che
 * Zustand mantiene stabili finché il valore non cambia davvero.
 */

import { useMemo } from 'react'
import useCalcStore from '../store/useCalcStore'

/**
 * @returns {object} i valori di campo, nella forma che `buildField` si aspetta
 */
export default function useFieldState() {
  const weather      = useCalcStore(s => s.weather)
  const terrain      = useCalcStore(s => s.terrain)
  const doubleTarget = useCalcStore(s => s.doubleTarget)
  const trickRoom    = useCalcStore(s => s.trickRoom)
  const helpingHand  = useCalcStore(s => s.helpingHand)
  const tailwind     = useCalcStore(s => s.tailwind)
  const auroraVeil   = useCalcStore(s => s.auroraVeil)
  const lightScreen  = useCalcStore(s => s.lightScreen)
  const reflect      = useCalcStore(s => s.reflect)
  const crit         = useCalcStore(s => s.crit)

  return useMemo(() => ({
    weather, terrain, doubleTarget, trickRoom,
    helpingHand, tailwind, auroraVeil, lightScreen, reflect, crit,
  }), [weather, terrain, doubleTarget, trickRoom,
       helpingHand, tailwind, auroraVeil, lightScreen, reflect, crit])
}