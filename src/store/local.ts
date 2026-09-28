import type { TripData } from '../types'
import type { TripStore } from './types'

// Firebase 未設定時の動作確認用。データはこのブラウザ内にのみ保存される。
const KEY = 'tiede:local-trips'
const listeners = new Set<() => void>()

function load(): Record<string, TripData> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

function mutate(tripId: string, fn: (t: TripData) => void) {
  const all = load()
  const t = all[tripId]
  if (!t) throw new Error('旅行が見つからない')
  fn(t)
  localStorage.setItem(KEY, JSON.stringify(all))
  listeners.forEach((l) => l())
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
      expenses: [],
    }
    localStorage.setItem(KEY, JSON.stringify(all))
    return id
  },

  subscribe(tripId, onData) {
    const l = () => onData(load()[tripId] ?? null)
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

  async addExpense(tripId, e) {
    mutate(tripId, (t) => t.expenses.push({ ...e, id: newId(), createdAt: Date.now() }))
  },

  async updateExpense(tripId, expenseId, e) {
    mutate(tripId, (t) => (t.expenses = t.expenses.map((x) => (x.id === expenseId ? { ...x, ...e } : x))))
  },

  async deleteExpense(tripId, expenseId) {
    mutate(tripId, (t) => (t.expenses = t.expenses.filter((x) => x.id !== expenseId)))
  },
}
