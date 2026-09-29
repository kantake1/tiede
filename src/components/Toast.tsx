import { X } from 'lucide-react'
import { useEffect } from 'react'

export type ToastMessage = {
  id: number
  text: string
  tone?: 'error'
  action?: { label: string; run: () => void }
}

/** 画面下部に数秒表示する通知。操作 (元に戻す など) を1つ持てる */
export function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, toast.action || toast.tone === 'error' ? 7000 : 3500)
    return () => clearTimeout(t)
  }, [toast, onClose])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className={`toast ${toast.tone ?? ''}`} key={toast.id}>
          <span className="grow">{toast.text}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                toast.action!.run()
                onClose()
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button className="toast-close" onClick={onClose} aria-label="閉じる">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
