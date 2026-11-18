import { http } from './http'
import type {
  Account,
  AccountAccess,
  AccountMember,
  Card,
  Category,
  Expense,
  RegisterAccountRequest,
  RegisterCardRequest,
  RegisterCategoryRequest,
  RegisterExpenseRequest,
  RegisterUserRequest,
  UpdateCardRequest,
  UpdateCategoryRequest,
  UpdateExpenseRequest,
  User,
} from './types'

export const usersApi = {
  list: () => http.get<User[]>('/users'),
  get: (id: string) => http.get<User>(`/users/${id}`),
  create: (body: RegisterUserRequest) => http.post<User>('/users', body),
}

export const accountsApi = {
  listByUser: (userId: string) => http.get<Account[]>(`/accounts/users/${userId}`),
  create: (body: RegisterAccountRequest) => http.post<Account>('/accounts', body),
  addUser: (accountId: string, userId: string) =>
    http.post<Account>('/accounts/users', { accountId, userId }),
  activeMembers: (accountId: string) =>
    http.get<AccountMember[]>(`/accounts/${accountId}/users/active`),
  activateMember: (accountId: string, userId: string) =>
    http.patch<Account>(`/accounts/${accountId}/users/${userId}/activate`),
  deactivateMember: (accountId: string, userId: string) =>
    http.patch<Account>(`/accounts/${accountId}/users/${userId}/deactivate`),
  access: (accountId: string, userId: string) =>
    http.get<AccountAccess>(
      `/accounts/access?${new URLSearchParams({ accountId, userId }).toString()}`,
    ),
}

export const cardsApi = {
  listByAccount: (accountId: string) => http.get<Card[]>(`/cards/accounts/${accountId}`),
  listActiveByAccount: (accountId: string) =>
    http.get<Card[]>(`/cards/accounts/${accountId}/active`),
  get: (id: string) => http.get<Card>(`/cards/${id}`),
  create: (body: RegisterCardRequest) => http.post<Card>('/cards', body),
  update: (id: string, body: UpdateCardRequest) => http.put<Card>(`/cards/${id}`, body),
}

export const categoriesApi = {
  listByAccount: (accountId: string) =>
    http.get<Category[]>(`/categories/accounts/${accountId}`),
  listActiveByAccount: (accountId: string) =>
    http.get<Category[]>(`/categories/accounts/${accountId}/active`),
  get: (id: string) => http.get<Category>(`/categories/${id}`),
  create: (body: RegisterCategoryRequest) => http.post<Category>('/categories', body),
  update: (id: string, body: UpdateCategoryRequest) =>
    http.put<Category>(`/categories/${id}`, body),
}

export const expensesApi = {
  /** O backend só expõe a listagem global; o filtro por conta é feito no cliente. */
  list: () => http.get<Expense[]>('/expenses'),
  get: (id: string) => http.get<Expense>(`/expenses/${id}`),
  create: (body: RegisterExpenseRequest) => http.post<Expense>('/expenses', body),
  update: (id: string, body: UpdateExpenseRequest) =>
    http.put<Expense>(`/expenses/${id}`, body),
  remove: (id: string) => http.delete(`/expenses/${id}`),
}
