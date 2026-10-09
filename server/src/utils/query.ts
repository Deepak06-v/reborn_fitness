import type { PaymentStatus } from './paymentStatus'

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Builds an aggregation-expression ($expr) that matches a monthly payment
 * document for a derived payment status. Overdue is computed from the due date
 * and outstanding balance rather than the stored (time-independent) status.
 */
export function paymentStatusExpr(
  status: PaymentStatus,
  now: Date,
): Record<string, unknown> {
  switch (status) {
    case 'paid':
      return { $gte: ['$amountPaidPaise', '$dueAmountPaise'] }
    case 'unpaid':
      return { $eq: ['$amountPaidPaise', 0] }
    case 'partial':
      return {
        $and: [
          { $gt: ['$amountPaidPaise', 0] },
          { $lt: ['$amountPaidPaise', '$dueAmountPaise'] },
        ],
      }
    case 'overdue':
    default:
      return {
        $and: [
          { $lt: ['$amountPaidPaise', '$dueAmountPaise'] },
          { $lt: ['$dueDate', now] },
        ],
      }
  }
}
