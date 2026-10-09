import { Member } from '../models/Member'
import { MonthlyPayment } from '../models/MonthlyPayment'
import { lastNMonths, monthEndExclusive, monthRange, monthStart } from '../utils/month'
import { deriveStatus, type PaymentStatus } from '../utils/paymentStatus'
import { paiseToRupees } from '../utils/money'
import { serializeMember } from './serializers'

interface SumResult {
  _id: null
  total: number
  count: number
}

async function sumDueForMonth(month: string): Promise<SumResult> {
  const result = await MonthlyPayment.aggregate<SumResult>([
    { $match: { billingMonth: month } },
    { $group: { _id: null, total: { $sum: '$dueAmountPaise' }, count: { $sum: 1 } } },
  ])
  return result[0] ?? { _id: null, total: 0, count: 0 }
}

async function sumCollectedInMonth(month: string): Promise<SumResult> {
  const { start, end } = monthRange(month)
  const result = await MonthlyPayment.aggregate<SumResult>([
    { $unwind: '$paymentEntries' },
    {
      $match: {
        'paymentEntries.voided': false,
        'paymentEntries.paymentDate': { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$paymentEntries.amountPaise' },
        count: { $sum: 1 },
      },
    },
  ])
  return result[0] ?? { _id: null, total: 0, count: 0 }
}

async function sumOutstandingForMonth(month: string): Promise<SumResult> {
  const result = await MonthlyPayment.aggregate<SumResult>([
    { $match: { billingMonth: month } },
    {
      $project: { balance: { $subtract: ['$dueAmountPaise', '$amountPaidPaise'] } },
    },
    { $match: { balance: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } },
  ])
  return result[0] ?? { _id: null, total: 0, count: 0 }
}

async function sumOverdue(month: string, now: Date): Promise<SumResult> {
  const result = await MonthlyPayment.aggregate<SumResult>([
    { $match: { billingMonth: { $lte: month }, dueDate: { $lt: now } } },
    {
      $project: { balance: { $subtract: ['$dueAmountPaise', '$amountPaidPaise'] } },
    },
    { $match: { balance: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } },
  ])
  return result[0] ?? { _id: null, total: 0, count: 0 }
}

async function monthStatusOverview(month: string, now: Date) {
  const payments = await MonthlyPayment.find({ billingMonth: month }).select(
    'dueAmountPaise amountPaidPaise dueDate',
  )
  const counts: Record<PaymentStatus, number> = {
    paid: 0,
    unpaid: 0,
    partial: 0,
    overdue: 0,
  }
  for (const payment of payments) {
    const status = deriveStatus(
      payment.dueAmountPaise,
      payment.amountPaidPaise,
      payment.dueDate,
      now,
    )
    counts[status] += 1
  }
  return counts
}

async function recentPayments(limit = 8) {
  const rows = await MonthlyPayment.aggregate([
    { $unwind: '$paymentEntries' },
    { $match: { 'paymentEntries.voided': false } },
    { $sort: { 'paymentEntries.paymentDate': -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'members',
        localField: 'member',
        foreignField: '_id',
        as: 'memberDoc',
      },
    },
    { $unwind: { path: '$memberDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        paymentId: { $toString: '$_id' },
        memberName: '$memberDoc.fullName',
        memberId: '$memberId',
        amountPaise: '$paymentEntries.amountPaise',
        paymentDate: '$paymentEntries.paymentDate',
        method: '$paymentEntries.method',
        billingMonth: 1,
      },
    },
  ])
  return rows.map((row) => ({
    paymentId: row.paymentId as string,
    memberName: (row.memberName as string) ?? 'Unknown member',
    memberId: row.memberId as string,
    amountPaise: row.amountPaise as number,
    amount: paiseToRupees(row.amountPaise as number),
    paymentDate: (row.paymentDate as Date).toISOString(),
    method: row.method as string,
    billingMonth: row.billingMonth as string,
  }))
}

async function monthlyTrend(month: string) {
  const months = lastNMonths(month, 6)
  const windowStart = monthStart(months[0])
  const windowEnd = monthEndExclusive(month)

  const [expectedRows, collectedRows] = await Promise.all([
    MonthlyPayment.aggregate<{ _id: string; expected: number; outstanding: number }>([
      { $match: { billingMonth: { $in: months } } },
      {
        $project: {
          billingMonth: 1,
          dueAmountPaise: 1,
          balance: { $subtract: ['$dueAmountPaise', '$amountPaidPaise'] },
        },
      },
      {
        $group: {
          _id: '$billingMonth',
          expected: { $sum: '$dueAmountPaise' },
          outstanding: {
            $sum: { $cond: [{ $gt: ['$balance', 0] }, '$balance', 0] },
          },
        },
      },
    ]),
    MonthlyPayment.aggregate<{ _id: string; collected: number }>([
      { $unwind: '$paymentEntries' },
      {
        $match: {
          'paymentEntries.voided': false,
          'paymentEntries.paymentDate': { $gte: windowStart, $lt: windowEnd },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: '$paymentEntries.paymentDate',
              format: '%Y-%m',
              timezone: 'Asia/Kolkata',
            },
          },
          collected: { $sum: '$paymentEntries.amountPaise' },
        },
      },
    ]),
  ])

  const expectedBy = new Map(expectedRows.map((row) => [row._id, row]))
  const collectedBy = new Map(collectedRows.map((row) => [row._id, row.collected]))

  return months.map((entry) => {
    const expected = expectedBy.get(entry)?.expected ?? 0
    const outstanding = expectedBy.get(entry)?.outstanding ?? 0
    const collected = collectedBy.get(entry) ?? 0
    return {
      month: entry,
      expectedPaise: expected,
      expected: paiseToRupees(expected),
      collectedPaise: collected,
      collected: paiseToRupees(collected),
      outstandingPaise: outstanding,
      outstanding: paiseToRupees(outstanding),
    }
  })
}

