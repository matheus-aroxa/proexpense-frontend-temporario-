import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../api/http'
import { usersApi } from '../api/services'
import type { User } from '../api/types'
import { Alert, Button, Field, LoadingState, Panel, TextInput } from '../components/ui'
import { useToast } from '../components/toast-context'
import { initials } from '../lib/format'
import { splitApiError } from '../lib/forms'
import { useSession } from '../session/session-context'
import { Brand } from './Brand'

export function UserSelectPage() {
  const { signIn } = useSession()
  const toast = useToast()
  const [users, setUsers] = useState<User[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    usersApi
      .list()
      .then((list) => setUsers([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setLoadError(errorMessage(err)))
  }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setNameError('Informe um nome')
      return
    }
    setSaving(true)
    try {
      const user = await usersApi.create({ name: name.trim() })
      toast.show(`Usuário ${user.name} criado`)
      signIn(user)
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
        <p className="text-sm text-ink-3">Escolha quem está usando o ProExpense.</p>
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-sm font-medium text-ink-2">Usuários</div>
        {loadError ? (
          <div className="p-4">
            <Alert>{loadError}</Alert>
          </div>
        ) : users === null ? (
          <LoadingState />
        ) : users.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-3">Nenhum usuário cadastrado ainda. Crie o primeiro abaixo.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => signIn(user)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                    {initials(user.name)}
                  </span>
                  <span className="font-medium text-ink">{user.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="p-4">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <Field label="Novo usuário" error={nameError}>
            {(id, invalid) => (
              <TextInput
                id={id}
                invalid={invalid}
                placeholder="Seu nome"
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
            Criar e entrar
          </Button>
        </form>
      </Panel>
    </div>
  )
}
