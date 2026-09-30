import { loadJson } from '../lib/storage'
import type { TripData } from '../types'
import type { TripStore } from './types'

// Firebase 未設定時の動作確認用。データはこのブラウザ内にのみ保存される。
const KEY = 'tiede:local-trips'
const listeners = new Set<() => void>()

const load = () => loadJson<Record<string, TripData>>(KEY, {})

function mutate(tripId: string, fn: (t: TripData) => void) {
  const all = load()
  const t = all[tripId]
  if (!t) throw new Error('グループが見つかりません')
  fn(t)
  localStorage.setItem(KEY, JSON.stringify(all))
  listeners.forEach((l) => l())
}

// レシート写真は容量が大きいため別のキーに保存する (端末の保存容量を超えたら例外)
const RECEIPTS_KEY = 'tiede:local-receipts'
const loadReceipts = () => loadJson<Record<string, string>>(RECEIPTS_KEY, {})
function setReceipt(tripId: string, expenseId: string, data: string | null) {
  const all = loadReceipts()
  if (data) all[`${tripId}/${expenseId}`] = data
  else delete all[`${tripId}/${expenseId}`]
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(all))
}

const newId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 20)

window.addEventListener('storage', (e) => {
  if (e.key === KEY) listeners.forEach((l) => l())
})

export const localStore: TripStore = {
  kind: 'local',

  async createTrip(name, memberNames) {
    const id = newId()
    const now = Date.now()
    const all = load()
    all[id] = {
      trip: { id, name, createdAt: now },
      members: memberNames.map((n, i) => ({ id: newId(), name: n, createdAt: now + i })),
      categories: [],
      expenses: [],
    }
    localStorage.setItem(KEY, JSON.stringify(all))
    return id
  },

  subscribe(tripId, onData) {
    // categories 追加前に保存されたデータにも対応する
    const l = () => {
      const t = load()[tripId]
      onData(t ? { ...t, categories: (t.categories ?? []).map((c) => ({ ...c, archived: c.archived ?? false })) } : null)
    }
    listeners.add(l)
    queueMicrotask(l)
    return () => listeners.delete(l)
  },

  async renameTrip(tripId, name) {
    mutate(tripId, (t) => (t.trip.name = name))
  },

  async addMember(tripId, name) {
    mutate(tripId, (t) => t.members.push({ id: newId(), name, createdAt: Date.now() }))
  },

  async renameMember(tripId, memberId, name) {
    mutate(tripId, (t) => t.members.forEach((m) => m.id === memberId && (m.name = name)))
  },

  async removeMember(tripId, memberId) {
    mutate(tripId, (t) => (t.members = t.members.filter((m) => m.id !== memberId)))
  },

  async addCategory(tripId, name) {
    const id = newId()
    mutate(tripId, (t) => (t.categories = [...(t.categories ?? []), { id, name, archived: false, createdAt: Date.now() }]))
    return id
  },

  async renameCategory(tripId, categoryId, name) {
    mutate(tripId, (t) => t.categories.forEach((c) => c.id === categoryId && (c.name = name)))
  },

  async removeCategory(tripId, categoryId) {
    mutate(tripId, (t) => (t.categories = t.categories.filter((c) => c.id !== categoryId)))
  },

  async setCategoryArchived(tripId, categoryId, archived) {
    mutate(tripId, (t) => t.categories.forEach((c) => c.id === categoryId && (c.archived = archived)))
  },

  async addExpense(tripId, e, receipt) {
    const id = newId()
    if (receipt) setReceipt(tripId, id, receipt)
    mutate(tripId, (t) => t.expenses.push({ ...e, id, hasReceipt: !!receipt, createdAt: Date.now() }))
  },

  async updateExpense(tripId, expenseId, e, receipt) {
    if (receipt !== undefined) setReceipt(tripId, expenseId, receipt)
    const extra = receipt === undefined ? {} : { hasReceipt: receipt !== null }
    mutate(tripId, (t) => (t.expenses = t.expenses.map((x) => (x.id === expenseId ? { ...x, ...e, ...extra } : x))))
  },

  async deleteExpense(tripId, expenseId) {
    setReceipt(tripId, expenseId, null)
    mutate(tripId, (t) => (t.expenses = t.expenses.filter((x) => x.id !== expenseId)))
  },

  async getReceipt(tripId, expenseId) {
    return loadReceipts()[`${tripId}/${expenseId}`] ?? null
  },

  async restoreExpense(tripId, expense, receipt) {
    if (receipt) setReceipt(tripId, expense.id, receipt)
    mutate(tripId, (t) => (t.expenses = [...t.expenses.filter((x) => x.id !== expense.id), { ...expense, hasReceipt: !!receipt }]))
  },
}
