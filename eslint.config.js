import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `vendor/` contiene i sorgenti di NCP al commit 7919130, copiati alla
  // lettera e conservati con la loro licenza MIT. Sono il nostro oracolo e la
  // nostra specifica scritta: non li modifichiamo mai, quindi non ha senso
  // applicarci le nostre regole di stile. Senza questa riga `npm run lint`
  // riporta 689 errori di codice altrui e diventa inutilizzabile in CI.
  globalIgnores(['dist', 'vendor']),
  {
    // Gli script di tooling girano in Node, non nel browser: hanno process,
    // console e i moduli node:*. Senza questo blocco `npm run lint` li segnala.
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,jsx,mjs}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // `__APP_VERSION__` la inietta Vite da package.json: a eslint va
      // dichiarata, altrimenti la legge come variabile non definita.
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])