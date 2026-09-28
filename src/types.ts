export type Member = {
  id: string
  name: string
  createdAt: number
}

/**
 * equal: 対象者で均等割り (shares の値は 1)
 * ratio: 比率で按分 (shares の値は重み)
 * amount: 各自の負担額を直接指定 (shares の値は円)
 */
export type SplitMode = 'equal' | 'ratio' | 'amount'

export type Expense = {
  id: string
  title: string
  amount: number
  payerId: string
  mode: SplitMode
  shares: Record<string, number>
  createdAt: number
}

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt'>

export type Trip = {
  id: string
  name: string
  createdAt: number
}

export type TripData = {
  trip: Trip
  members: Member[]
  expenses: Expense[]
}
