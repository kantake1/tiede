import { Camera, Plus, ReceiptText, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { dateOf, today } from '../lib/date'
import { friendlyError } from '../lib/errors'
import { askName } from '../lib/names'
import { compressReceipt } from '../lib/receiptImage'
import { ReceiptViewer } from './ReceiptViewer'
import { parseNumber, yen } from '../lib/format'
import { computeOwed } from '../lib/split'
import type { Category, Expense, ExpenseInput, Item, Member, SplitMode } from '../types'

type Props = {
  members: Member[]
  categories: Category[]
  initial: Expense | null
  defaultCategoryId: string
  onCreateCategory: (name: string) => Promise<string>
  /** Firebase 未設定時は undefined (レシート読み取り不可) */
  readReceipt?: (file: File) => Promise<{ storeName: string; total: number; items: { name: string; price: number }[] }>
  /** 編集中の支払いに保存済みのレシート写真を読み込む */
  getReceipt?: () => Promise<string | null>
  /** グループの保存枚数の上限に達している (写真は保存しない) */
  receiptLimitReached?: boolean
  /** receipt: 新しく読み取ったレシート写真 (変更が無ければ undefined) */
  onSubmit: (input: ExpenseInput, receipt?: string) => Promise<void>
  onCancel?: () => void
}

type ItemDraft = { name: string; priceText: string; memberIds: string[] }

const MODES: { value: SplitMode; label: string }[] = [
  { value: 'equal', label: '均等' },
  { value: 'ratio', label: '比率' },
  { value: 'amount', label: '金額' },
  { value: 'items', label: '品目' },
]

const NEW_CATEGORY = '__new__'
const MAX_AMOUNT = 100_000_000

// 説明文は端末ごとに初回だけ表示する
const HINT_READ = 'tiede:hint-receipt-read'
const HINT_SAVED = 'tiede:hint-receipt-saved'
const seen = (key: string) => {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
const markSeen = (key: string) => {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // 保存できなくても動作に影響しない
  }
}

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
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState('')
  const [receiptNote, setReceiptNote] = useState('')
  // 新しく読み取った写真 (undefined は未変更)。保存済みの写真は initial.hasReceipt で判断する
  const [receiptNew, setReceiptNew] = useState<string>()
  const hasPhoto = receiptNew !== undefined || !!initial?.hasReceipt
  const [viewer, setViewer] = useState<{ src: string | null } | null>(null)
  const [confirmReread, setConfirmReread] = useState(false)
  // 一度表示した説明文は、同じ入力欄に戻っても再び出さない
  const [hintRead, setHintRead] = useState(() => !seen(HINT_READ))
  const [hintSaved, setHintSaved] = useState(() => !seen(HINT_SAVED))
  const showReadHint = hintRead && !hasPhoto
  const showSavedHint = hintSaved && hasPhoto
  useEffect(() => {
    if (showReadHint) markSeen(HINT_READ)
    if (showSavedHint) markSeen(HINT_SAVED)
  }, [showReadHint, showSavedHint])

  // フォーム表示後に追加されたメンバーは、新規入力なら対象に含める
  const isIn = (id: string) => included[id] ?? !initial
  const val = (id: string) => values[id] ?? ''

  const amount = parseNumber(amountText)
  const targets = members.filter((m) => isIn(m.id))
  const memberIdSet = new Set(members.map((m) => m.id))
  // 選んでいた人が他の端末で削除されたら先頭のメンバーに切り替える (表示と中身のずれを防ぐ)
  const payerId = memberIdSet.has(payerChoice) ? payerChoice : (members[0]?.id ?? '')

  // shares / items を組み立てつつ入力エラーを検出する
  const shares: Record<string, number> = {}
  const parsedItems: Item[] = []
  let error = ''
  if (!title.trim()) error = '内容を入力してください'
  else if (!Number.isInteger(amount) || amount <= 0) error = '金額は1円以上の整数で入力してください'
  else if (amount > MAX_AMOUNT) error = '金額は1億円までにしてください'
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error = '日付を入力してください'
  else if (!memberIdSet.has(payerId)) error = '立て替えた人を選んでください'
  else if (mode === 'items') {
    if (items.length === 0) error = '品目を1つ以上追加してください'
    for (const [i, it] of items.entries()) {
      if (error) break
      const price = parseNumber(it.priceText.trim().replace(/^[-−ー]/, ''))
      const sign = /^[-−ー]/.test(it.priceText.trim()) ? -1 : 1
      const memberIds = it.memberIds.filter((id) => memberIdSet.has(id))
      if (!it.name.trim()) error = `${i + 1}行目の品名を入力してください`
      else if (!Number.isInteger(price)) error = `「${it.name}」の金額が正しくありません`
      else if (memberIds.length === 0) error = `「${it.name}」の対象者を選んでください`
      else parsedItems.push({ name: it.name.trim(), price: sign * price, memberIds })
    }
    if (!error && parsedItems.reduce((s, it) => s + it.price, 0) <= 0) error = '品目の合計が0円以下です'
  } else if (targets.length === 0) error = '対象者を1人以上選んでください'
  else {
    for (const m of targets) {
      if (mode === 'equal') shares[m.id] = 1
      else {
        const raw = val(m.id).trim()
        const v = raw === '' ? (mode === 'ratio' ? 1 : NaN) : parseNumber(raw)
        if (Number.isNaN(v) || v < 0 || (mode === 'amount' && !Number.isInteger(v))) {
          error = `${m.name} の${mode === 'ratio' ? '比率' : '金額'}が正しくありません`
          break
        }
        if (v > 0) shares[m.id] = v
      }
    }
    if (!error && Object.keys(shares).length === 0) error = '負担する人がいません'
  }

  const assigned = mode === 'amount' ? targets.reduce((s, m) => s + (parseNumber(val(m.id)) || 0), 0) : 0
  if (!error && mode === 'amount' && assigned !== amount) {
    error = `指定額の合計 ${yen(assigned)} が金額 ${yen(amount)} と一致しません (${assigned < amount ? '残り' : '超過'} ${yen(Math.abs(amount - assigned))})`
  }

  const itemsTotal = parsedItems.reduce((s, it) => s + it.price, 0)
  const preview = error ? null : computeOwed({ amount, payerId, mode, shares, items: parsedItems })

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

  const allIds = () => members.map((m) => m.id)
  const updateItem = (i: number, patch: Partial<ItemDraft>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const toggleItemMember = (i: number, id: string) => {
    const ids = items[i].memberIds
    updateItem(i, { memberIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })
  }

  async function onReceipt(file: File | undefined) {
    if (!file || !readReceipt) return
    setReading(true)
    setReadError('')
    setReceiptNote('')
    setHintRead(false)
    // 写真の圧縮は読み取りと並行して行い、読み取りに失敗しても写真は保存する
    const photo = receiptLimitReached ? Promise.resolve(null) : compressReceipt(file)
    photo.then((img) => {
      if (img) setReceiptNew(img)
      else
        setReceiptNote(
          receiptLimitReached
            ? 'このグループの保存枚数の上限に達したため、写真は保存しません'
            : 'この画像形式は保存できないため、写真は保存しません',
        )
    })
    try {
      const r = await readReceipt(file)
      if (r.items.length === 0) throw new Error('品目を読み取れませんでした')
      setItems(r.items.map((it) => ({ name: it.name, priceText: String(it.price), memberIds: allIds() })))
      if (r.total > 0) setAmountText(String(r.total))
      if (!title.trim() && r.storeName) setTitle(r.storeName)
      setMode('items')
    } catch (e) {
      setReadError(`読み取れませんでした: ${friendlyError(e)}`)
    } finally {
      setReading(false)
    }
  }

  async function showReceipt() {
    if (receiptNew) return setViewer({ src: receiptNew })
    setViewer({ src: null })
    try {
      const src = (await getReceipt?.()) ?? null
      if (!src) throw new Error('none')
      setViewer({ src })
    } catch {
      setViewer(null)
      setReceiptNote('写真を読み込めませんでした。電波の良い場所で再度試してください')
    }
  }

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
        receiptNew,
      )
      if (!initial) {
        // 保存に失敗した (onSubmit が例外) 場合はここに来ないので、入力は残る
        setReceiptNew(undefined)
        setReceiptNote('')
        setHintSaved(false)
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

  const allOn = targets.length === members.length

  if (members.length === 0) return <p className="notice">支払いを記録するには、先に「設定」からメンバーを追加してください。</p>

  return (
    <form className="expense-form stack" onSubmit={submit}>
      {/* 保存の受領を待つ間は入力させない (待ち終わりのリセットで打ち込み中の内容が消えるため) */}
      <fieldset className="form-fields" disabled={busy}>
        {readReceipt && (
          <div className="receipt">
            {hasPhoto ? (
              <>
                <div className="receipt-actions">
                  <button type="button" className="outline with-icon" onClick={showReceipt}>
                    <ReceiptText size={18} /> レシートを表示
                  </button>
                  <button type="button" className="ghost with-icon" disabled={reading} onClick={() => setConfirmReread(true)}>
                    <Camera size={18} /> {reading ? '読み取り中…' : '再度読み取る'}
                  </button>
                </div>
                {showSavedHint && <span className="muted small">レシートの写真を保存しています</span>}
              </>
            ) : (
              <>
                <label className={`button ${reading ? 'disabled' : ''}`}>
                  <input type="file" accept="image/*" hidden disabled={reading} onChange={(e) => onReceipt(e.target.files?.[0])} />
                  <Camera size={18} /> {reading ? '読み取り中…' : 'レシートを読み取る'}
                </label>
                {showReadHint && <span className="muted small">品目と合計を自動入力し、写真も保存します</span>}
              </>
            )}
            {readError && <p className="error small">{readError}</p>}
            {receiptNote && <p className="muted small">{receiptNote}</p>}
          </div>
        )}

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
            <>
              <ul className="items">
                {items.map((it, i) => (
                  <li key={i}>
                    <div className="row">
                      <input
                        className="grow"
                        value={it.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        placeholder="品名"
                        aria-label={`${i + 1}行目の品名`}
                        maxLength={100}
                      />
                      <input
                        className="price-input"
                        value={it.priceText}
                        onChange={(e) => updateItem(i, { priceText: e.target.value })}
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`${i + 1}行目の金額`}
                      />
                      <button
                        type="button"
                        className="ghost small danger"
                        onClick={() => setItems(items.filter((_, j) => j !== i))}
                        aria-label={`${i + 1}行目を削除`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="chips">
                      {members.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          className={`chip toggle ${it.memberIds.includes(m.id) ? 'on' : ''}`}
                          aria-pressed={it.memberIds.includes(m.id)}
                          onClick={() => toggleItemMember(i, m.id)}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="label-row">
                <button
                  type="button"
                  className="ghost small with-icon"
                  onClick={() => setItems([...items, { name: '', priceText: '', memberIds: allIds() }])}
                >
                  <Plus size={16} /> 品目を追加
                </button>
                {parsedItems.length > 0 && (
                  <span className="small muted">
                    品目合計 {yen(itemsTotal)}
                    {Number.isInteger(amount) && amount !== itemsTotal && ` / 差額 ${yen(amount - itemsTotal)} は按分`}
                    {amountText.trim() === '' && (
                      <button type="button" className="ghost small" onClick={() => setAmountText(String(itemsTotal))}>
                        金額に反映
                      </button>
                    )}
                  </span>
                )}
              </div>
              {preview && (
                <ul className="participants">
                  {members
                    .filter((m) => preview[m.id])
                    .map((m) => (
                      <li key={m.id}>
                        <span>{m.name}</span>
                        <span className="owed">{yen(preview[m.id])}</span>
                      </li>
                    ))}
                </ul>
              )}
            </>
          ) : (
            <>
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
            </>
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
      {confirmReread && (
        <div className="modal-scrim" onClick={() => setConfirmReread(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="reread-title" onClick={(e) => e.stopPropagation()}>
            <p id="reread-title" className="modal-title">
              再度読み取りますか？
            </p>
            <p className="modal-body">現在保存されているレシートの写真は削除され、新しい写真に置き換わります。</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirmReread(false)}>
                キャンセル
              </button>
              {/* iPhone は確認後の自動クリックで写真選択を開かないため、このボタン自体を写真選択にする */}
              <label className="button danger-fill">
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    setConfirmReread(false)
                    onReceipt(e.target.files?.[0])
                  }}
                />
                読み取る
              </label>
            </div>
          </div>
        </div>
      )}
      {viewer && <ReceiptViewer src={viewer.src} onClose={() => setViewer(null)} />}
    </form>
  )
}
