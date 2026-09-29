import { useEffect, useMemo, useState } from 'react'
import { ExpenseForm } from '../components/ExpenseForm'
import { ExpenseList } from '../components/ExpenseList'
import { NamesPanel } from '../components/NamesPanel'
import { SettlementPanel } from '../components/SettlementPanel'
import { touchRecent } from '../lib/recent'
import { getStore, isFirebaseConfigured, type TripStore } from '../store'
import type { Expense, TripData } from '../types'

const readReceipt = isFirebaseConfigured
  ? (file: File) => import('../lib/receipt').then((m) => m.readReceipt(file))
  : undefined

export function TripPage({ tripId }: { tripId: string }) {
  const [store, setStore] = useState<TripStore>()
  const [data, setData] = useState<TripData | null>()
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Expense | null>(null)
  const [copied, setCopied] = useState(false)
  // 精算・一覧に含めるカテゴリ。空なら全部。'' は未分類
  const [filter, setFilter] = useState<string[]>([])

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

  const categoryOf = useMemo(() => {
    const map = new Map(data?.categories.map((c) => [c.id, c.name]))
    return (id: string | undefined) => (id ? map.get(id) : undefined)
  }, [data])

  // 削除済みカテゴリを指す支払いは未分類扱い
  const catKey = (e: Expense) => (categoryOf(e.categoryId) ? e.categoryId! : '')

  if (error) return <p className="error">読み込みに失敗した: {error}</p>
  if (data === undefined || !store) return <p className="muted">読み込み中…</p>
  if (data === null) return <p className="error">グループが見つからない。URLを確認する。</p>

  const visible = filter.length ? data.expenses.filter((e) => filter.includes(catKey(e))) : data.expenses

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
    const name = prompt('グループ名', data!.trip.name)?.trim()
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

      {(data.categories.length > 0) && (
        <div className="chips filter" role="group" aria-label="精算するカテゴリ">
          <button type="button" className={`chip toggle ${filter.length === 0 ? 'on' : ''}`} aria-pressed={filter.length === 0} onClick={() => setFilter([])}>
            すべて
          </button>
          {[...data.categories.map((c) => ({ key: c.id, name: c.name })), ...(data.expenses.some((e) => catKey(e) === '') ? [{ key: '', name: '未分類' }] : [])].map((c) => {
            const on = filter.includes(c.key)
            return (
              <button
                type="button"
                key={c.key}
                className={`chip toggle ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => setFilter(on ? filter.filter((k) => k !== c.key) : [...filter, c.key])}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      )}

      <SettlementPanel members={data.members} expenses={visible} nameOf={nameOf} />

      <section className="card">
        <h2>{editing ? '支払いを編集' : '支払いを追加'}</h2>
        <ExpenseForm
          key={editing?.id ?? 'new'}
          members={data.members}
          categories={data.categories}
          initial={editing}
          defaultCategoryId={filter.length === 1 ? filter[0] : ''}
          onCreateCategory={(name) => store.addCategory(tripId, name)}
          readReceipt={readReceipt}
          onSubmit={async (input) => {
            await run(editing ? store.updateExpense(tripId, editing.id, input) : store.addExpense(tripId, input))
            setEditing(null)
          }}
          onCancel={editing ? () => setEditing(null) : undefined}
        />
      </section>

      <ExpenseList
        expenses={visible}
        nameOf={nameOf}
        categoryOf={categoryOf}
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

      <NamesPanel
        title={`メンバー (${data.members.length}人)`}
        entries={data.members}
        placeholder="メンバーを追加"
        isReferenced={(id) =>
          data.expenses.some((e) => e.payerId === id || (e.shares[id] ?? 0) > 0 || e.items?.some((it) => it.memberIds.includes(id)))
        }
        onAdd={(name) => run(store.addMember(tripId, name))}
        onRename={(id, name) => run(store.renameMember(tripId, id, name))}
        onRemove={(id) => run(store.removeMember(tripId, id))}
      />

      <NamesPanel
        title="カテゴリ"
        entries={data.categories}
        placeholder="例: 旅行、鍋パ"
        isReferenced={(id) => data.expenses.some((e) => e.categoryId === id)}
        onAdd={(name) => run(store.addCategory(tripId, name))}
        onRename={(id, name) => run(store.renameCategory(tripId, id, name))}
        onRemove={(id) => {
          run(store.removeCategory(tripId, id))
          setFilter(filter.filter((k) => k !== id))
        }}
      />
    </main>
  )
}
