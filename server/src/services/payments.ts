import { Types, type FilterQuery } from 'mongoose'
import { Admin } from '../models/Admin'
import { Member } from '../models/Member'
import { MonthlyPayment, type MonthlyPaymentDoc, type PaymentMethod } from '../models/MonthlyPayment'
import { ApiError } from '../utils/errors'
import { paiseToRupees } from '../utils/money'
import { currentMonth } from '../utils/month'
import {
  deriveBaseStatus,
  deriveStatus,
  outstandingBalance,
  type PaymentStatus,
} from '../utils/paymentStatus'
import { escapeRegex, paymentStatusExpr } from '../utils/query'
import { serializeMember, serializePayment } from './serializers'

export async function getPaymentDetail(id: string) {
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
  status?: PaymentStatus
  page: number
  limit: number
}

export async function listPayments(params: ListPaymentsParams) {
  const month = params.month ?? currentMonth()
  const now = new Date()

  const baseMatch: FilterQuery<MonthlyPaymentDoc> = { billingMonth: month }
  if (params.search) {
    const rx = new RegExp(escapeRegex(params.search.trim()), 'i')
    const members = await Member.find({
      $or: [{ fullName: rx }, { memberId: rx }, { phone: rx }],
    }).select('_id')
    baseMatch.member = { $in: members.map((member) => member._id) }
  }

  const query: FilterQuery<MonthlyPaymentDoc> = { ...baseMatch }
  if (params.status) query.$expr = paymentStatusExpr(params.status, now)

  const page = Math.max(params.page, 1)
  const limit = Math.min(Math.max(params.limit, 1), 200)
  const [total, docs, totalsAgg] = await Promise.all([
    MonthlyPayment.countDocuments(query),
    MonthlyPayment.find(query)
      .sort({ memberId: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    MonthlyPayment.aggregate<{
      _id: null
      due: number
      paid: number
      remaining: number
    }>([
      { $match: baseMatch },
      {
        $project: {
          due: '$dueAmountPaise',
          paid: '$amountPaidPaise',
          balance: { $subtract: ['$dueAmountPaise', '$amountPaidPaise'] },
        },
      },
      {
        $group: {
          _id: null,
          due: { $sum: '$due' },
          paid: { $sum: '$paid' },
          remaining: { $sum: { $cond: [{ $gt: ['$balance', 0] }, '$balance', 0] } },
        },
      },
    ]),
  ])

  const members = await Member.find({ _id: { $in: docs.map((doc) => doc.member) } })
  const memberMap = new Map(members.map((member) => [member._id.toString(), member]))

  const totals = totalsAgg[0] ?? { _id: null, due: 0, paid: 0, remaining: 0 }

  return {
    month,
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
    },
  }
}

export async function getPaymentsForExport(params: {
  month?: string
  search?: string
  status?: PaymentStatus
}) {
  const month = params.month ?? currentMonth()
  const now = new Date()
  const query: FilterQuery<MonthlyPaymentDoc> = { billingMonth: month }
  if (params.search) {
    const rx = new RegExp(escapeRegex(params.search.trim()), 'i')
    const members = await Member.find({
      $or: [{ fullName: rx }, { memberId: rx }, { phone: rx }],
    }).select('_id')
    query.member = { $in: members.map((member) => member._id) }
  }
  if (params.status) query.$expr = paymentStatusExpr(params.status, now)

  const docs = await MonthlyPayment.find(query).sort({ memberId: 1 })
  const members = await Member.find({ _id: { $in: docs.map((doc) => doc.member) } })
  const memberMap = new Map(members.map((member) => [member._id.toString(), member]))

  return docs.map((doc) => {
    const member = memberMap.get(doc.member.toString())
    const balance = outstandingBalance(doc.dueAmountPaise, doc.amountPaidPaise)
    return {
      memberRef: member?.memberId ?? doc.memberId,
      fullName: member?.fullName ?? 'Unknown member',
      phone: member?.phone ?? '',
      billingMonth: doc.billingMonth,
      dueAmount: paiseToRupees(doc.dueAmountPaise),
      amountPaid: paiseToRupees(doc.amountPaidPaise),
      balance: paiseToRupees(balance),
      dueDate: doc.dueDate.toISOString(),
      status: deriveStatus(doc.dueAmountPaise, doc.amountPaidPaise, doc.dueDate),
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
