import { useState } from 'react'
import type { Expense, Member } from '../types'

type Props = {
  members: Member[]
  expenses: Expense[]
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}

export function MembersPanel({ members, expenses, onAdd, onRename, onRemove }: Props) {
  const [name, setName] = useState('')

  const isReferenced = (id: string) => expenses.some((e) => e.payerId === id || (e.shares[id] ?? 0) > 0)

  return (
    <section className="card">
      <h2>メンバー ({members.length}人)</h2>
      <ul className="list">
        {members.map((m) => (
          <li key={m.id} className="row">
            <span className="grow">{m.name}</span>
            <button
              className="ghost small"
              onClick={() => {
                const n = prompt('名前', m.name)?.trim()
                if (n && n !== m.name) onRename(m.id, n)
              }}
            >
              名前変更
            </button>
            <button
              className="ghost small danger"
              onClick={() => {
                if (isReferenced(m.id)) return alert(`${m.name} は支払いに含まれているため削除できない。先に該当する支払いを編集する。`)
                if (confirm(`${m.name} を削除する？`)) onRemove(m.id)
              }}
            >
              削除
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          if (!n) return
          onAdd(n)
          setName('')
        }}
      >
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="メンバーを追加" maxLength={50} />
        <button type="submit">追加</button>
      </form>
    </section>
  )
}
