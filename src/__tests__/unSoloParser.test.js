// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/unSoloParser.test.js
 *
 * Di parser Showdown ce n'è **uno**, e di serializzatori uno.
 *
 * ─── PERCHÉ ESISTE ─────────────────────────────────────────────────────────
 *
 * Fino alla sessione CC ce n'erano due implementazioni complete:
 * `utils/showdownIO.js` dietro l'«Importa» della squadra, e
 * `editor/showdownHelpers.js` dietro l'«Importa» del singolo Pokémon. La
 * seconda è nata sei giorni dopo la prima e ha ricevuto 3 commit contro 8.
 *
 * Il prezzo, misurato prima di toglierla:
 *
 *   «Mega Scolipede» · «Rotom (Wash)» · «Alolan Raichu»   non trovati
 *   `EVs: 252/4/252`                                       Def = 4 SP invece di 1
 *   esporta                                                `EVs: 32 Atk` invece di 252
 *
 * Le prime tre sono la correzione di W, la quarta è il difetto che L aveva già
 * chiuso nell'altro parser. Ogni sessione correggeva una copia sola, e chi la
 * correggeva non sapeva che ce ne fosse un'altra.
 *
 * ─── COSA SORVEGLIA ────────────────────────────────────────────────────────
 *
 * Non che i due concordino — non si può più, ce n'è uno. Sorveglia che non ne
 * ricompaia un secondo: cerca nei sorgenti chi riconosce la grammatica di
 * Showdown, e pretende che sia un file solo.
 *
 * È falsificabile per costruzione: ricreare un file che legga `Ability:` fa
 * diventare rosso questo test.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Relativo a QUESTO file, non alla cartella di lavoro: `process` non è fra i
// globali che eslint consente nei test, e un percorso relativo al sorgente
// resta valido comunque venga lanciata la suite.
const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function sorgenti(dir) {
  const out = []
  for (const v of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, v.name)
    if (v.isDirectory()) { if (v.name !== '__tests__') out.push(...sorgenti(p)) }
    else if (/\.(js|jsx)$/.test(v.name)) out.push(p)
  }
  return out
}

const FILE = sorgenti(RADICE)

/**
 * I commenti si tolgono prima di cercare. Al primo tentativo il criterio
 * segnalava `Modals.jsx` e `SlotEditor.jsx`: combaciava sulle frasi che avevo
 * appena scritto io per spiegare la correzione. Un criterio che si accende
 * sulla propria documentazione non misura il codice.
 */
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CORPO = new Map(FILE.map(f => [f, senzaCommenti(fs.readFileSync(f, 'utf8'))]))

describe('un solo parser Showdown', () => {
  it('un solo file riconosce la grammatica di un paste', () => {
    // `Ability:` a inizio riga è la firma: chi la cerca sta leggendo un paste.
    const parser = FILE.filter(f => /startsWith\('Ability:'\)/.test(CORPO.get(f)))
      .map(f => path.relative(path.join(RADICE, '..'), f))
    expect(parser).toEqual(['src/utils/showdownIO.js'])
  })

  it('un solo file scrive la riga dei punti di un paste', () => {
    // L'etichetta era `EVs:` ed è diventata `SPs:`: l'export converte va e
    // scrive gli SP veri, perché è a chi usa questo calcolatore che serve
    // leggerli. Il presidio non cambia scopo — impedire una seconda copia del
    // serializzatore — cambia solo la stringa che lo identifica.
    //
    // `PresetSelect.jsx` costruisce righe simili ma scrive `SP:` al singolare:
    // è l'ANTEPRIMA a schermo, non un paste. Che le due etichette si
    // somiglino ora più di prima è il motivo per cui il confronto è sulla
    // stringa esatta e non su una espressione larga.
    const scrittori = FILE.filter(f => /`SPs: \$\{/.test(CORPO.get(f)))
      .map(f => path.relative(path.join(RADICE, '..'), f))
    expect(scrittori).toEqual(['src/utils/showdownIO.js'])

    // E nessuno deve essere tornato a scrivere la vecchia riga in EV: sarebbe
    // il difetto di prima, riaperto in un secondo posto.
    const inEv = FILE.filter(f => /`EVs: \$\{/.test(CORPO.get(f)))
      .map(f => path.relative(path.join(RADICE, '..'), f))
    expect(inEv, 'qualcuno scrive di nuovo un paste in EV').toEqual([])
  })

  it('il controllo: la ricerca guarda davvero dei file', () => {
    // La sonda cieca della sessione L: se `sorgenti` tornasse una lista vuota,
    // i due casi qui sopra confronterebbero [] con [] e passerebbero.
    expect(FILE.length).toBeGreaterThan(30)
    expect(FILE.some(f => f.endsWith('showdownIO.js'))).toBe(true)
  })

  it('il file duplicato non esiste più', () => {
    expect(fs.existsSync(path.join(RADICE, 'components/editor/showdownHelpers.js'))).toBe(false)
  })
})
