/**
 * src/__tests__/sondaForme.test.js
 *
 * Che la sonda delle forme in attesa chieda gli STESSI indirizzi che l'app
 * userà poi per mostrare l'icona.
 *
 * ─── PERCHE' SERVE ─────────────────────────────────────────────────────────
 *
 * `gen-forme-sonda.mjs` produce un foglio di contatto: qualcuno guarda le
 * immagini e decide quale indice è la forma giusta. Se la sonda costruisse un
 * indirizzo diverso da quello di `sprite.js`, quella persona guarderebbe
 * un'immagine e ne verrebbe pubblicata un'altra — e il difetto sarebbe
 * invisibile, perché entrambe le parti «funzionano».
 *
 * È lo stesso schema del resto del repository: due strade indipendenti verso
 * lo stesso URL, e un test che le confronta invece di fidarsi.
 */

import { describe, it, expect } from 'vitest'
import { urlHome, urlZone } from '../../scripts/gen-forme-sonda.mjs'
import { spriteUrl, resolveNum } from '../utils/sprite.js'
import formeSprite from '../data/formeSprite.json' with { type: 'json' }

describe('la sonda chiede gli stessi indirizzi dell\'app', () => {
  it('coincide su ogni forma già in tabella con una fonte', () => {
    const diverse = []
    for (const [chiave, forma] of Object.entries(formeSprite.forme)) {
      const fonte = formeSprite.fonte[chiave]
      if (fonte !== 'home' && fonte !== 'zone') continue   // `nessuna`: non c'è URL
      const atteso = spriteUrl(chiave)
      if (!atteso) continue
      const num = resolveNum(chiave)
      const dallaSonda = fonte === 'zone' ? urlZone(num, forma) : urlHome(num, forma)
      if (dallaSonda !== atteso) diverse.push(`${chiave}: sonda ${dallaSonda} ≠ app ${atteso}`)
    }
    expect(diverse.slice(0, 5), 'la sonda mostrerebbe un\'immagine e l\'app un\'altra').toEqual([])
  })

  it('controllo negativo: il confronto guarda davvero qualcosa', () => {
    // Senza, il test sopra passerebbe anche con zero forme confrontate — per
    // un filtro sbagliato o una tabella vuota.
    const conFonte = Object.values(formeSprite.fonte).filter(f => f === 'home' || f === 'zone')
    expect(conFonte.length, 'nessuna forma da confrontare').toBeGreaterThan(300)

    // E due indirizzi diversi devono risultare diversi, altrimenti il
    // confronto sopra non potrebbe fallire mai.
    expect(urlHome('0398', 'f01')).not.toBe(urlZone('0398', 'f01'))
  })

  it('l\'indirizzo di `zone` è quello che sprite.test.js già fissa', () => {
    // Ancoraggio a un caso noto e verificato a occhio nella sessione R.
    expect(urlZone('0398', 'f01')).toContain('_0398_01_0.webp')
  })
})
