import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { purgeExpiredTrips } from './purge.js'

// 1日1回 (日本時間 4:00)、削除予約から猶予が過ぎたグループを中身ごと削除する (#6)。Blaze プランが必要
export const purgeDeletedTrips = onSchedule(
  { schedule: 'every day 04:00', timeZone: 'Asia/Tokyo', region: 'asia-northeast1' },
  async () => {
    const ids = await purgeExpiredTrips()
    logger.info(`削除予約の期限が過ぎたグループを ${ids.length} 件削除しました`, { ids })
  },
)
