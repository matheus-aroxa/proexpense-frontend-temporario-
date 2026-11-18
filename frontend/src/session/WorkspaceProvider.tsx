import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { errorMessage } from '../api/http'
import { accountsApi, cardsApi, categoriesApi, expensesApi, usersApi } from '../api/services'
import type { Account, AccountMember, Card, Category, Expense, User } from '../api/types'
import { WorkspaceContext, type WorkspaceResource } from './workspace-context'

const ALL: WorkspaceResource[] = ['users', 'members', 'cards', 'categories', 'expenses']

export function WorkspaceProvider({ account, me, children }: { account: Account; me: User; children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([])
  const [members, setMembers] = useState<AccountMember[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const accountId = account.id

  const reload = useCallback(
    async (...resources: WorkspaceResource[]) => {
      const targets = new Set(resources.length ? resources : ALL)
      const tasks: Promise<unknown>[] = []
      if (targets.has('users')) tasks.push(usersApi.list().then(setUsers))
      if (targets.has('members')) tasks.push(accountsApi.activeMembers(accountId).then(setMembers))
      if (targets.has('cards')) tasks.push(cardsApi.listByAccount(accountId).then(setCards))
      if (targets.has('categories')) tasks.push(categoriesApi.listByAccount(accountId).then(setCategories))
      if (targets.has('expenses'))
        tasks.push(
          expensesApi
            .list()
            .then((all) => setExpenses(all.filter((expense) => expense.accountId === accountId))),
        )
      try {
        await Promise.all(tasks)
        setError(null)
      } catch (err) {
        setError(errorMessage(err))
      }
    },
    [accountId],
  )

  useEffect(() => {
    // O provider é remontado a cada troca de conta (key em App), então `loading` já começa true.
    let cancelled = false
    reload().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [reload])

  const value = useMemo(() => {
    const cardById = new Map(cards.map((card) => [card.id, card]))
    const categoryById = new Map(categories.map((category) => [category.id, category]))
    const names = new Map<string, string>(users.map((user) => [user.id, user.name]))
    members.forEach((member) => names.set(member.userId, member.name))
    names.set(me.id, me.name)
    return {
      account,
      me,
      users,
      members,
      cards,
      categories,
      expenses,
      loading,
      error,
      reload,
      cardById,
      categoryById,
      userName: (id: string) => names.get(id) ?? 'Usuário desconhecido',
    }
  }, [account, me, users, members, cards, categories, expenses, loading, error, reload])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
