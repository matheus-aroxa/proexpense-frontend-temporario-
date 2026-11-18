import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Account, User } from '../api/types'
import { SessionContext } from './session-context'
import { readStored, writeStored } from './storage'

const USER_KEY = 'proexpense.user'
const ACCOUNT_KEY = 'proexpense.account'

function readJson<T>(key: string): T | null {
  const raw = readStored(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * O backend ainda não tem autenticação: o "login" é apenas a escolha de um usuário
 * existente, guardada no navegador junto com a conta selecionada.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readJson<User>(USER_KEY))
  const [account, setAccount] = useState<Account | null>(() => readJson<Account>(ACCOUNT_KEY))

  const selectAccount = useCallback((next: Account | null) => {
    setAccount(next)
    writeStored(ACCOUNT_KEY, next ? JSON.stringify(next) : null)
  }, [])

  const signIn = useCallback(
    (next: User) => {
      setUser(next)
      writeStored(USER_KEY, JSON.stringify(next))
      selectAccount(null)
    },
    [selectAccount],
  )

  const signOut = useCallback(() => {
    setUser(null)
    writeStored(USER_KEY, null)
    selectAccount(null)
  }, [selectAccount])

  const value = useMemo(
    () => ({ user, account, signIn, signOut, selectAccount }),
    [user, account, signIn, signOut, selectAccount],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
