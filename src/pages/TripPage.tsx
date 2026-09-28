import { useEffect, useMemo, useState } from 'react'
import { ExpenseForm } from '../components/ExpenseForm'
import { ExpenseList } from '../components/ExpenseList'
import { MembersPanel } from '../components/MembersPanel'
import { SettlementPanel } from '../components/SettlementPanel'
import { touchRecent } from '../lib/recent'
import { getStore, type TripStore } from '../store'
import type { Expense, TripData } from '../types'

export function TripPage({ tripId }: { tripId: string }) {
  const [store, setStore] = useState<TripStore>()
  const [data, setData] = useState<TripData | null>()
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Expense | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    getStore().then((s) => {
      if (cancelled) return
      setStore(s)
      unsub = s.subscribe(tripId, setData, (e) => setError(e.message))
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [tripId])

  useEffect(() => {
    if (data) {
      touchRecent(tripId, data.trip.name)
      document.title = `${data.trip.name} - 旅費精算`
    }
  }, [tripId, data])

  const nameOf = useMemo(() => {
    const map = new Map(data?.members.map((m) => [m.id, m.name]))
    return (id: string) => map.get(id) ?? '(削除済み)'
  }, [data])

  if (error) return <p className="error">読み込みに失敗した: {error}</p>
  if (data === undefined || !store) return <p className="muted">読み込み中…</p>
  if (data === null) return <p className="error">旅行が見つからない。URLを確認する。</p>

  const run = (p: Promise<unknown>) => p.catch((e: Error) => alert(`保存に失敗した: ${e.message}`))

  async function share() {
    const url = location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: data!.trip.name, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 共有シートのキャンセル等は無視
    }
  }

  function rename() {
    const name = prompt('旅行名', data!.trip.name)?.trim()
    if (name && name !== data!.trip.name) run(store!.renameTrip(tripId, name))
  }

  return (
    <main>
      <div className="trip-header">
        <h1 onClick={rename} title="クリックして名前を変更">
          {data.trip.name}
        </h1>
        <button onClick={share}>{copied ? 'コピーした' : 'URLを共有'}</button>
      </div>
      {store.kind === 'local' && <p className="notice">ローカルモード: このURLを他の端末で開いてもデータは表示されない。</p>}

      <SettlementPanel members={data.members} expenses={data.expenses} nameOf={nameOf} />

      <section className="card">
        <h2>{editing ? '支払いを編集' : '支払いを追加'}</h2>
        <ExpenseForm
          key={editing?.id ?? 'new'}
          members={data.members}
          initial={editing}
          onSubmit={async (input) => {
            await run(editing ? store.updateExpense(tripId, editing.id, input) : store.addExpense(tripId, input))
            setEditing(null)
          }}
          onCancel={editing ? () => setEditing(null) : undefined}
        />
      </section>

      <ExpenseList
        expenses={data.expenses}
        nameOf={nameOf}
        editingId={editing?.id}
        onEdit={(e) => {
          setEditing(e)
          document.querySelector('.expense-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
        onDelete={(e) => {
          if (confirm(`「${e.title}」を削除する？`)) run(store.deleteExpense(tripId, e.id))
          if (editing?.id === e.id) setEditing(null)
        }}
      />

      <MembersPanel
        members={data.members}
        expenses={data.expenses}
        onAdd={(name) => run(store.addMember(tripId, name))}
        onRename={(id, name) => run(store.renameMember(tripId, id, name))}
        onRemove={(id) => run(store.removeMember(tripId, id))}
      />
    </main>
  )
}
