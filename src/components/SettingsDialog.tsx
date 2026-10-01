import { X } from 'lucide-react'
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
}

/** 設定: メンバーとイベントの追加・名前変更・削除 */
export function SettingsDialog({ ref, data, store, tripId, run, onDeleteEvent }: Props) {
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
    </dialog>
  )
}
