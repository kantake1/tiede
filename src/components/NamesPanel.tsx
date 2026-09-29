import { useState } from 'react'

type Props = {
  title: string
  entries: { id: string; name: string }[]
  placeholder: string
  /** 支払いから参照されているものは削除させない */
  isReferenced: (id: string) => boolean
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}

/** メンバー・カテゴリ共通の一覧 (追加・名前変更・削除) */
export function NamesPanel({ title, entries, placeholder, isReferenced, onAdd, onRename, onRemove }: Props) {
  const [name, setName] = useState('')

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
                const n = prompt('名前', m.name)?.trim()
                if (n && n !== m.name) onRename(m.id, n)
              }}
            >
              名前変更
            </button>
            <button
              className="ghost small danger"
              onClick={() => {
                if (isReferenced(m.id)) return alert(`${m.name} は支払いに使われているため削除できない。先に該当する支払いを編集する。`)
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
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} maxLength={50} />
        <button type="submit">追加</button>
      </form>
    </section>
  )
}
