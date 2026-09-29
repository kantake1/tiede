import { describe, expect, it } from 'vitest'
import type { Expense, Member } from '../types'
import { computeBalances, settle, type Transfer } from './settle'
import { computeOwed } from './split'

const members = (...names: string[]): Member[] => names.map((n) => ({ id: n, name: n, createdAt: 0 }))
let seq = 0
const exp = (e: Omit<Expense, 'id' | 'createdAt' | 'title'>): Expense => ({ id: String(seq++), title: '', createdAt: 0, ...e })

function apply(transfers: Transfer[], nets: Record<string, number>) {
  const r = { ...nets }
  for (const t of transfers) {
    r[t.from] += t.amount
    r[t.to] -= t.amount
  }
  return r
}

describe('computeOwed', () => {
  it('均等割りの端数は支払者が負担する', () => {
    expect(computeOwed({ amount: 1000, payerId: 'A', mode: 'equal', shares: { A: 1, B: 1, C: 1 } })).toEqual({ A: 334, B: 333, C: 333 })
  })

  it('支払者が対象外でも端数は支払者が負担する', () => {
    expect(computeOwed({ amount: 1000, payerId: 'A', mode: 'equal', shares: { B: 1, C: 1, D: 1 } })).toEqual({ A: 1, B: 333, C: 333, D: 333 })
  })

  it('比率で按分する', () => {
    expect(computeOwed({ amount: 10000, payerId: 'A', mode: 'ratio', shares: { A: 2, B: 1, C: 1 } })).toEqual({ A: 5000, B: 2500, C: 2500 })
    expect(computeOwed({ amount: 1000, payerId: 'B', mode: 'ratio', shares: { A: 1.5, B: 1 } })).toEqual({ A: 600, B: 400 })
  })

  it('金額指定はそのまま使う', () => {
    expect(computeOwed({ amount: 3000, payerId: 'A', mode: 'amount', shares: { A: 1000, B: 2000 } })).toEqual({ A: 1000, B: 2000 })
  })

  it('0以下の比率は対象外', () => {
    expect(computeOwed({ amount: 900, payerId: 'A', mode: 'ratio', shares: { A: 1, B: 0, C: 2 } })).toEqual({ A: 300, C: 600 })
  })
})

