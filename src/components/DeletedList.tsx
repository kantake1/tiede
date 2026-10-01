import { ArrowLeft, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { dateOf, formatDate, toDateKey } from '../lib/date'
import { GRACE_DAYS, purgeableAt } from '../lib/grace'
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

/**
 * 削除済みの支払い。合計・精算には含めず、元に戻すか完全に削除する。
 * 完全な削除は猶予 (7日) が過ぎてから (ルールでも禁止)。それまでは「完全に削除」を出さず、いつから消せるかを書く
 */
export function DeletedList({ expenses, nameOf, categoryOf, onBack, onRestore, onPurge }: Props) {
  // 開いた時点の時刻で判定する (猶予の境目をまたいでも、開き直せば「完全に削除」が出る)
  const [now] = useState(Date.now)
  return (
    <>
      <button className="ghost small with-icon deleted-back" onClick={onBack}>
        <ArrowLeft size={16} /> 支払い一覧
      </button>
      <section className="card">
        <h2>削除済み ({expenses.length}件)</h2>
        <p className="muted small">合計・精算には含めません。削除から{GRACE_DAYS}日たつと完全に削除できます。それまでは誰でも元に戻せます。</p>
        <ul className="list">
          {expenses.map((e) => {
            // 猶予中ならその終わり。過ぎていれば null
            const from = purgeableAt(e)
            const waitUntil = from !== null && from > now ? from : null
            return (
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
                  {waitUntil === null && (
                    <button className="ghost small danger" onClick={() => onPurge(e)}>
                      完全に削除
                    </button>
                  )}
                </div>
                {waitUntil !== null && <div className="muted small purge-wait">{formatDate(toDateKey(new Date(waitUntil)))} から完全に削除できます</div>}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
