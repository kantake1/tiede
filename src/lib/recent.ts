// 開いた旅行をこのブラウザに記録し、トップページから再訪できるようにする
const KEY = 'tiede:recent'

export type RecentTrip = { id: string; name: string; visitedAt: number }

export function getRecent(): RecentTrip[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function touchRecent(id: string, name: string) {
  const list = [{ id, name, visitedAt: Date.now() }, ...getRecent().filter((r) => r.id !== id)].slice(0, 20)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // 保存できなくても動作に影響しない
  }
}

export function forgetRecent(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(getRecent().filter((r) => r.id !== id)))
  } catch {
    // 同上
  }
}
