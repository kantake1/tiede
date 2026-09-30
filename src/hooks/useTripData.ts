import { useEffect, useState } from 'react'
import { touchRecent } from '../lib/recent'
import { getStore, type TripStore } from '../store'
import type { TripData } from '../types'

/**
 * グループのデータを購読する。data: undefined は読み込み中、null は存在しない。
 * slow: 読み込みが長引いている (圏外で初めて開いたグループなど)。online: 端末の通信状態
 */
export function useTripData(tripId: string) {
  const [store, setStore] = useState<TripStore>()
  const [data, setData] = useState<TripData | null>()
  const [error, setError] = useState('')
  const [online, setOnline] = useState(() => navigator.onLine)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // 送信待ちの変更があるうちにタブを閉じようとしたら確認する (端末には残るが、次に開くまで他の人に届かない)
  const pending = !!data?.pending
  useEffect(() => {
    if (!pending) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pending])

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [tripId])

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    getStore().then((s) => {
      if (cancelled) return
      setStore(s)
      unsub = s.subscribe(tripId, setData, (e) => setError(e.message))
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [tripId])

  useEffect(() => {
    if (data) {
      touchRecent(tripId, data.trip.name)
      document.title = `${data.trip.name} - おあいこ`
    }
  }, [tripId, data])

  return { store, data, error, online, slow }
}
