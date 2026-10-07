import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  /** Changes on restart, so the panel is mounted fresh. */
  attempt: number
}

/**
 * Keeps a voice panel problem from taking down the game: shows a friendly message and a way to
 * restart the panel. The game state is untouched (it lives above this boundary).
 */
export class VoicePanelBoundary extends Component<Props, State> {
  state: State = { hasError: false, attempt: 0 }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Voice panel error:', error, info.componentStack)
  }

  restart = () => this.setState((s) => ({ hasError: false, attempt: s.attempt + 1 }))

  render() {
    if (this.state.hasError) {
      return (
        <section className="voice-panel voice-panel--error" role="alert" aria-label="Voice panel problem">
          <p className="voice-panel__error-text">
            🎙️ The voice panel ran into a problem. Your trip is safe: nothing was lost.
          </p>
          <button type="button" className="button button--sunset button--md" onClick={this.restart}>
            Restart the voice panel
          </button>
        </section>
      )
    }
    return <div key={this.state.attempt}>{this.props.children}</div>
  }
}
