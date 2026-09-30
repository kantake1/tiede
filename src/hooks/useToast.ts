import { useCallback, useEffect, useState } from 'react'
import type { ToastMessage } from '../components/Toast'
import { friendlyError, WRITE_ERROR_EVENT } from '../lib/errors'

/** 画面下の通知。待つのをやめた書き込みが後から失敗したときも知らせる */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const notify = useCallback(
    (text: string, opts: Omit<ToastMessage, 'id' | 'text'> = {}) =>
      // 「元に戻す」付きの通知は、操作のない普通の通知では上書きしない (取り消しの機会を失わないため)
      setToast((cur) => (cur?.action && !opts.action && opts.tone !== 'error' ? cur : { id: Date.now(), text, ...opts })),
    [],
  )
  const close = useCallback(() => setToast(null), [])

  useEffect(() => {
    const failed = (e: Event) => notify(`保存できなかった変更があります: ${friendlyError((e as CustomEvent).detail)}`, { tone: 'error' })
    window.addEventListener(WRITE_ERROR_EVENT, failed)
    return () => window.removeEventListener(WRITE_ERROR_EVENT, failed)
  }, [notify])

  return { toast, notify, close }
}
