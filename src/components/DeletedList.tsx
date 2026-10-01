import { ArrowLeft, ReceiptText } from 'lucide-react'
import { dateOf, formatDate, toDateKey } from '../lib/date'
import { yen } from '../lib/format'
import { computeOwed } from '../lib/split'
import type { Expense } from '../types'

type Props = {
  expenses: Expense[]
  nameOf: (id: string) => string
  categoryOf: (id: string | undefined) => string | undefined
  onBack: () => void
  onRestore: (e: Expense) => void
  onPurge: (e: Expense) => void
}

/** 削除済みの支払い。合計・精算には含めず、元に戻すか完全に削除する */
export function DeletedList({ expenses, nameOf, categoryOf, onBack, onRestore, onPurge }: Props) {
  return (
    <>
      <button className="ghost small with-icon deleted-back" onClick={onBack}>
        <ArrowLeft size={16} /> 支払い一覧
      </button>
      <section className="card">
        <h2>削除済み ({expenses.length}件)</h2>
        <p className="muted small">合計・精算には含めません。完全に削除するまで残ります。</p>
        <ul className="list">
          {expenses.map((e) => (
            <li key={e.id} className="expense deleted">
              <div className="row">
                <div className="grow">
                  <div className="expense-title">
                    {e.title}
                    {categoryOf(e.categoryId) && <span className="chip small-chip">{categoryOf(e.categoryId)}</span>}
                    {e.hasReceipt && <ReceiptText size={16} aria-label="レシートあり" />}
                  </div>
                  <div className="muted small">
                    {formatDate(dateOf(e))} の支払い · {formatDate(toDateKey(new Date(e.deletedAt!)))} に削除
                  </div>
                </div>
                <div className="expense-amount">{yen(e.amount)}</div>
              </div>
              <div className="row">
                <div className="grow muted small">
                  {nameOf(e.payerId)} が立替 ·{' '}
                  {Object.entries(computeOwed(e))
                    .filter(([, v]) => v > 0)
                    .map(([id, v]) => `${nameOf(id)} ${yen(v)}`)
                    .join(' / ')}
                </div>
                <button className="ghost small" onClick={() => onRestore(e)}>
                  元に戻す
                </button>
                <button className="ghost small danger" onClick={() => onPurge(e)}>
                  完全に削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
