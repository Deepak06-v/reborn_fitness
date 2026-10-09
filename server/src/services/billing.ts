import { Member } from '../models/Member'
import { MonthlyPayment } from '../models/MonthlyPayment'
import { monthEndExclusive } from '../utils/month'

export interface GenerateDuesInput {
  billingMonth: string
  dueDate: Date
}

/**
 * Billing policy (documented, not prorated):
 * - A member is billable for a month if they are ACTIVE and their joining date
 *   falls strictly before the first instant of the following month (i.e. they
 *   joined on or before the billing period). Partial months are billed at the
 *   full monthly fee — no proration.
 * - Archived/inactive members are never billed.
 * - The due amount is snapshotted from the member's current monthly fee at
 *   generation time, so later fee changes never rewrite historical bills.
 */
export async function generateMonthlyDues({
  billingMonth,
  dueDate,
}: GenerateDuesInput): Promise<{
  billingMonth: string
  dueDate: string
  eligible: number
  created: number
  existing: number
}> {
  const periodEnd = monthEndExclusive(billingMonth)
  const eligible = await Member.find({
    status: 'active',
    joiningDate: { $lt: periodEnd },
  }).select('_id memberId monthlyFeePaise')

  if (!eligible.length) {
    return { billingMonth, dueDate: dueDate.toISOString(), eligible: 0, created: 0, existing: 0 }
  }

  const result = await MonthlyPayment.bulkWrite(
    eligible.map((member) => ({
      updateOne: {
        filter: { member: member._id, billingMonth },
        update: {
          $setOnInsert: {
            member: member._id,
            memberId: member.memberId,
            billingMonth,
            dueAmountPaise: member.monthlyFeePaise,
            amountPaidPaise: 0,
            dueDate,
            status: 'unpaid',
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  )

  const created = result.upsertedCount
  return {
    billingMonth,
    dueDate: dueDate.toISOString(),
    eligible: eligible.length,
    created,
    existing: eligible.length - created,
  }
}
