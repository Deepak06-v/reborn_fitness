import { Types, type FilterQuery, type PipelineStage } from 'mongoose'
import { Admin } from '../models/Admin'
import { BulkPaymentOperation, type PlannedPaymentTarget } from '../models/BulkPaymentOperation'
import { Member, type MemberDoc } from '../models/Member'
import { MonthlyPayment, type MonthlyPaymentDoc, type PaymentMethod } from '../models/MonthlyPayment'
import { ApiError } from '../utils/errors'
import { paiseToRupees } from '../utils/money'
import { addDays, formatDDMMYYYY, istDayStart } from '../utils/month'
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
  const targetEnd = '$dueDate'

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
  const targetEnd = '$dueDate'

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
    const evalResult = evaluatePaymentStatus(
      doc.dueAmountPaise,
      doc.amountPaidPaise,
      doc.dueDate,
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
  idempotencyKey?: string | null
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

    // If an idempotencyKey was provided and this bill already contains that entry, return idempotently.
    if (input.idempotencyKey) {
      const existing = payment.paymentEntries.find(
        (e) => e.idempotencyKey === input.idempotencyKey && !e.voided,
      )
      if (existing) {
        return payment
      }
    }

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
    const updateMatch: Record<string, unknown> = {
      _id: payment._id,
      amountPaidPaise: payment.amountPaidPaise,
    }
    if (input.idempotencyKey) {
      updateMatch['paymentEntries.idempotencyKey'] = { $ne: input.idempotencyKey }
    }

    const result = await MonthlyPayment.updateOne(
      updateMatch,
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
            idempotencyKey: input.idempotencyKey ?? null,
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

export interface BulkRecordPaymentsInput {
  operationId?: string
  memberIds: string[]
  method?: PaymentMethod
  paymentDate?: Date
  notes?: string | null
  adminId: string
}

export interface BulkRecordTargetResult {
  paymentId: string
  billingMonth: string
  dueDate: string
  invoiceNumber: string | null
  amountPaise: number
  amount: number
  status: 'success' | 'failed' | 'already_paid'
  error?: string | null
}

export interface MemberBulkResult {
  memberId: string
  memberRef: string
  memberName: string
  totalRecords: number
  processedRecords: number
  totalAmountPaise: number
  totalAmount: number
  success: boolean
  records: BulkRecordTargetResult[]
}

export interface BulkRecordResultItem {
  memberId: string
  memberRef?: string
  memberName?: string
  success: boolean
  paymentId?: string
  invoiceNumber?: string | null
  amountPaise?: number
  amount?: number
  error?: string
}

export interface BulkRecordResult {
  operationId: string
  total: number
  successfulCount: number
  failedCount: number
  totalAmountPaise: number
  totalAmount: number
  memberResults: MemberBulkResult[]
  results: BulkRecordResultItem[]
}

export async function bulkRecordPayments(
  input: BulkRecordPaymentsInput,
): Promise<BulkRecordResult> {
  const uniqueMemberIds = Array.from(new Set(input.memberIds.filter(Boolean)))
  const now = input.paymentDate ?? new Date()
  const tomorrowStart = addDays(now, 1)
  const method: PaymentMethod = input.method ?? 'cash'
  const operationId =
    input.operationId?.trim() || `bulk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  let operation = await BulkPaymentOperation.findOne({ operationId })

  // 1. Immutable snapshot creation if operation is new
  if (!operation) {
    const plannedTargets: PlannedPaymentTarget[] = []

    for (const id of uniqueMemberIds) {
      let member: MemberDoc | null = null
      if (Types.ObjectId.isValid(id)) {
        member = await Member.findById(id)
      }
      if (!member) {
        member = await Member.findOne({ memberId: id })
      }
      if (!member && Types.ObjectId.isValid(id)) {
        const paymentDoc = await MonthlyPayment.findById(id)
        if (paymentDoc) {
          member = await Member.findById(paymentDoc.member)
        }
      }

      if (!member) continue

      // Retrieve ALL outstanding overdue and due-today bills for this member in chronological order
      const bills = await MonthlyPayment.find({
        member: member._id,
        $expr: { $lt: ['$amountPaidPaise', '$dueAmountPaise'] },
        dueDate: { $lt: tomorrowStart },
      }).sort({ dueDate: 1, periodStart: 1 })

      for (const bill of bills) {
        const balance = outstandingBalance(bill.dueAmountPaise, bill.amountPaidPaise)
        if (balance > 0) {
          plannedTargets.push({
            memberId: member._id.toString(),
            memberRef: member.memberId,
            memberName: member.fullName,
            paymentId: bill._id.toString(),
            invoiceNumber: bill.invoiceNumber,
            billingMonth: bill.billingMonth,
            dueDate: bill.dueDate,
            plannedAmountPaise: balance,
            status: 'pending',
            error: null,
            executedAt: null,
          })
        }
      }
    }

    const totalPlanned = plannedTargets.reduce((acc, t) => acc + t.plannedAmountPaise, 0)

    try {
      operation = await BulkPaymentOperation.create({
        operationId,
        adminId: new Types.ObjectId(input.adminId),
        selectedMemberIds: uniqueMemberIds,
        targets: plannedTargets,
        method,
        paymentDate: now,
        totalPlannedAmountPaise: totalPlanned,
        status: 'pending',
      })
    } catch (err) {
      operation = await BulkPaymentOperation.findOne({ operationId })
      if (!operation) throw err
    }
  }

  // 2. Process all planned targets in the immutable snapshot
  for (const target of operation.targets) {
    if (target.status === 'success') continue

    const idempotencyKey = `${operation.operationId}_${target.paymentId}`

    try {
      const bill = await MonthlyPayment.findById(target.paymentId)
      if (!bill) {
        target.status = 'failed'
        target.error = 'Billing record not found'
        continue
      }

      // Check if bill already contains this payment entry (e.g. server crashed after writing entry)
      const existingEntry = bill.paymentEntries.find(
        (e) => e.idempotencyKey === idempotencyKey && !e.voided,
      )
      if (existingEntry) {
        target.status = 'success'
        target.executedAt = existingEntry.recordedAt
        target.error = null
        target.invoiceNumber = bill.invoiceNumber
        continue
      }

      const currentBalance = outstandingBalance(bill.dueAmountPaise, bill.amountPaidPaise)
      if (currentBalance <= 0) {
        target.status = 'already_paid'
        target.error = 'Bill was already fully paid'
        continue
      }

      const amountToPay = Math.min(target.plannedAmountPaise, currentBalance)
      const updated = await recordPayment({
        paymentId: target.paymentId,
        amountPaise: amountToPay,
        paymentDate: operation.paymentDate,
        method: operation.method,
        referenceNumber: null,
        notes: input.notes ?? 'Bulk payment recorded via dashboard',
        adminId: input.adminId,
        idempotencyKey,
      })

      target.status = 'success'
      target.executedAt = new Date()
      target.error = null
      target.invoiceNumber = updated.invoiceNumber

      if (updated.periodEnd) {
        await Member.updateOne(
          {
            _id: updated.member,
            $or: [{ nextBillingDate: { $lt: updated.periodEnd } }, { nextBillingDate: null }],
          },
          { $set: { nextBillingDate: updated.periodEnd } },
        )
      }
    } catch (err) {
      target.status = 'failed'
      target.error = err instanceof Error ? err.message : 'Payment recording failed'
    }
  }

  const allSuccess = operation.targets.every(
    (t) => t.status === 'success' || t.status === 'already_paid',
  )
  const anySuccess = operation.targets.some(
    (t) => t.status === 'success' || t.status === 'already_paid',
  )
  operation.status = allSuccess ? 'completed' : anySuccess ? 'partial_failure' : 'failed'
  await operation.save()

  // 3. Build structured per-member results and backward-compatible flat results
  const memberMap = new Map<string, MemberBulkResult>()
  for (const id of uniqueMemberIds) {
    memberMap.set(id, {
      memberId: id,
      memberRef: '',
      memberName: '',
      totalRecords: 0,
      processedRecords: 0,
      totalAmountPaise: 0,
      totalAmount: 0,
      success: false,
      records: [],
    })
  }

  let totalCollectedPaise = 0
  const flatResults: BulkRecordResultItem[] = []

  for (const target of operation.targets) {
    let m = memberMap.get(target.memberId)
    if (!m) {
      m = {
        memberId: target.memberId,
        memberRef: target.memberRef,
        memberName: target.memberName,
        totalRecords: 0,
        processedRecords: 0,
        totalAmountPaise: 0,
        totalAmount: 0,
        success: false,
        records: [],
      }
      memberMap.set(target.memberId, m)
    }

    m.memberRef = target.memberRef
    m.memberName = target.memberName
    m.totalRecords += 1

    const isSuccess = target.status === 'success' || target.status === 'already_paid'
    if (isSuccess) {
      m.processedRecords += 1
      if (target.status === 'success') {
        m.totalAmountPaise += target.plannedAmountPaise
        m.totalAmount = paiseToRupees(m.totalAmountPaise)
        totalCollectedPaise += target.plannedAmountPaise
      }
    }

    m.records.push({
      paymentId: target.paymentId,
      billingMonth: target.billingMonth,
      dueDate: (target.dueDate as Date).toISOString(),
      invoiceNumber: target.invoiceNumber,
      amountPaise: target.plannedAmountPaise,
      amount: paiseToRupees(target.plannedAmountPaise),
      status: target.status === 'success' ? 'success' : target.status === 'already_paid' ? 'already_paid' : 'failed',
      error: target.error,
    })
  }

  // Populate per-member final status & flat results
  for (const [id, m] of memberMap.entries()) {
    if (m.totalRecords === 0) {
      m.success = false
      let memberExists = false
      if (Types.ObjectId.isValid(id)) {
        memberExists = Boolean(await Member.findById(id).select('_id'))
      }
      if (!memberExists) {
        memberExists = Boolean(await Member.findOne({ memberId: id }).select('_id'))
      }

      flatResults.push({
        memberId: id,
        memberRef: m.memberRef || id,
        memberName: m.memberName || (memberExists ? id : 'Unknown member'),
        success: false,
        error: memberExists ? 'Member has no overdue or due-today bills' : 'Member not found',
      })
    } else {
      m.success = m.processedRecords === m.totalRecords
      flatResults.push({
        memberId: id,
        memberRef: m.memberRef,
        memberName: m.memberName,
        success: m.success,
        paymentId: m.records[0]?.paymentId,
        invoiceNumber: m.records[0]?.invoiceNumber ?? null,
        amountPaise: m.totalAmountPaise,
        amount: paiseToRupees(m.totalAmountPaise),
        error: m.success ? undefined : `${m.totalRecords - m.processedRecords} of ${m.totalRecords} bills failed`,
      })
    }
  }

  const successfulMembers = Array.from(memberMap.values()).filter((m) => m.success).length
  const failedMembers = Array.from(memberMap.values()).filter((m) => !m.success).length

  return {
    operationId: operation.operationId,
    total: uniqueMemberIds.length,
    successfulCount: successfulMembers,
    failedCount: failedMembers,
    totalAmountPaise: totalCollectedPaise,
    totalAmount: paiseToRupees(totalCollectedPaise),
    memberResults: Array.from(memberMap.values()),
    results: flatResults,
  }
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
