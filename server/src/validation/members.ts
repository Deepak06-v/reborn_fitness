import { z } from 'zod'
import { PLAN_IDS } from '../config/plans'
import { isValidMonth } from '../utils/month'

const paymentStatusValues = ['paid', 'unpaid', 'due_soon', 'overdue'] as const

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value))

const optionalEmail = z
  .union([z.string().trim().email('Enter a valid email address'), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value))

export const createMemberSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  phone: z.string().trim().min(1, 'Phone number is required'),
  joiningDate: z.coerce.date({ errorMap: () => ({ message: 'Joining date is required' }) }),
  // A membership plan is mandatory. The server derives the price from the
  // catalogue, so any client-supplied fee is ignored.
  planId: z.enum(PLAN_IDS, {
    errorMap: () => ({ message: 'Select a membership plan' }),
  }),
  monthlyFeePaise: z.coerce.number().int().min(0).optional(),
  email: optionalEmail,
  address: optionalText(300),
  notes: optionalText(2000),
  membershipType: optionalText(60),
})

export const updateMemberSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(1).optional(),
    joiningDate: z.coerce.date().optional(),
    planId: z.enum(PLAN_IDS).optional(),
    monthlyFeePaise: z.coerce.number().int().min(0).optional(),
    email: optionalEmail,
    address: optionalText(300),
    notes: optionalText(2000),
    membershipType: optionalText(60),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export const listMembersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  paymentStatus: z.enum(paymentStatusValues).optional(),
  month: z.string().refine(isValidMonth, 'Month must be in YYYY-MM format').optional(),
  sort: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const memberIdParamSchema = z.object({
  id: z.string().min(1),
})
