export type BasePaymentStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentStatus = BasePaymentStatus | 'overdue'

/**
 * Visual tone mapping:
 * - danger: Red (overdue, due today, or due in 1–2 days)
 * - accent: Yellow (due in 3–7 days)
 * - neutral: Grey (unpaid, >7 days left)
 * - lime: Green (fully paid)
 */
export type DueTone = 'danger' | 'accent' | 'neutral' | 'lime'
export type DueState = 'paid' | 'unpaid' | 'due_soon' | 'overdue'
export type PaymentFilterStatus = 'all' | 'paid' | 'unpaid' | 'urgent' | 'due_soon' | 'overdue' | 'this_week'

export const DUE_SOON_DAYS = 7

export function istDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Calculates whole calendar-day difference between targetDate (periodEnd) and nowDate in Asia/Kolkata:
 * targetDate - nowDate
 * e.g. target tomorrow -> +1
 *      target today -> 0
 *      target yesterday -> -1
 */
export function calendarDaysDifference(targetDate: Date, nowDate: Date = new Date()): number {
  const targetDay = istDay(targetDate)
  const today = istDay(nowDate)
  const targetTime = new Date(`${targetDay}T00:00:00+05:30`).getTime()
  const todayTime = new Date(`${today}T00:00:00+05:30`).getTime()
  return Math.round((targetTime - todayTime) / 86_400_000)
}

export function outstandingBalance(
  dueAmountPaise: number,
  amountPaidPaise: number,
): number {
  return Math.max(dueAmountPaise - amountPaidPaise, 0)
}

export function deriveBaseStatus(
  dueAmountPaise: number,
  amountPaidPaise: number,
): BasePaymentStatus {
  if (amountPaidPaise >= dueAmountPaise) return 'paid'
  if (amountPaidPaise > 0) return 'partial'
  return 'unpaid'
}

export interface PaymentStatusDetails {
  status: PaymentStatus
  dueState: DueState
  tone: DueTone
  label: string
  daysLeft: number
  sortGroup: 1 | 2 | 3 | 4
}

export function evaluatePaymentStatus(
  dueAmountPaise: number,
  amountPaidPaise: number,
  periodEndDate: Date,
  now: Date = new Date(),
): PaymentStatusDetails {
  const balance = dueAmountPaise - amountPaidPaise
  const daysLeft = calendarDaysDifference(periodEndDate, now)

  if (balance <= 0) {
    return {
      status: 'paid',
      dueState: 'paid',
      tone: 'lime',
      label: 'Paid',
      daysLeft,
      sortGroup: 4,
    }
  }

  if (daysLeft < 0) {
    const overdueDays = Math.abs(daysLeft)
    return {
      status: 'overdue',
      dueState: 'overdue',
      tone: 'danger',
      label: `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`,
      daysLeft,
      sortGroup: 1,
    }
  }

  if (daysLeft === 0) {
    return {
      status: amountPaidPaise > 0 ? 'partial' : 'unpaid',
      dueState: 'due_soon',
      tone: 'danger',
      label: 'Due today',
      daysLeft,
      sortGroup: 1,
    }
  }

  if (daysLeft <= 2) {
    return {
      status: amountPaidPaise > 0 ? 'partial' : 'unpaid',
      dueState: 'due_soon',
      tone: 'danger',
      label: `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      daysLeft,
      sortGroup: 1,
    }
  }

  if (daysLeft <= 7) {
    return {
      status: amountPaidPaise > 0 ? 'partial' : 'unpaid',
      dueState: 'due_soon',
      tone: 'accent',
      label: `Due in ${daysLeft} days`,
      daysLeft,
      sortGroup: 2,
    }
  }

  return {
    status: amountPaidPaise > 0 ? 'partial' : 'unpaid',
    dueState: 'unpaid',
    tone: 'neutral',
    label: 'Unpaid',
    daysLeft,
    sortGroup: 3,
  }
}

export function deriveStatus(
  dueAmountPaise: number,
  amountPaidPaise: number,
  periodEndDate: Date,
  now: Date = new Date(),
): PaymentStatus {
  return evaluatePaymentStatus(dueAmountPaise, amountPaidPaise, periodEndDate, now).status
}

export function deriveDueState(
  dueAmountPaise: number,
  amountPaidPaise: number,
  periodEndDate: Date,
  now: Date = new Date(),
): DueState {
  return evaluatePaymentStatus(dueAmountPaise, amountPaidPaise, periodEndDate, now).dueState
}

export function deriveDueTone(
  dueAmountPaise: number,
  amountPaidPaise: number,
  periodEndDate: Date,
  now: Date = new Date(),
): DueTone {
  return evaluatePaymentStatus(dueAmountPaise, amountPaidPaise, periodEndDate, now).tone
}

export function deriveStatusLabel(
  dueAmountPaise: number,
  amountPaidPaise: number,
  periodEndDate: Date,
  now: Date = new Date(),
): string {
  return evaluatePaymentStatus(dueAmountPaise, amountPaidPaise, periodEndDate, now).label
}

export function deriveSortGroup(
  dueAmountPaise: number,
  amountPaidPaise: number,
  periodEndDate: Date,
  now: Date = new Date(),
): 1 | 2 | 3 | 4 {
  return evaluatePaymentStatus(dueAmountPaise, amountPaidPaise, periodEndDate, now).sortGroup
}

