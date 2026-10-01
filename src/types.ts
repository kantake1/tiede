export type Member = {
  id: string
  name: string
  createdAt: number
}

/**
 * equal: 対象者で均等割り (shares の値は 1)
 * ratio: 比率で按分 (shares の値は重み)
 * amount: 各自の負担額を直接指定 (shares の値は円)
 * items: 品目ごとに対象者を指定 (items を使い shares は空)
 */
export type SplitMode = 'equal' | 'ratio' | 'amount' | 'items'

export type Item = {
  name: string
  price: number
  memberIds: string[]
}

export type Expense = {
  id: string
  title: string
  amount: number
  payerId: string
  mode: SplitMode
  shares: Record<string, number>
  items?: Item[]
  categoryId?: string
  memo?: string
  /** 支払った日 (YYYY-MM-DD, 端末のローカル日付)。古いデータには無い */
  date?: string
  /** レシート写真を保存している (写真本体は receipts に別保存) */
  hasReceipt?: boolean
  /** その場で負担分を受け取った人。精算から外す */
  settledIds?: string[]
  /** 削除した日時。「削除済み」に残り、合計・精算には含めない */
  deletedAt?: number
  /** 「削除済み」に移したサーバー時刻。ここから猶予が過ぎるまで完全に削除できない (#42)。以前に削除したものには無い */
  trashedAt?: number
  createdAt: number
}

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt'>

export type Trip = {
  id: string
  name: string
  createdAt: number
  /** 削除予約の時刻。猶予が過ぎると Cloud Functions が中身ごと消す (#6) */
  deleteRequestedAt?: number
}

export type Category = {
  id: string
  name: string
  /** 精算済み。サイドバーの「アーカイブ」に移る */
  archived: boolean
  createdAt: number
}

export type TripData = {
  trip: Trip
  members: Member[]
  categories: Category[]
  /** 削除済みを除く支払い */
  expenses: Expense[]
  /** 削除済みの支払い (新しく削除した順) */
  deleted: Expense[]
  /** サーバーへ未送信の変更がある (オフライン時など) */
  pending?: boolean
}
