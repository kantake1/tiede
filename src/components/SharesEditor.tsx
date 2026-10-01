import { yen } from '../lib/format'
import type { Member, SplitMode } from '../types'
import { SettledToggle } from './SettledToggle'

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
  payerId: string
  settled: string[]
  onToggleSettled: (id: string) => void
}

/** 割り方「均等・比率・金額」: 対象者と各自の比率・金額 */
export function SharesEditor({ members, mode, isIn, onToggle, onToggleAll, value, onValue, amount, assigned, onFillRemainder, preview, payerId, settled, onToggleSettled }: Props) {
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
      <ul className="participants with-paid">
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
            <Owed v={preview?.[m.id]} settled={settled.includes(m.id) && m.id !== payerId} />
            <SettledToggle
              name={m.name}
              on={settled.includes(m.id)}
              hidden={m.id === payerId || !preview?.[m.id]}
              onToggle={() => onToggleSettled(m.id)}
            />
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

/** 各自の負担額。受取済みは取り消し線 */
export function Owed({ v, settled }: { v: number | undefined; settled: boolean }) {
  return <span className="owed">{v ? settled ? <s>{yen(v)}</s> : yen(v) : ''}</span>
}