describe('settle', () => {
  it('残高が全員0になり、合計負担額が支払総額と一致する', () => {
    const ms = members('A', 'B', 'C', 'D')
    const es = [
      exp({ amount: 12000, payerId: 'A', mode: 'equal', shares: { A: 1, B: 1, C: 1, D: 1 } }),
      exp({ amount: 5000, payerId: 'B', mode: 'equal', shares: { B: 1, C: 1 } }),
      exp({ amount: 7777, payerId: 'C', mode: 'ratio', shares: { A: 1, B: 2, D: 3 } }),
    ]
    const bs = computeBalances(ms, es)
    expect(bs.reduce((s, b) => s + b.owed, 0)).toBe(24777)
    expect(bs.reduce((s, b) => s + b.net, 0)).toBe(0)
    const nets = Object.fromEntries(bs.map((b) => [b.memberId, b.net]))
    const after = apply(settle(bs), nets)
    expect(Object.values(after).every((v) => v === 0)).toBe(true)
  })

  it('精算不要なら送金なし', () => {
    const ms = members('A', 'B')
    const es = [
      exp({ amount: 1000, payerId: 'A', mode: 'equal', shares: { A: 1, B: 1 } }),
      exp({ amount: 1000, payerId: 'B', mode: 'equal', shares: { A: 1, B: 1 } }),
    ]
    expect(settle(computeBalances(ms, es))).toEqual([])
  })

  it('相殺できるペアを見つけて送金回数を最小化する', () => {
    // {A,D},{B,E},{C,F} の3組に分かれる
    const bs = [
      { memberId: 'A', paid: 0, owed: 0, net: 5 },
      { memberId: 'B', paid: 0, owed: 0, net: 4 },
      { memberId: 'C', paid: 0, owed: 0, net: 3 },
      { memberId: 'D', paid: 0, owed: 0, net: -5 },
      { memberId: 'E', paid: 0, owed: 0, net: -4 },
      { memberId: 'F', paid: 0, owed: 0, net: -3 },
    ]
    const ts = settle(bs)
    expect(ts).toHaveLength(3)
    const after = apply(ts, Object.fromEntries(bs.map((b) => [b.memberId, b.net])))
    expect(Object.values(after).every((v) => v === 0)).toBe(true)
  })

  it('貪欲法では最適にならないケースでも最小回数になる', () => {
    // 貪欲: 最大債務者-8 と最大債権者+6 → 4 回。最適: {+6,-6},{+5,+3,-8} → 3 回
    const nets: Record<string, number> = { A: 6, B: 5, C: 3, D: -8, E: -6 }
    const bs = Object.entries(nets).map(([memberId, net]) => ({ memberId, paid: 0, owed: 0, net }))
    const ts = settle(bs)
    expect(ts).toHaveLength(3)
    expect(Object.values(apply(ts, nets)).every((v) => v === 0)).toBe(true)
  })

  it('ランダムケースで常に精算が完了する', () => {
    for (let t = 0; t < 200; t++) {
      const n = 2 + (t % 9)
      const ids = Array.from({ length: n }, (_, i) => `m${i}`)
      const es = Array.from({ length: 1 + (t % 7) }, (_, k) =>
        exp({
          amount: 1 + ((t * 7919 + k * 104729) % 50000),
          payerId: ids[(t + k) % n],
          mode: 'equal',
          shares: Object.fromEntries(ids.filter((_, i) => (i + k + t) % 3 !== 0 || i === 0).map((id) => [id, 1])),
        }),
      )
      const bs = computeBalances(members(...ids), es)
      const nets = Object.fromEntries(bs.map((b) => [b.memberId, b.net]))
      const ts = settle(bs)
      expect(ts.every((x) => x.amount > 0)).toBe(true)
      expect(ts.length).toBeLessThanOrEqual(Math.max(0, bs.filter((b) => b.net !== 0).length - 1))
      expect(Object.values(apply(ts, nets)).every((v) => v === 0)).toBe(true)
    }
  })
})

describe('computeOwed (品目別)', () => {
  const items = (...xs: [string, number, string[]][]) => xs.map(([name, price, memberIds]) => ({ name, price, memberIds }))

  it('品目ごとに対象者で割る', () => {
    expect(
      computeOwed({ amount: 3000, payerId: 'A', mode: 'items', shares: {}, items: items(['ビール', 1000, ['A', 'B']], ['刺身', 2000, ['B']]) }),
    ).toEqual({ A: 500, B: 2500 })
  })

  it('外税の差額は小計に比例して配分し、端数は支払者', () => {
    // 小計 A:1000 B:2000、総額 3300 → A:1100 B:2200
    expect(
      computeOwed({ amount: 3300, payerId: 'A', mode: 'items', shares: {}, items: items(['a', 1000, ['A']], ['b', 2000, ['B']]) }),
    ).toEqual({ A: 1100, B: 2200 })
    // 3人割り 1000円 → 333.33.. ずつ、端数1円は支払者C
    expect(
      computeOwed({ amount: 1000, payerId: 'C', mode: 'items', shares: {}, items: items(['a', 1000, ['A', 'B', 'C']]) }),
    ).toEqual({ A: 333, B: 333, C: 334 })
  })

  it('値引き品目 (負の価格) を含んでも合計は総額と一致する', () => {
    const owed = computeOwed({
      amount: 2500,
      payerId: 'A',
      mode: 'items',
      shares: {},
      items: items(['a', 2000, ['A', 'B']], ['b', 1000, ['B']], ['値引', -500, ['A', 'B']]),
    })
    expect(Object.values(owed).reduce((s, v) => s + v, 0)).toBe(2500)
    expect(owed).toEqual({ A: 750, B: 1750 })
  })
})
