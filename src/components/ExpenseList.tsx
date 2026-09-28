import { yen } from '../lib/format'
import { computeOwed } from '../lib/split'
import type { Expense } from '../types'

type Props = {
  expenses: Expense[]
  nameOf: (id: string) => string
  editingId?: string
  onEdit: (e: Expense) => void
  onDelete: (e: Expense) => void
}

const MODE_LABEL = { equal: '均等', ratio: '比率', amount: '金額指定' } as const

export function ExpenseList({ expenses, nameOf, editingId, onEdit, onDelete }: Props) {
  if (expenses.length === 0) return null
  return (
    <section className="card">
      <h2>支払い一覧 ({expenses.length}件)</h2>
      <ul className="list">
        {[...expenses].reverse().map((e) => {
          const owed = computeOwed(e)
          return (
            <li key={e.id} className={`expense ${e.id === editingId ? 'editing' : ''}`}>
              <div className="row">
                <div className="grow">
                  <div className="expense-title">{e.title}</div>
                  <div className="muted small">
                    {nameOf(e.payerId)} が立替 · {MODE_LABEL[e.mode]}
                  </div>
                </div>
                <div className="expense-amount">{yen(e.amount)}</div>
              </div>
              <div className="row">
                <div className="grow muted small">
                  {Object.entries(owed)
                    .filter(([, v]) => v > 0)
                    .map(([id, v]) => `${nameOf(id)} ${yen(v)}`)
                    .join(' / ')}
                </div>
                <button className="ghost small" onClick={() => onEdit(e)}>
                  編集
                </button>
                <button className="ghost small danger" onClick={() => onDelete(e)}>
                  削除
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
