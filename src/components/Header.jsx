// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { useState } from 'react'
import FiammaLogo from './FiammaLogo'
import { useTranslation } from 'react-i18next'
import { caricaLingua } from '../i18n.js'

const IconGitHub = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482
         0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466
         -.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832
         .092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688
         -.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0
         012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595
         1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012
         2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.021C22 6.484 17.522 2 12 2z"
    />
  </svg>
)

function LangToggle() {
  const { i18n, t } = useTranslation()
  const lang = i18n.language
  const [open, setOpen] = useState(false)

  /**
   * `it.json` non è più nel bundle: si scarica alla prima richiesta. Da qui
   * in poi `caricaLingua` è idempotente, quindi tornare avanti e indietro fra
   * le due lingue non ripete nessuna richiesta.
   *
   * Il menù si chiude subito, senza aspettare: il file pesa poche decine di
   * kB e tenere aperta la tendina durante il caricamento sembrerebbe un
   * blocco.
   */
  const select = (l) => {
    setOpen(false)
    caricaLingua(l).then(() => {
      // `<html lang>` restava fermo su quello di index.html: screen reader e
      // traduttori automatici leggevano la lingua sbagliata.
      document.documentElement.lang = l
    })
    try {
      localStorage.setItem('lang', l)
    } catch {
      // Storage bloccato: la scelta vale per questa sessione e basta.
    }
  }

  const LANGS = [
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  ]
  const current = LANGS.find(l => l.code === lang) || LANGS[0]

  return (
    <div className="relative">
      {/* Il nome accessibile deve CONTENERE il testo visibile («EN»), altrimenti
          chi usa il controllo vocale dice «premi EN» e non succede niente: il
          comando cerca «Cambia lingua». È l'audit label-content-name-mismatch,
          peso 0 — non muove il punteggio, ma è l'unico fra i difetti misurati
          che rende un controllo IRRAGGIUNGIBILE invece che solo anonimo. */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white transition-colors"
        aria-label={`${t('aria.switch_language')} (${current.code.toUpperCase()})`}
      >
        <span>{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
        <span className="text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-50 min-w-27.5">
          {LANGS.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => select(l.code)}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-[11px] hover:bg-gray-700 transition-colors ${l.code === lang ? 'text-white font-bold' : 'text-gray-400'}`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Header() {
  const { t } = useTranslation()
  return (
    <header className="bg-gray-800 border-b border-gray-700 h-12 px-4 flex items-center justify-between shrink-0">

      {/* ── SINISTRA: fiamma + nome inline ── */}
      <div className="flex items-center gap-2 min-w-0">
        <FiammaLogo />
        <span className="text-sm whitespace-nowrap">
          <span className="text-gray-400 font-normal">The Sixth </span>
          <span className="text-white font-medium">Ember</span>
        </span>
        <span className="text-gray-400 hidden lg:inline">|</span>
        <span className="text-gray-400 text-xs hidden lg:inline whitespace-nowrap">
          Champions Damage Calculator
        </span>
      </div>

      {/* ── CENTRO: nav tab — solo Damage Calc, le voci future rimosse ──
          `absolute left-1/2` la centrava rispetto alla FINESTRA, ignorando che
          il titolo a sinistra occupasse già quello spazio. Misurato: la pill
          copriva il titolo di 40 px a 320, **20 a 360**, 5 a 390, e i due si
          separavano solo a 414.
          360 è la larghezza che il banco misura, e il criterio del testo
          tagliato dava zero — perché una sovrapposizione non è un troncamento
          e `scrollWidth` non la vede.
          Da 414 in su resta centrata come prima; sotto, sparisce invece di
          coprire il nome del sito. */}
      <nav className="hidden min-[414px]:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
        <span className="text-xs px-3 py-1 rounded-full bg-teal-800 border border-teal-600 text-teal-200 font-medium">
          Damage Calc
        </span>
      </nav>

      {/* ── DESTRA: toggle lingua + link GitHub ── */}
      <div className="flex items-center gap-2 shrink-0">
        <LangToggle />
        <a
          href="https://github.com/KrAros/vgc-overwhelm"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-white transition-colors"
          aria-label={t("aria.github_repo")}
        >
          <IconGitHub />
        </a>
      </div>

    </header>
  )
}