// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/__tests__/modals.test.jsx
 *
 * `components/editor/Modals.jsx` era a 0% di copertura: nessun test lo
 * importava, né direttamente né dall'albero che renderizza `App`.
 *
 * ─── COSA SORVEGLIA ────────────────────────────────────────────────────────
 *
 * `DuplicateModal` ha una regola che nessuno vede finché non sbaglia: se dopo
 * lo slot di partenza c'è un posto libero, duplica lì SENZA mostrare niente;
 * se non c'è, chiede dove sovrascrivere. Un errore qui o cancella un
 * Pokémon dell'utente senza chiedere, o chiede quando non serve.
 *
 * ─── NIENTE jsdom ──────────────────────────────────────────────────────────
 *
 * Come `puntiSaluteInterfaccia.test.jsx`: si rende in SSR e si guardano il
 * markup e lo store. `DuplicateModal` duplica *durante il render* (è così che è
 * scritto), quindi un solo `renderToStaticMarkup` esercita tutto il percorso.
 *
 * Quel che NON copre, dichiarato: il click sui pulsanti di `ImportModal` e di
 * `DuplicateModal` — richiede un DOM. `handleImport` resta fuori; la sua
 * logica vive in `parseShowdownPaste`, che ha i suoi test.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { caricaLingua } from '../i18n.js'
import { ImportModal, DuplicateModal } from '../components/editor/Modals.jsx'
import { emptyPokemon } from '../store/useCalcStore.js'
import it_ from '../locales/it.json' with { type: 'json' }

/**
 * ─── PERCHÉ LO STORE È FINTO QUI ───────────────────────────────────────────
 *
 * In SSR zustand 5 legge `api.getInitialState()` (react.mjs, terzo argomento di
 * `useSyncExternalStore`), non lo stato corrente: `useCalcStore.setState(...)`
 * non arriva al componente, che vedrebbe sempre sei slot vuoti. E
 * `getInitialState` è una closure di `createStore`, non si può sostituire.
 *
 * Si finge quindi solo il hook — `selettore → stato` — e si osserva il contratto
 * vero di `DuplicateModal`: con quale squadra chiama `setTeam`. `emptyPokemon`
 * resta quello reale.
 */
const mock = vi.hoisted(() => ({ stato: {}, setTeam: null }))
vi.mock('../store/useCalcStore.js', async (importOriginal) => {
  const reale = await importOriginal()
  const useCalcStore = (selettore) => selettore(mock.stato)
  return { ...reale, default: useCalcStore }
})

beforeAll(() => caricaLingua('it'))

const SPECIE = ['pikachu', 'garchomp', 'incineroar', 'rillaboom', 'whimsicott', 'amoonguss']

/** Squadra con gli slot indicati occupati (per indice) e gli altri vuoti. */
function squadra(occupati) {
  return Array.from({ length: 6 }, (_, i) =>
    occupati.includes(i) ? { ...emptyPokemon(), key: SPECIE[i] } : emptyPokemon()
  )
}

function imposta(occupati) {
  mock.setTeam = vi.fn()
  mock.stato = { team1: squadra(occupati), setTeam: mock.setTeam }
}

/** Le chiavi della squadra con cui `setTeam` è stato chiamato (o quella di partenza se mai). */
const chiavi = () => (mock.setTeam.mock.calls.at(-1)?.[1] ?? mock.stato.team1).map(s => s.key)
const squadraScritta = () => mock.setTeam.mock.calls.at(-1)?.[1]

function renderizza(sourceIndex) {
  let chiusure = 0
  const html = renderToStaticMarkup(
    <DuplicateModal team="team1" sourceIndex={sourceIndex} onClose={() => { chiusure++ }} />
  )
  return { html, chiusure: () => chiusure }
}

