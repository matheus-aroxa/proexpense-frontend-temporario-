import type { Expense, IsoDate, RecurrenceUnit } from '../api/types'
import { addDays, addMonths, daysInMonth, parseIsoDate, toIsoDate } from './dates'

export const MIN_INSTALLMENTS = 2
export const MAX_INSTALLMENTS = 120

export type RecurrenceMode = 'DEFAULT' | 'INTERVAL' | 'DAY_OF_MONTH'

export interface RecurrenceInput {
  mode: RecurrenceMode
  unit: RecurrenceUnit
  interval: number
  dayOfMonth: number
}

export interface PlannedInstallment {
  number: number
  date: IsoDate
  amount: number
}

/** Mesmo cálculo de ExpenseService.splitAmount: arredonda para baixo e soma o resto na 1ª parcela. */
export function splitAmount(total: number, installments: number): number[] {
  const totalCents = Math.round(total * 100)
  const base = Math.floor(totalCents / installments)
  if (base <= 0) return []
  const remainder = totalCents - base * installments
  return Array.from({ length: installments }, (_, index) =>
    (index === 0 ? base + remainder : base) / 100,
  )
}

function addUnit(start: Date, unit: RecurrenceUnit, amount: number): Date {
  switch (unit) {
    case 'DAYS':
      return addDays(start, amount)
    case 'MONTHS':
      return addMonths(start, amount)
    case 'YEARS':
      return addMonths(start, amount * 12)
  }
}

/** Espelha InstallmentScheduler.byInterval. */
export function datesByInterval(start: IsoDate, installments: number, unit: RecurrenceUnit, interval: number) {
  const base = parseIsoDate(start)
  return Array.from({ length: installments }, (_, index) =>
    toIsoDate(addUnit(base, unit, interval * index)),
  )
}

/** Espelha InstallmentScheduler.byDayOfMonth. */
export function datesByDayOfMonth(start: IsoDate, installments: number, dayOfMonth: number) {
  const startDate = parseIsoDate(start)
  const atDay = (year: number, monthIndex: number) =>
    new Date(year, monthIndex, Math.min(dayOfMonth, daysInMonth(year, monthIndex + 1)))

  const dates: IsoDate[] = [start]
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  if (atDay(cursor.getFullYear(), cursor.getMonth()) <= startDate) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  for (let index = 1; index < installments; index++) {
    dates.push(toIsoDate(atDay(cursor.getFullYear(), cursor.getMonth())))
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  return dates
}

export function planInstallments(
  total: number,
  installments: number,
  start: IsoDate,
  recurrence: RecurrenceInput,
): PlannedInstallment[] {
  const amounts = splitAmount(total, installments)
  if (amounts.length === 0) return []

  const dates =
    recurrence.mode === 'DAY_OF_MONTH'
      ? datesByDayOfMonth(start, installments, recurrence.dayOfMonth)
      : recurrence.mode === 'INTERVAL'
        ? datesByInterval(start, installments, recurrence.unit, recurrence.interval)
        : datesByInterval(start, installments, 'MONTHS', 1)

  return amounts.map((amount, index) => ({ number: index + 1, date: dates[index]!, amount }))
}

/** Uma compra parcelada reconstruída a partir das parcelas (o backend não expõe um id de grupo). */
export interface InstallmentGroup {
  key: string
  name: string
  description: string | null
  ownerId: string
  cardId: string
  categoryId: string | null
  installmentsNumber: number
  parcels: Expense[]
  total: number
  paidCount: number
  paidAmount: number
  next: Expense | undefined
  firstDate: IsoDate
  lastDate: IsoDate
}

/**
 * Agrupa as parcelas de uma mesma compra. Parcelas de compras idênticas são separadas
 * atribuindo cada parcela ao primeiro grupo que ainda não tenha aquele número de parcela.
 */
export function groupInstallments(expenses: Expense[], today: IsoDate): InstallmentGroup[] {
  const buckets = new Map<string, Expense[][]>()
  const sorted = expenses
    .filter((expense) => expense.isInInstallments)
    .sort((a, b) => a.expenseDate.localeCompare(b.expenseDate) || a.currentInstallment - b.currentInstallment)

  for (const expense of sorted) {
    const key = [expense.accountId, expense.ownerId, expense.name, expense.installmentsNumber].join('|')
    const groups = buckets.get(key) ?? []
    let target = groups.find(
      (group) =>
        group.length < expense.installmentsNumber &&
        !group.some((parcel) => parcel.currentInstallment === expense.currentInstallment),
    )
    if (!target) {
      target = []
      groups.push(target)
    }
    target.push(expense)
    buckets.set(key, groups)
  }

  const result: InstallmentGroup[] = []
  for (const [key, groups] of buckets) {
    groups.forEach((parcels, index) => {
      parcels.sort((a, b) => a.currentInstallment - b.currentInstallment)
      const first = parcels[0]!
      const paid = parcels.filter((parcel) => parcel.expenseDate <= today)
      const dates = parcels.map((parcel) => parcel.expenseDate).sort()
      result.push({
        key: `${key}#${index}`,
        name: first.name,
        description: first.description,
        ownerId: first.ownerId,
        cardId: first.cardId,
        categoryId: first.categoryId,
        installmentsNumber: first.installmentsNumber,
        parcels,
        total: sumAmounts(parcels),
        paidCount: paid.length,
        paidAmount: sumAmounts(paid),
        next: parcels.find((parcel) => parcel.expenseDate > today),
        firstDate: dates[0]!,
        lastDate: dates[dates.length - 1]!,
      })
    })
  }

  return result.sort((a, b) => b.firstDate.localeCompare(a.firstDate))
}

export const sumAmounts = (expenses: { amount: number }[]) =>
  Math.round(expenses.reduce((total, expense) => total + Number(expense.amount), 0) * 100) / 100
