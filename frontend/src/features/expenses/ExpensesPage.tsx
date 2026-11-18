import { useMemo, useState } from 'react'
import { expensesApi } from '../../api/services'
import type { Expense } from '../../api/types'
import { ChevronLeftIcon, ChevronRightIcon, EditIcon, PlusIcon, ReceiptIcon, SearchIcon, TrashIcon } from '../../components/icons'
import { Badge, Button, ConfirmDialog, EmptyState, IconButton, PageHeader, Panel, Select, StatTile, TextInput } from '../../components/ui'
import { useToast } from '../../components/toast-context'
import { errorMessage } from '../../api/http'
import { currentYearMonth, sameYearMonth, shiftYearMonth, todayIso, type YearMonth } from '../../lib/dates'
import { formatCurrency, formatDate, formatMonth, paymentMethodLabel } from '../../lib/format'
import { sumAmounts } from '../../lib/installments'
import { useWorkspace } from '../../session/workspace-context'
import { ExpenseForm } from './ExpenseForm'

export function ExpensesPage() {
  const { expenses, cards, categories, cardById, categoryById, userName, reload } = useWorkspace()
  const toast = useToast()

  const [month, setMonth] = useState<YearMonth | null>(currentYearMonth())
  const [cardFilter, setCardFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | undefined>()
  const [deleting, setDeleting] = useState<Expense | undefined>()
  const [deletingBusy, setDeletingBusy] = useState(false)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return expenses
      .filter((expense) => (month ? sameYearMonth(expense.expenseDate, month) : true))
      .filter((expense) => !cardFilter || expense.cardId === cardFilter)
      .filter((expense) =>
        categoryFilter === '__none' ? !expense.categoryId : !categoryFilter || expense.categoryId === categoryFilter,
      )
      .filter(
        (expense) =>
          !term ||
          expense.name.toLowerCase().includes(term) ||
          (expense.description ?? '').toLowerCase().includes(term),
      )
      .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || a.name.localeCompare(b.name))
  }, [expenses, month, cardFilter, categoryFilter, query])

  const totals = useMemo(() => {
    const credit = filtered.filter((expense) => expense.paymentMethod === 'CREDIT')
    const debit = filtered.filter((expense) => expense.paymentMethod === 'DEBIT')
    const parcels = filtered.filter((expense) => expense.isInInstallments)
    return {
      all: sumAmounts(filtered),
      credit: sumAmounts(credit),
      debit: sumAmounts(debit),
      parcels: sumAmounts(parcels),
      parcelsCount: parcels.length,
    }
  }, [filtered])

  function openCreate() {
    setEditing(undefined)
    setFormOpen(true)
  }

  function openEdit(expense: Expense) {
    setEditing(expense)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await expensesApi.remove(deleting.id)
      await reload('expenses')
      toast.show('Despesa excluída')
      setDeleting(undefined)
    } catch (err) {
      toast.show(errorMessage(err), 'error')
    } finally {
      setDeletingBusy(false)
    }
  }

  const today = todayIso()

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Despesas"
        description="Lançamentos da conta, incluindo cada parcela de compras parceladas."
        actions={
          <Button icon={<PlusIcon />} onClick={openCreate}>
            Nova despesa
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-line bg-surface">
          <IconButton label="Mês anterior" onClick={() => setMonth((current) => shiftYearMonth(current ?? currentYearMonth(), -1))}>
            <ChevronLeftIcon />
          </IconButton>
          <button
            type="button"
            className="min-w-40 px-2 text-sm font-medium text-ink"
            onClick={() => setMonth(currentYearMonth())}
            title="Voltar para o mês atual"
          >
            {month ? formatMonth(month.year, month.month) : 'Todos os meses'}
          </button>
          <IconButton label="Próximo mês" onClick={() => setMonth((current) => shiftYearMonth(current ?? currentYearMonth(), 1))}>
            <ChevronRightIcon />
          </IconButton>
        </div>
        <Button variant={month ? 'ghost' : 'secondary'} size="sm" onClick={() => setMonth(month ? null : currentYearMonth())}>
          {month ? 'Ver todos' : 'Por mês'}
        </Button>
        <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <TextInput aria-label="Buscar" placeholder="Buscar" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <Select aria-label="Filtrar por cartão" className="w-auto flex-1 sm:w-40 sm:flex-none" value={cardFilter} onChange={(event) => setCardFilter(event.target.value)}>
            <option value="">Todos os cartões</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Filtrar por categoria" className="w-auto flex-1 sm:w-44 sm:flex-none" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Todas as categorias</option>
            <option value="__none">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total" value={formatCurrency(totals.all)} detail={`${filtered.length} lançamento${filtered.length === 1 ? '' : 's'}`} />
        <StatTile label="Crédito" value={formatCurrency(totals.credit)} />
        <StatTile label="Débito" value={formatCurrency(totals.debit)} />
        <StatTile label="Em parcelas" value={formatCurrency(totals.parcels)} detail={`${totals.parcelsCount} parcela${totals.parcelsCount === 1 ? '' : 's'}`} />
      </div>

      <Panel className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ReceiptIcon />}
            title={expenses.length === 0 ? 'Nenhuma despesa registrada' : 'Nada encontrado'}
            description={
              expenses.length === 0
                ? 'Registre a primeira despesa da conta. Compras no crédito podem ser parceladas.'
                : 'Ajuste o mês ou os filtros para ver outros lançamentos.'
            }
            action={
              expenses.length === 0 && (
                <Button icon={<PlusIcon />} onClick={openCreate}>
                  Nova despesa
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs tracking-wide text-ink-3 uppercase">
                  <th className="px-4 py-2.5 font-medium">Data</th>
                  <th className="px-4 py-2.5 font-medium">Despesa</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Categoria</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Cartão</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                  <th className="w-20 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((expense) => {
                  const category = expense.categoryId ? categoryById.get(expense.categoryId) : undefined
                  const card = cardById.get(expense.cardId)
                  const future = expense.expenseDate > today
                  return (
                    <tr key={expense.id} className="group hover:bg-surface-2/60">
                      <td className="px-4 py-3 whitespace-nowrap text-ink-2">
                        {formatDate(expense.expenseDate)}
                        {future && (
                          <Badge tone="warn" className="ml-2">
                            futura
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">{expense.name}</span>
                          {expense.isInInstallments && (
                            <Badge tone="info">
                              {expense.currentInstallment}/{expense.installmentsNumber}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-3">
                          {userName(expense.ownerId)}
                          {expense.description ? ` · ${expense.description}` : ''}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {category ? <Badge>{category.name}</Badge> : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="hidden px-4 py-3 whitespace-nowrap text-ink-2 sm:table-cell">
                        {card?.name ?? '—'}
                        <span className="ml-1.5 text-xs text-ink-3">{paymentMethodLabel[expense.paymentMethod]}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-ink">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-0.5 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                          <IconButton label="Editar" onClick={() => openEdit(expense)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton label="Excluir" tone="danger" onClick={() => setDeleting(expense)}>
                            <TrashIcon />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ExpenseForm open={formOpen} expense={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir despesa"
        confirmLabel="Excluir"
        loading={deletingBusy}
        onClose={() => setDeleting(undefined)}
        onConfirm={confirmDelete}
        message={
          deleting && (
            <>
              Excluir <strong className="text-ink">{deleting.name}</strong> ({formatCurrency(deleting.amount)})?
              {deleting.isInInstallments && (
                <span className="mt-2 block">
                  Apenas a parcela {deleting.currentInstallment}/{deleting.installmentsNumber} será excluída. Para remover a
                  compra inteira, use a aba Parcelamentos.
                </span>
              )}
            </>
          )
        }
      />
    </div>
  )
}
