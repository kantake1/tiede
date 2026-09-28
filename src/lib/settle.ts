import type { Expense, Member } from '../types'
import { computeOwed } from './split'

export type Balance = {
  memberId: string
  paid: number
  owed: number
  /** 正: 受け取る側 / 負: 支払う側 */
  net: number
}

export type Transfer = {
  from: string
  to: string
  amount: number
}

export function computeBalances(members: Member[], expenses: Expense[]): Balance[] {
  const map = new Map<string, Balance>()
  const get = (id: string) => {
    let b = map.get(id)
    if (!b) {
      b = { memberId: id, paid: 0, owed: 0, net: 0 }
      map.set(id, b)
    }
    return b
  }
  for (const m of members) get(m.id)
  for (const e of expenses) {
    get(e.payerId).paid += e.amount
    for (const [id, v] of Object.entries(computeOwed(e))) get(id).owed += v
  }
  for (const b of map.values()) b.net = b.paid - b.owed
  return [...map.values()]
}

/** 厳密解を求める人数の上限 (2^n の DP)。超える場合は貪欲法。 */
const EXACT_LIMIT = 20

/**
 * 送金回数が最小となる精算方法を求める。
 * 残高合計が0になる部分集合へできるだけ多く分割すると、送金回数は (人数 - 分割数) で最小になる。
 */
export function settle(balances: Balance[]): Transfer[] {
  const people = balances.filter((b) => b.net !== 0).map((b) => ({ id: b.memberId, net: b.net }))
  if (people.length === 0) return []
  if (people.length > EXACT_LIMIT) return greedy(people)

  const n = people.length
  const size = 1 << n
  const sum = new Float64Array(size)
  const dp = new Int32Array(size)
  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask
    const bit = 31 - Math.clz32(low)
    sum[mask] = sum[mask ^ low] + people[bit].net
    let best = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        const v = dp[mask ^ (1 << i)]
        if (v > best) best = v
      }
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0)
  }

  // 復元: 全体集合から要素を1つずつ取り除き、和が0になる境界でグループを区切る
  const groups: { id: string; net: number }[][] = []
  let mask = size - 1
  let current: { id: string; net: number }[] = []
  while (mask) {
    if (sum[mask] === 0 && current.length > 0) {
      groups.push(current)
      current = []
    }
    let pick = -1
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i) && (pick < 0 || dp[mask ^ (1 << i)] > dp[mask ^ (1 << pick)])) pick = i
    }
    current.push(people[pick])
    mask ^= 1 << pick
  }
  if (current.length > 0) groups.push(current)

  return groups.flatMap(greedy)
}

/** 最大の債務者と最大の債権者を順に突き合わせる。k人のグループに対し最大 k-1 回。 */
function greedy(people: { id: string; net: number }[]): Transfer[] {
  const debtors = people.filter((p) => p.net < 0).map((p) => ({ id: p.id, amt: -p.net }))
  const creditors = people.filter((p) => p.net > 0).map((p) => ({ id: p.id, amt: p.net }))
  const transfers: Transfer[] = []
  const byAmt = (a: { amt: number }, b: { amt: number }) => b.amt - a.amt
  while (debtors.length && creditors.length) {
    debtors.sort(byAmt)
    creditors.sort(byAmt)
    const d = debtors[0]
    const c = creditors[0]
    const amt = Math.min(d.amt, c.amt)
    transfers.push({ from: d.id, to: c.id, amount: amt })
    d.amt -= amt
    c.amt -= amt
    if (d.amt === 0) debtors.shift()
    if (c.amt === 0) creditors.shift()
  }
  return transfers
}
