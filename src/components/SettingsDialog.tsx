import { Trash2, X } from 'lucide-react'
import { formatDate, toDateKey } from '../lib/date'
import { GRACE_DAYS, tripDeletionAt } from '../lib/grace'
import { isMemberReferenced } from '../lib/tripView'
import type { TripStore } from '../store'
import type { TripData } from '../types'
import { NamesPanel } from './NamesPanel'

type Props = {
  ref: React.RefObject<HTMLDialogElement | null>
  data: TripData
  store: TripStore
  tripId: string
  /** 保存の失敗を知らせる */
  run: (p: Promise<unknown>) => void
  /** イベントの削除 (確認つき) */
  onDeleteEvent: (id: string) => void
  /** グループの削除予約 (確認画面を開く) と取り消し */
  onDeleteTrip: () => void
  onCancelTripDeletion: () => void
}

/** 設定: メンバーとイベントの追加・名前変更・削除、グループの削除予約 */
export function SettingsDialog({ ref, data, store, tripId, run, onDeleteEvent, onDeleteTrip, onCancelTripDeletion }: Props) {
  const requested = data.trip.deleteRequestedAt
  return (
    <dialog ref={ref} className="settings" onClick={(e) => e.target === e.currentTarget && ref.current?.close()}>
      <div className="row">
        <h2 className="grow">設定</h2>
        <button className="ghost icon" onClick={() => ref.current?.close()} aria-label="閉じる">
          <X size={20} />
        </button>
      </div>
      <NamesPanel
        title={`メンバー (${data.members.length}人)`}
        entries={data.members}
        placeholder="メンバーを追加"
        isReferenced={(id) => isMemberReferenced([...data.expenses, ...data.deleted], id)}
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
        onRemove={onDeleteEvent}
      />
      <section className="card danger-zone">
        <h2>グループの削除</h2>
        {requested === undefined ? (
          <>
            <p className="muted small">支払い・メンバー・イベント・レシートの写真をすべて削除します。{GRACE_DAYS}日間は誰でも取り消せます。</p>
            <button className="danger with-icon" onClick={onDeleteTrip}>
              <Trash2 size={16} /> グループを削除…
            </button>
          </>
        ) : (
          <>
            <p className="muted small">{formatDate(toDateKey(new Date(tripDeletionAt(requested))))} 以降に削除されます。</p>
            <button onClick={onCancelTripDeletion}>削除を取り消す</button>
          </>
        )}
      </section>
    </dialog>
  )
}
