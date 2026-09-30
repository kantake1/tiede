import { describe, expect, it } from 'vitest'
import { isMemberReferenced, tripView } from './tripView'
import type { Expense, TripData } from '../types'

const ex = (id: string, amount: number, categoryId?: string, more: Partial<Expense> = {}): Expense => ({
  id,
  title: id,
  amount,
  payerId: 'a',
  mode: 'equal',
  shares: { a: 1 },
  categoryId,
  createdAt: 0,
  ...more,
})
const data: TripData = {
  trip: { id: 't', name: 'G', createdAt: 0 },
  members: [],
  categories: [
    { id: 'okinawa', name: '沖縄', archived: false, createdAt: 1 },
    { id: 'nomi', name: '飲み会', archived: false, createdAt: 2 },
    { id: 'old', name: '忘年会', archived: true, createdAt: 3 },
  ],
  // gone: 削除済みイベントを指す → 未分類
  expenses: [ex('e1', 1000, 'okinawa'), ex('e2', 200, 'nomi'), ex('e3', 30, 'old'), ex('e4', 4, undefined), ex('e5', 5, 'gone')],
}
const idsOf = (es: Expense[]) => es.map((e) => e.id)

describe('tripView', () => {
  it('すべて: アーカイブを除き、未分類の行を足す', () => {
    const v = tripView(data, [])
    expect(idsOf(v.visible)).toEqual(['e1', 'e2', 'e4', 'e5'])
    expect(v.total).toBe(1209)
    expect(v.rows).toEqual([
      { key: 'okinawa', name: '沖縄', total: 1000 },
      { key: 'nomi', name: '飲み会', total: 200 },
      { key: '', name: '未分類', total: 9 },
    ])
    expect(v.archivedRows).toEqual([{ key: 'old', name: '忘年会', total: 30 }])
    expect(v.filterLabel).toBe('すべて')
    expect(v.selected).toBeUndefined()
    expect(v.defaultCategoryId).toBe('')
    expect(v.bulk).toBe(false)
  })

  it('1つ選ぶと新規入力の初期値になる (アーカイブ済みは除く)', () => {
    expect(tripView(data, ['okinawa'])).toMatchObject({ defaultCategoryId: 'okinawa', filterLabel: '沖縄' })
    const old = tripView(data, ['old'])
    expect(idsOf(old.visible)).toEqual(['e3'])
    expect(old.selected?.id).toBe('old')
    expect(old.defaultCategoryId).toBe('')
    expect(idsOf(tripView(data, ['']).visible)).toEqual(['e4', 'e5'])
  })

  it('複数選ぶとまとめて精算済みにできる', () => {
    const v = tripView(data, ['okinawa', '', 'old'])
    expect(v.filterLabel).toBe('沖縄・未分類・忘年会')
    expect(v.selectedActive.map((c) => c.id)).toEqual(['okinawa'])
    expect(v.bulk).toBe(true)
    expect(tripView(data, ['', 'old']).bulk).toBe(false)
  })

  it('未分類の支払いが無ければ未分類の行は出さない', () => {
    expect(tripView({ ...data, expenses: [ex('e1', 1, 'okinawa')] }, []).rows.map((r) => r.key)).toEqual(['okinawa', 'nomi'])
  })
})

describe('isMemberReferenced', () => {
  const es = [ex('e1', 1, undefined, { payerId: 'p', shares: { s: 1, z: 0 }, items: [{ name: 'x', price: 1, memberIds: ['i'] }] })]
  it('立て替え・負担・品目の対象のどれかに登場する', () => {
    expect(['p', 's', 'i'].map((id) => isMemberReferenced(es, id))).toEqual([true, true, true])
    expect(['z', 'n'].map((id) => isMemberReferenced(es, id))).toEqual([false, false])
  })
})
