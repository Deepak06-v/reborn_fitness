import { Types, type FilterQuery, type PipelineStage } from 'mongoose'
import { Admin } from '../models/Admin'
import { Member } from '../models/Member'
import { MonthlyPayment, type MonthlyPaymentDoc, type PaymentMethod } from '../models/MonthlyPayment'
import { ApiError } from '../utils/errors'
import { paiseToRupees } from '../utils/money'
import { formatDDMMYYYY, istDayStart } from '../utils/month'
import {
  deriveBaseStatus,
  evaluatePaymentStatus,
  outstandingBalance,
  type PaymentFilterStatus,
} from '../utils/paymentStatus'
import { escapeRegex, paymentStatusExpr } from '../utils/query'
import { reconcileAllBilling } from './billing'
import { serializeMember, serializePayment } from './serializers'

export async function getPaymentDetail(id: string) {
  await reconcileAllBilling()
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Billing record not found')
  const payment = await MonthlyPayment.findById(id)
  if (!payment) throw ApiError.notFound('Billing record not found')

  const member = await Member.findById(payment.member)
  const adminIds = new Set<string>()
  for (const entry of payment.paymentEntries) {
    if (entry.recordedBy) adminIds.add(entry.recordedBy.toString())
    if (entry.voidedBy) adminIds.add(entry.voidedBy.toString())
  }
  const admins = await Admin.find({ _id: { $in: [...adminIds] } }).select('username')
  const adminNames = new Map(admins.map((admin) => [admin._id.toString(), admin.username]))

  return {
    payment: serializePayment(payment, adminNames),
    member: member ? serializeMember(member) : null,
  }
}

export interface ListPaymentsParams {
  month?: string
  search?: string
  status?: PaymentFilterStatus
  page: number
  limit: number
}

