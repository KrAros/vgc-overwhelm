// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

/**
 * src/data/metaPresets.js
 *
 * Set osservati nel meta competitivo di Champions.
 *
 * ─── LA PROVENIENZA STA SU OGNI SET, NON IN TESTA AL FILE ──────────────────
 *
 * Qui c'era una riga sola che dichiarava la fonte di tutti e venti, e
 * CONTRIBUTING.md ne fa una promessa: «il file dichiara la propria fonte in
 * testa, e quella riga deve restare vera». Restava vera finché i set venivano
 * tutti dallo stesso posto e dallo stesso periodo — cioè fino al primo set di
 * un altro periodo, che l'avrebbe resa falsa senza che niente diventasse
 * rosso.
 *
 * Ogni set porta quindi il campo `reg`, che dice sotto quali REGOLE è stato
 * osservato: M-A, M-B. `regChampions.json` elenca quelle valide, e
 * `metaPresets.test.js` rifiuta una reg che non esiste.
 *
 * ─── PERCHE' LA REG E NON LA STAGIONE ──────────────────────────────────────
 *
 * Il campo è stato per un po' la STAGIONE — M-1…M-5, il periodo di classifica
 * — e il cambio merita di essere scritto, perché è costato un difetto vero.
 *
 * L'idea era che un set fosse un'osservazione datata, e che la data valesse la
 * pena di conservarla. Vero in astratto. Ma il filtro dell'interfaccia usava
 * quella data per rispondere a una domanda diversa — «quali set posso usare
 * adesso?» — e le due cose divergono: le specie utilizzabili cambiano solo fra
 * REG, mai fra stagioni della stessa reg.
 *
 * Misurato quando M-5 è diventata la stagione di partenza: la tendina mostrava
 * set per 2 specie su 20. Gli altri venti set erano perfettamente legali e
 * invisibili, nascosti dalla loro data di osservazione.
 *
 * Scelta di Simone: la reg è l'unica cosa che cambia davvero cosa si può
 * giocare, quindi è l'unica che etichetta un set. Il prezzo, dichiarato: due
 * osservazioni della stessa specie con la stessa etichetta nella stessa reg
 * non possono coesistere. Quando è successo — Incineroar «Sitrus Support» in
 * M-4 con SP 24/8 e in M-5 con 21/11 — si è tenuta la più recente.
 */

