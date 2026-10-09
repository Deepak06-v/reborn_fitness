const IST_OFFSET = '+05:30'
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function isValidMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value)
}

function parseMonth(month: string): { year: number; month: number } {
  const [year, monthNumber] = month.split('-').map(Number)
  return { year, month: monthNumber }
}

/** First instant of the month, in Asia/Kolkata (IST = UTC+05:30). */
export function monthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00${IST_OFFSET}`)
}

export function addMonths(month: string, delta: number): string {
  const { year, month: monthNumber } = parseMonth(month)
  const total = year * 12 + (monthNumber - 1) + delta
  const nextYear = Math.floor(total / 12)
  const nextMonth = ((total % 12) + 12) % 12
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth + 1).padStart(2, '0')}`
}

/** Exclusive upper bound: the first instant of the following month. */
export function monthEndExclusive(month: string): Date {
  return monthStart(addMonths(month, 1))
}

export function monthRange(month: string): { start: Date; end: Date } {
  return { start: monthStart(month), end: monthEndExclusive(month) }
}

export function currentMonth(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

export function lastNMonths(month: string, count: number): string[] {
  const months: string[] = []
  for (let i = count - 1; i >= 0; i -= 1) months.push(addMonths(month, -i))
  return months
}
