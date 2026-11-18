import { useMemo, useState } from 'react'
import { errorMessage } from '../../api/http'
import { expensesApi } from '../../api/services'
import type { Expense } from '../../api/types'
import { ChevronDownIcon, EditIcon, LayersIcon, PlusIcon, TrashIcon } from '../../components/icons'
import { Badge, Button, ConfirmDialog, EmptyState, IconButton, PageHeader, Panel, ProgressBar, StatTile } from '../../components/ui'
import { useToast } from '../../components/toast-context'
import { todayIso } from '../../lib/dates'
import { formatCurrency, formatDate } from '../../lib/format'
import { groupInstallments, sumAmounts, type InstallmentGroup } from '../../lib/installments'
import { useWorkspace } from '../../session/workspace-context'
import { ExpenseForm } from '../expenses/ExpenseForm'

type Filter = 'active' | 'finished' | 'all'

export function InstallmentsPage() {
  const { expenses, reload } = useWorkspace()
  const toast = useToast()
  const today = todayIso()

  const [filter, setFilter] = useState<Filter>('active')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | undefined>()
  const [deleting, setDeleting] = useState<InstallmentGroup | undefined>()
  const [deletingBusy, setDeletingBusy] = useState(false)

  const groups = useMemo(() => groupInstallments(expenses, today), [expenses, today])
  const visible = groups.filter((group) =>
    filter === 'all' ? true : filter === 'active' ? Boolean(group.next) : !group.next,
  )

  const summary = useMemo(() => {
    const active = groups.filter((group) => group.next)
    const remaining = active.flatMap((group) => group.parcels.filter((parcel) => parcel.expenseDate > today))
    const nextMonthKey = (() => {
      const date = new Date()
      date.setMonth(date.getMonth() + 1, 1)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    })()
    const nextMonth = remaining.filter((parcel) => parcel.expenseDate.startsWith(nextMonthKey))
    return {
      activeCount: active.length,
      remaining: sumAmounts(remaining),
      remainingCount: remaining.length,
      nextMonth: sumAmounts(nextMonth),
    }
  }, [groups, today])

  function openCreate() {
    setEditing(undefined)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeletingBusy(true)
    let removed = 0
    try {
      for (const parcel of deleting.parcels) {
        await expensesApi.remove(parcel.id)
        removed++
      }
      toast.show(`Compra parcelada excluída (${removed} parcelas)`)
      setDeleting(undefined)
    } catch (err) {
      toast.show(`${errorMessage(err)} — ${removed} de ${deleting.parcels.length} parcelas excluídas`, 'error')
    } finally {
      await reload('expenses')
      setDeletingBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Parcelamentos"
        description="Compras no crédito divididas em parcelas, agrupadas a partir dos lançamentos."
        actions={
          <Button icon={<PlusIcon />} onClick={openCreate}>
            Nova compra parcelada
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Parcelamentos em aberto" value={summary.activeCount} />
        <StatTile
          label="Saldo a vencer"
          value={formatCurrency(summary.remaining)}
          detail={`${summary.remainingCount} parcela${summary.remainingCount === 1 ? '' : 's'} futuras`}
        />
        <StatTile label="Parcelas no próximo mês" value={formatCurrency(summary.nextMonth)} />
      </div>

      <div className="flex gap-1 self-start rounded-lg border border-line bg-surface p-1" role="tablist">
        {(
          [
            ['active', 'Em aberto'],
            ['finished', 'Quitados'],
            ['all', 'Todos'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              filter === value ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<LayersIcon />}
            title={groups.length === 0 ? 'Nenhuma compra parcelada' : 'Nada por aqui'}
            description={
              groups.length === 0
                ? 'Ao registrar uma despesa no crédito, ative “Compra parcelada” para dividir o valor em parcelas.'
                : filter === 'active'
                  ? 'Todos os parcelamentos já foram quitados.'
                  : 'Nenhum parcelamento quitado ainda.'
            }
            action={
              groups.length === 0 && (
                <Button icon={<PlusIcon />} onClick={openCreate}>
                  Nova compra parcelada
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              today={today}
              expanded={expanded === group.key}
              onToggle={() => setExpanded((current) => (current === group.key ? null : group.key))}
              onEditParcel={(parcel) => {
                setEditing(parcel)
                setFormOpen(true)
              }}
              onDelete={() => setDeleting(group)}
            />
          ))}
        </div>
      )}

      <ExpenseForm open={formOpen} expense={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir compra parcelada"
        confirmLabel={deleting ? `Excluir ${deleting.parcels.length} parcelas` : 'Excluir'}
        loading={deletingBusy}
        onClose={() => setDeleting(undefined)}
        onConfirm={confirmDelete}
        message={
          deleting && (
            <>
              Todas as {deleting.parcels.length} parcelas de <strong className="text-ink">{deleting.name}</strong> (
              {formatCurrency(deleting.total)}) serão excluídas, inclusive as já vencidas.
            </>
          )
        }
      />
    </div>
  )
}

interface GroupCardProps {
  group: InstallmentGroup
  today: string
  expanded: boolean
  onToggle: () => void
  onEditParcel: (parcel: Expense) => void
  onDelete: () => void
}

function GroupCard({ group, today, expanded, onToggle, onEditParcel, onDelete }: GroupCardProps) {
  const { cardById, categoryById, userName } = useWorkspace()
  const card = cardById.get(group.cardId)
  const category = group.categoryId ? categoryById.get(group.categoryId) : undefined
  const missing = group.installmentsNumber - group.parcels.length
  const finished = !group.next

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <button type="button" onClick={onToggle} className="flex flex-1 items-start gap-3 text-left" aria-expanded={expanded}>
          <ChevronDownIcon className={`mt-0.5 shrink-0 text-ink-3 transition ${expanded ? '' : '-rotate-90'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{group.name}</span>
              <Badge tone="info">{group.installmentsNumber}x</Badge>
              {finished && <Badge tone="brand">Quitado</Badge>}
              {category && <Badge>{category.name}</Badge>}
              {missing > 0 && <Badge tone="warn">{missing} parcela{missing === 1 ? '' : 's'} removida{missing === 1 ? '' : 's'}</Badge>}
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {card?.name ?? 'Cartão'} · {userName(group.ownerId)} · {formatDate(group.firstDate)} → {formatDate(group.lastDate)}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <ProgressBar value={group.paidCount / group.parcels.length} />
              </div>
              <span className="text-xs whitespace-nowrap text-ink-3">
                {group.paidCount}/{group.parcels.length} vencidas
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center justify-between gap-4 pl-8 sm:justify-end sm:pl-0">
          <div className="text-right">
            <div className="font-semibold text-ink">{formatCurrency(group.total)}</div>
            <div className="text-xs text-ink-3">
              {group.next
                ? `Próxima: ${formatCurrency(group.next.amount)} em ${formatDate(group.next.expenseDate)}`
                : `Pago: ${formatCurrency(group.paidAmount)}`}
            </div>
          </div>
          <IconButton label="Excluir compra inteira" tone="danger" onClick={onDelete}>
            <TrashIcon />
          </IconButton>
        </div>
      </div>

      {expanded && (
        <ol className="divide-y divide-line border-t border-line bg-surface-2/40 text-sm">
          {group.parcels.map((parcel) => {
            const past = parcel.expenseDate <= today
            return (
              <li key={parcel.id} className="flex items-center gap-3 px-4 py-2 pl-12">
                <Badge tone={past ? 'neutral' : 'info'}>
                  {parcel.currentInstallment}/{parcel.installmentsNumber}
                </Badge>
                <span className={`flex-1 ${past ? 'text-ink-3' : 'text-ink-2'}`}>{formatDate(parcel.expenseDate)}</span>
                <span className={`font-medium ${past ? 'text-ink-3' : 'text-ink'}`}>{formatCurrency(parcel.amount)}</span>
                <IconButton label={`Editar parcela ${parcel.currentInstallment}`} onClick={() => onEditParcel(parcel)}>
                  <EditIcon />
                </IconButton>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
