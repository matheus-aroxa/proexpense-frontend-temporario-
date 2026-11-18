import { createContext, useContext } from 'react'
import type { Account, AccountMember, Card, Category, Expense, User } from '../api/types'

export interface WorkspaceData {
  account: Account
  me: User
  users: User[]
  members: AccountMember[]
  cards: Card[]
  categories: Category[]
  expenses: Expense[]
  loading: boolean
  error: string | null
  reload: (...resources: WorkspaceResource[]) => Promise<void>
  cardById: Map<string, Card>
  categoryById: Map<string, Category>
  userName: (id: string) => string
}

export type WorkspaceResource = 'users' | 'members' | 'cards' | 'categories' | 'expenses'

export const WorkspaceContext = createContext<WorkspaceData | null>(null)

export function useWorkspace(): WorkspaceData {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace deve ser usado dentro de <WorkspaceProvider>')
  return context
}
