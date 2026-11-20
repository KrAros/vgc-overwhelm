// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/presetSelect.test.jsx
 *
 * `editor/PresetSelect.jsx` era al 28% di copertura. Qui si guarda quello che
 * l'utente vede nella tendina dei set: quali voci, in che ordine, quale è
 * selezionata.
 *
 * ─── COSA SORVEGLIA ────────────────────────────────────────────────────────
 *
 *   · una voce per ogni set meta della specie, filtrati per la reg scelta;
 *   · i set di un'altra reg NON compaiono (un set di un periodo che non si sta
 *     giocando è un consiglio sbagliato presentato come giusto);
 *   · i set personalizzati salvati dall'utente, sotto «★ Custom»;
 *   · la voce selezionata deriva dallo slot corrente (item + ability + nature),
 *     non da uno stato interno: dopo un import il menu deve dire la verità.
 *
 * Niente jsdom (vedi `modals.test.jsx`): si rende in SSR con gli store reali.
 * `useReg` e `useCalcStore` in SSR leggono lo stato iniziale — la reg è quella
 * che il progetto sceglie da solo: la più recente con dei set.
 *
 * Non copre: il `change` della tendina e `applyPreset`, che richiedono un DOM.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { caricaLingua } from '../i18n.js'
import PresetSelect from '../components/editor/PresetSelect.jsx'
import { META_PRESETS, PRESETS_BY_SLUG } from '../data/metaPresets.js'
import useReg from '../store/useReg.js'
import it_ from '../locales/it.json' with { type: 'json' }

beforeAll(() => caricaLingua('it'))

const REG = useReg.getState().reg
const SLUG_CON_PIU_SET = Object.keys(PRESETS_BY_SLUG).find(s => PRESETS_BY_SLUG[s].length > 1)
const SOLO_ALTRA_REG = META_PRESETS.find(p => p.reg !== REG && !PRESETS_BY_SLUG[p.slug].some(q => q.reg === REG))

const render = (props = {}) => renderToStaticMarkup(
  <PresetSelect team="team1" index={0} currentSlug={null} currentSlot={null} {...props} />
)
const opzioni = (html) => [...html.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)]
  .map(m => ({ valore: m[1], testo: m[2] }))
const decodifica = s => s.replaceAll('&#x27;', "'").replaceAll('&amp;', '&')

describe('i dati di partenza servono davvero', () => {
  // Un test che scorre un elenco passa anche con l'elenco vuoto.
  it('c\'è una specie con più set e un set di un\'altra reg', () => {
    expect(SLUG_CON_PIU_SET).toBeTruthy()
    expect(SOLO_ALTRA_REG).toBeTruthy()
  })
})

describe('set meta', () => {
  it('senza specie c\'è solo «Set vuoto»', () => {
    const o = opzioni(render())
    expect(o).toEqual([{ valore: '__blank__', testo: it_.ui.blank_set }])
  })

  it('una specie con più set li elenca tutti, dopo «Set vuoto»', () => {
    const attesi = PRESETS_BY_SLUG[SLUG_CON_PIU_SET].filter(p => p.reg === REG)
    const o = opzioni(render({ currentSlug: SLUG_CON_PIU_SET }))
    expect(o[0].valore).toBe('__blank__')
    expect(o.slice(1).map(x => decodifica(x.testo))).toEqual(attesi.map(p => p.label))
    expect(o.length).toBe(1 + attesi.length)
  })

  it('la chiave di ogni voce è «reg|etichetta»', () => {
    const o = opzioni(render({ currentSlug: SLUG_CON_PIU_SET }))
    for (const p of PRESETS_BY_SLUG[SLUG_CON_PIU_SET].filter(p => p.reg === REG))
      expect(o.map(x => decodifica(x.valore))).toContain(`${p.reg}|${p.label}`)
  })

  it('un set che esiste solo in un\'altra reg non compare', () => {
    const o = opzioni(render({ currentSlug: SOLO_ALTRA_REG.slug }))
    expect(o).toEqual([{ valore: '__blank__', testo: it_.ui.blank_set }])
  })

  it('con una reg sola scelta l\'etichetta non ripete la sigla', () => {
    const html = render({ currentSlug: SLUG_CON_PIU_SET })
    expect(html).not.toContain(` · ${REG}`)
  })
})

describe('voce selezionata', () => {
  const preset = PRESETS_BY_SLUG[SLUG_CON_PIU_SET].find(p => p.reg === REG)
  const slotDi = (p) => ({ key: p.slug, item: p.item, ability: p.ability,
    nature: p.nature.toLowerCase(), sps: p.sps, moves: p.moves })

  it('è «Set vuoto» se lo slot è vuoto', () => {
    const html = render({ currentSlug: SLUG_CON_PIU_SET, currentSlot: null })
    expect(html).toMatch(/<option value="__blank__" selected="">/)
  })

  it('è il set meta che lo slot rispecchia', () => {
    const html = render({ currentSlug: SLUG_CON_PIU_SET, currentSlot: slotDi(preset) })
    const scelta = [...html.matchAll(/<option value="([^"]*)" selected="">/g)].map(m => decodifica(m[1]))
    expect(scelta).toEqual([`${preset.reg}|${preset.label}`])
  })

  it('torna a «Set vuoto» se lo slot non coincide con nessun set', () => {
    const slot = { ...slotDi(preset), item: 'oggetto-inesistente' }
    const html = render({ currentSlug: SLUG_CON_PIU_SET, currentSlot: slot })
    expect(html).toMatch(/<option value="__blank__" selected="">/)
  })
})

describe('set personalizzati', () => {
  const slug = SLUG_CON_PIU_SET
  const custom = { id: 'abc123', label: 'Il mio set', item: 'sitrus berry',
    ability: 'rough skin', nature: 'adamant', sps: [0, 32, 0, 0, 0, 0], moves: ['protect', null, null, null] }

  afterEach(() => { delete globalThis.localStorage })

  const conSalvati = (tutti) => {
    globalThis.localStorage = { getItem: () => JSON.stringify(tutti), setItem() {} }
  }

  it('compaiono in un gruppo «★ Custom» dopo i set meta', () => {
    conSalvati({ [slug]: [custom] })
    const html = render({ currentSlug: slug })
    expect(html).toContain('<optgroup label="★ Custom">')
    expect(html).toContain('value="custom:abc123"')
    expect(html.indexOf('<optgroup')).toBeGreaterThan(html.lastIndexOf(`${REG}|`))
  })

  it('quelli di un\'altra specie non compaiono', () => {
    conSalvati({ altra: [custom] })
    expect(render({ currentSlug: slug })).not.toContain('optgroup')
  })

  it('un salvataggio corrotto non rompe la tendina', () => {
    globalThis.localStorage = { getItem: () => '{non json', setItem() {} }
    expect(opzioni(render({ currentSlug: slug })).length).toBeGreaterThan(1)
  })

  it('lo slot che rispecchia un set personalizzato lo seleziona', () => {
    conSalvati({ [slug]: [custom] })
    const slot = { key: slug, item: custom.item, ability: custom.ability,
      nature: custom.nature, sps: custom.sps, moves: custom.moves }
    const html = render({ currentSlug: slug, currentSlot: slot })
    expect(html).toContain('value="custom:abc123" selected=""')
  })
})
