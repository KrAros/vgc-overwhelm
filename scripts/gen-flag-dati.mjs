// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * scripts/gen-flag-dati.mjs
 *
 * La pipeline dati del progetto. Prende `vendor/ncp` come riferimento e porta
 * dentro `src/data/*.json` quello che ne serve, in quattro passaggi distinti:
 *
 *   1. ANAGRAFICA   base stats e tipi sbagliati               (sessione I)
 *   2. SLUG         una convenzione sola per le chiavi        (sessione I)
 *   3. FLAG SPECIE  `canEvolve`                               (sessione D)
 *   4. FLAG MOSSE   `punch` · `sound` `bite` `slicing`        (D e I)
 *                   `bullet`
 *
 * ─── PERCHÉ NON A MANO ─────────────────────────────────────────────────────
 * Sono centinaia di voci. A mano significa un pomeriggio e qualche refuso; e
 * soprattutto significa un dato che nessuno può rigenerare quando Champions
 * aggiungerà roba. Questo script è rieseguibile e stampa cosa ha cambiato.
 *
 * ─── LA REGOLA CHE GOVERNA IL PASSAGGIO 1 ──────────────────────────────────
 * NCP è autorevole sulla FORMULA — è per questo che l'abbiamo vendorizzato.
 * Sull'ANAGRAFICA è un file JSON scritto a mano da qualcun altro, esposto agli
 * stessi refusi dei nostri. Misurando le 1221 specie contro il loro pokedex
 * sono uscite tredici divergenze di base stats: dodici erano nostre, UNA era
 * loro (Zorua di Hisui, vedi `NON_CORREGGERE`).
 *
 * Quindi qui NCP NON è la sorgente: è il CONTROLLO. Ogni correzione è scritta
 * per esteso nelle tabelle sotto, verificata a mano una per una, e prima di
 * essere applicata lo script controlla che il vendor dica ancora quello che ci
 * aspettiamo. Se un domani NCP viene aggiornato e un valore cambia, lo script
 * si ferma invece di propagare in silenzio un dato che nessuno ha guardato.
 *
 * ─── COSA NON FA ───────────────────────────────────────────────────────────
 * Non tocca i pesi. `weight` non è letto da nessuna riga di `src/`: le mosse
 * che lo userebbero (Grass Knot, Low Kick, Heavy Slam, Heat Crash) sono §1.11 e
 * non esistono ancora. Correggerlo oggi sarebbe una modifica non verificabile
 * per conseguenza — nessuno snapshot si muoverebbe. Le divergenze di peso
 * vengono comunque ELENCATE nel report, così la lista resta rigenerabile con un
 * comando il giorno in cui serve.
 *
 * Uso:
 *   node scripts/gen-flag-dati.mjs              scrive i file
 *   node scripts/gen-flag-dati.mjs --report     mostra soltanto cosa farebbe
 *   node scripts/gen-flag-dati.mjs --pesi       aggiunge l'elenco dei pesi
 *   node scripts/gen-flag-dati.mjs --solo-slug  ferma dopo il rinomino
 *
 * ─── A COSA SERVE `--solo-slug` ────────────────────────────────────────────
 * A tenere separati due criteri di accettazione che hanno segno opposto.
 * Il rinomino delle chiavi non deve muovere NESSUN numero; le correzioni
 * anagrafiche devono muovere SOLO le specie corrette. Applicati insieme, un
 * numero che si sposta non si sa a chi attribuirlo, e nessuno dei due criteri
 * si legge più. Applicati in due passate, ognuno si verifica da solo.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { caricaNCP } from './ncp/contesto.mjs'
import { normalizza, ECCEZIONI_POKEMON } from './ncp/mappatura.mjs'
import { TYPE_NAMES } from '../src/data/typeChart.js'

const QUI = path.dirname(fileURLToPath(import.meta.url))
const RADICE = path.resolve(QUI, '..')
const DATI = path.join(RADICE, 'src', 'data')

const soloReport = process.argv.includes('--report')

const ncp = caricaNCP()

// ═══════════════════════════════════════════════════════════════════════════
// Indici NCP normalizzati
// ═══════════════════════════════════════════════════════════════════════════
// Stessa normalizzazione dell'harness: minuscolo, via punti, apostrofi, spazi
// e trattini. È già stata misurata su questi dataset e non produce collisioni.
// È anche la ragione per cui il rinomino degli slug non rompe la mappatura:
// `fluttermane` e `flutter-mane` si normalizzano nella stessa stringa.

const indice = (chiavi) => {
  const m = new Map()
  for (const k of chiavi) m.set(normalizza(k), k)
  return m
}

const iPokemon = indice(Object.keys(ncp.pokedex))
const iMosse = indice(Object.keys(ncp.mosse))

/**
 * Le stesse regole di forma della mappatura dell'harness: le Mega e le Primal
 * si riscrivono da sole, non serve elencarle.
 */
