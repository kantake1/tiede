import type { ExpenseInput, TripData } from '../types'

export interface TripStore {
  readonly kind: 'firestore' | 'local'
  createTrip(name: string, memberNames: string[]): Promise<string>
  subscribe(tripId: string, onData: (data: TripData | null) => void, onError: (e: Error) => void): () => void
  renameTrip(tripId: string, name: string): Promise<void>
  addMember(tripId: string, name: string): Promise<void>
  renameMember(tripId: string, memberId: string, name: string): Promise<void>
  removeMember(tripId: string, memberId: string): Promise<void>
  addExpense(tripId: string, expense: ExpenseInput): Promise<void>
  updateExpense(tripId: string, expenseId: string, expense: ExpenseInput): Promise<void>
  deleteExpense(tripId: string, expenseId: string): Promise<void>
}
