import { useState } from 'react'
import { ReceiptViewer } from './ReceiptViewer'

/** 保存したレシート写真の表示。読み込めなかったら onFail で知らせる */
export function useReceiptViewer(onFail: (message: string) => void) {
  // src が null の間は読み込み中
  const [view, setView] = useState<{ src: string | null } | null>(null)

  async function open(load: () => Promise<string | null>) {
    setView({ src: null })
    const src = await Promise.resolve()
      .then(load)
      .catch(() => null)
    if (src) return setView({ src })
    setView(null)
    onFail('写真を読み込めませんでした。電波の良い場所で再度試してください')
  }

  return {
    /** 手元にある写真をすぐ表示する */
    show: (src: string) => setView({ src }),
    open,
    ui: view && <ReceiptViewer src={view.src} onClose={() => setView(null)} />,
  }
}
