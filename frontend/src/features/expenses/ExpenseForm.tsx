import { useMemo, useState, type FormEvent } from 'react'
import { expensesApi } from '../../api/services'
import type { CardPaymentMethod, Expense, PaymentMethod, RecurrenceUnit, RegisterExpenseRequest } from '../../api/types'
import { Alert, Badge, Button, Field, Modal, Select, Switch, TextArea, TextInput } from '../../components/ui'
import { useToast } from '../../components/toast-context'
import { todayIso } from '../../lib/dates'
import { formatCurrency, formatDate, parseMoney, paymentMethodLabel, recurrenceUnitLabel } from '../../lib/format'
import { splitApiError, type FieldErrors } from '../../lib/forms'
import {
  MAX_INSTALLMENTS,
  MIN_INSTALLMENTS,
  planInstallments,
  type RecurrenceMode,
} from '../../lib/installments'
import { useWorkspace } from '../../session/workspace-context'

const methodsFor = (cardMethod: CardPaymentMethod | undefined): PaymentMethod[] =>
  cardMethod === 'CREDIT' ? ['CREDIT'] : cardMethod === 'DEBIT' ? ['DEBIT'] : ['CREDIT', 'DEBIT']

const toInt = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN)

interface ExpenseFormProps {
  open: boolean
  expense?: Expense
  onClose: () => void
}

export function ExpenseForm(props: ExpenseFormProps) {
  if (!props.open) return null
  // A key garante estado novo a cada abertura/edição.
  return <ExpenseFormDialog key={props.expense?.id ?? 'new'} {...props} />
}

