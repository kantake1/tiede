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
  addExpense(tripId: string, expense: ExpenseInput): Promise<void>
  updateExpense(tripId: string, expenseId: string, expense: ExpenseInput): Promise<void>
  deleteExpense(tripId: string, expenseId: string): Promise<void>
  /** 削除の取り消し。同じ ID・作成日時で作り直す */
  restoreExpense(tripId: string, expense: Expense): Promise<void>
}
