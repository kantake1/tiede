import type { Expense, TripData } from '../types'

/** サイドバーのイベント行。key は イベント ID、'' は未分類 */
export type EventRow = { key: string; name: string; total: number }

/**
 * グループ画面に出す内容を、選んだイベント (filter: 空なら全部、'' は未分類) から求める。
 * 精算済み (アーカイブ) のイベントは「すべて」から除き、個別に選べば閲覧できる
 */
export function tripView(data: TripData, filter: string[]) {
  const names = new Map(data.categories.map((c) => [c.id, c.name]))
  // 削除済みイベントを指す支払いは未分類扱い
  const catKey = (e: Expense) => (e.categoryId && names.get(e.categoryId) ? e.categoryId : '')

  const archivedIds = new Set(data.categories.filter((c) => c.archived).map((c) => c.id))
  const active = data.expenses.filter((e) => !archivedIds.has(catKey(e)))
  const visible = filter.length ? data.expenses.filter((e) => filter.includes(catKey(e))) : active

  const withTotal = (r: { key: string; name: string }): EventRow => ({
    ...r,
    total: data.expenses.filter((e) => catKey(e) === r.key).reduce((s, e) => s + e.amount, 0),
  })
  const rows = [
    ...data.categories.filter((c) => !c.archived).map((c) => ({ key: c.id, name: c.name })),
    ...(data.expenses.some((e) => catKey(e) === '') ? [{ key: '', name: '未分類' }] : []),
  ].map(withTotal)
  const archivedRows = data.categories.filter((c) => c.archived).map((c) => withTotal({ key: c.id, name: c.name }))

  const selected = filter.length === 1 ? data.categories.find((c) => c.id === filter[0]) : undefined
  const filterLabel = filter.length
    ? [...rows, ...archivedRows]
        .filter((r) => filter.includes(r.key))
        .map((r) => r.name)
        .join('・')
    : 'すべて'
  // 複数のイベントを選んでいるときは、未精算のものをまとめて精算済みにできる (未分類・アーカイブ済みは除く)
  const selectedActive = data.categories.filter((c) => filter.includes(c.id) && !c.archived)

  return {
    active,
    visible,
    total: active.reduce((s, e) => s + e.amount, 0),
    rows,
    archivedRows,
    /** 1つだけ選んでいるイベント */
    selected,
    /** 新規入力のイベントの初期値 (1つだけ選んだ未精算のイベント) */
    defaultCategoryId: selected && !selected.archived ? selected.id : '',
    filterLabel,
    selectedActive,
    bulk: filter.length >= 2 && selectedActive.length > 0,
  }
}

/** メンバーがどこかの支払いに登場する (立て替え・負担・品目の対象) */
export const isMemberReferenced = (expenses: Expense[], id: string) =>
  expenses.some((e) => e.payerId === id || (e.shares[id] ?? 0) > 0 || e.items?.some((it) => it.memberIds.includes(id)))
