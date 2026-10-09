import { Router } from 'express'
import { validate } from '../middleware/validate'
import { dashboardQuerySchema } from '../validation/dashboard'
import { asyncHandler } from '../utils/errors'
import { currentMonth } from '../utils/month'
import { getDashboard } from '../services/dashboard'

const router = Router()

router.get(
  '/',
  validate({ query: dashboardQuerySchema }),
  asyncHandler(async (req, res) => {
    const month = (req.query.month as string | undefined) ?? currentMonth()
    res.json(await getDashboard(month))
  }),
)

export default router
