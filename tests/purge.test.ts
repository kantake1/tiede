// functions/ の削除予約の自動削除 (#6) のテスト。`npm run test:rules` でエミュレータを起動して実行する
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('purgeExpiredTrips', () => {
  const DAY = 24 * 60 * 60 * 1000
  const ago = (days: number) => Timestamp.fromMillis(Date.now() - days * DAY)
  let env: RulesTestEnvironment
  let purge: (now?: number) => Promise<string[]>

  beforeAll(async () => {
    process.env.GCLOUD_PROJECT = 'demo-tiede'
    env = await initializeTestEnvironment({ projectId: 'demo-tiede' })
    ;({ purgeExpiredTrips: purge } = await import('../functions/src/purge'))
  })
  afterAll(() => env.cleanup())
  beforeEach(() => env.clearFirestore())

  // ルールを通さずに、グループと中身を作る
  async function seed(tripId: string, trip: object) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await setDoc(doc(db, 'trips', tripId), { name: tripId, createdAt: ago(30), ...trip })
      await setDoc(doc(db, 'trips', tripId, 'members', 'm1'), { name: 'たろう', createdAt: ago(30) })
      await setDoc(doc(db, 'trips', tripId, 'categories', 'c1'), { name: '旅行', createdAt: ago(30) })
      await setDoc(doc(db, 'trips', tripId, 'expenses', 'e1'), { title: '夕食', amount: 1000, createdAt: ago(30) })
      await setDoc(doc(db, 'trips', tripId, 'receipts', 'e1'), { data: 'a', createdAt: ago(30) })
    })
  }
  async function exists(path: string) {
    let found = false
    await env.withSecurityRulesDisabled(async (ctx) => {
      found = (await getDoc(doc(ctx.firestore() as unknown as Firestore, path))).exists()
    })
    return found
  }

  it('猶予 (7日) が過ぎた予約だけを中身ごと消し、ほかのグループには触れない', async () => {
    await seed('expired', { deleteRequestedAt: ago(8) })
    await seed('waiting', { deleteRequestedAt: ago(6) })
    await seed('none', {})
    // サーバー時刻でない値 (数値・文字列) は予約とみなさない
    await seed('number', { deleteRequestedAt: Date.now() - 30 * DAY })
    await seed('string', { deleteRequestedAt: '2020-01-01' })

    expect(await purge()).toEqual(['expired'])

    for (const p of ['', '/members/m1', '/categories/c1', '/expenses/e1', '/receipts/e1']) {
      expect(await exists(`trips/expired${p}`)).toBe(false)
      for (const kept of ['waiting', 'none', 'number', 'string']) expect(await exists(`trips/${kept}${p}`)).toBe(true)
    }
  })
})
