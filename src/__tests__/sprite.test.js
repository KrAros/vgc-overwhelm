// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/sprite.test.js
 *
 * Che l'icona mostrata sia quella del Pokémon che stiamo calcolando.
 *
 * ─── IL DIFETTO ────────────────────────────────────────────────────────────
 * `spriteUrl` dava un suffisso di forma solo a mega e Alola:
 *
 *     isMegaY ? 'f02' : (isMegaX || isMega || isAlola) ? 'f01' : 'f00'
 *
 * Tutto il resto — Hisui, Galar, Paldea, Therian, Origin, i due Rider di
 * Calyrex, Urshifu Pluricolpo — ricadeva su `f00`, l'icona della forma base.
 * Misurato: **152 specie si spartivano 57 file**, quindi almeno 95 mostravano
 * l'immagine di un altro Pokémon. I numeri erano giusti; era l'immagine a
 * mentire, e nessun test lo vedeva perché nessun test guardava gli sprite.
 *
 * Trovato percorrendo a mano l'import di una squadra meta: `urshifu-rapid-
 * strike` chiedeva `icon0892_f00_s0.png`, che è Urshifu Singolcolpo — un
 * Pokémon di tipo diverso.
 *
 * ─── PERCHÉ QUESTI CASI E NON ALTRI ────────────────────────────────────────
 * I quattro nominati sono quelli VERIFICATI A OCCHIO sul foglio di contatto
 * prodotto da `npm run forme:gen`. Ogerpon e Tauros in particolare non erano
 * ricavabili automaticamente: l'URL esisteva comunque, ed erano le due forme
 * a essere scambiate fra loro.
 */

import { describe, it, expect } from 'vitest'
import { spriteUrl, resolveNum } from '../utils/sprite.js'
import pokemonData from '../data/pokemon.json'
import formeSprite from '../data/formeSprite.json'

/** Il suffisso di forma dentro un URL, es. `f01`. */
const formaDi = (chiave) => (spriteUrl(chiave)?.match(/_(f\d\d)_/) || [])[1]

describe('sprite — le forme non condividono più l\'icona della base', () => {
  it('due specie diverse non chiedono lo stesso file', () => {
    // È la proprietà che il difetto violava: 152 specie su 57 file.
    // Restano fuori le specie senza suffisso in tabella — le Mega inventate
    // da Champions, per cui Pokémon HOME non ha proprio l'immagine.
    const perUrl = new Map()
    for (const chiave of Object.keys(pokemonData)) {
      const u = spriteUrl(chiave)
      if (!u) continue
      if (!perUrl.has(u)) perUrl.set(u, [])
      perUrl.get(u).push(chiave)
    }

    // Contano solo i gruppi in cui TUTTI hanno un suffisso: se una specie non
    // è in tabella ricade su f00 e collide con la base per costruzione, ed è
    // il limite dichiarato — non un errore di mappatura.
    const collisioni = [...perUrl.entries()]
      .filter(([, ks]) => ks.length > 1)
      .filter(([, ks]) => ks.every(k => formeSprite.forme[k]))
      .map(([u, ks]) => `${ks.join(' = ')} → ${u.split('/').pop()}`)

    expect(collisioni, 'specie in tabella che condividono un file').toEqual([])
  })

  it('chi resta senza icona propria: solo le Mega di Champions e Silvally', () => {
    // Il limite dichiarato, contato invece che stimato. Due famiglie sole:
    //
    //   -mega     Megaevoluzioni inventate da Champions, che Pokémon HOME non
    //             ha mai avuto. 51 posizioni provate e assenti.
    //   silvally  HOME tiene una sola icona per tutte e diciotto le forme-tipo,
    //             e in effetti sono identiche: il colore cambia solo il disco.
    //
    // Se un giorno questa lista crescesse, vorrebbe dire che una famiglia è
    // uscita dalla tabella e ha ricominciato a mostrare l'icona della base.
    // Solo dentro i gruppi con più forme: una specie che di forme non ne ha
    // non è in tabella per costruzione, e `f00` è la risposta giusta.
    const perNumero = new Map()
    for (const k of Object.keys(pokemonData)) {
      const n = resolveNum(k)
      if (!n) continue
      if (!perNumero.has(n)) perNumero.set(n, [])
      perNumero.get(n).push(k)
    }
    const inGruppo = [...perNumero.values()].filter(ks => ks.length > 1).flat()
    const scoperti = inGruppo
      .filter(k => !formeSprite.forme[k] && !/-mega|^silvally-/.test(k))
      .sort()

    // Elencate per nome invece che per espressione: un elenco che cresce si
    // vede, un'espressione che si allarga no.
    expect(scoperti, 'oltre a Mega e Silvally, HOME non ha queste forme').toEqual([
      'minior-core',        // sette varianti di colore, HOME ne tiene una sola
      'terapagos-terastal', // forma di sola battaglia
    ])
  })

  it('le forme del meta chiedono la propria icona, non quella della base', () => {
    expect(formaDi('urshifu-rapid-strike')).toBe('f01')
    expect(formaDi('urshifu')).toBe('f00')
    expect(formaDi('calyrex-ice')).toBe('f01')
    expect(formaDi('calyrex-shadow')).toBe('f02')
    expect(formaDi('landorus-therian')).toBe('f01')
  })

  it('i tre gruppi in cui il nostro ordine non è quello di HOME', () => {
    // Verificati guardando le icone, non chiedendo al server: l'URL esisteva
    // in entrambi i casi, ed è questa la ragione per cui serviva l'occhio.

    // Ogerpon: f01 è la maschera blu (Wellspring), f03 la grigia (Cornerstone)
    expect(formaDi('ogerpon-wellspring')).toBe('f01')
    expect(formaDi('ogerpon-hearthflame')).toBe('f02')
    expect(formaDi('ogerpon-cornerstone')).toBe('f03')

    // Tauros di Paldea: f01 senza segni (Combat), f02 rossi (Blaze), f03 blu (Aqua)
    expect(formaDi('tauros-paldea-combat')).toBe('f01')
    expect(formaDi('tauros-paldea-blaze')).toBe('f02')
    expect(formaDi('tauros-paldea-aqua')).toBe('f03')

    // Pumpkaboo: HOME ordina Average prima di Small
    expect(formaDi('pumpkaboo')).toBe('f00')
    expect(formaDi('pumpkaboo-small')).toBe('f01')
  })

  it('chi non è in tabella ricade su f00, non su un URL rotto', () => {
    // Le Megaevoluzioni inventate da Champions: HOME non ha l'immagine, e
    // mostrare la base è meglio di un'icona che non carica.
    const fuoriTabella = Object.keys(pokemonData)
      .filter(k => !formeSprite.forme[k] && resolveNum(k))
    expect(fuoriTabella.length).toBeGreaterThan(0)
    for (const k of fuoriTabella.slice(0, 40)) {
      expect(formaDi(k), k).toBe('f00')
    }
  })

  it('ogni voce della tabella è una specie che esiste', () => {
    // Una tabella generata può invecchiare: se un rinomino di slug la
    // scollega dai dati, il badge di quella specie tornerebbe muto.
    const fantasmi = Object.keys(formeSprite.forme).filter(k => !pokemonData[k])
    expect(fantasmi, 'voci senza specie corrispondente').toEqual([])
  })

  it('la tabella dichiara come è stata costruita', () => {
    expect(formeSprite.meta.fonte).toContain('pokemon-home')
    expect(formeSprite.meta.metodo).toBeTruthy()
    expect(formeSprite.meta.specieConForma).toBe(Object.keys(formeSprite.forme).length)
  })
})
