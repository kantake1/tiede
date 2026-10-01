import { useEffect, useState } from 'react'
import { Home } from './pages/Home'
import { Privacy } from './pages/Privacy'
import { TripPage } from './pages/TripPage'
import { Logo } from './components/Logo'

// グループは /t/{id}。ホーム画面に追加したとき、そのページがそのまま開くようにパスで表す
// (以前の #/t/{id} 形式の共有リンクは読み替える)
function parseRoute(): { tripId: string | null } {
  const legacy = location.hash.match(/^#\/t\/([A-Za-z0-9]+)/)
  if (legacy) history.replaceState(null, '', `/t/${legacy[1]}`)
  const m = location.pathname.match(/^\/t\/([A-Za-z0-9]+)/)
  return { tripId: m ? m[1] : null }
}

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  useEffect(() => {
    const onChange = () => setRoute(parseRoute())
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])

  // グループ画面はサイドバー付きの全幅レイアウト
  if (route.tripId) return <TripPage key={route.tripId} tripId={route.tripId} />

  return (
    <div className="container">
      <header className="app-header center">
        <a href="/" className="logo">
          <Logo />
        </a>
      </header>
      {location.pathname === '/privacy' ? (
        <Privacy />
      ) : (
        <>
          <Home />
          <footer className="site-foot">
            <a href="/privacy">プライバシーポリシー</a>
          </footer>
        </>
      )}
    </div>
  )
}
