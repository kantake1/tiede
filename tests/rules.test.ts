// firestore.rules のテスト。`npm run test:rules` でエミュレータを起動して実行する (通常の `npm test` では飛ばす)
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  deleteField,
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
    await assertFails(setDoc(e, expense({ deletedAt: 'yesterday' })))
    await assertSucceeds(setDoc(e, expense({ memo: 'x'.repeat(1000), date: '2026-09-30', hasReceipt: true, categoryId: 'c1', settledIds: ['m2'], deletedAt: 1 })))
  })

  it('支払いの更新で createdAt は変えられない', async () => {
    const e = doc(trip(), 'expenses', 'e1')
    await assertSucceeds(setDoc(e, expense({})))
    await assertSucceeds(updateDoc(e, { amount: 5000 }))
    await assertFails(updateDoc(e, { createdAt: Timestamp.fromMillis(0) }))
  })

  it('レシート写真は約300KB (41万文字) まで', async () => {
    const r = doc(trip(), 'receipts', 'e1')
    await assertSucceeds(setDoc(r, { data: 'a'.repeat(420000), createdAt: serverTimestamp() }))
    await assertFails(setDoc(r, { data: 'a'.repeat(420001), createdAt: serverTimestamp() }))
    await assertFails(setDoc(r, { data: '', createdAt: serverTimestamp() }))
  })

  describe('削除の猶予 (#42)', () => {
    const DAY = 24 * 60 * 60 * 1000
    const ago = (days: number) => Timestamp.fromMillis(Date.now() - days * DAY)
    // ルールを通さずに書く (本番に既にある形のデータや、猶予が過ぎた状態を作る)
    const seed = (path: string, data: object) =>
      env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data))
    const legacyExpense = { title: '夕食', amount: 3000, payerId: 'm1', mode: 'equal', shares: { m1: 1 }, createdAt: ago(30) }

    it('支払いは「削除済み」に移すときサーバー時刻が要り、猶予 (7日) が過ぎるまで完全に削除できない', async () => {
      const e = doc(trip(), 'expenses', 'e1')
      await assertSucceeds(setDoc(e, expense({})))
      await assertFails(deleteDoc(e))
      await assertFails(updateDoc(e, { deletedAt: Date.now() }))
      await assertFails(updateDoc(e, { deletedAt: Date.now(), trashedAt: ago(8) }))
      await assertSucceeds(updateDoc(e, { deletedAt: Date.now(), trashedAt: serverTimestamp() }))
      await assertFails(deleteDoc(e))
      // trashedAt だけ消して古い削除済みに見せかけることも、時刻を古くすることもできない
      await assertFails(updateDoc(e, { trashedAt: deleteField() }))
      await assertFails(updateDoc(e, { deletedAt: 1 }))
      // 元に戻すのは誰でもすぐできる
      await assertSucceeds(updateDoc(e, { deletedAt: deleteField(), trashedAt: deleteField() }))
      await assertFails(updateDoc(e, { trashedAt: serverTimestamp() }))
    })

    it('猶予が過ぎた削除済みは写真ごと完全に削除できる', async () => {
      await seed('trips/t1/expenses/e1', { ...legacyExpense, hasReceipt: true, deletedAt: Date.now() - 8 * DAY, trashedAt: ago(8) })
      await seed('trips/t1/receipts/e1', { data: 'a', createdAt: ago(30) })
      const b = writeBatch(db)
      b.delete(doc(trip(), 'expenses', 'e1'))
      b.delete(doc(trip(), 'receipts', 'e1'))
      await assertSucceeds(b.commit())
    })

    it('既存データ: このルールより前に削除済みにした支払い (trashedAt 無し) は読めて、戻せて、完全に削除できる', async () => {
      await seed('trips/t1/expenses/old1', { ...legacyExpense, deletedAt: Date.now() - DAY })
      await seed('trips/t1/expenses/old2', { ...legacyExpense, deletedAt: Date.now() - DAY })
      await assertSucceeds(getDoc(doc(trip(), 'expenses', 'old1')))
      await assertSucceeds(updateDoc(doc(trip(), 'expenses', 'old1'), { deletedAt: deleteField() }))
      await assertSucceeds(deleteDoc(doc(trip(), 'expenses', 'old2')))
    })

    it('既存データ: 古い形の支払い (date・hasReceipt・settledIds 無し) を編集・削除済みにできる', async () => {
      await seed('trips/t1/expenses/old', legacyExpense)
      const e = doc(trip(), 'expenses', 'old')
      await assertSucceeds(updateDoc(e, { amount: 4000, date: '2026-09-30', settledIds: ['m2'] }))
      await assertSucceeds(updateDoc(e, { deletedAt: Date.now(), trashedAt: serverTimestamp() }))
    })

    it('メンバー・イベントは削除できず、removedAt (サーバー時刻) を付ける。既存の形のまま名前変更・アーカイブもできる', async () => {
      await seed('trips/t1/members/m1', { name: 'たろう', createdAt: ago(30) })
      await seed('trips/t1/categories/c1', { name: '旅行', createdAt: ago(30) })
      const m = doc(trip(), 'members', 'm1')
      const c = doc(trip(), 'categories', 'c1')
      await assertFails(deleteDoc(m))
      await assertFails(deleteDoc(c))
      await assertSucceeds(updateDoc(m, { name: 'じろう' }))
      await assertSucceeds(updateDoc(c, { name: '鍋パ', archived: true }))
      await assertFails(updateDoc(m, { removedAt: ago(1) }))
      await assertFails(updateDoc(c, { removedAt: 1 }))
      await assertSucceeds(updateDoc(m, { removedAt: serverTimestamp() }))
      await assertSucceeds(updateDoc(c, { removedAt: serverTimestamp() }))
      await assertSucceeds(updateDoc(c, { removedAt: deleteField() }))
    })

    it('グループは削除予約でき、誰でも取り消せる。猶予が過ぎるまで中身もグループも消せない', async () => {
      await seed('trips/t1/members/m1', { name: 'たろう', createdAt: ago(30) })
      await assertFails(updateDoc(trip(), { deleteRequestedAt: ago(8) }))
      await assertSucceeds(updateDoc(trip(), { deleteRequestedAt: serverTimestamp() }))
      await assertFails(deleteDoc(doc(trip(), 'members', 'm1')))
      await assertFails(deleteDoc(trip()))
      await assertSucceeds(updateDoc(trip(), { name: '予約中も編集できる' }))
      await assertSucceeds(updateDoc(trip(), { deleteRequestedAt: deleteField() }))
    })

    it('予約から猶予が過ぎたグループは、中身 (大人数・多数の支払い) をまとめて消してからグループを消せる', async () => {
      await seed('trips/t2', { name: '消すグループ', createdAt: ago(30), deleteRequestedAt: ago(8) })
      const paths: string[] = []
      for (let i = 0; i < 40; i++) paths.push(`trips/t2/members/m${i}`, `trips/t2/expenses/e${i}`)
      for (let i = 0; i < 10; i++) paths.push(`trips/t2/categories/c${i}`, `trips/t2/receipts/e${i}`)
      for (const p of paths) {
        if (p.includes('/expenses/')) await seed(p, legacyExpense)
        else if (p.includes('/receipts/')) await seed(p, { data: 'a', createdAt: ago(30) })
        else await seed(p, { name: 'x', createdAt: ago(30) })
      }
      const b = writeBatch(db)
      for (const p of paths) b.delete(doc(db, p))
      await assertSucceeds(b.commit())
      await assertSucceeds(deleteDoc(doc(db, 'trips', 't2')))
      // ほかのグループ (予約なし) には影響しない
      await assertSucceeds(getDoc(trip()))
    })
  })
})
