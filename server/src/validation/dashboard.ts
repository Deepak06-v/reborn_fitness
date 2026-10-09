import { z } from 'zod'
import { isValidMonth } from '../utils/month'

export const dashboardQuerySchema = z.object({
  month: z.string().refine(isValidMonth, 'Month must be in YYYY-MM format').optional(),
})
