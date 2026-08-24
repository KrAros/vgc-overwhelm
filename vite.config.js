import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { CAMPI_POTATI, pota } from './scripts/potatura-dati.mjs'

/**
 * ─── LA VERSIONE HA UNA FONTE SOLA ───────────────────────────────────────────
 *
 * Si legge da `package.json` e si inietta come costante. Scriverla anche nel
 * JSX vorrebbe dire due numeri da tenere allineati a mano — cioè la forma di
 * difetto che questo repository ha già incontrato con le etichette delle mosse,
 * con la conversione SP⇄EV e con le regole sulle abilità. `marca.test.js`
 * verifica che i due non divergano.
 */
const VERSIONE = JSON.parse(readFileSync('./package.json', 'utf8')).version

/**
 * ─── LA POTATURA DEI DATI ────────────────────────────────────────────────────
 *
 * Toglie dal bundle i campi che nessuna riga di `src/` legge. L'elenco — e il
 * perché di ogni voce — sta in `scripts/potatura-dati.mjs`, che è anche quello
 * che rilegge `potaturaDati.test.js`: una fonte sola, letta dal build e dalla
 * rete che lo sorveglia.
 *
 * `apply: 'build'` di proposito. In sviluppo e nei test i file restano interi,
 * così `gen-flag-dati.mjs` e chiunque apra il JSON vedono il dato vero; è il
 * bundle a viaggiare magro. Il prezzo di questa scelta è che la potatura non
 * si vede finché non si pubblica — ed è per questo che la rete è un test
 * statico su `src/`, non un test di comportamento.
 *
 * `enforce: 'pre'` perché deve arrivare prima del plugin JSON di Vite: qui si
 * restituisce ancora testo JSON, che poi Vite trasforma in modulo.
 */
function potaturaDati() {
  return {
    name: 'sixth-ember:potatura-dati',
    enforce: 'pre',
    apply: 'build',
    load(id) {
      const percorso = id.split('?')[0]
      if (!percorso.includes('/src/data/')) return null
      const nome = basename(percorso)
      if (!CAMPI_POTATI[nome]) return null
      return JSON.stringify(pota(nome, JSON.parse(readFileSync(percorso, 'utf8'))))
    },
  }
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(VERSIONE) },
  /**
   * ─── IL PERCORSO BASE ──────────────────────────────────────────────────────
   * Su GitHub Pages un repository di progetto non vive alla radice del dominio
   * ma sotto il proprio nome: `krAros.github.io/vgc-overwhelm/`. Senza questa
   * riga il build cerca `/assets/index-xxx.js` alla radice, non lo trova, e la
   * pagina esce **bianca** — con la build verde e nessun errore.
   *
   * Vale anche in sviluppo, di proposito. Tenerlo solo in produzione farebbe
   * girare `npm run dev` alla radice e nasconderebbe fino al deploy proprio la
   * classe di difetti che questa riga esiste per evitare. Il server di sviluppo
   * stampa l'indirizzo completo all'avvio, quindi non c'è niente da indovinare.
   *
   * Il giorno in cui il sito passa a `sixthember.gg` questa riga torna a `'/'`
   * e si aggiunge `public/CNAME`.
   */
  base: '/vgc-overwhelm/',

  plugins: [
    potaturaDati(),
    react(),
    tailwindcss(),
  ],

  build: {
    rollupOptions: {
      output: {
        /**
         * ─── PERCHÉ SEPARARE I DATI DAL CODICE ─────────────────────────────
         * `manualChunks` **non riduce il totale**: misurato, i byte sono gli
         * stessi prima e dopo. Quello che cambia è la cache.
         *
         * Il Pokédex, le mosse, gli strumenti e le abilità sono 390 kB che
         * cambiano quando arriva una patch di Champions, cioè raramente.
         * Il codice dell'app cambia a ogni deploy. Finché stavano nello
         * stesso chunk, correggere una riga di React invalidava anche i 390
         * kB di dati, e chi tornava li riscaricava per intero.
         *
         * Separati, un deploy normale fa riscaricare solo il chunk
         * d'ingresso: misurato, 146 kB grezzi invece di 778.
         *
         * `vendor` sta a parte per lo stesso motivo, con una scadenza ancora
         * più lunga: React e zustand cambiano quando si aggiorna una
         * dipendenza.
         */
        manualChunks(id) {
          // ⚠️ `it.json` NON va nominato qui. Assegnare un chunk a un modulo
          // importato dinamicamente lo rende eager: misurato, includere
          // `/src/locales/` faceva finire il locale italiano dentro `dati`
          // e portava il totale gzip da 210,2 a 233,0 kB — cioè annullava il
          // caricamento pigro senza che nessun singolo numero della build
          // sembrasse sbagliato. Si vede solo sommando i chunk.
          if (id.includes('/src/data/') || id.endsWith('locales/en.json')) return 'dati'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },

  // Vitest gira in ambiente node: il motore non tocca il DOM, quindi non
  // serve jsdom. Se un giorno si testeranno i componenti React, quel file
  // potrà dichiarare // @vitest-environment jsdom in testa.
  //
  // Eccezione già presente: `prestazioni.test.jsx` renderizza DamageTable con
  // `react-dom/server`, che in node funziona senza DOM.
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],

    /**
     * ─── QUATTRO WORKER, MISURATI ─────────────────────────────────────────
     *
     * Vitest ne apre uno per CPU meno una: qui dodici CPU, quindi undici. Ma
     * ogni worker importa per conto suo `pokemon.json` (328 kB), `moves.json`,
     * React e il motore — e la macchina ha 6,7 GB con circa 650 MB liberi.
     * Undici worker la mandano in thrashing.
     *
     * Il sintomo non era la lentezza: erano `Hook timed out in 10000ms` su
     * `accessibilitaEditor` e `prestazioni`, con interi file che non
     * arrivavano a girare. La sessione S l'aveva registrato come «tre test
     * sensibili al carico»; misurato, la suite falliva in QUATTRO corse su
     * cinque a macchina scarica, e passava per caso.
     *
     * Alzare `hookTimeout` sarebbe stata la cura sbagliata: avrebbe reso più
     * lenta una suite che stava annaspando, senza toglierle la causa.
     *
     * Misurato, tre corse per livello:
     *
     *    2 worker   3/3 verdi · 18,3 s
     *    4 worker   3/3 verdi · 10,7 s   ← qui
     *    6 worker   2/3 verdi · 11,8 s
     *    8 worker   1/3 verdi · 23,1 s
     *
     * Sopra quattro diventa insieme inaffidabile e più lenta. I tempi assoluti
     * ballano con la memoria libera del momento; l'ordine e la soglia no.
     *
     * Il numero è scelto su QUESTA macchina. Un runner con più memoria ne
     * reggerebbe di più — ma quelli di GitHub hanno quattro CPU, quindi qui
     * non lascia niente sul tavolo.
     */
    maxWorkers: 4,
  },
})
