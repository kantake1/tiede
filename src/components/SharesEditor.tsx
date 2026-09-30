import { yen } from '../lib/format'
import type { Member, SplitMode } from '../types'

type Props = {
  members: Member[]
  mode: Exclude<SplitMode, 'items'>
  isIn: (id: string) => boolean
  onToggle: (id: string, on: boolean) => void
  onToggleAll: (on: boolean) => void
  /** 比率・金額指定の入力 */
  value: (id: string) => string
  onValue: (id: string, v: string) => void
  amount: number
  /** 金額指定の入力の合計 */
  assigned: number
  onFillRemainder: () => void
  /** 各自の負担額 (入力エラーがあれば null) */
  preview: Record<string, number> | null
}

/** 割り方「均等・比率・金額」: 対象者と各自の比率・金額 */
export function SharesEditor({ members, mode, isIn, onToggle, onToggleAll, value, onValue, amount, assigned, onFillRemainder, preview }: Props) {
  const allOn = members.every((m) => isIn(m.id))
  const unit = mode === 'ratio' ? '比率' : '金額'

  return (
    <>
      <div className="label-row">
        <span className="muted small">対象者</span>
        <button type="button" className="ghost small" onClick={() => onToggleAll(!allOn)}>
          {allOn ? '全解除' : '全員'}
        </button>
      </div>
      <ul className="participants">
        {members.map((m) => (
          <li key={m.id} className={isIn(m.id) ? '' : 'off'}>
            <label className="check">
              <input type="checkbox" checked={isIn(m.id)} onChange={(e) => onToggle(m.id, e.target.checked)} />
              {m.name}
            </label>
            {mode !== 'equal' && isIn(m.id) && (
              <input
                className="share-input"
                value={value(m.id)}
                onChange={(e) => onValue(m.id, e.target.value)}
                inputMode="decimal"
                placeholder={mode === 'ratio' ? '1' : '0'}
                aria-label={`${m.name} の${unit}`}
              />
            )}
            <span className="owed">{preview && preview[m.id] ? yen(preview[m.id]) : ''}</span>
          </li>
        ))}
      </ul>
      {mode === 'amount' && Number.isInteger(amount) && amount > 0 && (
        <div className="label-row">
          <span className={`small ${assigned === amount ? 'muted' : 'error'}`}>
            合計 {yen(assigned)} / {yen(amount)}
          </span>
          <button type="button" className="ghost small" onClick={onFillRemainder}>
            残りを空欄の人で均等割り
          </button>
        </div>
      )}
    </>
  )
}
