// firestore.rules のテスト。`npm run test:rules` でエミュレータを起動して実行する (通常の `npm test` では飛ばす)
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('firestore.rules', () => {
  let env: RulesTestEnvironment
  let db: Firestore
  const trip = () => doc(db, 'trips', 't1')
  const expense = (data: object) => ({
    title: '夕食',
    amount: 3000,
    payerId: 'm1',
    mode: 'equal',
    shares: {},
    createdAt: serverTimestamp(),
    ...data,
  })

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-tiede',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    })
  })
  afterAll(() => env.cleanup())
  beforeEach(async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'trips', 't1'), { name: '旅行', createdAt: Timestamp.now() }))
    db = env.unauthenticatedContext().firestore() as unknown as Firestore
  })

  it('グループは ID を知っていれば読めるが、一覧・削除はできない', async () => {
    await assertSucceeds(getDoc(trip()))
    await assertFails(getDocs(collection(db, 'trips')))
    await assertFails(deleteDoc(trip()))
  })

  it('グループの作成はメンバーと同じバッチで行え、余計な項目や端末時刻は拒否する', async () => {
    const b = writeBatch(db)
    b.set(doc(db, 'trips', 't2'), { name: '鍋パ', createdAt: serverTimestamp() })
    b.set(doc(db, 'trips', 't2', 'members', 'm1'), { name: 'たろう', createdAt: Timestamp.now() })
    await assertSucceeds(b.commit())
    // 端末時刻 (Timestamp.now() だとエミュレータの request.time と同じミリ秒になり、まれに通ってしまう)
    await assertFails(setDoc(doc(db, 'trips', 't3'), { name: 'x', createdAt: Timestamp.fromMillis(Date.now() - 60_000) }))
    await assertFails(setDoc(doc(db, 'trips', 't3'), { name: 'x', createdAt: serverTimestamp(), owner: 'a' }))
    await assertFails(setDoc(doc(db, 'trips', 't3'), { name: '', createdAt: serverTimestamp() }))
  })

  it('グループは名前だけ変更できる', async () => {
    await assertSucceeds(updateDoc(trip(), { name: '北海道' }))
    await assertFails(updateDoc(trip(), { createdAt: serverTimestamp() }))
    await assertFails(updateDoc(trip(), { name: 'x'.repeat(101) }))
  })

  it('存在しないグループにはイベント・支払いを作れない', async () => {
    await assertSucceeds(setDoc(doc(trip(), 'categories', 'c1'), { name: '旅行', createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(db, 'trips', 'none', 'categories', 'c1'), { name: '旅行', createdAt: serverTimestamp() }))
    await assertSucceeds(setDoc(doc(trip(), 'expenses', 'e1'), expense({})))
    await assertFails(setDoc(doc(db, 'trips', 'none', 'expenses', 'e1'), expense({})))
  })

  it('イベントの archived は真偽値のみ', async () => {
    const c = doc(trip(), 'categories', 'c1')
    await assertSucceeds(setDoc(c, { name: '旅行', createdAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(c, { archived: true }))
    await assertFails(updateDoc(c, { archived: 'yes' }))
  })

  it('支払いの項目を検証する', async () => {
    const e = doc(trip(), 'expenses', 'e1')
    await assertFails(setDoc(e, expense({ amount: 0 })))
    await assertFails(setDoc(e, expense({ amount: 1.5 })))
    await assertFails(setDoc(e, expense({ mode: 'other' })))
    await assertFails(setDoc(e, expense({ memo: 'x'.repeat(1001) })))
    await assertFails(setDoc(e, expense({ date: '2026/09/30' })))
    await assertFails(setDoc(e, expense({ extra: 1 })))
    await assertFails(setDoc(e, expense({ settledIds: 'm2' })))
    await assertSucceeds(setDoc(e, expense({ memo: 'x'.repeat(1000), date: '2026-09-30', hasReceipt: true, categoryId: 'c1', settledIds: ['m2'] })))
  })

  it('支払いの更新で createdAt は変えられない (削除後の復元は同じ ID で作り直す)', async () => {
    const e = doc(trip(), 'expenses', 'e1')
    await assertSucceeds(setDoc(e, expense({})))
    await assertSucceeds(updateDoc(e, { amount: 5000 }))
    await assertFails(updateDoc(e, { createdAt: Timestamp.fromMillis(0) }))
    await assertSucceeds(deleteDoc(e))
  })

  it('レシート写真は約300KB (41万文字) まで', async () => {
    const r = doc(trip(), 'receipts', 'e1')
    await assertSucceeds(setDoc(r, { data: 'a'.repeat(420000), createdAt: serverTimestamp() }))
    await assertFails(setDoc(r, { data: 'a'.repeat(420001), createdAt: serverTimestamp() }))
    await assertFails(setDoc(r, { data: '', createdAt: serverTimestamp() }))
  })
})
