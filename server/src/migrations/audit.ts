import { connectDatabase, disconnectDatabase } from '../config/db'
import { Member } from '../models/Member'
import { MonthlyPayment } from '../models/MonthlyPayment'
import { Admin } from '../models/Admin'
import { Counter } from '../models/Counter'

export interface ProductionAuditReport {
  timestamp: string
  connectionMode: 'READ_ONLY_AUDIT'
  counts: {
    totalMembers: number
    activeMembers: number
    inactiveMembers: number
    incompleteMembers: number
    totalPayments: number
    paymentsWithPeriodEnd: number
    paymentsMissingPeriodEnd: number
    totalAdmins: number
    activeAdmins: number
  }
  adminRolesSummary: Array<{
    role: string
    activeCount: number
    usernamesRedactedCount: number
  }>
  dataIntegrityRisks: {
    missingJoiningDateCount: number
    missingPlanIdCount: number
    missingPhoneCount: number
    duplicatePhonesDetected: number
    membersWithoutAnyPayment: number
    duplicateInvoiceNumberCount: number
  }
  counterStatus: Array<{
    _id: string
    seq: number
  }>
}

/**
 * Executes a strictly read-only audit of the connected database.
 * No records are created, modified, or deleted.
 * Personal data (phone numbers, full names, passwords) are completely excluded.
 */
export async function runProductionAudit(): Promise<ProductionAuditReport> {
  const [
    totalMembers,
    activeMembers,
    inactiveMembers,
    incompleteMembers,
    missingJoiningDate,
    missingPlanId,
    missingPhone,
    totalPayments,
    paymentsWithPeriodEnd,
    paymentsMissingPeriodEnd,
    totalAdmins,
    activeAdmins,
    adminRolesGroup,
    phoneDuplicates,
    invoiceDuplicates,
    counters,
  ] = await Promise.all([
    Member.countDocuments({}),
    Member.countDocuments({ status: 'active' }),
    Member.countDocuments({ status: 'inactive' }),
    Member.countDocuments({
      $or: [{ joiningDate: null }, { planId: null }, { phone: null }],
    }),
    Member.countDocuments({ joiningDate: null }),
    Member.countDocuments({ planId: null }),
    Member.countDocuments({ phone: null }),
    MonthlyPayment.countDocuments({}),
    MonthlyPayment.countDocuments({ periodEnd: { $exists: true, $ne: null } }),
    MonthlyPayment.countDocuments({
      $or: [{ periodEnd: { $exists: false } }, { periodEnd: null }],
    }),
    Admin.countDocuments({}),
    Admin.countDocuments({ active: true }),
    Admin.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: ['$active', 1, 0] } },
        },
      },
    ]),
    Member.aggregate([
      { $match: { phone: { $exists: true, $ne: null } } },
      { $group: { _id: '$phone', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'duplicateCount' },
    ]),
    MonthlyPayment.aggregate([
      { $match: { invoiceNumber: { $exists: true, $ne: null } } },
      { $group: { _id: '$invoiceNumber', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'duplicateCount' },
    ]),
    Counter.find({}).lean(),
  ])

  // Count active members without any payment record
  const memberIdsWithPayments = await MonthlyPayment.distinct('member')
  const membersWithoutAnyPayment = await Member.countDocuments({
    status: 'active',
    _id: { $nin: memberIdsWithPayments },
  })

  return {
    timestamp: new Date().toISOString(),
    connectionMode: 'READ_ONLY_AUDIT',
    counts: {
      totalMembers,
      activeMembers,
      inactiveMembers,
      incompleteMembers,
      totalPayments,
      paymentsWithPeriodEnd,
      paymentsMissingPeriodEnd,
      totalAdmins,
      activeAdmins,
    },
    adminRolesSummary: adminRolesGroup.map((g) => ({
      role: g._id as string,
      activeCount: g.activeCount as number,
      usernamesRedactedCount: g.count as number,
    })),
    dataIntegrityRisks: {
      missingJoiningDateCount: missingJoiningDate,
      missingPlanIdCount: missingPlanId,
      missingPhoneCount: missingPhone,
      duplicatePhonesDetected: phoneDuplicates[0]?.duplicateCount ?? 0,
      membersWithoutAnyPayment,
      duplicateInvoiceNumberCount: invoiceDuplicates[0]?.duplicateCount ?? 0,
    },
    counterStatus: counters.map((c) => ({
      _id: String(c._id),
      seq: c.seq,
    })),
  }
}

async function main() {
  await connectDatabase()
  try {
    // eslint-disable-next-line no-console
    console.log('[audit] Running read-only production audit...')
    const report = await runProductionAudit()
    // eslint-disable-next-line no-console
    console.log('[audit] Report:\n', JSON.stringify(report, null, 2))
  } finally {
    await disconnectDatabase()
  }
  process.exit(0)
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[audit] Audit execution failed:', err)
    process.exit(1)
  })
}
