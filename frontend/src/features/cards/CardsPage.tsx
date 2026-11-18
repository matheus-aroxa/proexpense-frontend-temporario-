import { useMemo, useState, type FormEvent } from 'react'
import { cardsApi } from '../../api/services'
import type { Card, CardPaymentMethod } from '../../api/types'
import { CardIcon, EditIcon, PlusIcon } from '../../components/icons'
import { Alert, Badge, Button, EmptyState, Field, IconButton, Modal, PageHeader, Panel, ProgressBar, Select, Switch, TextInput } from '../../components/ui'
import { useToast } from '../../components/toast-context'
import { currentYearMonth, sameYearMonth } from '../../lib/dates'
import { cardPaymentMethodLabel, formatCurrency, formatMonth, parseMoney } from '../../lib/format'
import { splitApiError, type FieldErrors } from '../../lib/forms'
import { sumAmounts } from '../../lib/installments'
import { useWorkspace } from '../../session/workspace-context'

export function CardsPage() {
  const { cards, expenses, userName } = useWorkspace()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Card | undefined>()
  const month = currentYearMonth()

  const usage = useMemo(() => {
    const result = new Map<string, { month: number; future: number }>()
    for (const card of cards) {
      const ofCard = expenses.filter((expense) => expense.cardId === card.id)
      result.set(card.id, {
        month: sumAmounts(ofCard.filter((expense) => sameYearMonth(expense.expenseDate, month))),
        future: sumAmounts(
          ofCard.filter(
            (expense) =>
              expense.paymentMethod === 'CREDIT' &&
              expense.expenseDate.slice(0, 7) >= `${month.year}-${String(month.month).padStart(2, '0')}`,
          ),
        ),
      })
    }
    return result
  }, [cards, expenses, month])

  const sorted = [...cards].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))

  function openForm(card?: Card) {
    setEditing(card)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cartões"
        description={`Formas de pagamento da conta. Valores de ${formatMonth(month.year, month.month).toLowerCase()}.`}
        actions={
          <Button icon={<PlusIcon />} onClick={() => openForm()}>
            Novo cartão
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<CardIcon />}
            title="Nenhum cartão cadastrado"
            description="Toda despesa é vinculada a um cartão. Cadastre um de crédito, débito ou ambos."
            action={
              <Button icon={<PlusIcon />} onClick={() => openForm()}>
                Novo cartão
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((card) => {
            const used = usage.get(card.id) ?? { month: 0, future: 0 }
            const limit = card.limit ?? 0
            const ratio = limit > 0 ? used.future / limit : 0
            return (
              <Panel key={card.id} className={`flex flex-col gap-4 p-4 ${card.isActive ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <CardIcon />
                    </span>
                    <div>
                      <p className="font-medium text-ink">{card.name}</p>
                      <p className="text-xs text-ink-3">{userName(card.ownerId)}</p>
                    </div>
                  </div>
                  <IconButton label="Editar cartão" onClick={() => openForm(card)}>
                    <EditIcon />
                  </IconButton>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="info">{cardPaymentMethodLabel[card.paymentMethod]}</Badge>
                  {!card.isActive && <Badge tone="warn">Inativo</Badge>}
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-3">Gasto no mês</span>
                    <span className="font-medium text-ink">{formatCurrency(used.month)}</span>
                  </div>
                  {card.paymentMethod !== 'DEBIT' && limit > 0 && (
                    <>
                      <ProgressBar value={ratio} tone={ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warn' : 'brand'} />
                      <div className="flex justify-between text-xs text-ink-3">
                        <span>Crédito comprometido {formatCurrency(used.future)}</span>
                        <span>Limite {formatCurrency(limit)}</span>
                      </div>
                    </>
                  )}
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      <CardForm open={formOpen} card={editing} onClose={() => setFormOpen(false)} />
    </div>
  )
}

function CardForm(props: { open: boolean; card?: Card; onClose: () => void }) {
  if (!props.open) return null
  return <CardFormDialog key={props.card?.id ?? 'new'} {...props} />
}

function CardFormDialog({ card, onClose }: { card?: Card; onClose: () => void }) {
  const { account, me, reload } = useWorkspace()
  const toast = useToast()
  const [name, setName] = useState(card?.name ?? '')
  const [paymentMethod, setPaymentMethod] = useState<CardPaymentMethod>(card?.paymentMethod ?? 'CREDIT')
  const [limitText, setLimitText] = useState(card?.limit != null ? String(card.limit).replace('.', ',') : '')
  const [isActive, setIsActive] = useState(card?.isActive ?? true)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found: FieldErrors = {}
    const limit = limitText.trim() ? parseMoney(limitText) : null
    if (!name.trim()) found.name = 'O nome é obrigatório'
    if (limitText.trim() && limit === null) found.limit = 'Informe um valor válido (ex.: 5.000,00)'
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) return

    setSaving(true)
    try {
      if (card) {
        await cardsApi.update(card.id, { name: name.trim(), paymentMethod, limit, isActive })
        toast.show('Cartão atualizado')
      } else {
        await cardsApi.create({ name: name.trim(), paymentMethod, limit, ownerId: me.id, accountId: account.id })
        toast.show('Cartão cadastrado')
      }
      await reload('cards')
      onClose()
    } catch (err) {
      const { fields, message } = splitApiError(err)
      setErrors(fields)
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={card ? 'Editar cartão' : 'Novo cartão'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="card-form" loading={saving}>
            {card ? 'Salvar' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <form id="card-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field label="Nome" error={errors.name}>
          {(id, invalid) => (
            <TextInput id={id} invalid={invalid} value={name} maxLength={255} placeholder="Ex.: Nubank, Itaú Platinum" onChange={(event) => setName(event.target.value)} />
          )}
        </Field>
        <Field label="Função" error={errors.paymentMethod}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as CardPaymentMethod)}>
              {(Object.keys(cardPaymentMethodLabel) as CardPaymentMethod[]).map((method) => (
                <option key={method} value={method}>
                  {cardPaymentMethodLabel[method]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Limite" error={errors.limit} hint="Opcional">
          {(id, invalid) => (
            <TextInput id={id} invalid={invalid} inputMode="decimal" placeholder="0,00" value={limitText} onChange={(event) => setLimitText(event.target.value)} />
          )}
        </Field>
        {card && (
          <Switch checked={isActive} onChange={setIsActive} label="Cartão ativo" description="Cartões inativos não aparecem para novas despesas." />
        )}
      </form>
    </Modal>
  )
}
