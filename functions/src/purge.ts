import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// 削除予約からの猶予。firestore.rules・src/lib/grace.ts と合わせる
const GRACE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 削除予約 (deleteRequestedAt) から猶予が過ぎたグループを、中身 (members・categories・expenses・receipts) ごと削除する (#6)。
 * Admin SDK はルールを通らないため、ここで条件を厳密に確かめる: deleteRequestedAt がサーバー時刻 (Timestamp) で、猶予を過ぎたものだけ。
 * 予約の無いグループ・取り消されたグループには触れない。削除したグループの ID を返す
 */
export async function purgeExpiredTrips(now = Date.now()): Promise<string[]> {
  if (!getApps().length) initializeApp()
  const db = getFirestore()
  const cutoff = now - GRACE_MS
  // Timestamp との比較は Timestamp の値だけに当たる (数値・文字列などは対象外)
  const expired = await db.collection('trips').where('deleteRequestedAt', '<=', Timestamp.fromMillis(cutoff)).get()
  const done: string[] = []
  for (const snap of expired.docs) {
    // 一覧を取ってから消すまでの間に取り消されていないか、消す直前に読み直す
    const fresh = await snap.ref.get()
    const at = fresh.get('deleteRequestedAt')
    if (!(at instanceof Timestamp) || at.toMillis() > cutoff) continue
    await db.recursiveDelete(snap.ref)
    done.push(snap.id)
  }
  return done
}
