import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import {
  collection,
  deleteDoc,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { WRITE_ERROR_EVENT } from '../lib/errors'
import type { Category, Expense, Member, Trip } from '../types'
import type { TripStore } from './types'

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

// Firebase AI Logic は App Check 必須。reCAPTCHA v3 を使う (Enterprise は課金アカウントが必要なため)。
// 開発時は登録済みデバッグトークンで代替する
if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
    ;(self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
}

// 旅行先の圏外・弱電波でも使えるよう、データを端末 (IndexedDB) に保持する。
// 書き込みは端末に即反映され、電波が戻るとサーバーへ送られる。複数タブでも共有する
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })

const trips = () => collection(db, 'trips')
const members = (tripId: string) => collection(db, 'trips', tripId, 'members')
const categories = (tripId: string) => collection(db, 'trips', tripId, 'categories')
const expenses = (tripId: string) => collection(db, 'trips', tripId, 'expenses')

// 書き込み直後のローカルスナップショットでは serverTimestamp が null になるため現在時刻で補う
const millis = (v: unknown) => (v as Timestamp | null)?.toMillis?.() ?? Date.now()

/**
 * Firestore の書き込み Promise はサーバーの受領まで解決しないため、オフラインでは永久に待つ。
 * 端末への反映は即時なので、一定時間で待つのをやめて先へ進め、後から失敗したら通知する。
 */
const WAIT_MS = 2500
function write(p: Promise<unknown>): Promise<void> {
  let waiting = true
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting = false
      resolve()
    }, WAIT_MS)
    p.then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      (e: Error) => {
        clearTimeout(timer)
        if (waiting) reject(e)
        else window.dispatchEvent(new CustomEvent(WRITE_ERROR_EVENT, { detail: e }))
      },
    )
  })
}

const toMember = (id: string, d: DocumentData): Member => ({ id, name: d.name, createdAt: millis(d.createdAt) })
const toCategory = (id: string, d: DocumentData): Category => ({
  id,
  name: d.name,
  archived: d.archived === true,
  createdAt: millis(d.createdAt),
})
const toExpense = (id: string, d: DocumentData): Expense => ({
  id,
  title: d.title,
  amount: d.amount,
  payerId: d.payerId,
  mode: d.mode,
  shares: d.shares ?? {},
  items: d.items,
  categoryId: d.categoryId,
  memo: d.memo,
  date: d.date,
  createdAt: millis(d.createdAt),
})

export const firestoreStore: TripStore = {
  kind: 'firestore',

  async createTrip(name, memberNames) {
    const tripRef = doc(trips())
    const batch = writeBatch(db)
    batch.set(tripRef, { name, createdAt: serverTimestamp() })
    // 同じバッチの serverTimestamp は全員同じ値になり並びが崩れるため、入力順に1msずつずらした端末時刻を使う
    const now = Date.now()
    memberNames.forEach((m, i) => batch.set(doc(members(tripRef.id)), { name: m, createdAt: Timestamp.fromMillis(now + i) }))
    await write(batch.commit())
    return tripRef.id
  },

  subscribe(tripId, onData, onError) {
    let trip: Trip | null | undefined
    let ms: Member[] | undefined
    let cs: Category[] | undefined
    let es: Expense[] | undefined
    const pending = [false, false, false, false]
    const emit = () => {
      if (trip === undefined || ms === undefined || cs === undefined || es === undefined) return
      if (trip === null) return onData(null)
      onData({
        trip,
        members: [...ms].sort((a, b) => a.createdAt - b.createdAt),
        categories: [...cs].sort((a, b) => a.createdAt - b.createdAt),
        expenses: [...es].sort((a, b) => a.createdAt - b.createdAt),
        pending: pending.some(Boolean),
      })
    }
    const err = (e: Error) => onError(e)
    const opts = { includeMetadataChanges: true }
    const unsubs = [
      onSnapshot(
        doc(trips(), tripId),
        opts,
        (s) => {
          pending[0] = s.metadata.hasPendingWrites
          // 端末に無く、まだサーバーからも取れていない間は「無い」と判定しない
          if (!s.exists() && s.metadata.fromCache) return
          trip = s.exists() ? { id: s.id, name: s.data().name, createdAt: millis(s.data().createdAt) } : null
          emit()
        },
        err,
      ),
      onSnapshot(
        members(tripId),
        opts,
        (s) => {
          pending[1] = s.metadata.hasPendingWrites
          ms = s.docs.map((d) => toMember(d.id, d.data()))
          emit()
        },
        err,
      ),
      onSnapshot(
        categories(tripId),
        opts,
        (s) => {
          pending[2] = s.metadata.hasPendingWrites
          cs = s.docs.map((d) => toCategory(d.id, d.data()))
          emit()
        },
        err,
      ),
      onSnapshot(
        expenses(tripId),
        opts,
        (s) => {
          pending[3] = s.metadata.hasPendingWrites
          es = s.docs.map((d) => toExpense(d.id, d.data()))
          emit()
        },
        err,
      ),
    ]
    return () => unsubs.forEach((u) => u())
  },

  renameTrip: (tripId, name) => write(updateDoc(doc(trips(), tripId), { name })),

  addMember: (tripId, name) => write(setDoc(doc(members(tripId)), { name, createdAt: serverTimestamp() })),

  renameMember: (tripId, memberId, name) => write(updateDoc(doc(members(tripId), memberId), { name })),

  removeMember: (tripId, memberId) => write(deleteDoc(doc(members(tripId), memberId))),

  async addCategory(tripId, name) {
    // ID は端末で決まるので、受領を待たずに返す (圏外でカテゴリを作ってすぐ選べるように)。失敗は後から通知
    const ref = doc(categories(tripId))
    write(setDoc(ref, { name, createdAt: serverTimestamp() })).catch((e) =>
      window.dispatchEvent(new CustomEvent(WRITE_ERROR_EVENT, { detail: e })),
    )
    return ref.id
  },

  renameCategory: (tripId, categoryId, name) => write(updateDoc(doc(categories(tripId), categoryId), { name })),

  removeCategory: (tripId, categoryId) => write(deleteDoc(doc(categories(tripId), categoryId))),

  setCategoryArchived: (tripId, categoryId, archived) => write(updateDoc(doc(categories(tripId), categoryId), { archived })),

  addExpense: (tripId, e) => write(setDoc(doc(expenses(tripId)), { ...e, createdAt: serverTimestamp() })),

  updateExpense: (tripId, expenseId, e) => write(updateDoc(doc(expenses(tripId), expenseId), { ...e })),

  deleteExpense: (tripId, expenseId) => write(deleteDoc(doc(expenses(tripId), expenseId))),

  restoreExpense(tripId, { id, createdAt, ...rest }) {
    // undefined のフィールドは Firestore が受け付けないため除く
    const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))
    return write(setDoc(doc(expenses(tripId), id), { ...data, createdAt: Timestamp.fromMillis(createdAt) }))
  },
}
