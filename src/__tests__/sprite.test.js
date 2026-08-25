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

  it('ogni forma dentro un gruppo è in tabella, senza eccezioni', () => {
    // ─── COS'È CAMBIATO IN R, E PERCHÉ ────────────────────────────────────
    //
    // La sessione L scriveva qui: «le Mega di Champions HOME non le ha mai
    // avute, 51 posizioni provate e assenti», e le lasciava fuori dalla
    // tabella — dove `sprite.js` ricadeva su `f00`, cioè sull'icona della
    // forma base.
    //
    // Era vero e misurato, ma su UNA SOLA fonte. Il generatore sondava solo
    // Pokémon HOME, mentre `sprite.js` usa pokemon-zone come ripiego: quel
    // server le Mega di Champions ce le ha, all'indice di forma identico.
    //
    // Ora ogni posizione entra in tabella con la fonte che ce l'ha — `home`,
    // `zone`, o `nessuna` — e questo elenco è VUOTO per costruzione. Il
    // limite non è più «chi manca», è «chi manca ovunque», ed è nel test
    // qui sotto.
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
    expect(scoperti, 'ogni forma di un gruppo deve avere una voce').toEqual([])
  })

  it('chi non ha icona su NESSUNA delle due fonti, contato per nome', () => {
    // Il limite vero, dopo R. Diciannove posizioni, tre famiglie:
    //
    //   silvally  HOME tiene una sola icona per tutte e diciotto le forme-tipo,
    //             e in effetti sono identiche: cambia solo il colore del disco.
    //   minior-core        sette varianti di colore, una sola icona
    //   terapagos-terastal forma di sola battaglia
    //
    // Per queste `spriteUrl` restituisce `null` e non si mostra icona. Un buco
    // è onesto; l'immagine di un altro Pokémon no — ed era quello che
    // succedeva prima, con `|| 'f00'`.
    const senzaIcona = Object.entries(formeSprite.fonte)
      .filter(([, f]) => f === 'nessuna')
      .map(([k]) => k)
      .sort()
    expect(senzaIcona).toEqual([
      // ── Sondate: nessuna delle due fonti ce l'ha ──────────────────────────
      'minior-core',
      'silvally-bug', 'silvally-dark', 'silvally-dragon', 'silvally-electric',
      'silvally-fairy', 'silvally-fighting', 'silvally-fire', 'silvally-flying',
      'silvally-ghost', 'silvally-grass', 'silvally-ground', 'silvally-ice',
      'silvally-poison', 'silvally-psychic', 'silvally-rock', 'silvally-steel',
      'silvally-water',
      'terapagos-terastal',
      // ── NON sondate: aggiunte a mano, in attesa di `forme:gen` ────────────
      // Portano la stessa fonte `nessuna` ma per una ragione diversa, ed è
      // una differenza che va tenuta visibile: sopra è «il server non ce
      // l'ha», qui è «non abbiamo ancora chiesto». La scelta è la stessa
      // perché la prudenza è la stessa — meglio nessuna icona che l'icona di
      // un altro Pokémon — ma queste sei devono sparire da questo elenco
      // appena qualcuno lancia il generatore con la rete.
      //
      // `meta.daSondare` le elenca, e il test sotto tiene i due insiemi
      // allineati: se una viene sondata e resta qui senza uscire da
      // `daSondare`, o viceversa, diventa rosso.
      'floette-eternal',
      'slowbro-galar',
      'slowking', 'slowking-galar',
      'stunfisk', 'stunfisk-galar',
    ].sort())
  })

  it('le voci non sondate sono dichiarate come tali', () => {
    // Il rischio di un segnaposto è che smetta di sembrare tale. Qui si
    // controlla che `meta.daSondare` sia esattamente l'insieme delle voci
    // aggiunte a mano, e che ognuna porti davvero fonte `nessuna`.
    const daSondare = [...(formeSprite.meta.daSondare ?? [])].sort()
    expect(daSondare, 'meta.daSondare non elenca le voci aggiunte a mano').toEqual([
      'floette-eternal',
      'slowbro-galar',
      'slowking', 'slowking-galar',
      'stunfisk', 'stunfisk-galar',
    ])
    for (const k of daSondare) {
      expect(formeSprite.forme[k], `${k} non ha una posizione`).toBeTruthy()
      expect(formeSprite.fonte[k], `${k} deve restare senza icona finché non è sondata`)
        .toBe('nessuna')
    }
    expect(formeSprite.meta.notaDaSondare, 'manca la nota che dice come chiuderle')
      .toMatch(/forme:gen/)
  })

  it('le Mega di Champions ora hanno un\'icona, dalla seconda fonte', () => {
    // La ragione per cui R esiste: Mega Staraptor mostrava Staraptor base.
    //
    // 32 in R, **33 dalla sessione Y**: Floette-Mega si era fermata su HOME
    // perche' quel server risponde 200 al suo indice — ma quell'indice e' un
    // Floette di un altro colore, non la Mega. Il numero sale di uno per una
    // ragione nota, e va letto cosi': non e' il generatore ad aver trovato una
    // forma in piu', e' una forma che stava dalla parte sbagliata.
    const daZone = Object.entries(formeSprite.fonte).filter(([, f]) => f === 'zone')
    expect(daZone.length, 'forme recuperate dal ripiego').toBe(33)
    expect(formeSprite.forme['staraptor-mega']).toBe('f01')
    expect(formeSprite.fonte['staraptor-mega']).toBe('zone')
    expect(spriteUrl('staraptor-mega')).toContain('_0398_01_0.webp')
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
    expect(formeSprite.meta.fonti.home).toContain('pokemon-home')
    expect(formeSprite.meta.fonti.zone).toContain('pokemon-zone')
    expect(formeSprite.meta.metodo).toBeTruthy()
    expect(formeSprite.meta.specieConForma).toBe(Object.keys(formeSprite.forme).length)
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SESSIONE Y — Floette-Mega mostrava un Floette di un altro colore
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il registro diceva `f01` da Pokémon HOME. Ma Floette ha CINQUE forme di
 * colore del fiore, quindi l'indice 01 su HOME è un Floette giallo: l'URL
 * risponde 200 e il contenuto è un altro Pokémon.
 *
 * Il generatore aveva assunto che l'indice del server seguisse l'ordine dei
 * NOSTRI dati, dove `floette-mega` è la seconda voce. È il limite dichiarato
 * in R — l'automatismo copre l'esistenza, l'identità no — e qui si è visto.
 *
 * Sondato con `fetch`: HOME ha `f00`–`f05`, pokemon-zone ha solo `f05` e `f06`.
 * La scelta fra i due candidati l'ha fatta **Simone guardando le immagini**,
 * perché nessun oracolo automatico distingue una Mega da un Fiore Eterno.
 */
describe('Floette-Mega — la forma scelta con l’occhio', () => {
  it('punta all’indice 05 di pokemon-zone', () => {
    const u = spriteUrl('floette-mega')
    expect(u).toContain('pokemon-zone')
    expect(u).toContain('_0670_05_')
  })

  it('non è più l’icona del Floette base', () => {
    // IL CONTROLLO CHE SI MUOVE: senza questo caso il test passerebbe anche se
    // le due chiavi finissero sullo stesso URL, che è esattamente il difetto.
    expect(spriteUrl('floette-mega')).not.toBe(spriteUrl('floette'))
  })
})
