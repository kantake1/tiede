type Props = {
  label: string
  className: string
  min: number
  max: number
  /** ドラッグ開始時の実際の幅 (CSS で縮められている場合があるため実測する) */
  measure: () => number
  onChange: (width: number) => void
  onReset: () => void
}

/** 列の境界をドラッグ / 矢印キーで幅を変える。ダブルクリックで既定に戻す */
export function ResizeHandle({ label, className, min, max, measure, onChange, onReset }: Props) {
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)))

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    const el = e.currentTarget
    const startX = e.clientX
    const start = measure()
    el.setPointerCapture(e.pointerId)
    document.body.classList.add('resizing')
    const move = (ev: PointerEvent) => onChange(clamp(start + ev.clientX - startX))
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      document.body.classList.remove('resizing')
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 64 : 16
    if (e.key === 'ArrowLeft') onChange(clamp(measure() - step))
    else if (e.key === 'ArrowRight') onChange(clamp(measure() + step))
    else if (e.key === 'Home') onReset()
    else return
    e.preventDefault()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`${label} (ドラッグまたは矢印キーで変更、ダブルクリックで戻す)`}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className={`resize-handle ${className}`}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  )
}
