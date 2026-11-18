import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../api/http'
import { accountsApi } from '../api/services'
import type { Account } from '../api/types'
import { Alert, Button, EmptyState, Field, LoadingState, Panel, TextInput } from '../components/ui'
import { ChevronRightIcon, LogoutIcon, WalletIcon } from '../components/icons'
import { useToast } from '../components/toast-context'
import { splitApiError } from '../lib/forms'
import { useSession } from '../session/session-context'
import { Brand } from './Brand'

export function AccountSelectPage() {
  const { user, selectAccount, signOut } = useSession()
  const toast = useToast()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const userId = user!.id

  useEffect(() => {
    accountsApi
      .listByUser(userId)
      .then(setAccounts)
      .catch((err) => setLoadError(errorMessage(err)))
  }, [userId])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setNameError('Informe um nome para a conta')
      return
    }
    setSaving(true)
    try {
      const account = await accountsApi.create({ name: name.trim(), ownerId: userId })
      toast.show(`Conta ${account.name} criada`)
      selectAccount(account)
    } catch (err) {
      const { fields, message } = splitApiError(err)
      setNameError(fields.name ?? message ?? undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <Brand large />
        <p className="text-sm text-ink-3">
          Olá, <span className="font-medium text-ink">{user!.name}</span>. Escolha uma conta para continuar.
        </p>
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-sm font-medium text-ink-2">Suas contas</div>
        {loadError ? (
          <div className="p-4">
            <Alert>{loadError}</Alert>
          </div>
        ) : accounts === null ? (
          <LoadingState />
        ) : accounts.length === 0 ? (
          <EmptyState icon={<WalletIcon />} title="Nenhuma conta" description="Crie uma conta para organizar as despesas da casa, do casal ou da empresa." />
        ) : (
          <ul className="divide-y divide-line">
            {accounts.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  onClick={() => selectAccount(account)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                >
                  <span className="flex flex-col">
                    <span className="font-medium text-ink">{account.name}</span>
                    <span className="text-xs text-ink-3">{account.ownerId === userId ? 'Você é o dono' : 'Membro'}</span>
                  </span>
                  <ChevronRightIcon className="text-ink-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="p-4">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <Field label="Nova conta" error={nameError}>
            {(id, invalid) => (
              <TextInput
                id={id}
                invalid={invalid}
                placeholder="Ex.: Casa, Viagem 2027"
                value={name}
                maxLength={255}
                onChange={(event) => {
                  setName(event.target.value)
                  setNameError(undefined)
                }}
              />
            )}
          </Field>
          <Button type="submit" loading={saving}>
            Criar conta
          </Button>
        </form>
      </Panel>

      <Button variant="ghost" icon={<LogoutIcon />} onClick={signOut} className="self-center">
        Trocar de usuário
      </Button>
    </div>
  )
}
