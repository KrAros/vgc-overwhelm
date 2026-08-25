// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/gen-layout.mjs
 *
 * Genera `docs/misure-layout.json`: quanti difetti di layout ha l'app su uno
 * schermo da telefono, contati nel DOM invece che guardati in foto.
 *
 * Uso:
 *   npm run layout:gen      misura e scrive
 *   npm run layout:report   misura e stampa, senza scrivere
 *
 * ═══ PERCHÉ NON BASTA UNO SCREENSHOT ══════════════════════════════════════
 *
 * I quattro difetti di P-2 arrivano da fotografie fatte a mano. Una foto prova
 * com'era quel giorno e non impedisce il ritorno del difetto. Tre dei quattro
 * però sono PROPRIETÀ CALCOLABILI, non impressioni:
 *
 *   testo troncato         scrollWidth > clientWidth
 *   pagina che scorre      documentElement.scrollWidth > innerWidth
 *   bersagli che si toccano  distanza fra i rettangoli di due interattivi
 *
 * Il quarto — la matrice che scorre senza dichiararlo — non lo è: è
 * un'affordance mancante, e nessuna proprietà del DOM dice «l'utente non
 * capisce». Quello resta all'occhio, dichiarato.
 *
 * Serve un motore di layout vero: jsdom non calcola geometrie. Da qui
 * `puppeteer-core`, che è dichiarato in devDependencies ma era GIÀ su disco —
 * lo tira dentro Lighthouse. Dichiararlo costa una riga di lockfile e zero
 * download, ma trasforma una coincidenza in una promessa.
 *
 * ═══ LA CECITÀ CHE HA QUASI FREGATO QUESTA SESSIONE ═══════════════════════
 *
 * La prima sonda misurava la pagina d'ingresso e trovava ZERO difetti — con
 * le foto di Simone aperte accanto che ne mostravano quattro.
 *
 * Non erano le foto a sbagliare: all'avvio i due team sono VUOTI e il
 * `ReportPanel` non esiste (`reportSelection && ...` in App.jsx). I difetti
 * vivono in stati che la pagina d'ingresso non mostra mai.
 *
 * Perciò si misurano SCENARI, e ogni scenario porta il proprio controllo: se
 * lo stato non si è attivato la misura è cieca, e il generatore lo dice invece
 * di scrivere uno zero rassicurante.
 *
 * ═══ E LA LINGUA È UNA VARIABILE, NON UN CONTORNO ═════════════════════════
 *
 * Le foto dicevano `Lanciafia` e `Natura (N`: erano in ITALIANO. Il
 * troncamento dipende dalla lunghezza delle stringhe, e «Lanciafiamme» è più
 * lungo di «Flamethrower». Misurare solo l'inglese — che è la lingua di
 * partenza dell'app — vedrebbe meno difetti di quanti ce ne sono.
 *
 * L'italiano si carica in modo ASINCRONO (`caricaLingua` in i18n.js), quindi
 * anche lì serve un controllo: senza aspettare, si misurerebbe l'inglese
 * credendo di misurare l'italiano.
 *
 * ═══ LE ESCLUSIONI SONO DUE, E SI CONTANO ═════════════════════════════════
 *
 * Due categorie di elementi hanno `scrollWidth > clientWidth` per costruzione
 * e non sono difetti:
 *
 *   1. i contenitori con `overflow-x: auto|scroll` — scorrono APPOSTA
 *   2. gli elementi nascosti alla `sr-only`, larghi 1 px
 *
 * Un controllo che si rende verde escludendo casi è il modo più facile di
 * costruire una bugia. Perciò le esclusioni sono due, nominate, e il conteggio
 * di quante ne sono state applicate finisce nel registro: se un domani sono
 * otto, il numero è truccato e si vede.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIVI = !process.argv.includes('--report')
