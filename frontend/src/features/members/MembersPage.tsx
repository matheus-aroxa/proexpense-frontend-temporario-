import { useMemo, useState, type FormEvent } from 'react'
import { ApiError, errorMessage } from '../../api/http'
import { accountsApi } from '../../api/services'
import type { AccountMember } from '../../api/types'
import { UsersIcon } from '../../components/icons'
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Field, PageHeader, Panel, Select } from '../../components/ui'
import { useToast } from '../../components/toast-context'
import { currentYearMonth, sameYearMonth } from '../../lib/dates'
import { formatCurrency, initials } from '../../lib/format'
import { sumAmounts } from '../../lib/installments'
import { useWorkspace } from '../../session/workspace-context'

export function MembersPage() {
  const { account, me, members, users, expenses, reload } = useWorkspace()
  const toast = useToast()
  const [selected, setSelected] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<AccountMember | undefined>()
  const [removingBusy, setRemovingBusy] = useState(false)
  const month = currentYearMonth()

  const candidates = users
    .filter((user) => !members.some((member) => member.userId === user.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  const spentByMember = useMemo(() => {
    const ofMonth = expenses.filter((expense) => sameYearMonth(expense.expenseDate, month))
    return new Map(members.map((member) => [member.userId, sumAmounts(ofMonth.filter((expense) => expense.ownerId === member.userId))]))
  }, [members, expenses, month])

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setAdding(true)
    setAddError(null)
    try {
      try {
        await accountsApi.addUser(account.id, selected)
      } catch (err) {
        // 409: já foi membro e está desativado — basta reativar.
        if (err instanceof ApiError && err.status === 409) await accountsApi.activateMember(account.id, selected)
        else throw err
      }
      await reload('members')
      toast.show('Membro adicionado à conta')
      setSelected('')
    } catch (err) {
      setAddError(errorMessage(err))
    } finally {
      setAdding(false)
    }
  }

  async function confirmRemove() {
    if (!removing) return
    setRemovingBusy(true)
    try {
      await accountsApi.deactivateMember(account.id, removing.userId)
      await reload('members')
      toast.show(`${removing.name} foi removido da conta`)
      setRemoving(undefined)
    } catch (err) {
      toast.show(errorMessage(err), 'error')
    } finally {
      setRemovingBusy(false)
    }
  }

  const sorted = [...members].sort(
    (a, b) => Number(b.userId === account.ownerId) - Number(a.userId === account.ownerId) || a.name.localeCompare(b.name),
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Membros" description="Pessoas com acesso a esta conta. Membros podem registrar despesas e cartões." />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Panel className="overflow-hidden">
          {sorted.length === 0 ? (
            <EmptyState icon={<UsersIcon />} title="Nenhum membro ativo" />
          ) : (
            <ul className="divide-y divide-line">
              {sorted.map((member) => {
                const isOwner = member.userId === account.ownerId
                return (
                  <li key={member.userId} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                      {initials(member.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{member.name}</span>
                        {isOwner && <Badge tone="brand">Dono</Badge>}
                        {member.userId === me.id && <Badge>Você</Badge>}
                      </div>
                      <p className="text-xs text-ink-3">Gastou {formatCurrency(spentByMember.get(member.userId) ?? 0)} neste mês</p>
                    </div>
                    {!isOwner && (
                      <Button variant="ghost" size="sm" onClick={() => setRemoving(member)}>
                        Remover
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel className="h-fit p-4">
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink">Adicionar membro</h2>
            {addError && <Alert>{addError}</Alert>}
            <Field
              label="Usuário"
              hint={candidates.length === 0 ? 'Todos os usuários já fazem parte da conta.' : 'Novos usuários são criados na tela inicial.'}
            >
              {(id) => (
                <Select id={id} value={selected} onChange={(event) => setSelected(event.target.value)} disabled={candidates.length === 0}>
                  <option value="">Selecione…</option>
                  {candidates.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button type="submit" loading={adding} disabled={!selected}>
              Adicionar
            </Button>
          </form>
        </Panel>
      </div>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remover membro"
        confirmLabel="Remover"
        loading={removingBusy}
        onClose={() => setRemoving(undefined)}
        onConfirm={confirmRemove}
        message={
          removing && (
            <>
              <strong className="text-ink">{removing.name}</strong> perderá o acesso à conta. As despesas já registradas são mantidas e o
              acesso pode ser restaurado adicionando o usuário novamente.
            </>
          )
        }
      />
    </div>
  )
}
