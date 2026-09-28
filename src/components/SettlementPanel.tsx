import { useMemo } from 'react'
import { yen } from '../lib/format'
import { computeBalances, settle } from '../lib/settle'
import type { Expense, Member } from '../types'

type Props = {
  members: Member[]
  expenses: Expense[]
  nameOf: (id: string) => string
}

export function SettlementPanel({ members, expenses, nameOf }: Props) {
  const { balances, transfers, total } = useMemo(() => {
    const balances = computeBalances(members, expenses)
    return { balances, transfers: settle(balances), total: expenses.reduce((s, e) => s + e.amount, 0) }
  }, [members, expenses])

  return (
    <section className="card settlement">
      <h2>精算</h2>
      {expenses.length === 0 ? (
        <p className="muted">支払いを追加すると精算結果が表示される。</p>
      ) : transfers.length === 0 ? (
        <p className="done">精算不要 (全員の負担が釣り合っている)</p>
      ) : (
        <ul className="transfers">
          {transfers.map((t, i) => (
            <li key={i}>
              <span className="from">{nameOf(t.from)}</span>
              <span className="arrow">→</span>
              <span className="to">{nameOf(t.to)}</span>
              <span className="amount">{yen(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {expenses.length > 0 && (
        <details>
          <summary>内訳 (総額 {yen(total)})</summary>
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
        </details>
      )}
    </section>
  )
}
