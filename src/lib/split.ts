import type { Expense } from '../types'

/**
 * 1件の支払いについて各メンバーの負担額(整数円)を返す。
 * 端数は支払者が負担するため、合計は常に expense.amount と一致する。
 */
export function computeOwed(expense: Pick<Expense, 'amount' | 'payerId' | 'mode' | 'shares' | 'items'>): Record<string, number> {
  const owed: Record<string, number> = {}
  const entries = Object.entries(expense.shares).filter(([, v]) => v > 0)

  if (expense.mode === 'items') {
    // 品目ごとに対象者で均等割りした小計を求め、税・値引などの差額は小計に比例して配分する
    const base: Record<string, number> = {}
    for (const it of expense.items ?? []) {
      for (const id of it.memberIds) base[id] = (base[id] ?? 0) + it.price / it.memberIds.length
    }
    const itemsTotal = Object.values(base).reduce((s, v) => s + v, 0)
    if (itemsTotal > 0) {
      for (const [id, v] of Object.entries(base)) owed[id] = Math.floor((v * expense.amount) / itemsTotal + 1e-9)
    }
  } else if (expense.mode === 'amount') {
    for (const [id, v] of entries) owed[id] = Math.round(v)
  } else {
    const weights = expense.mode === 'equal' ? entries.map(([id]) => [id, 1] as const) : entries
    const total = weights.reduce((s, [, w]) => s + w, 0)
    if (total > 0) {
      for (const [id, w] of weights) {
        owed[id] = Math.floor((expense.amount * w) / total + 1e-9)
      }
    }
  }

  const assigned = Object.values(owed).reduce((s, v) => s + v, 0)
  const remainder = expense.amount - assigned
  if (remainder !== 0) {
    owed[expense.payerId] = (owed[expense.payerId] ?? 0) + remainder
  }
  return owed
}
