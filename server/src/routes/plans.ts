import { Router } from 'express'
import { PLANS } from '../config/plans'
import { serializePlan } from '../services/serializers'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ plans: PLANS.map((plan) => serializePlan(plan)) })
})

export default router
