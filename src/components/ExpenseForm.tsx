import { useState } from 'react'
import { dateOf, today } from '../lib/date'
import { buildExpense, fillRemainder, type ItemDraft } from '../lib/expenseDraft'
import { yen } from '../lib/format'
import { askName } from '../lib/names'
import { computeOwed } from '../lib/split'
import type { Category, Expense, ExpenseInput, Member, SplitMode } from '../types'
import { ItemsEditor } from './ItemsEditor'
import { useReceipt, type ReceiptResult } from './ReceiptSection'
import { SharesEditor } from './SharesEditor'

type Props = {
  members: Member[]
  categories: Category[]
  initial: Expense | null
  defaultCategoryId: string
  onCreateCategory: (name: string) => Promise<string>
  /** Firebase 未設定時は undefined (レシート読み取り不可) */
  readReceipt?: (file: File) => Promise<ReceiptResult>
  /** 編集中の支払いに保存済みのレシート写真を読み込む */
  getReceipt?: () => Promise<string | null>
  /** グループの保存枚数の上限に達している (写真は保存しない) */
  receiptLimitReached?: boolean
  /** receipt: 新しく読み取ったレシート写真 (変更が無ければ undefined) */
  onSubmit: (input: ExpenseInput, receipt?: string) => Promise<void>
  onCancel?: () => void
}

const MODES: { value: SplitMode; label: string }[] = [
  { value: 'equal', label: '均等' },
  { value: 'ratio', label: '比率' },
  { value: 'amount', label: '金額' },
  { value: 'items', label: '品目' },
]

const NEW_CATEGORY = '__new__'

