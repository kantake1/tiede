import { Check } from 'lucide-react'

/** 負担額の行の右端に置く「受取済み」の切り替え。立て替えた本人・負担0円の人は場所だけ空ける */
export function SettledToggle({ name, on, hidden, onToggle }: { name: string; on: boolean; hidden: boolean; onToggle: () => void }) {
  if (hidden) return <span className="paid-toggle" aria-hidden />
  return (
    <button type="button" className={`paid-toggle ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`${name} から受取済み`} onClick={onToggle}>
      {on && <Check size={14} />}
      受取済み
    </button>
  )
}