const PORTA = 4173
const URL = `http://localhost:${PORTA}/vgc-overwhelm/`
/**
 * Il percorso di Chrome era fisso su `/usr/bin/google-chrome`, e questo
 * rendeva lo strumento ineseguibile ovunque il browser stia altrove — dove
 * non c'e' quel file, `layout:report` muore prima di misurare qualsiasi cosa,
 * cioe' proprio quando servirebbe. Con la variabile il valore di prima resta
 * il predefinito e non cambia niente per chi lo lanciava gia'.
 */
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome'

/** 360 px: la larghezza Android più diffusa.
 *
 *  Una sola larghezza basta, e non è una scorciatoia: il breakpoint `sm:` di
 *  Tailwind non è personalizzato, quindi vale 640 px. 360, 412 e i 570 delle
 *  foto di Simone stanno TUTTI sotto, cioè renderizzano lo stesso ramo di
 *  layout — e 360 è il più stretto dei tre. */
const LARGHEZZA = 360
const ALTEZZA = 800

// ─── La semina ───────────────────────────────────────────────────────────────
/** Stessa forma usata da `prestazioni.test.jsx`, che è collaudata: la chiave
 *  `vgc-overwhelm-teams` è l'unica via d'ingresso che lo store legge all'avvio.
 *  Squadra meta vera, con i nomi lunghi — sono quelli che rompono il layout. */
const slot = (key, moves) => ({
  key, moves,
  sps: [4, 4, 4, 4, 4, 4],
  nature: 'adamant', ability: null, item: null,
  atkBoost: 0, defBoost: 0, spAtkBoost: 0, spDefBoost: 0, speBoost: 0,
  abilityFlags: {}, lastRespectsKOs: 0,
})
// ─── PERCHÉ `last respects` FRA LE MOSSE ───────────────────────────────────
//
// Con questa mossa in squadra l'editor mostra la striscia viola del contatore
// di alleati caduti (`SlotEditor.jsx:399`), che è l'unico punto dell'interfaccia
// dove compare quell'etichetta. Senza, il riquadro non viene mai renderizzato e
// il banco non può vederlo.
//
// Se ne è accorto in AA: la sessione Y aveva ALLUNGATO quell'etichetta in
// italiano — «Omaggio ai KO — Alleati caduti:» contro «Last Respects — Alleati
// KO:» — e la misura successiva aveva dato zero senza poter vedere niente.
// Stessa forma della cecità su Coleottero, trovata in W.
const MOSSE_1 = ['flamethrower', 'earthquake', 'rock slide', 'last respects']
// ─── PERCHÉ VOLCARONA E `bug buzz` ─────────────────────────────────────────
//
// In italiano il tipo Coleottero si scrive con la parola più lunga delle due
// lingue: dieci caratteri contro gli otto di «Ghiaccio» e «Folletto», dentro
// badge stretti e in maiuscolo. È il caso peggiore per il testo tagliato.
//
// Prima della sessione W nessuna delle dodici specie e nessuna delle otto mosse
// era di tipo Coleottero: la misura non poteva vedere il caso peggiore, e i suoi
// zeri erano una sonda cieca. Il campo `coleottero_a_schermo`, più sotto, ora lo
// registra invece di darlo per scontato — ed è `false` nello scenario vuoto e in
// inglese, cioè distingue davvero.
const MOSSE_2 = ['shadow ball', 'dark pulse', 'bug buzz', 'thunderbolt']
const SQUADRE = {
  team1: ['garchomp', 'incineroar', 'rillaboom', 'amoonguss', 'dragonite', 'flutter-mane'].map((k) => slot(k, MOSSE_1)),
  team2: ['gholdengo', 'chi-yu', 'kingambit', 'volcarona', 'ogerpon', 'urshifu'].map((k) => slot(k, MOSSE_2)),
}

// ─── Gli scenari ─────────────────────────────────────────────────────────────
/** Ogni scenario dichiara il proprio CONTROLLO: una condizione che deve
 *  risultare vera nella pagina, altrimenti lo stato non si è attivato e la
 *  misura non vale niente. */