export function ExpenseForm({
  members,
  categories,
  initial,
  defaultCategoryId,
  onCreateCategory,
  readReceipt,
  getReceipt,
  receiptLimitReached,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : '')
  const [payerChoice, setPayerId] = useState(initial?.payerId ?? members[0]?.id ?? '')
  const [mode, setMode] = useState<SplitMode>(initial?.mode ?? 'equal')
  const [categoryId, setCategoryId] = useState(
    initial ? (categories.some((c) => c.id === initial.categoryId) ? initial.categoryId! : '') : defaultCategoryId,
  )
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [date, setDate] = useState(initial ? dateOf(initial) : today())
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(members.map((m) => [m.id, initial ? (initial.shares[m.id] ?? 0) > 0 : true])),
  )
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((m) => {
        const v = initial?.shares[m.id]
        if (initial && (initial.mode === 'ratio' || initial.mode === 'amount') && v) return [m.id, String(v)]
        return [m.id, '']
      }),
    ),
  )
  const [items, setItems] = useState<ItemDraft[]>(() =>
    (initial?.items ?? []).map((it) => ({ name: it.name, priceText: String(it.price), memberIds: it.memberIds })),
  )
  const [busy, setBusy] = useState(false)
  const receipt = useReceipt({
    readReceipt,
    getReceipt,
    hasSaved: !!initial?.hasReceipt,
    limitReached: receiptLimitReached,
    onRead: (r) => {
      setItems(r.items.map((it) => ({ name: it.name, priceText: String(it.price), memberIds: members.map((m) => m.id) })))
      if (r.total > 0) setAmountText(String(r.total))
      if (!title.trim() && r.storeName) setTitle(r.storeName)
      setMode('items')
    },
  })

  // フォーム表示後に追加されたメンバーは、新規入力なら対象に含める
  const isIn = (id: string) => included[id] ?? !initial
  const val = (id: string) => values[id] ?? ''

  const targets = members.filter((m) => isIn(m.id))
  const memberIdSet = new Set(members.map((m) => m.id))
  // 選んでいた人が他の端末で削除されたら先頭のメンバーに切り替える (表示と中身のずれを防ぐ)
  const payerId = memberIdSet.has(payerChoice) ? payerChoice : (members[0]?.id ?? '')

  const built = buildExpense({ title, amountText, payerId, date, mode, targets, values, items }, memberIdSet)
  const { error, amount, shares, items: parsedItems, itemsTotal, assigned } = built
  const preview = error ? null : computeOwed({ amount, payerId, mode, shares, items: parsedItems })

  async function onCategoryChange(v: string) {
    if (v !== NEW_CATEGORY) return setCategoryId(v)
    const name = askName('新しいイベント名 (例: 沖縄旅行、3月の飲み会)', 50, { existing: categories.map((c) => c.name) })
    if (!name) return
    try {
      setCategoryId(await onCreateCategory(name))
    } catch (e) {
      alert(`イベントを作成できませんでした: ${(e as Error).message}`)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (error) return
    setBusy(true)
    try {
      await onSubmit(
        {
          title: title.trim(),
          amount,
          payerId,
          mode,
          shares: mode === 'items' ? {} : shares,
          items: mode === 'items' ? parsedItems : [],
          categoryId,
          memo: memo.trim(),
          date,
        },
        receipt.receiptNew,
      )
      if (!initial) {
        // 保存に失敗した (onSubmit が例外) 場合はここに来ないので、入力は残る
        receipt.reset()
        setTitle('')
        setAmountText('')
        setMemo('')
        setItems([])
        setValues(Object.fromEntries(members.map((m) => [m.id, ''])))
        setIncluded(Object.fromEntries(members.map((m) => [m.id, true])))
        setMode('equal')
      }
    } catch {
      // 失敗の通知は呼び出し側が行う。入力内容はそのまま残して再送できるようにする
    } finally {
      setBusy(false)
    }
  }

  if (members.length === 0) return <p className="notice">支払いを記録するには、先に「設定」からメンバーを追加してください。</p>

  return (
    <form className="expense-form stack" onSubmit={submit}>
      {/* 保存の受領を待つ間は入力させない (待ち終わりのリセットで打ち込み中の内容が消えるため) */}
      <fieldset className="form-fields" disabled={busy}>
        {readReceipt && receipt.section}

        <div className="grid2">
          <label>
            内容
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 食事代" maxLength={100} />
          </label>
          <label>
            金額 (円)
            <input value={amountText} onChange={(e) => setAmountText(e.target.value)} inputMode="numeric" placeholder="12000" />
          </label>
        </div>
        <div className="grid2">
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
          <label>
            日付
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        <label>
          イベント
          <select value={categoryId} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="">未分類</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>＋ 新しいイベント…</option>
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

          {mode === 'items' ? (
            <ItemsEditor
              members={members}
              items={items}
              onChange={setItems}
              itemsTotal={parsedItems.length > 0 ? itemsTotal : null}
              amount={amount}
              amountEmpty={amountText.trim() === ''}
              onApplyTotal={() => setAmountText(String(itemsTotal))}
              preview={preview}
            />
          ) : (
            <SharesEditor
              members={members}
              mode={mode}
              isIn={isIn}
              onToggle={(id, on) => setIncluded({ ...included, [id]: on })}
              onToggleAll={(on) => setIncluded(Object.fromEntries(members.map((m) => [m.id, on])))}
              value={val}
              onValue={(id, v) => setValues({ ...values, [id]: v })}
              amount={amount}
              assigned={assigned}
              onFillRemainder={() => {
                const next = fillRemainder(amount, targets.map((m) => m.id), values)
                if (next) setValues(next)
              }}
              preview={preview}
            />
          )}
        </div>

        <label>
          メモ
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="例: Aさんは途中から参加"
          />
        </label>

        {error && (title || amountText || items.length > 0) && <p className="error small">{error}</p>}
        {preview && mode !== 'items' && preview[payerId] !== undefined && !shares[payerId] && preview[payerId] > 0 && (
          <p className="muted small">端数 {yen(preview[payerId])} は立て替えた人の負担になります。</p>
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
      </fieldset>
      {receipt.dialogs}
    </form>
  )
}
