// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { Component } from 'react'
import { withTranslation } from 'react-i18next'

/**
 * ErrorBoundary — cattura crash nei sottoalberi React e mostra una fallback UI.
 * È un class component perché solo le classi supportano componentDidCatch.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    const { t } = this.props
    if (this.state.hasError) {
      return (
        <div className="rounded-xl bg-gray-800 border border-red-700 p-6 my-2 text-sm text-gray-200">
          <p className="font-bold text-red-400 mb-2">⚠ Qualcosa è andato storto</p>
          <details className="text-xs text-gray-400 mb-4 whitespace-pre-wrap font-mono">
            <summary className="cursor-pointer mb-1">{t('editor.error_details')}</summary>
            {this.state.error?.toString()}
          </details>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-semibold"
          >
            Ricarica
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default withTranslation()(ErrorBoundary)