import type { IsoDate } from '../api/types'

/** Interpreta "YYYY-MM-DD" como data local (sem deslocamento de fuso). */
export function parseIsoDate(iso: IsoDate): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const todayIso = () => toIsoDate(new Date())

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()

/** Equivalente a LocalDate.plusMonths: ajusta para o último dia do mês quando necessário. */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const day = Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth() + 1))
  return new Date(target.getFullYear(), target.getMonth(), day)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export interface YearMonth {
  year: number
  month: number // 1-12
}

export const yearMonthOf = (iso: IsoDate): YearMonth => {
  const [year, month] = iso.split('-').map(Number)
  return { year: year!, month: month! }
}

export const currentYearMonth = (): YearMonth => yearMonthOf(todayIso())

export function shiftYearMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export const sameYearMonth = (iso: IsoDate, ym: YearMonth) => {
  const other = yearMonthOf(iso)
  return other.year === ym.year && other.month === ym.month
}
