import { z } from 'zod'
import { isValidMonth } from '../utils/month'

export const paymentMethods = ['cash', 'upi', 'bank_transfer', 'card', 'other'] as const

export const listPaymentsQuerySchema = z.object({
  month: z.string().refine(isValidMonth, 'Month must be in YYYY-MM format').optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['paid', 'unpaid', 'partial', 'overdue']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
})

export const generateMonthSchema = z.object({
  billingMonth: z.string().refine(isValidMonth, 'Month must be in YYYY-MM format'),
  dueDate: z.coerce.date({ errorMap: () => ({ message: 'Due date is required' }) }),
})

export const recordPaymentSchema = z.object({
  amountPaise: z.coerce.number().int('Amount must be a whole number of paise').positive(),
  paymentDate: z.coerce.date({ errorMap: () => ({ message: 'Payment date is required' }) }),
  method: z.enum(paymentMethods),
  referenceNumber: z
    .union([z.string().trim().max(120), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value)),
  notes: z
    .union([z.string().trim().max(1000), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value)),
})

export const correctionSchema = z.object({
  entryId: z.string().min(1),
  reason: z.string().trim().min(3, 'A correction reason is required').max(500),
  replacement: z
    .object({
      amountPaise: z.coerce.number().int().positive(),
      paymentDate: z.coerce.date(),
      method: z.enum(paymentMethods),
      referenceNumber: z
        .union([z.string().trim().max(120), z.literal(''), z.null()])
        .optional()
        .transform((value) => (value === '' || value === undefined ? null : value)),
      notes: z
        .union([z.string().trim().max(1000), z.literal(''), z.null()])
        .optional()
        .transform((value) => (value === '' || value === undefined ? null : value)),
    })
    .optional(),
})

export const paymentIdParamSchema = z.object({ id: z.string().min(1) })
