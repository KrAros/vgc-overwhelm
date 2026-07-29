import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Vitest gira in ambiente node: il motore non tocca il DOM, quindi non
  // serve jsdom. Se un giorno si testeranno i componenti React, quel file
  // potrà dichiarare // @vitest-environment jsdom in testa.
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})