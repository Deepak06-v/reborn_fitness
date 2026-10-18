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

/** The calendar day (YYYY-MM-DD) of a date in Asia/Kolkata. */
export function istDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** The first instant of the IST calendar day containing `date`. */
export function istDayStart(date: Date): Date {
  return new Date(`${istDay(date)}T00:00:00${IST_OFFSET}`)
}

/**
 * Adds whole months to a date in Asia/Kolkata, clamping the day of month when
 * the target month is shorter (e.g. 31 Jan + 1 month -> 28/29 Feb). The result
 * is the first instant of that day in IST, mirroring monthStart().
 *
 * Used to compute a billing period's exclusive end date from a joining date.
 */
export function addMonthsClamped(date: Date, delta: number): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970')
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01')
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '01')

  const total = year * 12 + (month - 1) + delta
  const targetYear = Math.floor(total / 12)
  const targetMonthIndex = ((total % 12) + 12) % 12
  const daysInTarget = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, daysInTarget)

  const mm = String(targetMonthIndex + 1).padStart(2, '0')
  const dd = String(targetDay).padStart(2, '0')
  return new Date(`${targetYear}-${mm}-${dd}T00:00:00${IST_OFFSET}`)
}

/** The day-of-month (1-31) of a date in Asia/Kolkata. */
export function istDayOfMonth(date: Date): number {
  return Number(istDay(date).slice(8, 10))
}

/**
 * Adds whole months to a date in Asia/Kolkata while pinning the day-of-month
 * to a fixed anchor (clamped when the target month is shorter).
 *
 * Anchoring to the member's joining day keeps a billing cycle stable across
 * short months: a cycle that starts on the 31st resumes on the 31st in every
 * month that has one, and on the last day (28/29/30) otherwise.
 */
export function addMonthsAnchored(date: Date, delta: number, anchorDay: number): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970')
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01')

  const total = year * 12 + (month - 1) + delta
  const targetYear = Math.floor(total / 12)
  const targetMonthIndex = ((total % 12) + 12) % 12
  const daysInTarget = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate()
  const targetDay = Math.min(Math.max(anchorDay, 1), daysInTarget)

  const mm = String(targetMonthIndex + 1).padStart(2, '0')
  const dd = String(targetDay).padStart(2, '0')
  return new Date(`${targetYear}-${mm}-${dd}T00:00:00${IST_OFFSET}`)
}

export function lastNMonths(month: string, count: number): string[] {
  const months: string[] = []
  for (let i = count - 1; i >= 0; i -= 1) months.push(addMonths(month, -i))
  return months
}

/** Formats a date as dd/mm/yyyy in Asia/Kolkata. */
export function formatDDMMYYYY(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${day}/${m}/${y}`
}
