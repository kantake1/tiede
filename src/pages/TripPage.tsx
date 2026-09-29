import { useEffect, useMemo, useRef, useState } from 'react'
import { ExpenseForm } from '../components/ExpenseForm'
import { ExpenseList } from '../components/ExpenseList'
import { NamesPanel } from '../components/NamesPanel'
import { SettlementPanel } from '../components/SettlementPanel'
import { Sidebar } from '../components/Sidebar'
import { touchRecent } from '../lib/recent'
import { getStore, isFirebaseConfigured, type TripStore } from '../store'
import type { Expense, TripData } from '../types'

const COLLAPSED_KEY = 'tiede:sidebar-collapsed'
const loadCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

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
  // デスクトップでの格納状態 (端末に保存) / タブレット・スマホでの引き出し / スマホでの入力画面
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const [drawer, setDrawer] = useState(false)
  const [sheet, setSheet] = useState(false)
  const settingsRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setDrawer(false)
      setSheet(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  const status = (node: React.ReactNode) => (
    <div className="container">
      <header className="app-header">
        <a href="#/" className="logo">
          旅費精算
        </a>
      </header>
      {node}
    </div>
  )
  if (error) return status(<p className="error">読み込みに失敗した: {error}</p>)
  if (data === undefined || !store) return status(<p className="muted">読み込み中…</p>)
  if (data === null) return status(<p className="error">グループが見つからない。URLを確認する。</p>)

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

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
    } catch {
      // 保存できなくても動作に影響しない
    }
  }

  async function addCategory() {
    const name = prompt('新しいカテゴリ名 (例: 旅行、鍋パ)')?.trim()
    if (name) await run(store!.addCategory(tripId, name))
  }

  const rows = [
    ...data.categories.map((c) => ({ key: c.id, name: c.name })),
    ...(data.expenses.some((e) => catKey(e) === '') ? [{ key: '', name: '未分類' }] : []),
  ].map((r) => ({ ...r, total: data.expenses.filter((e) => catKey(e) === r.key).reduce((s, e) => s + e.amount, 0) }))
  const defaultCategoryId = filter.length === 1 ? filter[0] : ''
  const filterLabel = filter.length ? rows.filter((r) => filter.includes(r.key)).map((r) => r.name).join('・') : 'すべて'

  return (
    <div className={`layout ${collapsed ? 'collapsed' : ''} ${drawer ? 'drawer-open' : ''} ${sheet ? 'sheet-open' : ''}`}>
      <Sidebar
        tripName={data.trip.name}
        rows={rows}
        total={data.expenses.reduce((s, e) => s + e.amount, 0)}
        filter={filter}
        onFilter={setFilter}
        onAddCategory={addCategory}
        onRename={rename}
        onSettings={() => settingsRef.current?.showModal()}
        onShare={share}
        copied={copied}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        onClose={() => setDrawer(false)}
      />
      <div className="backdrop" onClick={() => setDrawer(false)} aria-hidden />

      <header className="topbar">
        <button className="ghost icon" onClick={() => setDrawer(true)} aria-label="サイドバーを開く">
          ≡
        </button>
        <div className="grow topbar-title">
          <div className="topbar-name">{data.trip.name}</div>
          <div className="muted small">{filterLabel}</div>
        </div>
        <button className="ghost icon" onClick={share} aria-label="URLを共有">
          {copied ? '✓' : '🔗'}
        </button>
      </header>

      <section className="col-form" aria-label={editing ? '支払いを編集' : '支払いを追加'}>
        {store.kind === 'local' && <p className="notice">ローカルモード: このURLを他の端末で開いてもデータは表示されない。</p>}
        <div className="card">
          <div className="row">
            <h2 className="grow">{editing ? '支払いを編集' : '支払いを追加'}</h2>
            <button className="ghost icon sheet-close" onClick={() => setSheet(false)} aria-label="閉じる">
              ×
            </button>
          </div>
          <ExpenseForm
            // 新規入力はサイドバーで1カテゴリだけ選んでいればそれを初期値にする (切り替えで作り直す)
            key={editing?.id ?? `new-${defaultCategoryId}`}
            members={data.members}
            categories={data.categories}
            initial={editing}
            defaultCategoryId={defaultCategoryId}
            onCreateCategory={(name) => store.addCategory(tripId, name)}
            readReceipt={readReceipt}
            onSubmit={async (input) => {
              await run(editing ? store.updateExpense(tripId, editing.id, input) : store.addExpense(tripId, input))
              setEditing(null)
              setSheet(false)
            }}
            onCancel={
              editing
                ? () => {
                    setEditing(null)
                    setSheet(false)
                  }
                : undefined
            }
          />
        </div>
      </section>

      <section className="col-list" aria-label="精算と支払い一覧">
        <SettlementPanel members={data.members} expenses={visible} nameOf={nameOf} />
        <ExpenseList
          expenses={visible}
          nameOf={nameOf}
          categoryOf={categoryOf}
          editingId={editing?.id}
          onEdit={(e) => {
            setEditing(e)
            setSheet(true)
            document.querySelector('.col-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          onDelete={(e) => {
            if (confirm(`「${e.title}」を削除する？`)) run(store.deleteExpense(tripId, e.id))
            if (editing?.id === e.id) setEditing(null)
          }}
        />
      </section>

      <button className="fab primary" onClick={() => setSheet(true)} aria-label="支払いを追加">
        ＋
      </button>

      <dialog ref={settingsRef} className="settings" onClick={(e) => e.target === e.currentTarget && settingsRef.current?.close()}>
        <div className="row">
          <h2 className="grow">メンバー・カテゴリ</h2>
          <button className="ghost icon" onClick={() => settingsRef.current?.close()} aria-label="閉じる">
            ×
          </button>
        </div>
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
      </dialog>
    </div>
  )
}
