import type { PaymentFilterStatus } from './paymentStatus'
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
  status: PaymentFilterStatus | string,
  now: Date,
): Record<string, unknown> {
  const targetField = '$dueDate'
  const todayStart = istDayStart(now)
  // End of day +2 (start of day +3): covers today (0), +1, +2 days
  const urgentEndStart = istDayStart(new Date(now.getTime() + 3 * 86_400_000))
  // End of day +7 (start of day +8): covers +3 through +7 days
  const weekEndStart = istDayStart(new Date(now.getTime() + 8 * 86_400_000))
  const outstanding = { $lt: ['$amountPaidPaise', '$dueAmountPaise'] }

  switch (status) {
    case 'paid':
      return { $gte: ['$amountPaidPaise', '$dueAmountPaise'] }
    case 'unpaid':
      return outstanding
    case 'urgent':
      return {
        $and: [outstanding, { $lt: [targetField, urgentEndStart] }],
      }
    case 'this_week':
      return {
        $and: [
          outstanding,
          { $gte: [targetField, urgentEndStart] },
          { $lt: [targetField, weekEndStart] },
        ],
      }
    case 'due_soon':
      return {
        $and: [
          outstanding,
          { $gte: [targetField, todayStart] },
          { $lt: [targetField, weekEndStart] },
        ],
      }
    case 'overdue':
      return {
        $and: [outstanding, { $lt: [targetField, todayStart] }],
      }
    default:
      return {}
  }
}
