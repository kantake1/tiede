import { useEffect, useState } from 'react'
import { Home } from './pages/Home'
import { TripPage } from './pages/TripPage'

function parseHash(): { tripId: string | null } {
  const m = location.hash.match(/^#\/t\/([A-Za-z0-9]+)/)
  return { tripId: m ? m[1] : null }
}

export default function App() {
  const [route, setRoute] = useState(parseHash)
  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  // グループ画面はサイドバー付きの全幅レイアウト
  if (route.tripId) return <TripPage key={route.tripId} tripId={route.tripId} />

  return (
    <div className="container">
      <header className="app-header">
        <a href="#/" className="logo">
          旅費精算
        </a>
      </header>
      <Home />
    </div>
  )
}
