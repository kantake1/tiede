import { parseNumber, yen } from './format'
import type { Item, SplitMode } from '../types'

/** 入力欄の文字列のままの品目 */
export type ItemDraft = { name: string; priceText: string; memberIds: string[] }

export type Draft = {
  title: string
  amountText: string
  payerId: string
  date: string
  mode: SplitMode
  /** 対象者 (equal / ratio / amount)。メンバー順 */
  targets: { id: string; name: string }[]
  /** 比率・金額指定の入力 (メンバー ID → 文字列) */
  values: Record<string, string>
  items: ItemDraft[]
}

export type Built = {
  /** 最初に見つかった入力エラー。空なら保存できる */
  error: string
  amount: number
  shares: Record<string, number>
  items: Item[]
  itemsTotal: number
  /** 金額指定の入力の合計 */
  assigned: number
}

export const MAX_AMOUNT = 100_000_000

const MINUS = /^[-−ー]/

/** 入力から shares / items を組み立てつつ、入力エラーを検出する */
export function buildExpense(d: Draft, memberIds: Set<string>): Built {
  const amount = parseNumber(d.amountText)
  const val = (id: string) => d.values[id] ?? ''
  const shares: Record<string, number> = {}
  const items: Item[] = []
  let error = ''
  if (!d.title.trim()) error = '内容を入力してください'
  else if (!Number.isInteger(amount) || amount <= 0) error = '金額は1円以上の整数で入力してください'
  else if (amount > MAX_AMOUNT) error = '金額は1億円までにしてください'
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) error = '日付を入力してください'
  else if (!memberIds.has(d.payerId)) error = '立て替えた人を選んでください'
  else if (d.mode === 'items') {
    if (d.items.length === 0) error = '品目を1つ以上追加してください'
    for (const [i, it] of d.items.entries()) {
      if (error) break
      const price = parseNumber(it.priceText.trim().replace(MINUS, ''))
      const sign = MINUS.test(it.priceText.trim()) ? -1 : 1
      const ids = it.memberIds.filter((id) => memberIds.has(id))
      if (!it.name.trim()) error = `${i + 1}行目の品名を入力してください`
      else if (!Number.isInteger(price)) error = `「${it.name}」の金額が正しくありません`
      else if (ids.length === 0) error = `「${it.name}」の対象者を選んでください`
      else items.push({ name: it.name.trim(), price: sign * price, memberIds: ids })
    }
    if (!error && items.reduce((s, it) => s + it.price, 0) <= 0) error = '品目の合計が0円以下です'
  } else if (d.targets.length === 0) error = '対象者を1人以上選んでください'
  else {
    for (const m of d.targets) {
      if (d.mode === 'equal') shares[m.id] = 1
      else {
        const raw = val(m.id).trim()
        const v = raw === '' ? (d.mode === 'ratio' ? 1 : NaN) : parseNumber(raw)
        if (Number.isNaN(v) || v < 0 || (d.mode === 'amount' && !Number.isInteger(v))) {
          error = `${m.name} の${d.mode === 'ratio' ? '比率' : '金額'}が正しくありません`
          break
        }
        if (v > 0) shares[m.id] = v
      }
    }
    if (!error && Object.keys(shares).length === 0) error = '負担する人がいません'
  }

  const assigned = d.mode === 'amount' ? d.targets.reduce((s, m) => s + (parseNumber(val(m.id)) || 0), 0) : 0
  if (!error && d.mode === 'amount' && assigned !== amount) {
    error = `指定額の合計 ${yen(assigned)} が金額 ${yen(amount)} と一致しません (${assigned < amount ? '残り' : '超過'} ${yen(Math.abs(amount - assigned))})`
  }

  return { error, amount, shares, items, itemsTotal: items.reduce((s, it) => s + it.price, 0), assigned }
}

/**
 * 金額指定で、金額から入力済みの額を引いた残りを空欄の人で均等に割る (空欄が無ければ対象者全員で割り直す)。
 * 割り切れない分は先頭の人から1円ずつ。割れないときは null
 */
export function fillRemainder(amount: number, targetIds: string[], values: Record<string, string>): Record<string, string> | null {
  const val = (id: string) => values[id] ?? ''
  const blanks = targetIds.filter((id) => val(id).trim() === '')
  const pool = blanks.length ? blanks : targetIds
  const fixed = targetIds.filter((id) => !pool.includes(id)).reduce((s, id) => s + (parseNumber(val(id)) || 0), 0)
  const rest = amount - fixed
  if (!Number.isInteger(amount) || rest < 0 || pool.length === 0) return null
  const each = Math.floor(rest / pool.length)
  const next = { ...values }
  pool.forEach((id, i) => (next[id] = String(each + (i < rest - each * pool.length ? 1 : 0))))
  return next
}