const SCENARI = [
  {
    nome: 'vuoto',
    descrizione: 'la pagina come la trova chi arriva la prima volta',
    semina: false,
    controllo: { descrizione: 'nessun nome di Pokémon nel documento', prova: () => !document.body.innerText.includes('Garchomp') },
  },
  {
    nome: 'squadra',
    descrizione: 'due squadre meta caricate — editor e matrice pieni',
    semina: true,
    controllo: { descrizione: 'Garchomp compare nel documento', prova: () => document.body.innerText.includes('Garchomp') },
  },
  {
    nome: 'rapporto',
    descrizione: 'squadre caricate e una cella cliccata — il ReportPanel esiste',
    semina: true,
    click: '[role="grid"] [role="button"]',
    // In tutta l'app c'è UNA sola <section>, ed è la radice del ReportPanel
    // (ReportPanel.jsx:1001). Controllo preciso, e verificabile: `pannello`
    // qui sotto lo registra in OGNI scenario, così si vede che compare solo
    // qui invece di doverlo credere.
    controllo: { descrizione: 'il ReportPanel è montato (unica <section>)', prova: () => Boolean(document.querySelector('section')) },
  },
]

const LINGUE = ['en', 'it']

// ─── La misura, eseguita dentro la pagina ────────────────────────────────────
/** Gira nel contesto del browser: qui `document` esiste davvero e le
 *  geometrie sono quelle calcolate dal motore di layout. */
