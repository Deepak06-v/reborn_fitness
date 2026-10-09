export type BasePaymentStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentStatus = BasePaymentStatus | 'overdue'

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
