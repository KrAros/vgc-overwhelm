// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { useTranslation } from 'react-i18next'
import { squadraHaPokemon } from '../lib/squadre'

/**
 * Una riga al posto della matrice finché manca un Pokémon: dice che cosa
 * fare e, se una squadra è già piena, nomina quella che manca.
 * role="status" perché la riga compare/scompare mentre l'utente compila.
 */
export default function GuidaMatrice({ team1, team2 }) {
  const { t } = useTranslation()
  const chiave = !squadraHaPokemon(team1)
    ? (!squadraHaPokemon(team2) ? 'ui.matrix_guide_both' : 'ui.matrix_guide_team1')
    : 'ui.matrix_guide_team2'
  return (
    <p
      role="status"
      className="mb-4 rounded-lg border border-gray-700/40 bg-gray-900 px-3 py-2 text-sm text-gray-300"
    >
      {t(chiave)}
    </p>
  )
}