export const META_PRESETS = [
  // ── Support ────────────────────────────────────────────────────────────────
  {
    slug: 'sinistcha',
    label: 'Trick Room Support',
    nature: 'Bold',
    item: 'kasib berry',
    ability: 'hospitality',
    sps: [32, 0, 14, 0, 20, 0],
    moves: ['matcha-gotcha', 'rage-powder', 'trick-room', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'grimmsnarl',
    label: 'Screen Support',
    nature: 'Careful',
    item: 'light clay',
    ability: 'prankster',
    sps: [32, 0, 19, 0, 15, 0],
    moves: ['reflect', 'light-screen', 'parting-shot', 'spirit-break'],
    reg: 'M-B',
  },
  {
    slug: 'clefable',
    label: 'Redirector Support',
    nature: 'Bold',
    item: 'sitrus berry',
    // Tre abilita' — cute-charm, magic-guard, unaware — e nessuna Mega di
    // mezzo, quindi si trascrive quella dichiarata.
    ability: 'unaware',
    // Lo spread piu' fine del file: quattro statistiche, e quei 5 in Velocita'
    // sono un numero da speed creep, misurato per superare qualcosa di
    // preciso. Trascritti dove stanno, senza spostarli altrove.
    sps: [32, 0, 17, 0, 12, 5],
    // «Redirector» e' l'unico qualificatore del file che sia a sua volta un
    // nome di RUOLO — ha la forma di Lead, Pivot, Control. Sollevato come
    // obiezione e deciso da Simone in favore di questa forma. Resta scoperto
    // Sinistcha: porta Nubevelen, redirige uguale, e si chiama «Trick Room
    // Support». Se un giorno le due voci vanno uniformate, si parte da qui.
    moves: ['moonblast', 'helping-hand', 'follow-me', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'blaziken',
    label: 'Coaching Support',
    nature: 'Modest',
    item: 'focus sash',
    // La forma BASE, e qui `speed-boost` e' davvero la sua: la trappola della
    // Mega scatta solo quando il set tiene la Megapietra. Questo tiene Focus
    // Sash, quindi Blaziken resta Blaziken per tutta la partita.
    ability: 'speed-boost',
    // Modest su chi ha Attacco 120 e Attacco Speciale 110 sembra un refuso.
    // Non lo e': Ondacalda e Auraconflusso sono entrambe speciali, quindi la
    // natura toglie da una statistica che il set non usa.
    sps: [2, 0, 0, 32, 0, 32],
    moves: ['heat-wave', 'aura-sphere', 'coaching', 'protect'],
    reg: 'M-B',
  },

  // ── Rain ───────────────────────────────────────────────────────────────────
  {
    slug: 'pelipper',
    label: 'Rain Setter',
    nature: 'Modest',
    item: 'sitrus berry',
    ability: 'drizzle',
    sps: [2, 0, 0, 32, 0, 32],
    moves: ['weather-ball', 'hurricane', 'tailwind', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'swampert-mega',
    label: 'Rain Sweeper',
    nature: 'Adamant',
    item: 'swampertite',
    ability: 'swift-swim',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['wave-crash', 'earthquake', 'ice-punch', 'protect'],
    reg: 'M-B',
  },

  // ── Rain / Screen ──────────────────────────────────────────────────────────
  {
    slug: 'archaludon',
    label: 'Rain / Screen',
    nature: 'Modest',
    item: 'leftovers',
    ability: 'stamina',
    sps: [32, 0, 0, 5, 15, 14],
    moves: ['electro-shot', 'flash-cannon', 'dragon-pulse', 'protect'],
    reg: 'M-B',
  },

  // ── Attaccanti ─────────────────────────────────────────────────────────────
  {
    slug: 'garchomp',
    label: 'Life Orb Attacker',
    nature: 'Jolly',
    item: 'life orb',
    ability: 'rough-skin',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['dragon-claw', 'rock-slide', 'earthquake', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'dragonite',
    label: 'Physical Attacker',
    nature: 'Adamant',
    item: 'dragon fang',
    // Nessuna Mega, quindi si trascrive. `multiscale` NON e' fra le abilita
    // del divario: il motore la applica, e il dimezzamento a PS pieni finisce
    // davvero nei numeri. Campo portante, non decorativo.
    ability: 'multiscale',
    sps: [2, 32, 0, 0, 0, 32],
    // «Physical» descrive la maggioranza e non l'eccezione: nove Attacker su
    // dodici sono gia fisici, e il file finora marcava solo gli speciali.
    // Sollevato e deciso da Simone in favore di questa forma, come per
    // «Special Attacker» di dragalge-mega.
    moves: ['dragon-claw', 'extreme-speed', 'low-kick', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'dragonite',
    // Secondo Dragonite nella STESSA reg, quindi l'etichetta non e' una
    // scelta libera: doveva differire da «Physical Attacker», o la chiave
    // slug+reg+etichetta collideva e questo set spariva dalla tendina.
    label: 'White Herb Attacker',
    nature: 'Adamant',
    // L'Erbabianca e' il meccanismo, non un accessorio: Squamacolpo abbassa la
    // Difesa e Wattforza abbassa Attacco e Difesa: due mosse che si
    // autopenalizzano, e lo strumento ripristina una volta sola.
    item: 'white herb',
    ability: 'multiscale',
    sps: [15, 32, 1, 0, 0, 18],
    // «Attacker» e non «Sweeper», e la tensione va detta: Squamacolpo alza la
    // Velocita, quindi il criterio fissato con Ceruledge e Corviknight
    // suggerirebbe Sweeper. Deciso da Simone per Attacker, leggendo
    // Squamacolpo come una mossa d'attacco che per caso potenzia e non come
    // un setup. I due Dragonite restano cosi entrambi Attacker.
    moves: ['scale-shot', 'superpower', 'extreme-speed', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'charizard-mega-y',
    label: 'Sun Setter',
    nature: 'Modest',
    item: 'charizardite y',
    ability: 'drought',
    sps: [30, 0, 30, 1, 0, 5],
    moves: ['heat-wave', 'weather-ball', 'solar-beam', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'kingambit',
    label: 'Defiant Sweeper',
    nature: 'Adamant',
    item: 'blackglasses',
    ability: 'defiant',
    sps: [32, 32, 0, 0, 2, 0],
    moves: ['kowtow-cleave', 'sucker-punch', 'swords-dance', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'sneasler',
    label: 'Sash Attacker',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'unburden',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['fake-out', 'close-combat', 'dire-claw', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'annihilape',
    label: 'Sash Attacker',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'defiant',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['fake-out', 'close-combat', 'phantom-force', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'excadrill',
    label: 'Sash Sand Abuser',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'sand-rush',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['earthquake', 'iron-head', 'rock-slide', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'basculegion-m',
    label: 'Scarf Wallbreaker',
    nature: 'Jolly',
    item: 'choice scarf',
    ability: 'adaptability',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['wave-crash', 'last-respects', 'aqua-jet', 'flip-turn'],
    reg: 'M-B',
  },
  {
    slug: 'venusaur',
    label: 'Sash Sun Abuser',
    nature: 'Modest',
    item: 'focus sash',
    ability: 'chlorophyll',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['sludge-bomb', 'earth-power', 'sleep-powder', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'archaludon',
    label: 'Rain Special Attacker',
    nature: 'Modest',
    item: 'leftovers',
    ability: 'stamina',
    sps: [32, 0, 0, 1, 29, 4],
    moves: ['electro-shot', 'flash-cannon', 'dragon-pulse', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'sylveon',
    label: 'Bulky Special Attacker',
    nature: 'Modest',
    item: 'fairy feather',
    ability: 'pixilate',
    sps: [18, 0, 10, 21, 0, 17],
    moves: ['hyper-beam', 'hyper-voice', 'quick-attack', 'detect'],
    reg: 'M-B',
  },
  {
    slug: 'gholdengo',
    label: 'Choice Scarf',
    nature: 'Modest',
    item: 'choice scarf',
    ability: 'good-as-gold',
    sps: [1, 0, 2, 32, 0, 31],
    moves: ['make-it-rain', 'shadow-ball', 'power-gem', 'focus-blast'],
    reg: 'M-B',
  },
  {
    slug: 'ceruledge',
    label: 'Bulk Up Attacker',
    nature: 'Adamant',
    item: 'colbur berry',
    ability: 'flash-fire',
    // Il primo spread di oggi che non massimizza una coppia: 7 punti tolti
    // all'Attacco per comprarne 9 di Difesa, Velocita' a zero. Fa 66 esatti,
    // quindi e' una scelta e non un residuo — trascritto senza arrotondare.
    sps: [32, 25, 9, 0, 0, 0],
    // «Attacker» e non «Sweeper», contro il precedente meccanico del file
    // (Kingambit con Danzaspada e Blastoise Mega con Gusciarmata sono Sweeper
    // perche' hanno una mossa di potenziamento). Qui Granforza alza anche la
    // Difesa e la Velocita' resta a zero: questo non spazza, macina.
    moves: ['bitter-blade', 'shadow-sneak', 'protect', 'bulk-up'],
    reg: 'M-B',
  },
  {
    // ─── IL PRIMO SET DI M-A ────────────────────────────────────────────────
    //
    // Fino a qui i trentatre set erano tutti M-B, e il campo `reg` non aveva
    // mai filtrato niente. Da adesso filtra: questa voce NON compare con M-B
    // selezionata — cioe' per chi apre l'app senza toccare la tendina — anche
    // se Corviknight in M-B si puo' usare eccome. Si vede scegliendo M-A o
    // «tutte». E' il comportamento voluto (la reg dice dove il set e' stato
    // OSSERVATO), ma e' la prima volta che costa la visibilita' a un set.
    //
    // Non sposta invece la reg iniziale: `regConSetPiuRecente` parte dalla reg
    // corrente e scende all'indietro, quindi trova M-B subito e i set di M-B
    // restano quelli predefiniti. Misurato prima di scrivere, non supposto.
    slug: 'corviknight',
    label: 'Bulk Up Sweeper',
    nature: 'Careful',
    item: 'leftovers',
    ability: 'mirror-armor',
    // Cinque statistiche toccate, il piu' frammentato del file. Quell'1 in
    // Difesa e' il resto della divisione, non una scelta.
    sps: [27, 11, 1, 0, 5, 22],
    // Stessa mossa di Ceruledge, ruolo opposto, e la coppia e' il motivo per
    // cui il criterio regge: non decide la presenza del potenziamento, decide
    // cosa fa il set dopo. Ceruledge ha 0 SP in Velocita' ed e' Attacker,
    // questo ne ha 22 ed e' Sweeper.
    //
    // Da notare anche il perche' basti 1 SP in Difesa: Granforza alza Attacco
    // E Difesa, e Corpodurezza usa la Difesa. Un solo potenziamento spinge
    // entrambe le mosse offensive, quindi la Difesa non si compra con gli SP.
    moves: ['brave-bird', 'body-press', 'bulk-up', 'roost'],
    reg: 'M-A',
  },

  // ── Mega ───────────────────────────────────────────────────────────────────
  {
    slug: 'metagross-mega',
    label: 'Tough Claws Attacker',
    nature: 'Jolly',
    item: 'metagrossite',
    ability: 'tough-claws',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['iron-head', 'psychic-fangs', 'body-press', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'staraptor-mega',
    label: 'Contrary Attacker',
    nature: 'Jolly',
    item: 'staraptite',
    ability: 'contrary',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['close-combat', 'brave-bird', 'quick-attack', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'garchomp-mega',
    label: 'Sand Force Attacker',
    nature: 'Jolly',
    item: 'garchompite',
    ability: 'sand-force',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['dragon-claw', 'earthquake', 'rock-slide', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'delphox-mega',
    label: 'Setup Sweeper',
    nature: 'Modest',
    item: 'delphoxite',
    // ─── LA TRAPPOLA MEGA NELLA SUA FORMA PEGGIORE ─────────────────────────
    //
    // Showdown dichiara Fiammata, che e' della forma BASE. `delphox-mega` ha
    // una sola abilita ed e' `levitate`: la Mega non aggiunge, sostituisce.
    //
    // Qui l'errore non sarebbe stato di grado ma di natura. Con Blastoise
    // Mega, `rain-dish` al posto di `mega-launcher` toglieva un x1.5 a due
    // mosse: un numero sbagliato. Levitate non e' un moltiplicatore, e'
    // un'IMMUNITA a Terra — trascrivendo `blaze` il calcolatore avrebbe
    // applicato danno di Terra a chi ne prende zero, cioe' avrebbe risposto
    // il contrario alla domanda «questo KO passa?».
    ability: 'levitate',
    // Un solo SP in Attacco Speciale su un set Modest con due mosse speciali:
    // sembra un refuso, e' stato chiesto, ed e' confermato. Il set compra
    // massa e velocita' e lascia l'offesa a Nedodoppio.
    sps: [23, 0, 11, 1, 0, 31],
    moves: ['heat-wave', 'nasty-plot', 'psyshock', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'dragalge-mega',
    label: 'Special Attacker',
    nature: 'Modest',
    item: 'dragalgite',
    // ─── LA STESSA TRAPPOLA DI DELPHOX, NELLA DIREZIONE PEGGIORE ───────────
    //
    // Showdown dichiara Adattabilita, che e' della forma base. `dragalge-mega`
    // ha solo `regenerator`.
    //
    // Qui sbagliare avrebbe gonfiato i numeri invece di sgonfiarli. La specie
    // e' Veleno/Drago, quindi Fiammadraco E Fangobomba sono entrambe STAB, e
    // Adattabilita porta lo STAB da x1.5 a x2: un +33% su tutte e due le mosse
    // principali. Non un campo ignorato — `adaptability` non e' fra le
    // abilita del divario, quindi il motore l'avrebbe applicata davvero.
    //
    // E' il rovescio di Blastoise Mega. Li' copiare alla cieca faceva
    // SOTTOstimare, e si sbaglia in cauto; qui fa SOVRAstimare, che per un
    // calcolatore di danno e' il modo peggiore: si pianifica un KO che non
    // passa.
    //
    // La trappola dentro la trappola: Rigenerazione non incide sul danno,
    // cura al cambio. Chi si chiedesse «quale delle due conta per il calcolo?»
    // terrebbe Adattabilita perche' almeno fa qualcosa. La domanda giusta non
    // e' quale valore muove il calcolo, e' quale valore e' vero.
    ability: 'regenerator',
    sps: [32, 0, 11, 23, 0, 0],
    moves: ['draco-meteor', 'sludge-bomb', 'thunderbolt', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'blaziken-mega',
    label: 'Physical Sweeper',
    nature: 'Jolly',
    item: 'blazikenite',
    // La trappola della Mega qui NON morde, e per caso: `blaziken-mega` ha
    // `speed-boost` come unica abilita, cioe' la stessa stringa che Showdown
    // dichiara per la forma base. Chi avesse copiato alla cieca avrebbe
    // indovinato — ed e' esattamente cio' che rende la trappola pericolosa,
    // perche' un set come questo insegna l'abitudine sbagliata. La regola e'
    // stata applicata lo stesso: la coincidenza sta nel dato, non nel metodo.
    ability: 'speed-boost',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['flare-blitz', 'close-combat', 'rock-slide', 'detect'],
    reg: 'M-B',
  },
  {
    slug: 'incineroar',
    label: 'Sitrus Support',
    nature: 'Impish',
    item: 'sitrus berry',
    ability: 'intimidate',
    sps: [32, 0, 21, 0, 11, 2],
    moves: ['fake-out', 'flare-blitz', 'throat-chop', 'parting-shot'],
    reg: 'M-B',
  },
  {
    slug: 'aerodactyl',
    label: 'Sash Tailwind Lead',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'unnerve',
    sps: [2, 32, 0, 0, 0, 32],
    moves: ['rock-slide', 'dual-wingbeat', 'wide-guard', 'tailwind'],
    reg: 'M-B',
  },
  {
    slug: 'aerodactyl-mega',
    label: 'Bulky Speed Control',
    nature: 'Jolly',
    item: 'aerodactylite',
    ability: 'tough-claws',
    sps: [28, 11, 9, 0, 1, 17],
    moves: ['rock-slide', 'ice-fang', 'tailwind', 'wide-guard'],
    reg: 'M-B',
  },
  {
    slug: 'arcanine-hisui',
    label: 'Rock Head Attacker',
    nature: 'Jolly',
    item: 'focus sash',
    ability: 'rock-head',
    sps: [1, 32, 1, 0, 0, 32],
    moves: ['flare-blitz', 'head-smash', 'rock-slide', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'arcanine-hisui',
    label: 'Intimidate Support',
    nature: 'Adamant',
    item: 'lum berry',
    ability: 'intimidate',
    sps: [0, 32, 2, 0, 0, 32],
    // `will-o-wisp` col trattino, che e' la chiave vera di moves.json. Fino a
    // ieri una mossa cosi' non si poteva scrivere in un set: la risoluzione
    // sostituiva ogni trattino con uno spazio e lo slot restava vuoto.
    moves: ['flare-blitz', 'protect', 'will-o-wisp', 'rock-slide'],
    reg: 'M-B',
  },
  {
    // `-m`, il maschio: le due forme divergono nelle stat — 112 Att / 80 AttSp
    // contro 92 / 100 — e questo e' un set fisico. Anche l'altro Basculegion
    // in questo file e' il maschio.
    slug: 'basculegion-m',
    label: 'Life Orb Attacker',
    nature: 'Jolly',
    item: 'life orb',
    ability: 'adaptability',
    sps: [4, 30, 0, 0, 0, 32],
    moves: ['wave-crash', 'aqua-jet', 'last-respects', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'basculegion-m',
    label: 'Rain Sweeper',
    nature: 'Adamant',
    ability: 'swift-swim',
    item: 'life orb',
    sps: [4, 18, 11, 0, 1, 32],
    moves: ['last-respects', 'wave-crash', 'aqua-jet', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'blastoise',
    label: 'Bulky Pivot',
    nature: 'Impish',
    ability: 'rain-dish',
    item: 'leftovers',
    sps: [32, 0, 30, 0, 4, 0],
    moves: ['flip-turn', 'fake-out', 'yawn', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'blastoise-mega',
    label: 'Setup Sweeper',
    nature: 'Modest',
    item: 'blastoisinite',
    // `mega-launcher`, non `rain-dish`. Il set ricevuto dichiarava Pellepioggia
    // perche' in formato Showdown si scrive l'abilita della forma BASE: la
    // megaevoluzione avviene in partita. Nel nostro modello la Mega e una
    // specie a se, e ha Megalancio come unica abilita.
    ability: 'mega-launcher',
    sps: [1, 0, 1, 32, 0, 32],
    moves: ['dark-pulse', 'water-spout', 'shell-smash', 'protect'],
    reg: 'M-B',
  },
  {
    slug: 'blastoise-mega',
    label: 'Trick Room Abuser',
    nature: 'Quiet',
    item: 'blastoisinite',
    // Anche qui `mega-launcher` contro il Pellepioggia dichiarato in Showdown,
    // e qui la differenza si vede nei numeri: Megalancio porta Auraconflusso e
    // Buiosfera al 150%. Con `rain-dish` resterebbe un set che ha scelto due
    // mosse per un'abilita' che non ha.
    ability: 'mega-launcher',
    // Non porta Distortozona: gliela mette il compagno. Da qui «Abuser», come
    // Excadrill con la sabbia e Venusaur col sole, e non «Sweeper».
    sps: [31, 0, 3, 32, 0, 0],
    moves: ['water-spout', 'dark-pulse', 'aura-sphere', 'fake-out'],
    reg: 'M-B',
  },
]

export const PRESETS_BY_SLUG = META_PRESETS.reduce((acc, p) => {
  if (!acc[p.slug]) acc[p.slug] = []
  acc[p.slug].push(p)
  return acc
}, {})