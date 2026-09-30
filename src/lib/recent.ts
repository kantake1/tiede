import { loadJson, saveJson } from './storage'

// 開いたグループをこのブラウザに記録し、トップページから再訪できるようにする
const KEY = 'tiede:recent'

export type RecentTrip = { id: string; name: string; visitedAt: number }

export const getRecent = () => loadJson<RecentTrip[]>(KEY, [])

export function touchRecent(id: string, name: string) {
  saveJson(KEY, [{ id, name, visitedAt: Date.now() }, ...getRecent().filter((r) => r.id !== id)].slice(0, 20))
}

export function forgetRecent(id: string) {
  saveJson(KEY, getRecent().filter((r) => r.id !== id))
}
