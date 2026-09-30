import { Plus, X } from 'lucide-react'
import type { ItemDraft } from '../lib/expenseDraft'
import { yen } from '../lib/format'
import type { Member } from '../types'

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
}

/** 割り方「品目」: 品目ごとに対象者を選ぶ */
export function ItemsEditor({ members, items, onChange, itemsTotal, amount, amountEmpty, onApplyTotal, preview }: Props) {
  const allIds = () => members.map((m) => m.id)
  const update = (i: number, patch: Partial<ItemDraft>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const toggleMember = (i: number, id: string) => {
    const ids = items[i].memberIds
    update(i, { memberIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })
  }

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
                onClick={() => onChange(items.filter((_, j) => j !== i))}
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
                  onClick={() => toggleMember(i, m.id)}
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
  )
}
