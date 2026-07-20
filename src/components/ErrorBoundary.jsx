import { Component } from 'react'

/**
 * ErrorBoundary — cattura crash nei sottoalberi React e mostra una fallback UI.
 * È un class component perché solo le classi supportano componentDidCatch.
 *
 * Uso:
 *   <ErrorBoundary><ComponenteChePuòCrashare /></ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  // Viene chiamato quando un figlio lancia un'eccezione.
  // Aggiorna lo state in modo che il prossimo render mostri la fallback UI.
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  // Opzionale: log dell'errore (utile in futuro per Sentry o simili).
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl bg-gray-800 border border-red-700 p-6 my-2 text-sm text-gray-200">
          <p className="font-bold text-red-400 mb-2">⚠ Qualcosa è andato storto</p>
          <details className="text-xs text-gray-400 mb-4 whitespace-pre-wrap font-mono">
            <summary className="cursor-pointer mb-1">Dettagli errore</summary>
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