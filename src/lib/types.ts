export type AccountType = 'bank' | 'cash' | 'investment' | 'real_estate' | 'credit_card' | 'loan'

export interface Account {
  id: string
  name: string
  type: AccountType
  is_liability: boolean
  balance: number
  currency: string
  note: string | null
  created_at: string
}

export interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  parent_id: string | null
  color: string | null
  icon: string | null
}

export interface Transaction {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  date: string
  account_id: string
  to_account_id: string | null
  category_id: string | null
  description: string | null
  created_at: string
}

export interface Budget {
  id: string
  category_id: string
  amount: number
  period: 'weekly' | 'monthly' | 'yearly'
  start_date: string
}
