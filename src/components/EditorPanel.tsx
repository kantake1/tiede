import { X } from 'lucide-react'
import type { ToastMessage } from './Toast'
import { friendlyError } from '../lib/errors'
import { MAX_RECEIPTS_PER_GROUP } from '../lib/receiptImage'
import { isFirebaseConfigured, type TripStore } from '../store'
import type { Expense, TripData } from '../types'
import { ExpenseForm } from './ExpenseForm'
import { ResizeHandle } from './ResizeHandle'

const readReceipt = isFirebaseConfigured ? (file: File) => import('../lib/receipt').then((m) => m.readReceipt(file)) : undefined

type Props = {
  store: TripStore
  tripId: string
  data: TripData
  /** 編集中の支払い (null は新規入力) と、フォームを作り直すための番号 */
  editing: Expense | null
  editRev: number
  setEditing: (e: Expense | null) => void
  isCurrent: (id: string | undefined) => boolean
  /** 編集をやめて入力画面を閉じる */
  onClose: () => void
  defaultCategoryId: string
  /** サイドバーの幅の取っ手を出す (格納中は出さない) */
  sidebarHandle: boolean
  setWidth: (key: 'sb' | 'form', px: number | undefined) => void
  notify: (text: string, opts?: Omit<ToastMessage, 'id' | 'text'>) => void
  run: (p: Promise<unknown>) => void
}

/** 支払いを追加・編集する列 (スマホでは全画面の入力画面) */
export function EditorPanel(p: Props) {
  const { store, tripId, data, editing } = p
  // 編集中に他の人が削除した場合はフォームの代わりに知らせる
  const editingNow = editing && data.expenses.find((e) => e.id === editing.id)
  const editingGone = !!editing && !editingNow
  // 編集を始めた後に他の人が同じ支払いを更新した (保存すると上書きになる)
  // (createdAt はサーバー時刻の確定で変わるため比較しない)
  const content = (e: Expense) => JSON.stringify({ ...e, createdAt: 0 })
  const editingChanged = !!editing && !!editingNow && content(editingNow) !== content(editing)

  return (
    <section className="col-form" aria-label={editing ? '支払いを編集' : '支払いを追加'}>
      {p.sidebarHandle && (
        <ResizeHandle
          label="サイドバーの幅"
          className="left"
          min={180}
          max={400}
          measure={() => document.querySelector('.sidebar')!.getBoundingClientRect().width}
          onChange={(sb) => p.setWidth('sb', sb)}
          onReset={() => p.setWidth('sb', undefined)}
        />
      )}
      <ResizeHandle
        label="支払い入力欄の幅"
        className="right"
        min={340}
        max={720}
        measure={() => document.querySelector('.col-form')!.getBoundingClientRect().width}
        onChange={(form) => p.setWidth('form', form)}
        onReset={() => p.setWidth('form', undefined)}
      />
      {store.kind === 'local' && <p className="notice">ローカルモード: このURLを他の端末で開いてもデータは表示されません。</p>}
      <div className="card">
        <div className="row">
          <h2 className="grow">{editing ? '支払いを編集' : '支払いを追加'}</h2>
          <button className="ghost icon sheet-close" onClick={p.onClose} aria-label="閉じる">
            <X size={20} />
          </button>
        </div>
        {editingChanged && (
          <p className="notice">
            この支払いは編集中に他の人が更新しました。保存すると上書きになります。
            <button className="ghost small" onClick={() => p.setEditing(editingNow!)}>
              最新の内容で編集し直す
            </button>
          </p>
        )}
        {editingGone ? (
          <div className="stack">
            <p className="notice">編集中の支払いは他の人が削除しました。</p>
            <button onClick={p.onClose}>閉じる</button>
          </div>
        ) : (
          <ExpenseForm
            // 新規入力はサイドバーで1イベントだけ選んでいればそれを初期値にする (切り替えで作り直す)
            key={editing ? `${editing.id}-${p.editRev}` : `new-${p.defaultCategoryId}`}
            members={data.members}
            categories={data.categories.filter((c) => !c.archived || c.id === editing?.categoryId)}
            initial={editing}
            defaultCategoryId={p.defaultCategoryId}
            onCreateCategory={(name) => store.addCategory(tripId, name)}
            readReceipt={readReceipt}
            getReceipt={editing ? () => store.getReceipt(tripId, editing.id) : undefined}
            receiptLimitReached={[...data.expenses, ...data.deleted].filter((e) => e.hasReceipt).length >= MAX_RECEIPTS_PER_GROUP}
            onSubmit={async (input, receipt) => {
              if (editingChanged && !confirm('この支払いは他の人が更新しています。上書きして保存しますか？')) throw new Error('cancelled')
              const target = editing
              const saving = editing ? store.updateExpense(tripId, editing.id, input, receipt) : store.addExpense(tripId, input, receipt)
              // 先に知らせる (受領を待った後だと、その間に出た「元に戻す」の通知を上書きしてしまう)
              if (!editing) p.notify(`「${input.title}」を追加しました`)
              if (navigator.onLine) {
                // 通信できるときは受領を待つ (最大2.5秒)。拒否されたら入力を残したまま知らせる
                try {
                  await saving
                } catch (e) {
                  p.notify(`保存できませんでした: ${friendlyError(e)}`, { tone: 'error' })
                  throw e
                }
              } else {
                // 圏外では端末に即反映されるので待たずに閉じる (送信は電波が戻ってから)
                p.run(saving)
              }
              // 待っている間に別の支払いの編集を始めていたら閉じない
              if (p.isCurrent(target?.id)) p.onClose()
            }}
            onCancel={editing ? p.onClose : undefined}
          />
        )}
      </div>
    </section>
  )
}
