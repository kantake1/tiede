import type { Expense } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')

/** 端末のローカル日付で YYYY-MM-DD */
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = () => toDateKey(new Date())

/** 日付の無い古い支払いは作成日時の日付で扱う */
export const dateOf = (e: Pick<Expense, 'date' | 'createdAt'>) => e.date ?? toDateKey(new Date(e.createdAt))

const WEEK = '日月火水木金土'

/** 2026-09-28 → 9月28日(月)。年が違えば年も付ける */
export function formatDate(key: string, now = new Date()): string {
  const [y, m, d] = key.split('-').map(Number)
  const w = WEEK[new Date(y, m - 1, d).getDay()]
  return `${y === now.getFullYear() ? '' : `${y}年`}${m}月${d}日(${w})`
}

/** 日付の新しい順にまとめる。同じ日の中は登録の新しい順 */
export function groupByDate<T extends Pick<Expense, 'date' | 'createdAt'>>(list: T[]): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const e of [...list].sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || b.createdAt - a.createdAt)) {
    const k = dateOf(e)
    map.set(k, [...(map.get(k) ?? []), e])
  }
  return [...map]
}
