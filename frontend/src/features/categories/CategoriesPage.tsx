import { useMemo, useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/http'
import { categoriesApi } from '../../api/services'
import type { Category } from '../../api/types'
import { EditIcon, PlusIcon, TagIcon } from '../../components/icons'
import { Alert, Badge, Button, EmptyState, Field, IconButton, Modal, PageHeader, Panel, Switch, TextInput } from '../../components/ui'
import { useToast } from '../../components/toast-context'
import { currentYearMonth, sameYearMonth } from '../../lib/dates'
import { formatCurrency, formatMonth } from '../../lib/format'
import { splitApiError } from '../../lib/forms'
import { sumAmounts } from '../../lib/installments'
import { useWorkspace } from '../../session/workspace-context'

export function CategoriesPage() {
  const { categories, expenses, reload } = useWorkspace()
  const toast = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | undefined>()
  const [toggling, setToggling] = useState<string | null>(null)
  const month = currentYearMonth()

  const totals = useMemo(() => {
    const ofMonth = expenses.filter((expense) => sameYearMonth(expense.expenseDate, month))
    const result = new Map<string, number>()
    for (const category of categories) {
      result.set(category.id, sumAmounts(ofMonth.filter((expense) => expense.categoryId === category.id)))
    }
    return result
  }, [categories, expenses, month])

  const max = Math.max(1, ...totals.values())
  const sorted = [...categories].sort(
    (a, b) => Number(b.isActive) - Number(a.isActive) || (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) || a.name.localeCompare(b.name),
  )

  async function toggleActive(category: Category) {
    setToggling(category.id)
    try {
      await categoriesApi.update(category.id, { name: category.name, isActive: !category.isActive })
      await reload('categories')
      toast.show(category.isActive ? 'Categoria desativada' : 'Categoria reativada')
    } catch (err) {
      toast.show(errorMessage(err), 'error')
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Categorias"
        description={`Organize as despesas da conta. Totais de ${formatMonth(month.year, month.month).toLowerCase()}.`}
        actions={
          <Button
            icon={<PlusIcon />}
            onClick={() => {
              setEditing(undefined)
              setFormOpen(true)
            }}
          >
            Nova categoria
          </Button>
        }
      />

      <Panel className="overflow-hidden">
        {sorted.length === 0 ? (
          <EmptyState icon={<TagIcon />} title="Nenhuma categoria" description="Crie categorias como Mercado, Transporte ou Lazer." />
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map((category) => {
              const total = totals.get(category.id) ?? 0
              return (
                <li key={category.id} className={`flex items-center gap-4 px-4 py-3 ${category.isActive ? '' : 'opacity-60'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{category.name}</span>
                      {!category.isActive && <Badge tone="warn">Inativa</Badge>}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(total / max) * 100}%` }} />
                    </div>
                  </div>
                  <span className="w-28 text-right text-sm font-medium text-ink">{formatCurrency(total)}</span>
                  <Button variant="ghost" size="sm" loading={toggling === category.id} onClick={() => toggleActive(category)}>
                    {category.isActive ? 'Desativar' : 'Reativar'}
                  </Button>
                  <IconButton
                    label="Editar categoria"
                    onClick={() => {
                      setEditing(category)
                      setFormOpen(true)
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {formOpen && <CategoryForm key={editing?.id ?? 'new'} category={editing} onClose={() => setFormOpen(false)} />}
    </div>
  )
}

function CategoryForm({ category, onClose }: { category?: Category; onClose: () => void }) {
  const { account, reload } = useWorkspace()
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [isActive, setIsActive] = useState(category?.isActive ?? true)
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setError('O nome é obrigatório')
      return
    }
    setSaving(true)
    try {
      if (category) {
        await categoriesApi.update(category.id, { name: name.trim(), isActive })
        toast.show('Categoria atualizada')
      } else {
        await categoriesApi.create({ name: name.trim(), accountId: account.id })
        toast.show('Categoria criada')
      }
      await reload('categories')
      onClose()
    } catch (err) {
      const { fields, message } = splitApiError(err)
      setError(fields.name)
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? 'Editar categoria' : 'Nova categoria'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" loading={saving}>
            {category ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field label="Nome" error={error}>
          {(id, invalid) => (
            <TextInput
              id={id}
              invalid={invalid}
              value={name}
              maxLength={255}
              placeholder="Ex.: Mercado"
              onChange={(event) => {
                setName(event.target.value)
                setError(undefined)
              }}
            />
          )}
        </Field>
        {category && <Switch checked={isActive} onChange={setIsActive} label="Categoria ativa" />}
      </form>
    </Modal>
  )
}
