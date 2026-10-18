import { connectDatabase } from '../config/db'
import { Member } from '../models/Member'
import { MonthlyPayment } from '../models/MonthlyPayment'
import { addMonthsAnchored, istDayOfMonth, monthStart } from '../utils/month'

export interface MigrationSummary {
  dryRun: boolean
  totalMembers: number
  validMembers: number
  incompleteMembers: number
  totalPayments: number
  paymentsWithPeriodEnd: number
  paymentsMissingPeriodEnd: number
  backfilledPeriodEnd: number
}

/**
 * Idempotent, non-destructive database verification and backfill script.
 * In dry-run mode, it only inspects and reports findings without modifying any records.
 * In apply mode, it only fills in missing periodEnd fields for legacy billing rows.
 */
export async function runVerifyAndBackfill(apply = false): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    dryRun: !apply,
    totalMembers: 0,
    validMembers: 0,
    incompleteMembers: 0,
    totalPayments: 0,
    paymentsWithPeriodEnd: 0,
    paymentsMissingPeriodEnd: 0,
    backfilledPeriodEnd: 0,
  }

  const members = await Member.find({})
  summary.totalMembers = members.length

  const memberAnchorMap = new Map<string, number>()
  for (const member of members) {
    const isComplete = Boolean(member.joiningDate && member.planId && member.phone)
    if (isComplete) {
      summary.validMembers += 1
      memberAnchorMap.set(member._id.toString(), istDayOfMonth(member.joiningDate))
    } else {
      summary.incompleteMembers += 1
    }
  }

  const payments = await MonthlyPayment.find({})
  summary.totalPayments = payments.length

  for (const payment of payments) {
    if (payment.periodEnd) {
      summary.paymentsWithPeriodEnd += 1
    } else {
      summary.paymentsMissingPeriodEnd += 1
      if (apply) {
        const anchorDay = memberAnchorMap.get(payment.member.toString()) ?? 1
        const start = payment.periodStart ?? monthStart(payment.billingMonth)
        const duration = payment.durationMonths ?? 1
        const calculatedEnd = addMonthsAnchored(start, duration, anchorDay)
        payment.periodEnd = calculatedEnd
        await payment.save()
        summary.backfilledPeriodEnd += 1
      }
    }
  }

  return summary
}

async function main() {
  const isApply = process.argv.includes('--apply')

  if (isApply) {
    const isAtlasOrProd =
      process.env.NODE_ENV === 'production' ||
      (process.env.MONGODB_URI && /mongodb\+srv|atlas/i.test(process.env.MONGODB_URI))

    if (isAtlasOrProd && process.env.ALLOW_PRODUCTION_MIGRATION !== 'true') {
      // eslint-disable-next-line no-console
      console.error(
        '\n[SAFETY ABORT] --apply requested against production / Atlas database without explicit approval.\n' +
          'To run database mutations against production, you must explicitly set:\n' +
          '  ALLOW_PRODUCTION_MIGRATION=true\n',
      )
      process.exit(1)
    }
  }

  await connectDatabase()
  // eslint-disable-next-line no-console
  console.log(`[migration] Starting verification ${isApply ? '(APPLY MODE)' : '(DRY RUN)'}...`)
  const result = await runVerifyAndBackfill(isApply)
  // eslint-disable-next-line no-console
  console.log('[migration] Verification summary:', JSON.stringify(result, null, 2))
  process.exit(0)
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[migration] Verification failed:', error)
    process.exit(1)
  })
}
