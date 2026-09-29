import { useState } from 'react'
import { askName, nameProblem } from '../lib/names'

type Props = {
  title: string
  entries: { id: string; name: string }[]
  placeholder: string
  /** 支払いから参照されているものは削除させない */
  isReferenced: (id: string) => boolean
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
  /** false なら確認・参照チェックを呼び出し側に任せる (イベント) */
  askBeforeRemove?: boolean
}

/** メンバー・イベント共通の一覧 (追加・名前変更・削除) */
export function NamesPanel({ title, entries, placeholder, isReferenced, onAdd, onRename, onRemove, askBeforeRemove = true }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  return (
    <section className="card">
      <h2>{title}</h2>
      <ul className="list">
        {entries.map((m) => (
          <li key={m.id} className="row">
            <span className="grow">{m.name}</span>
            <button
              className="ghost small"
              onClick={() => {
                const n = askName('名前', 50, { current: m.name, existing: entries.map((x) => x.name) })
                if (n) onRename(m.id, n)
              }}
            >
              名前変更
            </button>
            <button
              className="ghost small danger"
              onClick={() => {
                if (!askBeforeRemove) return onRemove(m.id)
                if (isReferenced(m.id))
                  return alert(`${m.name} は支払いに使われているため削除できません。先に該当する支払いを編集してください。`)
                if (confirm(`${m.name} を削除しますか？`)) onRemove(m.id)
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
          const problem = nameProblem(
            n,
            50,
            entries.map((x) => x.name),
          )
          if (problem) return setError(problem)
          onAdd(n)
          setName('')
          setError('')
        }}
      >
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} maxLength={50} />
        <button type="submit">追加</button>
      </form>
      {error && <p className="error small">{error}</p>}
    </section>
  )
}
