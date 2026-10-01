import { Archive, ArchiveRestore, Clock, Menu, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useConfirm } from '../components/ConfirmDialog'
import { DeletedList } from '../components/DeletedList'
import { EditorPanel } from '../components/EditorPanel'
import { ExpenseList } from '../components/ExpenseList'
import { Logo } from '../components/Logo'
import { SettingsDialog } from '../components/SettingsDialog'
import { SettlementPanel } from '../components/SettlementPanel'
import { Sidebar } from '../components/Sidebar'
import { Toast } from '../components/Toast'
import { TripDeleteDialog } from '../components/TripDeleteDialog'
import { useReceiptViewer } from '../components/useReceiptViewer'
import { useEditing } from '../hooks/useEditing'
import { useLayout } from '../hooks/useLayout'
import { useToast } from '../hooks/useToast'
import { useTripData } from '../hooks/useTripData'
import { formatDate, toDateKey } from '../lib/date'
import { friendlyError } from '../lib/errors'
import { tripDeletionAt } from '../lib/grace'
import { askName } from '../lib/names'
import { tripView } from '../lib/tripView'

export function TripPage({ tripId }: { tripId: string }) {
  const { store, data, error, online, slow } = useTripData(tripId)
  const { editing, rev: editRev, setEditing, isCurrent } = useEditing()
  const layout = useLayout()
  const { setDrawer, setSheet } = layout
  const { toast, notify, close: closeToast } = useToast()
  const [askConfirm, confirmUi] = useConfirm()
  // 一覧から開いたレシート写真
  const receiptViewer = useReceiptViewer((msg) => notify(msg, { tone: 'error' }))
  const [copied, setCopied] = useState(false)
  // 精算・一覧に含めるイベント。空なら全部。'' は未分類
  const [filter, setFilterState] = useState<string[]>([])
  // 一覧の欄に削除済みの支払いを出す。イベントを選ぶと通常の一覧に戻る
  const [deletedView, setDeletedView] = useState(false)
  const setFilter: typeof setFilterState = (f) => {
    setDeletedView(false)
    setFilterState(f)
  }
  const settingsRef = useRef<HTMLDialogElement>(null)
  // グループの削除予約の確認画面
  const [askingDelete, setAskingDelete] = useState(false)

  const nameOf = useMemo(() => {
    const map = new Map(data?.members.map((m) => [m.id, m.name]))
    return (id: string) => map.get(id) ?? '(削除済み)'
  }, [data])

  const categoryOf = useMemo(() => {
    const map = new Map(data?.categories.map((c) => [c.id, c.name]))
    return (id: string | undefined) => (id ? map.get(id) : undefined)
  }, [data])

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

  const { visible, total, rows, archivedRows, selected, defaultCategoryId, filterLabel, selectedActive, bulk } = tripView(data, filter)

  // 0件になったら通常の一覧に戻す
  const showDeleted = deletedView && data.deleted.length > 0

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

  async function addCategory() {
    const name = askName('新しいイベント名 (例: 沖縄旅行、3月の飲み会)', 50, { existing: data!.categories.map((c) => c.name) })
    if (name) await run(store!.addCategory(tripId, name))
  }

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

  // グループの削除予約 (#6)。猶予が過ぎると Cloud Functions が中身ごと消す。予約中は誰でも取り消せる
  function cancelTripDeletion() {
    run(store!.cancelTripDeletion(tripId))
    notify('削除を取り消しました')
  }

  function requestTripDeletion() {
    setAskingDelete(false)
    run(store!.requestTripDeletion(tripId))
    notify('削除を予約しました', { action: { label: '元に戻す', run: () => run(store!.cancelTripDeletion(tripId)) } })
  }

  const closeEditor = () => {
    setEditing(null)
    setSheet(false)
  }

  return (
    <div className={layout.className} style={layout.style}>
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
        total={total}
        filter={filter}
        onFilter={setFilter}
        onAddCategory={addCategory}
        onRestore={(id) => archive(false, id)}
        onDelete={(id) => deleteEvent(id)}
        onRename={rename}
        onSettings={() => settingsRef.current?.showModal()}
        onShare={share}
        copied={copied}
        collapsed={layout.collapsed}
        onToggleCollapse={layout.toggleCollapsed}
        onClose={() => setDrawer(false)}
        deletedCount={data.deleted.length}
        showingDeleted={showDeleted}
        onShowDeleted={() => {
          setDeletedView(true)
          setDrawer(false)
        }}
      />
      <div className="backdrop" onClick={() => setDrawer(false)} aria-hidden />

      <header className="topbar">
        <button className="ghost icon" onClick={() => setDrawer(true)} aria-label="サイドバーを開く">
          <Menu size={22} />
        </button>
        <div className="grow topbar-title">
          <div className="topbar-name">{data.trip.name}</div>
          <div className="muted small">
            {showDeleted ? '削除済み' : filterLabel}
            {syncLabel && <span className={`sync ${online ? '' : 'offline'}`}>{syncLabel}</span>}
          </div>
        </div>
      </header>

      <EditorPanel
        store={store}
        tripId={tripId}
        data={data}
        editing={editing}
        editRev={editRev}
        setEditing={setEditing}
        isCurrent={isCurrent}
        onClose={closeEditor}
        defaultCategoryId={defaultCategoryId}
        sidebarHandle={!layout.collapsed}
        setWidth={layout.setWidth}
        notify={notify}
        run={run}
      />

      <section className="col-list" aria-label="精算と支払い一覧">
        {data.trip.deleteRequestedAt !== undefined && (
          <div className="notice pending-delete" role="status">
            <Clock size={18} />
            <div className="grow">
              <div className="pending-delete-title">
                {formatDate(toDateKey(new Date(tripDeletionAt(data.trip.deleteRequestedAt))))} 以降に削除されます
              </div>
              <div>このグループは削除が予約されています。残す場合は取り消してください。</div>
              <button className="small" onClick={cancelTripDeletion}>
                削除を取り消す
              </button>
            </div>
          </div>
        )}
        {showDeleted ? (
          <DeletedList
            expenses={data.deleted}
            nameOf={nameOf}
            categoryOf={categoryOf}
            onBack={() => setDeletedView(false)}
            onRestore={(e) => {
              run(store.restoreExpense(tripId, e.id))
              notify(`「${e.title}」を元に戻しました`)
            }}
            onPurge={async (e) => {
              const ok = await askConfirm({
                title: `「${e.title}」を完全に削除しますか？`,
                body: `${e.hasReceipt ? 'レシート写真も削除されます。' : ''}元に戻せません。`,
                okLabel: '完全に削除',
              })
              if (ok) run(store.purgeExpense(tripId, e.id))
            }}
          />
        ) : (
          <>
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
              onShowReceipt={(e) => receiptViewer.open(() => store.getReceipt(tripId, e.id))}
              editingId={editing?.id}
              onEdit={(e) => {
                setEditing(e)
                setSheet(true)
                document.querySelector('.col-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              onDelete={(e) => {
                // 確認ダイアログの代わりに、削除後しばらく「元に戻す」を出す。「削除済み」からも戻せる
                if (editing?.id === e.id) setEditing(null)
                run(store.deleteExpense(tripId, e.id))
                notify(`「${e.title}」を削除しました`, {
                  action: { label: '元に戻す', run: () => run(store.restoreExpense(tripId, e.id)) },
                })
              }}
            />
          </>
        )}
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
      {receiptViewer.ui}

      {askingDelete && <TripDeleteDialog data={data} onCancel={() => setAskingDelete(false)} onConfirm={requestTripDeletion} />}

      <SettingsDialog
        ref={settingsRef}
        data={data}
        store={store}
        tripId={tripId}
        run={run}
        onDeleteEvent={(id) => deleteEvent(id, true)}
        // 設定 (モーダルの dialog) の上には独自の確認画面を重ねられないため、閉じてから開く。
        // 予約後に一覧の上の帯が見えるよう、引き出しも閉じる
        onDeleteTrip={() => {
          settingsRef.current?.close()
          setDrawer(false)
          setAskingDelete(true)
        }}
        onCancelTripDeletion={cancelTripDeletion}
      />
    </div>
  )
}
