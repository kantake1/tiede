import { Archive, ArchiveRestore, Check, Link2, Menu, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExpenseForm } from '../components/ExpenseForm'
import { ExpenseList } from '../components/ExpenseList'
import { NamesPanel } from '../components/NamesPanel'
import { ResizeHandle } from '../components/ResizeHandle'
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

// 列幅 (px)。未設定なら CSS の既定値
type Widths = { sb?: number; form?: number }
const WIDTHS_KEY = 'tiede:layout-widths'
const loadWidths = (): Widths => {
  try {
    return JSON.parse(localStorage.getItem(WIDTHS_KEY) ?? '{}')
  } catch {
    return {}
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
  const [widths, setWidths] = useState<Widths>(loadWidths)

  useEffect(() => {
    try {
      localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths))
    } catch {
      // 保存できなくても動作に影響しない
    }
  }, [widths])

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
      document.title = `${data.trip.name} - tiede`
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
          tiede
        </a>
      </header>
      {node}
    </div>
  )
  if (error) return status(<p className="error">読み込みに失敗した: {error}</p>)
  if (data === undefined || !store) return status(<p className="muted">読み込み中…</p>)
  if (data === null) return status(<p className="error">グループが見つからない。URLを確認する。</p>)

  // 精算済みカテゴリは「すべて」から除く。個別に選べば閲覧できる
  const archivedIds = new Set(data.categories.filter((c) => c.archived).map((c) => c.id))
  const active = data.expenses.filter((e) => !archivedIds.has(catKey(e)))
  const visible = filter.length ? data.expenses.filter((e) => filter.includes(catKey(e))) : active

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

  const withTotal = (r: { key: string; name: string }) => ({
    ...r,
    total: data.expenses.filter((e) => catKey(e) === r.key).reduce((s, e) => s + e.amount, 0),
  })
  const rows = [
    ...data.categories.filter((c) => !c.archived).map((c) => ({ key: c.id, name: c.name })),
    ...(data.expenses.some((e) => catKey(e) === '') ? [{ key: '', name: '未分類' }] : []),
  ].map(withTotal)
  const archivedRows = data.categories.filter((c) => c.archived).map((c) => withTotal({ key: c.id, name: c.name }))
  const selected = filter.length === 1 ? data.categories.find((c) => c.id === filter[0]) : undefined
  const defaultCategoryId = selected && !selected.archived ? selected.id : ''
  const filterLabel = filter.length
    ? [...rows, ...archivedRows].filter((r) => filter.includes(r.key)).map((r) => r.name).join('・')
    : 'すべて'

  function archive(archived: boolean, id: string) {
    const name = data!.categories.find((c) => c.id === id)?.name
    if (archived && !confirm(`「${name}」を精算済みにしてアーカイブに移す？`)) return
    run(store!.setCategoryArchived(tripId, id, archived))
    if (archived) setFilter(filter.filter((k) => k !== id))
  }

  const layoutStyle = {
    ...(widths.sb ? { '--sb-w': `${widths.sb}px` } : {}),
    ...(widths.form ? { '--form-w': `${widths.form}px` } : {}),
  } as React.CSSProperties

  return (
    <div className={`layout ${collapsed ? 'collapsed' : ''} ${drawer ? 'drawer-open' : ''} ${sheet ? 'sheet-open' : ''}`} style={layoutStyle}>
      <Sidebar
        tripName={data.trip.name}
        rows={rows}
        archived={archivedRows}
        total={active.reduce((s, e) => s + e.amount, 0)}
        filter={filter}
        onFilter={setFilter}
        onAddCategory={addCategory}
        onRestore={(id) => archive(false, id)}
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
          <Menu size={22} />
        </button>
        <div className="grow topbar-title">
          <div className="topbar-name">{data.trip.name}</div>
          <div className="muted small">{filterLabel}</div>
        </div>
        <button className="ghost icon" onClick={share} aria-label="URLを共有">
          {copied ? <Check size={20} /> : <Link2 size={20} />}
        </button>
      </header>

      <section className="col-form" aria-label={editing ? '支払いを編集' : '支払いを追加'}>
        {!collapsed && (
          <ResizeHandle
            label="サイドバーの幅"
            className="left"
            min={180}
            max={400}
            measure={() => document.querySelector('.sidebar')!.getBoundingClientRect().width}
            onChange={(sb) => setWidths((w) => ({ ...w, sb }))}
            onReset={() => setWidths((w) => ({ ...w, sb: undefined }))}
          />
        )}
        <ResizeHandle
          label="支払い入力欄の幅"
          className="right"
          min={340}
          max={720}
          measure={() => document.querySelector('.col-form')!.getBoundingClientRect().width}
          onChange={(form) => setWidths((w) => ({ ...w, form }))}
          onReset={() => setWidths((w) => ({ ...w, form: undefined }))}
        />
        {store.kind === 'local' && <p className="notice">ローカルモード: このURLを他の端末で開いてもデータは表示されない。</p>}
        <div className="card">
          <div className="row">
            <h2 className="grow">{editing ? '支払いを編集' : '支払いを追加'}</h2>
            <button className="ghost icon sheet-close" onClick={() => setSheet(false)} aria-label="閉じる">
              <X size={20} />
            </button>
          </div>
          <ExpenseForm
            // 新規入力はサイドバーで1カテゴリだけ選んでいればそれを初期値にする (切り替えで作り直す)
            key={editing?.id ?? `new-${defaultCategoryId}`}
            members={data.members}
            categories={data.categories.filter((c) => !c.archived || c.id === editing?.categoryId)}
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
        <SettlementPanel
          members={data.members}
          expenses={visible}
          nameOf={nameOf}
          action={
            selected &&
            (selected.archived ? (
              <button className="ghost small with-icon" onClick={() => archive(false, selected.id)}>
                <ArchiveRestore size={16} /> アーカイブから戻す
              </button>
            ) : (
              <button className="small with-icon" onClick={() => archive(true, selected.id)}>
                <Archive size={16} /> 精算済みにする
              </button>
            ))
          }
        />
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
        <Plus size={28} />
      </button>

      <dialog ref={settingsRef} className="settings" onClick={(e) => e.target === e.currentTarget && settingsRef.current?.close()}>
        <div className="row">
          <h2 className="grow">メンバー・カテゴリ</h2>
          <button className="ghost icon" onClick={() => settingsRef.current?.close()} aria-label="閉じる">
            <X size={20} />
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
