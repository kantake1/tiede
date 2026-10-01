import { Image, ReceiptText, Tag, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatDate, toDateKey } from '../lib/date'
import { GRACE_DAYS, tripDeletionAt } from '../lib/grace'
import type { TripData } from '../types'

type Props = {
  data: TripData
  onCancel: () => void
  onConfirm: () => void
}

/** グループの削除予約の確認。消えるものの件数を示し、グループ名の入力で確定する (Enter の押し間違いで進まないように) */
export function TripDeleteDialog({ data, onCancel, onConfirm }: Props) {
  const [typed, setTyped] = useState('')
  const all = [...data.expenses, ...data.deleted]
  const name = data.trip.name
  // 開いた時点で予約したときの削除日
  const [date] = useState(() => formatDate(toDateKey(new Date(tripDeletionAt(Date.now())))))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal wide" role="alertdialog" aria-modal="true" aria-labelledby="trip-delete-title" onClick={(e) => e.stopPropagation()}>
        <p id="trip-delete-title" className="modal-title">
          「{name}」を削除しますか？
        </p>
        <p className="modal-body">
          {date} 以降に、次のものがまとめて削除され、このURLを知っている全員が開けなくなります。それまでの{GRACE_DAYS}日間は誰でも取り消せます。
        </p>
        <ul className="impact">
          <li>
            <ReceiptText size={16} />
            支払い<span className="n">{all.length}件</span>
          </li>
          <li>
            <Image size={16} />
            レシートの写真<span className="n">{all.filter((e) => e.hasReceipt).length}枚</span>
          </li>
          <li>
            <Users size={16} />
            メンバー<span className="n">{data.members.length}人</span>
          </li>
          <li>
            <Tag size={16} />
            イベント<span className="n">{data.categories.length}件</span>
          </li>
        </ul>
        <label className="impact-confirm">
          確認のため、グループ名を入力してください
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} autoComplete="off" autoFocus />
        </label>
        <div className="modal-actions">
          <button onClick={onCancel}>キャンセル</button>
          <button className="danger-fill" disabled={typed.trim() !== name} onClick={onConfirm}>
            削除を予約
          </button>
        </div>
      </div>
    </div>
  )
}
