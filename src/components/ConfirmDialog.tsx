import { useCallback, useEffect, useRef, useState } from 'react'

type Options = { title: string; body?: string; okLabel: string }
type State = Options & { resolve: (ok: boolean) => void }

/** 削除など取り消しにくい操作の確認。confirm() と同じく true/false を返す */
export function useConfirm(): [(o: Options) => Promise<boolean>, React.ReactNode] {
  const [state, setState] = useState<State | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const ask = useCallback((o: Options) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), [])
  const close = (ok: boolean) => {
    state?.resolve(ok)
    setState(null)
  }

  useEffect(() => {
    if (!state) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const ui = state && (
    <div className="modal-scrim" onClick={() => close(false)}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <p id="confirm-title" className="modal-title">
          {state.title}
        </p>
        {state.body && <p className="modal-body">{state.body}</p>}
        <div className="modal-actions">
          <button ref={cancelRef} onClick={() => close(false)}>
            キャンセル
          </button>
          <button className="danger-fill" onClick={() => close(true)}>
            {state.okLabel}
          </button>
        </div>
      </div>
    </div>
  )
  return [ask, ui]
}
