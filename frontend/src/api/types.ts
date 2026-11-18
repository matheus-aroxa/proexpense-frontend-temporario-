export type PaymentMethod = 'DEBIT' | 'CREDIT'
export type CardPaymentMethod = 'CREDIT' | 'DEBIT' | 'BOTH'
export type RecurrenceUnit = 'DAYS' | 'MONTHS' | 'YEARS'

/** LocalDate serializado pelo backend: "YYYY-MM-DD". */
export type IsoDate = string

export interface User {
  id: string
  name: string
}

export interface Account {
  id: string
  name: string
  ownerId: string
}

export interface AccountMember {
  userId: string
  name: string
  isActive: boolean
}

export interface AccountAccess {
  userId: string
  accountId: string
  hasAccess: boolean
}

export interface Card {
  id: string
  ownerId: string
  accountId: string
  name: string
  paymentMethod: CardPaymentMethod
  limit: number | null
  isActive: boolean
}

export interface Category {
  id: string
  accountId: string
  name: string
  isActive: boolean
}

export interface Expense {
  id: string
  ownerId: string
  accountId: string
  categoryId: string | null
  cardId: string
  name: string
  description: string | null
  amount: number
  paymentMethod: PaymentMethod
  expenseDate: IsoDate
  isInInstallments: boolean
  installmentsNumber: number
  currentInstallment: number
}

export interface RegisterUserRequest {
  name: string
}

export interface RegisterAccountRequest {
  name: string
  ownerId: string
}

export interface RegisterCardRequest {
  name: string
  paymentMethod: CardPaymentMethod
  limit: number | null
  ownerId: string
  accountId: string
}

export interface UpdateCardRequest {
  name: string
  paymentMethod: CardPaymentMethod
  limit: number | null
  isActive: boolean
}

export interface RegisterCategoryRequest {
  name: string
  accountId: string
}

export interface UpdateCategoryRequest {
  name: string
  isActive: boolean
}

export interface RegisterExpenseRequest {
  name: string
  description: string | null
  amount: number
  paymentMethod: PaymentMethod
  expenseDate: IsoDate
  ownerId: string
  accountId: string
  categoryId: string | null
  cardId: string
  isInInstallments: boolean
  installmentsNumber: number
  recurrenceUnit?: RecurrenceUnit
  recurrenceInterval?: number
  recurrenceDayOfMonth?: number
}

export interface UpdateExpenseRequest {
  name: string
  description: string | null
  amount: number
  paymentMethod: PaymentMethod
  expenseDate: IsoDate
  categoryId: string | null
  cardId: string
}