const REGOLE_FORMA = [
  { da: /^(.+)-mega-([xyz])$/, a: (m) => `Mega ${m[1]} ${m[2].toUpperCase()}` },
  { da: /^(.+)-mega$/, a: (m) => `Mega ${m[1]}` },
  { da: /^(.+)-primal$/, a: (m) => `Primal ${m[1]}` },
]

function nomeNCP(slug) {
  // Le stesse eccezioni dell'harness, importate invece che ricopiate: due
  // liste della stessa cosa sono due liste che divergeranno.
  //
  // Le eccezioni parlano la convenzione NUOVA. È il motivo per cui, più sotto,
  // il rinomino delle chiavi gira PRIMA delle correzioni anagrafiche.
  const ecc = ECCEZIONI_POKEMON[slug]
  if (ecc) return ncp.pokedex[ecc] ? ecc : null
  const diretto = iPokemon.get(normalizza(slug))
  if (diretto) return diretto
  for (const regola of REGOLE_FORMA) {
    const m = slug.match(regola.da)
    if (!m) continue
    const cand = iPokemon.get(normalizza(regola.a(m)))
    if (cand) return cand
  }
  return null
}

const STAT_NCP = ['hp', 'at', 'df', 'sa', 'sd', 'sp']
const statsNCP = (nome) => STAT_NCP.map(k => ncp.pokedex[nome].bs[k])
const tipiNCP = (nome) => [ncp.pokedex[nome].t1, ncp.pokedex[nome].t2].filter(Boolean)

/** Nome di tipo → indice 0-17 di `typeChart.js`. Lancia se il nome è ignoto. */
function indiceTipo(nome) {
  const i = TYPE_NAMES.indexOf(nome)
  if (i === -1) throw new Error(`Tipo sconosciuto: ${nome}`)
  return i
}

const errori = []
const uguale = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ═══════════════════════════════════════════════════════════════════════════
// 1 — ANAGRAFICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base stats sbagliate nel nostro JSON. Ordine: [PS, Att, Dif, Att.Sp, Dif.Sp,
 * Vel].
 *
 * `prima` serve alla rieseguibilità: se il valore attuale non è né `prima` né
 * `dopo`, qualcuno ha messo mano al file e lo script si ferma invece di
 * sovrascrivere un lavoro altrui.
 */
const CORREZIONI_STAT = [
  { slug: 'aegislash',       prima: [60, 50, 150, 50, 150, 60],  dopo: [60, 50, 140, 50, 140, 60],  motivo: 'ridimensionato in Scarlet/Violet: Dif e Dif.Sp da 150 a 140' },
  { slug: 'aegislash-blade', prima: [60, 150, 50, 150, 50, 60],  dopo: [60, 140, 50, 140, 50, 60],  motivo: 'stessa riduzione sulla forma Spada' },
  { slug: 'cresselia',       prima: [120, 70, 120, 75, 130, 85], dopo: [120, 70, 110, 75, 120, 85], motivo: 'ridimensionata in Scarlet/Violet' },
  { slug: 'dodrio',          prima: [60, 110, 70, 60, 60, 100],  dopo: [60, 110, 70, 60, 60, 110],  motivo: 'potenziato in Scarlet/Violet: Velocità da 100 a 110' },
  { slug: 'hoopa',           prima: [80, 100, 60, 150, 130, 70], dopo: [80, 110, 60, 150, 130, 70], motivo: 'potenziato in Scarlet/Violet: Attacco da 100 a 110' },
  { slug: 'necrozma',        prima: [97, 107, 101, 107, 89, 79], dopo: [97, 107, 101, 127, 89, 79], motivo: 'potenziato in Scarlet/Violet: Att.Sp da 107 a 127' },
  { slug: 'necrozma-ultra',  prima: [97, 167, 97, 161, 97, 129], dopo: [97, 167, 97, 167, 97, 129], motivo: 'nostro refuso: Att e Att.Sp sono simmetrici a 167' },
  { slug: 'poipole',         prima: [67, 73, 67, 73, 67, 173],   dopo: [67, 73, 67, 73, 67, 73],    motivo: 'nostro refuso: un 1 di troppo sulla Velocità' },
  { slug: 'chespin',         prima: [56, 61, 65, 48, 45, 33],    dopo: [56, 61, 65, 48, 45, 38],    motivo: 'nostro refuso sulla Velocità' },
  { slug: 'inkay',           prima: [53, 54, 37, 46, 45, 45],    dopo: [53, 54, 53, 37, 46, 45],    motivo: 'colonna sfalsata da Difesa in poi: avevamo perso il 53 di Difesa' },
  { slug: 'wishiwashi-solo', prima: [45, 20, 20, 25, 20, 40],    dopo: [45, 20, 20, 25, 25, 40],    motivo: 'nostro refuso sulla Difesa Speciale' },
  { slug: 'alakazam-mega',   prima: [55, 50, 65, 175, 95, 150],  dopo: [55, 50, 65, 175, 105, 150], motivo: 'nostro refuso: il totale base è 600, il nostro faceva 590' },
]

