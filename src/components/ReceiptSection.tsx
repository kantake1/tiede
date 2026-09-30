import { Camera, ReceiptText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { friendlyError } from '../lib/errors'
import { compressReceipt } from '../lib/receiptImage'
import { loadFlag, saveFlag } from '../lib/storage'
import { useReceiptViewer } from './useReceiptViewer'

export type ReceiptResult = { storeName: string; total: number; items: { name: string; price: number }[] }

type Options = {
  /** Firebase 未設定時は undefined (レシート読み取り不可) */
  readReceipt?: (file: File) => Promise<ReceiptResult>
  /** 保存済みのレシート写真を読み込む (編集中のみ) */
  getReceipt?: () => Promise<string | null>
  /** 編集中の支払いに写真が保存されている */
  hasSaved: boolean
  /** グループの保存枚数の上限に達している (写真は保存しない) */
  limitReached?: boolean
  /** 品目を読み取れたとき */
  onRead: (r: ReceiptResult) => void
}

// 説明文は端末ごとに初回だけ表示する
const HINT_READ = 'tiede:hint-receipt-read'
const HINT_SAVED = 'tiede:hint-receipt-saved'

/**
 * 支払い入力のレシート欄 (読み取り・写真の表示・再読み取りの確認)。
 * section は入力欄の中、dialogs は入力欄の外に置く。receiptNew は新しく読み取った写真 (undefined は未変更)
 */
export function useReceipt({ readReceipt, getReceipt, hasSaved, limitReached, onRead }: Options) {
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState('')
  const [note, setNote] = useState('')
  const [receiptNew, setReceiptNew] = useState<string>()
  const hasPhoto = receiptNew !== undefined || hasSaved
  const viewer = useReceiptViewer((msg) => setNote(msg))
  const [confirmReread, setConfirmReread] = useState(false)
  // 一度表示した説明文は、同じ入力欄に戻っても再び出さない
  const [hintRead, setHintRead] = useState(() => !loadFlag(HINT_READ))
  const [hintSaved, setHintSaved] = useState(() => !loadFlag(HINT_SAVED))
  const showReadHint = hintRead && !hasPhoto
  const showSavedHint = hintSaved && hasPhoto
  useEffect(() => {
    if (showReadHint) saveFlag(HINT_READ, true)
    if (showSavedHint) saveFlag(HINT_SAVED, true)
  }, [showReadHint, showSavedHint])

  async function read(file: File | undefined) {
    if (!file || !readReceipt) return
    setReading(true)
    setReadError('')
    setNote('')
    setHintRead(false)
    // 写真の圧縮は読み取りと並行して行い、読み取りに失敗しても写真は保存する
    const photo = limitReached ? Promise.resolve(null) : compressReceipt(file)
    photo.then((img) => {
      if (img) setReceiptNew(img)
      else
        setNote(
          limitReached ? 'このグループの保存枚数の上限に達したため、写真は保存しません' : 'この画像形式は保存できないため、写真は保存しません',
        )
    })
    try {
      const r = await readReceipt(file)
      if (r.items.length === 0) throw new Error('品目を読み取れませんでした')
      onRead(r)
    } catch (e) {
      setReadError(`読み取れませんでした: ${friendlyError(e)}`)
    } finally {
      setReading(false)
    }
  }

  const show = () => (receiptNew ? viewer.show(receiptNew) : viewer.open(() => getReceipt?.() ?? Promise.resolve(null)))

  /** 新規入力を保存した後の片付け */
  function reset() {
    setReceiptNew(undefined)
    setNote('')
    setHintSaved(false)
  }

  const section = (
    <div className="receipt">
      {hasPhoto ? (
        <>
          <div className="receipt-actions">
            <button type="button" className="outline with-icon" onClick={show}>
              <ReceiptText size={18} /> レシートを表示
            </button>
            <button type="button" className="ghost with-icon" disabled={reading} onClick={() => setConfirmReread(true)}>
              <Camera size={18} /> {reading ? '読み取り中…' : '再度読み取る'}
            </button>
          </div>
          {showSavedHint && <span className="muted small">レシートの写真を保存しています</span>}
        </>
      ) : (
        <>
          <label className={`button ${reading ? 'disabled' : ''}`}>
            <input type="file" accept="image/*" hidden disabled={reading} onChange={(e) => read(e.target.files?.[0])} />
            <Camera size={18} /> {reading ? '読み取り中…' : 'レシートを読み取る'}
          </label>
          {showReadHint && <span className="muted small">品目と合計を自動入力し、写真も保存します</span>}
        </>
      )}
      {readError && <p className="error small">{readError}</p>}
      {note && <p className="muted small">{note}</p>}
    </div>
  )

  const dialogs = (
    <>
      {confirmReread && (
        <div className="modal-scrim" onClick={() => setConfirmReread(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="reread-title" onClick={(e) => e.stopPropagation()}>
            <p id="reread-title" className="modal-title">
              再度読み取りますか？
            </p>
            <p className="modal-body">現在保存されているレシートの写真は削除され、新しい写真に置き換わります。</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirmReread(false)}>
                キャンセル
              </button>
              {/* iPhone は確認後の自動クリックで写真選択を開かないため、このボタン自体を写真選択にする */}
              <label className="button danger-fill">
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    setConfirmReread(false)
                    read(e.target.files?.[0])
                  }}
                />
                読み取る
              </label>
            </div>
          </div>
        </div>
      )}
      {viewer.ui}
    </>
  )

  return { receiptNew, reset, section, dialogs }
}
