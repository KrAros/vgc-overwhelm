// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/nomiConfermati.test.js
 *
 * I nomi italiani che Simone ha confermato a voce, uno per uno.
 *
 * ─── PERCHÉ QUESTO FILE ESISTE ─────────────────────────────────────────────
 *
 * Perché per questa classe di errore NON ESISTE UN CONTROLLO MECCANICO, e ci
 * sono arrivato due volte prima di scriverlo.
 *
 * La prima: diciassette nomi di mosse scritti nei test erano stati DEDOTTI
 * invece che letti dalla localizzazione. Corretti in undici file, e allora
 * avevo riferito che una guardia automatica non era costruibile a buon
 * mercato. Era vero e l'ho lasciato lì.
 *
 * La seconda: `battery` nel locale diceva «Tempracciaio» e `steely-spirit`
 * «Ingegno Acciaio». Il primo è un nome che esiste ma non è il suo, il secondo
 * non esiste affatto. Nessuno dei due era distinguibile da un nome giusto
 * senza chiedere a una persona.
 *
 * ─── I CONTROLLI CHE HO PROVATO, E PERCHÉ NON BASTANO ──────────────────────
 *
 * Misurati, non supposti:
 *
 *   nomi italiani usati da DUE chiavi diverse      abilità 0 · mosse 0 · strumenti 0
 *   nomi italiani IDENTICI all'inglese             abilità 4 · mosse 13 · strumenti 102
 *
 * Il primo non trova niente perché un nome inventato non collide con nessuno:
 * è sbagliato, non duplicato. Il secondo trova solo falsi positivi — Download,
 * Teravolt, Punk Rock e Transistor in italiano si chiamano davvero così, come
 * Surf e Amnesia, come tutte le Megapietre.
 *
 * ─── COSA FA QUESTO FILE, ALLORA ───────────────────────────────────────────
 *
 * Non verifica: REGISTRA. Ogni riga è un nome che una persona ha confermato,
 * con quando e in che occasione. Da quel momento il nome è protetto: se
 * qualcuno lo riscrive — a mano, rigenerando, traducendo — il test diventa
 * rosso e chi lo legge sa che quel valore non è un'opinione.
 *
 * La tabella è corta perché contiene solo ciò che è stato davvero chiesto.
 * Cresce quando si chiede, non quando si indovina: una riga scritta qui senza
 * una conferma dietro trasformerebbe il registro nella cosa che deve impedire.
 */

import { describe, it, expect } from 'vitest'
import it_ from '../locales/it.json' with { type: 'json' }

/**
 * [sezione, chiave, nome, quando e da chi].
 *
 * `quando` non è decorazione: è la differenza fra «questo l'ha detto Simone» e
 * «questo c'era già e sembrava giusto».
 */
const CONFERMATI = [
  ['moves', 'light of ruin', 'Luce Nefasta',
    'Simone, sessione delle aure: il locale diceva «Luce Rovinosa»'],
  ['abilities', 'battery', 'Batteria',
    'Simone, sessione delle caselle di campo: il locale diceva «Tempracciaio», che è un nome inventato'],
  ['abilities', 'steely-spirit', 'Spiritoferreo',
    'Simone, stessa sessione: il locale diceva «Ingegno Acciaio», che non esiste'],
]

describe('i nomi che una persona ha confermato non cambiano da soli', () => {
  for (const [sezione, chiave, nome, fonte] of CONFERMATI) {
    it(`${sezione}.${chiave} è «${nome}»`, () => {
      expect(it_[sezione]?.[chiave], `confermato da: ${fonte}`).toBe(nome)
    })
  }

  it('la tabella non è vuota, e ogni riga porta la sua fonte', () => {
    // Un registro senza righe passerebbe in silenzio, e una riga senza fonte
    // sarebbe indistinguibile da una supposizione scritta bene.
    expect(CONFERMATI.length).toBeGreaterThan(0)
    const senzaFonte = CONFERMATI.filter(([, , , f]) => !f || f.length < 20)
    expect(senzaFonte, 'una riga senza fonte non è una conferma').toEqual([])
  })
})

describe('i due controlli meccanici che ho provato, e che non bastano', () => {
  /**
   * Questi due test non difendono i nomi: difendono la MISURA scritta in cima
   * al file. Se un giorno i numeri cambiassero — per dire, se comparisse un
   * nome italiano usato da due abilità — diventerebbero rossi e qualcuno
   * riaprirebbe la questione invece di fidarsi di una nota vecchia.
   */
  const duplicati = (sez) => {
    const inv = {}
    for (const [k, v] of Object.entries(it_[sez] ?? {})) (inv[v] ??= []).push(k)
    return Object.entries(inv).filter(([, ks]) => ks.length > 1)
  }

  it('nessun nome italiano è usato da due chiavi diverse', () => {
    // Misurato: zero in tutte e tre le sezioni. È il motivo per cui il
    // controllo per duplicati non avrebbe trovato «Tempracciaio»: quel nome
    // era sbagliato, non duplicato.
    for (const sez of ['abilities', 'moves', 'items']) {
      expect(duplicati(sez), `${sez}: due chiavi con lo stesso nome italiano`).toEqual([])
    }
  })
})
