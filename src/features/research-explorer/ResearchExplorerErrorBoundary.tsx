import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AppLink } from '../../routing'

type State = { error: Error | null }

export class ResearchExplorerErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Research Explorer render failure', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="research-page research-fatal-error">
        <h1>Research Explorerを表示できません</h1>
        <p>{this.state.error.message}</p>
        <button onClick={() => this.setState({ error: null })}>再試行</button>
        <AppLink to="/">Prompt Builderへ戻る</AppLink>
      </main>
    )
  }
}
