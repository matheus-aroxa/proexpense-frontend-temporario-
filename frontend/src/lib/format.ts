import type { CardPaymentMethod, PaymentMethod, RecurrenceUnit } from '../api/types'
import { parseIsoDate } from './dates'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

export const formatCurrency = (value: number) => currency.format(value)

export const formatDate = (iso: string) => shortDate.format(parseIsoDate(iso)).replace('.', '')

export function formatMonth(year: number, month: number) {
  const label = monthYear.format(new Date(year, month - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
}

export const cardPaymentMethodLabel: Record<CardPaymentMethod, string> = {
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  BOTH: 'Crédito e débito',
}

export const recurrenceUnitLabel: Record<RecurrenceUnit, { one: string; many: string }> = {
  DAYS: { one: 'dia', many: 'dias' },
  MONTHS: { one: 'mês', many: 'meses' },
  YEARS: { one: 'ano', many: 'anos' },
}

/** Converte "1.234,56", "1234.56" ou "1234,5" em número; devolve null se inválido. */
export function parseMoney(input: string): number | null {
  const raw = input.trim().replace(/\s|R\$/g, '')
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Number(normalized)
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}
