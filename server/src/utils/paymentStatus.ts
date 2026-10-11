export type BasePaymentStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentStatus = BasePaymentStatus | 'overdue'
/** Filter values are the live, colour-coded due states of a bill. */
export type PaymentFilterStatus = DueState

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
  // Compare whole IST calendar days so a bill due "today" is not yet overdue.
  if (istDay(dueDate) < istDay(now)) return 'overdue'
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
 *   - unpaid    -> yellow (outstanding, due date is more than 7 days away)
 *   - due_soon  -> red    (outstanding, due today or within the next 7 days)
 *   - overdue   -> red    (outstanding, due date already passed)
 *
 * Comparison is done on whole IST calendar days so that a bill due "today" is
 * reported as due_soon rather than overdue.
 */
export type DueState = 'paid' | 'unpaid' | 'due_soon' | 'overdue'

export const DUE_SOON_DAYS = 7

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
  return dueDay <= soonLimit ? 'due_soon' : 'unpaid'
}