function misuraNellaPagina() {
  const INTERATTIVI = 'button, select, a[href], [role="button"], input, textarea'
  const visibile = (e) => e.getClientRects().length > 0
  const scheda = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className || '').slice(0, 60)}`

  // ── 1. testo tagliato ──────────────────────────────────────────────────────
  /** «Tagliato» vuol dire che il contenuto è NASCOSTO, non solo che sborda.
   *
   *  La prima versione contava `scrollWidth > clientWidth` e basta, e i primi
   *  quattro risultati erano `html`, `body`, `#root` e il div radice: ogni
   *  ANTENATO di un elemento che sborda soddisfa quella condizione. Il
   *  conteggio saliva a 71 senza indicare un solo difetto vero.
   *
   *  Discrimina `overflow-x`:
   *    hidden | clip   il contenuto è tagliato via — DIFETTO, illeggibile
   *    auto | scroll   scorre apposta — escluso, e contato
   *    visible         sborda ma si legge; semmai fa scorrere la pagina,
   *                    che è la misura 2 e si conta lì
   *
   *  Senza questa distinzione il numero è grande e non vuol dire niente. */
  const esclusioni = { contenitori_scorrevoli: 0, nascosti_1px: 0, sbordano_ma_visibili: 0 }
  /* I nodi della terza categoria, non solo il loro numero.
   *
   * «Sborda ma si legge» li scartava perche' al massimo fanno scorrere la
   * pagina, che e' la misura 2. Non e' sempre vero: un contenitore con
   * `min-w-0` accanto a un fratello `shrink-0` sborda, NON fa scorrere la
   * pagina, e finisce sotto il fratello. E' successo davvero — il selettore
   * della stagione ha schiacciato il marchio da 133 px a 61, cioe' «The
   * Sixt», e il conteggio e' passato da 0 a 1 mentre tutte le altre misure
   * restavano identiche.
   *
   * Il numero bastava a vederlo, il posto in cui era stampato no: usciva in
   * fondo alla riga «esclusi», che si legge come rumore. Elencare i nodi
   * costa poco e trasforma un conteggio in un indizio utilizzabile. */
  const sbordanti = []
  const tagliati = []
  for (const e of document.querySelectorAll('*')) {
    if (!visibile(e)) continue
    if (e.scrollWidth <= e.clientWidth + 1) continue          // 1 px di tolleranza: arrotondamenti
    const s = getComputedStyle(e)
    if (s.overflowX === 'auto' || s.overflowX === 'scroll') { esclusioni.contenitori_scorrevoli++; continue }
    if (e.clientWidth <= 1 || e.clientHeight <= 1) { esclusioni.nascosti_1px++; continue }
    if (s.overflowX !== 'hidden' && s.overflowX !== 'clip') {
      esclusioni.sbordano_ma_visibili++
      sbordanti.push({
        nodo: scheda(e), scroll: e.scrollWidth, visibile: e.clientWidth,
        testo: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      })
      continue
    }
    tagliati.push({
      nodo: scheda(e), scroll: e.scrollWidth, visibile: e.clientWidth,
      ellissi: s.textOverflow === 'ellipsis',
      testo: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    })
  }

  // ── 2. la pagina scorre lateralmente ───────────────────────────────────────
  const doc = document.documentElement
  const scorrimento = doc.scrollWidth - doc.clientWidth

  // ── 3. bersagli che si toccano ─────────────────────────────────────────────
  /** Due elementi interattivi sulla stessa riga a meno di 8 px l'uno
   *  dall'altro: il pollice non riesce a scegliere. Si confrontano solo le
   *  coppie che si sovrappongono in verticale, altrimenti «vicini» sarebbe
   *  qualunque cosa incolonnata. */
  const rett = [...document.querySelectorAll(INTERATTIVI)]
    .filter(visibile)
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0)

  /** WCAG 2.5.8 «Target Size (Minimum)», livello AA.
   *
   *  La prima versione usava una soglia MIA: «due interattivi a meno di 8 px».
   *  Dava 93 coppie, quasi tutte gruppi di bottoni uniti apposta — un numero
   *  grande e inutilizzabile. Restringerlo avrebbe voluto dire insegnare al
   *  generatore a riconoscere l'intenzione del progettista, cioè indovinare.
   *
   *  Lo standard risolve il problema senza indovinare:
   *
   *    un bersaglio è conforme se è almeno 24×24 px, OPPURE se un cerchio di
   *    24 px di diametro centrato sul suo rettangolo non interseca nessun
   *    altro bersaglio né il cerchio di un altro bersaglio sottodimensionato.
   *
   *  Così un gruppo di bottoni attaccati passa da solo quando i bottoni sono
   *  abbastanza grandi, e nessuna euristica sull'intenzione serve più.
   *
   *  Non sono implementate le eccezioni della norma (bersagli in linea dentro
   *  un testo, controlli del browser, casi «essenziali»): il numero è quindi
   *  una SOPRASTIMA, ed è dichiarato tale. Il riscontro è che Lighthouse
   *  implementa lo stesso audit — `target-size` — quindi i due numeri si
   *  confrontano: divergere di molto vuol dire che uno dei due sbaglia. */
  const RAGGIO = 12
  const centro = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
  const sottodim = rett.filter(({ r }) => r.width < 24 || r.height < 24)

  const violazioni = []
  for (const s of sottodim) {
    const c = centro(s.r)
    for (const altro of rett) {
      if (altro === s) continue
      const o = altro.r
      // distanza fra il centro del cerchio e il rettangolo dell'altro bersaglio
      const dx = Math.max(o.left - c.x, 0, c.x - o.right)
      const dy = Math.max(o.top - c.y, 0, c.y - o.bottom)
      const dist = Math.hypot(dx, dy)
      const limite = (altro.r.width < 24 || altro.r.height < 24) ? RAGGIO * 2 : RAGGIO
      const rifDist = limite === RAGGIO * 2 ? Math.hypot(c.x - centro(o).x, c.y - centro(o).y) : dist
      if (rifDist < limite) {
        violazioni.push({
          nodo: scheda(s.e), w: Math.round(s.r.width), h: Math.round(s.r.height),
          confligge: scheda(altro.e), distanza: +rifDist.toFixed(1),
        })
        break                       // una violazione per bersaglio, non per coppia
      }
    }
  }

  // ── 3b. tendine il cui testo scelto non ci sta ─────────────────────────────
  /** CRITERIO AGGIUNTO A META SESSIONE, perché il primo non vedeva il difetto 1.
   *
   *  Un <select> taglia da sé il testo dell'opzione scelta: il browser lo
   *  clippa internamente e `scrollWidth` resta uguale a `clientWidth`. La
   *  misura 1 gli passa accanto senza vederlo.
   *
   *  Portando i 48 «tagliati» a zero avrei quindi dichiarato il layout a posto
   *  con «Set v» e «Natura (N» ancora sullo schermo — esattamente i difetti
   *  fotografati da Simone.
   *
   *  Si misura confrontando la larghezza del testo scelto, resa con lo stesso
   *  font del controllo, con lo spazio disponibile. I 20 px sottratti sono la
   *  freccia più il padding: è una stima dichiarata, non una misura, e rende il
   *  conteggio leggermente prudente invece che generoso. */
  const tendineStrette = []
  for (const s of document.querySelectorAll('select')) {
    const r = s.getBoundingClientRect()
    if (!r.width) continue
    const scelto = s.options[s.selectedIndex]?.text ?? ''
    const metro = document.createElement('span')
    const cs = getComputedStyle(s)
    metro.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font};letter-spacing:${cs.letterSpacing}`
    metro.textContent = scelto
    document.body.appendChild(metro)
    const serve = metro.getBoundingClientRect().width
    metro.remove()
    const spazio = r.width - 20
    if (serve > spazio) {
      tendineStrette.push({ nodo: scheda(s), serve: Math.round(serve), spazio: Math.round(spazio), testo: scelto })
    }
  }

  // ── 4. bersagli sotto i 44 px ──────────────────────────────────────────────
  /** Misurato ma FUORI SCOPE per P-2: non è uno dei quattro difetti. Si
   *  registra perché costa zero ed è la base per una sessione futura. */
  const piccoli = rett
    .filter(({ r }) => r.width < 44 || r.height < 44)
    .map(({ e, r }) => ({ nodo: scheda(e), w: Math.round(r.width), h: Math.round(r.height) }))

  return {
    tagliati: { quanti: tagliati.length, nodi: tagliati.slice(0, 12) },
    sbordanti: { quanti: sbordanti.length, nodi: sbordanti.slice(0, 12) },
    scorrimento_pagina_px: scorrimento,
    tendine_strette: { quanti: tendineStrette.length, nodi: tendineStrette.slice(0, 8) },
    wcag_258: { quanti: violazioni.length, sottodimensionati: sottodim.length, nodi: violazioni.slice(0, 8) },
    piccoli_fuori_scope: { quanti: piccoli.length, nodi: piccoli.slice(0, 6) },
    esclusioni,
    // Registrato perché due misure mie si contraddicevano e non volevo
    // decidere a mente quale avesse ragione.
    viewport: { innerWidth, htmlClientWidth: doc.clientWidth, htmlScrollWidth: doc.scrollWidth },
    pannello_rapporto: Boolean(document.querySelector('section')),
    // Stessa ragione di `pannello_rapporto`: senza questo campo uno zero in
    // «testo tagliato» non distingue «non taglia» da «non c'è». Il tipo
    // Coleottero è il nome di tipo più lungo delle due lingue (10 caratteri
    // contro 8), ed è entrato negli scenari con `volcarona` in squadra proprio
    // per essere misurato. Vale solo in italiano, quindi in inglese resta
    // `false` per costruzione — non è un difetto, è che quella parola lì non
    // esiste. Se un giorno Volcarona esce dalla squadra seminata, il campo va
    // a `false` anche in italiano e si vede che la misura è tornata cieca.
    //
    // Il primo tentativo cercava anche «Bug», e in inglese lo soddisfaceva il
    // NOME della mossa Bug Buzz invece del badge del tipo: un controllo che si
    // accende per la ragione sbagliata è peggio di nessun controllo.
    coleottero_a_schermo: /\b(COLEOTTERO|Coleottero)\b/.test(document.body.innerText),
    // Stessa ragione: registra che la striscia di Last Respects sia davvero a
    // schermo, invece di lasciarlo credere. Si cerca la CLASSE e non il testo,
    // perché l'etichetta cambia con la lingua ed è proprio quella sotto esame.
    striscia_last_respects: [...document.querySelectorAll('*')]
      .some((e) => String(e.className || '').includes('bg-purple-950/30')),
    // Diagnostico: QUALI nomi di tipo sono a schermo. Serve a distinguere
    // «il badge del tipo non c'è in questo scenario» da «c'è ma non è
    // Coleottero» — due cecità diverse che uno `false` da solo confonde.
    tipi_a_schermo: [...new Set((document.body.innerText.match(/\b(NORMALE|FUOCO|ACQUA|ELETTRO|ERBA|GHIACCIO|LOTTA|VELENO|TERRA|VOLANTE|PSICO|COLEOTTERO|ROCCIA|SPETTRO|DRAGO|BUIO|ACCIAIO|FOLLETTO|NORMAL|FIRE|WATER|ELECTRIC|GRASS|ICE|FIGHTING|POISON|GROUND|FLYING|PSYCHIC|BUG|ROCK|GHOST|DRAGON|DARK|STEEL|FAIRY)\b/gi) || []))].slice(0, 12),
    nodi_totali: document.querySelectorAll('*').length,
  }
}

// ─── L'anteprima ─────────────────────────────────────────────────────────────
async function conAnteprima(fn) {
  if (!fs.existsSync(path.join(RADICE, 'dist/index.html'))) {
    console.error('dist/ assente: lancia `npm run build` prima.')
    process.exit(1)
  }
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort'], {
    cwd: RADICE, stdio: 'ignore', detached: true,
  })
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(URL)).ok) break } catch { /* non ancora in ascolto */ }
      await new Promise((r) => setTimeout(r, 250))
    }
    return await fn()
  } finally {
    try { process.kill(-p.pid) } catch { /* già morto */ }
  }
}

// ─── Il giro ─────────────────────────────────────────────────────────────────
const misure = []

await conAnteprima(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  })
  try {
    for (const lingua of LINGUE) {
      for (const sc of SCENARI) {
        const pagina = await browser.newPage()
        await pagina.setViewport({ width: LARGHEZZA, height: ALTEZZA, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

        // La semina deve avvenire PRIMA che l'app parta: lo store legge
        // localStorage all'import, non dopo.
        await pagina.evaluateOnNewDocument((semina, squadre, lingua) => {
          localStorage.setItem('lang', lingua)
          if (semina) localStorage.setItem('vgc-overwhelm-teams', JSON.stringify(squadre))
          else localStorage.removeItem('vgc-overwhelm-teams')
        }, sc.semina, SQUADRE, lingua)

        await pagina.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })

        // L'italiano arriva in modo asincrono: si aspetta che sia DAVVERO
        // applicato, invece di sperare che 500 ms bastino.
        const linguaOk = await pagina
          .waitForFunction((l) => document.documentElement.lang === l, { timeout: 5000 }, lingua)
          .then(() => true, () => false)

        if (sc.click) {
          await pagina.click(sc.click).catch(() => {})
          await new Promise((r) => setTimeout(r, 600))
        }

        const controlloOk = await pagina.evaluate(sc.controllo.prova).catch(() => false)
        const dati = await pagina.evaluate(misuraNellaPagina)

        misure.push({
          scenario: sc.nome,
          descrizione: sc.descrizione,
          lingua,
          larghezza: LARGHEZZA,
          controllo: { descrizione: sc.controllo.descrizione, esito: controlloOk ? 'attivo' : 'NON ATTIVATO — misura cieca' },
          lingua_applicata: linguaOk ? 'sì' : 'NO — misurata la lingua sbagliata',
          ...dati,
        })
        await pagina.close()
      }
    }
  } finally {
    await browser.close()
  }
})

// ─── Stampa ──────────────────────────────────────────────────────────────────
let cieche = 0
for (const m of misure) {
  const guaio = m.controllo.esito !== 'attivo' || m.lingua_applicata !== 'sì'
  if (guaio) cieche++
  console.log(`\n── ${m.scenario} · ${m.lingua} · ${m.larghezza}px${guaio ? '   !! ' + m.controllo.esito + ' / lingua ' + m.lingua_applicata : ''}`)
  console.log(`   testo tagliato        ${String(m.tagliati.quanti).padStart(3)}`)
  console.log(`   scorrimento pagina    ${String(m.scorrimento_pagina_px).padStart(3)} px`)
  console.log(`   tendine strette       ${String(m.tendine_strette.quanti).padStart(3)}`)
  console.log(`   WCAG 2.5.8 violati    ${String(m.wcag_258.quanti).padStart(3)}   (su ${m.wcag_258.sottodimensionati} sottodimensionati)`)
  console.log(`   sotto 44px (f.scopo)  ${String(m.piccoli_fuori_scope.quanti).padStart(3)}`)
  console.log(`   esclusi: ${m.esclusioni.contenitori_scorrevoli} scorrevoli, ${m.esclusioni.nascosti_1px} nascosti, ${m.esclusioni.sbordano_ma_visibili} sbordano-ma-visibili`)
  console.log(`   ${m.nodi_totali} nodi · pannello ${m.pannello_rapporto ? 'sì' : 'no'} · viewport ${JSON.stringify(m.viewport)}`)
  for (const t of m.tagliati.nodi.slice(0, 3)) console.log(`      tagliato: ${t.scroll}>${t.visibile}  «${t.testo}»`)
  if (m.sbordanti?.quanti) {
    console.log(`   sborda senza tagliare  ${String(m.sbordanti.quanti).padStart(3)}   ← puo' finire SOTTO un fratello`)
    for (const t of m.sbordanti.nodi.slice(0, 3)) console.log(`      sborda: ${t.scroll}>${t.visibile}  «${t.testo}»`)
  }
  for (const s of m.tendine_strette.nodi.slice(0, 4)) console.log(`      tendina: ${s.serve}>${s.spazio}  «${s.testo}»`)
  for (const v of m.wcag_258.nodi.slice(0, 4)) console.log(`      2.5.8 ${v.w}×${v.h} a ${v.distanza}px da ${v.confligge.slice(0, 50)}`)
}

if (cieche) console.error(`\n!! ${cieche} misure su ${misure.length} sono CIECHE: lo stato non si è attivato.\n`)

const uscita = {
  condizioni: {
    misurato: new Date().toISOString().slice(0, 10),
    commit: execSync('git rev-parse --short HEAD', { cwd: RADICE }).toString().trim(),
    larghezza: LARGHEZZA,
    chrome: execSync(`${CHROME} --version`).toString().trim(),
    puppeteer: JSON.parse(fs.readFileSync(path.join(RADICE, 'package.json'), 'utf8')).devDependencies['puppeteer-core'],
    nota: 'Registro, non rete: dipende da un browser vero. Si rilegge con l\'occhio.',
  },
  misure,
}

if (SCRIVI) {
  const dest = path.join(RADICE, 'docs/misure-layout.json')
  fs.writeFileSync(dest, JSON.stringify(uscita, null, 2) + '\n')
  console.log(`\nscritto ${path.relative(RADICE, dest)}`)
} else {
  console.log('\n(--report: niente scritto)')
}
