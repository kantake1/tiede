import { ArrowRight, ChevronRight, Share2 } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { yen } from '../lib/format'
import { computeBalances, settle, settledOf } from '../lib/settle'
import { settlementText } from '../lib/shareText'
import type { Expense, Member } from '../types'

type Props = {
  members: Member[]
  expenses: Expense[]
  nameOf: (id: string) => string
  /** 見出し右に置く操作 (精算済みにする など) */
  action?: ReactNode
  /** テキスト共有用のグループ名と、選択中イベントの表示名 */
  groupName: string
  label: string
  onShareText: (text: string) => void
}

export function SettlementPanel({ members, expenses, nameOf, action, groupName, label, onShareText }: Props) {
  const { balances, transfers, settled, total } = useMemo(() => {
    const balances = computeBalances(members, expenses)
    const settled = expenses.flatMap((e) =>
      Object.entries(settledOf(e)).map(([from, amount]) => ({ from, to: e.payerId, amount, title: e.title })),
    )
    return { balances, transfers: settle(balances), settled, total: expenses.reduce((s, e) => s + e.amount, 0) }
  }, [members, expenses])

  return (
    <section className="card settlement">
      <div className="row card-head">
        <h2 className="grow">精算</h2>
        {action}
      </div>
      {expenses.length === 0 ? (
        <p className="muted">支払いを追加すると精算結果が表示されます。</p>
      ) : transfers.length === 0 ? (
        <p className="done">精算は不要です (全員の負担が釣り合っています)</p>
      ) : (
        <ul className="transfers">
          {transfers.map((t, i) => (
            <li key={i}>
              <span className="from">{nameOf(t.from)}</span>
              <ArrowRight size={18} className="arrow" aria-label="から" />
              <span className="to">{nameOf(t.to)}</span>
              <span className="amount">{yen(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {expenses.length > 0 && (
        <button
          className="small with-icon share-text"
          onClick={() => onShareText(settlementText({ groupName, label, transfers, total, nameOf, settled, url: location.href }))}
        >
          <Share2 size={16} /> 精算結果を共有
        </button>
      )}

      {expenses.length > 0 && (
        <details>
          <summary>
            <ChevronRight size={14} className="chevron" /> 内訳 (総額 {yen(total)})
          </summary>
          <table className="balances">
            <thead>
              <tr>
                <th>メンバー</th>
                <th>立替額</th>
                <th>負担額</th>
                <th>差額</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.memberId}>
                  <td>{nameOf(b.memberId)}</td>
                  <td>{yen(b.paid)}</td>
                  <td>{yen(b.owed)}</td>
                  <td className={b.net > 0 ? 'plus' : b.net < 0 ? 'minus' : ''}>
                    {b.net > 0 ? '+' : ''}
                    {yen(b.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {settled.length > 0 && <p className="muted small">受取済みの分は立替額・負担額から除いています。</p>}
        </details>
      )}
    </section>
  )
}
