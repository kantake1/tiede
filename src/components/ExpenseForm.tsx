import { useState } from 'react'
import { parseNumber, yen } from '../lib/format'
import { computeOwed } from '../lib/split'
import type { Expense, ExpenseInput, Member, SplitMode } from '../types'

type Props = {
  members: Member[]
  initial: Expense | null
  onSubmit: (input: ExpenseInput) => Promise<void>
  onCancel?: () => void
}

const MODES: { value: SplitMode; label: string }[] = [
  { value: 'equal', label: '均等' },
  { value: 'ratio', label: '比率' },
  { value: 'amount', label: '金額指定' },
]

export function ExpenseForm({ members, initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : '')
  const [payerId, setPayerId] = useState(initial?.payerId ?? members[0]?.id ?? '')
  const [mode, setMode] = useState<SplitMode>(initial?.mode ?? 'equal')
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(members.map((m) => [m.id, initial ? (initial.shares[m.id] ?? 0) > 0 : true])),
  )
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((m) => {
        const v = initial?.shares[m.id]
        if (initial && initial.mode !== 'equal' && v) return [m.id, String(v)]
        return [m.id, '']
      }),
    ),
  )
  const [busy, setBusy] = useState(false)

  // フォーム表示後に追加されたメンバーは、新規入力なら対象に含める
  const isIn = (id: string) => included[id] ?? !initial
  const val = (id: string) => values[id] ?? ''

  const amount = parseNumber(amountText)
  const targets = members.filter((m) => isIn(m.id))

  // shares を組み立てつつ入力エラーを検出する
  const shares: Record<string, number> = {}
  let error = ''
  if (!title.trim()) error = '内容を入力する'
  else if (!Number.isInteger(amount) || amount <= 0) error = '金額は1円以上の整数で入力する'
  else if (!members.some((m) => m.id === payerId)) error = '立て替えた人を選ぶ'
  else if (targets.length === 0) error = '対象者を1人以上選ぶ'
  else {
    for (const m of targets) {
      if (mode === 'equal') shares[m.id] = 1
      else {
        const raw = val(m.id).trim()
        const v = raw === '' ? (mode === 'ratio' ? 1 : NaN) : parseNumber(raw)
        if (Number.isNaN(v) || v < 0 || (mode === 'amount' && !Number.isInteger(v))) {
          error = `${m.name} の${mode === 'ratio' ? '比率' : '金額'}が不正`
          break
        }
        if (v > 0) shares[m.id] = v
      }
    }
    if (!error && Object.keys(shares).length === 0) error = '負担する人がいない'
  }

  const assigned = mode === 'amount' ? targets.reduce((s, m) => s + (parseNumber(val(m.id)) || 0), 0) : 0
  if (!error && mode === 'amount' && assigned !== amount) {
    error = `指定額の合計 ${yen(assigned)} が金額 ${yen(amount)} と一致しない (${assigned < amount ? '残り' : '超過'} ${yen(Math.abs(amount - assigned))})`
  }

  const preview = error ? null : computeOwed({ amount, payerId, mode, shares })

  function fillRemainder() {
    const blanks = targets.filter((m) => val(m.id).trim() === '')
    const pool = blanks.length ? blanks : targets
    const fixed = targets.filter((m) => !pool.includes(m)).reduce((s, m) => s + (parseNumber(val(m.id)) || 0), 0)
    const rest = amount - fixed
    if (!Number.isInteger(amount) || rest < 0 || pool.length === 0) return
    const each = Math.floor(rest / pool.length)
    const next = { ...values }
    pool.forEach((m, i) => (next[m.id] = String(each + (i < rest - each * pool.length ? 1 : 0))))
    setValues(next)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (error) return
    setBusy(true)
    try {
      await onSubmit({ title: title.trim(), amount, payerId, mode, shares })
      if (!initial) {
        setTitle('')
        setAmountText('')
        setValues(Object.fromEntries(members.map((m) => [m.id, ''])))
        setIncluded(Object.fromEntries(members.map((m) => [m.id, true])))
        setMode('equal')
      }
    } finally {
      setBusy(false)
    }
  }

  const allOn = targets.length === members.length

  return (
    <form className="expense-form stack" onSubmit={submit}>
      <div className="grid2">
        <label>
          内容
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 夕食" maxLength={100} />
        </label>
        <label>
          金額 (円)
          <input value={amountText} onChange={(e) => setAmountText(e.target.value)} inputMode="numeric" placeholder="12000" />
        </label>
      </div>
      <label>
        立て替えた人
        <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <div className="label-row">
          <span>割り方</span>
          <div className="segmented" role="radiogroup">
            {MODES.map((o) => (
              <button
                type="button"
                key={o.value}
                role="radio"
                aria-checked={mode === o.value}
                className={mode === o.value ? 'active' : ''}
                onClick={() => setMode(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="label-row">
          <span className="muted small">対象者</span>
          <button
            type="button"
            className="ghost small"
            onClick={() => setIncluded(Object.fromEntries(members.map((m) => [m.id, !allOn])))}
          >
            {allOn ? '全解除' : '全員'}
          </button>
        </div>
        <ul className="participants">
          {members.map((m) => (
            <li key={m.id} className={isIn(m.id) ? '' : 'off'}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={isIn(m.id)}
                  onChange={(e) => setIncluded({ ...included, [m.id]: e.target.checked })}
                />
                {m.name}
              </label>
              {mode !== 'equal' && isIn(m.id) && (
                <input
                  className="share-input"
                  value={val(m.id)}
                  onChange={(e) => setValues({ ...values, [m.id]: e.target.value })}
                  inputMode="decimal"
                  placeholder={mode === 'ratio' ? '1' : '0'}
                  aria-label={`${m.name} の${mode === 'ratio' ? '比率' : '金額'}`}
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
            <button type="button" className="ghost small" onClick={fillRemainder}>
              残りを空欄の人で均等割り
            </button>
          </div>
        )}
      </div>

      {error && (title || amountText) && <p className="error small">{error}</p>}
      {preview && preview[payerId] !== undefined && !shares[payerId] && preview[payerId] > 0 && (
        <p className="muted small">端数 {yen(preview[payerId])} は立て替えた人の負担になる。</p>
      )}

      <div className="row">
        <button type="submit" className="primary grow" disabled={!!error || busy}>
          {initial ? '更新' : '追加'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
        )}
      </div>
    </form>
  )
}
