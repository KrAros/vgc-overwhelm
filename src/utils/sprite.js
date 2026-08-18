// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/utils/sprite.js
 * Funzioni pure per la risoluzione degli URL sprite di Pokémon HOME.
 *
 * Unica fonte di verità: se il formato URL cambia va aggiornato solo qui.
 *
 * Esporta:
 *   resolveNum(key)         → stringa num a 4 cifre (es. '0006') o null
 *   spriteUrl(key)          → URL primario Pokémon HOME o null
 *   fallbackSpriteUrl(key)  → URL fallback pokemon-zone o null
 */

import pokemonData from '../data/pokemon.json'
import formeSpriteData from '../data/formeSprite.json'

/** Solo la mappa: i metadati della generazione non servono a runtime. */
const formeSprite = formeSpriteData.forme

/**
 * Risolve il numero Pokédex di uno slug, gestendo forme regionali e mega
 * che non hanno un campo `num` proprio e lo ereditano dal base.
 */
export function resolveNum(key) {
  const data = pokemonData[key]
  if (!data) return null
  let num = data.num
  if (!num) {
    const baseName = key
      .replace(/-mega.*$/, '')
      .replace(/-primal$/, '')
      .replace(/-unbound$/, '')
    num = pokemonData[baseName]?.num || ''
  }
  return num?.replace('#', '').padStart(4, '0') || null
}

/**
 * URL primario Pokémon HOME (128px icon).
 *
 * ─── IL SUFFISSO DI FORMA ARRIVA DA UNA TABELLA, NON DA UNA REGOLA ─────────
 * Fino alla sessione L il suffisso era calcolato così:
 *
 *     isMegaY ? 'f02' : (isMegaX || isMega || isAlola) ? 'f01' : 'f00'
 *
 * Solo mega e Alola avevano un suffisso proprio; Hisui, Galar, Paldea,
 * Therian, Origin, i Rider di Calyrex e Urshifu Pluricolpo ricadevano su
 * `f00`, cioè sull'icona della FORMA BASE. Contato: 152 specie su 57 file,
 * quindi almeno 95 mostravano l'immagine di un altro Pokémon — mentre il
 * calcolo usava le statistiche giuste.
 *
 * Adesso il suffisso viene da `formeSprite.json`, generato chiedendo al
 * server quali posizioni esistono (`npm run forme:gen`) e verificato a occhio
 * su un foglio di contatto: l'esistenza dell'URL non prova l'identità della
 * forma, e in tre gruppi — Ogerpon, Tauros di Paldea, Pumpkaboo/Gourgeist —
 * l'ordine dei nostri dati non è quello di HOME.
 *
 * Chi non è in tabella ricade su `f00`, che è il comportamento di prima: sono
 * le 51 Megaevoluzioni inventate da Champions, per cui HOME non ha un'icona.
 */
export function spriteUrl(key) {
  if (!key) return null
  const data = pokemonData[key]
  if (!data) return null
  const num = resolveNum(key)
  if (!num) return null
  const form = formeSprite[key] || 'f00'
  return `https://resource.pokemon-home.com/battledata/img/pokei128/icon${num}_${form}_s0.png`
}

/**
 * URL fallback pokemon-zone, usato in onError quando HOME non risponde.
 */
export function fallbackSpriteUrl(key) {
  const num = resolveNum(key)
  if (!num) return null
  return `https://assets.pokemon-zone.com/champions-assets/uicontents/scriptableobject/mdicon02/mdiconpersonal02/standard02/ui_PokeIcon_02_${num}_01_0.webp`
}
/**
 * URL icona strumento — usa l'index GF (num) da items.json.
 * Item regolari (num < 656) → mdicon01 / ui_ItemIcon_01_XXXX.webp
 * Mega Stone (num >= 656)  → mdicon02 / ui_ItemIcon_02_XXXX.webp
 */
import itemsData from '../data/items.json'

export function itemIconUrl(itemKey) {
  if (!itemKey) return null
  const num = itemsData[itemKey]?.num
  if (!num) return null
  const isMega = itemKey.endsWith('ite') || itemKey.endsWith('ite x') || itemKey.endsWith('ite y')
  const folder = isMega ? 'mdicon02' : 'mdicon01'
  const prefix = isMega ? '02' : '01'
  return `https://assets.pokemon-zone.com/champions-assets/uicontents/scriptableobject/${folder}/ui_ItemIcon_${prefix}_${String(num).padStart(4, '0')}.webp`
}