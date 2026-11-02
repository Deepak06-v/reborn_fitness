import { Member } from '../models/Member'
import { MonthlyPayment } from '../models/MonthlyPayment'
import {
  addDays,
  istDayStart,
  lastNMonths,
  monthEndExclusive,
  monthRange,
  monthStart,
} from '../utils/month'
import { deriveStatus, type PaymentStatus } from '../utils/paymentStatus'
import { paiseToRupees } from '../utils/money'
import { reconcileAllBilling } from './billing'
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
        'paymentEntries.method': { $ne: 'auto_registration' },
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
  const todayStart = istDayStart(now)
  const targetEnd = '$dueDate'
  const result = await MonthlyPayment.aggregate<SumResult>([
    {
      $match: {
        billingMonth: { $lte: month },
        $expr: {
          $and: [
            { $lt: ['$amountPaidPaise', '$dueAmountPaise'] },
            { $lt: [targetEnd, todayStart] },
          ],
        },
      },
    },
    {
      $project: { balance: { $subtract: ['$dueAmountPaise', '$amountPaidPaise'] } },
    },
    { $match: { balance: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } },
  ])
  return result[0] ?? { _id: null, total: 0, count: 0 }
}

async function sumDueToday(month: string, now: Date): Promise<SumResult> {
  const todayStart = istDayStart(now)
  const tomorrowStart = addDays(now, 1)
  const targetEnd = '$dueDate'
  const result = await MonthlyPayment.aggregate<SumResult>([
    {
      $match: {
        billingMonth: { $lte: month },
        $expr: {
          $and: [
            { $lt: ['$amountPaidPaise', '$dueAmountPaise'] },
            { $gte: [targetEnd, todayStart] },
            { $lt: [targetEnd, tomorrowStart] },
          ],
        },
      },
    },
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
          'paymentEntries.method': { $ne: 'auto_registration' },
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

export interface FollowUpMember {
  id: string
  memberId: string
  fullName: string
  phone: string
  planName: string
  balancePaise: number
  balance: number
  months: number
  oldestDue: string
  dueDate: string
  paymentId: string
  status: 'overdue' | 'due_today'
  statusLabel: 'Overdue' | 'Due Today'
}

export async function getFollowUpMembers(month: string, now: Date): Promise<FollowUpMember[]> {
  const todayStart = istDayStart(now)
  const tomorrowStart = addDays(now, 1)

  const rows = await MonthlyPayment.aggregate([
    {
      $match: {
        billingMonth: { $lte: month },
        $expr: {
          $and: [
            { $lt: ['$amountPaidPaise', '$dueAmountPaise'] },
            { $lt: ['$dueDate', tomorrowStart] },
          ],
        },
      },
    },
    {
      $project: {
        member: 1,
        balance: { $subtract: ['$dueAmountPaise', '$amountPaidPaise'] },
        effectiveDue: '$dueDate',
        billingMonth: 1,
        planName: 1,
      },
    },
    { $match: { balance: { $gt: 0 } } },
    { $sort: { effectiveDue: 1, _id: 1 } },
    {
      $group: {
        _id: '$member',
        balance: { $sum: '$balance' },
        months: { $sum: 1 },
        oldestDue: { $first: '$effectiveDue' },
        planName: { $first: '$planName' },
        paymentId: { $first: '$_id' },
        hasOverdue: {
          $max: {
            $cond: [{ $lt: ['$effectiveDue', todayStart] }, 1, 0],
          },
        },
      },
    },
    {
      $lookup: { from: 'members', localField: '_id', foreignField: '_id', as: 'memberDoc' },
    },
    { $unwind: { path: '$memberDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        id: { $toString: '$_id' },
        memberId: { $toString: '$_id' },
        memberRef: '$memberDoc.memberId',
        fullName: '$memberDoc.fullName',
        phone: '$memberDoc.phone',
        planName: { $ifNull: ['$planName', '$memberDoc.planName'] },
        balancePaise: '$balance',
        months: 1,
        oldestDue: 1,
        paymentId: { $toString: '$paymentId' },
        hasOverdue: 1,
      },
    },
    { $sort: { hasOverdue: -1, balancePaise: -1, oldestDue: 1 } },
  ])

  return rows.map((row) => {
    const isOverdue = row.hasOverdue === 1
    const status: 'overdue' | 'due_today' = isOverdue ? 'overdue' : 'due_today'
    const statusLabel: 'Overdue' | 'Due Today' = isOverdue ? 'Overdue' : 'Due Today'
    const oldestDueIso = (row.oldestDue as Date).toISOString()
    return {
      id: row.id as string,
      memberId: (row.memberRef as string) ?? (row.memberId as string),
      fullName: (row.fullName as string) ?? 'Unknown member',
      phone: (row.phone as string) ?? '',
      planName: (row.planName as string) ?? 'Membership',
      balancePaise: row.balancePaise as number,
      balance: paiseToRupees(row.balancePaise as number),
      months: row.months as number,
      oldestDue: oldestDueIso,
      dueDate: oldestDueIso,
      paymentId: row.paymentId as string,
      status,
      statusLabel,
    }
  })
}

export async function getDashboard(month: string) {
  await reconcileAllBilling()
  const now = new Date()
  const { start, end } = monthRange(month)

  const [
    activeMembers,
    newMembersThisMonth,
    expected,
    collected,
    outstanding,
    overdue,
    dueToday,
    statusOverview,
    recent,
    payments,
    trend,
    followUpList,
  ] = await Promise.all([
    Member.countDocuments({ status: 'active' }),
    Member.countDocuments({ joiningDate: { $gte: start, $lt: end } }),
    sumDueForMonth(month),
    sumCollectedInMonth(month),
    sumOutstandingForMonth(month),
    sumOverdue(month, now),
    sumDueToday(month, now),
    monthStatusOverview(month, now),
    Member.find().sort({ createdAt: -1 }).limit(5),
    recentPayments(8),
    monthlyTrend(month),
    getFollowUpMembers(month, now),
  ])

  const overdueList = followUpList.filter((m) => m.status === 'overdue')
  const dueTodayList = followUpList.filter((m) => m.status === 'due_today')

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
      dueTodayPaymentsPaise: dueToday.total,
      dueTodayPayments: paiseToRupees(dueToday.total),
      dueTodayCount: dueToday.count,
    },
    statusOverview,
    recentMembers: recent.map((member) => serializeMember(member)),
    recentPayments: payments,
    monthlyTrend: trend,
    overdueMembers: overdueList,
    dueTodayMembers: dueTodayList,
    paymentFollowUp: followUpList,
    followUpCounts: {
      overdue: overdueList.length,
      dueToday: dueTodayList.length,
      total: followUpList.length,
    },
  }
}
