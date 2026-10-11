export type BasePaymentStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentStatus = BasePaymentStatus | 'overdue'
/** Filter values additionally expose the time-sensitive upcoming/due_soon states. */
export type PaymentFilterStatus = PaymentStatus | 'upcoming' | 'due_soon'

/**
 * Stored status (persisted) intentionally omits "overdue" because overdue
 * depends on the current time and would otherwise go stale. It is derived
 * live from the due date and the outstanding balance.
 */
export function deriveBaseStatus(
  dueAmountPaise: number,
  amountPaidPaise: number,
): BasePaymentStatus {
  if (amountPaidPaise >= dueAmountPaise) return 'paid'
  if (amountPaidPaise > 0) return 'partial'
  return 'unpaid'
}

export function deriveStatus(
  dueAmountPaise: number,
  amountPaidPaise: number,
  dueDate: Date,
  now: Date = new Date(),
): PaymentStatus {
  const balance = dueAmountPaise - amountPaidPaise
  if (balance <= 0) return 'paid'
  if (dueDate.getTime() < now.getTime()) return 'overdue'
  if (amountPaidPaise > 0) return 'partial'
  return 'unpaid'
}

export function outstandingBalance(
  dueAmountPaise: number,
  amountPaidPaise: number,
): number {
  return Math.max(dueAmountPaise - amountPaidPaise, 0)
}

/**
 * Colour-coded payment state used by the admin UI:
 *   - paid      -> green  (nothing outstanding)
 *   - upcoming  -> yellow (unpaid, due date is more than 2 days away)
 *   - due_soon  -> red    (unpaid, due today or within the next 2 days)
 *   - overdue   -> red    (unpaid, due date already passed)
 *
 * Comparison is done on whole IST calendar days so that a bill due "today" is
 * reported as due_soon rather than overdue.
 */
export type DueState = 'paid' | 'upcoming' | 'due_soon' | 'overdue'

export const DUE_SOON_DAYS = 2

function istDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function deriveDueState(
  dueAmountPaise: number,
  amountPaidPaise: number,
  dueDate: Date,
  now: Date = new Date(),
): DueState {
  if (dueAmountPaise - amountPaidPaise <= 0) return 'paid'

  const dueDay = istDay(dueDate)
  const today = istDay(now)
  if (dueDay < today) return 'overdue'

  const soonLimit = istDay(new Date(now.getTime() + DUE_SOON_DAYS * 86_400_000))
  return dueDay <= soonLimit ? 'due_soon' : 'upcoming'
}
