// 削除の猶予 (#42・#6)。firestore.rules・functions/ の猶予 (7日) と合わせる
export const GRACE_DAYS = 7
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000

/** 削除済みの支払いを完全に削除できるようになる時刻。以前に削除したもの (trashedAt 無し) はすぐ消せるので null */
export const purgeableAt = (e: { trashedAt?: number }) => (e.trashedAt === undefined ? null : e.trashedAt + GRACE_MS)

/** グループの削除予約が実行される (中身ごと消える) 時刻 */
export const tripDeletionAt = (deleteRequestedAt: number) => deleteRequestedAt + GRACE_MS