/**
 * Tipi sbagliati. Scritti per nome e non per indice: `[13, 17]` non si rilegge,
 * `['Ghost', 'Fairy']` sì.
 *
 * Le tredici Mega hanno tutte la stessa firma: NCP dice che la forma Mega
 * mantiene il tipo della forma base, noi avevamo inventato un secondo tipo.
 * Dove il cambio di tipo esiste davvero (Staraptor, Meganium, Feraligatr,
 * Clefable, Barbaracle) eravamo già d'accordo, e infatti non compaiono qui.
 */
const CORREZIONI_TIPO = [
  // ── Forme reali ────────────────────────────────────────────────────────
  { slug: 'decidueye',         prima: ['Grass', null],          dopo: ['Grass', 'Ghost'],   motivo: "l'indice era 18, che in typeChart non esiste: il secondo tipo veniva ignorato" },
  { slug: 'mimikyu',           prima: ['Ghost', 'Steel'],       dopo: ['Ghost', 'Fairy'],   motivo: 'secondo tipo sbagliato' },
  { slug: 'lurantis',          prima: ['Ground'],               dopo: ['Grass'],            motivo: 'tipo sbagliato' },
  { slug: 'dugtrio-alola',     prima: ['Ground', 'Dark'],       dopo: ['Ground', 'Steel'],  motivo: 'secondo tipo sbagliato' },
  { slug: 'wishiwashi-school', prima: ['Bug', 'Fairy'],         dopo: ['Water'],            motivo: 'entrambi i tipi sbagliati' },
  { slug: 'marowak-alola',     prima: ['Ghost', 'Fire'],        dopo: ['Fire', 'Ghost'],    motivo: 'solo ordine: innocuo per il calcolo, allineato per la UI' },
  // ── Mega che NON cambiano tipo rispetto alla forma base ────────────────
  { slug: 'delphox-mega',      prima: ['Fire', 'Steel'],        dopo: ['Fire', 'Psychic'],  motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'greninja-mega',     prima: ['Water', 'Ice'],         dopo: ['Water', 'Dark'],    motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'excadrill-mega',    prima: ['Ground', 'Psychic'],    dopo: ['Ground', 'Steel'],  motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'froslass-mega',     prima: ['Dark', 'Ghost'],        dopo: ['Ice', 'Ghost'],     motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'crabominable-mega', prima: ['Fighting', 'Dark'],     dopo: ['Fighting', 'Ice'],  motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'starmie-mega',      prima: ['Water', 'Steel'],       dopo: ['Water', 'Psychic'], motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'skarmory-mega',     prima: ['Psychic', 'Flying'],    dopo: ['Steel', 'Flying'],  motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'glimmora-mega',     prima: ['Water', 'Poison'],      dopo: ['Rock', 'Poison'],   motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'meowstic-mega',     prima: ['Steel'],                dopo: ['Psychic'],          motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'raichu-mega-x',     prima: ['Electric', 'Fighting'], dopo: ['Electric'],         motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'raichu-mega-y',     prima: ['Electric', 'Steel'],    dopo: ['Electric'],         motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'malamar-mega',      prima: ['Dark', 'Steel'],        dopo: ['Dark', 'Psychic'],  motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'scrafty-mega',      prima: ['Ice', 'Fighting'],      dopo: ['Dark', 'Fighting'], motivo: 'la Mega mantiene il tipo della forma base' },
  { slug: 'chimecho-mega',     prima: ['Steel', 'Psychic'],     dopo: ['Psychic', 'Steel'], motivo: 'solo ordine' },
  { slug: 'chandelure-mega',   prima: ['Ghost', 'Fire'],        dopo: ['Fire', 'Ghost'],    motivo: 'solo ordine' },
]

/** Refusi nel campo `name`, cioè in quello che l'utente legge a schermo. */
const CORREZIONI_NOME = [
  { slug: 'dewpider',  prima: 'Dewpier',          dopo: 'Dewpider',   motivo: 'refuso' },
  { slug: 'sirfetchd', prima: 'Sirfetch\\u2019d', dopo: "Sirfetch'd", motivo: 'sequenza di escape mai interpretata: a schermo si leggeva il backslash' },
]

/**
 * Divergenze da NCP che NON si correggono, con il motivo. Senza questa voce un
 * futuro allineamento alla cieca reintrodurrebbe l'errore.
 */
