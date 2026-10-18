import { Router } from 'express'
import type { z } from 'zod'
import { validate } from '../middleware/validate'
import { requireOwner } from '../middleware/auth'
import {
  correctionSchema,
  listPaymentsQuerySchema,
  paymentIdParamSchema,
  recordPaymentSchema,
} from '../validation/payments'
import { asyncHandler } from '../utils/errors'
import { istDay } from '../utils/month'
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
      'Member Name',
      'Member ID',
      'Phone',
      'Plan',
      'Joining Date',
      'Period Start',
      'Period End',
      'Due Date',
      'Invoice Number',
      'Amount Due (INR)',
      'Amount Paid (INR)',
      'Outstanding (INR)',
      'Status',
      'Last Payment Date',
      'Last Payment Method',
    ]
    const money = (value: number): string => value.toFixed(2)
    const lines = [header.join(',')]
    for (const row of rows) {
      lines.push(
        [
          row.fullName,
          row.memberRef,
          row.phone,
          row.planName,
          row.joiningDate,
          row.periodStart,
          row.periodEnd,
          row.dueDate,
          row.invoiceNumber,
          money(row.dueAmount),
          money(row.amountPaid),
          money(row.balance),
          row.status,
          row.lastPaymentDate,
          row.lastPaymentMethod,
        ]
          .map(csvCell)
          .join(','),
      )
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reborn-fitness-payments-${istDay(new Date())}.csv"`,
    )
    // RFC 4180 line endings; UTF-8 without a BOM.
    res.send(lines.join('\r\n'))
  }),
)

router.get(
  '/',
  validate({ query: listPaymentsQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(await listPayments(req.query as unknown as ListPaymentsParams))
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
  requireOwner,
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
