// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * Un solo accento (teal) sui controlli della home.
 *
 * Ambra, viola e giallo restano solo dove portano un significato: chip dei
 * modificatori di campo, stati KO/immunità, Trick Room. Ogni riga ammessa è
 * riconosciuta da una sottostringa: tutto il resto che usa quei colori è un
 * controllo decorato a caso, e il test lo segnala.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const VIETATI = /\b(?:bg|text|border|ring|from|to|hover:bg)-(?:amber|purple|violet|yellow-500)[-\w/]*/g

function violazioni(sorgente, ammesse) {
  return sorgente.split('\n').flatMap((riga, i) =>
    ammesse.some(a => riga.includes(a)) ? [] :
    (riga.match(VIETATI) || []).map(m => `${i + 1}: ${m}`))
}

const FILE = {
  'src/components/TopBar.jsx': ['color:', 'trickRoom ?'],          // chip campo/meteo, Trick Room
  'src/components/DamageTable.jsx': ['Immune', "ko === 'possibile'"], // dati semantici
  'src/components/editor/SlotEditor.jsx': [],
  'src/components/editor/PresetSelect.jsx': [],
}

describe('accento unico', () => {
  for (const [file, ammesse] of Object.entries(FILE)) {
    it(`${file}: niente ambra/viola su controlli non semantici`, () => {
      expect(violazioni(readFileSync(file, 'utf8'), ammesse)).toEqual([])
    })
  }

  it('perturbazione: il rilevatore vede un controllo ambra', () => {
    const v = violazioni('<button className="bg-amber-900/30 text-violet-400">', [])
    expect(v.length).toBe(2)
    expect(violazioni('<b className="bg-amber-900/30"> // Immune', ['Immune'])).toEqual([])
  })
})