const NON_CORREGGERE = {
  'zorua-hisui': {
    nostro: [35, 60, 40, 85, 40, 70],
    ncp: [40, 60, 40, 80, 40, 70],
    motivo:
      'Qui ha torto NCP. Il totale base coincide (330 da entrambe le parti), quindi non ' +
      'è un ribilanciamento: è una trascrizione. E i due valori in cui differiscono — PS ' +
      '40 e Att.Sp 80 — sono esattamente quelli dello Zorua di Unima: contaminazione ' +
      'della forma base sulla forma di Hisui. Verificato a mano nella sessione I.',
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — SLUG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convenzione: solo `[a-z0-9-]`, il trattino è l'unico separatore, il prefisso
 * è la specie base e il suffisso è la forma (`calyrex-ice`, non
 * `ice-rider-calyrex`).
 *
 * ─── PERCHÉ SERVIVA ────────────────────────────────────────────────────────
 * Il file conteneva due convenzioni: tutto Gen 1-7 col trattino
 * (`landorus-therian`), tutto Gen 8-9 collassato (`fluttermane`). Due
 * importazioni, due formati.
 *
 * E non era solo disordine. `findPokemonKey` in `showdownIO.js` risolve un nome
 * Showdown provando il minuscolo e poi spazi→trattini: con le chiavi collassate
 * non trovava niente, e 71 specie su 1221 non erano importabili da una paste.
 * Non 71 a caso: Flutter Mane, Chien-Pao, Iron Hands, i tre Ogerpon, i tre
 * Tauros di Paldea, Calyrex, Urshifu — il meta di Reg M-B quasi per intero.
 *
 * ─── PERCHÉ UNA MAPPA SCRITTA A MANO ───────────────────────────────────────
 * Nessun generatore meccanico funziona. Derivando dal nostro campo `name`:
 * `Dewpier` è un refuso, `Type: Null` porta dentro i due punti, e
 * `Dusk Mane Necrozma` produrrebbe `dusk-mane-necrozma`, che rovescia l'ordine
 * e sparpaglia le tre forme di Necrozma nella tendina di ricerca. Derivando dai
 * nomi NCP, `Mega Charizard X` darebbe `mega-charizard-x`, che `sprite.js` non
 * sa leggere. Quindi: tabella esplicita, verificata, zero collisioni.
 *
 * È una migrazione una-tantum: dopo la prima esecuzione nessuna chiave vecchia
 * esiste più e il passaggio diventa un no-op.
 */
const RINOMINA_SLUG = {
  // ── Caratteri non ammessi ──────────────────────────────────────────────
  "farfetch'd": 'farfetchd',
  'mr. mime': 'mr-mime',
  'mime jr.': 'mime-jr',
  'tapu koko': 'tapu-koko',
  'tapu lele': 'tapu-lele',
  'tapu bulu': 'tapu-bulu',
  'tapu fini': 'tapu-fini',
  // ── Refuso ─────────────────────────────────────────────────────────────
  'whisiwashi-school': 'wishiwashi-school',
  // ── Gen 8 ──────────────────────────────────────────────────────────────
  'toxtricitylowkey': 'toxtricity-low-key',
  'mrrime': 'mr-rime',
  'eiscuenoice': 'eiscue-noice',
  'indeedeef': 'indeedee-f',
  'morpekohangry': 'morpeko-hangry',
  'zaciancrowned': 'zacian-crowned',
  'zamazentacrowned': 'zamazenta-crowned',
  'urshifurapidstrike': 'urshifu-rapid-strike',
  'calyrexice': 'calyrex-ice',
  'calyrexshadow': 'calyrex-shadow',
  // ── Forme di Hisui e forme Origine ─────────────────────────────────────
  'growlithehisui': 'growlithe-hisui',
  'arcaninehisui': 'arcanine-hisui',
  'voltorbhisui': 'voltorb-hisui',
  'electrodehisui': 'electrode-hisui',
  'typhlosionhisui': 'typhlosion-hisui',
  'qwilfishhisui': 'qwilfish-hisui',
  'sneaselhisui': 'sneasel-hisui',
  'samurotthisui': 'samurott-hisui',
  'lilliganthisui': 'lilligant-hisui',
  'zoruahisui': 'zorua-hisui',
  'zoroarkhisui': 'zoroark-hisui',
  'braviaryhisui': 'braviary-hisui',
  'sliggoohisui': 'sliggoo-hisui',
  'goodrahisui': 'goodra-hisui',
  'avalugghisui': 'avalugg-hisui',
  'decidueyehisui': 'decidueye-hisui',
  'dialgaorigin': 'dialga-origin',
  'palkiaorigin': 'palkia-origin',
  // ── Gen 9: Paradosso del passato ───────────────────────────────────────
  'greattusk': 'great-tusk',
  'screamtail': 'scream-tail',
  'brutebonnet': 'brute-bonnet',
  'fluttermane': 'flutter-mane',
  'slitherwing': 'slither-wing',
  'sandyshocks': 'sandy-shocks',
  'roaringmoon': 'roaring-moon',
  'walkingwake': 'walking-wake',
  'gougingfire': 'gouging-fire',
  'ragingbolt': 'raging-bolt',
  // ── Gen 9: Paradosso del futuro ────────────────────────────────────────
  'irontreads': 'iron-treads',
  'ironbundle': 'iron-bundle',
  'ironhands': 'iron-hands',
  'ironjugulis': 'iron-jugulis',
  'ironmoth': 'iron-moth',
  'ironthorns': 'iron-thorns',
  'ironvaliant': 'iron-valiant',
  'ironleaves': 'iron-leaves',
  'ironboulder': 'iron-boulder',
  'ironcrown': 'iron-crown',
  // ── Gen 9: Tesori del Male ─────────────────────────────────────────────
  'wochien': 'wo-chien',
  'chienpao': 'chien-pao',
  'tinglu': 'ting-lu',
  'chiyu': 'chi-yu',
  // ── Gen 9: altre forme ─────────────────────────────────────────────────
  'ursalunabloodmoon': 'ursaluna-bloodmoon',
  'palafinhero': 'palafin-hero',
  'dudunsparcethreesegment': 'dudunsparce-three-segment',
  'ogerponcornerstone': 'ogerpon-cornerstone',
  'ogerponhearthflame': 'ogerpon-hearthflame',
  'ogerponwellspring': 'ogerpon-wellspring',
  'terapagosterastal': 'terapagos-terastal',
  'taurospaldeaaqua': 'tauros-paldea-aqua',
  'taurospaldeablaze': 'tauros-paldea-blaze',
  'taurospaldeacombat': 'tauros-paldea-combat',
  'wooperpaldea': 'wooper-paldea',
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — FLAG DELLE MOSSE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Nel nostro JSON i flag esistenti si chiamano `contact` e `spread`, senza il
 * prefisso `is`. Restiamo su quella convenzione: chiave = nostro nome, valore
 * = nome NCP.
 *
 * `punch` era già qui dalla sessione D (Punching Glove, Iron Fist). Gli altri
 * quattro entrano ora perché costano meno di 2 KB su 123 e sbloccano, senza un
 * secondo giro sul vendor, le abilità di F e del mese 3: Punk Rock, Soundproof
 * e Throat Spray su `sound`, Strong Jaw su `bite`, Sharpness su `slicing`,
 * Bulletproof su `bullet`.
 *
 * NON prendiamo `isSpread`: `spread` da noi esiste già come booleano, e
 * sovrascriverlo cambierebbe una semantica invece di aggiungerne una. Quello è
 * §1.11, insieme a `target` e `accuracy`.
 *
 * `hitRange` era in quella lista e ne è uscito: lo trascrive il passaggio
 * 4-bis, qui sotto, perché senza di lui il set del meta con Infestazione
 * mostrava il danno di UN colpo su dieci.
 */
const FLAG_MOSSE = {
  punch: 'isPunch',
  sound: 'isSound',
  bite: 'isBite',
  slicing: 'isSlice',
  bullet: 'isBullet',
  // `pulse` entra per Megalancio, che da' x1.5 alle mosse-impulso. Sette
  // mosse su 810, quindi il costo e' nullo — ma soprattutto: la lista viene
  // di qui e non scritta a mano nel motore, cosi' se NCP la cambia il flag
  // cambia con lei invece di restare una tabella che marcisce.
  pulse: 'isPulse',
  // `prioritaria` entra per le tre abilita' che azzerano le mosse con
  // priorita': Armor Tail, Queenly Majesty e Dazzling.
  //
  // ─── PERCHE' NON BASTAVA IL CAMPO `priority` CHE ABBIAMO GIA' ────────────
  // Perche' e' un'altra cosa. Il nostro `priority` e' un NUMERO e ce l'hanno
  // 38 mosse; l'`isPriority` del vendor e' un FLAG e ce l'hanno 21. Le 17 di
  // differenza sono Protect, Detect, Follow Me, Helping Hand, Wide Guard e
  // compagnia.
  //
  // Misurato: tutte e 17 hanno potenza ZERO, quindi al calcolo del danno non
  // arrivano e `priority > 0` darebbe oggi la stessa risposta. Ma sarebbe una
  // deduzione che regge per coincidenza: basta che il gioco dia priorita' a
  // una mossa che fa danno senza che NCP la marchi, e i due insiemi si
  // separano in silenzio. Il flag si trascrive, come gli altri sei.
  prioritaria: 'isPriority',
  // `rinculo` entra per Reckless, che da' x1.2 alle mosse che si ritorcono
  // contro chi le usa.
  //
  // ─── PERCHE' TRE CHIAVI E NON UNA ──────────────────────────────────────
  // Perche' il riferimento ne guarda tre in `or` (damage_MASTER.js:1604):
  //
  //   attacker.ability === "Reckless" &&
  //     (move.hasRecoil || move.recoilHP || move.hasCrash)
  //
  // Sono cose diverse: `recoilHP` e' il contraccolpo in frazione dei danni
  // inflitti (Double-Edge, Flare Blitz — tredici mosse), `hasCrash` e' il
  // danno che si prende chi manca il bersaglio (High Jump Kick, Jump Kick,
  // Axe Kick, Supercell Slam — quattro), `hasRecoil` oggi non ce l'ha
  // nessuna mossa ma il vendor lo controlla lo stesso, e allora lo
  // controlliamo anche noi: se un giorno comparisse, comparirebbe da sola.
  //
  // Noi avevamo gia' `recoil` in moves.json, ma e' un'altra cosa ancora: e'
  // la FRAZIONE, serve al pannello per scrivere «contraccolpo 33.3%», e non
  // copre le quattro mosse con `hasCrash`. Usarlo per Reckless avrebbe dato
  // il numero giusto su tredici mosse e quello sbagliato su quattro.
  rinculo: ['hasRecoil', 'recoilHP', 'hasCrash'],
}

// ═══════════════════════════════════════════════════════════════════════════
// ESECUZIONE
// ═══════════════════════════════════════════════════════════════════════════

const percorsoPokemon = path.join(DATI, 'pokemon.json')
const percorsoMosse = path.join(DATI, 'moves.json')
const pokemon = JSON.parse(fs.readFileSync(percorsoPokemon, 'utf8'))
const mosse = JSON.parse(fs.readFileSync(percorsoMosse, 'utf8'))

const applicate = { stat: 0, tipo: 0, nome: 0, giaFatte: 0 }
const dettaglio = []

// ─── 0. Rinomino delle chiavi ───────────────────────────────────────────────
// Gira per PRIMO anche se nel documento è il passaggio 2, e non è un dettaglio:
// `ECCEZIONI_POKEMON` è scritto con la convenzione nuova, quindi finché le
// chiavi sono quelle vecchie `nomeNCP` non risolve. Il caso che l'ha fatto
// emergere è `whisiwashi-school`, il cui slug conteneva un refuso: prima del
// riordino lo script si è fermato con «non mappabile su NCP» invece di
// correggerlo. Si è fermato, non l'ha saltato — ed è il motivo per cui la
// verifica sul vendor sta lì.
//
// Si ricostruisce l'oggetto invece di cancellare e reinserire: in JavaScript
// l'ordine delle chiavi è quello di inserimento, e cancellare `fluttermane`
// per rimetterlo come `flutter-mane` lo sposterebbe in fondo al file. Il diff
// di git diventerebbe illeggibile.

let rinominate = 0
const collisioni = []
{
  const nuovo = {}
  for (const [slug, voce] of Object.entries(pokemon)) {
    const destinazione = RINOMINA_SLUG[slug] ?? slug
    if (destinazione !== slug) {
      if (nuovo[destinazione] !== undefined) {
        collisioni.push(`${slug} → ${destinazione}`)
        nuovo[slug] = voce
        continue
      }
      rinominate++
    }
    nuovo[destinazione] = voce
  }
  if (collisioni.length) {
    errori.push(`slug: collisioni → ${collisioni.join(', ')}`)
  } else {
    for (const k of Object.keys(pokemon)) delete pokemon[k]
    Object.assign(pokemon, nuovo)
  }
}

/** Controllo di forma su TUTTE le chiavi, non solo su quelle rinominate. */
const fuoriConvenzione = Object.keys(pokemon).filter(s => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))
if (fuoriConvenzione.length) errori.push(`slug: fuori convenzione → ${fuoriConvenzione.join(', ')}`)

if (process.argv.includes('--solo-slug')) {
  if (errori.length) {
    console.error('ERRORI — nessun file scritto:')
    for (const e of errori) console.error(`  ${e}`)
    process.exit(1)
  }
  console.log('')
  console.log(`--solo-slug: ${rinominate} chiavi rinominate, nessuna correzione anagrafica.`)
  if (!soloReport) {
    fs.writeFileSync(percorsoPokemon, JSON.stringify(pokemon, null, '\t') + '\n')
    console.log('Scritto src/data/pokemon.json')
  }
  console.log('')
  process.exit(0)
}

// ─── 1a. Base stats ─────────────────────────────────────────────────────────

for (const { slug, prima, dopo, motivo } of CORREZIONI_STAT) {
  const voce = pokemon[slug]
  if (!voce) { errori.push(`stat: slug assente da pokemon.json → ${slug}`); continue }

  // Controllo sul vendor: il valore che stiamo per scrivere è ancora quello che
  // NCP conferma? Se no ci si ferma, invece di propagare un dato non letto.
  const nome = nomeNCP(slug)
  if (!nome) { errori.push(`stat: ${slug} non mappabile su NCP`); continue }
  if (!uguale(dopo, statsNCP(nome))) {
    errori.push(`stat: ${slug} — il vendor ora dice ${JSON.stringify(statsNCP(nome))}, la tabella dice ${JSON.stringify(dopo)}. Rileggere prima di scrivere.`)
    continue
  }

  if (uguale(voce.stats, dopo)) { applicate.giaFatte++; continue }
  if (!uguale(voce.stats, prima)) {
    errori.push(`stat: ${slug} — il file contiene ${JSON.stringify(voce.stats)}, atteso ${JSON.stringify(prima)}. Qualcuno ha già messo mano al dato.`)
    continue
  }
  voce.stats = [...dopo]
  applicate.stat++
  dettaglio.push(`  stat  ${slug.padEnd(20)} ${JSON.stringify(prima)} → ${JSON.stringify(dopo)}`)
  dettaglio.push(`        ${' '.repeat(20)} ${motivo}`)
}

// ─── 1b. Tipi ───────────────────────────────────────────────────────────────

for (const { slug, prima, dopo, motivo } of CORREZIONI_TIPO) {
  const voce = pokemon[slug]
  if (!voce) { errori.push(`tipo: slug assente da pokemon.json → ${slug}`); continue }

  const nome = nomeNCP(slug)
  if (!nome) { errori.push(`tipo: ${slug} non mappabile su NCP`); continue }
  if (!uguale(dopo, tipiNCP(nome))) {
    errori.push(`tipo: ${slug} — il vendor ora dice ${JSON.stringify(tipiNCP(nome))}, la tabella dice ${JSON.stringify(dopo)}. Rileggere prima di scrivere.`)
    continue
  }

  const indiciDopo = dopo.map(indiceTipo)
  if (uguale(voce.type, indiciDopo)) { applicate.giaFatte++; continue }

  // `prima` è scritto per nome, ma contiene `null` per l'indice fuori range di
  // Decidueye (18), che nessun nome rappresenta. Confrontiamo quindi la forma
  // leggibile del dato attuale, non gli indici.
  const attualeLeggibile = (voce.type || []).map(i => TYPE_NAMES[i] ?? null)
  if (!uguale(attualeLeggibile, prima)) {
    errori.push(`tipo: ${slug} — il file contiene ${JSON.stringify(attualeLeggibile)}, atteso ${JSON.stringify(prima)}.`)
    continue
  }
  voce.type = indiciDopo
  applicate.tipo++
  dettaglio.push(`  tipo  ${slug.padEnd(20)} ${prima.join('/')} → ${dopo.join('/')}`)
  dettaglio.push(`        ${' '.repeat(20)} ${motivo}`)
}

// ─── 1c. Nomi ───────────────────────────────────────────────────────────────

for (const { slug, prima, dopo, motivo } of CORREZIONI_NOME) {
  const voce = pokemon[slug]
  if (!voce) { errori.push(`nome: slug assente → ${slug}`); continue }
  if (voce.name === dopo) { applicate.giaFatte++; continue }
  if (voce.name !== prima) {
    errori.push(`nome: ${slug} — il file contiene ${JSON.stringify(voce.name)}, atteso ${JSON.stringify(prima)}.`)
    continue
  }
  voce.name = dopo
  applicate.nome++
  dettaglio.push(`  nome  ${slug.padEnd(20)} ${JSON.stringify(prima)} → ${JSON.stringify(dopo)}`)
  dettaglio.push(`        ${' '.repeat(20)} ${motivo}`)
}

/** Controllo di forma sugli indici di tipo: 18 non esiste, e non deve tornare. */
const tipiFuoriRange = Object.entries(pokemon)
  .filter(([, v]) => (v.type || []).some(t => !Number.isInteger(t) || t < 0 || t > 17))
  .map(([s]) => s)
if (tipiFuoriRange.length) errori.push(`tipo: indice fuori dall'intervallo 0-17 → ${tipiFuoriRange.join(', ')}`)

// ─── 3. canEvolve ───────────────────────────────────────────────────────────

let evolvibili = 0
let nonMappati = 0
const esempiNonMappati = []

for (const [slug, voce] of Object.entries(pokemon)) {
  const nome = nomeNCP(slug)
  if (!nome) {
    nonMappati++
    if (esempiNonMappati.length < 12) esempiNonMappati.push(slug)
    // Non mappabile: si lascia il campo assente. `false` sarebbe una bugia
    // travestita da dato — meglio che l'assenza resti visibile.
    continue
  }
  // In NCP il campo esiste solo quando è vero. `!!` normalizza l'assenza.
  const puo = !!ncp.pokedex[nome].canEvolve
  voce.canEvolve = puo
  if (puo) evolvibili++
}

// ─── 4. Flag delle mosse ────────────────────────────────────────────────────

const conteggioFlag = {}
let mosseNonMappate = 0
for (const nostro of Object.keys(FLAG_MOSSE)) conteggioFlag[nostro] = 0

for (const [slug, voce] of Object.entries(mosse)) {
  const nome = iMosse.get(normalizza(slug))
  if (!nome) { mosseNonMappate++; continue }
  for (const [nostro, loro] of Object.entries(FLAG_MOSSE)) {
    // Una voce di FLAG_MOSSE e' una chiave del vendor o un elenco di chiavi
    // in `or`: Reckless ne guarda tre, gli altri sette una sola.
    const chiavi = Array.isArray(loro) ? loro : [loro]
    if (chiavi.some(chiave => ncp.mosse[nome][chiave])) {
      voce[nostro] = true
      conteggioFlag[nostro]++
    } else if (nostro in voce) {
      // Rieseguibilità: se NCP non la classifica più così, il flag sparisce.
      delete voce[nostro]
    }
  }
}

// ─── 4-bis. Colpi multipli ──────────────────────────────────────────────────
//
// `hitRange` del vendor, normalizzato a una coppia `[min, max]`.
//
// ─── PERCHE' NORMALIZZARE ──────────────────────────────────────────────────
// In NCP il campo ha DUE forme: un numero quando i colpi sono fissi
// (`'Double Kick': { hitRange: 2 }`) e una coppia quando variano
// (`'Bullet Seed': { hitRange: [2,5] }`). Chi legge dovrebbe distinguerle a
// ogni uso, e il giorno che qualcuno se ne dimentica `voce.colpi[0]` su un
// numero da' `undefined` senza errore. Qui `2` diventa `[2, 2]`: una forma
// sola, e la distinzione «fissi o variabili» si legge da `min === max`.
//
// ─── `potenzaCrescente` E' UN AVVISO, NON UNA MECCANICA ────────────────────
// Triplocalcio e Triplo Axel hanno `isTripleHit`: la potenza SALE a ogni colpo
// (10/20/30 e 20/40/60), quindi il totale non e' «un colpo per N». Il flag e'
// trascritto perche' il motore possa rifiutarsi di moltiplicare invece di
// dare un numero sbagliato in silenzio — non perche' la meccanica sia
// implementata. Non lo e'.

let conColpi = 0
let conPotenzaCrescente = 0
for (const [slug, voce] of Object.entries(mosse)) {
  const nome = iMosse.get(normalizza(slug))
  if (!nome) continue
  const range = ncp.mosse[nome].hitRange
  if (range) {
    voce.colpi = Array.isArray(range) ? [range[0], range[1]] : [range, range]
    conColpi++
  } else if ('colpi' in voce) {
    delete voce.colpi
  }
  if (ncp.mosse[nome].isTripleHit) {
    voce.potenzaCrescente = true
    conPotenzaCrescente++
  } else if ('potenzaCrescente' in voce) {
    delete voce.potenzaCrescente
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════════════════

console.log('')
console.log('── 1. Anagrafica ───────────────────────────────────────────────')
console.log(`  base stats corrette:  ${applicate.stat}`)
console.log(`  tipi corretti:        ${applicate.tipo}`)
console.log(`  nomi corretti:        ${applicate.nome}`)
console.log(`  già a posto:          ${applicate.giaFatte}`)
if (dettaglio.length) {
  console.log('')
  for (const riga of dettaglio) console.log(riga)
}
console.log('')
console.log('  NON corretti di proposito:')
for (const [slug, v] of Object.entries(NON_CORREGGERE)) {
  console.log(`    ${slug}: noi ${JSON.stringify(v.nostro)}, NCP ${JSON.stringify(v.ncp)}`)
  console.log(`      ${v.motivo}`)
}

console.log('')
console.log('── 2. Slug ─────────────────────────────────────────────────────')
console.log(`  chiavi rinominate:    ${rinominate}`)
console.log(`  fuori convenzione:    ${fuoriConvenzione.length}`)

console.log('')
console.log('── 3. pokemon.json ─────────────────────────────────────────────')
console.log(`  specie totali:        ${Object.keys(pokemon).length}`)
console.log(`  canEvolve = true:     ${evolvibili}`)
console.log(`  non mappabili su NCP: ${nonMappati}`)
if (esempiNonMappati.length) {
  console.log(`    es. ${esempiNonMappati.join(', ')}${nonMappati > esempiNonMappati.length ? ', …' : ''}`)
}

console.log('')
console.log('── 4. moves.json ───────────────────────────────────────────────')
console.log(`  mosse totali:         ${Object.keys(mosse).length}`)
for (const [nostro, n] of Object.entries(conteggioFlag)) {
  console.log(`  ${(nostro + ':').padEnd(22)}${n}`)
}
console.log(`  ${'colpi (hitRange):'.padEnd(22)}${conColpi}`)
console.log(`  ${'di cui a potenza crescente:'.padEnd(22)}${conPotenzaCrescente}   ← non modellate`)
console.log(`  non mappabili su NCP: ${mosseNonMappate}`)

// ─── Pesi: elencati, mai scritti ────────────────────────────────────────────

const divergenzePeso = []
for (const [slug, voce] of Object.entries(pokemon)) {
  const nome = nomeNCP(slug)
  if (!nome) continue
  const w = ncp.pokedex[nome].w
  if (w != null && Math.abs((voce.weight ?? 0) - w) > 0.001) {
    divergenzePeso.push(`${slug}: noi ${voce.weight}, NCP ${w}`)
  }
}
console.log('')
console.log('── Pesi (solo elenco, NON scritti) ─────────────────────────────')
console.log(`  divergenze: ${divergenzePeso.length}`)
console.log('  `weight` non è letto da src/: le mosse che lo userebbero sono §1.11.')
console.log('  Entrambe le parti sbagliano a turno, quindi ogni voce va aggiudicata')
console.log('  a mano quando il dato diventerà osservabile.')
if (process.argv.includes('--pesi')) {
  for (const riga of divergenzePeso) console.log(`    ${riga}`)
} else {
  console.log("  Rilancia con --pesi per l'elenco completo.")
}

console.log('')

if (errori.length) {
  console.error('ERRORI — nessun file scritto:')
  for (const e of errori) console.error(`  ${e}`)
  process.exit(1)
}

if (soloReport) {
  console.log('--report: nessun file scritto.')
  process.exit(0)
}

fs.writeFileSync(percorsoPokemon, JSON.stringify(pokemon, null, '\t') + '\n')
fs.writeFileSync(percorsoMosse, JSON.stringify(mosse, null, '\t') + '\n')
console.log('Scritti src/data/pokemon.json e src/data/moves.json')
console.log('')