describe('DuplicateModal — c\'è un posto libero dopo lo slot', () => {
  beforeEach(() => imposta([0]))

  it('duplica nel primo slot libero senza mostrare niente', () => {
    const { html, chiusure } = renderizza(0)
    expect(html).toBe('')
    expect(chiusure()).toBe(1)
    expect(mock.setTeam).toHaveBeenCalledTimes(1)
    expect(mock.setTeam.mock.calls[0][0]).toBe('team1')
    expect(chiavi()).toEqual(['pikachu', 'pikachu', null, null, null, null])
  })

  it('salta gli slot occupati e non ne sovrascrive nessuno', () => {
    imposta([0, 1, 3])
    renderizza(0)
    expect(chiavi()).toEqual(['pikachu', 'garchomp', 'pikachu', 'rillaboom', null, null])
  })

  it('guarda solo DOPO lo slot di partenza, non prima', () => {
    // Slot 0 libero, sorgente in 2, slot 3 libero: finisce in 3.
    imposta([1, 2])
    renderizza(2)
    expect(chiavi()).toEqual([null, 'garchomp', 'incineroar', 'incineroar', null, null])
  })

  it('la copia è indipendente dall\'originale', () => {
    renderizza(0)
    const [a, b] = squadraScritta()
    expect(b).not.toBe(a)
    expect(b.key).toBe(a.key)
    expect(b.moves).toEqual(a.moves)
  })
})

describe('DuplicateModal — la squadra è piena', () => {
  beforeEach(() => imposta([0, 1, 2, 3, 4, 5]))

  it('non tocca la squadra e non chiude finché l\'utente non sceglie', () => {
    const { chiusure } = renderizza(2)
    expect(mock.setTeam).not.toHaveBeenCalled()
    expect(chiusure()).toBe(0)
  })

  it('offre un pulsante per ogni altro slot, e nessuno per quello di partenza', () => {
    const { html } = renderizza(2)
    // Il nome mostrato è la specie capitalizzata via CSS: nel markup c'è il testo.
    for (const specie of ['pikachu', 'garchomp', 'rillaboom', 'whimsicott', 'amoonguss'])
      expect(html).toContain(`>${specie}</span>`)
    expect(html).not.toContain('>incineroar</span>')
    expect((html.match(/<button /g) || []).length).toBe(5 + 1) // 5 slot + Annulla
  })

  it('spiega perché sta chiedendo', () => {
    const { html } = renderizza(2)
    expect(html).toContain(it_.editor.all_slots_full)
    expect(html).toContain(it_.ui.cancel)
  })
})

describe('DuplicateModal — la sorgente è l\'ultimo slot', () => {
  it('chiede anche se più indietro c\'è un posto libero', () => {
    // Lo slot 0 è vuoto, ma `nextEmpty` guarda solo avanti: dallo slot 5 non
    // c'è niente avanti, quindi mostra il selettore. Lo si registra com'è.
    imposta([1, 2, 3, 4, 5])
    const { html, chiusure } = renderizza(5)
    expect(mock.setTeam).not.toHaveBeenCalled()
    expect(chiusure()).toBe(0)
    expect(html).toContain(it_.editor.all_slots_full)
    expect(html).toContain('>P1</span>') // lo slot vuoto si presenta come «P1»
  })
})

describe('ImportModal', () => {
  const renderImport = (props = {}) =>
    renderToStaticMarkup(<ImportModal team="team1" index={0} onClose={() => {}} {...props} />)

  it('ha l\'area di testo e il pulsante Importa', () => {
    const html = renderImport()
    expect(html).toContain('<textarea')
    expect(html).toContain(it_.ui.import_paste_single)
    expect(html).toContain(`✔ ${it_.ui.import}`)
  })

  it('in forma inline offre Annulla e prende il focus', () => {
    const html = renderImport()
    expect(html).toContain('Annulla')
    expect((html.match(/<button /g) || []).length).toBe(2)
  })

  it('sempre aperto non ha Annulla né la cornice', () => {
    const html = renderImport({ alwaysOpen: true })
    expect(html).not.toContain('Annulla')
    expect((html.match(/<button /g) || []).length).toBe(1)
    expect(html).not.toContain('border-gray-700 ">') // niente cornice del contenitore
    expect(html.startsWith('<div class="">')).toBe(true)
  })
})