function ExpenseFormDialog({ expense, onClose }: ExpenseFormProps) {
  const { account, me, cards, categories, members, reload } = useWorkspace()
  const toast = useToast()
  const editing = Boolean(expense)
  const lockedToCredit = Boolean(expense?.isInInstallments)

  const availableCards = cards.filter(
    (card) =>
      (card.isActive || card.id === expense?.cardId) &&
      (!lockedToCredit || card.paymentMethod !== 'DEBIT'),
  )
  const availableCategories = categories.filter((category) => category.isActive || category.id === expense?.categoryId)

  const [name, setName] = useState(expense?.name ?? '')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amountText, setAmountText] = useState(expense ? String(expense.amount).replace('.', ',') : '')
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? todayIso())
  const [cardId, setCardId] = useState(expense?.cardId ?? availableCards[0]?.id ?? '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    expense?.paymentMethod ?? methodsFor(availableCards[0]?.paymentMethod)[0]!,
  )
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '')
  const [ownerId, setOwnerId] = useState(expense?.ownerId ?? me.id)

  const [inInstallments, setInInstallments] = useState(false)
  const [installmentsText, setInstallmentsText] = useState('2')
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('DEFAULT')
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>('MONTHS')
  const [intervalText, setIntervalText] = useState('1')
  const [dayText, setDayText] = useState(String(new Date().getDate()))

  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedCard = cards.find((card) => card.id === cardId)
  const allowedMethods = lockedToCredit ? (['CREDIT'] as PaymentMethod[]) : methodsFor(selectedCard?.paymentMethod)
  const amount = parseMoney(amountText)
  const installments = toInt(installmentsText)
  const interval = toInt(intervalText)
  const dayOfMonth = toInt(dayText)

  const owners = members.some((member) => member.userId === me.id)
    ? members
    : [{ userId: me.id, name: me.name, isActive: true }, ...members]

  const preview = useMemo(() => {
    if (!inInstallments || !amount || !expenseDate) return []
    if (!(installments >= MIN_INSTALLMENTS && installments <= MAX_INSTALLMENTS)) return []
    if (recurrenceMode === 'INTERVAL' && !(interval >= 1 && interval <= 365)) return []
    if (recurrenceMode === 'DAY_OF_MONTH' && !(dayOfMonth >= 1 && dayOfMonth <= 31)) return []
    return planInstallments(amount, installments, expenseDate, {
      mode: recurrenceMode,
      unit: recurrenceUnit,
      interval,
      dayOfMonth,
    })
  }, [inInstallments, amount, expenseDate, installments, recurrenceMode, recurrenceUnit, interval, dayOfMonth])

  function clearError(field: string) {
    setErrors(({ [field]: _removed, ...rest }) => rest)
  }

  function changeCard(nextId: string) {
    setCardId(nextId)
    clearError('cardId')
    const nextMethods = lockedToCredit ? ['CREDIT'] : methodsFor(cards.find((card) => card.id === nextId)?.paymentMethod)
    if (!nextMethods.includes(paymentMethod)) changeMethod(nextMethods[0] as PaymentMethod)
  }

  function changeMethod(method: PaymentMethod) {
    setPaymentMethod(method)
    if (method !== 'CREDIT') setInInstallments(false)
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {}
    if (!name.trim()) found.name = 'O nome é obrigatório'
    if (amount === null) found.amount = 'Informe um valor válido (ex.: 149,90)'
    else if (amount <= 0) found.amount = 'O valor deve ser maior que zero'
    if (!expenseDate) found.expenseDate = 'A data do gasto é obrigatória'
    if (!cardId) found.cardId = 'Selecione um cartão'
    if (!editing && inInstallments) {
      if (!(installments >= MIN_INSTALLMENTS && installments <= MAX_INSTALLMENTS))
        found.installmentsNumber = `Informe entre ${MIN_INSTALLMENTS} e ${MAX_INSTALLMENTS} parcelas`
      else if (amount && preview.length === 0 && !found.amount)
        found.installmentsNumber = 'O valor é insuficiente para o número de parcelas'
      if (recurrenceMode === 'INTERVAL' && !(interval >= 1 && interval <= 365))
        found.recurrenceInterval = 'Informe um intervalo entre 1 e 365'
      if (recurrenceMode === 'DAY_OF_MONTH' && !(dayOfMonth >= 1 && dayOfMonth <= 31))
        found.recurrenceDayOfMonth = 'Informe um dia entre 1 e 31'
    }
    return found
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      const common = {
        name: name.trim(),
        description: description.trim() || null,
        amount: amount!,
        paymentMethod,
        expenseDate,
        categoryId: categoryId || null,
        cardId,
      }

      if (expense) {
        await expensesApi.update(expense.id, common)
        toast.show('Despesa atualizada')
      } else {
        const body: RegisterExpenseRequest = {
          ...common,
          ownerId,
          accountId: account.id,
          isInInstallments: inInstallments,
          installmentsNumber: inInstallments ? installments : 0,
        }
        if (inInstallments && recurrenceMode === 'INTERVAL') {
          body.recurrenceUnit = recurrenceUnit
          body.recurrenceInterval = interval
        }
        if (inInstallments && recurrenceMode === 'DAY_OF_MONTH') body.recurrenceDayOfMonth = dayOfMonth
        await expensesApi.create(body)
        toast.show(inInstallments ? `Compra parcelada em ${installments}x registrada` : 'Despesa registrada')
      }
      await reload('expenses')
      onClose()
    } catch (err) {
      const { fields, message } = splitApiError(err)
      setErrors(fields)
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  const noCards = availableCards.length === 0

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={editing ? 'Editar despesa' : 'Nova despesa'}
      description={
        expense?.isInInstallments
          ? `Parcela ${expense.currentInstallment} de ${expense.installmentsNumber} — as alterações afetam apenas esta parcela.`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="expense-form" loading={saving} disabled={noCards}>
            {editing ? 'Salvar alterações' : inInstallments && preview.length ? `Registrar ${preview.length} parcelas` : 'Registrar despesa'}
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {formError && <Alert>{formError}</Alert>}
        {noCards && <Alert tone="warn">Cadastre um cartão ativo na aba Cartões antes de registrar despesas.</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" error={errors.name} className="sm:col-span-2">
            {(id, invalid) => (
              <TextInput
                id={id}
                invalid={invalid}
                value={name}
                maxLength={255}
                placeholder="Ex.: Notebook, Mercado"
                onChange={(event) => {
                  setName(event.target.value)
                  clearError('name')
                }}
              />
            )}
          </Field>

          <Field
            label={inInstallments ? 'Valor total da compra' : 'Valor'}
            error={errors.amount}
            hint={inInstallments && preview.length ? `${preview.length}x de ${formatCurrency(preview[preview.length - 1]!.amount)}` : undefined}
          >
            {(id, invalid) => (
              <TextInput
                id={id}
                invalid={invalid}
                inputMode="decimal"
                placeholder="0,00"
                value={amountText}
                onChange={(event) => {
                  setAmountText(event.target.value)
                  clearError('amount')
                }}
              />
            )}
          </Field>

          <Field label={inInstallments ? 'Data da 1ª parcela' : 'Data do gasto'} error={errors.expenseDate}>
            {(id, invalid) => (
              <TextInput
                id={id}
                type="date"
                invalid={invalid}
                value={expenseDate}
                onChange={(event) => {
                  setExpenseDate(event.target.value)
                  clearError('expenseDate')
                }}
              />
            )}
          </Field>

          <Field label="Cartão" error={errors.cardId}>
            {(id, invalid) => (
              <Select id={id} invalid={invalid} value={cardId} onChange={(event) => changeCard(event.target.value)} disabled={noCards}>
                {noCards && <option value="">Nenhum cartão ativo</option>}
                {availableCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                    {card.isActive ? '' : ' (inativo)'}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Forma de pagamento"
            error={errors.paymentMethod}
            hint={lockedToCredit ? 'Parcelas são sempre no crédito.' : undefined}
          >
            {(id, invalid) => (
              <Select
                id={id}
                invalid={invalid}
                value={paymentMethod}
                disabled={allowedMethods.length < 2}
                onChange={(event) => changeMethod(event.target.value as PaymentMethod)}
              >
                {allowedMethods.map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabel[method]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Categoria" error={errors.categoryId}>
            {(id, invalid) => (
              <Select id={id} invalid={invalid} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Sem categoria</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.isActive ? '' : ' (inativa)'}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {!editing && (
            <Field label="Quem pagou" error={errors.ownerId}>
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                  {owners.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                      {member.userId === me.id ? ' (você)' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          <Field label="Descrição" error={errors.description} className="sm:col-span-2">
            {(id, invalid) => (
              <TextArea
                id={id}
                invalid={invalid}
                value={description}
                maxLength={255}
                placeholder="Opcional"
                onChange={(event) => setDescription(event.target.value)}
              />
            )}
          </Field>
        </div>

        {!editing && (
          <div className="rounded-xl border border-line bg-surface-2/50 p-4">
            <Switch
              checked={inInstallments}
              onChange={(checked) => {
                setInInstallments(checked)
                clearError('installmentsNumber')
              }}
              disabled={paymentMethod !== 'CREDIT'}
              label="Compra parcelada"
              description={
                paymentMethod === 'CREDIT'
                  ? 'Divide o valor total em parcelas com datas automáticas.'
                  : 'Apenas compras no crédito podem ser parceladas.'
              }
            />

            {inInstallments && (
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Número de parcelas" error={errors.installmentsNumber} hint={`Entre ${MIN_INSTALLMENTS} e ${MAX_INSTALLMENTS}`}>
                    {(id, invalid) => (
                      <TextInput
                        id={id}
                        invalid={invalid}
                        type="number"
                        min={MIN_INSTALLMENTS}
                        max={MAX_INSTALLMENTS}
                        value={installmentsText}
                        onChange={(event) => {
                          setInstallmentsText(event.target.value)
                          clearError('installmentsNumber')
                        }}
                      />
                    )}
                  </Field>

                  <Field label="Vencimento das parcelas" error={errors.recurrenceUnit}>
                    {(id, invalid) => (
                      <Select
                        id={id}
                        invalid={invalid}
                        value={recurrenceMode}
                        onChange={(event) => {
                          setRecurrenceMode(event.target.value as RecurrenceMode)
                          clearError('recurrenceInterval')
                          clearError('recurrenceDayOfMonth')
                        }}
                      >
                        <option value="DEFAULT">Todo mês, a partir da data</option>
                        <option value="DAY_OF_MONTH">Dia fixo do mês (fatura)</option>
                        <option value="INTERVAL">Intervalo personalizado</option>
                      </Select>
                    )}
                  </Field>

                  {recurrenceMode === 'DAY_OF_MONTH' && (
                    <Field
                      label="Dia do vencimento"
                      error={errors.recurrenceDayOfMonth}
                      hint="Da 2ª parcela em diante. Em meses mais curtos, usa o último dia."
                    >
                      {(id, invalid) => (
                        <TextInput
                          id={id}
                          invalid={invalid}
                          type="number"
                          min={1}
                          max={31}
                          value={dayText}
                          onChange={(event) => {
                            setDayText(event.target.value)
                            clearError('recurrenceDayOfMonth')
                          }}
                        />
                      )}
                    </Field>
                  )}

                  {recurrenceMode === 'INTERVAL' && (
                    <div className="grid grid-cols-[1fr_1.4fr] gap-2">
                      <Field label="A cada" error={errors.recurrenceInterval}>
                        {(id, invalid) => (
                          <TextInput
                            id={id}
                            invalid={invalid}
                            type="number"
                            min={1}
                            max={365}
                            value={intervalText}
                            onChange={(event) => {
                              setIntervalText(event.target.value)
                              clearError('recurrenceInterval')
                            }}
                          />
                        )}
                      </Field>
                      <Field label="Unidade" error={errors.recurrenceUnit}>
                        {(id, invalid) => (
                          <Select
                            id={id}
                            invalid={invalid}
                            value={recurrenceUnit}
                            onChange={(event) => setRecurrenceUnit(event.target.value as RecurrenceUnit)}
                          >
                            {(Object.keys(recurrenceUnitLabel) as RecurrenceUnit[]).map((unit) => (
                              <option key={unit} value={unit}>
                                {interval === 1 ? recurrenceUnitLabel[unit].one : recurrenceUnitLabel[unit].many}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    </div>
                  )}
                </div>

                {preview.length > 0 && <InstallmentPreview preview={preview} />}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}

function InstallmentPreview({ preview }: { preview: ReturnType<typeof planInstallments> }) {
  const visible = preview.length > 8 ? [...preview.slice(0, 6), null, preview[preview.length - 1]!] : preview
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">Prévia das parcelas</p>
      <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface text-sm">
        {visible.map((parcel, index) =>
          parcel ? (
            <li key={parcel.number} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex items-center gap-2">
                <Badge tone="info">
                  {parcel.number}/{preview.length}
                </Badge>
                <span className="text-ink-2">{formatDate(parcel.date)}</span>
              </span>
              <span className="font-medium text-ink">{formatCurrency(parcel.amount)}</span>
            </li>
          ) : (
            <li key={`gap-${index}`} className="px-3 py-1.5 text-center text-xs text-ink-3">
              … {preview.length - 7} parcelas …
            </li>
          ),
        )}
      </ol>
    </div>
  )
}
