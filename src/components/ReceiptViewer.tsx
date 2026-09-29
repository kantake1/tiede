import { X } from 'lucide-react'
import { useEffect } from 'react'

/** 保存したレシート写真を画面いっぱいに表示する。× / 写真の外 / Esc で閉じる */
export function ReceiptViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="レシート" onClick={onClose}>
      <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
        <span>レシート</span>
        <button className="ghost icon" onClick={onClose} aria-label="閉じる">
          <X size={22} />
        </button>
      </div>
      {src ? (
        <img src={`data:image/jpeg;base64,${src}`} alt="保存したレシートの写真" onClick={(e) => e.stopPropagation()} />
      ) : (
        <p className="viewer-loading">読み込み中…</p>
      )}
    </div>
  )
}
