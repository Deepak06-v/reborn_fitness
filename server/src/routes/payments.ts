import { Router } from 'express'
import type { z } from 'zod'
import { validate } from '../middleware/validate'
import {
  correctionSchema,
  generateMonthSchema,
  listPaymentsQuerySchema,
  paymentIdParamSchema,
  recordPaymentSchema,
} from '../validation/payments'
import { asyncHandler } from '../utils/errors'
import { generateMonthlyDues } from '../services/billing'
import {
  correctPayment,
  getPaymentDetail,
  getPaymentsForExport,
  listPayments,
  recordPayment,
  type ListPaymentsParams,
} from '../services/payments'
import { serializePayment } from '../services/serializers'

const router = Router()

type RecordPaymentBody = z.infer<typeof recordPaymentSchema>
type CorrectionBody = z.infer<typeof correctionSchema>

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

router.get(
  '/export',
  validate({ query: listPaymentsQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as {
      month?: string
      search?: string
      status?: ListPaymentsParams['status']
    }
    const rows = await getPaymentsForExport(query)
    const header = [
      'Member ID',
      'Name',
      'Phone',
      'Billing Month',
      'Due (INR)',
      'Paid (INR)',
      'Balance (INR)',
      'Due Date',
      'Status',
    ]
    const lines = [header.join(',')]
    for (const row of rows) {
      lines.push(
        [
          row.memberRef,
          row.fullName,
          row.phone,
          row.billingMonth,
          row.dueAmount,
          row.amountPaid,
          row.balance,
          row.dueDate.slice(0, 10),
          row.status,
        ]
          .map(csvCell)
          .join(','),
      )
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reborn-payments-${query.month ?? 'current'}.csv"`,
    )
    res.send(lines.join('\n'))
  }),
)

router.get(
  '/',
  validate({ query: listPaymentsQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(await listPayments(req.query as unknown as ListPaymentsParams))
  }),
)

router.post(
  '/generate-month',
  validate({ body: generateMonthSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as { billingMonth: string; dueDate: Date }
    const summary = await generateMonthlyDues(body)
    res.status(201).json(summary)
  }),
)

router.get(
  '/:id',
  validate({ params: paymentIdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await getPaymentDetail(req.params.id))
  }),
)

router.post(
  '/:id/entries',
  validate({ params: paymentIdParamSchema, body: recordPaymentSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as RecordPaymentBody
    const payment = await recordPayment({
      paymentId: req.params.id,
      amountPaise: body.amountPaise,
      paymentDate: body.paymentDate,
      method: body.method,
      referenceNumber: body.referenceNumber ?? null,
      notes: body.notes ?? null,
      adminId: (req.admin as NonNullable<typeof req.admin>)._id.toString(),
    })
    res.status(201).json({ payment: serializePayment(payment) })
  }),
)

router.post(
  '/:id/corrections',
  validate({ params: paymentIdParamSchema, body: correctionSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as CorrectionBody
    const payment = await correctPayment({
      paymentId: req.params.id,
      entryId: body.entryId,
      reason: body.reason,
      replacement: body.replacement
        ? {
            amountPaise: body.replacement.amountPaise,
            paymentDate: body.replacement.paymentDate,
            method: body.replacement.method,
            referenceNumber: body.replacement.referenceNumber ?? null,
            notes: body.replacement.notes ?? null,
          }
        : undefined,
      adminId: (req.admin as NonNullable<typeof req.admin>)._id.toString(),
    })
    res.json({ payment: serializePayment(payment) })
  }),
)

export default router
