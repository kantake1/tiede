import type { Expense, ExpenseInput, TripData } from '../types'

export interface TripStore {
  readonly kind: 'firestore' | 'local'
  createTrip(name: string, memberNames: string[]): Promise<string>
  subscribe(tripId: string, onData: (data: TripData | null) => void, onError: (e: Error) => void): () => void
  renameTrip(tripId: string, name: string): Promise<void>
  addMember(tripId: string, name: string): Promise<void>
  renameMember(tripId: string, memberId: string, name: string): Promise<void>
  removeMember(tripId: string, memberId: string): Promise<void>
  addCategory(tripId: string, name: string): Promise<string>
  renameCategory(tripId: string, categoryId: string, name: string): Promise<void>
  removeCategory(tripId: string, categoryId: string): Promise<void>
  setCategoryArchived(tripId: string, categoryId: string, archived: boolean): Promise<void>
  /** receipt: レシート写真 (JPEG の base64)。支払いと同時に保存する */
  addExpense(tripId: string, expense: ExpenseInput, receipt?: string): Promise<void>
  /** receipt: undefined は写真を変えない、null は削除、文字列は置き換え */
  updateExpense(tripId: string, expenseId: string, expense: ExpenseInput, receipt?: string | null): Promise<void>
  /** 写真も一緒に削除する */
  deleteExpense(tripId: string, expenseId: string): Promise<void>
  /** レシート写真を取得する (無ければ null) */
  getReceipt(tripId: string, expenseId: string): Promise<string | null>
  /** 削除の取り消し。同じ ID・作成日時で作り直す */
  restoreExpense(tripId: string, expense: Expense, receipt?: string | null): Promise<void>
}