async function overdueMembers(month: string, now: Date) {
  const rows = await MonthlyPayment.aggregate([
    { $match: { billingMonth: { $lte: month }, dueDate: { $lt: now } } },
    {
      $project: {
        member: 1,
        balance: { $subtract: ['$dueAmountPaise', '$amountPaidPaise'] },
        dueDate: 1,
        billingMonth: 1,
      },
    },
    { $match: { balance: { $gt: 0 } } },
    {
      $group: {
        _id: '$member',
        balance: { $sum: '$balance' },
        months: { $sum: 1 },
        oldestDue: { $min: '$dueDate' },
      },
    },
    { $sort: { balance: -1 } },
    { $limit: 10 },
    {
      $lookup: { from: 'members', localField: '_id', foreignField: '_id', as: 'memberDoc' },
    },
    { $unwind: { path: '$memberDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        memberId: { $toString: '$_id' },
        memberRef: '$memberDoc.memberId',
        fullName: '$memberDoc.fullName',
        phone: '$memberDoc.phone',
        balance: 1,
        months: 1,
        oldestDue: 1,
      },
    },
  ])
  return rows.map((row) => ({
    id: row.memberId as string,
    memberId: row.memberRef as string,
    fullName: (row.fullName as string) ?? 'Unknown member',
    phone: row.phone as string,
    balancePaise: row.balance as number,
    balance: paiseToRupees(row.balance as number),
    months: row.months as number,
    oldestDue: (row.oldestDue as Date).toISOString(),
  }))
}

export async function getDashboard(month: string) {
  const now = new Date()
  const { start, end } = monthRange(month)

  const [
    activeMembers,
    newMembersThisMonth,
    expected,
    collected,
    outstanding,
    overdue,
    statusOverview,
    recent,
    payments,
    trend,
    overdueList,
  ] = await Promise.all([
    Member.countDocuments({ status: 'active' }),
    Member.countDocuments({ joiningDate: { $gte: start, $lt: end } }),
    sumDueForMonth(month),
    sumCollectedInMonth(month),
    sumOutstandingForMonth(month),
    sumOverdue(month, now),
    monthStatusOverview(month, now),
    Member.find().sort({ createdAt: -1 }).limit(5),
    recentPayments(8),
    monthlyTrend(month),
    overdueMembers(month, now),
  ])

  return {
    month,
    metrics: {
      totalActiveMembers: activeMembers,
      newMembersThisMonth,
      collectionsThisMonthPaise: collected.total,
      collectionsThisMonth: paiseToRupees(collected.total),
      collectionsCount: collected.count,
      expectedMonthlyFeesPaise: expected.total,
      expectedMonthlyFees: paiseToRupees(expected.total),
      expectedCount: expected.count,
      outstandingPaymentsPaise: outstanding.total,
      outstandingPayments: paiseToRupees(outstanding.total),
      outstandingCount: outstanding.count,
      overduePaymentsPaise: overdue.total,
      overduePayments: paiseToRupees(overdue.total),
      overdueCount: overdue.count,
    },
    statusOverview,
    recentMembers: recent.map((member) => serializeMember(member)),
    recentPayments: payments,
    monthlyTrend: trend,
    overdueMembers: overdueList,
  }
}
