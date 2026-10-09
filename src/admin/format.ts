import type { PaymentStatus } from './types'

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
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
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

/** Converts a rupee string/number from a form into integer paise. */
export function rupeesToPaise(value: string | number): number {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100)
}

export function paiseToRupeeInput(paise: number): string {
  return (paise / 100).toFixed(2)
}
