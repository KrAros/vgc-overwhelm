/**
 * src/__tests__/igiene.test.js
 *
 * Due controlli che non riguardano il calcolo, ma il fatto che il resto dei
 * controlli venga davvero eseguito.
 *
 * ─── 1. I NOMI DEI FILE DI TEST ────────────────────────────────────────────
 * `vite.config.js` raccoglie i test con `include: ['src/**\/*.test.{js,jsx}']`.
 * Un file dentro `src/__tests__/` che non finisce in `.test.js` **non viene mai
 * eseguito** — e non lo dice nessuno: la suite passa, il conteggio sembra
 * ragionevole, i test dentro non girano.
 *
 * È successo davvero: `src/__tests__/share.js`, scritto nella sessione C con 22
 * test corretti, non è mai stato eseguito fino alla sessione G. Erano giusti,
 * bastava rinominarli. Spiegava il divario fra i 434 test dichiarati nel piano
 * e i 413 che venivano contati.
 *
 * ─── 2. IL VENDOR NON DEVE ENTRARE NELL'APPLICAZIONE ───────────────────────
 * `vendor/ncp/` contiene 756 KB di codice altrui che serve solo ai test. Vite
 * costruisce il bundle partendo da `index.html` e seguendo gli import: finché
 * nessun file di `src/` importa da `vendor/`, quel codice non può finire nel
 * sito. Questo test controlla la premessa, che è la vera difesa — verificare
 * `dist/` dopo il build sarebbe solo la controprova.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const RADICE = path.resolve(import.meta.dirname, '..', '..')
const CARTELLA_TEST = path.join(RADICE, 'src', '__tests__')

/** Elenca ricorsivamente i file di una cartella. */
function tuttiIFile(cartella, base = cartella) {
  const risultato = []
  for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
    const pieno = path.join(cartella, voce.name)
    if (voce.isDirectory()) risultato.push(...tuttiIFile(pieno, base))
    else risultato.push(path.relative(base, pieno))
  }
  return risultato
}

describe('igiene della suite', () => {
  it('ogni file JavaScript in __tests__ finisce in .test.js oppure sta in fixtures/', () => {
    const fuoriPosto = tuttiIFile(CARTELLA_TEST)
      .filter(f => /\.jsx?$/.test(f))
      .filter(f => !f.endsWith('.test.js') && !f.endsWith('.test.jsx'))
      // `fixtures/` contiene dati, `helpers/` utilità condivise: nessuno dei due
      // deve essere raccolto come test.
      .filter(f => !f.startsWith('fixtures' + path.sep) && !f.startsWith('helpers' + path.sep))

    expect(
      fuoriPosto,
      'questi file NON vengono eseguiti da vitest: rinominali in *.test.js '
      + 'oppure spostali in __tests__/helpers/',
    ).toEqual([])
  })

  it('nessun file di src/ importa da vendor/', () => {
    const colpevoli = []
    const scorri = (cartella) => {
      for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
        const pieno = path.join(cartella, voce.name)
        if (voce.isDirectory()) { scorri(pieno); continue }
        if (!/\.(js|jsx|ts|tsx)$/.test(voce.name)) continue
        // I file di test possono farlo: non entrano nel bundle. È il caso di
        // ncpHarness.test.js, che carica l'harness apposta.
        if (/\.test\.(js|jsx)$/.test(voce.name)) continue
        const testo = fs.readFileSync(pieno, 'utf8')
        if (/from\s+['"][^'"]*vendor\/|import\(\s*['"][^'"]*vendor\//.test(testo)) {
          colpevoli.push(path.relative(RADICE, pieno))
        }
      }
    }
    scorri(path.join(RADICE, 'src'))

    expect(
      colpevoli,
      'questi file trascinerebbero vendor/ncp dentro il bundle di produzione',
    ).toEqual([])
  })

  it('il vendor NCP conserva la licenza e l\'attribuzione', () => {
    const cartellaVendor = path.join(RADICE, 'vendor', 'ncp')
    if (!fs.existsSync(cartellaVendor)) {
      // Non è un errore: la fixture resta valida senza il vendor.
      expect(fs.existsSync(cartellaVendor)).toBe(false)
      return
    }
    const licenza = fs.readFileSync(path.join(cartellaVendor, 'LICENSE'), 'utf8')
    expect(licenza).toContain('MIT License')
    expect(licenza).toContain('Honko')
    expect(fs.existsSync(path.join(cartellaVendor, 'README.md'))).toBe(true)
  })
})
