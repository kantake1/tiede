import { Check } from 'lucide-react'
import { yen } from '../lib/format'
import { groupOwed } from '../lib/names'
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
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? ''

  return (
    <>
      <div className="label-row">
        <span className="muted small">対象者</span>
        <button type="button" className="ghost small" onClick={() => onToggleAll(!allOn)}>
          {allOn ? '全解除' : '全員'}
        </button>
      </div>
      {mode === 'equal' ? (
        // 均等は入力欄が要らないので名前ボタンを折り返して並べ、負担額は1行にまとめる (人数が多くても縦に伸びない)
        <>
          <div className="chips">
            {members.map((m) => (
              <button
                type="button"
                key={m.id}
                className={`chip toggle ${isIn(m.id) ? 'on' : ''}`}
                aria-pressed={isIn(m.id)}
                onClick={() => onToggle(m.id, !isIn(m.id))}
              >
                {m.name}
              </button>
            ))}
          </div>
          {preview && (
            <>
              <div className="eq-sum">
                <OwedSummary entries={members.filter((m) => preview[m.id]).map((m) => [m.id, preview[m.id]])} nameOf={nameOf} />
              </div>
              {members.some((m) => preview[m.id] && m.id !== payerId) && (
                <>
                  <div className="label-row">
                    <span className="muted small">その場で受け取った人</span>
                  </div>
                  <div className="chips">
                    {members
                      .filter((m) => preview[m.id] && m.id !== payerId)
                      .map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          className={`chip toggle with-icon ${settled.includes(m.id) ? 'on' : ''}`}
                          aria-pressed={settled.includes(m.id)}
                          aria-label={`${m.name} から受取済み`}
                          onClick={() => onToggleSettled(m.id)}
                        >
                          {settled.includes(m.id) && <Check size={14} />}
                          {m.name}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      ) : (
        <ul className="participants with-paid">
          {members.map((m) => (
            <li key={m.id} className={isIn(m.id) ? '' : 'off'}>
              <label className="check">
                <input type="checkbox" checked={isIn(m.id)} onChange={(e) => onToggle(m.id, e.target.checked)} />
                {m.name}
              </label>
              {isIn(m.id) && (
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
      )}
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

/** 各自の負担額を「N人 各¥X / 名前 ¥Y」にまとめる。entries はメンバー順 */
export function OwedSummary({ entries, nameOf }: { entries: [string, number][]; nameOf: (id: string) => string }) {
  const { each, rest } = groupOwed(entries)
  return (
    <>
      {each && `${each.count}人 各${yen(each.amount)}`}
      {rest.map(([id, v], i) => (
        <span key={id}>
          {(each || i > 0) && ' / '}
          <span className="owed-item">
            {nameOf(id)} {yen(v)}
          </span>
        </span>
      ))}
    </>
  )
}
