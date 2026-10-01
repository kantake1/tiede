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

/** 履歴からの削除を取り消す。開いた日時の新しい順に戻す */
export function restoreRecent(r: RecentTrip) {
  saveJson(KEY, [r, ...getRecent().filter((x) => x.id !== r.id)].sort((a, b) => b.visitedAt - a.visitedAt).slice(0, 20))
}