export async function listPayments(params: ListPaymentsParams) {
  await reconcileAllBilling()
  const now = new Date()

  // Absent month => every billing period (the combined view); present => scoped.
  const baseMatch: FilterQuery<MonthlyPaymentDoc> = {}
  if (params.month) baseMatch.billingMonth = params.month
  if (params.search) {
    const rx = new RegExp(escapeRegex(params.search.trim()), 'i')
    const members = await Member.find({
      $or: [{ fullName: rx }, { memberId: rx }, { phone: rx }],
    }).select('_id')
    baseMatch.member = { $in: members.map((member) => member._id) }
  }

  const query: FilterQuery<MonthlyPaymentDoc> = { ...baseMatch }
  if (params.status && params.status !== 'all') {
    query.$expr = paymentStatusExpr(params.status, now)
  }

  const urgentEndStart = istDayStart(new Date(now.getTime() + 3 * 86_400_000))
  const weekEndStart = istDayStart(new Date(now.getTime() + 8 * 86_400_000))
  const targetEnd = { $ifNull: ['$periodEnd', '$dueDate'] }

  const page = Math.max(params.page, 1)
  const limit = Math.min(Math.max(params.limit, 1), 200)

  const pipeline: PipelineStage[] = [
    { $match: query },
    {
      $addFields: {
        effectiveEnd: targetEnd,
        sortGroup: {
          $cond: [
            { $gte: ['$amountPaidPaise', '$dueAmountPaise'] },
            4,
            {
              $cond: [
                { $lt: [targetEnd, urgentEndStart] },
                1,
                {
                  $cond: [
                    { $lt: [targetEnd, weekEndStart] },
                    2,
                    3,
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    { $sort: { sortGroup: 1 as const, effectiveEnd: 1 as const, memberId: 1 as const } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
  ]

  const summaryPipeline: unknown[] = [
    { $match: baseMatch },
    {
      $project: {
        due: '$dueAmountPaise',
        paid: '$amountPaidPaise',
        balance: { $subtract: ['$dueAmountPaise', '$amountPaidPaise'] },
        isPaid: { $gte: ['$amountPaidPaise', '$dueAmountPaise'] },
        isUrgent: {
          $and: [
            { $lt: ['$amountPaidPaise', '$dueAmountPaise'] },
            { $lt: [targetEnd, urgentEndStart] },
          ],
        },
        isThisWeek: {
          $and: [
            { $lt: ['$amountPaidPaise', '$dueAmountPaise'] },
            { $gte: [targetEnd, urgentEndStart] },
            { $lt: [targetEnd, weekEndStart] },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        due: { $sum: '$due' },
        paid: { $sum: '$paid' },
        remaining: { $sum: { $cond: [{ $gt: ['$balance', 0] }, '$balance', 0] } },
        paidCount: { $sum: { $cond: ['$isPaid', 1, 0] } },
        urgentCount: { $sum: { $cond: ['$isUrgent', 1, 0] } },
        thisWeekCount: { $sum: { $cond: ['$isThisWeek', 1, 0] } },
      },
    },
  ]

  const [total, rawDocs, totalsAgg] = await Promise.all([
    MonthlyPayment.countDocuments(query),
    MonthlyPayment.aggregate(pipeline as never[]),
    MonthlyPayment.aggregate<{
      _id: null
      due: number
      paid: number
      remaining: number
      paidCount: number
      urgentCount: number
      thisWeekCount: number
    }>(summaryPipeline as never[]),
  ])

  const docs = rawDocs.map((doc) => MonthlyPayment.hydrate(doc))
  const members = await Member.find({ _id: { $in: docs.map((doc) => doc.member) } })
  const memberMap = new Map(members.map((member) => [member._id.toString(), member]))

  const totals = totalsAgg[0] ?? {
    _id: null,
    due: 0,
    paid: 0,
    remaining: 0,
    paidCount: 0,
    urgentCount: 0,
    thisWeekCount: 0,
  }

  return {
    month: params.month ?? null,
    items: docs.map((doc) => {
      const member = memberMap.get(doc.member.toString())
      return {
        ...serializePayment(doc),
        memberName: member?.fullName ?? 'Unknown member',
        memberRef: member?.memberId ?? doc.memberId,
        phone: member?.phone ?? '',
      }
    }),
    total,
    page,
    limit,
    pages: Math.max(Math.ceil(total / limit), 1),
    totals: {
      billedPaise: totals.due,
      billed: paiseToRupees(totals.due),
      collectedPaise: totals.paid,
      collected: paiseToRupees(totals.paid),
      remainingPaise: totals.remaining,
      remaining: paiseToRupees(totals.remaining),
      paidCount: totals.paidCount,
      urgentCount: totals.urgentCount,
      thisWeekCount: totals.thisWeekCount,
    },
  }
}

export async function getPaymentsForExport(params: {
  month?: string
  search?: string
  status?: PaymentFilterStatus
}) {
  await reconcileAllBilling()
  const now = new Date()
  const query: FilterQuery<MonthlyPaymentDoc> = {}
  if (params.month) query.billingMonth = params.month
  if (params.search) {
    const rx = new RegExp(escapeRegex(params.search.trim()), 'i')
    const members = await Member.find({
      $or: [{ fullName: rx }, { memberId: rx }, { phone: rx }],
    }).select('_id')
    query.member = { $in: members.map((member) => member._id) }
  }
  if (params.status && params.status !== 'all') {
    query.$expr = paymentStatusExpr(params.status, now)
  }

  const urgentEndStart = istDayStart(new Date(now.getTime() + 3 * 86_400_000))
  const weekEndStart = istDayStart(new Date(now.getTime() + 8 * 86_400_000))
  const targetEnd = { $ifNull: ['$periodEnd', '$dueDate'] }

  const pipeline: PipelineStage[] = [
    { $match: query },
    {
      $addFields: {
        effectiveEnd: targetEnd,
        sortGroup: {
          $cond: [
            { $gte: ['$amountPaidPaise', '$dueAmountPaise'] },
            4,
            {
              $cond: [
                { $lt: [targetEnd, urgentEndStart] },
                1,
                {
                  $cond: [
                    { $lt: [targetEnd, weekEndStart] },
                    2,
                    3,
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    { $sort: { sortGroup: 1 as const, effectiveEnd: 1 as const, memberId: 1 as const } },
  ]

  const rawDocs = await MonthlyPayment.aggregate(pipeline)
  const docs = rawDocs.map((doc) => MonthlyPayment.hydrate(doc))
  const members = await Member.find({ _id: { $in: docs.map((doc) => doc.member) } })
  const memberMap = new Map(members.map((member) => [member._id.toString(), member]))

  return docs.map((doc) => {
    const member = memberMap.get(doc.member.toString())
    const balance = outstandingBalance(doc.dueAmountPaise, doc.amountPaidPaise)
    const effectiveEnd = doc.periodEnd ?? doc.dueDate
    const evalResult = evaluatePaymentStatus(
      doc.dueAmountPaise,
      doc.amountPaidPaise,
      effectiveEnd,
      now,
    )
    const lastEntry = [...doc.paymentEntries]
      .filter((entry) => !entry.voided)
      .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())[0]

    return {
      memberRef: member?.memberId ?? doc.memberId,
      fullName: member?.fullName ?? 'Unknown member',
      phone: member?.phone ?? '',
      planName: doc.planName ?? '',
      joiningDate: member?.joiningDate ? formatDDMMYYYY(member.joiningDate) : '',
      periodStart: doc.periodStart ? formatDDMMYYYY(doc.periodStart) : '',
      periodEnd: doc.periodEnd ? formatDDMMYYYY(doc.periodEnd) : '',
      dueDate: formatDDMMYYYY(doc.dueDate),
      invoiceNumber: doc.invoiceNumber ?? '',
      dueAmount: paiseToRupees(doc.dueAmountPaise),
      amountPaid: paiseToRupees(doc.amountPaidPaise),
      balance: paiseToRupees(balance),
      status: evalResult.label,
      lastPaymentDate: lastEntry ? formatDDMMYYYY(lastEntry.paymentDate) : '',
      lastPaymentMethod: lastEntry?.method ? lastEntry.method.toUpperCase().replace('_', ' ') : '',
    }
  })
}

export interface RecordPaymentInput {
  paymentId: string
  amountPaise: number
  paymentDate: Date
  method: PaymentMethod
  referenceNumber?: string | null
  notes?: string | null
  adminId: string
}

export async function recordPayment(
  input: RecordPaymentInput,
): Promise<MonthlyPaymentDoc> {
  if (!Types.ObjectId.isValid(input.paymentId)) {
    throw ApiError.notFound('Billing record not found')
  }

  // Optimistic concurrency: the update only applies if amountPaidPaise is
  // unchanged since it was read, preventing lost updates / overpayments.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const payment = await MonthlyPayment.findById(input.paymentId)
    if (!payment) throw ApiError.notFound('Billing record not found')

    const balance = outstandingBalance(payment.dueAmountPaise, payment.amountPaidPaise)
    if (balance <= 0) throw ApiError.conflict('This bill is already fully paid')
    if (input.amountPaise <= 0) {
      throw ApiError.unprocessable('Payment amount must be greater than zero')
    }
    if (input.amountPaise > balance) {
      throw ApiError.unprocessable(
        `Payment exceeds the outstanding balance of ${balance} paise`,
      )
    }

    const newPaid = payment.amountPaidPaise + input.amountPaise
    const result = await MonthlyPayment.updateOne(
      { _id: payment._id, amountPaidPaise: payment.amountPaidPaise },
      {
        $push: {
          paymentEntries: {
            amountPaise: input.amountPaise,
            paymentDate: input.paymentDate,
            method: input.method,
            referenceNumber: input.referenceNumber ?? null,
            notes: input.notes ?? null,
            recordedBy: new Types.ObjectId(input.adminId),
            recordedAt: new Date(),
            voided: false,
            voidedBy: null,
            voidedAt: null,
            voidReason: null,
          },
        },
        $inc: { amountPaidPaise: input.amountPaise },
      },
    )

    if (result.modifiedCount === 1) {
      const updated = await MonthlyPayment.findByIdAndUpdate(
        payment._id,
        { $set: { status: deriveBaseStatus(payment.dueAmountPaise, newPaid) } },
        { new: true },
      )
      if (updated) return updated
    }
  }

  throw ApiError.conflict('The billing record changed concurrently. Please retry.')
}

export interface CorrectPaymentInput {
  paymentId: string
  entryId: string
  reason: string
  adminId: string
  replacement?: {
    amountPaise: number
    paymentDate: Date
    method: PaymentMethod
    referenceNumber?: string | null
    notes?: string | null
  }
}

/**
 * Corrections never erase history: the mistaken entry is marked voided (with
 * who/when/why) and optional replacement entry is appended. The paid amount and
 * status are recomputed from all non-voided entries.
 */
export async function correctPayment(
  input: CorrectPaymentInput,
): Promise<MonthlyPaymentDoc> {
  if (!Types.ObjectId.isValid(input.paymentId)) {
    throw ApiError.notFound('Billing record not found')
  }
  const payment = await MonthlyPayment.findById(input.paymentId)
  if (!payment) throw ApiError.notFound('Billing record not found')

  const entry = payment.paymentEntries.id(input.entryId)
  if (!entry) throw ApiError.notFound('Payment entry not found')
  if (entry.voided) throw ApiError.conflict('This payment entry was already corrected')

  entry.voided = true
  entry.voidedBy = new Types.ObjectId(input.adminId)
  entry.voidedAt = new Date()
  entry.voidReason = input.reason

  if (input.replacement) {
    if (input.replacement.amountPaise <= 0) {
      throw ApiError.unprocessable('Replacement amount must be greater than zero')
    }
    payment.paymentEntries.push({
      amountPaise: input.replacement.amountPaise,
      paymentDate: input.replacement.paymentDate,
      method: input.replacement.method,
      referenceNumber: input.replacement.referenceNumber ?? null,
      notes: input.replacement.notes ?? null,
      recordedBy: new Types.ObjectId(input.adminId),
      recordedAt: new Date(),
      voided: false,
      voidedBy: null,
      voidedAt: null,
      voidReason: null,
    } as never)
  }

  const activePaid = payment.paymentEntries
    .filter((candidate) => !candidate.voided)
    .reduce((sum, candidate) => sum + candidate.amountPaise, 0)

  payment.amountPaidPaise = activePaid
  payment.status = deriveBaseStatus(payment.dueAmountPaise, activePaid)
  await payment.save()
  return payment
}
