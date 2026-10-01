// 手動確認用のテストデータを Firestore エミュレータに入れる (#53)。本番には触れない
// `npm run dev:emulator` / `npm run dev:phone` の起動時に毎回実行され、毎回同じ状態から始まる
import { networkInterfaces } from 'node:os'

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-tiede/databases/(default)/documents'
const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

// JS の値を Firestore REST の値に変換する。Date は timestamp
function value(v) {
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  return { mapValue: { fields: fields(v) } }
}
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, value(v)]))

const writes = []
const put = (path, data) => writes.push({ update: { name: `projects/demo-tiede/databases/(default)/documents/${path}`, fields: fields(data) } })
const at = (i) => new Date(now - 30 * DAY + i)

// 1つのグループを入れる。id は URL (/t/{id}) に使うので英数字のみ。members は [id, 名前]、expenses は id 付きの支払い
function trip(id, name, members, categories = [], expenses = []) {
  put(`trips/${id}`, { name, createdAt: at(0) })
  members.forEach(([mid, n], i) => put(`trips/${id}/members/${mid}`, { name: n, createdAt: at(i) }))
  categories.forEach((c, i) => put(`trips/${id}/categories/${c.id}`, { name: c.name, archived: !!c.archived, createdAt: at(i) }))
  expenses.forEach(({ id: eid, ...e }, i) => put(`trips/${id}/expenses/${eid}`, { shares: {}, hasReceipt: false, createdAt: at(100 + i), ...e }))
}
const each = (ids) => Object.fromEntries(ids.map((id) => [id, 1]))

// 3人・イベント3つ (うち1つはアーカイブ)。割り方4種・受取済み・メモ・未分類・削除済み (猶予中 / 猶予後)
const S = ['sato', 'tanaka', 'suzuki']
trip(
  'testtrip',
  'テスト旅行',
  [['sato', '佐藤'], ['tanaka', '田中'], ['suzuki', '鈴木']],
  [{ id: 'travel', name: '旅行' }, { id: 'nabe', name: '鍋パ' }, { id: 'camp', name: '去年の合宿', archived: true }],
  [
    { id: 'e1', title: 'レンタカー', amount: 18000, payerId: 'sato', mode: 'equal', shares: each(S), categoryId: 'travel', date: '2026-09-20' },
    { id: 'e2', title: '夕食', amount: 12000, payerId: 'tanaka', mode: 'ratio', shares: { sato: 2, tanaka: 1, suzuki: 1 }, categoryId: 'travel', date: '2026-09-20', memo: '佐藤さんは2人分' },
    { id: 'e3', title: '宿', amount: 30000, payerId: 'suzuki', mode: 'amount', shares: { sato: 10000, tanaka: 12000, suzuki: 8000 }, categoryId: 'travel', date: '2026-09-21' },
    {
      id: 'e4', title: 'スーパー', amount: 3280, payerId: 'sato', mode: 'items', categoryId: 'nabe', date: '2026-09-25',
      items: [
        { name: '鍋の具', price: 2000, memberIds: S },
        { name: 'ビール', price: 1000, memberIds: ['sato', 'tanaka'] },
        { name: 'アイス', price: 200, memberIds: ['suzuki'] },
      ],
    },
    { id: 'e5', title: 'お酒', amount: 4500, payerId: 'tanaka', mode: 'equal', shares: each(S), categoryId: 'nabe', date: '2026-09-25', settledIds: ['suzuki'] },
    { id: 'e6', title: 'コインロッカー', amount: 700, payerId: 'suzuki', mode: 'equal', shares: each(S), date: '2026-09-22' },
    { id: 'e7', title: '合宿の食材', amount: 9000, payerId: 'sato', mode: 'equal', shares: each(S), categoryId: 'camp', date: '2025-08-10' },
    { id: 'e8', title: '間違えて追加', amount: 1000, payerId: 'sato', mode: 'equal', shares: each(S), categoryId: 'travel', date: '2026-09-21', deletedAt: now - DAY, trashedAt: new Date(now - DAY) },
    { id: 'e9', title: '重複した支払い', amount: 2400, payerId: 'tanaka', mode: 'equal', shares: each(S), categoryId: 'travel', date: '2026-09-20', deletedAt: now - 8 * DAY, trashedAt: new Date(now - 8 * DAY) },
  ],
)

// 12人 (7人以上で名前の要約が出る)
const L = ['相川', '井上', '上田', '江藤', '小野', '加藤', '木村', '工藤', '小林', '佐々木', '清水', '高橋']
const LM = L.map((n, i) => [`m${i + 1}`, n])
const LID = LM.map(([id]) => id)
trip('testlarge', '大人数テスト', LM, [{ id: 'party', name: '忘年会' }], [
  { id: 'l1', title: '会場費', amount: 60000, payerId: 'm1', mode: 'equal', shares: each(LID), categoryId: 'party', date: '2026-09-28' },
  {
    id: 'l2', title: '二次会', amount: 21000, payerId: 'm2', mode: 'items', categoryId: 'party', date: '2026-09-28',
    items: [
      { name: '席料', price: 12000, memberIds: LID },
      { name: 'ボトル', price: 8000, memberIds: LID.slice(0, 4) },
    ],
  },
  { id: 'l3', title: 'タクシー', amount: 4300, payerId: 'm3', mode: 'equal', shares: each(LID.slice(2, 6)), categoryId: 'party', date: '2026-09-28', settledIds: ['m4', 'm5'] },
])

// 支払いのない2人のグループ
trip('testempty', '空のグループ', [['a', 'Aさん'], ['b', 'Bさん']])

// 前回の操作を消してから入れる (エミュレータ専用の全削除 API)
await fetch(`http://127.0.0.1:8080/emulator/v1/projects/demo-tiede/databases/(default)/documents`, { method: 'DELETE' })
const res = await fetch(`${BASE}:commit`, {
  method: 'POST',
  headers: { Authorization: 'Bearer owner' },
  body: JSON.stringify({ writes }),
})
if (!res.ok) throw new Error(`テストデータを入れられませんでした: ${res.status} ${await res.text()}`)

const ip = Object.values(networkInterfaces()).flat().find((a) => a?.family === 'IPv4' && !a.internal)?.address
console.log('\nテストデータを入れました (起動のたびに同じ状態に戻ります)')
for (const [id, name] of [['testtrip', 'テスト旅行 (3人)'], ['testlarge', '大人数テスト (12人)'], ['testempty', '空のグループ']]) {
  console.log(`  ${name}: http://localhost:5173/t/${id}${ip ? `  スマホ: http://${ip}:5173/t/${id}` : ''}`)
}
console.log()
