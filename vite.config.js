import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
  },
})
