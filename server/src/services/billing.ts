import { Member, type MemberDoc } from '../models/Member'
import { MonthlyPayment, type MonthlyPaymentDoc } from '../models/MonthlyPayment'
import { nextSequence } from '../models/Counter'
import { getPlan } from '../config/plans'
import { addMonthsClamped, currentMonth, monthEndExclusive, monthStart } from '../utils/month'

const INVOICE_PREFIX = 'RBF-INV'

/** Atomically allocates the next human-facing invoice number. */
export async function assignInvoiceNumber(): Promise<string> {
  const sequence = await nextSequence('invoice')
  return `${INVOICE_PREFIX}-${String(sequence).padStart(4, '0')}`
}

interface PeriodPlan {
  planId: string | null
  planName: string | null
  durationMonths: number
  /** Period price in paise; null means "use the member's own monthly fee". */
  planPricePaise: number | null
  dueAmountPaise: number
}

function planForMember(member: MemberDoc): PeriodPlan {
  const plan = getPlan(member.planId)
  if (plan) {
    return {
      planId: plan.id,
      planName: plan.name,
      durationMonths: plan.durationMonths,
      planPricePaise: plan.pricePaise,
      dueAmountPaise: plan.pricePaise,
    }
  }
  return {
    planId: null,
    planName: null,
    durationMonths: 1,
    planPricePaise: null,
    dueAmountPaise: member.monthlyFeePaise,
  }
}

/**
 * Creates the very first billing period for a freshly created member.
 *
 * The period starts on the joining date and runs for the plan duration; the
 * due date defaults to the period start (prepaid membership). Idempotent: if a
 * bill already exists for the member's joining month it is returned untouched,
 * so retries and duplicate calls never double-bill.
 */
export async function createInitialPeriod(member: MemberDoc): Promise<MonthlyPaymentDoc> {
  const billingMonth = currentMonth(member.joiningDate)
  const existing = await MonthlyPayment.findOne({ member: member._id, billingMonth })
  if (existing) {
    if (existing.periodEnd) member.nextBillingDate = existing.periodEnd
    return existing
  }

  const planInfo = planForMember(member)
  const periodStart = member.joiningDate
  const periodEnd = addMonthsClamped(periodStart, planInfo.durationMonths)

  try {
    return await MonthlyPayment.create({
      member: member._id,
      memberId: member.memberId,
      billingMonth,
      invoiceNumber: await assignInvoiceNumber(),
      planId: planInfo.planId,
      planName: planInfo.planName,
      durationMonths: planInfo.durationMonths,
      planPricePaise: planInfo.planPricePaise,
      periodStart,
      periodEnd,
      dueDate: periodStart,
      dueAmountPaise: planInfo.dueAmountPaise,
      amountPaidPaise: 0,
      status: 'unpaid',
    })
  } catch (error) {
    // A concurrent insert already created it — fall back to the stored record.
    if (isDuplicateKeyError(error)) {
      const raced = await MonthlyPayment.findOne({ member: member._id, billingMonth })
      if (raced) return raced
    }
    throw error
  }
}

export interface GenerateDuesInput {
  billingMonth: string
  dueDate: Date
}

export interface GenerateDuesResult {
  billingMonth: string
  dueDate: string
  eligible: number
  created: number
  existing: number
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  )
}

/**
 * Generates the next billing period's bill for every eligible active member.
 *
 * Policy (documented, not prorated):
 * - A member is billable for a month if they are ACTIVE and their joining date
 *   is strictly before the first instant of the following month.
 * - For members on a plan, a new bill is created only once their next period
 *   start falls on or before the requested month (monthly plans advance one
 *   month at a time; multi-month plans advance by their whole duration). This
 *   makes repeated calls within the same month a no-op — the next period start
 *   has already moved past the requested month.
 * - Legacy members without a plan keep the original behaviour: one full-fee
 *   bill per requested month.
 * - The amount is snapshotted from the plan catalogue at generation time, so a
 *   later price change never rewrites an already-issued bill.
 * - Duplicate bills are impossible: a unique (member, billingMonth) index backs
 *   the server-side existence check.
 */
export async function generateMonthlyDues({
  billingMonth,
  dueDate,
}: GenerateDuesInput): Promise<GenerateDuesResult> {
  const periodEnd = monthEndExclusive(billingMonth)
  const eligibleMembers = await Member.find({
    status: 'active',
    joiningDate: { $lt: periodEnd },
  })

  if (!eligibleMembers.length) {
    return {
      billingMonth,
      dueDate: dueDate.toISOString(),
      eligible: 0,
      created: 0,
      existing: 0,
    }
  }

  let created = 0
  let existing = 0

  for (const member of eligibleMembers) {
    const planInfo = planForMember(member)
    const isPlanMember = planInfo.planId !== null

    let periodStart: Date
    if (isPlanMember) {
      const latest = await MonthlyPayment.findOne({ member: member._id }).sort({
        periodStart: -1,
        billingMonth: -1,
      })
      periodStart = latest?.periodEnd ?? member.joiningDate
      // Not due yet: the next period starts after the requested month.
      if (currentMonth(periodStart) > billingMonth) {
        synchronizeNextBilling(member, latest)
        await member.save()
        existing += 1
        continue
      }
    } else {
      periodStart = monthStart(billingMonth)
    }

    const startMonth = currentMonth(periodStart)
    const alreadyBilled = await MonthlyPayment.findOne({
      member: member._id,
      billingMonth: startMonth,
    })
    if (alreadyBilled) {
      synchronizeNextBilling(member, alreadyBilled)
      await member.save()
      existing += 1
      continue
    }

    const periodEndDate = addMonthsClamped(periodStart, planInfo.durationMonths)
    // For on-schedule plan periods keep the admin-chosen due date editable;
    // catch-up periods fall back to their own start date.
    const effectiveDueDate =
      isPlanMember && startMonth !== billingMonth ? periodStart : dueDate

    try {
      await MonthlyPayment.create({
        member: member._id,
        memberId: member.memberId,
        billingMonth: startMonth,
        invoiceNumber: await assignInvoiceNumber(),
        planId: planInfo.planId,
        planName: planInfo.planName,
        durationMonths: planInfo.durationMonths,
        planPricePaise: planInfo.planPricePaise,
        periodStart,
        periodEnd: periodEndDate,
        dueDate: effectiveDueDate,
        dueAmountPaise: planInfo.dueAmountPaise,
        amountPaidPaise: 0,
        status: 'unpaid',
      })
      member.nextBillingDate = periodEndDate
      await member.save()
      created += 1
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        existing += 1
        continue
      }
      throw error
    }
  }

  return {
    billingMonth,
    dueDate: dueDate.toISOString(),
    eligible: eligibleMembers.length,
    created,
    existing,
  }
}

function synchronizeNextBilling(
  member: MemberDoc,
  latest: MonthlyPaymentDoc | null,
): void {
  if (latest?.periodEnd) member.nextBillingDate = latest.periodEnd
}
