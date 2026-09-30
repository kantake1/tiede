import { describe, expect, it } from 'vitest'
import { buildExpense, fillRemainder, type Draft } from './expenseDraft'

const A = { id: 'a', name: 'たろう' }
const B = { id: 'b', name: 'はなこ' }
const C = { id: 'c', name: 'じろう' }
const ids = new Set(['a', 'b', 'c'])
const draft = (d: Partial<Draft>): Draft => ({
  title: '夕食',
  amountText: '9000',
  payerId: 'a',
  date: '2026-09-01',
  mode: 'equal',
  targets: [A, B, C],
  values: {},
  items: [],
  ...d,
})
const errorOf = (d: Partial<Draft>) => buildExpense(draft(d), ids).error

describe('buildExpense', () => {
  it('均等: 対象者に1ずつ', () => {
    expect(buildExpense(draft({ targets: [A, C] }), ids)).toMatchObject({ error: '', amount: 9000, shares: { a: 1, c: 1 }, items: [] })
  })

  it('比率: 空欄は1、0は負担なし、全角も読む', () => {
    const r = buildExpense(draft({ mode: 'ratio', values: { a: '２', b: '0' } }), ids)
    expect(r.error).toBe('')
    expect(r.shares).toEqual({ a: 2, c: 1 })
  })

  it('金額指定: 合計の一致を確かめる', () => {
    const r = buildExpense(draft({ mode: 'amount', values: { a: '3000', b: '3000', c: '2000' } }), ids)
    expect(r.assigned).toBe(8000)
    expect(r.error).toBe('指定額の合計 ¥8,000 が金額 ¥9,000 と一致しません (残り ¥1,000)')
    expect(errorOf({ mode: 'amount', values: { a: '5000', b: '5000', c: '0' } })).toMatch('(超過 ¥1,000)')
    expect(buildExpense(draft({ mode: 'amount', values: { a: '4000', b: '5000', c: '0' } }), ids)).toMatchObject({
      error: '',
      shares: { a: 4000, b: 5000 },
    })
    expect(errorOf({ mode: 'amount', values: { a: '1.5' } })).toBe('たろう の金額が正しくありません')
  })

  it('品目: 負の金額 (値引)、削除済みメンバーを除く', () => {
    const r = buildExpense(
      draft({
        mode: 'items',
        items: [
          { name: ' 牛乳 ', priceText: '250', memberIds: ['a', 'x'] },
          { name: '値引', priceText: '−50', memberIds: ['b'] },
        ],
      }),
      ids,
    )
    expect(r.error).toBe('')
    expect(r.items).toEqual([
      { name: '牛乳', price: 250, memberIds: ['a'] },
      { name: '値引', price: -50, memberIds: ['b'] },
    ])
    expect(r.itemsTotal).toBe(200)
  })

  it('入力エラーは上から順に1つ', () => {
    expect(errorOf({ title: ' ' })).toBe('内容を入力してください')
    expect(errorOf({ amountText: '0' })).toBe('金額は1円以上の整数で入力してください')
    expect(errorOf({ amountText: '100000001' })).toBe('金額は1億円までにしてください')
    expect(errorOf({ date: '' })).toBe('日付を入力してください')
    expect(errorOf({ payerId: 'x' })).toBe('立て替えた人を選んでください')
    expect(errorOf({ targets: [] })).toBe('対象者を1人以上選んでください')
    expect(errorOf({ mode: 'ratio', values: { a: '0', b: '0', c: '0' } })).toBe('負担する人がいません')
    expect(errorOf({ mode: 'items' })).toBe('品目を1つ以上追加してください')
    expect(errorOf({ mode: 'items', items: [{ name: '', priceText: '1', memberIds: ['a'] }] })).toBe('1行目の品名を入力してください')
    expect(errorOf({ mode: 'items', items: [{ name: 'パン', priceText: 'x', memberIds: ['a'] }] })).toBe('「パン」の金額が正しくありません')
    expect(errorOf({ mode: 'items', items: [{ name: 'パン', priceText: '1', memberIds: ['x'] }] })).toBe('「パン」の対象者を選んでください')
    expect(errorOf({ mode: 'items', items: [{ name: '値引', priceText: '-1', memberIds: ['a'] }] })).toBe('品目の合計が0円以下です')
  })
})

describe('fillRemainder', () => {
  it('残りを空欄の人で割り、端数は先頭から1円ずつ', () => {
    expect(fillRemainder(10000, ['a', 'b', 'c'], { a: '3000', b: '' })).toEqual({ a: '3000', b: '3500', c: '3500' })
    expect(fillRemainder(10, ['a', 'b', 'c'], {})).toEqual({ a: '4', b: '3', c: '3' })
  })
  it('空欄が無ければ全員で割り直す', () => {
    expect(fillRemainder(100, ['a', 'b'], { a: '10', b: '10' })).toEqual({ a: '50', b: '50' })
  })
  it('割れないときは null', () => {
    expect(fillRemainder(100, ['a', 'b'], { a: '200', b: '' })).toBeNull()
    expect(fillRemainder(NaN, ['a'], {})).toBeNull()
    expect(fillRemainder(100, [], {})).toBeNull()
  })
})
