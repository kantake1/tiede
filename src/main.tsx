import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// 本番ビルドのみ Service Worker を登録 (開発中はキャッシュが邪魔になるため)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      // 読み込み済みの JS/CSS (遅延読み込み分を含む) を保存させる
      const send = () =>
        reg.active?.postMessage({
          type: 'cache-urls',
          urls: performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.includes('/assets/')),
        })
      send()
      setTimeout(send, 10000)
    } catch {
      // Service Worker が使えなくても通常どおり動く
    }
  })
}
