import { Check, ChevronRight, ChevronUp, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { formatDate, groupByDate } from '../lib/date'
import { yen } from '../lib/format'
import { whoLabel } from '../lib/names'
import { loadFlag, saveFlag } from '../lib/storage'
import { settledOf } from '../lib/settle'
import { computeOwed } from '../lib/split'
import type { Expense } from '../types'
import { OwedSummary } from './SharesEditor'

type Props = {
  expenses: Expense[]
  nameOf: (id: string) => string
  /** メンバーの並び順 (負担額をこの順に表示する) */
  memberIds: string[]
  categoryOf: (id: string | undefined) => string | undefined
  editingId?: string
  onEdit: (e: Expense) => void
  onDelete: (e: Expense) => void
  /** 保存したレシート写真を表示する */
  onShowReceipt: (e: Expense) => void
}

const MODE_LABEL = { equal: '均等', ratio: '比率', amount: '金額指定', items: '品目別' } as const

// 一覧の表示 (コンパクト / フル) を端末に記憶する
const COMPACT_KEY = 'tiede:list-compact'

export function ExpenseList({ expenses, nameOf, memberIds, categoryOf, editingId, onEdit, onDelete, onShowReceipt }: Props) {
  const [compact, setCompact] = useState(() => loadFlag(COMPACT_KEY))
  // コンパクトで開いている1件
  const [openId, setOpenId] = useState<string | null>(null)
  // 「ほかN人」を押して全員の名前を出している品目 (支払い ID:行)
  const [shownNames, setShownNames] = useState<string | null>(null)
  if (expenses.length === 0) return null
  // 削除済みメンバーは末尾
  const order = (id: string) => {
    const i = memberIds.indexOf(id)
    return i < 0 ? memberIds.length : i
  }
  const choose = (next: boolean) => {
    setCompact(next)
    saveFlag(COMPACT_KEY, next)
  }
  const receiptButton = (e: Expense) => (
    <button className="receipt-mark" onClick={() => onShowReceipt(e)} aria-label={`${e.title} のレシートを表示`} title="レシートを表示">
      <ReceiptText size={16} />
    </button>
  )
  return (
    <section className="card">
      <div className="row card-head">
        <h2 className="grow">支払い一覧 ({expenses.length}件)</h2>
        <div className="segmented" role="radiogroup" aria-label="一覧の表示">
          {[
            { value: true, label: 'コンパクト' },
            { value: false, label: 'フル' },
          ].map((o) => (
            <button
              key={o.label}
              role="radio"
              aria-checked={compact === o.value}
              className={compact === o.value ? 'active' : ''}
              onClick={() => choose(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="list">
        {groupByDate(expenses).flatMap(([date, list]) => [
          <li key={date} className="date-head">
            <span>{formatDate(date)}</span>
            <span className="muted">{yen(list.reduce((s, e) => s + e.amount, 0))}</span>
          </li>,
          ...list.map((e) => {
            const owed = computeOwed(e)
            const settled = settledOf(e)
            const settledCount = Object.keys(settled).length
            const category = categoryOf(e.categoryId)
            const open = !compact || openId === e.id
            const meta = (
              <>
                {MODE_LABEL[e.mode]}
                {settledCount > 0 && ` · 受取済み ${settledCount}人`}
              </>
            )
            return (
              <li key={e.id} className={`expense ${e.id === editingId ? 'editing' : ''} ${compact && open ? 'open' : ''}`}>
                {compact ? (
                  <>
                    <button className="c-row" aria-expanded={open} onClick={() => setOpenId(open ? null : e.id)}>
                      <span className="c-title">{e.title}</span>
                      <span className="c-payer">{nameOf(e.payerId)}</span>
                      <span className="grow" />
                      {e.hasReceipt && <ReceiptText size={16} className="muted" aria-label="レシートあり" />}
                      {settledCount > 0 && <Check size={16} className="paid" aria-label="受取済みあり" />}
                      <span className="expense-amount">{yen(e.amount)}</span>
                      {open && <ChevronUp size={16} className="muted" />}
                    </button>
                    {open && (
                      <div className="muted small c-meta">
                        {category && <span className="chip small-chip">{category}</span>}
                        {meta}
                        {e.hasReceipt && receiptButton(e)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="row">
                    <div className="grow">
                      <div className="expense-title">
                        {e.title}
                        {category && <span className="chip small-chip">{category}</span>}
                        {e.hasReceipt && receiptButton(e)}
                      </div>
                      <div className="muted small">
                        {nameOf(e.payerId)} が立替 · {meta}
                      </div>
                    </div>
                    <div className="expense-amount">{yen(e.amount)}</div>
                  </div>
                )}
                {open && e.items && e.items.length > 0 && (
                  <details className="small">
                    <summary>
                      <ChevronRight size={14} className="chevron" /> 品目 ({e.items.length})
                    </summary>
                    <ul className="item-lines">
                      {e.items.map((it, i) => {
                        const ids = [...it.memberIds].sort((a, b) => order(a) - order(b))
                        const key = `${e.id}:${i}`
                        return (
                          <li key={i}>
                            <span className="grow">{it.name}</span>
                            {ids.length > 2 && !memberIds.every((id) => ids.includes(id)) ? (
                              <button
                                className="item-who"
                                aria-expanded={shownNames === key}
                                onClick={() => setShownNames(shownNames === key ? null : key)}
                              >
                                {shownNames === key ? ids.map(nameOf).join('・') : whoLabel(ids, memberIds, nameOf)}
                              </button>
                            ) : (
                              <span className="muted">{whoLabel(ids, memberIds, nameOf)}</span>
                            )}
                            <span>{yen(it.price)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </details>
                )}
                {open && e.memo && <p className="memo">{e.memo}</p>}
                {open && (
                  <div className="row">
                    <div className="grow muted small">
                      <OwedSummary
                        entries={Object.entries(owed)
                          .filter(([, v]) => v > 0)
                          .sort(([a], [b]) => order(a) - order(b))}
                        nameOf={nameOf}
                      />
                      {settledCount > 0 && (
                        <>
                          {' · '}
                          <span className="owed-paid">
                            <Check size={12} aria-hidden /> 受取済み:{' '}
                            {Object.keys(settled)
                              .sort((a, b) => order(a) - order(b))
                              .map(nameOf)
                              .join('・')}
                          </span>
                        </>
                      )}
                    </div>
                    <button className="ghost small" onClick={() => onEdit(e)}>
                      編集
                    </button>
                    <button className="ghost small danger" onClick={() => onDelete(e)}>
                      削除
                    </button>
                  </div>
                )}
              </li>
            )
          }),
        ])}
      </ul>
    </section>
  )
}
