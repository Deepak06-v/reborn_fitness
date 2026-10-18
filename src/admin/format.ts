import type { DueState, DueTone, PaymentStatus } from './types'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function formatINR(value: number): string {
  return inr.format(value)
}

/** Paise -> localized ₹ string. */
export function formatPaise(paise: number): string {
  return formatINR(Math.round(paise) / 100)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

/**
 * Calculates membership end date (dd/mm/yyyy) from a YYYY-MM-DD joining date
 * and duration in months, clamping to valid month bounds.
 */
export function calculateMembershipEndDate(
  joiningDateStr: string,
  durationMonths: number,
): string {
  if (!joiningDateStr || !durationMonths) return ''
  const parts = joiningDateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return ''
  const [startYear, startMonth, startDay] = parts
  const totalMonths = startMonth - 1 + durationMonths
  const targetYear = startYear + Math.floor(totalMonths / 12)
  const targetMonth = (totalMonths % 12) + 1
  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate()
  const targetDay = Math.min(startDay, daysInTargetMonth)
  const dd = String(targetDay).padStart(2, '0')
  const mm = String(targetMonth).padStart(2, '0')
  const yyyy = String(targetYear)
  return `${dd}/${mm}/${yyyy}`
}

/** Current month as YYYY-MM in IST. */
export function currentMonthValue(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
  return parts.slice(0, 7)
}

/** Today as YYYY-MM-DD in IST, for <input type="date"> defaults. */
export function todayInputValue(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function formatMonth(month: string): string {
  const [year, monthPart] = month.split('-')
  const date = new Date(Number(year), Number(monthPart) - 1, 1)
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function formatMonthShort(month: string): string {
  const [year, monthPart] = month.split('-')
  const date = new Date(Number(year), Number(monthPart) - 1, 1)
  return date.toLocaleDateString('en-IN', { month: 'short' })
}

export const paymentStatusTone: Record<
  PaymentStatus,
  'lime' | 'accent' | 'neutral' | 'danger'
> = {
  paid: 'lime',
  partial: 'accent',
  unpaid: 'neutral',
  overdue: 'danger',
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
}

/**
 * Colour-coded due state for a single bill:
 * green = paid, yellow = unpaid (more than 7 days away),
 * red = due soon / overdue.
 */
export const dueStateTone: Record<DueState, DueTone> = {
  paid: 'lime',
  unpaid: 'neutral',
  due_soon: 'danger',
  overdue: 'danger',
}

export const dueStateLabel: Record<DueState, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  due_soon: 'Due soon',
  overdue: 'Overdue',
}

/** Converts a rupee string/number from a form into integer paise. */
export function rupeesToPaise(value: string | number): number {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100)
}

export function paiseToRupeeInput(paise: number): string {
  return (paise / 100).toFixed(2)
}
