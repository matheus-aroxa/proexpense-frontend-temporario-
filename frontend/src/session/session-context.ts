import { createContext, useContext } from 'react'
import type { Account, User } from '../api/types'

export interface SessionState {
  user: User | null
  account: Account | null
  signIn: (user: User) => void
  signOut: () => void
  selectAccount: (account: Account | null) => void
}

export const SessionContext = createContext<SessionState | null>(null)

export function useSession(): SessionState {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession deve ser usado dentro de <SessionProvider>')
  return context
}
