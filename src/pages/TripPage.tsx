import { Archive, ArchiveRestore, Check, Link2, Menu, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExpenseForm } from '../components/ExpenseForm'
import { ExpenseList } from '../components/ExpenseList'
import { NamesPanel } from '../components/NamesPanel'
import { ResizeHandle } from '../components/ResizeHandle'
import { SettlementPanel } from '../components/SettlementPanel'
import { Sidebar } from '../components/Sidebar'
import { Toast, type ToastMessage } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { friendlyError, WRITE_ERROR_EVENT } from '../lib/errors'
import { askName } from '../lib/names'
import { touchRecent } from '../lib/recent'
import { getStore, isFirebaseConfigured, type TripStore } from '../store'
import type { Expense, TripData } from '../types'
import { Logo } from '../components/Logo'

const COLLAPSED_KEY = 'tiede:sidebar-collapsed'
const loadCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

const WIDE_QUERY = '(min-width: 1440px)'

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

const readReceipt = isFirebaseConfigured ? (file: File) => import('../lib/receipt').then((m) => m.readReceipt(file)) : undefined

export function TripPage({ tripId }: { tripId: string }) {
  const [store, setStore] = useState<TripStore>()
  const [data, setData] = useState<TripData | null>()
  const [error, setError] = useState('')
  const [editing, setEditingState] = useState<Expense | null>(null)
  // 同じ支払いを編集し直すときもフォームを作り直すための番号
  const [editRev, setEditRev] = useState(0)
  const setEditing = (e: Expense | null) => {
    setEditingState(e)
    setEditRev((r) => r + 1)
  }
  const [copied, setCopied] = useState(false)
  // 精算・一覧に含めるイベント。空なら全部。'' は未分類
  const [filter, setFilter] = useState<string[]>([])
  // デスクトップでの格納状態 (端末に保存) / タブレット・スマホでの引き出し / スマホでの入力画面
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const [drawer, setDrawer] = useState(false)
  // 十分な幅 (1440px 以上) では格納する必要がないため、常に展開する
  const [wide, setWide] = useState(() => matchMedia(WIDE_QUERY).matches)
  useEffect(() => {
    const mq = matchMedia(WIDE_QUERY)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const [sheet, setSheet] = useState(false)
  const settingsRef = useRef<HTMLDialogElement>(null)
  const [askConfirm, confirmUi] = useConfirm()
  const [widths, setWidths] = useState<Widths>(loadWidths)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [slow, setSlow] = useState(false)

  const notify = useCallback(
    (text: string, opts: Omit<ToastMessage, 'id' | 'text'> = {}) =>
      // 「元に戻す」付きの通知は、操作のない普通の通知では上書きしない (取り消しの機会を失わないため)
      setToast((cur) => (cur?.action && !opts.action && opts.tone !== 'error' ? cur : { id: Date.now(), text, ...opts })),
    [],
  )
  const closeToast = useCallback(() => setToast(null), [])

  // 通信状態と、待つのをやめた書き込みの後からの失敗
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    const failed = (e: Event) => notify(`保存できなかった変更があります: ${friendlyError((e as CustomEvent).detail)}`, { tone: 'error' })
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    window.addEventListener(WRITE_ERROR_EVENT, failed)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      window.removeEventListener(WRITE_ERROR_EVENT, failed)
    }
  }, [notify])

  // 送信待ちの変更があるうちにタブを閉じようとしたら確認する (端末には残るが、次に開くまで他の人に届かない)
  const pending = !!data?.pending
  useEffect(() => {
    if (!pending) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pending])

  // 読み込みが長引いたら理由を示す (圏外で初めて開いたグループなど)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [tripId])

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
      document.title = `${data.trip.name} - おあいこ`
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

  // 削除済みイベントを指す支払いは未分類扱い
  const catKey = (e: Expense) => (categoryOf(e.categoryId) ? e.categoryId! : '')

  const status = (node: React.ReactNode) => (
    <div className="container">
      <header className="app-header">
        <a href="/" className="logo">
          <Logo />
        </a>
      </header>
      {node}
    </div>
  )
  if (error) return status(<p className="error">読み込めませんでした: {error}</p>)
  if (data === undefined || !store)
    return status(
      <>
        <p className="muted">読み込み中…</p>
        {slow && (
          <p className="notice">
            {online
              ? '読み込みに時間がかかっています。電波の良い場所で待つか、再読み込みしてください。'
              : 'オフラインのため読み込めません。この端末で一度も開いたことのないグループは、電波が戻るまで表示できません。'}
          </p>
        )}
      </>,
    )
  if (data === null) return status(<p className="error">グループが見つかりません。URLを確認してください。</p>)

  // 精算済みイベントは「すべて」から除く。個別に選べば閲覧できる
  const archivedIds = new Set(data.categories.filter((c) => c.archived).map((c) => c.id))
  const active = data.expenses.filter((e) => !archivedIds.has(catKey(e)))
  const visible = filter.length ? data.expenses.filter((e) => filter.includes(catKey(e))) : active

  const run = (p: Promise<unknown>) => p.catch((e) => notify(`保存できませんでした: ${friendlyError(e)}`, { tone: 'error' }))

  async function shareText(text: string) {
    try {
      if (navigator.share) return await navigator.share({ text })
      await navigator.clipboard.writeText(text)
      notify('精算結果をコピーしました。LINE などに貼り付けられます')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') notify('共有できませんでした', { tone: 'error' })
    }
  }

  // 編集中に他の人が削除した場合はフォームの代わりに知らせる
  const editingNow = editing && data.expenses.find((e) => e.id === editing.id)
  const editingGone = !!editing && !editingNow
  // 編集を始めた後に他の人が同じ支払いを更新した (保存すると上書きになる)
  // (createdAt はサーバー時刻の確定で変わるため比較しない)
  const content = (e: Expense) => JSON.stringify({ ...e, createdAt: 0 })
  const editingChanged = !!editing && !!editingNow && content(editingNow) !== content(editing)

  const syncLabel = !online ? 'オフライン' : data.pending ? '送信待ち' : ''

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
    const name = askName('グループ名', 100, { current: data!.trip.name })
    if (name) run(store!.renameTrip(tripId, name))
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
    const name = askName('新しいイベント名 (例: 沖縄旅行、3月の飲み会)', 50, { existing: data!.categories.map((c) => c.name) })
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
    ? [...rows, ...archivedRows]
        .filter((r) => filter.includes(r.key))
        .map((r) => r.name)
        .join('・')
    : 'すべて'

  // 複数のイベントを選んでいるときは、未精算のものをまとめて精算済みにできる (未分類・アーカイブ済みは除く)
  const selectedActive = data.categories.filter((c) => filter.includes(c.id) && !c.archived)
  const bulk = filter.length >= 2 && selectedActive.length > 0

  function archiveMany() {
    const names = selectedActive.map((c) => `「${c.name}」`).join('')
    if (!confirm(`${names}をまとめて精算済みにしてアーカイブに移しますか？`)) return
    for (const c of selectedActive) run(store!.setCategoryArchived(tripId, c.id, true))
    setFilter(filter.filter((k) => !selectedActive.some((c) => c.id === k)))
  }

  /**
   * イベントの削除。中の支払いは消さず「未分類」になる。
   * サイドバーからは独自の確認画面、設定画面 (モーダルの dialog 内) からはブラウザの確認を使う
   */
  async function deleteEvent(id: string, native = false) {
    const c = data!.categories.find((x) => x.id === id)
    if (!c) return
    const count = data!.expenses.filter((e) => e.categoryId === id).length
    const title = `「${c.name}」を削除しますか？`
    const body = count ? `含まれる支払い ${count} 件は「未分類」になります。` : ''
    const ok = native ? confirm(body ? `${title}\n${body}` : title) : await askConfirm({ title, body, okLabel: '削除' })
    if (!ok) return
    run(store!.removeCategory(tripId, id))
    setFilter((f) => f.filter((k) => k !== id))
  }

  function archive(archived: boolean, id: string) {
    const name = data!.categories.find((c) => c.id === id)?.name
    if (archived && !confirm(`「${name}」を精算済みにしてアーカイブに移しますか？`)) return
    run(store!.setCategoryArchived(tripId, id, archived))
    if (archived) setFilter(filter.filter((k) => k !== id))
  }

  const layoutStyle = {
    ...(widths.sb ? { '--sb-w': `${widths.sb}px` } : {}),
    ...(widths.form ? { '--form-w': `${widths.form}px` } : {}),
  } as React.CSSProperties

  return (
    <div
      className={`layout ${collapsed && !wide ? 'collapsed' : ''} ${drawer ? 'drawer-open' : ''} ${sheet ? 'sheet-open' : ''}`}
      style={layoutStyle}
    >
      {/* デスクトップの上部見出し。ロゴは中央 (グループ名はサイドバー上端) */}
      <header className="apphead">
        <a href="/" className="logo">
          <Logo />
        </a>
        {syncLabel && <span className={`sync ${online ? '' : 'offline'}`}>{syncLabel}</span>}
      </header>
      <Sidebar
        tripName={data.trip.name}
        rows={rows}
        archived={archivedRows}
        total={active.reduce((s, e) => s + e.amount, 0)}
        filter={filter}
        onFilter={setFilter}
        onAddCategory={addCategory}
        onRestore={(id) => archive(false, id)}
        onDelete={(id) => deleteEvent(id)}
        onRename={rename}
        onSettings={() => settingsRef.current?.showModal()}
        onShare={share}
        copied={copied}
        collapsed={collapsed && !wide}
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
          <div className="muted small">
            {filterLabel}
            {syncLabel && <span className={`sync ${online ? '' : 'offline'}`}>{syncLabel}</span>}
          </div>
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
        {store.kind === 'local' && <p className="notice">ローカルモード: このURLを他の端末で開いてもデータは表示されません。</p>}
        <div className="card">
          <div className="row">
            <h2 className="grow">{editing ? '支払いを編集' : '支払いを追加'}</h2>
            <button
              className="ghost icon sheet-close"
              onClick={() => {
                setSheet(false)
                setEditing(null)
              }}
              aria-label="閉じる"
            >
              <X size={20} />
            </button>
          </div>
          {editingChanged && (
            <p className="notice">
              この支払いは編集中に他の人が更新しました。保存すると上書きになります。
              <button className="ghost small" onClick={() => setEditing(editingNow!)}>
                最新の内容で編集し直す
              </button>
            </p>
          )}
          {editingGone ? (
            <div className="stack">
              <p className="notice">編集中の支払いは他の人が削除しました。</p>
              <button
                onClick={() => {
                  setEditing(null)
                  setSheet(false)
                }}
              >
                閉じる
              </button>
            </div>
          ) : (
            <ExpenseForm
              // 新規入力はサイドバーで1イベントだけ選んでいればそれを初期値にする (切り替えで作り直す)
              key={editing ? `${editing.id}-${editRev}` : `new-${defaultCategoryId}`}
              members={data.members}
              categories={data.categories.filter((c) => !c.archived || c.id === editing?.categoryId)}
              initial={editing}
              defaultCategoryId={defaultCategoryId}
              onCreateCategory={(name) => store.addCategory(tripId, name)}
              readReceipt={readReceipt}
              onSubmit={async (input) => {
                if (editingChanged && !confirm('この支払いは他の人が更新しています。上書きして保存しますか？')) throw new Error('cancelled')
                const p = editing ? store.updateExpense(tripId, editing.id, input) : store.addExpense(tripId, input)
                // 先に知らせる (受領を待った後だと、その間に出た「元に戻す」の通知を上書きしてしまう)
                if (!editing) notify(`「${input.title}」を追加しました`)
                if (navigator.onLine) {
                  // 通信できるときは受領を待つ (最大2.5秒)。拒否されたら入力を残したまま知らせる
                  try {
                    await p
                  } catch (e) {
                    notify(`保存できませんでした: ${friendlyError(e)}`, { tone: 'error' })
                    throw e
                  }
                } else {
                  // 圏外では端末に即反映されるので待たずに閉じる (送信は電波が戻ってから)
                  run(p)
                }
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
          )}
        </div>
      </section>

      <section className="col-list" aria-label="精算と支払い一覧">
        <SettlementPanel
          members={data.members}
          expenses={visible}
          nameOf={nameOf}
          groupName={data.trip.name}
          label={filterLabel}
          onShareText={shareText}
          action={
            bulk ? (
              <button className="small with-icon" onClick={archiveMany}>
                <Archive size={16} /> まとめて精算済みにする
              </button>
            ) : (
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
            )
          }
        />
        <ExpenseList
          expenses={visible}
          nameOf={nameOf}
          memberIds={data.members.map((m) => m.id)}
          categoryOf={categoryOf}
          editingId={editing?.id}
          onEdit={(e) => {
            setEditing(e)
            setSheet(true)
            document.querySelector('.col-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          onDelete={(e) => {
            // 確認ダイアログの代わりに、削除後しばらく「元に戻す」を出す
            if (editing?.id === e.id) setEditing(null)
            run(store.deleteExpense(tripId, e.id))
            notify(`「${e.title}」を削除しました`, { action: { label: '元に戻す', run: () => run(store.restoreExpense(tripId, e)) } })
          }}
        />
      </section>

      <button
        className="fab primary"
        onClick={() => {
          setEditing(null)
          setSheet(true)
        }}
        aria-label="支払いを追加"
      >
        <Plus size={28} />
      </button>

      <Toast toast={toast} onClose={closeToast} />
      {confirmUi}

      <dialog ref={settingsRef} className="settings" onClick={(e) => e.target === e.currentTarget && settingsRef.current?.close()}>
        <div className="row">
          <h2 className="grow">設定</h2>
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
          title="イベント"
          entries={data.categories}
          placeholder="例: 沖縄旅行、3月の飲み会"
          isReferenced={(id) => data.expenses.some((e) => e.categoryId === id)}
          askBeforeRemove={false}
          onAdd={(name) => run(store.addCategory(tripId, name))}
          onRename={(id, name) => run(store.renameCategory(tripId, id, name))}
          onRemove={(id) => deleteEvent(id, true)}
        />
      </dialog>
    </div>
  )
}
