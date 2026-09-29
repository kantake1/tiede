import { Component, type ReactNode } from 'react'
import { Logo } from './Logo'

/** 描画中の予期しないエラーで画面が真っ白になるのを防ぐ。データは端末とサーバーに残っている */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="container">
        <header className="app-header">
          <a href="/" className="logo">
            <Logo />
          </a>
        </header>
        <div className="card stack">
          <h2>表示中に問題が発生しました</h2>
          <p className="muted">入力済みのデータは保存されています。再読み込みで直ることが多いです。</p>
          <pre className="error small">{this.state.error.message}</pre>
          <button className="primary" onClick={() => location.reload()}>
            再読み込み
          </button>
        </div>
      </div>
    )
  }
}
