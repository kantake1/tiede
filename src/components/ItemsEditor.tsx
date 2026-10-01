import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { pickItemMember, type ItemDraft } from '../lib/expenseDraft'
import { yen } from '../lib/format'
import { whoLabel } from '../lib/names'
import type { Member } from '../types'
import { SettledToggle } from './SettledToggle'
import { Owed } from './SharesEditor'

// これより多いと、品目ごとの名前ボタンを要約に畳む (少人数では1タップ増えるだけなので畳まない)
const FOLD_MEMBERS = 6

type Props = {
  members: Member[]
  items: ItemDraft[]
  onChange: (items: ItemDraft[]) => void
  /** 入力の正しい品目の合計 (正しい品目が無ければ null) */
  itemsTotal: number | null
  amount: number
  /** 金額欄が空 (品目合計を金額に反映できる) */
  amountEmpty: boolean
  onApplyTotal: () => void
  /** 各自の負担額 (入力エラーがあれば null) */
  preview: Record<string, number> | null
  payerId: string
  settled: string[]
  onToggleSettled: (id: string) => void
}

/** 割り方「品目」: 品目ごとに対象者を選ぶ。読み取り直後は全員で、個人の物は名前を1回押せばその人だけになる */
export function ItemsEditor({ members, items, onChange, itemsTotal, amount, amountEmpty, onApplyTotal, preview, payerId, settled, onToggleSettled }: Props) {
  const allIds = () => members.map((m) => m.id)
  const all = (it: ItemDraft) => members.every((m) => it.memberIds.includes(m.id))
  const update = (i: number, patch: Partial<ItemDraft>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? ''
  const fold = members.length > FOLD_MEMBERS
  // 畳んでいるときに名前ボタンを開いている品目 (同時に1つ)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const who = (it: ItemDraft) => whoLabel(members.filter((m) => it.memberIds.includes(m.id)).map((m) => m.id), allIds(), nameOf, true)
  const chipsFor = (it: ItemDraft, i: number) => (
    <div className="chips">
      <button
        type="button"
        className={`chip toggle ${all(it) ? 'on' : ''}`}
        aria-pressed={all(it)}
        onClick={() => update(i, { memberIds: allIds() })}
      >
        全員
      </button>
      {members.map((m) => (
        <button
          type="button"
          key={m.id}
          // 全員のときの名前は、押すと「その人だけ」になることを点線の枠で示す
          className={`chip toggle ${all(it) ? 'pick' : it.memberIds.includes(m.id) ? 'on' : ''}`}
          aria-pressed={!all(it) && it.memberIds.includes(m.id)}
          aria-label={all(it) ? `${m.name}だけ` : undefined}
          onClick={() => update(i, { memberIds: pickItemMember(it.memberIds, m.id, allIds()) })}
        >
          {m.name}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <ul className="items">
        {items.map((it, i) => (
          <li key={i}>
            <div className="row">
              <input
                className="grow"
                value={it.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="品名"
                aria-label={`${i + 1}行目の品名`}
                maxLength={100}
              />
              <input
                className="price-input"
                value={it.priceText}
                onChange={(e) => update(i, { priceText: e.target.value })}
                inputMode="numeric"
                placeholder="0"
                aria-label={`${i + 1}行目の金額`}
              />
              <button
                type="button"
                className="ghost small danger"
                onClick={() => {
                  setOpenIndex(null)
                  onChange(items.filter((_, j) => j !== i))
                }}
                aria-label={`${i + 1}行目を削除`}
              >
                <X size={16} />
              </button>
            </div>
            {fold ? (
              <>
                <button
                  type="button"
                  className={`who-sum ${all(it) ? '' : 'part'}`}
                  aria-expanded={openIndex === i}
                  aria-label={`${i + 1}行目の対象者: ${who(it)}`}
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                >
                  <span className="who-text">
                    {who(it)}
                  </span>
                  {openIndex === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {openIndex === i && <div className="who-open">{chipsFor(it, i)}</div>}
              </>
            ) : (
              chipsFor(it, i)
            )}
          </li>
        ))}
      </ul>
      <div className="label-row">
        <button
          type="button"
          className="ghost small with-icon"
          onClick={() => onChange([...items, { name: '', priceText: '', memberIds: allIds() }])}
        >
          <Plus size={16} /> 品目を追加
        </button>
        {itemsTotal !== null && (
          <span className="small muted">
            品目合計 {yen(itemsTotal)}
            {Number.isInteger(amount) && amount !== itemsTotal && ` / 差額 ${yen(amount - itemsTotal)} は按分`}
            {amountEmpty && (
              <button type="button" className="ghost small" onClick={onApplyTotal}>
                金額に反映
              </button>
            )}
          </span>
        )}
      </div>
      {preview && (
        <ul className="participants with-paid">
          {members
            .filter((m) => preview[m.id])
            .map((m) => (
              <li key={m.id}>
                <span>{m.name}</span>
                <Owed v={preview[m.id]} settled={settled.includes(m.id) && m.id !== payerId} />
                <SettledToggle name={m.name} on={settled.includes(m.id)} hidden={m.id === payerId} onToggle={() => onToggleSettled(m.id)} />
              </li>
            ))}
        </ul>
      )}
    </>
  )
}
