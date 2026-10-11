import { Member, type MemberDoc } from '../models/Member'
import { MonthlyPayment, type MonthlyPaymentDoc } from '../models/MonthlyPayment'
import { nextSequence } from '../models/Counter'
import { getPlan } from '../config/plans'
import { env } from '../config/env'
import {
  addMonthsAnchored,
  addMonthsClamped,
  currentMonth,
  istDayOfMonth,
  monthStart,
} from '../utils/month'

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

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  )
}

/** The inclusive start of a billing record (falls back to its start month). */
function periodStartOf(payment: MonthlyPaymentDoc): Date {
  return payment.periodStart ?? monthStart(payment.billingMonth)
}

/** Safety valve so a pathological joining date can never loop unbounded. */
const MAX_PERIODS_PER_RECONCILE = 240

/**
 * Minimum gap between opportunistic reconciliations triggered by reads. The
 * scheduler forces its own runs; this only throttles the belt-and-braces pass
 * performed while serving requests. Disabled in tests so behaviour is
 * deterministic.
 */
const RECONCILE_MIN_INTERVAL_MS = env.isTest ? 0 : 5 * 60 * 1000

export interface ReconcileResult {
  members: number
  created: number
  skipped: boolean
}

let reconcileInFlight: Promise<ReconcileResult> | null = null
let lastReconcileAt = 0

/**
 * Brings one member's billing periods up to the present.
 *
 * - If the member has no bill yet, the initial period (joining date + plan) is
 *   created first.
 * - Otherwise the series is chained forward from the latest period using the
 *   member's joining day as the anchor, so short months never drift the cycle.
 * - A new period is only created once its start is on or before `now`; future
 *   periods are never pre-generated (the next start is stored on the member).
 * - Each period snapshots the plan at creation time, so a later plan change
 *   bills from the next period onward and never rewrites issued bills.
 * - Idempotent and concurrency-safe: the unique (member, billingMonth) index
 *   makes duplicate creation impossible, and a duplicate insert simply resumes
 *   from the stored record.
 * - Inactive members keep their existing history but are not billed further.
 */
export async function reconcileMemberBilling(
  member: MemberDoc,
  now: Date = new Date(),
): Promise<{ created: number }> {
  const planInfo = planForMember(member)
  const anchorDay = istDayOfMonth(member.joiningDate)

  let latest: MonthlyPaymentDoc | null = await MonthlyPayment.findOne({
    member: member._id,
  }).sort({
    periodStart: -1,
    billingMonth: -1,
  })
  if (!latest) latest = await createInitialPeriod(member)

  let created = 0
  let cursorStart = periodStartOf(latest)
  let cursorDuration = latest.durationMonths ?? planInfo.durationMonths
  let nextStart = addMonthsAnchored(cursorStart, cursorDuration, anchorDay)

  if (member.status === 'active') {
    let guard = 0
    while (nextStart.getTime() <= now.getTime() && guard < MAX_PERIODS_PER_RECONCILE) {
      guard += 1
      const duration = planInfo.durationMonths
      const nextEnd = addMonthsAnchored(nextStart, duration, anchorDay)
      const billingMonth = currentMonth(nextStart)
      try {
        await MonthlyPayment.create({
          member: member._id,
          memberId: member.memberId,
          billingMonth,
          invoiceNumber: await assignInvoiceNumber(),
          planId: planInfo.planId,
          planName: planInfo.planName,
          durationMonths: duration,
          planPricePaise: planInfo.planPricePaise,
          periodStart: nextStart,
          periodEnd: nextEnd,
          dueDate: nextStart,
          dueAmountPaise: planInfo.dueAmountPaise,
          amountPaidPaise: 0,
          status: 'unpaid',
        })
        created += 1
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          // A concurrent run already created this period — resume from it.
          const existing = await MonthlyPayment.findOne({
            member: member._id,
            billingMonth,
          })
          if (!existing) throw error
          cursorStart = periodStartOf(existing)
          cursorDuration = existing.durationMonths ?? duration
          nextStart = addMonthsAnchored(cursorStart, cursorDuration, anchorDay)
          continue
        }
        throw error
      }
      cursorStart = nextStart
      cursorDuration = duration
      nextStart = nextEnd
    }
  }

  if (!member.nextBillingDate || member.nextBillingDate.getTime() !== nextStart.getTime()) {
    member.nextBillingDate = nextStart
    await member.save()
  }
  return { created }
}

/**
 * Reconciles every active member. Concurrent callers share a single in-flight
 * run (a mutex), and opportunistic runs are throttled so frequent reads do not
 * repeat the work; `force` bypasses the throttle for the scheduler and boot.
 */
export async function reconcileAllBilling(
  now: Date = new Date(),
  options: { force?: boolean } = {},
): Promise<ReconcileResult> {
  if (reconcileInFlight) return reconcileInFlight
  if (!options.force && Date.now() - lastReconcileAt < RECONCILE_MIN_INTERVAL_MS) {
    return { members: 0, created: 0, skipped: true }
  }

  const run = (async (): Promise<ReconcileResult> => {
    try {
      const members = await Member.find({ status: 'active' })
      let created = 0
      for (const member of members) {
        created += (await reconcileMemberBilling(member, now)).created
      }
      lastReconcileAt = Date.now()
      return { members: members.length, created, skipped: false }
    } finally {
      reconcileInFlight = null
    }
  })()

  reconcileInFlight = run
  return run
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null

/**
 * Starts the in-process recurring billing job. Runs on the API host (Render),
 * which is where the billing data lives; disabled under test.
 */
export function startBillingScheduler(): void {
  if (env.isTest || schedulerTimer) return
  const intervalMs = env.billingReconcileIntervalMinutes * 60_000
  schedulerTimer = setInterval(() => {
    reconcileAllBilling(new Date(), { force: true }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[billing] scheduled reconciliation failed:', error)
    })
  }, intervalMs)
  if (typeof schedulerTimer.unref === 'function') schedulerTimer.unref()
}

export function stopBillingScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}
