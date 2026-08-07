import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
