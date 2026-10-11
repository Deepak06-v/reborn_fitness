import type { PaymentFilterStatus } from './paymentStatus'
import { DUE_SOON_DAYS } from './paymentStatus'
import { istDayStart } from './month'

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Builds an aggregation-expression ($expr) that matches a billing record for a
 * derived due state. "unpaid", "due_soon" and "overdue" are computed from the
 * due date and outstanding balance rather than the stored (time-independent)
 * status, using whole IST calendar days.
 */
export function paymentStatusExpr(
  status: PaymentFilterStatus,
  now: Date,
): Record<string, unknown> {
  const todayStart = istDayStart(now)
  // Start of the day after the "due soon" window (today + 7 days => boundary +8).
  const soonEndStart = istDayStart(
    new Date(now.getTime() + (DUE_SOON_DAYS + 1) * 86_400_000),
  )
  const outstanding = { $lt: ['$amountPaidPaise', '$dueAmountPaise'] }

  switch (status) {
    case 'paid':
      return { $gte: ['$amountPaidPaise', '$dueAmountPaise'] }
    case 'unpaid':
      // Outstanding, with more than the "due soon" window left before the due date.
      return {
        $and: [outstanding, { $gte: ['$dueDate', soonEndStart] }],
      }
    case 'due_soon':
      return {
        $and: [
          outstanding,
          { $gte: ['$dueDate', todayStart] },
          { $lt: ['$dueDate', soonEndStart] },
        ],
      }
    case 'overdue':
    default:
      return {
        $and: [outstanding, { $lt: ['$dueDate', todayStart] }],
      }
  }
}
