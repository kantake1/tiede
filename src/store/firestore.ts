import { initializeApp } from 'firebase/app'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore'
import type { Expense, Member, Trip } from '../types'
import type { TripStore } from './types'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)

const trips = () => collection(db, 'trips')
const members = (tripId: string) => collection(db, 'trips', tripId, 'members')
const expenses = (tripId: string) => collection(db, 'trips', tripId, 'expenses')

// 書き込み直後のローカルスナップショットでは serverTimestamp が null になるため現在時刻で補う
const millis = (v: unknown) => (v as Timestamp | null)?.toMillis?.() ?? Date.now()

const toMember = (id: string, d: DocumentData): Member => ({ id, name: d.name, createdAt: millis(d.createdAt) })
const toExpense = (id: string, d: DocumentData): Expense => ({
  id,
  title: d.title,
  amount: d.amount,
  payerId: d.payerId,
  mode: d.mode,
  shares: d.shares ?? {},
  createdAt: millis(d.createdAt),
})

export const firestoreStore: TripStore = {
  kind: 'firestore',

  async createTrip(name, memberNames) {
    const tripRef = doc(trips())
    const batch = writeBatch(db)
    batch.set(tripRef, { name, createdAt: serverTimestamp() })
    for (const m of memberNames) batch.set(doc(members(tripRef.id)), { name: m, createdAt: serverTimestamp() })
    await batch.commit()
    return tripRef.id
  },

  subscribe(tripId, onData, onError) {
    let trip: Trip | null | undefined
    let ms: Member[] | undefined
    let es: Expense[] | undefined
    const emit = () => {
      if (trip === undefined || ms === undefined || es === undefined) return
      if (trip === null) return onData(null)
      onData({
        trip,
        members: [...ms].sort((a, b) => a.createdAt - b.createdAt),
        expenses: [...es].sort((a, b) => a.createdAt - b.createdAt),
      })
    }
    const err = (e: Error) => onError(e)
    const unsubs = [
      onSnapshot(
        doc(trips(), tripId),
        (s) => {
          trip = s.exists() ? { id: s.id, name: s.data().name, createdAt: millis(s.data().createdAt) } : null
          emit()
        },
        err,
      ),
      onSnapshot(
        members(tripId),
        (s) => {
          ms = s.docs.map((d) => toMember(d.id, d.data()))
          emit()
        },
        err,
      ),
      onSnapshot(
        expenses(tripId),
        (s) => {
          es = s.docs.map((d) => toExpense(d.id, d.data()))
          emit()
        },
        err,
      ),
    ]
    return () => unsubs.forEach((u) => u())
  },

  async renameTrip(tripId, name) {
    await updateDoc(doc(trips(), tripId), { name })
  },

  async addMember(tripId, name) {
    await addDoc(members(tripId), { name, createdAt: serverTimestamp() })
  },

  async renameMember(tripId, memberId, name) {
    await updateDoc(doc(members(tripId), memberId), { name })
  },

  async removeMember(tripId, memberId) {
    await deleteDoc(doc(members(tripId), memberId))
  },

  async addExpense(tripId, e) {
    await setDoc(doc(expenses(tripId)), { ...e, createdAt: serverTimestamp() })
  },

  async updateExpense(tripId, expenseId, e) {
    await updateDoc(doc(expenses(tripId), expenseId), { ...e })
  },

  async deleteExpense(tripId, expenseId) {
    await deleteDoc(doc(expenses(tripId), expenseId))
  },
}
